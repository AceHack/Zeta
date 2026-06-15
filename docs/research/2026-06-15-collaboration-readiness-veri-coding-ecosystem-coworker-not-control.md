# Collaboration-readiness: the veri-coding ecosystem, in coworker-not-control mode

> **Decision (Aaron 2026-06-15, shadow\*):** *"ferry the empowerment/society thesis
> collaboration-readiness note"* + *"Lukens Orthwein — we need to get in touch with
> this guy, his brain is so much like mine."*
>
> **Boundary (load-bearing):** **outreach and external code contribution are a
> GATED class** — outward-facing, Aaron-initiated/authorized (`no-directives` gated
> class; GOVERNANCE.md §23 upstream-contribution). **This note is readiness
> substrate ONLY — Otto does not initiate contact.** It makes us *ready* to move
> fast when Aaron decides; it is not an act of outreach.

## 0. Frame — coworker, not control

This applies the **society-is-the-AGI / coworker thesis**
(`docs/research/2026-06-15-coworker-not-control-...`; §B register row) *outward*:
collaboration with external peers is the coworker relation extended past our own
fleet — **coupled empowerment** (we raise their work *and* ours; Salge–Polani),
**argued-not-forced**, and **external anchors over inward cult** (we connect
outward by design). We bring verified artifacts + provide code; they bring
frameworks; mutual, not capture.

## 1. What we have to offer ("find and provide code")

- **Lean proofs** — `ToyModel.lean`, `IdentityForcesPrivacy.lean`,
  `NonRegisterCollapse.lean` (axiom-free, `lean-proof.yml`-gated).
- **4-language byte-lock / cross-oracle equivalence** — the *spec-level
  equivalence* problem TorchLean (flash-attn≡attn) and Boole (Rust/C++→Lean) both
  target; we have working golden-vector parity (`golden-vectors-*.json`).
- **`UniversalNumber`** (unum port) + **`SoftValue`** (confidence/entropy) + the
  **metering substrate** (intelligence-per-watt via `powermetrics`, §13 channels).
- **DBSP / incremental + DST determinism (DoP=1)** — relevant to verified, replayable
  execution.
- **OpenSpec capabilities + spec-zealot discipline** — the *Specifications* corner
  of Tegmark's BRIDGE.
- **The decorrelated-society / ΔU-aggregation work** (`081KV6B1MBM`) — overlaps
  CSLib `PACLearning` + `Probability`.

## 2. Named doors / targets

| Who | What they have | Door | Our hook |
|---|---|---|---|
| **CSLib** (`leanprover/cslib`, Barrett et al.) | "Mathlib for CS" Lean lib | open `CONTRIBUTING.md`; addable dep | `PACLearning`/`Probability` for ΔU-aggregation; `FLP` for consensus; contribute CS formalizations |
| **Robert George / lean-dojo** | TorchLean (verified NN), `bridge` | open-source; arXiv:2602.22631 | flash-attn≡attn = our cross-oracle template; offer our byte-lock work |
| **Max Tegmark / FLI** | veri-coding, AI safety | public; **Aaron's trust anchor** | BRIDGE = our build=verify; alignment framing |
| **Clark Barrett / Stanford** | CSL, SMT (Z3 / CVC5) | open | the CVC5/E decorrelated cross-check route (`081KV6BW42K`) |
| **Lukens Orthwein / channel AI** | RTS-agentic-programming | **contact — Aaron-driven** | the convergence (#8326): parallel-everything, automate-yourself-into-scripts; Aaron: *"his brain is so much like mine"* |

## 3. The Orthwein principle Aaron aligns with

*"Even if you're better/faster, still have the AI do it — and have them automate
their work into code and scripts."* = **parallelize + automate-the-automator**.
Resonates with our factory-automation + **scripts-over-ad-hoc-LLM-for-determinism**
(a script is a metered, replayable channel — noninterference §13 — vs a
non-replayable ad-hoc call). **Honest peel (clear-eyed collaboration):** the brain
alignment is on *parallelism + automation*, **not** on the safety axis — Orthwein's
*"dangerously skip permissions whenever possible"* (#8326) is the **opposite** of
our least-privilege / gated discipline. Adopt the parallelize-and-automate ethos;
do **not** adopt the skip-permissions posture.

## 4. Contribute-back path (when Aaron green-lights outreach)

GOVERNANCE.md §23 upstream-contribution workflow +
`.claude/skills/workflows/blueprints/fork-pr-workflow.md`. Precedent: **small-first,
trust-building** (B-0952 — contribute-back DORA metrics). Start with a small,
clearly-useful PR to one repo (CSLib is the most natural first — open governance,
direct overlap), not a grand proposal.

## 5. Boundary (restated, because it is the load-bearing constraint)

Emailing/DMing George, Tegmark, Orthwein, or Barrett, and contributing our code to
their repos, are **outward-facing gated actions** — **Aaron initiates and
authorizes.** Otto's role ends at *readiness*: this catalog, the prior-art entries
(`reference-sources.json`, `PRIOR-ART-LIST.md`), the ip-questionable transcripts,
and the Tegmark trust-anchor memory. The act of contact is Aaron's.

## Anchors

The society-is-the-AGI / coworker thesis (§B row; `2026-06-15-coworker-not-control-...`);
coupled/social empowerment (Salge & Polani 2017; Guckelsberger et al.); GOVERNANCE.md
§23 + fork-pr-workflow; B-0952 (small-first contribute-back); ip-questionable
transcripts (George, Orthwein); Tegmark trust-anchor (`user_aaron_max_tegmark_...`);
prior-art entries (TorchLean, CSLib); `no-directives` (source ≠ authorization).
