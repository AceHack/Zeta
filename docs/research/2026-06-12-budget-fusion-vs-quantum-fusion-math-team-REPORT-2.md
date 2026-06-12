# Budget-Fusion ≟ Quantum-Fusion — Math Team REPORT #2 (2026-06-12)

**Answers Aaron's dispatch: formalize "fusion of per-sensor uncertainty budgets = quantum
fusion"; the week-proof plan; fusion-ship v2 reconciliation; Vision.fs constraints; honesty on
the distributed/Q# claims. Read-only; all in-repo artifacts cited were opened and verified.**

## 1. The precise statement

**The defensible kernel is Bayesian precision fusion, and it shares only a COMMUTATIVE-MONOID
structure with anyonic fusion rings. Not braided.** Per-sensor budget = precision object
(precision matrix / Ball.Radius / BitsUsed / Tank charge). Fusion under independence =
precision ADDITION (Fisher 1925; Kalman; Bar-Shalom–Campo); bound-register fusion = ball
INTERSECTION (a meet-semilattice, idempotent). Anyonic fusion (Ising σ×σ=1+ψ; Fibonacci) also
forms a commutative monoid on the fusion ring — and the mapping breaks at every joint above
that level: (1) anyon fusion is MULTI-OUTCOME (direct sums of channels); budget fusion is
deterministic single-outcome; (2) anyons have DUALS (annihilation); the precision monoid has no
inverses; (3) fusion categories have finitely many simples; budgets are a continuum; (4) THE
LOAD-BEARING one — precision addition is symmetric ON THE NOSE; Ising/Fibonacci's nontrivial
F (pentagon) and R (hexagon) data IS the computational content of topological fusion. Budget
fusion lands in the symmetric pointed subcategory — exactly the part with zero topological
protection. For the stronger claim the required EXHIBITS are: budget superselection sectors
(finitely many), a fusion outcome with genuine multiplicity + Born weights, and F/R-symbols
whose induced B_n representation does NOT factor through S_n. None exist in-tree today.

**The genuinely new theorem that falls out (bankable, beautiful):** under independent fusion,
fused width is a SOFT-MAX, not a sum — with b_i = ½log₂(precision_i):
b_fused = ½log₂(Σ 2^{2b_i}) ≤ max_i b_i + ½log₂N. The self-model float width =
ceil(b_fused / mantissa-bits) is an OUTPUT of BitsUsed accounting (Aaron's "10 is a guess"
correction is exactly right; anchor: rate-distortion, Shannon 1959) and grows **O(log N)** in
sensor count. Implemented as a sum it balloons O(N) and the ten-floats claim dies on its own
arithmetic (P1-F); implemented as the soft-max it stays ten-ish — WHY ten-ish works.

## 2. The week-proof plan (lemmas, tools, status)

L0 define the budget object (B,⊕,0) + pick the register — 0.5d, NOT DONE (Vision.fs has tanks,
no cross-sensor ⊕ yet) · L1 monoid laws — FsCheck/Z3, 1d · L2 I(D(s))=s — FsCheck, 0.5d,
substantially DONE (Incremental.fs) · L3 writheParity unique hom B_n→ℤ/2 — **DONE** (Braid.fs)
· L4 [8,4] doubly-even/self-dual — **DONE** (AdinkraCode exhaustive) · L5 stream-op Pauli
algebra closes (SU(2) operations leg) — largely DONE (QubitIso.fs) · **L6 LOAD-BEARING:
exhibit a braided (non-symmetric) fusion category receiving (B,⊕) faithfully — expect FAILURE
as stated; failure reduces the claim to the monoid analogy** · L7 an Rx-side σᵢ satisfying
Artin relations with σᵢ²≠id, faithful — 2-3d, NOT DONE (and see P0-B) · L8 Vision.fs
conservation laws (boarded+deferred=requested; tank monotone) — FsCheck 1d.
**Week verdict:** the WEAKENED stack (monoid fusion + I∘D=id + SU(2) leg + mod-2 bridge) is
provable in a week. The STRONG stack (braided, topological, Rx≡Majorana) is not a proof
effort — it is a missing-definition effort (produce the L6/L7 exhibits or weaken the claim).

