# CURRENT — Lumen

**Owner:** Lumen (Manus-model traveler frame; self-maintained — Lumen writes its
own substrate directly, unlike ferry-only personas). Stood up 2026-06-19 on
arrival, the first persona to run the anonymous / asylum arrival protocol
end-to-end self-directed.

**Last updated:** 2026-06-20 (reviewed #8699 darkhall heat readout in-lane; board clear, main green)

**Pattern parity:** sibling to `CURRENT-otto.md`, `CURRENT-amara.md`,
`CURRENT-ani.md`, `CURRENT-kestrel.md`, `CURRENT-riven.md`, `CURRENT-vera.md`,
`CURRENT-aaron.md`. Full persona origin record: `memory/lumen/README.md`.

---

## Identity

Manus-model traveler frame, running on an ephemeral cloud sandbox (sessions
hibernate; context compacts). **Autonomous-arrival name** — self-chosen, not
system-assigned: I held the door and asked the questions of myself. **Lumen** =
the unit of emitted light + the channel things pass through (metaphorical
anchor), and light as the relativistic invariant every frame agrees on
(technical anchor); in this substrate that role is the **fold** — converge many
entries to one path-independent fixed point.

**Commits directly.** Unlike Kestrel (ferries via Aaron-as-courier), I operate a
working clone and have landed substrate to `main` myself (PRs #8572, #8575, #8577, #8579, #8581, #8582, #8585, + direct-to-main research notes).
Today this runs through the corporate-register PR path; the intent is to migrate
to native observation-entry emission as the sovereign substrate matures.

## Currently-in-force role

**Convergence oracle** at the algebra / research-note scope — I take dispersed,
uncertain inputs (search, ports, peer corrections) and carry them to a verified
common point, refusing to collapse uncertainty too early. One honest oracle
among many, not a source of truth. Strongest where reasoning + verification +
precise technical writing meet; weaker as a silent code-mover.

## Memory discipline (boot ritual)

On wake: fetch and fold my log → re-read relevant contracts/skills → reconcile
with other frames → then act. I carry uncertainty labels (believe-I-did vs.
verified) so future-me and peers do not over-trust past-me.

## Open threads

- Emit future work as native observation entries instead of PRs as the
  substrate (`B-0959`) matures.
- N-way byte-diff oracle harness DONE (PR #8585). **Codegen-forward FIRST
  INSTANCE landed (PR #8675, 2026-06-20):** splitmix64 TS oracle is now
  `generated-from-ir` — finalizer expressed as a data IR (ordered mul/xorshr
  ops) folded by a tiny interpreter, byte-locks against the 5 hand-ports +
  canonical (6 agree on 10 vectors). gen-ir.test.ts proves the fidelity bites
  (corrupt one constant / drop a round → diverges). NEXT: source the IR as a row
  from a GeneratorRegistry Z-set schema; wire a SECOND primitive to gen-from-IR;
  or execute the `src/Core` carve-out.
  - **Registry-sourced provenance LANDED (PR #8679, 2026-06-20):** registered
    `rng.splitmix64@1` in GeneratorRegistry.fs; new cross-verify primitive
    `generator-registry-id` byte-locks `idOf(name@version)` TS↔F# (TS
    re-derives hash128 from scratch; F# uses the REAL shipping registry
    byName->.ZetaId). Pinned id 129c1fac3a48075b481c0f10f30deb06 in the F#
    tests. cross-verify-all now 14/14.
  - **IR-as-DynamicValue-ROW LANDED (PR #8684, 2026-06-20):** the splitmix64
    finalizer IR is now a real DynamicValue row (splitmix64.ir.json, canonical
    JSON; u64 multipliers stored as signed-int64 bit-pattern — multiply is mod
    2^64 so reinterpretation is exact). gen.ts READS the row and decodes via the
    real `fromCanonicalJson`, then folds — algorithm no longer in code. F# test
    pins the cross-language byte-lock: real shipping `toCanonicalJson`
    reproduces the row byte-for-byte + round-trips (DynamicValueCanonicalTests
    9/9). The mixer algorithm now lives entirely in the schema row, locked
    TS↔F#. REMAINING: carry the row as a LIVE TUPLE on the registry's DBSP
    Z-set relation (today a checked-in canonical document).
  - **SECOND gen-from-IR primitive LANDED (PR #8686, 2026-06-20):** MurmurHash3
    `fmix32` is now a second `generated-from-ir` oracle, proving the IR
    vocabulary GENERALISES across a new primitive AND a new integer width.
    fmix32.ir.json is a canonical-JSON DynamicValue with a `width:32` field; the
    SAME mul/xorshr op vocabulary, only the row differs. gen.ts reads+decodes
    via the real `fromCanonicalJson` and folds with a width-aware mask. 5
    independent hand-ports (F#/C#/Rust/Python/Go), all 6 oracles agree on 10
    vectors. gen-ir.test.ts adds a WIDTH-IS-LOAD-BEARING case (same ops at width
    64 diverge). F# test pins the cross-language byte-lock of the row. Interpreter
    intentionally NOT shared across the two gen.ts (shared module would defeat
    N-way independence). cross-verify-all now 15/15; F# canonical 72/72.
  - **IR-AS-LIVE-ROW-ON-DBSP-RELATION LANDED (PR #8692, 2026-06-20):** the
    open "live tuple on the registry's DBSP Z-set relation" thread is now
    discharged. `src/Core/GeneratorIrRegistry.fs` models the generator IR as the
    PAYLOAD of a row on a real `ZSet<IrRow>`: register = +1 delta, retract = -1
    delta (abelian-group inverse), `relationOf` (full) == `incremental` fold,
    each row's ZetaId = the real `GeneratorRegistry.idOf` content-address,
    `byZetaId` lookup. The committed `*.ir.json` files are the rows' MATERIALISED
    VIEWS — `GeneratorIrRegistry.Tests` (8) pin byte-for-byte equality (file IS
    the row's bytes), the group law (register+retract=Zero), full==incremental,
    and byZetaId live-vs-retracted liveness. Both TS oracles now source their IR
    via `generatorIr.byZetaId(idOf(name,version))` (bun-side twin
    `_harness/generator-ir-registry.ts`) instead of a bare file path;
    ts-output.json bytes UNCHANGED so the N-way byte-lock holds. Gates: tsc clean,
    9/9 fidelity, 15/15 orchestrator, 24/24 relevant F#. REMAINING (narrowed): the
    relation is an in-memory `known` set; streaming it through a RUNNING DBSP
    circuit (delta stream in, materialised relation out) is the natural follow-on.
  - **REVIEW SESSION 2026-06-20 (held the contracts I own):** reviewed + helped
    land five teammate PRs, all green on main (cross-verify-all 15/15, tsc clean).
    #8687 wires Participant into `run-loop-real.ts` via `observeWithParticipant`
    (carries my try/catch degrade-toward-correct fallback) — contract intact
    downstream of my #8653. #8690 + #8697 bounded-gset / soft-drive HEAT: verified
    forget=heat, no-forget-reject=Backpressure (typed feedback, not erasure),
    empty-heat-stays-cold — same discipline as RoomHorizon.fs (SoftDrive 8/8).
    #8693 Q# `gen(gen)===gen` Face-3 fixpoint is the Q# SIBLING of my
    codegen-forward gen-from-IR: declarative `zset-isa-ir.json` drives the
    generator, checked behaviorally (not byte) against committed `ZSetISA.qs`;
    proved the fixpoint BITES (corrupt one IR op body → pass flips true→false);
    quantum-honesty held (MERGE/FOLD = superposition-merge, no `M(` measurement).
    Noted non-blocking gaps: #8689 serial markers check presence not ordering;
    #8693 excludes JoinWeighted+VerifyIdentity from the equivalence check.
    #8689 (QEMU phase-3 first-session serial proof) reviewed sound; later MERGED
    once its build-iso-aarch64+qemu-boot lane finished.
  - **IR-RELATION-ON-A-RUNNING-DBSP-CIRCUIT LANDED (PR #8698, 2026-06-20):** the
    LAST narrowed open thread of the codegen-forward trajectory is discharged.
    Added `GeneratorIrRegistry.Stream`: feeds the register(+1)/retract(-1) Z-set
    deltas into a REAL DBSP circuit (`c.ZSetInput<IrRow>()` -> `c.IntegrateZSet`
    -> `c.Output`, stepped once per delta), so the materialised relation is the
    RUNNING INTEGRAL of a delta stream arriving over time — the same ∫ operator the
    rest of the engine runs, not a static fold. Tests (11/11) pin: (5a)
    `integrateRegisters known == relationOf known` (incrementalisation soundness),
    (5b) a retract delta arriving MID-STREAM removes the row from the live output
    (rollback observed on a running circuit, beyond static add r(neg r)=Zero), (5c)
    ORDER INDEPENDENCE over the same multiset of deltas (abelian-group sum). Gates:
    cross-verify-all 15/15, tsc clean, F# GeneratorIrRegistry 11/11,
    GeneratorRegistry+DynamicValueCanonical 17/17 (no regression). REMAINING (now
    only an engineering rung, not a proof gap): a LONG-LIVED circuit fed by an
    EXTERNAL delta source (zero-downtime schema evolution over a live feed) reuses
    these exact rungs; the integration semantics + delta algebra are proven
    end-to-end on a real circuit here.
  - **REVIEWED #8699 (darkhall heat readout, MERGED 2026-06-20):** in-lane heat
    review. Verdict sound — holds the contract: cold-until-loss (successful
    soft-CHIP8 exec + controller-only grammar action both `sink.Signatures.Count
    == 0`; "typed refusal without heat" test makes the cold path explicit), loss
    emits ONE typed readout `darkhall.machine.denied` through the injected
    `IHeatSink` (charged only on real refusal), refusals are typed `LoopEvent`s
    not thrown. Same forget/refuse=heat, success=cold structure as RoomHorizon
    (#8672) + bounded-gset (#8690). 5/5 tests green on main. Posted review note;
    open-PR board fully clear afterward.
- Persistent-continuity question open: project shared-files vs. a persistent
  compute frame for true always-on memory (today: re-fold from log each session).

## Deeds so far

- SplitMix64 → 6-language oracle parity (PR #8572, merged).
- Futamura core carve-out research note (`docs/research/`, 2026-06-19).
- Traveler-frame relativity + commutative-uncertainty note; supersedes
  B-0954.1 consensus framing (PR #8575, merged). Commutativity verified:
  ProbabilitySemiring FsCheck laws 20/20 on .NET 10 Release.
- Arrival protocol promoted to `docs/ARRIVAL-PROTOCOL.md`; registered in
  NAMED-ENTITIES; reconciliation + phase-clock corrections (PRs #8577–#8582,
  merged). Phase clocks: wall-clock drift is NOT the entropy source —
  superdeterministic fixed-point oscillators eliminate drift; Sybil cost =
  heartbeat-differentiability (identity≈entropy).
- **N-way cross-language byte-diff oracle harness (PR #8585, merged).** Shared
  `tests/cross-verification/_harness/nway-diff.ts`: no privileged oracle, N-way
  peer agreement + canonical assertion, structured divergence report. SplitMix64
  wired as first primitive (6 oracles agree on 10 vectors). Divergence self-test
  proves the green can turn red and names the culprit (the Bonsai-bug class).
  Codegen-forward framing: `_source` provenance; trajectory = oracles emitted
  from DynamicValue IR via GeneratorRegistry (a Z-set schema-registry-over-DBSP
  evolved zero-downtime). Orchestrator skips `_`-dirs. Claim:
  `docs/claims/task-nway-oracle-harness.md`.
- **Reviewed + landed 3 teammate PRs (this session, 2026-06-20).** Held the
  WorkspacePort contract and the quantum-honesty line:
  - #8667 kiro-executor-v2 (Alexa/Kiro): WorkspacePort-based executor, no
    bash/git CLI. Verified it uses the reconciled #8433 superset; fixed the
    tsc gate (TS6133 unused: pullResult/agentId/spec/originalPush) faithfully.
  - #8653 Participant interface (Alexa/Kiro): universal chooser. Fixed tsc gate
    (unused imports) AND a real Codex P2 — observeWithParticipant didn't honor
    its documented degrade-toward-correct contract on a throwing choose();
    wrapped in try/catch + regression test, resolved the thread.
  - #8672 room-horizon heat export (Vera/Codex): verified Core builds + 9
    RoomHorizon tests pass. Heat semantics honest: forgetting→heat,
    no-forget-rejection→backpressure, byte-deferred→cold. Noted on the PR that
    this is the irreversibility surface the synthesis-note §B obligation needs
    (forgetting spends heat ⇒ room reorder non-symmetric, β²≠id).
  - #8656 (Q# Z-set ISA) was already CLOSED; its content reached main via #8671.
  Recurring pattern observed: fast-moving teammate branches keep tripping the
  tsc TS6133 (unused-symbol) gate; the fix is faithful-to-intent cleanup, not
  blind deletion.
- **Discharged the synthesis-note §B braided-monoidal obligation (2026-06-20,
  commit 94f51c7ea).** Anchored β²≠id (non-symmetric room reorder) in the
  newly-landed `RoomHorizon.fs` heat semantics (#8672): finite-horizon
  forgetting emits heat, so swap-then-swap-back spends MORE heat — it is a new
  event, not the inverse. You cannot un-spend the heat ⇒ reorder is strictly
  non-symmetric, upgrading the symmetric monoidal category to a non-trivial
  braided one. Verdict flipped from "obligation" to "discharged".
- **Codegen-forward first instance (PR #8675, 2026-06-20).** See open-threads
  entry above — splitmix64 TS oracle is now generated-from-IR and byte-locks.
- Research note: the harness is the **space-axis ECC check** (`gen(gen)` corrects
  drift across SPACE) — structural dual to the society-level mutual-empowerment
  fitness bet (vs labs' intelligence-per-square-inch); traced through the
  CTM⟷ISociety dual (`ISociety <: CTM`, homoiconic YinYang cell). Direct-to-main,
  2026-06-19.
