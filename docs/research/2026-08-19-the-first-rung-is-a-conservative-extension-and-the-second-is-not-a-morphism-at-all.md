# The first rung is a conservative extension, and the second is not a morphism at all

**Date:** 2026-08-19
**Work-item:** `081M0DXG800087G0R0028KCZP1`
**Register:** the transfer _measurement_ is `metered` (it has a control family that breaks it);
the _ladder claim_ it was built to test stays `toy`.
**Code:** `src/Core.TypeScript/bridge-transfer/`

---

## 0. The one-paragraph version

The ladder `CHIP-8 → CHIP-9 → Atari (ALE) → ARC-AGI-3 → decorrelated human measurement` was to be
tested at its cheapest link first. That was the right call, and the link was testable: CHIP-9
already exists as a real, executing, four-oracle-locked target. The bridge was built, named,
given a calibrated control family, pre-registered, and run. **Every lesson transferred, and each
control broke exactly the lesson that named it** — a clean diagonal, so the instrument is neither
blind nor blunt. But the headline finding is not the matrix. It is this:

> **Rung 1 is a conservative extension. Rung 2 is not a morphism of any kind.** The word
> "morphism" is doing different work at the two links, so a positive result at link one carries
> **no** information about link two. The chain's risk is not merely non-sequential — the links are
> not the same kind of object.

That makes the measured positive a genuine result about CHIP-9 and a **non-result** about the
ladder. The recommendation is not "proceed to Atari"; it is "the ladder needs a bridge kind that
survives past rung 1, and it does not have one yet."

---

## 1. Inventory — what already existed

Nothing here was started from scratch, and the inventory changed the deliverable. The brief
allowed for "CHIP-9 may only be a plan"; it is not.

