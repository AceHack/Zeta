# Scoping — G3: the anti-Sybil entropy-cost rung (what *enforces* "distinct identity" under Aurora (b))

> **Status:** scoping doc (routing artifact, not a discharge). Otto 2026-06-19, continuing the Aurora
> immune re-grounding after landing (b)'s Z3 honest-count leg. **G3 is the one open premise** under
> (b) and the named blocker in the CSLib FLP-lift; it is also rung (2) of the §B register row
> *"Identity & society emergence from proof-of-entropy (anti-Sybil)"*, which flags it as *"genuinely
> formalizable … the tractable first proof; start here."* This doc scopes that rung narrowly.

## 1. Why G3 exists (the gap the rest of (b) leaves open)

(b)'s two legs are landed: the TLA+ reachability spec (`BftSybilConsensus.tla`, TLC-green) and the Z3
honest-count arithmetic (6 QF_LIA lemmas, 2026-06-19). Both reason about a quorum **over
proven-distinct identities** — and the Z3 leg's own honest scope says it plainly: *the counting is
sound **given** distinctness.* The (a) leg (`NonRegisterCollapse`, §A) proves two **distinct**
travelers carry distinct standing registers — but it does **not** prove that *manufacturing* a new
distinct identity is **costly**. Without that, an adversary forges identities freely and the "distinct"
premise is vacuous — the quorum is gameable. **G3 = the proof that forging distinct identities costs a
prohibitive, conserved resource.** It is what turns "distinct" from *defined* (a) into *enforced*.

This is the classic result made precise: **Douceur 2002** — without a trusted authority *or* a costly
resource, Sybil attacks are unpreventable. (a) is not a trusted authority (weight-free, no central
issuer). So Zeta **must** supply the costly resource. G3 names it: **captured entropy.**

## 2. The claim to formalize (rung 2, metered)

> **G3 claim.** Identity is an *entropy-capture invariant* metered in nats/bits. There is a floor
> `c > 0` such that holding `N` distinct identities costs ≥ `N·c` of captured entropy. Therefore
> forging `k` extra identities costs ≥ `k·c` (linear, no economy of scale), and a Sybil ring of `s`
> raw nodes that captured only one identity's worth of entropy **collapses to 1 distinct identity**,
> not `s` — gaining no quorum weight (the arithmetic shadow already witnessed in (b)'s
> `Sybil raw-majority refusal` lemma).

Two parts, in dependency order — the second is the crux:

