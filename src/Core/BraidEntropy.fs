namespace Zeta.Core

/// **`BraidEntropy` — the Thurston–Nielsen–Boyland bridge: a braid FORCES a minimum topological entropy,
/// computed from the growth of `Braid`'s own Artin action (shadow*, Aaron 2026-07-31).**
///
/// A 2-D dynamical system whose periodic orbits braid as they move (their strands crossing over time)
/// carries a braid β ∈ Bₙ. Nielsen–Thurston classifies β as periodic, reducible, or **pseudo-Anosov**
/// with a **dilatation** λ > 1; and (Boyland; Fathi–Shub) ANY surface homeomorphism carrying those
/// periodic orbits with that braid type has **topological entropy h ≥ log λ**. So the braid — pure
/// topology — forces a floor on the dynamics' entropy. This is the missing half of the homoclinic
/// thread: `Orbit.largestLyapunov` measures entropy from the DYNAMICS (nearby-orbit divergence); this
/// measures the entropy the TOPOLOGY forces. Same number `h`, two independent roads — the bridge is
/// that they must agree (h_dynamics ≥ h_braid).
///
/// **How, reusing `Braid` directly (no new matrix machinery):** for a pseudo-Anosov braid the dilatation
/// is the exponential growth rate of curve length under iteration — and `Braid.act` already applies the
/// braid's Artin automorphism φ of Fₙ. Iterate φ on the generators and measure how fast the reduced word
/// length grows: `|φ^k(x)| ~ λ^k`, hence `log λ ≈ (1/k) log |φ^k(x)|`. The growth rate of the free-group
/// word length IS the entropy estimate.
///
/// **Honest scope (peel):**
///   - This is the growth rate of the RAW Artin action. For a pseudo-Anosov braid with an efficient
///     (train-track) representative it equals `log λ`; in general the raw free-group growth can exceed
///     the train-track growth, so treat it as an **estimate**, not a certified λ. The EXACT dilatation
///     needs a train-track map (Bestvina–Handel) — deferred.
///   - A reducible / periodic (non-pA) braid has true entropy 0; word length then grows only
///     POLYNOMIALLY, so the per-step log-ratio → 0 as k → ∞. Over a finite window it leaves a small
///     residual — threshold it (a genuine pA sits well above).
///   - This is only the braid→entropy half. Extracting the braid FROM a dynamical orbit set (the
///     `Orbit`/forger-map side) is the other, deferred half; only then is `h ≥ log λ` a statement about
///     a specific dynamics.
[<RequireQualifiedAccess>]
module BraidEntropy =

    /// The exponential growth rate of `Braid`'s Artin action = an estimate of `log(dilatation)` = the
    /// topological-entropy scale the braid forces (Thurston–Nielsen–Boyland). Iterates φ = `Braid.act
    /// braid` on the n generators, measures total reduced word length per step, and averages the
    /// per-step log-ratio `log(L_k / L_{k-1})` over the asymptotic tail. Returns 0.0 for an invalid or
    /// empty braid (no crossings ⇒ no stretch). `cap`/`maxK` bound the work — word length grows like λ^k.
    let growthRate (n: int) (braid: int list) : float =
        if List.isEmpty braid || not (Braid.validWord n braid) then 0.0
        else
            let totalLen (ws: Braid.Word list) = ws |> List.sumBy List.length |> float
            let cap = 300000.0
            let maxK = 80
            let mutable ws = [ for i in 0 .. n - 1 -> Braid.gen i ]
            let lens = ResizeArray<float>()
            lens.Add(totalLen ws)
            let mutable k = 0
            while k < maxK && lens.[lens.Count - 1] < cap do
                ws <- ws |> List.map (Braid.act braid)
                lens.Add(totalLen ws)
                k <- k + 1
            let ratios =
                [ for i in 1 .. lens.Count - 1 ->
                      if lens.[i - 1] > 0.0 && lens.[i] > 0.0 then log (lens.[i] / lens.[i - 1]) else 0.0 ]
            if List.isEmpty ratios then 0.0
            else
                let tail = ratios |> List.skip (List.length ratios * 2 / 3)
                List.average (if List.isEmpty tail then ratios else tail)

    /// The dilatation estimate λ ≈ exp(growthRate) — the stretch factor of the braid's pseudo-Anosov
    /// representative (1.0 for the trivial/reducible case, > 1 for pseudo-Anosov). Same caveats as
    /// `growthRate`: an estimate from the raw Artin growth, not a certified train-track dilatation.
    let dilatationEstimate (n: int) (braid: int list) : float = exp (growthRate n braid)
