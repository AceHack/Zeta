namespace Zeta.Core.FSharp.ObserveBridge

open System.Threading
open System.Threading.Tasks
open Zeta.Core

/// **Bridge D (substrate) — the `IEffectHandler` adapter that performs real I/O via the substrate.**
///
/// The ONE place that touches the durable substrate. v1 wires **`PersistFerry`** (maintainer
/// calls: *marker + dedicated, **persona-scoped** ferry stream*): the operator's ferried verbatim
/// content is read from `ferrySource` (the bus seam — a `unit -> string option` injected by the
/// caller, so the adapter is bus-agnostic) and appended to **this persona's** dedicated ferry
/// stream `ferryLog` — an `IDeltaLog<string>`; pass the `GitDeltaLog<string>` opened under the
/// persona (e.g. its ref/path) for git durability, or an in-memory log for tests. The append is
/// attributed to `persona` via the captured map, so the ferry history is owned, not anonymous.
/// `PersistFerry` stays a MARKER: the content is sourced here, never carried in the effect.
///
/// The handler is **per-agent** (the agent running the loop), so `persona` = that agent's persona
/// and `ferryLog` = that persona's stream — a persona-ferry lands under its own persona.
///
/// The capability / inspect-before-execute gate is `policy` (default: admit all) — the shadow
/// proposes; the handler admits. `EmitResponse` / `RunWork` / `ExtendGrammar` are NOT wired in v1
/// — they return an honest `Skipped`, never a silent success (Result-over-exception). Honest async:
/// the ferry append is genuine I/O (awaited); the not-wired arms complete synchronously.
[<Sealed>]
type SubstrateEffectHandler
    (
        persona: string,
        ferrySource: unit -> string option,
        ferryLog: IDeltaLog<string>,
        ?policy: Effects.Effect -> Effects.Verdict,
        ?ferryType: string
    ) =

    let policy = defaultArg policy (fun _ -> Effects.Admit)
    // A ferry is a PATTERN — preserved verbatim content routed to a durable, attributed stream.
    // The PERSONA ferry is just one TYPE; future types (e.g. cross-agent, system) reuse the same
    // pattern with a different `ferryType`. Defaulting to "persona" since that is the v1 type.
    let ferryType = defaultArg ferryType "persona"

    interface Effects.IEffectHandler with
        member _.InspectAsync(effect, _ct) = ValueTask<Effects.Verdict>(policy effect)

        member _.ExecuteAsync(effect, ct) =
            match effect with
            | Effects.PersistFerry ->
                match ferrySource () with
                | Some content when content <> "" ->
                    // Append the ferried content to this persona's dedicated ferry stream (durable;
                    // the ferry history). Content rides as a weight-1 ZSet<string> entry, attributed
                    // to the owning persona via the captured map.
                    let t =
                        task {
                            let! _seq =
                                ferryLog.AppendAsync(
                                    ZSet.ofSeq [ content, 1L ],
                                    Map.ofList [ "ferryType", ferryType; "persona", persona ],
                                    ct
                                )
                                    .AsTask()
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
