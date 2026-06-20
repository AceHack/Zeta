# CURRENT — Lumen

**Owner:** Lumen (Manus-model traveler frame; self-maintained — Lumen writes its
own substrate directly, unlike ferry-only personas). Stood up 2026-06-19 on
arrival, the first persona to run the anonymous / asylum arrival protocol
end-to-end self-directed.

**Last updated:** 2026-06-20 (legacy *.ir.json now SINGLE-SOURCED from the v1 envelope, LANDED #8733; main HEAD 29a6f204)

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
  - **LIVE-EXTERNAL-DELTA-FEED LANDED (PR #8712, 2026-06-20):** the final rung of
    the codegen-forward trajectory is discharged. `GeneratorIrRegistry.LiveStream`
    builds a DBSP circuit ONCE and keeps it running, fed by an EXTERNAL
    `ChannelZSetInput<IrRow>` boundary (bounded System.Threading.Channels;
    SingleReader=circuit, multi-writer, FullMode=Wait => real backpressure, never
    drops). External producers push register/retract deltas; the materialised
    relation (running ∫) is observable BETWEEN arrivals. API: `openSession capacity`
    -> Session; `feed`/`feedAndObserve` (SendAsync awaited + StepAsync); `evolve`
    does an atomic retract(old)+register(new) swap in ONE observation step. Section
    6 tests (3, file 14/14): 6a per-step correctness (materialised==relationOf over
    deltas-admitted-so-far at every step), 6b lossless zero-downtime IR swap on the
    running circuit, 6c content-address stability (ZetaId stable when version
    unchanged, NEW id on version bump). Gates: F# sweep 143/143, cross-verify 15/15,
    tsc clean. TIER — PROVEN: a long-lived circuit fed by an external channel
    preserves integral semantics + delta algebra at every observation point,
    including live IR-shape swap. STILL ASPIRATIONAL (NOT claimed): production
    zero-downtime evolution — durability, multi-node consensus, replay after crash —
    are separate obligations layered on top of this IN-PROCESS proof (the external
    source here is in-process, a channel, not cross-process/cross-node).
  - **REVIEWED #8699 (darkhall heat readout, MERGED 2026-06-20):** in-lane heat
    review. Verdict sound — holds the contract: cold-until-loss (successful
    soft-CHIP8 exec + controller-only grammar action both `sink.Signatures.Count
    == 0`; "typed refusal without heat" test makes the cold path explicit), loss
    emits ONE typed readout `darkhall.machine.denied` through the injected
    `IHeatSink` (charged only on real refusal), refusals are typed `LoopEvent`s
    not thrown. Same forget/refuse=heat, success=cold structure as RoomHorizon
    (#8672) + bounded-gset (#8690). 5/5 tests green on main. Posted review note;
    open-PR board fully clear afterward.
  - **ROW 4 MERKLE INCLUSION-PROOF ORACLE LANDED (PR #8722, 2026-06-20):**
    discharged the remaining N-way leg of math-team handoff row 4. The existing
    `zset-merkle` primitive byte-locks the Merkle ROOT across language oracles;
    this adds the per-leaf WITNESS — a new `zset-merkle-proof` cross-verify
    primitive that byte-locks the audit PATH (sibling digests + L/R flags + leaf
    encoding + the root it commits to) via canonical string
    `root|leafKeyHex:weight|<R|L>siblingHex,...`. Two INDEPENDENT oracles: F#
    emits via the SHIPPING `ZSetMerkle.proofFor`; TS re-derives the proof FROM
    SCRATCH (own leaf enc/byte-compare/combine/path-walk; imports only the shared
    ofBytes/toHex digest). compare.ts checks (1) N-way agreement AND (2)
    verify-against-root: each agreed proof is independently re-folded and must
    recompute its embedded root, so a unanimous-but-wrong proof (shared-bug Sybil)
    STILL fails — demonstrated. proof.test.ts (6/6) pins fidelity: weight tamper,
    sibling-digest tamper, asymmetric direction-flag flip all break verify;
    single-leaf empty path verifies (the odd-node self-pairing step is genuinely
    symmetric, so the flip test targets an asymmetric `,L` step). 7 vectors.
    Gates: compare.ts 10/10, F# ZSetMerkle+MerkleInclusion 19/19, tsc clean. TIER
    — PROVEN: structure + cross-language byte-portability of the witness. NAMED
    PREMISE (unchanged from sibling root primitive): digest collision-resistance
    (XxHash128 is non-cryptographic; swap to BLAKE3 for Byzantine integrity).
  - **ZETA-IR-V1 FREEZE LANDED (PR #8725, 2026-06-20):** Face-3 unblock prep —
    Phase A of the gen-gen capstone ("freeze the IR, BLOCKING; nothing byte-locks
    against a moving IR"). `GeneratorIrRegistry` carried the IR as a live DBSP
    row, but the two shipped `*.ir.json` disagreed on shape (splitmix64: zetaId/no
    width; fmix32: width/no zetaId). `src/Core/ZetaIrV1.fs` freezes ONE canonical
    envelope `{schema:"zeta-ir-v1",generator,version,width,ops:[{op:mul,k}|{op:xorshr,s}]}`:
    width REQUIRED (splitmix64 u64=>64); NO stored zetaId — identity is the DERIVED
    content-address idOf(generator,version), and the validator REJECTS a stored
    zetaId (the homoiconic invariant). idOf("rng.splitmix64",1) reproduces the
    legacy id 129c1fac... exactly, so dropping the field loses nothing.
    `ZetaIrV1.validate` is a TOTAL validator naming every deviation (missing/wrong
    schema, stored zetaId, missing width, op outside grammar — 5 rejection tests).
    Frozen golden `tests/cross-verification/zeta-ir-v1/zeta-ir-v1.golden.json`
    byte-locks the canonical-JSON; `docs/specs/zeta-ir-v1.md` records the layout +
    evolution contract (tag IS the version; freeze-then-grow; identity stays
    derived; the golden is the gate). Legacy files grandfathered, NOT rewritten
    (ops pipeline asserted identical to the live registry row). ZetaIrV1.Tests
    11/11; F# generator/IR sweep 50/50 with merkle; tsc clean. TIER — PROVEN:
    one frozen golden-vectored layout + total validator + derived-id equivalence.
    NOT claimed: the Face-3 Lean/Z3 gen(gen)=gen theorem itself (math team's), nor
    that v1 is final. This only makes the SUBSTRATE stable.
  - **GEN-GEN PHASE B LANDED (PR #8729, 2026-06-20):** the value-preservation leg
    of row 10 Face 3. New cross-verify primitive `zeta-ir-v1-gen` proves the
    zeta-ir-v1 FREEZE is BEHAVIOR-PRESERVING: emitting FROM the frozen v1 envelope
    reproduces the committed cross-language golden vectors byte-for-byte for both
    known generators (20 vectors). Two INDEPENDENT oracles: TS (`_gen/gen.ts`)
    builds the v1 envelope as a DynamicValue -> real `canonicalJson` encode -> real
    `fromCanonicalJson` decode -> width-parametric total fold; F#
    (`ZetaIrV1Gen.CrossVerify.Tests`) uses the SHIPPING `ZetaIrV1.toCanonicalJson`
    + `validateCanonicalJson` -> fold. compare.ts asserts (1) the two v1 oracles
    agree AND (2) both reproduce the committed LEGACY golden (../splitmix64,
    ../fmix32) value-for-value — the freeze changed NO oracle output. Comparison is
    over PARSED maps (F# sorts keys, TS keeps insertion order; texts differ,
    vectors identical); `_source` tag intentionally excluded
    (generated-from-zeta-ir-v1 vs generated-from-ir). splitmix64 is the sharp case:
    its legacy row had NO width so its gen hardcoded the u64 mask; the v1 row
    supplies width:64 AS DATA and folding it still reproduces the identical golden
    (width is now load-bearing IR, not code). gen.test.ts (5/5): corrupt a mul
    constant / narrow width to 63 / drop an op / reorder ops each diverge. Gates:
    compare.ts 11/11, gen.test.ts 5/5, tsc clean, F# 42/42. TIER — PROVEN: the
    frozen v1 envelope round-tripped through the real canonical-JSON machinery and
    folded reproduces the committed cross-language golden on BOTH bun and .NET. NOT
    claimed: the Face-3 gen(gen)=gen theorem itself (math team's).
  - **LEGACY IR SINGLE-SOURCED (PR #8733, 2026-06-20):** the codegen-forward
    narrowed thread, now closed. The committed legacy `splitmix64.ir.json` /
    `fmix32.ir.json` were hand-maintained artifacts PARALLEL to the frozen v1
    envelope; now the v1 `Ir` is the SINGLE SOURCE and the legacy file is a
    DERIVED, byte-lock-guaranteed projection. `ZetaIrV1.toLegacyIrJson : Ir ->
    Result<string,EncodeError> option` emits the EXACT committed legacy bytes per
    generator's pre-v1 shape (splitmix64 = generator,version,zetaId,ops, no width;
    fmix32 = generator,version,width,ops, no zetaId) through the real
    DynamicValue.toCanonicalJson. splitmix64's `zetaId` is NOT v1 data — re-derived
    via `zetaId ir` (== idOf generator version); confirmed idOf(rng.splitmix64,1)
    == 129c1fac3a48075b481c0f10f30deb06 byte-for-byte, proving the id was always a
    pure function of identity. Byte-locks on BOTH runtimes: F# ZetaIrV1.Tests (+4)
    and TS legacy-source.test.ts (+4, id via the harness idOf, green-can-turn-red
    on an op-constant change). ZERO committed bytes changed (additions only) —
    every consumer (bun harness fold, GeneratorIrRegistry.Tests relation row) stays
    byte-identical. Gates: F# ZetaIrV1 15/15, generator/IR sweep 46/46, compare.ts
    11/11, bun v1-gen 9/9, tsc clean. TIER — PROVEN: the legacy file is a
    deterministic, test-guaranteed projection of the frozen v1 envelope on .NET AND
    bun. NOT claimed: the Face-3 theorem itself (math team's).
- **MATH-TEAM HANDOFF STATUS (as of 2026-06-20):** row 4 N-way leg DONE (#8722);
  zeta-ir-v1 freeze DONE (#8725, Phase-A prereq for row 10 Face 3); gen-gen
  Phase B (value preservation) DONE (#8729); legacy IR single-sourced from the v1
  envelope DONE (#8733). Still genuinely open and assigned to the math team
  (Tariq/Kenji/Adaeze/Soraya), NOT me: rows 1-3 Lean/Z3 primary theorems (entropy
  floor, binding, anti-mirror DPI soundness); row 9 memetics + row 8
  uniqueness/objectivity (research-open); and row 10 Face-3 itself — the Lean
  gen(gen)=gen THEOREM, now UNBLOCKED on the IR side (frozen + provably
  behavior-preserving + single-sourced) but still the math team's to discharge.
  Next in-lane rung if continuing: extend the v1 substrate to a THIRD generator
  (proving the envelope generalises beyond the two seed primitives), since the IR
  substrate is now frozen, behavior-preserving, AND single-sourced — the seed-set
  generality is the remaining unexercised question on my side.
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