**CHIP-8 (F# only — there is no C#/TS CHIP-8 emulator):**

| Path                                | Lines  | What                                                                   |
| ----------------------------------- | ------ | ---------------------------------------------------------------------- |
| `src/Core/Chip8.fs`                 | 242    | mutable deterministic core; `CXNN` from a seeded SplitMix64 (DST)      |
| `src/Core/Chip8Cow.fs`              | 286    | **the oracle** — immutable `Frame`, persistent-map memory, pure `step` |
| `src/Core/SoftEmu.fs`               | 284    | the emulator as one soft value (weighted ensemble of frames)           |
| `src/Core/Chip8CrossRunStore.fs`    | 770    | orbit memoization as text; Brent (μ,λ) detector                        |
| `src/Core/Chip8ConsultCensus.fs`    | 259    | post-selection detector on the store's read path                       |
| `roms/chip8/`                       | 5 ROMs | committed fixtures, SHA-256-locked by `MANIFEST.md`                    |
| `db/emus/chip8/orbits/*.orbit.json` | 5      | measured (μ,λ) per ROM, hex-in-JSON                                    |

**CHIP-9 — implemented, narrow, and locked in four languages:** `Chip8Cow.fs` carries it in F#;
`src/Core.CSharp/Chip9Machine.cs`, `src/Core.TypeScript/chip9/chip9.ts` and
`src/Core.Rust.Chip9/src/lib.rs` are treaty conformers over a 7-opcode subset;
`src/Core.TypeScript/chip9/golden-vectors.lines` is the lock. One real cartridge exists
(`roms-safe/zeta-breathe.ch9.lines`).

**The ISA delta is exactly one opcode.** `Fn01` (plane select), plus per-plane `DXYN` and
selective `00E0`. Same 4KB memory, same 64×32 display, same `0x200` entry, same 16-frame stack.
The larger CHIP-9 vision in the 2026-06-11 design doc (XMS door, console-capability lattice,
physics-to-sprites) is unbuilt; `Chip9Phys.fs` exists but nothing wires it to the VM.

**Two corrections to the framing worth recording.** First, the gate-synthesis column
(`Isa.fs` / `Netlist.fs` / `Cpu.fs` / `CpuSynth.fs` / `Residual.fs`, and the "THE LAW"
cross-checks) targets `Isa` — a CHIP-8-_shaped_ 7-opcode toy with no memory, display, timers,
stack or `I` register. It shares **zero code** with the emulator column. Second,
`Orbit.largestLyapunov` has never been run over a CHIP-8 state space; the CHIP-8 dynamics work is
exact and combinatorial (Brent, Artin–Mazur ζ), not exponent-estimating. Neither is available as
evidence for a transfer claim.

---

## 2. The morphism, stated precisely enough to be wrong

A bridge nobody can state precisely is a hope. Here is the statement.

Let `S₈` be the CHIP-8 state space and `S₉` the CHIP-9 state space — identical except for two
added components, `plane : byte` and `extra : Map<int, byte>`. Define the inclusion

```
ι : S₈ → S₉        ι(s) = s with plane := 1, extra := ∅
```

**Claim (the morphism law).** For every program containing no `Fn01` opcode,

```
step₉ ∘ ι  =  ι ∘ step₈
```

That is: ι is a **functional bisimulation**, equivalently a machine homomorphism, and CHIP-9 is a
**conservative extension** of CHIP-8 — the new operator changes nothing about the semantics of the
old signature.

This is not asserted. `transfer.test.ts` checks it step-by-step over every lesson ROM, comparing
`pc`, all 16 registers, `I`, and all 2048 pixels at every step, and additionally asserting that
the extension's own state stays at its zero value (`plane = 1`, `extra` empty) — which _is_ the
conservativity, made observable.

**Anchors, checked rather than cited:**

- **Joseph Weisbecker**, CHIP-8 on the COSMAC VIP (1977) — the machine, and the source of the edge
  semantics two of the lessons encode.
- **John Earnest**, XO-CHIP / Octo — `FN01` plane select is his; CHIP-9 widens it from 2 planes to 3. This is the actual human anchor for the delta under test.
- **Hartmanis & Stearns**, _Algebraic Structure Theory of Sequential Machines_ (1966) — machine
  homomorphism. Entails the claim.
- **Park (1981); Milner (1980, 1989)** — (bi)simulation. Entails the claim.
- **Groote & Vaandrager (1992); Verhoef (1994)** — conservative-extension theorems for structural
  operational semantics: adding operators with source-dependent rules leaves the original
  signature's semantics untouched. This is the precise general form of what was measured.

---

## 3. What "a lesson" is, operationally

The transfer claim is untestable until a lesson is a thing you can pick up and carry. The
definition used:

> A **lesson** is a text artifact holding (a) seeded memory, (b) a ROM, and (c) assertions over the
> trace in a machine-neutral predicate vocabulary — **plus the name of the structural axis whose
> destruction should falsify it.**

Two consequences, both load-bearing. It is **carriable**: the artifact is a file, so "transferring
a lesson" is an operation (open it, run it on the other machine, evaluate the predicates) rather
than a metaphor. It is **falsifiable**: a lesson no control can break is refused as a lesson,
because it would be measuring "the machine runs".

The predicates are deliberately plane-agnostic — `lit x y` means _the selected plane mask is fully
set here_, never _plane 0 is set here_. That is the whole trick behind the lift.

Four lessons, all drawn from properties the repo already depends on rather than invented for the
experiment:

| id  | lesson                                         | why it is real                                                    | falsifier        |
| --- | ---------------------------------------------- | ----------------------------------------------------------------- | ---------------- |
| L1  | XOR-draw is an involution                      | `zeta-breathe.ch9.lines` animates by drawing a delta sprite twice | `or-draw`        |
| L2  | VF witnesses _this_ draw only                  | what makes VF a per-frame collision signal                        | `vf-sticky`      |
| L3  | VIP edge: the overhang is dropped, not wrapped | established by `081KTZ4EF0008QG0R002WVTMMJ`                       | `no-clip`        |
| L4  | the sprite _origin_ wraps                      | the permissive half of the same VIP treaty                        | `no-origin-wrap` |

L3 and L4 are kept separate deliberately: the VIP treaty is strict about the overhang and
permissive about the origin, so a machine can preserve one and destroy the other — and one of the
controls does exactly that.

**The lift.** `lift(L, m)` prepends `Fm01` to the ROM and re-bases every step count by one. The
assertions are carried **verbatim**; because they read the _selected_ mask, the identical predicate
text now speaks about planes {G,B} instead of {mono}. The lift touches no claim, relaxes no
predicate, and special-cases no lesson. This is the morphism's action on artifacts, and it is the
only column that can carry a non-vacuous positive — see §5.

---

## 4. The control, and why the obvious control is wrong

Without a control, a positive measures _"learning happened"_, not _"learning transferred"_. The
brief proposed the natural one: a scrambled target of matched complexity. **That control, built
the obvious way, is invalid, and the experiment demonstrates it rather than asserting it.**

> **Permuting the opcode table cannot destroy structure. A permutation of labels is an
> automorphism.**

`RELABEL` applies a 3-cycle on the opcode high nibbles (6→A→D→6) at decode time. Run the lesson
artifacts on it untranslated and **all four fail** — it looks like a perfect control. Translate the
same artifacts through the same permutation and **all four pass**. The relabelled machine is the
same machine wearing different labels; what the "control" measured was whether anyone remembered to
translate. Both halves are asserted in the test suite so the point cannot quietly rot.

The valid controls destroy **named structure**, one axis each, and — critically — they are the
_same parameterised interpreter_ as CHIP-8/CHIP-9 with one setting changed. Complexity matching is
therefore by construction (shared opcode alphabet, memory model, display, decode path, per-
instruction work), not by claim.

| control          | destroys                     | why no structure-preserving map can exist                                                                                                                                                                                                                                        |
| ---------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `or-draw`        | the display update **group** | XOR generates (ℤ/2)ⁿ — every draw is its own inverse. OR generates the join-semilattice 2ⁿ — idempotent, no inverses. An injective `h` with `step_or ∘ h = h ∘ step₈` would send an involutive generator to a non-involutive one while preserving composition. No map does that. |
| `no-clip`        | VIP edge geometry            | the overhang wraps onto the lit left edge                                                                                                                                                                                                                                        |
| `no-origin-wrap` | origin wrapping              | an off-screen origin suppresses the draw                                                                                                                                                                                                                                         |
| `vf-sticky`      | VF as a per-draw witness     | VF latches once set                                                                                                                                                                                                                                                              |

`or-draw` is the one worth dwelling on: it is not "scrambled until it looks different". It is
**provably** not a conservative extension, and the proof is one sentence.

---

## 5. Pre-registration

Written before the first run, and preserved in the first commit of the branch:

- **POSITIVE** — the lifted battery passes on CHIP-9 while each control breaks exactly the lesson
  that names it. Reading: the inclusion preserves these four structures _and_ the instrument can
  tell preservation from its absence.
- **NEGATIVE** — some lesson fails on the lifted CHIP-9 column. Reading: link one is already
  broken; do not build the expensive rungs. A genuine finding, not a failed experiment.
- **DEGENERATE** — everything passes everywhere, controls included. Reading: the instrument is
  void and must be redesigned, **not** reported as a positive.

Plus two guards fixed in advance:

- **The vacuity guard.** `chip9 @plane0` passing is a _tautology_ — CHIP-9's default plane is 1, so
  a CHIP-8 ROM takes the identical code path. It is reported precisely so the tautology stays
  visible, and it is labelled as measuring nothing.
- **The reachability guard.** The lifted artifacts are also run on **CHIP-8**, which has no `Fn01`
  and cannot reach plane 6. They must all fail. Without this, "it transferred to the planes" could
  just mean the predicates were satisfiable on plane 0 all along and the lift was cosmetic.

---

## 6. The result

`bun src/Core.TypeScript/bridge-transfer/run-transfer.ts` — 11 tests, 78,149 assertions, green.

| lesson            | chip8 | chip9 @plane0    | **chip9 @plane6** | chip8 @plane6 | or-draw  | no-clip  | no-orig-wrap | vf-sticky | relabel (raw) | relabel (xlated) |
| ----------------- | ----- | ---------------- | ----------------- | ------------- | -------- | -------- | ------------ | --------- | ------------- | ---------------- |
| L1 xor-involution | PASS  | _(vacuous)_ PASS | **PASS**          | FAIL          | **FAIL** | PASS     | PASS         | PASS      | FAIL          | PASS             |
| L2 vf-per-draw    | PASS  | _(vacuous)_ PASS | **PASS**          | FAIL          | PASS     | PASS     | PASS         | **FAIL**  | FAIL          | PASS             |
| L3 vip-edge-clip  | PASS  | _(vacuous)_ PASS | **PASS**          | FAIL          | PASS     | **FAIL** | PASS         | PASS      | FAIL          | PASS             |
| L4 origin-wraps   | PASS  | _(vacuous)_ PASS | **PASS**          | FAIL          | PASS     | PASS     | **FAIL**     | PASS      | FAIL          | PASS             |

Control discrimination: **4/16 control cells failed — a clean diagonal.** One falsifier per
lesson, no collateral. The instrument is neither blind (something fails) nor blunt (not everything
fails), and the diagonal is the calibration evidence.

**Positive, as pre-registered.** The bridge holds: all four lessons survive the lift into the
region CHIP-9 adds, and that region is confirmed unreachable from CHIP-8.

---

## 7. What this does not license

Four bounds, in increasing order of severity.

**(a) The plane-0 column is vacuous by construction** and is reported only to keep that visible.

**(b) The plane-6 column is weakened by co-derivation.** CHIP-9's plane path was written by
generalising CHIP-8's mono path _inside the same function_. The lessons transfer partly because
the code is shared. That is co-derivation, not independent confirmation — the same defect as
agreement between correlated implementations, which
`.claude/rules/numerology-vs-number-theory.md` already names: N correlated observations are not N
observations.

**(c) Generalization difficulty ≈ 0.** In Chollet's vocabulary (_On the Measure of Intelligence_,
2019), transfer across a conservative extension requires no new skill acquisition, because the
target's behaviour on the source's signature is _identical by theorem_. So even a perfect score
here is near-zero evidence about skill-acquisition efficiency. Chollet is used for the measuring
vocabulary, which he does supply; he is **not** used as support for the transfer claim, which he
does not make.