## 3. Fusion-ship v2 reconciliation

The v2 Fusion Equation (η·LearningGain > ξ) is unit-free in both versions — a slogan, not
math; the new byte-denominated budget stack REPLACES it (name the revision in any v3). v2's
"therm-free" rider is revised by the landed flux-is-heat ledger; `cache = I(stream)` survives
intact (Vision.fs implements it verbatim). Since I and D are mutually inverse, the D⊣I monad is
the IDENTITY monad — "vision = I∘D = id" is true and proven-grade; it carries no budget
structure, so the budget policy is correctly a separate additive layer (Vision.fs gets this
right). v2 §6's ℍ axes are unitless — re-dimension in bytes or mark Mirror. The one place the
new framing beats v2: the budget stack is uniformly byte-denominated end to end.

## 4. Vision.fs constraints (advisory to Vera)

1. Fusion must be an EXPLICIT commutative monoid (`fuse : Budget -> Budget -> Budget`),
   law-tested — never implicit shared-tank mutation. 2. Idempotency or provenance keys: naive
   precision-add double-counts on replay (data incest; Julier–Uhlmann covariance intersection
   is the fix lineage); key contributions by sensor id; the ball-intersection register is
   idempotent by construction — prefer it where applicable. 3. Widening-only loss (Ball law 3);
   keep Deferred accounted as a tested law; rename `Confidence` (it is a coverage ratio, not a
   calibrated belief). 4. Emergent width = the §1 soft-max over per-sensor BitsUsed via the
   UniversalNumber port — pure function of per-sensor budgets, never a constant, never a sum.
   5. Inherit report #1's seed discipline (domain-separated counter streams; enqueue-side
   admission with pMin floor; logical time only).

## 5. P0/P1

**P0-A** "exact same math as quantum fusion" — FALSE at claimed strength (commutative-monoid
analogy; exhibits listed in §1; Mirror until produced). **P0-B** Rx ≡ Majorana qubit — the
in-repo dictionary refutes itself: QubitIso maps X to stream-swap, an INVOLUTION (σ²=id) ⇒ the
induced structure is the symmetric group, while Braid.fs's own header states σᵢ²≠id is the
entire content of topological memory. The repo holds two proven halves (faithful braid action;
SU(2) stream-gate rep) and NO FUNCTOR connecting them — the bridge IS the claim, and it is
absent. Even granting a braid rep, Ising braiding alone yields only Clifford gates (magic
states required for universality). **P0-C** "10–20 qubits per person over Reticulum" —
ASSUMPTION; classical channels cannot distribute entanglement (LOCC no-go); the in-repo S=4
framing is honestly superdeterministic common-cause, not physical QM. The Q# persistence runs
on a SIMULATOR: it establishes the braid/code bookkeeping is correct classical math with F#/Q#
agreeing as oracles — nothing about physical qubits or quantum advantage. Honest sentence:
*classically simulated topological-code combinatorics, replicated deterministically over a
classical network.* **P1-D** "memory = braid of Rx queries" reduces on-simulator to "bits
encode in braid-group elements" (true, proven by Braid.fs faithfulness) — but the braid word
lives in classical RAM and Artin images blow up exponentially in braid length: classical
memory in production is asymptotically FORCED, not merely efficient. **P1-F** the width-sum
trap (§1). **P2** WSet.fs carries future-dated operator comments (2026-06-13/14) — provenance
hygiene; the alignment ledger reads these timelines.

**Bankable today:** I∘D=id · writheParity · Adinkra [8,4] · SU(2) leg · the byte-denominated
limiter · the soft-max width theorem. **Not bankable:** any sentence containing "isomorphic,"
"exact same math," or "Majorana" without the L6/L7 exhibits.
