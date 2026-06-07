namespace Zeta.Core.FSharp.ObserveBridge

open Zeta.Core
open Zeta.Core.FSharp.Observe

/// **Bridge B — the observe controller loop, durable on the git DB.**
///
/// The reducer call (per the integration doc): the durable `World`-cell step **delegates to
/// `Observe.Algebra.simulate`** — the same byte-parity reducer observe.ts runs. So `World` is
/// the persisted `Remains`, each chosen `NextAction` is a delta-log event (`ObserveBridge`
/// encoding), and recovery folds the stream — `DurableSaga.ResumeAsync` rebuilds the exact
/// `World` from the git log alone. The agent's loop becomes read-folded-World → choose → commit
/// delta → repeat, with no raw git/gh (the commit is a delta-log append).
///
/// **Reversible by design:** the step is just a function. Today it delegates to
/// `Algebra.simulate`; once `BonsaiSoft` can express the full reducer, the cell's `Acts` can
/// supply the step instead — without changing any caller (Bridge B, the "delegate now, grow
/// Bonsai later" call).
[<RequireQualifiedAccess>]
module DurableObserve =

    /// The empty initial world (background agent: no operator, no mode, empty backlog).
    let emptyWorld : World = { Backlog = []; Operator = None; Mode = None }

    /// `DurableSaga` step: decode the action event and apply the parity reducer. Forward-only
    /// fold (`weight` ignored — an observe action is a forward transition, not group-invertible).
    /// Compose with `DurableSaga.start log DurableObserve.step initialWorld` over a
    /// `GitDeltaLog<string>` to run the controller loop durably on git.
    let step : World -> string -> int64 -> World =
        fun world encoded _weight -> Algebra.simulate world (ObserveBridge.decodeAction encoded)

    /// The delta-log event for a chosen action (canonical-CBOR hex via `ObserveBridge`).
    let event (action: NextAction) : string = ObserveBridge.encodeAction action