**(d) The decisive one — rung 2 is not the same kind of object.** ι exists because CHIP-9 was
_constructed_ as CHIP-8 plus one opcode. There is no inclusion CHIP-9 → Atari 2600: different CPU
(6507), different memory model, different display, no shared instruction set. Whatever "bridge"
means at rung 2, it is **not** a conservative extension, not a machine homomorphism, and not
checkable the way §2 is checkable. The ladder equivocates on "morphism", and once it does, link-one
success transfers no information to link two.

Aaron's own sharpening applies to the ladder as a whole, not only to Futamura: a compositional
claim holds only when the composing structure is **complete over the domain being composed**. It is
not, here — the composition breaks at the first link where the bridge changes kind.

---

## 8. Anchor check — two citations do not survive

Per `.claude/rules/anchor-to-human-prior-art.md`, an anchor must be _checked to entail the claim_,
not merely cited.

**Futamura — cited, does not entail, removed.** Futamura's projections (1971), with Ershov and
Jones, concern specialising an interpreter to a program to obtain a compiler. This experiment has
no specialiser and produces no residual program; `Residual.fs` is where that machinery actually
lives in this repo, over `Isa`, not over CHIP-8. Aaron's sharpening — that the
incremental-build ↔ partial-evaluation identity holds only when the generator is complete over the
domain being closed over, and by measurement it is not (36% of build-graph targets carry no CI
leg) — is a precondition that this experiment does not even reach, because there is no generator
in it. **Futamura is not evidence for anything here.**

