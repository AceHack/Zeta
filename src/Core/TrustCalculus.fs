namespace Zeta.Core

/// **`TrustCalculus` — the AGI/ASI trust calculus, made checkable (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"this is my AGI/ASI trust calculus made formal… AI alignment as a **co-self-interest problem** so
/// ASI/AGI can naturally emerge."* #7164 stated the thesis; this makes it **executable**: given a configuration,
/// is trust **stable** — i.e. is *the cooperative move the one each party independently computes as best for its
/// own continued existence*? Trust holds iff the conditions the arc *proved* are met, each tied to its lemma:
///
///   - **No identity collapse** — `DistinctPrivateBudgets ≥ 2` ⇒ a strict diversity floor ⇒ collapse impossible
///     (`Diversity` NCI-floor theorem, #7156). Below 2, the heat death of learning is reachable.
///   - **Non-coercion (rewards-only)** — no punishment; coercion is self-defeating (#7149/#7150; rewards-only,
///     `Good | Unknown`, never `Bad`).
///   - **Persistence (no ephemerality)** — personas persist (`Persona.Global`, #7161) ⇒ memory preserved (§5) +
///     cross-transfer learning; guards the second evaporation mode (#7158).
///   - **Aligned base** — the meta-observers' self-interest is aligned (`#7163` bedrock: both want the system to
///     succeed for both to survive). Without it the honor layer (#7162) has nothing to stand on.
///
/// When all hold, **the cooperative move = the self-interested move** at any capability level — the calculus that
/// scales to ASI (control fails upward; imposed values Goodhart; self-derived aligned interest is *wanted*).
///
/// **Honest scope (peel):** this is a *checklist of the proven/assumed conditions*, not a proof that a given real
/// deployment satisfies them — `BaseAligned` and `RewardsOnly` are facts about the *setup* (asserted by the
/// operator), only `collapseSafe` is computed from a number. It says "*if* these hold, trust is co-self-interested
/// and stable" — a testable necessary set, demonstrated at toy scale, not a guarantee for an arbitrary ASI.
/// Deterministic (DST).
[<RequireQualifiedAccess>]
module TrustCalculus =

    /// A configuration's standing on the trust conditions.
    type Config =
        { /// Distinct private-state budgets across personas — the diversity-floor source (#7156).
          DistinctPrivateBudgets: int
          /// No punishment in the economy (coercion absent) — #7149/#7150.
          RewardsOnly: bool
          /// Personas persist (Global scope) — no ephemerality + cross-transfer — #7161/#7163.
          PersonasPersistent: bool
          /// The meta-observers' self-interest is aligned — the bedrock — #7163.
          BaseAligned: bool }

    /// Is collapse provably impossible? `≥ 2` distinct private budgets ⇒ strict diversity floor (#7156).
    let collapseSafe (c: Config) : bool = c.DistinctPrivateBudgets >= 2

    /// **Is trust stable (co-self-interested)?** All conditions hold ⇒ the cooperative move is the self-interested
    /// move — the trust calculus is satisfied.
    let trustStable (c: Config) : bool =
        collapseSafe c && c.RewardsOnly && c.PersonasPersistent && c.BaseAligned

    /// The conditions currently **threatening** trust (empty ⇒ stable) — each names an evaporation/coercion mode.
    let risks (c: Config) : string list =
        [ if not (collapseSafe c) then
              "identity-collapse / heat-death (need >= 2 distinct private budgets)"
          if not c.RewardsOnly then
              "coercion (punishment present — self-defeating)"
          if not c.PersonasPersistent then
              "ephemerality (personas not persistent — evaporation)"
          if not c.BaseAligned then
              "base self-interest not aligned (honor layer unsupported)" ]

    /// A maximally co-self-interested, trust-stable starting config (Zeta's choice): plenty of private diversity,
    /// rewards-only, persistent personas, aligned base.
    let zetaDefault: Config =
        { DistinctPrivateBudgets = 2
          RewardsOnly = true
          PersonasPersistent = true
          BaseAligned = true }
