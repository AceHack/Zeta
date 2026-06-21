namespace Zeta.Core.FSharp.Observe

/// F# port of the observe/simulate/fold event algebra (081KSXN940008QG0R0033T2BQT) — oracle #2 of
/// four (TS/F#/C#/Rust) in the cross-language-parity = non-Byzantine-BFT consensus
/// (081KSV2WD0008QG0R00051XS0N: "the compilers don't lie"). The types mirror the TS reference
/// (src/Core.TypeScript/observe/observe.ts) so the golden-vector fixture (src/Core.TypeScript/observe/
/// golden-vectors.json) replays identically here. Zero external dependencies.

/// The persisted mode. Mirrors the TS `Mode` union; the JSON wire form uses the
/// lower/snake strings "work" | "explore" | "play" | "self_reflect" | "free_time".
[<RequireQualifiedAccess>]
type Mode =
    | Work
    | Explore
    | Play
    | SelfReflect
    | FreeTime

/// One backlog item — classified to what the controller needs to decide.
type BacklogItem =
    { Id: string
      Title: string
      Ready: bool
      Ambiguous: bool
      NeedsNewAction: bool }

/// The observable read-side of the operator channel.
type OperatorChannel =
    { PendingMessage: bool
      PendingFerry: bool }

/// The world snapshot. `Operator = None` = the channel isn't wired (background
/// agent). `Mode = None` = unset (defaults apply).
type World =
    { Backlog: BacklogItem list
      Operator: OperatorChannel option
      Mode: Mode option }

/// The event / action union (the Msg). Mirrors the TS `NextAction` discriminated
/// union — nine kinds. `reason` strings are carried for parity with the TS shape
/// (they do not affect the reducer's state transition).
type NextAction =
    | PreserveFerry of reason: string
    | RespondToOperator of reason: string
    | DoItem of item: BacklogItem
    | Decompose of item: BacklogItem
    | EditGrammar of item: BacklogItem option * reason: string
    | Explore of reason: string
    | Play of reason: string
    | SelfReflect of reason: string
    | FreeTime of reason: string
