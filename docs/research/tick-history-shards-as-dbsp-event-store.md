---
Scope: Research-grade math note. Formalizes the shard transport adopted in PR #724 (Option B for task #276) using DBSP / Z-set algebra + CQRS / Event Sourcing terminology.
Attribution: Amara (math derivation + 7 laws to test) via Aaron 2026-04-29 forwarding. Gemini supplied the CQRS / Event Sourcing framing in the upstream multi-AI synthesis. Aaron delegated authority on substrate of this scope per the operator-authority criterion.
Operational status: research-grade
Lifecycle status: active (not escrowed; ties directly to landed Option B implementation)
Non-fusion disclaimer: Naming the shard transport as "Git-native CQRS / Event Sourcing implemented with DBSP / Z-set algebra" does NOT claim the shard transport implements the full DBSP system as currently specified in the Zeta operator algebra. It claims the math substrate is *isomorphic* enough that the laws below should hold; the implementation is plain Markdown files + filesystem operations, not the DBSP F# circuit code. Lineage is real; identity is not merged.
---

# Tick-history shards as a DBSP / Z-set event store

## Core claim

> Shard files are the write model / event store.
> Aggregated tick-history tables are read models / projections.
> DBSP / Z-set algebra supplies the retraction-native delta math.

Short form:

```text
Shard files are events.
The table is a projection.
Z-sets are the delta algebra.
```

## Why this note exists

PR #724 landed the per-tick shard-file transport (Option B for
task #276) to eliminate the EOF append-hotspot conflict surface
in `docs/hygiene-history/loop-tick-history.md`. Multi-AI
review (Gemini + Amara, 2026-04-29) named the architecture
pattern explicitly:

- **Gemini**: Git-native CQRS / Event Sourcing
- **Amara**: this is exactly the shape DBSP / Z-set algebra was
  designed for — retraction-native deltas integrated into a
  store, projected into read models incrementally

This note records the formal math anchoring so future
contributors can:

1. Verify the implementation against the laws below.
2. Build the projector (generator script) using the DBSP
   incrementalization pattern.
3. Add retraction-event semantics when a shard needs to be
   superseded or corrected.

## Carrier types

```text
TickId = (Timestamp, ContentHash)
```

Filename encoding (current landed convention):

```text
docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md
```

Filename encoding (future-migration recommendation for
multi-agent / high-concurrency, per the 2026-04-29 hardening
review on the shard transport README):

```text
docs/hygiene-history/ticks/YYYY/MM/DD/HHMMSSZ-<short-content-hash>.md
```

The math below uses the content-hash form because it makes
idempotency / retraction laws cleanest to state. The current
operational form (`HHMMZ.md` with `-01`, `-02` suffixes for
same-minute collisions) is sufficient for single-agent
autonomous-loop cadence and is what's currently on main per
`docs/hygiene-history/ticks/README.md`.

Each shard parses into:

```text
TickRow = {
  tick_id, timestamp, kind,
  speculative_work, verify, commit,
  tick_history_append, cron_status, stop,
  pr_refs, notes
}
```

The event-store carrier is:

```text
Tick = TickId × TickRow
```

A tick-history store is a Z-set:

```text
E : Tick → ℤ
```

with finite support. Weights:

```text
+1 = this tick shard exists / is live
-1 = this tick shard is retracted / superseded
 0 = absent (after consolidation)
```

This matches the existing Zeta glossary entry for Z-sets
(`docs/GLOSSARY.md` "Z-set" entry — finite-support `K → ℤ`
group structure with negative weights representing
retractions).

## Write model: shard events

Each new tick writes one event delta:

```text
δ_t = { tick_t ↦ +1 }
```

The event store at time `t` is the integration of deltas:

```text
E_t = I(δ)_t = Σ_{i≤t} δ_i
```

This is the DBSP interpretation of Event Sourcing: appending
an event is emitting a `+1` delta into the integrated stream.

A correction is NOT an in-place edit; it is another delta:

```text
δ_fix = { old_tick ↦ -1, corrected_tick ↦ +1 }
```

That gives a typed retraction instead of history surgery — the
audit trail retains both events while the live projection shows
only the corrected row.

## Read model: aggregate tick table

The legacy `docs/hygiene-history/loop-tick-history.md` is the
read model / projection:

```text
T_t = Render(P_struct(E_t))
```

Where:

- `P_struct : E → ZTickView` is the algebraic projection from
  live tick events to ordered tick-row view (group-homomorphic
  over the parts that are algebraic).
- `Render : ZTickView → Markdown` is presentation-only
  materialization (string rendering and sorting are not
  group-homomorphic, so this stage is presentation, not algebra).

