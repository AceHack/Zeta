namespace Zeta.Core.FSharp.ObserveBridge

open System.Threading
open System.Threading.Tasks
open Zeta.Core

/// **Bridge D (substrate) — the `IEffectHandler` adapter that performs real I/O via the substrate.**
///
/// The ONE place that touches the durable substrate. v1 wires **`PersistFerry`** (maintainer
/// call: *marker + dedicated ferry stream*): the operator's ferried verbatim content is read from
/// `ferrySource` (the bus seam — a `unit -> string option` injected by the caller, so the adapter
/// is bus-agnostic) and appended to a **dedicated ferry stream** `ferryLog` — an
/// `IDeltaLog<string>`; pass a `GitDeltaLog<string>` for git durability, or an in-memory log for
/// tests. `PersistFerry` stays a MARKER: the content is sourced here, never carried in the effect.
///
/// The capability / inspect-before-execute gate is `policy` (default: admit all) — the shadow
/// proposes; the handler admits. `EmitResponse` / `RunWork` / `ExtendGrammar` are NOT wired in v1
/// — they return an honest `Skipped`, never a silent success (Result-over-exception). Honest async:
/// the ferry append is genuine I/O (awaited); the not-wired arms complete synchronously.
[<Sealed>]
type SubstrateEffectHandler
    (
        ferrySource: unit -> string option,
        ferryLog: IDeltaLog<string>,
        ?policy: Effects.Effect -> Effects.Verdict
    ) =

    let policy = defaultArg policy (fun _ -> Effects.Admit)

    interface Effects.IEffectHandler with
        member _.InspectAsync(effect, _ct) = ValueTask<Effects.Verdict>(policy effect)

        member _.ExecuteAsync(effect, ct) =
            match effect with
            | Effects.PersistFerry ->
                match ferrySource () with
                | Some content when content <> "" ->
                    // Append the ferried content to the dedicated ferry stream (durable; the
                    // ferry history). Content rides as a weight-1 ZSet<string> entry.
                    let t =
                        task {
                            let! _seq = ferryLog.AppendAsync(ZSet.ofSeq [ content, 1L ], Map.empty, ct).AsTask()
                            return Effects.Executed
                        }
                    ValueTask<Effects.EffectResult>(t)
                | _ -> ValueTask<Effects.EffectResult>(Effects.Skipped "PersistFerry: no ferried content on the channel")
            | Effects.EmitResponse ->
                ValueTask<Effects.EffectResult>(Effects.Skipped "EmitResponse: not wired in v1 (substrate adapter)")
            | Effects.RunWork _ ->
                ValueTask<Effects.EffectResult>(Effects.Skipped "RunWork: not wired in v1 (agent hook pending)")
            | Effects.ExtendGrammar _ ->
                ValueTask<Effects.EffectResult>(Effects.Skipped "ExtendGrammar: not wired in v1 (substrate adapter)")
