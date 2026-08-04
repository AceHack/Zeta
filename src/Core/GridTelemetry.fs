namespace Zeta.Core

/// **GridTelemetry — the adapter from a grid control system's telemetry to the decorrelation instrument's
/// inputs.** This is the `[want]` the grid-trust explainer named
/// (`docs/explainers/decorrelation-meter-grid-trust-for-max.md` §4.3): the meter is correct *given* an
/// honest mapping from grid telemetry to its inputs, but it does not invent that mapping. This module is
/// that mapping — the minimal schema a grid must emit, and the pure adapter that turns it into the
/// `(causal DAG, per-action observables, action set)` triple `DecorrelationExcessFusion.fuse` consumes.
///
/// **The load-bearing requirement (why this was `[want]`, not free):** the instrument's whole guarantee
/// rests on knowing which actions were *causally concurrent* (spacelike) — genuinely-independent decisions
/// neither of which could have seen the other. Real grid telemetry does NOT ship an explicit causal order;
/// it ships events with **wall-clock timestamps**. And wall-clock **cannot** define the shared causal order
/// — different nodes see different receive-times, so a timestamp-derived order makes two honest nodes fold
/// different evidence and DIVERGE (`local-time-never-enters-the-shared-fold`; §13 noninterference). So the
/// schema requires each action to carry its **declared logical provenance** — the ids of the prior
/// actions/states it was *based on* (what it observed before acting), a sequence-of-events / causal
/// reference the EMS emits — **never** a timestamp. This is the real engineering ask: a grid must emit
/// causal provenance (many modern EMS/SCADA systems already do, via SOE recording + event causality). A
/// grid that emits only timestamps cannot be metered soundly; `causalCoverage` surfaces that honestly.
///
/// **Scope / honesty:** the adapter is `[proven]` (pure, total, tested; feeds the shipped instrument). The
/// remaining `[want]` is narrower and per-vendor: binding a *specific* EMS's wire format (DNP3 / IEC 61850
/// SOE / ICCP event logs) to this schema — a deserialization detail, not a soundness question. The
/// `Touched` observable is the excess-over-null instrument's input; a CHSH-probe (`AntiSybil.ChshRound`
/// per action) is the alternate consumer for the *active*-channel detector, out of scope here.
///
/// **Anchors:** Lamport 1978 (logical causality, the `Basis` order); the grid-trust explainer (the `[want]`
/// this closes); `DecorrelationExcessFusion` (the instrument this feeds).
[<RequireQualifiedAccess>]
module GridTelemetry =

    /// The **minimal schema** a grid control event must provide for the instrument to run soundly.
    type GridAction =
        { /// Unique id of this control action / decision (the node key — like a commit hash).
          ActionId: string
          /// The ids of the prior actions/states this action was causally **based on** — its declared
          /// causal past (what it observed before acting). **MUST be logical causal provenance the EMS
          /// emits, NEVER derived from wall-clock** (`local-time-never-enters-the-shared-fold`). An empty
          /// `Basis` marks a genesis/root action; a `Basis` id not present in the action set is treated as
          /// an out-of-window root (a real prior action outside the metered set).
          Basis: string list
          /// The grid components this action **touched** — read or affected (buses, lines, generators,
          /// breakers, load zones). This is the observable the instrument meters for excess coupling.
          Touched: Set<string> }

    /// The causal **DAG** (parents map) — each action → its declared `Basis`. Feeds
    /// `DecorrelationExcessFusion` `parents`. Last write wins on a duplicate `ActionId` (see `wellFormed`
    /// to reject duplicates first).
    let toDag (actions: GridAction list) : Map<string, string list> =
        actions |> List.map (fun a -> a.ActionId, a.Basis) |> Map.ofList

    /// The per-action **touch-set observables**. Feeds `DecorrelationExcessFusion` `observables`.
    let toObservables (actions: GridAction list) : Map<string, Set<string>> =
        actions |> List.map (fun a -> a.ActionId, a.Touched) |> Map.ofList

    /// The **action id set** to meter (input order; the instrument is order-independent).
    let actionIds (actions: GridAction list) : string list =
        actions |> List.map (fun a -> a.ActionId)

    /// **Causal coverage** — the fraction of actions that declare a non-empty `Basis`. This is the honesty
    /// gauge for the load-bearing requirement: if coverage is low, most actions look like roots, so the
    /// instrument treats nearly every pair as *concurrent* (spacelike) and **over-meters** — it would read
    /// legitimate sequential dependence as "concurrent coupling." A telemetry stream with only timestamps
    /// (no `Basis`) scores `0.0` and MUST NOT be metered as-is. `nan` for an empty action list.
    let causalCoverage (actions: GridAction list) : float =
        match actions with
        | [] -> nan
        | _ ->
            let withBasis = actions |> List.filter (fun a -> not (List.isEmpty a.Basis)) |> List.length
            float withBasis / float (List.length actions)

    /// **Well-formedness** check before metering: `ActionId`s are non-empty and distinct (a duplicate id
    /// would silently drop an action under `Map.ofList`). Dangling `Basis` refs are NOT an error — they are
    /// out-of-window roots. `Error` names the first violation; `Ok ()` otherwise.
    let wellFormed (actions: GridAction list) : Result<unit, string> =
        let ids = actions |> List.map (fun a -> a.ActionId)
        if ids |> List.exists System.String.IsNullOrWhiteSpace then
            Error "an action has an empty ActionId"
        elif List.length (List.distinct ids) <> List.length ids then
            Error "duplicate ActionId (would silently drop an action)"
        else
            Ok()