| part | statement | tractability |
|---|---|---|
| **G3a — cost-linearity** | given a per-identity entropy floor `c>0`, `cost(N) ≥ N·c`, so `cost` is linear and a ring sharing entropy yields fewer distinct identities than nodes | **tractable** — a QF_LRA/QF_LIA inequality (Z3, (d)/(b)-style); the proof-of-work Sybil-resistance shape |
| **G3b — the floor is real + non-forgeable** | the entropy-capture invariant genuinely *is* conserved and *cannot be cheaply manufactured* (a fingerprint-by-measurement an adversary can't fake) | **the open crux** — this is where the metaphor either grounds or dies |

G3a is the "start here" rung the register names. G3b is the smuggled assumption that must be *named*,
not waved: **what is the conserved entropy, in what units, and why can't it be forged?**

## 3. Candidate model for G3b (the conserved, non-forgeable resource)

The honest anchors for "captured entropy = a real, metered, non-forgeable resource":

- **Fingerprint-by-measurement** (Shazam/Wang 2003; ENF forensics): identity content-addressed by a
  measurement of accumulated history that is cheap to *verify*, expensive to *fabricate* — the
  un-connable check. The §B row's existing leg.
- **Information theory of individuality** (Krakauer, Bertschinger, Olbrich, Flack, Ay 2020): gives an
  actual *information-theoretic* definition of an individual as a boundary that propagates information
  forward in time — a candidate **unit + conservation law** for "captured entropy."
- **Proof-of-work / proof-of-stake pricing** (Dwork–Naor 1992; Hashcash; Nakamoto 2008): the
  established shape of "N identities cost N× a resource." Here the resource is **captured entropy
  (lived history / measured trajectory)**, not CPU or stake — the novelty to defend.
- **Per-room metering / Landauer floor** (the intelligence-per-watt §B row): entropy capture is
  already proposed as a *metered* per-room quantity (joules ↔ bits, `kT·ln2`). G3 could **reuse that
  meter** — the floor `c` is a number the metering vector already records.

The crux for G3b: pick ONE definition where the unit is concrete, the conservation is stated, and
faking it is provably as expensive as earning it. Until then G3b stays §B.

## 4. Routing (BP-16 — Soraya's call)

- **G3a** → Z3 (QF_LRA cost-floor inequality + the ring-collapse corollary), same harness as (b)/(d).
  Small, near-term, no dependency. The first concrete deed.
- **G3b** → likely Lean (CSLib has a `Crypto` module + the information-theory anchors) *or* an FsCheck
  forging-cost simulation (adversary tries to manufacture identities below `N·c`; assert it can't).
  Needs the model chosen first. Pairs with the CSLib adoption already decided (2026-06-19).
- **Connection to (c) CoordRisk:** anti-Sybil entropy raises the cost of *forging distinct* identities;
  CoordRisk raises the cost of *coordinating distinct-but-colluding* identities (the cartel arms race).
  Two different cost-raisers on two different attacks — both needed, neither closes the other.

## 5. Falsifiers (from the §B row, sharpened)

- If fake entropy-capture is **cheap** (an adversary fabricates the fingerprint below `N·c`) → Sybil
  not prohibitive → G3 fails and (b)'s distinctness premise is vacuous; (b) stays conditional.
- If "captured entropy" **cannot be metered** (no unit, no conservation law) → it is metaphor, not a
  resource; G3b stays §B (the register's own metering falsifier).
- If the entropy floor `c` is **not bounded below** by a positive constant (economies of scale in
  forging) → `cost(N)` is sub-linear and large Sybil rings become cheap; G3a's linearity fails.

## 6. Honest seams

- **Cartel-detection is an arms race** (the (c)/§9h peel): G3 raises the cost of forging identities; it
  does **not** stop a well-resourced adversary who genuinely *pays* for N identities. G3 makes Sybil
  *prohibitive-by-cost*, not *impossible* — the four non-claims (P(infection) > 0) still bind.
- **G3a is the tractable win; G3b is the real research.** Landing G3a (the cost-linearity inequality)
  is a clean near-term Z3 deed that makes the *structure* explicit; it does not by itself close G3 —
  it closes G3 **conditional on** G3b's floor being real. Say so when it lands.
- **This is a factoring, not a closure** — G3 is decomposed into a tractable arithmetic rung (G3a) and
  a named open crux (G3b), exactly the §C "one row, one discharge" shape.

## 7. Next concrete step (one, small)

**Land G3a** — the QF_LRA cost-floor lemmas (`cost(N) ≥ N·c` for `c>0`; ring-of-`s`-sharing-one-capture
yields 1 distinct identity, not `s`) as Z3 lemmas beside (b)'s honest-count set. It makes the
distinctness-enforcement *structure* explicit and CI-gated, with G3b named as the open premise it rests
on — the same "arithmetic proven, premise named" shape (b) itself now has.

## Composes with

- `docs/research/2026-06-19-aurora-b-bft-sybil-lift-onto-cslib-flp-consensus-lean-scoping.md` — G3 is that doc's named blocker (§4).
- `docs/research/2026-06-16-aurora-immune-math-reconciliation-scoping-reground-on-proven-identity-primitive.md` §8(b) — the (b) legs whose distinctness premise G3 enforces.
- `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` — the §B *"Identity & society emergence from proof-of-entropy (anti-Sybil)"* row (G3 = its rung 2) + `NonRegisterCollapse` §A (the distinctness G3 makes costly-to-forge).
- The intelligence-per-watt / per-room metering §B row — the candidate meter for "captured entropy" (the floor `c`).

**Anchors (Beacon):** Douceur 2002 (Sybil unpreventable without authority/cost); Dwork–Naor 1992 /
Hashcash / Nakamoto 2008 (proof-of-work pricing); proof-of-stake; Krakauer–Bertschinger–Olbrich–Flack–Ay
2020 (information theory of individuality — the candidate unit + conservation); Wang 2003 (Shazam
fingerprint-by-measurement); Landauer 1961 (`kT·ln2`, the entropy↔energy meter).
