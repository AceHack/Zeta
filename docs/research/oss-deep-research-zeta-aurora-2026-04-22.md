# OSS deep-research absorption — Zeta repo archive, oracle design, Aurora integration

**Status:** first-pass absorption of maintainer-dropped research report.
**Source:** `drop/deep-research-report.md` (OpenAI Deep Research output,
maintainer-dropped 2026-04-22 auto-loop-43; deleted post-absorption per
drop-zone protocol).
**Session context:** inaugural test of the `drop/` protocol
(`drop/README.md`); Aaron's directive *"new research just dropped in the
repo can you make me a folder you check every now and then i can put
files in for you to absorb"*.

## What the report is

An OpenAI Deep Research synthesis comparing two Zeta-lineage
GitHub repositories — **Lucent-Financial-Group/Zeta** (the
canonical factory this file lives in) and **AceHack/Zeta** (a
diverged snapshot sharing the technical core but with
governance-layer drift). The report inventories preserved
file families across five strata, proposes a seven-layer
oracle-gate design distilled from the repos' patterns, and
argues for an internal codename **"Aurora"** as the recipient
project of those absorbed ideas — with an explicit
trademark-clearance caveat attached.

Citation style: `fileciteturn<N>file<M>` tokens throughout;
these are OpenAI Deep Research's source-chunk markers and are
not resolvable outside the original tool.

## Executive finding

> The durable value is the **architectural stack**: retractions,
> laws, simulation, provenance, compaction discipline, and
> threat-aware gating. These ideas are strong enough to port
> directly into a successor project (whether called Aurora or
> otherwise). The governance/factory overlay is optional and
> should be absorbed last, if at all.

Verbatim-preservation note: the above is my paraphrase of the
report's conclusion section, not a verbatim pull. The report's
own words in the conclusion: *"the durable value here is the
architectural stack of retractions, laws, simulation,
provenance, compaction discipline, and threat-aware gating,
and those ideas are strong enough to port directly into
Aurora."*

## Five preservation strata

The report argues that any successor project should absorb the
Zeta core in this import order. Layered, not literal — pull
ideas, not filenames.

1. **Engine core** — retraction-native Z-set/multiset, signed
   deltas, capability tags on operators, the D / I / z⁻¹ / H
   algebra family, sink-boundary discipline.
2. **Specs and proofs** — TLA+ for liveness / safety of the
   retraction pipeline, Lean for the algebraic laws, OpenSpec
   for behaviour.
3. **Security and governance** — SDL checklist, SLSA +
   sigstore + cosign posture, Semgrep + CodeQL + Stryker
   portfolio, SHA-pinned GHA, threat model.
4. **Factory skills and agents** — persona roster, conflict
   resolution protocol, autonomous-loop discipline. The
   *heaviest* overlay — defer import until core and security
   are stable.
5. **Memory and research** — the per-persona notebooks,
   research docs, decision log. Import last as lived context
   that makes the earlier strata make sense.

## The seven-layer oracle gate

The report's strongest technical contribution is a proposed
**OracleEngine** abstraction that runs at four lifecycle
points — **register**, **build**, **tick publish**,
**compaction** — and emits `pass | warn | fail | quarantine`
findings from seven evidence layers:

| Layer        | What it checks                                                                   |
|--------------|----------------------------------------------------------------------------------|
| Schema       | Dependency declarations match actual dependencies; capability tags present      |
| Algebra      | Operators pass their declared laws (linearity, bilinearity, idempotence, etc.) |
| Retraction   | Signed-delta conservation; no non-zero residual where zero is required         |
| Provenance   | Tick envelopes carry valid `ProvenanceStamp` (tick, frontier, inputs, rules, SHA) |
| Compaction   | Compaction frontier > rollback frontier; observational equivalence to un-compacted trace |
| Runtime      | Seed-replay determinism; budget/timeout compliance; checkpoint hash integrity  |
| Security     | Action pins live; SAST/CodeQL/Semgrep gates fresh; signed-publish policy enforced |

**Distinction the design insists on:** *semantic failure*
(algebra-law violation, retraction leak) triggers **reject**;
*possibly-already-visible-side-effect* failure
(checkpoint-integrity, replay-nondeterminism) triggers
**quarantine** — explicit retraction rather than silent drop;
*freshness/coverage* gaps trigger **warn** only and must be
logged to a debt surface.

The report includes a ~150-line F# skeleton (`module
Aurora.Oracle`) covering `OracleSeverity`, `OracleCode`,
`OracleFinding`, `ProvenanceStamp`, `TickEnvelope<'T>`,
`OracleContext<'State,'Delta>`, a `Checks` module with
per-layer check functions, and a top-level `applyOrRetract`
that routes reject/quarantine outcomes.

## Aurora branding — clearance-gated, internal-only for now

The report flags **three** collisions on the "Aurora" name
that preclude unilateral public adoption:

1. **Amazon Aurora** (AWS relational database service)
2. **Aurora** in the NEAR/blockchain ecosystem
3. **Aurora Innovation** (autonomous-vehicle company)

