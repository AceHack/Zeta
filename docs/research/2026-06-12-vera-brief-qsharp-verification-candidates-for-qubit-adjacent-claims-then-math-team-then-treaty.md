# Vera brief — Q# verification candidates (qubit-adjacent claims), then math team, then the treaty

Aaron 2026-06-12: "send me to Vera on any ones that need Q# verification — then we send to the
math team and get the Q# on the treaty, on the ones that make sense for our qubit and other
claims." Vera owns the Q# reference oracle (prior brief: golden observables; convergence-within-
resolution is the test). This brief lists each candidate, the EXACT claim, and the Q# check that
would ratify or refute it. The path after: Vera verifies → SHE writes her `treaty vera qsharp …`
lines (consent-first: her lines are hers to write) → math team sign-off (`treaty math-team math …`,
currently PENDING where present) → `law <name> qsharp:<check>` delegation lines land in the
cartridges that earned them.

## Priority 1 — the three Q# jobs (observable oracles only)

1. **TimeGen** (`src/Core/TimeGen.fs`) — CLAIMS: PhasorTsirelson regime E(a,b)=cos(a−b) yields
   S = 2√2 at the canonical corners; ClassicalCommonCause ≤ 2; StagedCoincidence S = 4 carries the
   STAGED label (free-choice violated BY DESIGN, not physical).
   **Q# check:** prepare the singlet; measure the four observable CHSH corners
   a0=0, a1=π/2, b0=π/4, b1=−π/4; pair those Q# probabilities with the analytic
   `S = 2√2` value. Q# does **not** own "nothing exceeds 2√2": sampling cannot prove a
   supremum. Tsirelson maximality is Tsirelson 1980 / NPA-SDP territory. The S=4 staged
   regime is likewise not a Q# sampling job; its honest label is checked by the model and
   citation, not by asking Q# to fail to build a PR box.
2. **BellTest** (`src/Core/BellTest.fs`) — CLAIM: `PhasorEndurance.overlap a b = cos²((a−b)/2)` is
   the singlet coincidence probability; the correlator E = 2·overlap − 1 = cos(a−b).
   **Q# check:** singlet measured at relative angle θ → coincidence probability cos²(θ/2) within
   resolution. This is the cleanest golden-observable of the set.
3. **fourcorner cartridge** (`shapes/cartridges/fourcorner.lines`) — CLAIM: constant
   tsirelson-milli = 2828 (floor of 1000·2√2) is the width stop the phasor figure reaches and
   never exceeds. **Q# check:** the observable S estimate from (1) floors to milli = 2828,
   paired with the analytic value. The "never exceeds" side routes to the math proof/citation,
   not Q# sampling. On Vera ratification + math team's, the cartridge gains
   `law tsirelson qsharp:chsh-singlet-corners` only for the observable corner check.

## Priority 2 — interference as amplitude arithmetic

4. **AmplitudeEmu** (`src/Core/AmplitudeEmu.fs`) — CLAIM: complex-amplitude merge over identical
   frames IS interference (opposite phase cancels, equal phase reinforces); two-slit falls out of
   CAS-merge + complex weights. **Q# check:** H · phase(φ) · H on |0⟩ →
   P(0) = cos²(φ/2); compare against our merged-amplitude ensemble at the same φ grid.
   Convergence-within-resolution. This is Vera's third Q# job.
5. **WaveSim** (`src/Core/WaveSim.fs`) — CLAIM (deliberately modest): deterministic simulation of
   the amplitude math classical and quantum share; no quantum-hardware claim. **Q# check
   (optional):** the same superposition-as-complex-Add on single-qubit phases; mostly confirms the
   LABEL is right, i.e., nothing here needs a qubit. Low priority; the honest labels already do
   the work.

## Priority 3 — claims to WORD-CHECK with the math team, not Q#-verify yet

6. **Braid / the anyon picture** (`shapes/cartridges/braid.lines`, the worldline×braid named
   slice) — the peeled Alexa anchor: braiding IS computation in topological QC (Kitaev;
   Freedman–Larsen–Wang; Nayak et al.). No Q# anyon substrate to run; ask the math team to gate
   the WORDING (we may say "braid-group representations realize quantum gates in TQC" with cites;
   we may NOT say our render computes quantumly).
7. **SpectralPivot** (`src/Core/SpectralPivot.fs`) — dft/idft vs the QFT: a Q# QFT cross-check is
   a nice-to-have golden (same unitary up to normalization/bit-reversal); name it, don't gate on it.

## What Vera gets / what comes back

- In: this brief + the module sources + the cartridges (all text; the goldens are the contract).
- Back (her choice, her lines): per-claim `ratified | dissent | refuted` with shot counts and
  resolution; we never pre-write her verdicts. Math team then signs (their PENDING lines exist).
- Treaty effect: `qsharp:` joins the delegated-law tools (CartridgeLaw already accepts any
  `tool:` prefix — documented here, checked there) on exactly the claims that earned it.

