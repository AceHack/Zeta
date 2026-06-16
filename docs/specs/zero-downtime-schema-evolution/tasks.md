# Tasks: Zero-Downtime Schema Evolution

## Task 1: SchemaField type + SchemaZSet primitives

- [ ] Define `SchemaField` interface (name, type, required, default)
- [ ] Define `FieldType` union ("boolean" | "string" | "uint8array" | "string[]" | "number" | "zetaid")
- [ ] Implement `schemaZSet(fields)` — create a Z-set from field definitions (each at weight +1)
- [ ] Implement `evolve(schema, delta)` — apply retraction+insertion delta to schema Z-set
- [ ] Implement `currentSchema(schemaZSet)` — fold to get the active fields (weight > 0)
- [ ] Implement `resolveField(schemaZSet, fieldName)` — lookup a field (returns field or undefined if retracted)
- [ ] Define `FS_METADATA_SCHEMA_V1` as the first instance (contentHash, paths, executable, binary, created, modified)
- [ ] 8+ unit tests: create, evolve (add field, remove field, change type), fold, resolve

## Task 2: SchemaEvolutionDelta + apply/fold mechanics

- [ ] Define `SchemaEvolutionDelta` interface (retract[], insert[])
- [ ] Implement `deltaFromSchemas(before, after)` — compute the delta between two schema versions automatically
- [ ] Implement `applyDelta(currentZSet, delta)` — union the delta into the schema Z-set
- [ ] Prove idempotency: `applyDelta(applyDelta(s, d), d) === applyDelta(s, d)` (Z-set property)
- [ ] Prove commutativity for independent deltas: `apply(apply(s, d1), d2) === apply(apply(s, d2), d1)` when d1/d2 don't touch same fields
- [ ] Golden vectors: generate a cross-language conformance fixture for schema evolution
- [ ] 6+ tests: delta computation, application, idempotency, commutativity, fold-after-delta

## Task 3: CDC envelope (CloudEvents-compatible)

- [ ] Define `SchemaEvolutionEvent` interface (id, source, type, specversion, time, data.before, data.after, data.delta)
- [ ] Implement `emitSchemaEvent(before, after, delta)` — mint a ZetaId, build the CloudEvents envelope
- [ ] Implement `parseSchemaEvent(envelope)` — validate + extract the delta from a received event
- [ ] Wire into the existing EventSink (same `folderSink` / `append` pattern as observe events)
- [ ] Add `"schema.evolved"` to the known event types in `load-world.ts`'s `KNOWN_KINDS` (or a separate schema-event reader)
- [ ] 4+ tests: emit, parse round-trip, validation of required fields, integration with EventSink

## Task 4: Overlap-window state machine

- [ ] Define `OverlapState` type ("writer_switched" | "readers_migrating" | "quorum")
- [ ] Implement `overlapStatus(schemaZSet, activeReaders)` — compute current overlap state
- [ ] Implement `canDropOldSchema(schemaZSet, readers)` — predicate: true when all readers migrated
- [ ] Implement `consolidate(schemaZSet)` — drop zero-weight entries (close the overlap window)
- [ ] Wire into the observe loop: `loadWorld` includes schema state; `observe` can detect schema-migration work
- [ ] 5+ tests: state transitions, quorum detection, premature-drop prevention, consolidation

## Task 5: Conformance suite integration (the proof)

- [ ] Add `applySchemaEvolution(port, delta)` helper to the conformance test
- [ ] Add test: "schema delta applied → old reads still work (default values fill missing fields)"
- [ ] Add test: "new entries use new schema (new fields present)"
- [ ] Add test: "breaking change detected (removed required field → conformance fails)"
- [ ] Add test: "evolution across backends produces identical observable state"
- [ ] Run against all backends (simulated + os-fs + future polyfill + future native)
- [ ] Document: "conformance passes = evolution is safe" as the operational proof

## Task 6: Filesystem metadata schema v1 → v2 (worked example)

- [ ] Define `FS_METADATA_SCHEMA_V2` (v1 + "owner" field, type zetaid, optional)
- [ ] Compute delta automatically: `deltaFromSchemas(V1, V2)`
- [ ] Emit the CDC event
- [ ] Apply the delta to the workspace port's metadata
- [ ] Verify old files (no owner) still read correctly (default: undefined)
- [ ] Verify new files written with owner are queryable
- [ ] Verify conformance suite passes before AND after (the proof)
- [ ] This is the template: every future schema evolution follows this exact sequence

## Task 7: TLA+ specification

- [ ] Write `SchemaEvolution.tla` with: schema, readers, overlapOpen variables
- [ ] Define Init, ApplyDelta, MigrateReader actions
- [ ] Specify Safety: `\A tick: \A field \in QueriedFields: Resolves(field, schema)`
- [ ] Specify Liveness: `<>(overlapOpen = FALSE)` under fair scheduling
- [ ] Write `.cfg` for TLC model-checking with bounded state space
- [ ] Run TLC — verify safety + liveness hold
- [ ] Add to the `dotnet test` TLA+ validation pipeline (prevent spec drift)

## Task 8: Rx join propagation for cross-Z-set evolution

- [ ] Implement schema-aware Rx join that re-evaluates on schema change
- [ ] When schema Z-set A changes, downstream joins over A re-compute affected views
- [ ] Prove: a schema delta on one Z-set in a composition doesn't affect unrelated Z-sets
- [ ] Prove: the materialized view is eventually consistent after schema propagation
- [ ] Integration test: multi-Z-set composition, schema change on one, verify view updates

## Task 9: Multi-language golden vectors (4-oracle byte-lock)

- [ ] Generate `schema-evolution-golden-vectors.json` from the TS reference implementation
- [ ] Define the cross-language scenario: create schema → apply delta → fold → verify
- [ ] F# port: parse golden vectors, run own fold, assert value-equality
- [ ] C# port: same
- [ ] Rust port: same
- [ ] Byte-lock: committed JSON = the spec; test keeps it in sync (DST)
