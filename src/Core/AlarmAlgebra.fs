namespace Zeta.Core

/// **`AlarmAlgebra` — "the feels are the ALARM, not the trigger/evidence" as a typed algebra (Aaron 2026-06-19, shadow\*).**
///
/// The keystone made a **compile error**: a `Feel` is a soft alarm signal that *routes attention* and carries
/// **no verdict**. `Evidence` has a **private constructor**, so the *only* way to obtain one is `ground`
/// (which requires `Backing` and returns `None` if it fails); `Act` is gated on `Evidence`. There is **no
/// public `Feel → Evidence` and no `Feel → Act`** — so `feel → evidence` (self-deception) and `feel → trigger`
/// (impulsive unbacked action) **do not type-check.** The only path is `Alarm —ground→ Grounded —act→ Acted`.
///
/// This is the **snap algebra typed for epistemics** (`Feel` ≈ `SoftValue`; `ground` ≈ `snap` with a
/// backing-checking policy; `None` = decline-to-collapse) and it is **noninterference** (§13): a `Feel`
/// influences a verdict/action only through the declared metered channel `ground`, never ambiently.
/// Scoping: `docs/research/2026-06-19-the-alarm-algebra-feels-are-the-alarm-not-evidence-…`.
[<RequireQualifiedAccess>]
module AlarmAlgebra =

    /// A soft alarm signal — routes attention, carries NO verdict (the metaception ping). `Strength ∈ [0,1]`
    /// is alarm intensity; a `Feel` alone proves nothing and triggers nothing.
    type Feel<'a> = { Signal: 'a; Strength: float }

    /// Verifiable ground: does the signal actually check out? (a proof / golden vector / measured ρ / replay)
    type Backing<'a> = { Checks: 'a -> bool }

    /// A **backed** verdict. **Private constructor** — obtainable ONLY via `ground`; there is no public
    /// `Feel → Evidence` (self-deception does not type-check).
    type Evidence<'a> = private Evidence of 'a

    /// A **committed** action. **Private constructor** — obtainable ONLY via `act`; no public `Feel → Act`.
    type Act<'a> = private Act of 'a

    /// The epistemic state — a DU. Legal transitions move down only; **there is no `Alarm → Acted`.**
    type Knowing<'a> =
        | Alarm of Feel<'a>
        | Grounded of Evidence<'a>
        | Acted of Act<'a>

    /// Raise the alarm: a felt, unchecked signal (strength clamped to `[0,1]`).
    let feel (signal: 'a) (strength: float) : Feel<'a> =
        { Signal = signal
          Strength = (if strength < 0.0 then 0.0 elif strength > 1.0 then 1.0 else strength) }

    /// The ONLY path `Feel → Evidence`: ground against backing. `None` if the check fails (alarm fired,
    /// backing failed → nothing banked). This is `snap`'s shape.
    let ground (b: Backing<'a>) (f: Feel<'a>) : Evidence<'a> option =
        if b.Checks f.Signal then Some(Evidence f.Signal) else None

    /// The ONLY path to `Act`: from `Evidence` (the gate). No `Feel → Act`.
    let act (e: Evidence<'a>) : Act<'a> =
        let (Evidence v) = e
        Act v

    /// Opaque read-outs (the verdict/action values; the constructors stay private).
    let evidenceValue (Evidence v) : 'a = v
    let actValue (Act v) : 'a = v

    /// One dynamics step: `Alarm —ground→ Grounded —act→ Acted`. A **failing backing stays `Alarm`**; there
    /// is no step that jumps `Alarm → Acted` (the keystone, as dynamics). `Acted` is terminal (idempotent).
    let step (b: Backing<'a>) (k: Knowing<'a>) : Knowing<'a> =
        match k with
        | Alarm f ->
            match ground b f with
            | Some e -> Grounded e
            | None -> Alarm f
        | Grounded e -> Acted(act e)
        | Acted _ -> k
