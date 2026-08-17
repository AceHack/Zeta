namespace Zeta.Core

open System.Threading.Tasks

/// SimVerb — **`sim` as the room runner, measured in Z-sets over the room's uncertainty**
/// (Aaron 2026-08-17: *"sim should be our room runner eventually, we have sim(ulate) mea(sure) cut
/// like DNA but for our zsets/gsets over our rooms uncertainty, and cause inject real or
/// deterministic simulation dependencies for the interfaces injected so they can be measured or
/// simulated"*).
///
/// **This module does NOT introduce a room runner.** One already exists and is load-bearing:
/// `SimLoop.run` drives `sim → mea → cut → loop` under three finite rails, and `SimFramework` is its
/// hexagonal port. What was missing is the thing Aaron named — the **shape of `mea`**. `SimLoop.run`
/// takes `mea: 'S -> 'M` for an entirely unconstrained `'M`, so nothing forces a lap's measurement to
/// be a measurement *of uncertainty*, and nothing makes the lap ledger commutative or idempotent.
///
/// ## The human anchor (Beacon)
///
/// The vocabulary here is **Addison Cooper's**, not factory shorthand. *Genesis Concepts* (2026-06-20;
/// in-repo copy `docs/design/root-site-iris/Genesis Concepts.dc.html`, published at
/// `lucent-financial-group.github.io/concepts.html`) defines the four primitives this module
/// implements, verbatim:
///
///   • **Room** — *"uncertainty engine — not a folder"*, maintaining ledgers of
///     *"known, unknown, assumed, disputed, and decided"* states.
///   • **Z-set** — *"reversible live state — the future stays flexible."*
///   • **G-set** — *"grow-only history — the past cannot be un-happened."*
///   • **DST** — *"requirement for truth."*
///
/// The definition is load-bearing and this module obeys it literally: a room's uncertainty is the
/// **five-way** ledger, and the runner **never collapses it**. `Epistemic` below is that five-way
/// state; it had no representation anywhere in this tree before now.
///
/// ## The two sets, and which verb touches which
///
/// Addison's pair is the reversible present and the irreversible past, and the verbs split on it:
///   • `sim` and `cut` operate on the **Z-set** — the live claim ledger, where a belief can be
///     retracted (`−1`) and re-asserted (`+1`). The future stays flexible.
///   • `mea` writes the **G-set** — grow-only, union-folded, idempotent, commutative. A measurement,
///     once banked, cannot be un-banked. The past cannot be un-happened.
/// So the run record carries both: `Laps` (Z-set deltas, the reversible reading) and `Ledger` (the
/// G-set, the irreversible record).
///
/// ## The seam — the part Aaron asked for by name
///
/// Real-vs-simulated is chosen by **injection of `Source`**, never by a flag, and this module adds no
/// branch on one:
///   `seedSource seed`          → deterministic simulation (null I/O, DST)
///   `RecordedSource.replay r`  → recorded real I/O, replayed identically
///   a live source over real I/O → production
/// One code path, three membranes. This is not a style preference: a room is meant to be the
/// programming interface a non-technical person uses, so if the simulated path and the production
/// path diverged in code, their "test" would stop telling them anything about their "prod" and the
/// interface would stop meaning what it claims. §13 noninterference: `Source` and `Clock` are the
/// *only* entropy doors, and both are fields of the room — no ambient wall clock, no unseeded RNG,
/// no `Task.Run`, and no way to reach any of them from inside a room.
///
/// That last sentence is not self-certified: `tests/Tests.FSharp/DeterminismLint.Tests.fs` scans
/// every file in `src/Core` for ambient-entropy tokens (wall clocks, unseeded `Random`, `NewGuid`,
/// `Stopwatch`) and fails the build unless the file is on its justified allowlist. This module is not
/// on that allowlist and does not need to be. The lint scans **comments too**, on the stated ground
/// that a commented-out wall clock is one waiting to return — which is why the banned identifiers are
/// described here rather than spelled.
///
/// ## Registers (honesty)
///
/// **unmetered** (`.claude/rules/toy-is-free-metered-must-be-earned.md`). The mechanism is
/// implemented and tested; **no claim is made that entropy metering is accurate enough for anything**,
/// and no measurement of that accuracy exists in this repo. Aaron's own words are "getting closer",
/// which is not "arrived". *Genesis Concepts* is a **specification of intent**, cited here as the
/// definition this code answers to — never as evidence that a capability exists.
[<RequireQualifiedAccess>]
module SimVerb =

    // ── Addison's five-way ledger state ──────────────────────────────────────────────────────────

    /// The five states a room's ledger holds a claim in — Addison Cooper, *Genesis Concepts* (2026-06-20):
    /// a room maintains *"known, unknown, assumed, disputed, and decided"* and does not prematurely
    /// collapse them. Keeping all five is the point: `Disputed` is conflicting evidence **held open**,
    /// and `Decided` is a commitment made *under* uncertainty — a decision is not a proof, so
    /// collapsing the two loses precisely the distinction the room exists to preserve.
    ///
    /// Note the ordering of the cases is declaration order only and carries **no** epistemic meaning;
    /// any ranking is an injected oracle (see `ResolutionOracle`), never a property of this type.
    type Epistemic =
        /// Established — evidence supports it.
        | Known
        /// Open — no belief formed yet.
        | Unknown
        /// Believed but not established — a live assumption the room is carrying.
        | Assumed
        /// Conflicting evidence, held open rather than resolved by fiat.
        | Disputed
        /// Committed under uncertainty. A decision, not a proof.
        | Decided

    /// One claim in the room's live ledger: the question, and the state the room holds it in.
    /// Carried in a **Z-set**, so `+1` asserts and `−1` retracts — the reversible present.
    type Claim<'Q when 'Q: comparison> = { Question: 'Q; State: Epistemic }

    /// The room's live uncertainty: a Z-set of claims (Addison: *"reversible live state"*).
    type Uncertainty<'Q when 'Q: comparison> = ZSet<Claim<'Q>>

    /// Count the claims the room holds in each of the five states. The **neutral fact** — no ordering,
    /// no verdict, no collapse.
    type Census =
        { Known: Weight
          Unknown: Weight
          Assumed: Weight
          Disputed: Weight
          Decided: Weight }

    /// Census of a live ledger. Pure fold over the Z-set's weights.
    let census (u: Uncertainty<'Q>) : Census =
        u
        |> Seq.fold
            (fun c e ->
                match e.Key.State with
                | Known -> { c with Known = c.Known + e.Weight }
                | Unknown -> { c with Unknown = c.Unknown + e.Weight }
                | Assumed -> { c with Assumed = c.Assumed + e.Weight }
                | Disputed -> { c with Disputed = c.Disputed + e.Weight }
                | Decided -> { c with Decided = c.Decided + e.Weight })
            { Known = 0L
              Unknown = 0L
              Assumed = 0L
              Disputed = 0L
              Decided = 0L }

    // ── The resolution oracle (§11 multi-oracle: the collapse is CHOSEN, never mandatory) ────────
    // Reducing five states to "did uncertainty go down" is a judgement, not a fact. Baking one in
    // would be the substrate holding a morality it is not allowed to hold, and would re-introduce
    // exactly the premature collapse Addison's definition forbids. So the ranking is INJECTED and
    // ATTRIBUTED, and the neutral five-way census travels beside every verdict it produces.

    /// A chosen reading of the five-way ledger: how resolved is a claim in this state?
    /// Higher = more resolved. `Attribution` is on the record so the reading is never anonymous.
    type ResolutionOracle =
        { Name: string
          Attribution: string
          Rank: Epistemic -> int }

    /// The **default** oracle (§11 default oracle, not a mandatory one). Its ranking is a stated
    /// reading, deliberately visible: an untouched question is least resolved; a live assumption is
    /// progress but unearned; an actively disputed claim ranks *above* a bare assumption because the
    /// conflict is at least surfaced; a decision closes the question without proving it; only `Known`
    /// is fully resolved. This is a **toy** ranking — nothing falsifies these five integers. Inject
    /// your own where the reading matters.
    let defaultResolutionOracle: ResolutionOracle =
        { Name = "default"
          Attribution =
            "toy ranking; §11 default oracle, not mandatory. No falsifier exists for these five integers."
          Rank =
            fun e ->
                match e with
                | Unknown -> 0
                | Assumed -> 1
                | Disputed -> 2
                | Decided -> 3
                | Known -> 4 }

    /// The oracle's scalar reading of a live ledger (weighted rank sum). Meaningful only relative to
    /// another reading by the *same* oracle; it is not a unit of anything.
    let resolutionScore (o: ResolutionOracle) (u: Uncertainty<'Q>) : Weight =
        u |> Seq.sumBy (fun e -> int64 (o.Rank e.Key.State) * e.Weight)

    // ── Budget attribution (the hidden-oracle guard) ─────────────────────────────────────────────
    // A gating constant with no attribution is an oracle nobody elected. There are only the three
    // constructors below and each demands a reason, so a bare number cannot enter a run record.

    /// Where a budget's numbers came from. There is no fourth case and no silent default.
    type BudgetSource =
        /// A human authorized these limits. `who` is the human; `why` is the reason on the record.
        | HumanAuthorized of who: string * why: string
        /// Inherited from a work-item / prior authorization that already carries the numbers.
        | InheritedFrom of workItem: string * why: string
        /// Explicitly a toy: chosen for convenience, falsified by nothing. Says so in the record.
        | ToyDefault of why: string

    /// A budget that cannot be quoted without its provenance.
    type AttributedBudget =
        { Limits: SimLoop.Budget
          Attribution: BudgetSource }

    /// The unattributed `SimLoop.defaultBudget`, wrapped so its status is legible at every use site.
    let toyBudget (why: string) : AttributedBudget =
        { Limits = SimLoop.defaultBudget
          Attribution = ToyDefault why }

    /// Human-authorized limits.
    let authorizedBudget (who: string) (why: string) (limits: SimLoop.Budget) : AttributedBudget =
        { Limits = limits
          Attribution = HumanAuthorized(who, why) }

    /// Limits inherited from a work-item that already carries the authorization.
    let inheritedBudget (workItem: string) (why: string) (limits: SimLoop.Budget) : AttributedBudget =
        { Limits = limits
          Attribution = InheritedFrom(workItem, why) }

    /// One text line naming the limits AND their source — a run's rails are auditable in a diff.
    let describeBudget (b: AttributedBudget) : string =
        let src =
            match b.Attribution with
            | HumanAuthorized(who, why) -> sprintf "human=%s:%s" who why
            | InheritedFrom(item, why) -> sprintf "workitem=%s:%s" item why
            | ToyDefault why -> sprintf "toy:%s" why

        sprintf "budget laps=%d ticks=%d millis=%d src=%s" b.Limits.MaxLaps b.Limits.MaxTicks b.Limits.MaxMillis src

    // ── The measurement register (ordinal, per db/uncertainty/README.md) ─────────────────────────

    /// The ordinal ΔU register. Deliberately NOT a number: nothing here meters uncertainty in units,
    /// and `db/uncertainty/README.md` refuses a cardinal price for exactly that reason.
    type DeltaU =
        | Reduced
        | Increased
        | Unchanged

    /// One lap's measurement. `Delta` is the DBSP Z-set change (`after − before`) over the live claim
    /// ledger — the reversible reading. `Before`/`After` are the **full five-way censuses**, carried
    /// uncollapsed so a consumer can apply its own oracle. `Sign` is *one* oracle's reading of them,
    /// named in `Oracle`, never the only possible one.
    type Mea<'Q when 'Q: comparison> =
        { Lap: int
          Delta: ZSet<Claim<'Q>>
          Before: Census
          After: Census
          Oracle: string
          Sign: DeltaU }

    /// The ordinal sign of a score movement. A lower score means less resolution, so a *rise* in
    /// resolution score is a *reduction* in uncertainty.
    let signOf (before: Weight) (after: Weight) : DeltaU =
        if after > before then Reduced
        elif after < before then Increased
        else Unchanged

    // ── The room ─────────────────────────────────────────────────────────────────────────────────

    /// A room `sim` can run — Addison's *"uncertainty engine — not a folder"*, made type-shaped.
    /// Every entropy door is a FIELD, so there is no ambient one:
    ///   `Source` = the membrane (§13's only entropy door; seed / recorded / live, by injection);
    ///   `Clock`  = generator time, `lap → elapsed millis` (§7; never a wall clock reached from here).
    /// `Ledger` is the uncertainty lens: it reads the room's state as its live five-way claim Z-set.
    /// A record of functions, not a class — no instance state, nothing captured (§3 weight-free).
    type Room<'S, 'Q when 'Q: comparison> =
        { Name: string
          Initial: int64 -> 'S
          Handlers: SoftScheduler.HandlerK<'S> list
          Source: int64 -> SoftScheduler.Source
          Clock: int -> int64
          Ledger: 'S -> Uncertainty<'Q>
          Oracle: ResolutionOracle
          TicksPerLap: int
          Budget: AttributedBudget }

    /// A room over the deterministic seed membrane, a synthetic zero clock, and the default oracle —
    /// the DST default. Swap any door with `withSource` / `withClock` / `withOracle`; the code path
    /// does not change, which is the entire point of the seam.
    let room
        (name: string)
        (initial: int64 -> 'S)
        (handlers: SoftScheduler.HandlerK<'S> list)
        (ledger: 'S -> Uncertainty<'Q>)
        (ticksPerLap: int)
        (budget: AttributedBudget)
        : Room<'S, 'Q> =
        { Name = name
          Initial = initial
          Handlers = handlers
          Source = SoftScheduler.seedSource
          Clock = fun _ -> 0L
          Ledger = ledger
          Oracle = defaultResolutionOracle
          TicksPerLap = ticksPerLap
          Budget = budget }

    /// Swap the membrane: the SAME room against a recorded real-IO replay, or a live source.
    /// This is the whole real-vs-simulated choice — a substitution, not a branch.
    let withSource (source: int64 -> SoftScheduler.Source) (r: Room<'S, 'Q>) : Room<'S, 'Q> = { r with Source = source }

    /// Swap the generator clock (`lap → elapsed millis`). Tests inject synthetic time; production
    /// injects a monotonic stopwatch reading. Neither is reachable ambiently from inside a room.
    let withClock (clock: int -> int64) (r: Room<'S, 'Q>) : Room<'S, 'Q> = { r with Clock = clock }

    /// Swap the reading of the five-way ledger (§11: the collapse is chosen, never imposed).
    let withOracle (oracle: ResolutionOracle) (r: Room<'S, 'Q>) : Room<'S, 'Q> = { r with Oracle = oracle }

    /// Swap the uncertainty lens — what the room counts as its open claims.
    let withLedger (ledger: 'S -> Uncertainty<'Q>) (r: Room<'S, 'Q>) : Room<'S, 'Q> = { r with Ledger = ledger }

    // ── The run record ───────────────────────────────────────────────────────────────────────────

    /// What a `sim` run yields. `Laps` are the per-lap Z-set measurements (the reversible present);
    /// `Ledger` is the grow-only G-set fold of their canonical text keys (the irreversible past);
    /// `Stopped` is the honest reason it ended — a budget rail is a legitimate ending, not a failure.
    type Run<'S, 'Q when 'Q: comparison> =
        { Room: string
          Seed: int64
          Laps: Mea<'Q> list
          Ledger: GSet<string>
          Stopped: SimLoop.Stopped
          Final: 'S
          FinalCensus: Census
          Net: DeltaU
          Oracle: string
          Budget: AttributedBudget }

    // ── The port ─────────────────────────────────────────────────────────────────────────────────

    /// THE PORT: `sim` runs a room and returns its measured uncertainty trace. An interface, per the
    /// meta-rule — the default adapter below is an object expression, so no class is earned.
    ///
    /// Contrast `clis/Verbs.fs` `ISimVerb.Sim: ISeed * TimeSpan -> unit`, which is uninhabitable as a
    /// composition target: `IMeaVerb.Mea` consumes an `ISim<'a>` that `Sim` never produces, so the
    /// documented `sim |> mea |> cut` cannot typecheck in that family. Here `sim` returns its run and
    /// folds `mea`/`cut` into it, rather than offering verbs that cannot be piped.
    type ISimVerb =
        abstract member Sim<'S, 'Q when 'Q: comparison> : room: Room<'S, 'Q> * seed: int64 -> Task<Run<'S, 'Q>>

    // ── Canonical text encoding (no binary in the proof lineage; the DST comparison surface) ─────

    // NOTE: F#'s `sprintf "%d"` / "%s" are culture-INVARIANT by construction (they do not consult
    // CurrentCulture), which is what `culture-invariant-by-default` requires here. This is also the
    // convention `SimLoop.fs` already uses for its text treaty surface. `FormattableString.Invariant`
    // is the alternative, but it rejects `%` specifiers (FS3376).
    let private censusText (c: Census) : string =
        sprintf "k=%d,u=%d,a=%d,x=%d,d=%d" c.Known c.Unknown c.Assumed c.Disputed c.Decided

    let private stateText (e: Epistemic) : string =
        match e with
        | Known -> "known"
        | Unknown -> "unknown"
        | Assumed -> "assumed"
        | Disputed -> "disputed"
        | Decided -> "decided"

    /// A lap measurement as one canonical text line. Deterministic: same measurement ⇒ same bytes.
    /// Delta entries are emitted in the Z-set's own canonical (ordinal) key order. The full five-way
    /// census is in the line, so the irreversible G-set record never loses the uncollapsed state.
    let encodeMea (m: Mea<'Q>) : string =
        let sign =
            match m.Sign with
            | Reduced -> "-"
            | Increased -> "+"
            | Unchanged -> "="

        let delta =
            m.Delta
            |> Seq.map (fun e -> sprintf "%A/%s=%d" e.Key.Question (stateText e.Key.State) e.Weight)
            |> String.concat ","

        sprintf
            "lap:%d\t%s\t%s\t[%s]->[%s]\t%s"
            m.Lap
            sign
            m.Oracle
            (censusText m.Before)
            (censusText m.After)
            delta

    /// A whole run as canonical text — the byte-lock surface a DST replay assertion compares.
    let encodeRun (r: Run<'S, 'Q>) : string =
        let header =
            sprintf "room:%s\tseed:%d\t%s" r.Room r.Seed (describeBudget r.Budget)

        let stopped =
            match r.Stopped with
            | SimLoop.CutChoseClose -> "stopped:cut-chose-close"
            | SimLoop.LapBudget -> "stopped:lap-budget"
            | SimLoop.TickBudget -> "stopped:tick-budget"
            | SimLoop.ClockBudget -> "stopped:clock-budget"
            | SimLoop.RoomError e -> sprintf "stopped:room-error:%A" e

        let net =
            match r.Net with
            | Reduced -> "net:-"
            | Increased -> "net:+"
            | Unchanged -> "net:="

        (header :: (r.Laps |> List.map encodeMea))
        @ [ sprintf "final:[%s]" (censusText r.FinalCensus); net; stopped ]
        |> String.concat "\n"

    // ── `mea` — the G-set write (grow-only: the past cannot be un-happened) ──────────────────────

    /// Fold lap measurements into the grow-only ledger. Union semantics, so applying it twice is
    /// applying it once (§12 idempotency) and lap arrival order cannot change the result (the
    /// commutativity `db/uncertainty/README.md` requires of anything crossing a lossy link).
    let ledgerOf (laps: Mea<'Q> list) : GSet<string> =
        laps |> List.map encodeMea |> GSet.ofSeq

    /// Merge two ledgers — the CRDT join. `merge a a = a`; `merge a b = merge b a`.
    let mergeLedgers (a: GSet<string>) (b: GSet<string>) : GSet<string> = a + b

    /// Derive the per-lap measurements from the absolute claim ledgers a run banked. The delta is
    /// COMPUTED (`after − before`), never carried in a mutable closure — so a replay recomputes it
    /// identically instead of trusting an accumulator (§3 weight-free, §7 DST).
    let measureLaps
        (oracle: ResolutionOracle)
        (initial: Uncertainty<'Q>)
        (absolutes: Uncertainty<'Q> list)
        : Mea<'Q> list =
        absolutes
        |> List.mapi (fun i after ->
            let before = if i = 0 then initial else absolutes.[i - 1]

            { Lap = i
              Delta = ZSet.sub after before
              Before = census before
              After = census after
              Oracle = oracle.Name
              Sign = signOf (resolutionScore oracle before) (resolutionScore oracle after) })

    // ── `cut` — the boundary decision on the Z-set (the reversible present) ──────────────────────

    /// The default `cut`: keep going while the room still holds a claim it has not resolved to
    /// `Known` or `Decided`. Note what this does NOT do — it does not *set* any claim's state, so it
    /// cannot collapse the ledger; it only reads it to decide whether to run another lap. Callers may
    /// inject any other cut. It is not a rail either way: the three finite budget rails bound the run
    /// regardless of what a cut decides.
    let cutWhenResolved (u: Uncertainty<'Q>) (_state: 'S) : bool =
        u
        |> Seq.exists (fun e ->
            e.Weight <> 0L
            && match e.Key.State with
               | Known
               | Decided -> false
               | Unknown
               | Assumed
               | Disputed -> true)

    // ── The default adapter ──────────────────────────────────────────────────────────────────────

    /// The default `sim` — the existing bounded room loop (`SimLoop.run`, DoP=1, three finite rails)
    /// with `mea` fixed to the five-way uncertainty lens and the ledger folded G-set-wise. No new
    /// loop, no new scheduler, no `Task.Run`: a measurement shape over the runner that already exists.
    let sim: ISimVerb =
        { new ISimVerb with
            member _.Sim<'S, 'Q when 'Q: comparison>(room: Room<'S, 'Q>, seed: int64) =
                task {
                    let ctx: IntrCtx =
                        { Memetic = "sim:" + room.Name
                          Prompt = ""
                          Trust = ""
                          Log = ""
                          Otel = System.Diagnostics.ActivityContext() }

                    let initial = room.Initial seed
                    let initialLedger = room.Ledger initial

                    let! outcome =
                        SimLoop.run
                            room.Handlers
                            (room.Source seed)
                            room.Ledger // mea: the lap's ABSOLUTE five-way claim ledger
                            cutWhenResolved // cut: continue while an unresolved claim remains
                            room.Clock // the injected generator clock — never ambient
                            room.Budget.Limits
                            ctx
                            seed
                            room.TicksPerLap
                            initial

                    let absolutes = outcome.Laps |> List.map (fun l -> l.Measured)
                    let laps = measureLaps room.Oracle initialLedger absolutes
                    let finalLedger = room.Ledger outcome.Final

                    let net =
                        signOf (resolutionScore room.Oracle initialLedger) (resolutionScore room.Oracle finalLedger)

                    return
                        { Room = room.Name
                          Seed = seed
                          Laps = laps
                          Ledger = ledgerOf laps
                          Stopped = outcome.Stopped
                          Final = outcome.Final
                          FinalCensus = census finalLedger
                          Net = net
                          Oracle = room.Oracle.Name
                          Budget = room.Budget }
                } }

    /// Run a room on the default `sim` adapter (the common path).
    let run (r: Room<'S, 'Q>) (seed: int64) : Task<Run<'S, 'Q>> = sim.Sim(r, seed)
