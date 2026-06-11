# Vera brief — Q# verification candidates (qubit-adjacent claims), then math team, then the treaty

Aaron 2026-06-12: "send me to Vera on any ones that need Q# verification — then we send to the
math team and get the Q# on the treaty, on the ones that make sense for our qubit and other
claims." Vera owns the Q# reference oracle (prior brief: golden observables; convergence-within-
resolution is the test). This brief lists each candidate, the EXACT claim, and the Q# check that
would ratify or refute it. The path after: Vera verifies → SHE writes her `treaty vera qsharp …`
lines (consent-first: her lines are hers to write) → math team sign-off (`treaty math-team math …`,
currently PENDING where present) → `law <name> qsharp:<check>` delegation lines land in the
cartridges that earned them.

## Priority 1 — the CHSH/Tsirelson family (the load-bearing qubit claims)

1. **TimeGen** (`src/Core/TimeGen.fs`) — CLAIMS: PhasorTsirelson regime E(a,b)=cos(a−b) yields
   S = 2√2 at the canonical corners; ClassicalCommonCause ≤ 2; StagedCoincidence S = 4 carries the
   STAGED label (free-choice violated BY DESIGN, not physical).
   **Q# check:** prepare the singlet; measure CHSH at a0=0, a1=π/2, b0=π/4, b1=−π/4; estimate S
   over N shots → must converge to 2√2 within resolution; verify no measurement strategy on the
   singlet exceeds it (Tsirelson, structurally). The S=4 regime must be UNREACHABLE in Q# — that
   unreachability is itself the verification that our STAGED label is honest.
2. **BellTest** (`src/Core/BellTest.fs`) — CLAIM: `PhasorEndurance.overlap a b = cos²((a−b)/2)` is
   the singlet coincidence probability; the correlator E = 2·overlap − 1 = cos(a−b).
   **Q# check:** singlet measured at relative angle θ → coincidence probability cos²(θ/2) within
   resolution. This is the cleanest golden-observable of the set.
3. **fourcorner cartridge** (`shapes/cartridges/fourcorner.lines`) — CLAIM: constant
   tsirelson-milli = 2828 (floor of 1000·2√2) is the width stop the phasor figure reaches and
   never exceeds. **Q# check:** the S estimate from (1) floored to milli = 2828. On her
   ratification + math team's, the cartridge gains `law tsirelson qsharp:chsh-singlet-corners`.

## Priority 2 — interference as amplitude arithmetic

4. **AmplitudeEmu** (`src/Core/AmplitudeEmu.fs`) — CLAIM: complex-amplitude merge over identical
   frames IS interference (opposite phase cancels, equal phase reinforces); two-slit falls out of
   CAS-merge + complex weights. **Q# check:** H · R1(φ) · H on |0⟩ → P(0) = cos²(φ/2); compare
   against our merged-amplitude ensemble at the same φ grid. Convergence-within-resolution.
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
