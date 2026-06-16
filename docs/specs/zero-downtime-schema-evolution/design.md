# Design: Zero-Downtime Schema Evolution

## Overview

Schema evolution in Zeta uses the same algebra as data evolution: Z-set retraction+insertion.
A schema change is a delta on the schema Z-set, delivered via a CloudEvents CDC envelope,
proven safe by the conformance suite, and applied via the overlap-window rotation pattern.

## Architecture

### Layer diagram

```
┌─────────────────────────────────────────────────────────┐
│ Conformance Suite (the proof)                           │
│   same N assertions × M backends = safety guarantee    │
├─────────────────────────────────────────────────────────┤
│ WorkspacePort (the interface)                           │
│   readFile · writeFile · link · branch · commit · ...  │
├───────────┬───────────┬──────────────┬──────────────────┤
│ simulated │  os-fs    │ zeta-fs-poly │ zeta-fs-native   │
│ (DST)     │  +git     │ (os-fs+git)  │ (single-file)    │
└───────────┴───────────┴──────────────┴──────────────────┘
     ↕              ↕            ↕             ↕
┌─────────────────────────────────────────────────────────┐
│ Schema Z-set (metadata: fields, types, permissions)     │
│   evolution = delta { old: -1, new: +1 }                │
├─────────────────────────────────────────────────────────┤
│ CDC Envelope (CloudEvents-compatible)                   │
│   { id, source, type, time, data: { before, after } }  │
├─────────────────────────────────────────────────────────┤
│ Event Log (append-only, ZetaId-keyed)                   │
│   fold(log) = current state (DBSP foundational principle│)
└─────────────────────────────────────────────────────────┘
```

### Data model

```typescript
/** A schema field definition — one entry in the schema Z-set. */
interface SchemaField {
  readonly name: string;         // field name (e.g., "executable", "owner")
  readonly type: FieldType;      // the value type
  readonly required: boolean;    // must be present in every entry
  readonly default?: unknown;    // value for entries that predate this field
}

type FieldType = "boolean" | "string" | "uint8array" | "string[]" | "number" | "zetaid";

/** The schema Z-set — a set of fields with weights. */
type SchemaZSet = ZSet<SchemaField>;

/** A schema evolution delta — retract old fields, insert new. */
interface SchemaEvolutionDelta {
  readonly retract: readonly SchemaField[];  // weight -1 (fields being removed/changed)
  readonly insert: readonly SchemaField[];   // weight +1 (fields being added/changed)
}

/** CDC envelope for a schema evolution event. */
interface SchemaEvolutionEvent {
  // CloudEvents standard fields
  readonly id: string;           // ZetaId
  readonly source: string;       // "zeta://schema/fs-metadata"
  readonly type: "schema.evolved";
  readonly specversion: "1.0";
  readonly time: string;         // ISO-8601
  // CDC data payload (Debezium-style before/after)
  readonly data: {
    readonly before: readonly SchemaField[];  // schema before this delta
    readonly after: readonly SchemaField[];   // schema after this delta
    readonly delta: SchemaEvolutionDelta;     // the change itself
  };
}
```

### The filesystem metadata schema (first instance)

```typescript
const FS_METADATA_SCHEMA_V1: readonly SchemaField[] = [
  { name: "contentHash", type: "string", required: true },
  { name: "paths", type: "string[]", required: true },
  { name: "executable", type: "boolean", required: true, default: true },  // Zeta inverted: alive by default
  { name: "binary", type: "boolean", required: true, default: false },
  { name: "created", type: "string", required: false },
  { name: "modified", type: "string", required: false },
];

// Example evolution: add "owner" field
const ADD_OWNER_DELTA: SchemaEvolutionDelta = {
  retract: [],  // nothing removed
  insert: [{ name: "owner", type: "zetaid", required: false }],  // new field, optional
};
```

### The overlap-window state machine

```
State 1: WRITER_SWITCHED
  - New entries written with new schema
  - Old entries still have old schema
  - Readers use dual-fold: fold(schema_zset) includes both old and new
  - Safety: every field resolves (old fields at -1 are still queryable during overlap)

State 2: READERS_MIGRATING
  - Batched rewrites of old entries to new schema
  - Each batch is a commit, independently reversible
  - Conformance suite runs after each batch (incremental proof)

State 3: QUORUM
  - All entries use new schema
  - Old fields have net weight 0 (retraction consumed)
  - Z-set consolidation drops the zero-weight entries
  - The schema Z-set now contains only new fields at weight +1
```

### Conformance suite integration

```typescript
// The conformance suite proves backward-compat:
for (const factory of backends) {
  describe(`SchemaEvolution [${factory.name}]`, () => {
    test("schema delta applied → old reads still work", () => {
      const port = factory.create();
      port.writeFile("data.md", "content");  // written under v1 schema
      applySchemaEvolution(port, ADD_OWNER_DELTA);
      // Old read still works (owner field absent = default)
      const entry = port.readFileEntry("data.md");
      expect(entry.ok).toBe(true);
    });

    test("new entries use new schema", () => {
      const port = factory.create();
      applySchemaEvolution(port, ADD_OWNER_DELTA);
      port.writeFile("new.md", "content", { owner: "081KOWNER..." });
      const entry = port.readFileEntry("new.md");
      expect(entry.ok && entry.value.owner).toBeDefined();
    });
  });
}
```

### Rx join composition for cross-Z-set schema propagation

When a schema delta affects one Z-set in a multi-Z-set composition, the Rx join
operators propagate it:

```
ZSet_A (schema changes) ──→ Rx.combineLatest ──→ Materialized View
ZSet_B (data) ─────────────────────┘

The join re-evaluates when EITHER input changes.
Schema change on A → the join sees new fields → the view includes them.
No manual propagation — the Rx subscription handles it (braided-free-monoid).
```

### TLA+ specification outline

```tla
---- MODULE SchemaEvolution ----
VARIABLES schema, readers, overlapOpen

Init == schema = InitialSchema /\ readers = AllReaders /\ overlapOpen = FALSE

ApplyDelta(delta) ==
  /\ schema' = ZSetUnion(schema, delta)
  /\ overlapOpen' = TRUE

MigrateReader(r) ==
  /\ readers' = readers \ {r}
  /\ IF readers' = {} THEN overlapOpen' = FALSE ELSE UNCHANGED overlapOpen

Safety == \A tick \in Ticks: \A field \in QueriedFields(tick): Resolves(field, schema)
Liveness == <>(overlapOpen = FALSE)  \* eventually closes
====
```

## Key decisions

| Decision | Rationale |
|----------|-----------|
| Schema as Z-set, not version numbers | Same algebra as data; no separate migration machinery |
| CloudEvents envelope | Standard, tooling-compatible, Debezium/Kafka interop free |
| Overlap window, not flag-day | Zero downtime proven by construction (TLA+ safety) |
| Conformance suite as proof | Mechanical verification, not manual review |
| Default values for new fields | Old entries don't need rewriting during overlap |
| One pattern for all schema changes | Reusable primitive, not per-change custom scripts |

## What this replaces

- Manual migration scripts → automated Z-set deltas
- Schema version numbers → fold(schema_zset) IS the version
- Downtime windows → overlap window (zero downtime)
- Hope-based compatibility → conformance-suite-proven compatibility