> Where that 36% comes from, since the figure travels without a pointer: the build graph carries
> 106 targets (`src/Core.TypeScript/ace/build-graph.ts`, whose `legs: []` encoding states a
> coverage gap rather than implying coverage); PR-10379's review records that 35 of 36 `Core.Rust.*`
> crates have no CI leg at all, and Alloy and Agda add two more. 38/106 = 35.8%. Upstream it is
> recorded as **counts**, never as a percentage — the percentage exists only in this thread, so
> quote the counts when it matters.

**Bellemare et al. 2013 — the wrong citation for the claim it was given.** The brief states ALE has
"a documented weak-generalisation result (Bellemare et al. 2013: agents transfer poorly even
between similar games)". Checked: _The Arcade Learning Environment: An Evaluation Platform for
General Agents_ (JAIR 47, 2013) is a **platform and methodology** paper. It benchmarks
domain-independent agents across ~50 titles and uses a train/test split over _games_ to avoid
overfitting agent design — a methodological guard, not a measured inter-game transfer result. The
observation that ALE's games are too distinct to support transfer research comes from the later
literature, not from the 2013 paper.

The claim itself is true and well-supported — by different papers:

- **Parisotto, Ba & Salakhutdinov (2016), _Actor-Mimic_** — multi-task pretraining across Atari
  games followed by fine-tuning; **negative transfer observed in many experiments**. This is the
  documented result.
