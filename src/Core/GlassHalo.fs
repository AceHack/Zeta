namespace Zeta.Core

/// **`GlassHalo` — visibility is open by default; privacy is the EARNED exception.**
///
/// The corrected visibility model (Aaron 2026-06-20; PR #8777 + the Genesis.tsx reconciliation #8784):
/// **walls are transparent by default (the glass halo / radical transparency)** — *sees everything by
/// default, opt out.* Privacy is **not** a default you assert; it is a **currency you earn and spend**:
/// to **frost** a surface (make it opaque) you pay `privacy budget`. This is the opposite of the
/// opaque-by-default / earned-*access* model (which would be the Vault-Tec move — hidden by default).
///
/// It composes with the constitution: consent-first (#6) is honoured as the *act of spending budget to
/// close*, not as withholding by default; noninterference (#13) meters the crossing; and default
/// transparency IS the everyone-is-IT symmetric-observation principle (everyone can see ↔ everyone is
/// observed). Pure + deterministic ⇒ DST-replayable.
[<RequireQualifiedAccess>]
module GlassHalo =

    /// A surface's visibility. **Clear is the default.** Frosted is the earned, budget-funded exception
    /// (`SpentBudget` records what was paid to close it — the metered price of opacity).
    type Visibility =
        | Clear
        | Frosted of SpentBudget: int

    /// The default for every new surface: transparent. (Glass halo — you start visible.)
    let initial : Visibility = Clear

    /// Is the surface currently see-through? Clear ⇒ yes; Frosted ⇒ no.
    let isVisible (v: Visibility) : bool =
        match v with
        | Clear -> true
        | Frosted _ -> false

    /// **Frost (opt out of visibility): the earned action.** Costs `cost` privacy budget; succeeds only
    /// if `available >= cost > 0`. Returns the new `Visibility` and the **remaining** budget. Spending
    /// zero (or more than you have) is refused — privacy is *earned*, never free or asserted.
    /// Re-frosting an already-frosted surface is idempotent on visibility (still opaque) but is treated
    /// as a no-op that neither double-charges nor refunds (you already paid to be private).
    let frost (cost: int) (available: int) (v: Visibility) : Result<Visibility * int, string> =
        match v with
        | Frosted _ -> Ok(v, available) // already private; no double-charge, no refund
        | Clear ->
            if cost <= 0 then Error "privacy must be earned: frosting costs a positive privacy budget"
            elif available < cost then Error "insufficient privacy budget to frost this surface"
            else Ok(Frosted cost, available - cost)

    /// **Clear (return to transparency): free.** Transparency is the default state, so going back to it
    /// costs nothing (the paid budget is not refunded — it bought the privacy you had). Idempotent.
    let clear (v: Visibility) : Visibility = Clear

    /// What an observer may see of a surface, honouring the glass-halo default.
    /// `content` is shown when Clear; when Frosted, only the `placeholder` (e.g. "🔒 private") is shown.
    let observe (placeholder: 'a) (content: 'a) (v: Visibility) : 'a =
        if isVisible v then content else placeholder
