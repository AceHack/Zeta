namespace Zeta.Core

/// **`Chip8Observer` — first integration slice of the ray-trace observer (#7239, Aaron→Otto shadow*):
/// the `ReflectionEngine` observes the `SoftChip8` soft-interrupt fork and predicts the input branch.**
///
/// Aaron's wiring plan (2026-06-09): hook the observer into the soft interrupt handler — *"this is where it
/// reflects downward into the controller and emu and game."* This module is the smallest real hook on that
/// seam: it turns the soft fork's *branch structure* into a `ReflectionEngine.Observation` and runs one
/// observer `step`, so the observer predicts which input branch the emu takes from its prior belief.
///
/// **Honest scope (peel):** this is the `ReflectionEngine` ⊗ `SoftChip8` seam ONLY — the categorical `Arrow`
/// composition (`Tracing.Arrow`) and the full `IRayTraceable`/`RayTensor` ray are the next slices (#7239).
/// The fork observation is intentionally **uniform** (exact ℚ via `ProbabilitySemiring.rat`, no float in the
/// proof lineage — DST/byte-lock discipline): the emu fork is uninformative about *which* key — INPUT is the
/// genuine DST uncertainty (`SoftChip8` docstring) — so all predictive information lives in the observer's
/// prior `belief`. The fork contributes branch *structure*; the belief contributes the *prediction*.
[<RequireQualifiedAccess>]
module Chip8Observer =

    /// Exact-rational **uniform** likelihood over the soft fork's branches (length =
    /// `SoftChip8.branchFactor f`: `2` at an input branch, `1` deterministic). Uniform ⇒ the emu fork
    /// contributes branch structure, not key information; exact ℚ keeps it in the proof lineage (no float).
    let forkObservation (f: Chip8Cow.Frame) : ReflectionEngine.Observation =
        let n = SoftChip8.branchFactor f
        Array.create n (ProbabilitySemiring.rat 1L (int64 n))

    /// **The observer reflects over the soft fork** — one `ReflectionEngine.step`: observe the fork at `f`
    /// under prior `belief`, returning the posterior belief and the predicted branch index
    /// (`0` = key-down, `1` = key-up at an input branch; `0` when deterministic). `belief` length must equal
    /// `SoftChip8.branchFactor f`. This is "reflect downward into the soft interrupt handler" (#7239).
    let predict (belief: ReflectionEngine.Belief) (f: Chip8Cow.Frame) : ReflectionEngine.Belief * int =
        ReflectionEngine.step belief (forkObservation f)

    /// The concrete predicted successor frame: take the observer's predicted branch from
    /// `SoftChip8.forkOnInput`, connecting the observer's decision back to the emu timeline (clamped to the
    /// available branches). Closes the seam: observer belief → predicted input → committed emu frame.
    let predictedFrame (belief: ReflectionEngine.Belief) (f: Chip8Cow.Frame) : Chip8Cow.Frame =
        let _, idx = predict belief f
        let branches = SoftChip8.forkOnInput f
        let i = if List.isEmpty branches then 0 else min idx (List.length branches - 1)
        fst (List.item i branches)