Splitting these prevents the math from overclaiming: the
algebraic step is incremental; the rendering step is full
materialization on cadence.

## CQRS / DBSP decomposition

```text
Command side (write):
  Write shard event δ_t.

Event store:
  E_t = I(δ)_t

Algebraic projection:
  V_t = P_struct(E_t)

Read-model materialization:
  R_t = Render(V_t)
```

Equivalently:

```text
R_t = Render(P_struct(I(δ)_t))
```

DBSP incrementalization:

```text
ΔV_t = D(P_struct(I(δ)))_t
Inc(P_struct) = D ∘ P_struct ∘ I
```

This matches the standard DBSP incrementalization pattern (see
`docs/GLOSSARY.md` "DBSP" entry; Zeta operator algebra).

## Filename standard (content-addressed)

Use content-addressed identity for shard files:

```text
tick_id = (timestamp, h(canonicalize(row)))
```

Future-migration recommended path (NOT the current landed
convention):

```text
docs/hygiene-history/ticks/YYYY/MM/DD/HHMMSSZ-<short-content-hash>.md
```

Current landed convention per `docs/hygiene-history/ticks/README.md`:

```text
docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md
```

with `-01`, `-02` suffixes for same-minute collisions. The
content-hash form below is forward-looking; adopting it is a
migration recommendation, not the current contract.

Idempotency law:

```text
canonicalize(row₁) = canonicalize(row₂)
⇒ h(row₁) = h(row₂)
⇒ tick_id(row₁) = tick_id(row₂)
⇒ same path  ⇒  no-op duplicate write
```

Collision handling:

```text
if path exists and content is identical:
  no-op / duplicate write suppressed

if path exists and content differs:
  fail closed or add explicit collision suffix with log
```

This is the algebraic version of "same event should not
double-count."

## The seven laws to test

These are the operational invariants the shard transport
should satisfy. Future tests against the implementation should
exercise each.

### Law 1 — Independent shard commutativity

```text
δ_a + δ_b = δ_b + δ_a  (for distinct tick ids)
```

Test: write `0230Z` shard then `0235Z` shard; write in reverse
order; projection rows equal after timestamp sort.

### Law 2 — Idempotent duplicate suppression

```text
write(δ) ; write(δ) = write(δ)
```

Same content + same timestamp + same hash → no double-count.
Implementation choice: prefer no-op duplicate path (reject
identical second write); alternative is allow `+2` weight then
distinct by `TickId` in projection.

### Law 3 — Retraction cancellation

```text
δ + (-δ) = 0
```

Test: write shard; write retraction event; projection excludes
the row.

### Law 4 — Supersession

```text
old + (-old + new) = new
```

Test: write malformed shard; write supersession event;
projection contains only corrected row; audit retains both
facts.

### Law 5 — Projection rebuild equivalence

```text
Render(P_struct(I(all_deltas))) = rebuild_from_all_shards()
```

Test: incremental projection and full rebuild from filesystem
produce identical Markdown table.

### Law 6 — Write/read separation

```text
ordinary_tick_write ∩ generated_projection_write = ∅
```

Ordinary shard PRs MUST NOT mutate the generated aggregate
table. If they do, the EOF append-hotspot returns at the
projection layer. Exception: explicit
projection-rebuild PR.

### Law 7 — Chronology

```text
∀ rows i, j:
  i.timestamp < j.timestamp ⇒ index(i) < index(j)  in render
```

Rendered read model sorts by timestamp, independent of merge
order.

## Retraction / supersession model

If a tick row needs correction after the shard has been
committed, two implementation options:

### Option 1 — Physical retraction file (preferred for algebraic cleanliness)

Create a retraction shard:

```text
docs/hygiene-history/ticks/retractions/YYYY/MM/DD/HHMMSSZ-<old-hash>.md
```

Payload:

```yaml
retracts: <old_tick_id>
reason: typo | factual-correction | duplicate | malformed
replacement: <new_tick_id | null>
```

Algebra:

```text
E_t = E_{t-1} + { old ↦ -1 } + { new ↦ +1 }
```

### Option 2 — Supersession metadata in the corrected shard

The corrected shard carries a YAML header:

```yaml
supersedes: <old_tick_id>
```

Projection interprets `supersedes(old)` as effective weight `-1`
for the old row.

Recommendation: Option 1. It makes the negative delta explicit
in the filesystem, which matches Zeta's first-class retraction
discipline (see `docs/GLOSSARY.md` "Retraction" entry).

## Anti-hotspot law (the formal reason Option B works)

The original failure mode was:

```text
∀ tick, write same file F (loop-tick-history.md)
```

This creates append-hotspot contention — every parallel write
needs serialization on `F`'s EOF.

Shard law:

