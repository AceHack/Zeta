namespace Zeta.Core.FSharp.ObserveBridge

open System.Threading
open System.Threading.Tasks
open Zeta.Core

/// **Bridge D (substrate) — the `IEffectHandler` adapter that performs real I/O via the substrate.**
///
/// The ONE place that touches the durable substrate. Wires:
///
/// **`PersistFerry`** (marker + dedicated, **persona-scoped** ferry stream): the operator's ferried
/// verbatim content is read from `ferrySource` (the bus seam — `unit -> string option`, injected so
/// the adapter is bus-agnostic) and appended to **this persona's** stream `ferryLog`
/// (`IDeltaLog<string>`; a `GitDeltaLog` for git durability), attributed `{ ferryType; persona }`.
/// A ferry is a PATTERN; persona-ferry is one `ferryType`.
///
/// **`RunWork`** (the Agent hook — the one place a Cell invokes an Agent): delegates a `do_item`'s
/// real work to an injected `IWorkRunner`. The Agent never commits / never touches git/gh — it
/// returns a `WorkOutcome`:
///   - `Progressed effects` → each proposed effect **re-enters the gate** (inspect→admit?execute)
///     at `depth+1`, so the Agent's work is itself capability-gated and CANNOT self-authorize.
///   - `Blocked reason` → a named block (forward-momentum honesty).
///   - `NeedsAuthorization class` → the human must authorize; the loop does NOT proceed.
/// `maxWorkDepth` bounds RunWork nesting (None = unbounded, for experimentation; Some n = bounded —
/// nested work beyond the bound is skipped, never a runaway cascade).
///
/// **Child-safety floor (load-bearing):** `executeOne` is reached ONLY through `gateAndExecute`'s
/// `Admit` — at every recursion depth. So a `policy` that denies a gated/child-floor class makes it
/// *impossible* for the Agent to get such an effect executed by proposing it (it is denied → never
/// executed). **`EmitResponse`** is the outbound twin of `PersistFerry` (the Agent's reply →
/// the persona's response stream, attributed `kind="response"`; the operator reads it from there).
/// **`ExtendGrammar`** is the sovereign self-edit → the persona's grammar-extension stream
/// (`kind="grammar-extension"`), with a TUNABLE `grammarNeedsAuth` escalation (raw below
/// threshold; `needs authorization` above — the summon-BFT proxy, dial to taste) over the hard gate.
/// All four effects now wired; only the real LLM `IWorkRunner` + a real bus remain.
[<Sealed>]
type SubstrateEffectHandler
    (
        persona: string,
        ferrySource: unit -> string option,
        ferryLog: IDeltaLog<string>,
        ?policy: Effects.Effect -> Effects.Verdict,
        ?ferryType: string,
        ?workRunner: Effects.IWorkRunner,
        ?maxWorkDepth: int,
        ?responseSource: unit -> string option,
        ?responseLog: IDeltaLog<string>,
        ?grammarSource: unit -> string option,
        ?grammarLog: IDeltaLog<string>,
        ?grammarNeedsAuth: Zeta.Core.FSharp.Observe.BacklogItem -> bool
    ) =

    let policy = defaultArg policy (fun _ -> Effects.Admit)
    let ferryType = defaultArg ferryType "persona"
    // Tunable raw-vs-escalate threshold for the sovereign self-edit (ExtendGrammar). Default:
    // raw (never escalates) — NOT noisy. Tune UP (return true for consequential edits) to require
    // authorization; the eventual summon-BFT consensus replaces this predicate. Layered ON TOP of
    // the hard `policy` gate (which still denies child-floor classes).
    let grammarNeedsAuth = defaultArg grammarNeedsAuth (fun _ -> false)

    let persistFerry (ct: CancellationToken) : Task<Effects.EffectResult> =
        task {
            match ferrySource () with
            | Some content when content <> "" ->
                let! _seq =
                    ferryLog.AppendAsync(ZSet.ofSeq [ content, 1L ], Map.ofList [ "ferryType", ferryType; "persona", persona ], ct).AsTask()
                return Effects.Executed
            | _ -> return Effects.Skipped "PersistFerry: no ferried content on the channel"
        }

    // EmitResponse — the OUTBOUND twin of PersistFerry. The Agent-composed reply (read from
    // `responseSource`, the bus seam) is appended to this persona's response stream `responseLog`,
    // attributed `{ kind = "response"; persona }`. The operator reads the reply FROM that durable
    // stream — so responding stays "behind the DB layer" (no raw bus send). Marker + persona +
    // gate, symmetric to the inbound ferry. Not wired (no source/log) ⇒ honest Skipped.
    let emitResponse (ct: CancellationToken) : Task<Effects.EffectResult> =
        task {
            match responseSource, responseLog with
            | Some src, Some log ->
                match src () with
                | Some reply when reply <> "" ->
                    let! _seq =
                        log.AppendAsync(ZSet.ofSeq [ reply, 1L ], Map.ofList [ "kind", "response"; "persona", persona ], ct).AsTask()
                    return Effects.Executed
                | _ -> return Effects.Skipped "EmitResponse: no response to emit"
            | _ -> return Effects.Skipped "EmitResponse: not wired (no responseSource/responseLog)"
        }

    // ExtendGrammar — the sovereign self-edit: an item gains a new action the do/decompose grammar
    // couldn't express. Same marker + persona + gate shape; the new-action description (from
    // `grammarSource`) appends to this persona's grammar-extension stream `grammarLog`, attributed
    // `{ kind = "grammar-extension"; persona; item }`. TUNABLE escalation: `grammarNeedsAuth item`
    // (default off) escalates consequential edits to `needs authorization` (the summon-BFT-above-
    // threshold proxy; dial it up if the floor is too permissive, down if it is too noisy). The
    // hard `policy` gate still applies underneath (denied → never lands; child-floor).
    let extendGrammar (item: Zeta.Core.FSharp.Observe.BacklogItem) (ct: CancellationToken) : Task<Effects.EffectResult> =
        task {
            if grammarNeedsAuth item then
                return Effects.Skipped(sprintf "needs authorization: grammar extension for \"%s\" (tunable threshold)" item.Id)
            else
                match grammarSource, grammarLog with
                | Some src, Some log ->
                    match src () with
                    | Some ext when ext <> "" ->
                        let! _seq =
                            log.AppendAsync(ZSet.ofSeq [ ext, 1L ], Map.ofList [ "kind", "grammar-extension"; "persona", persona; "item", item.Id ], ct).AsTask()
                        return Effects.Executed
                    | _ -> return Effects.Skipped "ExtendGrammar: no extension to persist"
                | _ -> return Effects.Skipped "ExtendGrammar: not wired (no grammarSource/grammarLog)"
        }

    /// Execute one effect at a given RunWork-nesting `depth`. RunWork's proposed effects re-enter
    /// `gateAndExecute` (inspect→execute) — so the gate guards EVERY depth.
    let rec executeOne (depth: int) (effect: Effects.Effect) (ct: CancellationToken) : Task<Effects.EffectResult> =
        task {
            match effect with
            | Effects.PersistFerry -> return! persistFerry ct
            | Effects.EmitResponse -> return! emitResponse ct
            | Effects.ExtendGrammar item -> return! extendGrammar item ct
            | Effects.RunWork item ->
                match workRunner with
                | None -> return Effects.Skipped "RunWork: no work runner wired"
                | Some runner ->
                    match maxWorkDepth with
                    | Some maxD when depth > maxD -> return Effects.Skipped(sprintf "RunWork: max work depth %d reached" maxD)
                    | _ ->
                        let! outcome = runner.RunAsync(item, ct).AsTask()
                        match outcome with
                        | Effects.Blocked r -> return Effects.Skipped("blocked: " + r)
                        | Effects.NeedsAuthorization c -> return Effects.Skipped("needs authorization: " + c)
                        | Effects.Progressed effects ->
                            // Re-gate each proposed effect at depth+1: the Agent proposes, the gate disposes.
                            for e in effects do
                                let! _ = gateAndExecute (depth + 1) e ct
                                ()
                            return Effects.Executed
        }

    /// The gate: inspect → (admit ⇒ execute | deny ⇒ skip). The SOLE path to `executeOne`, so a
    /// denied effect is never executed — at any depth (the child-floor invariant).
    and gateAndExecute (depth: int) (effect: Effects.Effect) (ct: CancellationToken) : Task<Effects.EffectResult> =
        task {
            match policy effect with
            | Effects.Admit -> return! executeOne depth effect ct
            | Effects.Deny r -> return Effects.Skipped("denied by inspect: " + r)
        }

    interface Effects.IEffectHandler with
        member _.InspectAsync(effect, _ct) = ValueTask<Effects.Verdict>(policy effect)
        member _.ExecuteAsync(effect, ct) = ValueTask<Effects.EffectResult>(executeOne 0 effect ct)