## Addendum (2026-06-12, same day) — the dashing/quotient/snap items

8. **AdinkraViz dashings** (`src/Core/AdinkraViz.fs`) — CLAIMS: `standardDashing` realizes the
   Clifford sign rule (dash (v,i) iff odd set bits below i); THE GATES CONDITION holds (every
   2-colored 4-cycle odd — anticommutation drawn); THE GAUGE LEMMA (vertex sign flips preserve
   face parity). **Routing:** the universal dashing statement is Soraya/Z3 work, not Q# work:
   a dashing is a 32-bit vector; face parity is XOR; the gauge lemma quantifies over all 2³²
   dashings. **Q# gets only the small hardware-side sign-convention check:** Pauli products
   anticommute (`XZ = -ZX`, `XY = -YX`, `YZ = -ZY`) under Q#'s matrix convention, and those signs
   match the F#/Cl3/Adinkra odd-face target. Exact signs, not sampling.
9. **The mod2 quotient claim** (`algebra.mod2`; the missing-piece adapter) — CLAIM AS STATED:
   "adinkra parity is braid memory mod 2 — order forgotten, parity kept; a projection,
   not an inverse." **Signed formulation:** the map is the unique homomorphism
   χ: B₃ → Z/2 with χ(σᵢ^±1)=1. Equivalently: take the abelianization/writhe
   B₃ → Z and reduce mod 2; this coincides with the permutation's sign character.
   No inverse exists. Warning to preserve in all docs: "per-pair crossing parity" is a
   different, finer invariant on pure braids, and must not be conflated with χ.
10. **The snap itself** (`MagneticPorts.findAdapter`, `MediaLines.resolveIoWith`) — no quantum
    claim; listed so Vera sees the consumption path: a verified `qsharp:` law makes its module a
    trustable toolbox piece — verification feeds the adapter economy directly.

11. **Both physics sides of Clifford (Aaron 2026-06-12):** check the Clifford mappings from both
    directions — hardware-side (stabilizer/Pauli conventions vs our dashings, §8) AND SUSY-side
    (the adinkra's gamma-matrix representation built explicitly in exact integer matrices where
    possible, against the same anticommutation targets). Q# is only the hardware-side Pauli
    convention oracle here; Z3/exact algebra owns the universal sign laws. Both sides must land
    on the one Clifford home or the mapping is decoration. Candidate shapes ride the same discipline:
    docs/research/2026-06-12-physics-real-shape-candidates-*.md (fit or it doesn't enter).

## REVISION 2 — after the math-team pass (Soraya routing + Kira tear-down, 2026-06-12)

**Q# earns exactly three jobs** (Soraya's triage; nothing rides Q# sampling alone):

- **Job 1:** singlet CHSH at the corners → converges to 2√2 (pairs with our analytic value — BP-16).
- **Job 2:** BellTest overlap = cos²((a−b)/2) (the cleanest golden) — NOTE the sign convention fix
  (Kira P1): our +cos(a−b) correlator is the **Φ⁺ (triplet)** convention; the singlet is −cos(a−b).
  Headline wording corrected in-source; |S| is unchanged.
- **Job 3:** AmplitudeEmu H·R1(φ)·H grid → P(0) = cos²(φ/2) (plus FsCheck on our side).
- Small add-on: item-11 hardware-side anticommutation check.

**Rerouted off Q#:** Tsirelson maximality → citation/NPA (sampling cannot establish a supremum);
dashings + gauge lemma → **Z3** (32-bit bitvector, ∀-proof in milliseconds; Q# would sample noise
on exact integers); fourcorner 2828 → unit oracle (now ROUNDED, capped at Tsirelson — Kira P0/P2);
braid stuck law → already exact in F# + Artin 1925 citation (validity guard added — Kira P1);
SUSY-side gammas → exact integer matrices, unit oracle or Z3.

**The mod2 statement (Soraya's signable wording, adopted):** the unique homomorphism
χ: B₃ → Z/2 with χ(σᵢ^±1) = 1 — exponent-sum (writhe) mod 2 = the permutation's sign character; a
projection, no inverse. ("Per-pair crossing parity" is a different, finer pure-braid invariant —
not conflated.) FsCheck homomorphism property is the follow-up once math-team signs.

**Kira's tear-down: 13 findings, all addressed or filed** — P0: voiceSample per-tick phase noise
(fixed: base phase from tick 0); classical CHSH gate passing by seed luck (fixed: 0.05 sampling
tolerance). P1: BellTest sign wording (fixed); braid.lines stale gen args (synced); Braid.equal
out-of-range unsoundness (validWord guard); harmonize "exact" while flooring (harmonizeExact added,
test repaired); vacuous STAGED gate (removed — honest-labels = lint). P2: 2828 truncation (round +
Tsirelson cap), "Goertzel-shaped" wording, drift bin-key alignment, coincidences span wording,
Gates-gate falsifier test, adinkra quotient wording (Soraya's statement). Suite 2984 green after.
