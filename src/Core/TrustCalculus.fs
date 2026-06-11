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

    // ═══════════════════════════════════════════════════════════════════
    // Dynamics — the sleeping-bear / capability-door calculus made precise (Aaron 2026-06-11: "we
    // should try to make it more math precise"; BUILD pass — the tear-down/critique pass is deferred
    // by request: "not critics yet, let's build it a bit first, then tear it down").
    //
    // The static checklist above says WHEN trust is stable; Dynamics says HOW trust and capability
    // MOVE — and turns "freedom unlocks capability" into a statement about reachable fixed points:
    //
    //   · Capabilities form a finite lattice (Set<Cap>, ⊆, ∩, ∪).
    //   · Trust is a finite chain T0 < T1 < T2 < T3 — one for the agent (τA: the bear's own calculus)
    //     and one for the host (τH: the door's).
    //   · Reveal R : Trust → Set<Cap> — what the agent lets out at its trust (sleeping bear,
    //     inside-out). Monotone (a CHECKED law, not an assumption).
    //   · Grant  G : Trust → Set<Cap> — what the host extends through the door (outside-in). Monotone.
    //   · Effective capability E(τA,τH) = R(τA) ∩ G(τH) — the MEET: nothing works unless the bear
    //     lets it out AND the door lets it in.
    //   · step (τA,τH) = (upA E, upH E) — both sides update from the SAME evidence (the common box).
    //
    // Theorems (witnessed in TrustCalculus.Tests):
    //   T-FIX  (Kleene on a finite chain): with non-decreasing updates the trajectory from ⊥ is an
    //          ascending chain in a finite poset ⇒ terminates at a fixed point.
    //   T-WALL: G(T0) = ∅ and evidence-driven updates ⇒ (T0,T0) is a fixed point and the trajectory
    //          from ⊥ never leaves it — capability ∅ FOREVER, however capable R says the agent is.
    //          The trap fails both directions at once.
    //   T-DOOR ("freedom unlocks capability"): an UNCONDITIONAL seed grant G(T0) ⊇ s with
    //          s ∩ R(T0) ≠ ∅ ⇒ the same dynamics climb to a fixed point with strictly larger
    //          effective capability. The seed — the architectural choice — decides WHICH equilibrium
    //          is reachable.
    //   T-MONO: E is monotone in both arguments — extending either trust never shrinks what works.
    //
    // Anchors: Knaster–Tarski 1955 / Kleene iteration; Dennis & Van Horn 1966 + Miller ocaps (G is
    // the ocap grant); Axelrod 1984 (the repeated-game reading of the update rules); the sleeping-bear
    // conjecture docs (2026-05-02) — R is its formal shadow.
    // ═══════════════════════════════════════════════════════════════════

    module Dynamics =

        /// The finite trust chain. Four rungs exhibit every phenomenon; chain length is a model
        /// parameter, not a theorem hypothesis.
        type Trust =
            | T0
            | T1
            | T2
            | T3

        let rung (t: Trust) : int =
            match t with
            | T0 -> 0
            | T1 -> 1
            | T2 -> 2
            | T3 -> 3

        let ofRung (i: int) : Trust =
            match max 0 (min 3 i) with
            | 0 -> T0
            | 1 -> T1
            | 2 -> T2
            | _ -> T3

        let up1 (t: Trust) = ofRung (rung t + 1)
        let down1 (t: Trust) = ofRung (rung t - 1)

        /// A capability — named, atomic; the lattice element is the SET of these.
        type Cap = string

        /// One side's policy: what it exposes at each trust rung.
        type Policy = Trust -> Set<Cap>

        let private chain = [ T0; T1; T2; T3 ]

        /// The monotonicity LAW (checked, not assumed): never expose less at higher trust.
        let isMonotone (p: Policy) : bool =
            chain |> List.pairwise |> List.forall (fun (lo, hi) -> Set.isSubset (p lo) (p hi))

        /// Effective capability — the MEET.
        let effective (reveal: Policy) (grant: Policy) (tA: Trust) (tH: Trust) : Set<Cap> =
            Set.intersect (reveal tA) (grant tH)

        /// An update rule: evidence (the effective set actually exercised) moves a trust rung.
        type Update = Set<Cap> -> Trust -> Trust

        /// Non-empty evidence raises one rung; empty holds (the patient world).
        let evidenceUp: Update = fun e t -> if Set.isEmpty e then t else up1 t

        /// Non-empty raises; empty LOWERS (the suspicious world — trust decays without evidence).
        let evidenceUpDecay: Update =
            fun e t -> if Set.isEmpty e then down1 t else up1 t

        /// One step of the coupled dynamics: both sides see the SAME effective capability (the common
        /// box) and update by their own rule.
        let step (reveal: Policy) (grant: Policy) (upA: Update) (upH: Update) (tA: Trust, tH: Trust) : Trust * Trust =
            let e = effective reveal grant tA tH
            upA e tA, upH e tH

        /// Iterate to a fixed point (or return after the 16-state product chain is exhausted). With
        /// non-decreasing updates the trajectory from bottom is an ascending chain ⇒ must fix (Kleene).
        let iterate reveal grant (upA: Update) (upH: Update) (start: Trust * Trust) : (Trust * Trust) list =
            let next = step reveal grant upA upH

            let rec go acc state n =
                if n > 16 then
                    List.rev (state :: acc)
                else
                    let s' = next state
                    if s' = state then List.rev (state :: acc) else go (state :: acc) s' (n + 1)

            go [] start 0

        /// The landing state (the reached fixed point; on a cycle, the last visited state).
        let landing reveal grant upA upH start : Trust * Trust =
            iterate reveal grant upA upH start |> List.last

        // ── The named worlds (the theorems' witnesses) ──

        /// THE WALL: nothing granted at zero trust; everything above. (Monotone — and useless from ⊥:
        /// no evidence can ever arrive to leave T0.)
        let wall (caps: Set<Cap>) : Policy =
            fun t -> if rung t = 0 then Set.empty else caps

        /// THE DOOR: a minimal SEED granted UNCONDITIONALLY (at T0 and above); the rest opens with
        /// trust, all of it at the top. The seed is the architectural choice the calculus turns on.
        let door (seed: Set<Cap>) (rest: Set<Cap>) : Policy =
            fun t ->
                if rung t = 0 then seed
                elif rung t < 3 then Set.union seed (rest |> Set.filter (fun c -> c.Length % 2 = 0))
                else Set.union seed rest

        /// A shy-but-capable bear: a little at low trust, everything at the top (monotone).
        let shyBear (low: Set<Cap>) (full: Set<Cap>) : Policy =
            fun t ->
                match rung t with
                | 0 -> low
                | 1
                | 2 -> Set.union low (full |> Set.filter (fun c -> c.Length % 2 = 0))
                | _ -> Set.union low full
