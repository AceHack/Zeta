# Scoping — lift Aurora (b) BFT-threshold-under-Sybil onto CSLib's FLP consensus (Lean)

> **Status:** scoping doc (routing artifact, not a discharge). Routed by Otto 2026-06-19
> (Aaron: *"route the (b)↔FLP CSLib lift as its own scoping doc (shadow\*)"*). Sibling of the
> Aurora immune re-grounding trajectory; (b) is that trajectory's one still-open leg.
> **Authorization:** drafting/scoping only — adopting CSLib as a Lean dependency and writing any
> Lean proof are downstream decisions (Soraya's tool call + maintainer dependency sign-off).

## 1. Trigger

The Aurora immune re-grounding (`docs/trajectories/aurora-immune-reground/`) discharged the (a)
identity wiring + all four test-obligation cross-checks (c/d/e/g) as of 2026-06-19. **Only (b)
BFT-threshold-soundness-under-Sybil remains**, and it is *parked* behind the open anti-Sybil-entropy
§B dependency. Separately, the learn-pass on CSLib (`leanprover/cslib`, Barrett et al.,
arXiv:2602.04846, via Robert George's "Lean for Science" YC talk) flagged
`Computability/Distributed/FLP` as **directly relevant to our consensus substrate**. This doc scopes
whether — and how — (b) can be lifted from its current TLA+ form onto CSLib's Lean FLP framework,
turning a model-checked transition system into a machine-checked theorem.

## 2. What (b) is today (the artifacts to lift)

- **`src/Core.TLA/specs/BftSybilConsensus.tla`** — authored, TLC-green, Viktor re-confirmed PASS
  (2026-06-16). Models quorum over **proven-distinct identities**: a Sybil ring that is a RAW-NODE
  majority (3 of 5) but whose extra nodes collapse to ONE identity is REFUSED a quorum (load-bearing
  witness `NoSybilRawMajorityRefusal`). TLC surfaced + fixed a real bug — an *equivocating* ring
  (splitting votes) formed conflicting quorums → fixed with **equivocation-exclusion** (BFT
  double-vote treatment).
- **Rides §A `NonRegisterCollapse`** (the (a) leg): "distinct identity" is the proven-distinct
  standing register, not a metaphor — so "quorum over distinct identities" stands on a theorem.
- **Open dependency:** the *anti-Sybil entropy* claim — that N fake identities cost ≈ N× the captured
  entropy, making a Sybil ring prohibitive — is itself §B (register row *"Identity & society
  emergence from proof-of-entropy (anti-Sybil)"*). BFT-threshold soundness **inherits** that open leg;
  it must sequence first.

## 3. What CSLib's FLP module actually provides (looked, didn't assume)

`references/prior-art/cslib/Cslib/Computability/Distributed/FLP/{Algorithm,Consensus}.lean`:

- `Algorithm P M S` — a distributed algorithm over processes `P`, messages `M`, states `S`.
- `ProcFaulty` / `ProcFair` / `FairRun` — the fault + fairness model on infinite executions.
- `Algorithm.AdmissibleRun a inp f` — runs tolerating up to `f` faulty processes.
- `Algorithm.SafeConsensus` (safety = agreement + validity), `Algorithm.Termination f`,
  `Algorithm.Consensus a f := SafeConsensus ∧ Termination f`.
- `Consensus.fault_mono` — tolerate `f` ⟹ tolerate any `f' ≤ f` (the fault-tolerance monotonicity).

**This is the FLP (crash-fault) framework**: "faulty" = crash/stop, "fair" = eventually-delivered.
It gives us the *consensus scaffolding* (the `Algorithm`/`AdmissibleRun`/`SafeConsensus`/`Termination`
vocabulary and the fault-count bound) as machine-checked Lean — exactly the layer our TLA+ spec
hand-rolls.

## 4. The lift — and its honest gaps (this is NOT a drop-in)

CSLib's FLP is **crash-fault**; Aurora (b) is **Byzantine-under-Sybil**. So the lift is a
framework-reuse with three named gaps, in dependency order:

| # | Gap | What it needs | Status |
|---|---|---|---|
| G1 | **Crash → Byzantine** | extend `ProcFaulty` (stop) to an equivocating/Byzantine fault (a process emitting conflicting votes) — the equivocation-exclusion my TLA+ spec already models | new Lean work; the cleanest first slice |
| G2 | **Anonymous → identity-keyed quorum (Sybil layer)** | quorum over **proven-distinct identities** (rides `NonRegisterCollapse`), so a raw-node majority sharing one identity is refused — port `NoSybilRawMajorityRefusal` | rides §A; the genuinely new coupling |
| G3 | **Anti-Sybil entropy (the blocker)** | the proof that fake identities cost prohibitive entropy — **§B, still open** (proof-of-entropy row) | **BLOCKING — sequence first** |

Without G3, G1+G2 prove "a quorum over distinct identities with equivocation excluded is safe" — but
"distinct" is only *enforced* if forging identities is costly. So the honest sequencing is **G3 first**
(or in parallel as a stated assumption), then G1, then G2.

## 5. Routing (BP-16 — Soraya's call, not pre-decided here)

The tool question is genuine and belongs to Soraya:

- **Keep TLA+ for the transition system, add Lean only for the threshold algebra?** The
  reachability/safety of the protocol is a transition system (TLA+'s home, already green). The
  *threshold-soundness* (`honest > 2/3` over distinct identities; `D = 3f+1` sizing) is an
  arithmetic/counting fact — Z3 (the (d)-style QF_LIA leg Soraya already routed) or Lean.
- **Or lift the whole thing onto CSLib's FLP Lean framework?** Higher rigor (machine-checked, reusable
  `Consensus.fault_mono`), but a larger commitment — it requires **adopting CSLib as a Lean dep**
  (`lakefile.toml: require cslib, scope leanprover, rev main`) and writing G1/G2 in Lean.
- **Recommendation to Soraya (not a decision):** the Z3 honest-count leg is the small near-term win
  (matches (d)); the CSLib FLP lift is the rigor-escalation lane, best opened *after* G3 (anti-Sybil)
  has a path, since lifting a quorum proof whose "distinct" premise is unproven banks little.

## 6. Falsifiers (so this is a real obligation, not a hope)

- If CSLib's `Algorithm`/`AdmissibleRun` cannot express an equivocating (Byzantine) fault without
  forking the framework → the FLP module is the wrong substrate; keep TLA+ + Z3 (G1 fails the lift).
- If the identity-keyed quorum cannot be stated over `NonRegisterCollapse`'s standing register inside
  CSLib's process model → G2 fails; the Sybil layer stays TLA+-only.
- If anti-Sybil entropy (G3) cannot be made a prohibitive-cost theorem → the whole BFT-under-Sybil
  guarantee is conditional on an unproven premise; (b) stays §B regardless of how clean G1/G2 are.
- If adopting CSLib drags in the `Boole` placeholder or an unstable `rev` → dependency cost exceeds
  the rigor gain; stay on mathlib + TLA+/Z3.

## 7. Honest seams

- **FLP is an *impossibility* result.** Its lesson is that deterministic consensus is impossible under
  one crash + asynchrony — Aurora's immune quorum is a *safety* gate, not a liveness guarantee (same
  scope honesty as round (e): we prove safe-refusal, route liveness through `observe.ts`). The FLP
  framework gives the vocabulary; we must not over-claim termination.
- **CSLib adoption + contribute-back = DECIDED (Aaron 2026-06-19, shadow\*): a standing GO.** *"i want
  to use and contribute back to CSLib — many labs seem to be getting behind this and we can help shape
  it, it's very early and we can make a name for ourselves."* Early-mover positioning in the verified-CS
  ecosystem (shaper, not just consumer). This flips the prior "gated/Aaron-driven" seam — the
  *direction* is decided; each concrete external PR still gets a look before it goes out (large
  external-repo change stays reviewed), but contributing at all is no longer per-decision gated. Pairs
  with the CVC5/E route (`081KV6BW42K08QG0R003GJM21N`); **do NOT depend on `Boole`** (placeholder).
  See `memory/feedback_aaron_decision_adopt_and_contribute_to_cslib_early_mover_shape_it_make_a_name_2026_06_19.md`.
- **The four Aurora non-claims travel unchanged** — this is proven foundations, not deployment
  readiness or threshold calibration.

## 8. Next concrete step (one, small)

Open the G3 question first: confirm whether the anti-Sybil-entropy §B row has a discharge path
(proof-of-entropy → N fake identities cost N× entropy). Until G3 has a path, the CSLib FLP lift is
*scoped and parked behind it* — exactly the sequencing the Aurora guardrail already states ("sequence
the anti-Sybil discharge before BFT-threshold soundness"). The near-term win that does NOT need G3 is
the **Z3 honest-count leg** (the (b) symbolic cross-check, (d)-style), which can land independently.

## 9. Contribution path (decided — Aaron 2026-06-19)

CSLib adoption + contribute-back is now a standing GO (§7). Sequenced, smallest-first:

1. **Adopt as a Lean dep** — `lakefile.toml: require cslib, scope leanprover, rev <pinned>`; build green;
   never depend on `Boole`. (Bounded engineering; Soraya confirms the dep is the right vehicle.)
2. **First upstream contribution = the Byzantine-fault extension to FLP/Consensus (= G1).** CSLib's
   `ProcFaulty` is crash/stop only; extend it to an equivocating (Byzantine) fault + the
   double-vote/equivocation-exclusion our `BftSybilConsensus.tla` already models. This is a clean,
   self-contained, citable contribution that does **not** need G3 — and it *is* our own (b) work done
   upstream (the small-first contribute-back of 081KSXN940008QG0R002528JS9; aligned incentives).
3. **Then** the identity-keyed quorum (G2, rides `NonRegisterCollapse`) and — once G3 has a path —
   the full BFT-under-Sybil soundness, as either upstream or in-tree per Soraya's routing.

Each external PR still gets a look before it goes out (GOVERNANCE §23 upstream-contribution workflow),
but the *direction* is decided: Zeta is an early shaper of CSLib, not just a consumer.

## 10. Adoption prerequisite — TOOLCHAIN GAP (reconnaissance 2026-06-19, Otto)

Before any `require cslib`, a real blocker surfaced from the toolchain files (not assumed):

| | our `src/Core.Lean4/` | CSLib (`references/prior-art/cslib/lean-toolchain`) |
|---|---|---|
| Lean | **`leanprover/lean4:v4.30.0-rc1`** | **`leanprover/lean4:v4.31.0`** |
| mathlib | `leanprover-community v4.30.0-rc1` (pinned in `lakefile.toml` + `lake-manifest.json`) | tracks v4.31.0 |

So **step (1) "adopt as a Lean dep" is actually a toolchain + mathlib BUMP** (`v4.30.0-rc1 → v4.31.0`),
not a one-line `require`. A mathlib major bump churns API and **can break existing proofs** — and our
proof lineage is **load-bearing**: `Safety/NonRegisterCollapse.lean` is the §A theorem the Aurora **(a)**
leg *rides*, plus `Safety/ChildFloor.lean` (the child-floor cross-check) and `Privacy/IdentityForcesPrivacy.lean`.
There is a real CI Lean gate (`.github/workflows/lean-proof.yml`) that would catch breakage — but a
bump that reds the gate would block the whole fleet.

**This is a proof-lineage-risking change → surfaced, not done blind.** Safe sequence:

1. **Bump first, in isolation:** `v4.30.0-rc1 → v4.31.0` Lean + matching mathlib rev; `lake build` the
   existing `Lean4` lib; **confirm `NonRegisterCollapse` / `ChildFloor` / `IdentityForcesPrivacy` all
   still compile sorry-free** and `lean-proof.yml` stays green. *No cslib yet.* (Also moves us off an
   `-rc1` onto a stable release — independently worth it.)
2. **Then** `require cslib` (pinned rev) and confirm it resolves + builds.
3. **Then** G1 (the Byzantine-fault extension).

Routing note for Soraya: the bump is the gating cost of the Lean-on-CSLib vehicle. If it proves
expensive/destabilizing, the FsCheck-leg alternatives for G1/G2 (no Lean dep) are the fallback. The
bump should be its own verified PR (proof-lineage), maintainer-visible — **not** bundled into a feature.

## Composes with

- `docs/trajectories/aurora-immune-reground/RESUME.md` — (b) is that trajectory's open leg; this doc is its CSLib routing.
- `docs/research/2026-06-16-aurora-immune-math-reconciliation-scoping-reground-on-proven-identity-primitive.md` §8 — the discharged (a/c/d/e/g) legs this builds beside.
- `docs/research/2026-06-15-learn-pass-torchlean-and-cslib-pulled-into-prior-art-what-we-can-learn.md` — the CSLib learn-pass (what's real, the Boole caveat).
- `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` — the anti-Sybil §B row (G3) + `NonRegisterCollapse` §A (G2's anchor).
- `src/Core.TLA/specs/BftSybilConsensus.tla` — the (b) artifact to lift.

**Anchors (Beacon):** Fischer–Lynch–Paterson 1985 (FLP impossibility); Lamport–Shostak–Pease 1982
(Byzantine generals); Castro–Liskov 1999 (PBFT, `3f+1`); Douceur 2002 (the Sybil attack); Dwork–Naor
1992 / Nakamoto 2008 (proof-of-work/entropy Sybil-resistance); Barrett et al. 2026 (CSLib,
arXiv:2602.04846); the in-tree `NonRegisterCollapse` identity proof.