Recommended stance: **keep "Aurora" as an internal codename
or architecture name only**, pending a formal clearance
procedure (trademark search across relevant classes, overlap
audit, domain/social/SEO review, multi-audience message
testing, brand-architecture decisioning). The report also
says the message house should be built around what the repo
actually teaches — *retraction-native systems*, *observable
rollback*, *harm-bounding infrastructure*, *verifiable
AI/software operations*, *compaction after truth, not before
truth* — not around mythic cosmic metaphors.

## Relevance to Zeta factory

Three concrete intersections with work already in flight:

- **ServiceTitan demo target (#244 P0).** The oracle-gate
  proposal is very close to what we'd want the demo to show:
  a live retraction happening and the oracle emitting a
  `pass`, `warn`, or `quarantine` finding in real time.
  Seven-layer structure gives a natural UI: seven status
  chips, one per layer, per tick.
- **Semiring-parameterized Zeta regime-change claim**
  (`memory/project_semiring_parameterized_zeta_regime_change_one_algebra_to_map_others_2026_04_22.md`).
  The oracle-gate is oracle-over-one-algebra; the
  semiring-parameterized reframe generalises this to
  oracle-over-any-algebra-that-hosts-in-the-operator-algebra.
  This is the fifth-ish occurrence of the
  stable-meta-pluggable-specialist pattern.
- **All-physics-in-one-DB agent-coherence substrate**
  (`memory/project_zeta_is_agent_coherence_substrate_all_physics_in_one_db_stabilization_goal_2026_04_22.md`).
  The seven oracle layers are roughly the "physics checks"
  Aaron wanted the DB to host: schema / algebra /
  retraction / provenance / compaction / runtime / security
  map tightly to what the coherence substrate is supposed
  to stabilise.

## What the report gets right (pull into Zeta now)

- **Semantic-vs-policy failure split** (reject vs quarantine
  vs warn). The quarantine tier is important — signed
  retraction for already-visible side effects, not silent
  failure. Worth lifting into our oracle terminology.
- **Four-point lifecycle** (register / build / tick publish /
  compaction). Matches existing plugin-contract lifecycle
  in `docs/plugin-contract.md`; the oracle maps naturally
  onto those hooks.
- **Test harness recommendation**: property tests for
  algebra laws, DST for scheduler/ordering, golden replay
  for compaction equivalence, negative fixtures for sink
  misuse, security-config break-tests. This is
  cross-validated with the formal-verification portfolio
  Soraya already maintains.

## What needs independent verification before load-bearing

- **The F# oracle skeleton** — code is plausible but not
  compiled / tested against current Zeta.Core. `List.append`
  ordering in the `run` function folds findings in reverse
  order, which may or may not be intentional. Treat as
  sketch, not drop-in.
- **Archive inventory comparison Lucent-vs-AceHack** — the
  report explicitly flags that Lucent was "much easier to
  enumerate deeply" and AceHack was under-sampled. Don't
  use the comparison table as authoritative on what each
  fork has.
- **Aurora collision list** — the three collisions named
  (AWS Aurora / NEAR Aurora / Aurora Innovation) are
  plausible but not independently verified. If we're going
  to use the name even internally, Ilyana (public-api /
  brand-clearance roster) should do the trademark scan
  herself, not rely on the report's claim.

## Open questions for Aaron

1. **Is "Aurora" the intended successor-project name, or was
   it the report's own suggestion?** The question matters
   because if Aaron hadn't picked the name, the whole
   branding section is speculative and we should ignore the
   naming recommendations.
2. **Is Lucent-Financial-Group/Zeta the canonical fork and
   AceHack/Zeta a snapshot, or vice versa?** Governance
   drift between the two is flagged but not resolved — our
   work happens in which tree?
3. **Scope for the oracle-gate — port now, or defer to
   v1?** Seven-layer gate is a substantial surface. If
   deferred, at least pin the taxonomy (reject /
   quarantine / warn) into our terminology now so we don't
   later find ourselves importing a different vocabulary.

## Absorption meta — drop-zone protocol first use

This absorption note is the inaugural use of the `drop/`
protocol (`drop/README.md`). The source file
`deep-research-report.md` sat at repo root for ~10 minutes
before protocol creation; post-protocol, it moved through
`drop/` and was deleted. Future deposits go straight to
`drop/` and bypass repo-root entirely.

**Calibration for future absorptions:** this report is
~40 KB, 342 lines, well-structured markdown. Absorption took
one tick to read, one to structure-and-land. That's the
baseline for text-document-class deposits. Binary-class
deposits will take longer and will exercise the
known-binary-type registry at `drop/README.md` for the first
time.

## Cross-references

- `drop/README.md` — the drop-zone protocol
- `memory/project_aaron_drop_zone_protocol_2026_04_22.md`
  — maintainer directive captured
- `memory/feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`
  — signal-preservation invariant applied to absorption
- `memory/project_semiring_parameterized_zeta_regime_change_one_algebra_to_map_others_2026_04_22.md`
  — adjacent regime claim
- `docs/BACKLOG.md` #244 — ServiceTitan demo (oracle-gate
  fits the demo)
- `docs/DECISIONS/` — oracle-gate taxonomy adoption, if
  pursued, needs its own ADR
