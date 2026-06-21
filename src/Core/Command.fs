namespace Zeta.Core

open System.Threading
open System.Threading.Tasks

/// The data-plane command surface as DATA — the core that the CLI and MCP thin-wrap (roadmap #1,
/// no-git-CLI; core-library-first, Aaron 2026-06-07). A `DbCommand` is a *value*: input → DbCommand →
/// `run` over any `IDeltaLog`. "Verbs as data" — fits the everything-is-data frame, and a DbCommand
/// itself is serializable (a DU over ZSet/Map/int64).
///
/// These are the **backend-agnostic data-plane verbs** that already exist on `IDeltaLog`
/// (append / history / get / status). The **git-ref verbs** (branch / checkout / status-of-working-ref /
/// sync / push) need the git backend and extend this surface in `Core.Git` — they are the genuinely-new
/// commands from the git-reach punch-list (081KTGPC2XP). Control-plane verbs (PR / merge) live in the
/// Loom/consensus-repo layer, not here.
type DbCommand<'K when 'K : comparison> =
    /// Emit delta: raises amplitude (assertions/inserts).
    | Emit of delta: ZSet<'K> * captured: Map<string, string>
    /// Retract delta: lowers amplitude (retractions/deletes).
    | Retract of delta: ZSet<'K> * captured: Map<string, string>
    /// Branch: create a new named branch pointer.
    | Branch of name: string
    /// Join: couple to a ref (checkout) or couple to a remote (push/fetch).
    | Join of refName: string * isRemote: bool
    /// Merge: combine/reconcile another branch's deltas.
    | Merge of sourceRef: string
    /// Fold: replay log history to reconstruct state.
    | Fold of fromSeqExclusive: int64
    /// Status: working-tree status.
    | Status
    /// Ls: list files/entries at ref.
    | Ls of refName: string option

/// The result of running a `DbCommand` — also a value (a DU), so a wrapper can render/serialize it.
type DbCommandResult<'K when 'K : comparison> =
    | Emitted of seq: int64
    | Retracted of seq: int64
    | Branched of name: string
    | Joined of refName: string
    | Merged of sourceRef: string * newSeq: int64
    | Folded of entries: DeltaLogEntry<'K>[]
    | Statused of isClean: bool * pending: string[]
    | Listed of entries: string[]

[<RequireQualifiedAccess>]
module DbCommand =

    /// Interpret a command over a `Log`. Async (the data-plane I/O is async); the wrappers (CLI/MCP)
    /// await this. Lossless mapping onto `IDeltaLog` and `IRefDeltaLog`.
    let run (log: IDeltaLog<'K>) (ct: CancellationToken) (cmd: DbCommand<'K>) : Task<Result<DbCommandResult<'K>, DbFeedback>> =
        task {
            match cmd with
            | DbCommand.Emit(delta, captured) ->
                let! seq = log.AppendAsync(delta, captured, ct)
                return Ok(DbCommandResult.Emitted seq)
            | DbCommand.Retract(delta, captured) ->
                // Retract negates weights in the delta before appending.
                let negated = ZSet.scale -1L delta
                let! seq = log.AppendAsync(negated, captured, ct)
                return Ok(DbCommandResult.Retracted seq)
            | DbCommand.Branch name ->
                match log with
                | :? IRefDeltaLog<'K> as rlog ->
                    match rlog.Branch name with
                    | Ok () -> return Ok(DbCommandResult.Branched name)
                    | Error fb -> return Error fb
                | _ -> return Error(InvalidOperation "Active database backend does not support branch operations")
            | DbCommand.Join(refName, isRemote) ->
                match log with
                | :? IRefDeltaLog<'K> as rlog ->
                    if isRemote then
                        match rlog.Sync refName with
                        | Ok () -> return Ok(DbCommandResult.Joined refName)
                        | Error fb -> return Error fb
                    else
                        match rlog.Checkout refName with
                        | Ok () -> return Ok(DbCommandResult.Joined refName)
                        | Error fb -> return Error fb
                | _ -> return Error(InvalidOperation "Active database backend does not support join operations")
            | DbCommand.Merge sourceRef ->
                match log with
                | :? IRefDeltaLog<'K> as rlog ->
                    match rlog.Merge sourceRef with
                    | Ok newSeq -> return Ok(DbCommandResult.Merged(sourceRef, newSeq))
                    | Error fb -> return Error fb
                | _ -> return Error(InvalidOperation "Active database backend does not support merge operations")
            | DbCommand.Fold fromSeqExclusive ->
                let! entries = log.ReplayAsync(fromSeqExclusive, ct)
                return Ok(DbCommandResult.Folded entries)
            | DbCommand.Status ->
                match log with
                | :? IRefDeltaLog<'K> as rlog ->
                    let isClean, pending = rlog.Status()
                    return Ok(DbCommandResult.Statused(isClean, pending))
                | _ -> return Error(InvalidOperation "Active database backend does not support status operations")
            | DbCommand.Ls refName ->
                match log with
                | :? IRefDeltaLog<'K> as rlog ->
                    match rlog.Ls refName with
                    | Ok entries -> return Ok(DbCommandResult.Listed entries)
                    | Error fb -> return Error fb
                | _ -> return Error(InvalidOperation "Active database backend does not support ls operations")
        }