- **Rusu et al. (2016), _Progressive Neural Networks_** — proposed specifically to address that
  negative transfer, via lateral connections instead of fine-tuning.
- **Machado et al. (2018), _Revisiting the ALE_** — the revisit that treats generalization as an
  open problem.

This correction strengthens rather than weakens the brief's reasoning: negative transfer between
_Atari games_ — which share a console, a CPU and an I/O model, and are far closer to one another
than CHIP-9 is to Atari — is a sharper warning about rung 2 than a platform paper would have been.

**Anchors that survive** are those in §2 (Weisbecker, Earnest, Hartmanis–Stearns, Park/Milner,
Groote–Vaandrager/Verhoef) plus Chollet in the restricted role of §7(c).

---

## 8b. "Lesson" already meant two other things in this repo — and neither is this one

The operational definition in §3 was written to be carriable and falsifiable. It is also, it turns
out, the **narrowest** of three meanings the repo already holds, and the gap matters more than the
overlap:

| where                                                                                         | a "lesson" is                                                                                                           | carriable today?          | falsifiable today? |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------ |
| `memory/feedback_lesson_permanence_is_how_we_beat_arc3_and_dora_2026_04_23.md`                | a recorded **failure-mode signature**, consulted before future decisions, persisted across sessions                     | as prose                  | no                 |
| `docs/research/2026-05-07-arc-agi-3-chip8-atari-dbsp-replay-algebra-curriculum-correction.md` | a **learned fingerprint of game mechanics** that compounds across levels ("the recognizer learns what carried forward") | no — no recognizer exists | no                 |
| §3 here                                                                                       | a ROM + trace assertions + a named falsifier                                                                            | **yes**                   | **yes**            |

Two things follow.

**The ladder equivocates on "lesson" exactly as it equivocates on "morphism"** (§7d). "Lessons
compose along morphisms" contains two ambiguous terms, and disambiguating either one dissolves the
claim into a different, narrower, checkable question — which is what this experiment answered.

