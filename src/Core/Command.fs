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
    /// Commit a delta (+ captured non-determinism) — the canonical `git commit` replacement.
    | Append of delta: ZSet<'K> * captured: Map<string, string>
    /// Read the log tail (entries with seq > `fromSeqExclusive`) — the `git log` replacement.
    | History of fromSeqExclusive: int64
    /// Read a single entry by its sequence number — the `git show <ref>` replacement.
    | Get of seq: int64
    /// The current high-water sequence — the `git status`/tip replacement.
    | Status

/// The result of running a `DbCommand` — also a value (a DU), so a wrapper can render/serialize it.
type DbCommandResult<'K when 'K : comparison> =
    | Appended of seq: int64
    | History of entries: DeltaLogEntry<'K>[]
    | Got of entry: DeltaLogEntry<'K> option
    | Status of highWater: int64

[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module DbCommand =

    /// Interpret a command over a `Log`. Async (the data-plane I/O is async); the wrappers (CLI/MCP)
    /// await this. Lossless mapping onto `IDeltaLog`: append→AppendAsync, history→ReplayAsync,
    /// get→ReplayAsync(seq-1) then pick `Seq = seq`, status→HighWater.
    let run (log: IDeltaLog<'K>) (ct: CancellationToken) (cmd: DbCommand<'K>) : Task<DbCommandResult<'K>> =
        task {
            match cmd with
            | DbCommand.Append(delta, captured) ->
                let! seq = log.AppendAsync(delta, captured, ct)
                return DbCommandResult.Appended seq
            | DbCommand.History fromSeqExclusive ->
                let! entries = log.ReplayAsync(fromSeqExclusive, ct)
                return DbCommandResult.History entries
            | DbCommand.Get seq ->
                let! entries = log.ReplayAsync(seq - 1L, ct)
                return DbCommandResult.Got(entries |> Array.tryFind (fun e -> e.Seq = seq))
            | DbCommand.Status ->
                return DbCommandResult.Status log.HighWater
        }
