namespace Zeta.Core

/// **`SoftEvolution` — watch the yin (soft value) evolve; assert it stays stable + coherent (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"we can watch the yin dynamic-value / soft-value evolve over time and make sure that evolution is
/// stable and coherent."* The hard `DynamicValue` trace is the *yang* (definite per-frame — `SoftSession.Tick`);
/// this watches the *yin* — the soft distribution's own evolution — as a first-class diagnostic. Per step:
///   - **support** (ensemble width) — should stay **bounded** (not exploding) → stability;
///   - **entropy** (nats) — should **settle** → stability;
///   - **residual** = `SoftEmu.softDistance(prev, cur)` — **decreasing → stable convergence**; flat → marginally
///     stable; increasing → diverging. The single best stability number;
///   - **norm** = `Σ weights` — the **coherence invariant** (always a valid normalized distribution, ≈1; never
///     fabricated certainty — the `SoftValue` never-falsely-certain discipline);
///   - **confidence** = max branch weight — the calibration signal (ties to `SoftActionController`).
///
/// Pure observability — it does **not** change the learning/evolution, only measures it. Deterministic (DST).
///
/// **Honest scope (peel):** `converged`/`stable` are *heuristics* over the residual trace, not proofs — a system
/// can be Lyapunov-stable yet never hit `tol`, or oscillate within a band (reported as not-converged, which is
/// honest). `coherent` checks the normalization invariant only; it does not verify the *semantics* of the
/// distribution. Cost = the caller's `step` × frames.
[<RequireQualifiedAccess>]
module SoftEvolution =

    /// One observed step of the soft value's evolution (the yin trace row).
    type Step =
        { Frame: int
          Support: int
          Entropy: float
          Residual: float
          Norm: float
          Confidence: float }

    let private EPS = 1e-9

    let private normOf (s: SoftEmu.Soft) = s |> List.sumBy snd
    let private confOf (s: SoftEmu.Soft) =
        match s with
        | [] -> 0.0
        | _ -> s |> List.map snd |> List.max

    /// **Trace the soft value's evolution** for `frames` steps under `step`, recording the yin metrics each step
    /// (residual is vs the previous state).
    let trace (step: SoftEmu.Soft -> SoftEmu.Soft) (frames: int) (s0: SoftEmu.Soft) : Step list =
        let mutable prev = s0
        [ for i in 1 .. max 0 frames do
              let cur = step prev
              let row =
                  { Frame = i
                    Support = SoftEmu.support cur
                    Entropy = SoftEmu.entropy cur
                    Residual = SoftEmu.softDistance prev cur
                    Norm = normOf cur
                    Confidence = confOf cur }
              prev <- cur
              yield row ]

    /// **Coherent** — every step is a valid normalized distribution (`norm ≈ 1`, or empty). The invariant that
    /// must hold *always* (a violation means a bug in the soft step, not mere instability).
    let coherent (t: Step list) : bool =
        t |> List.forall (fun s -> s.Support = 0 || abs (s.Norm - 1.0) < 1e-6)

    /// **Converged** — the final step's residual is below `tol` (the evolution settled to a fixed distribution).
    let converged (tol: float) (t: Step list) : bool =
        match List.tryLast t with
        | Some s -> s.Residual < tol
        | None -> false

    /// **Stable (non-diverging)** — the residual does not grow over the trace (last ≤ first within `EPS`): the
    /// belief isn't running away. Weaker than `converged` (a stable system may oscillate in a bounded band).
    let stable (t: Step list) : bool =
        match t with
        | [] | [ _ ] -> true
        | first :: _ -> (List.last t).Residual <= first.Residual + EPS

    /// The largest support reached (the width high-water mark — a blow-up guard).
    let peakSupport (t: Step list) : int =
        t |> List.fold (fun m s -> max m s.Support) 0

    /// A one-line digest of an evolution trace.
    let digest (t: Step list) : string =
        match List.tryLast t with
        | None -> "empty evolution"
        | Some s ->
            System.String.Format(
                System.Globalization.CultureInfo.InvariantCulture,
                "frames={0} peakSupport={1} finalEntropy={2:F3} finalResidual={3:F4} coherent={4} converged(1e-6)={5}",
                List.length t,
                peakSupport t,
                s.Entropy,
                s.Residual,
                (if coherent t then "true" else "false"),
                (if converged 1e-6 t then "true" else "false")
            )