**And the narrow definition is the one least like what ARC tests.** ARC-AGI-3 is about compounding
_discovered mechanics_ across levels — meaning #2, the recognizer sense. This experiment measured
meaning #3, which is closer to a conformance vector than to a skill. So the positive result should
not be read as progress on the ARC end of the ladder at all. The 2026-05-07 packet had the
ordering right when it called CHIP-8 "the smaller pre-Atari first rung … so the DBSP state/change
representation can be **proven** before moving up" — proving a representation is a different
activity from transferring a skill, and this work is the former.

Related in-repo, both still open: `docs/research/2026-08-10-lensography-over-small-games-as-an-arc-agi-3-approach-hypothesis.md`
(registered HYPOTHESIS, untested) and `docs/backlog/P2/081KSKBP80008QG0R003NM9XEC-*`.

---

## 9. Register

- `src/Core.TypeScript/bridge-transfer/dialects.ts` — **`unmetered`**. A research instrument;
  nothing depends on it. Its _faithfulness_ is metered: at identity parameters it must reproduce
  `chip9/golden-vectors.lines`, the same treaty the F#/C#/Rust oracles are locked to, or the suite
  goes red.
- `lessons.ts` + `lessons/*.lesson.lines` + the matrix — **`metered`**. The falsifier is the
  control family, and the expected pass/fail diagonal is asserted, so a battery that degenerated
  into tautology would fail rather than silently pass.
- **"Lessons compose along morphisms"** — **`toy`**, unchanged by this work. One
  conservative-extension datapoint with co-derived implementations is the weakest possible evidence
  for a compositional claim, and §7(d) is a positive reason to expect it to fail at rung 2.

No binaries entered the proof lineage: every artifact here is `.lines` text or hex-in-JSON, per
`.claude/rules/no-binary-in-proof-lineage.md`.

---

## 10. What would make rung 2 testable

Not a recommendation to build it — a statement of what the honest precondition is.

1. **Name the rung-2 bridge, or drop the word "morphism."** If there is no structure-preserving map
   CHIP-9 → Atari (there is not), then what is claimed to transfer is a _method_, not a lesson, and
   the experiment to run is different: hold the method fixed and measure acquisition cost on the new
   target. That is Chollet's frame, and it needs no morphism at all.
2. **Get an independent implementation before trusting a positive.** §7(b) is fixable: have the
   lifted battery evaluated by the C#, Rust and F# oracles, which are separately written. The
   capability ledger `db/emus/chip8/capabilities.lines` is already the right shape for recording
   what transfers to which target — it is the repo's existing, and currently only, machine-readable
   transfer table.
3. **A cheaper intermediate rung already exists in the repo, unexplored.** `IsaSpec.fs` treats an
   ISA as _data_ and already carries a 6502-shaped second witness. A CHIP-8 → 6502 bridge would be
   a genuine non-inclusion between real ISAs, at a fraction of ALE's cost, and it is the first point
   on the ladder where "morphism" would have to mean something new. **If the ladder is to be tested
   further, this is the next rung — not Atari.**
4. **Pick which "lesson" is being claimed, first.** Per §8b there are three in the repo, and the
   ARC end of the ladder needs the recognizer sense (#2), which has no implementation. Running the
   morphism experiment again one rung up would answer a question ARC does not ask.

---

## Pointers

- `src/Core.TypeScript/bridge-transfer/` — dialects, lessons, runner, pre-registered test
- `src/Core.TypeScript/chip9/golden-vectors.lines` — the treaty this instrument is locked to
- `tests/Tests.FSharp/Netlist.Tests.fs:56` — `BRIDGE TO THE ISA`, the repo's only other artifact
  explicitly named a bridge between targets
- `src/Core/Residual.fs` — `Target = Code | Circuit`, the repo's existing "same program, two
  targets" invariance law
- `db/emus/chip8/capabilities.lines` — the capability-by-language ledger
- `.claude/rules/toy-is-free-metered-must-be-earned.md` · `.claude/rules/numerology-vs-number-theory.md`
  · `.claude/rules/anchor-to-human-prior-art.md`
