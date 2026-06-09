namespace Zeta.Core

/// **`PrivacyEconomy` — private-state budget as a self-regulating economy among personas (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"the ultimate goal is privacy is **self-regulating** among the personas, based on some measure of **good
/// use of private state that's revealable to others** and can **increase the private-state budget** — this is
/// **economics among the personas**."*
///
/// The private-state budget (`Persona.Private` — the overfitting lever / entropy / NCI encryption budget, #7148)
/// is an **economic resource**. A persona **earns more budget by demonstrating good use of it** — and crucially
/// the evidence of good use is **revealable** (voluntary disclosure, NCI-respecting §6): you reveal *that you used
/// privacy well* to earn more, without being forced to reveal the private state itself. The economy is
/// **self-regulating** — no central allocator: each persona's budget is a function of its **own revealed good use**
/// (scale-free §1, weight-free §3). The market finds each persona's right privacy/entropy level, like prices emerge.
///
/// **Privacy budget is HARD MONEY (Aaron 2026-06-08): you can NEVER lose it — ever.** No punishment, no decay, no
/// confiscation, no inflation-away: budget is **strictly monotonic non-decreasing**, earned only by reward. That
/// is exactly a **grow-only counter (G-Counter CRDT)** (`Crdt.fs`) — sound, mergeable, never-decreasing. And it is
/// **rewards-only** — there is *no* punish operation in this module (punishment would be coercive, violating NCI;
/// the economy is positive-sum).
///
/// **Each persona has its OWN private definition of good use** (Aaron): good-use is *subjective per persona*; what
/// is public is the **reveal**. And **the reveal is rewarded by a MIXTURE OF PERSONAS, not hats** (`rewardByMixture`)
/// — peer personas each score the reveal by *their own* private good-use definition, and the mixture (consensus)
/// sets the grant. ("Good use" candidate: value the private state produced without collapsing diversity or coercing
/// — e.g. solid-ground gain generalised across games.) `roi` = good-use per unit budget (the efficiency rewarded).
///
/// **Honest scope (peel):** sound only if the good-use measures are *revealable and hard to game* (a gameable
/// measure → reward-hacking, the failure the unsubjective method #7142 avoids; prefer objective categories like
/// solid-ground gain). Budgets are `int` (byte counts), G-Counter-shaped (never decrease). `cap` is an optional
/// ceiling on the *rate*-summed total, never a loss. Trade/transfer between personas is a later slice. Deterministic (DST).
[<RequireQualifiedAccess>]
module PrivacyEconomy =

    /// A revealed good-use claim: a persona discloses *that* it used its private budget well (a measure), without
    /// disclosing the private state itself.
    type GoodUse = { Persona: string; Revealed: float }

    /// Each persona's current private-state budget (bytes). The ledger.
    type Ledger = Map<string, int>

    /// Look up a persona's budget (0 if unknown).
    let budget (persona: string) (ledger: Ledger) : int =
        Map.tryFind persona ledger |> Option.defaultValue 0

    /// **Reward revealed good use:** grow the persona's budget by `gainOf revealed`, capped at `cap`. Self-
    /// regulating per persona (a function of *its own* revealed good use — no central authority).
    let reward (gainOf: float -> int) (cap: int) (u: GoodUse) (ledger: Ledger) : Ledger =
        let next = min cap (budget u.Persona ledger + max 0 (gainOf u.Revealed))
        Map.add u.Persona next ledger

    /// Settle a round of revealed good-use claims — each persona's budget updates independently (decentralized).
    let settle (gainOf: float -> int) (cap: int) (uses: GoodUse list) (ledger: Ledger) : Ledger =
        uses |> List.fold (fun l u -> reward gainOf cap u l) ledger

    /// **Reward by a MIXTURE OF PERSONAS, not hats (Aaron):** peer personas each score the reveal `u` by *their
    /// own* private good-use definition (`evaluators`); the **mixture** (mean consensus) sets the grant. Hard money
    /// (monotonic up, capped ceiling, never lost) and rewards-only. No peers ⇒ no reward (you need the mixture).
    let rewardByMixture (evaluators: (GoodUse -> float) list) (gainOf: float -> int) (cap: int) (u: GoodUse) (ledger: Ledger) : Ledger =
        match evaluators with
        | [] -> ledger
        | _ ->
            let consensus = (evaluators |> List.sumBy (fun ev -> ev u)) / float (List.length evaluators)
            reward gainOf cap { u with Revealed = consensus } ledger

    /// **ROI of privacy:** revealed good-use per unit budget — the efficiency the economy rewards. `infinity` if
    /// the persona holds no budget yet but produced good use (a strong signal to grant it some).
    let roi (u: GoodUse) (ledger: Ledger) : float =
        let b = budget u.Persona ledger
        if b = 0 then (if u.Revealed > 0.0 then infinity else 0.0) else u.Revealed / float b

    /// Personas ranked by current budget (the self-regulating outcome — who earned privacy).
    let ranking (ledger: Ledger) : (string * int) list =
        ledger |> Map.toList |> List.sortByDescending snd