```text
∀ tick_i ≠ tick_j: path(tick_i) ≠ path(tick_j)
```

Except the idempotent duplicate case (`tick_i = tick_j`).

The write collision surface shrinks from "one global EOF table"
to "only same-event identity collision." That is the formal
reason the EOF-append-hotspot is structurally eliminated for
new tick rows.

It does NOT eliminate all conflict classes:

- Same-timestamp filename collisions (mitigated by content-hash
  in the filename)
- README / schema edits (covered by ordinary PR review)
- Generator output conflicts (covered by Law 6)
- Directory / index conflicts (covered by Law 6 + projection
  cadence)

## Implementation sketch (F# types)

For when the projector script is written:

```fsharp
type TickId = {
  TimestampUtc : DateTimeOffset
  ContentHash  : string
}

type TickKind =
  | Material
  | Maintenance
  | NoOp
  | Recovery
  | Projection

type TickRow = {
  Id                : TickId
  Kind              : TickKind
  SpeculativeWork   : string
  Verify            : string
  Commit            : string
  TickHistoryAppend : string
  CronStatus        : string
  Stop              : string
  Notes             : string list
  PrRefs            : int list
}

type TickEvent =
  | TickWritten of TickRow
  | TickRetracted of TickId * reason: string
  | TickSuperseded of oldId: TickId * newRow: TickRow

type Weight = int64
type ZSet<'K when 'K : comparison> = Map<'K, Weight>
```

Event-to-delta mapping:

```fsharp
let deltaOfEvent (e : TickEvent) (lookup : TickId -> TickRow option) : ZSet<TickId * TickRow> =
  match e with
  | TickWritten row ->
      Map.ofList [ ((row.Id, row), +1L) ]
  | TickRetracted (oldId, _) ->
      match lookup oldId with
      | Some oldRow -> Map.ofList [ ((oldId, oldRow), -1L) ]
      | None        -> Map.empty
  | TickSuperseded (oldId, newRow) ->
      match lookup oldId with
      | Some oldRow ->
          Map.ofList [
            ((oldId,    oldRow), -1L)
            ((newRow.Id, newRow), +1L)
          ]
      | None ->
          Map.ofList [ ((newRow.Id, newRow), +1L) ]
```

Algebraic projection:

```fsharp
let projectTickRows (store : ZSet<TickId * TickRow>) : TickRow list =
  store
  |> Map.toSeq
  |> Seq.choose (fun ((_, row), weight) ->
      if weight > 0L then Some row else None)
  |> Seq.sortBy (fun row -> row.Id.TimestampUtc)
  |> Seq.toList
```

Render:

```fsharp
let renderMarkdownTable (rows : TickRow list) : string =
  rows |> List.map renderRow |> String.concat "\n"
```

The split is load-bearing: `projectTickRows` is the algebraic
projection; `renderMarkdownTable` is presentation. Group
homomorphism holds for the first; it does not for the second.

## Composition with existing Zeta substrate

This research note composes with (but does NOT extend) the
following landed substrate:

- `docs/GLOSSARY.md` "DBSP", "Z-set", "Retraction" entries —
  the math vocabulary this note builds on.
- PR #724 (`docs/hygiene-history/ticks/README.md`) — the
  operational README this note formalizes.
- `docs/AUTONOMOUS-LOOP.md` step 5 — the canonical write path
  for new tick events.
- The escrowed Aurora flywheel thesis (`docs/research/escrowed/
  aurora-autonomous-flywheel-thesis-2026-04-28.md`) — possibly
  related but EXPLICITLY not extended by this note. The Aurora
  thesis remains escrowed; this note covers only the
  tick-history transport.

## What this note does NOT claim

- Does NOT claim the shard transport implements the full DBSP
  system as specified in the Zeta operator algebra.
- Does NOT claim the projector script exists yet.
- Does NOT claim the seven laws have been formally tested.
- Does NOT extend the escrowed Aurora flywheel thesis.
- Does NOT replace the existing AUTONOMOUS-LOOP.md liveness
  invariant — every tick still gets canonical evidence.

## Best distilled rules

```text
Shard files are events.
Generated tables are projections.
Z-sets make corrections algebraic.
```

```text
CQRS gives the architecture.
Event Sourcing gives the storage story.
DBSP / Z-sets give the correction algebra.
```

## Status + next steps

- **Research-grade**, not operational. The math anchoring exists
  here for future implementation work (a projector / generator
  script).
- **Falsifier-test**: any implementation must satisfy the seven
  laws above. If a law fails, the implementation has drifted
  from the math.
- **Next step**: when the projector script is written (under
  task #276 follow-up), it should ship with a test suite that
  exercises Laws 1-7 against synthetic shard fixtures.
