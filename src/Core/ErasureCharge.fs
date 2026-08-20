namespace Zeta.Core

open System
open System.Globalization

/// **`ErasureCharge` — the CHARGE side of the erasure vocabulary. The classification is the
/// source of truth; this module is a fold over it and holds no roster of its own.**
///
/// `ErasureClass` says what an operation *is* — `Reversible`, `Erasing`, or `Unmeasured` — with a
/// measurement behind the claim. It says nothing about what a ledger should *do* about it, and
/// until this module there was nothing that did: the two-ledger tracker
/// (`src/Core.TypeScript/algebra/entropy-tracker.ts`) charged five sites, none of which was a
/// compaction, a snapshot-supersedes-log, an eviction, or a witness mix. A classification nobody
/// charges is a diagnosis with no treatment.
///
/// ## The one design rule: derive, never re-list
///
/// `dispositionOf` reads **only** `Classification` and `Evidence`. It never inspects
/// `Representation`, `Operation`, or `Observation`, and there is deliberately no table here
/// keyed by name. That is not a stylistic preference — it is the whole lesson of the correction
/// that produced this module: a name-keyed list of erasing operations was written twice, was
/// wrong both times, and could not be completed in principle because `TruncateAsync` is `Erasing`
/// under `InMemoryDeltaLog` and `Reversible` under `GitDeltaLog`. A second list is the defect.
/// `ErasureCharge.Laws` pins this by renaming all three string fields of a real profile to
/// garbage and requiring the disposition to be unchanged.
///
/// ## `Unmeasured` does not charge zero, and the type is what enforces it
///
/// An operation nobody has swept has an **unknown** cost. Three treatments were available:
///
/// | option | why not taken |
/// |---|---|
/// | charge `0` | the demon exactly — a channel that reads as free because the ledger is closed |
/// | charge a stated upper bound | there is no upper bound to state without **inventing a coefficient**, which is the toy-presented-as-metered failure this whole thread exists to prevent |
/// | **refuse the fold, and carry the hole in the total's type** | taken |
///
/// So a settled account is a `Reading`, and a `Reading` is either `Complete` — every posting was
/// measured — or `LowerBound`, which carries the measured sum **together with the named holes**.
/// There is no function anywhere in this module that returns the bit total as a bare `int64`, so
/// a caller cannot obtain a number without also learning whether it is the whole cost. That is
/// the same refusal `ErasureClass.bitsErasedPpm` makes one level up by returning `int64 option`
/// rather than defaulting to `0L`, moved to the place where a total is actually formed.
///
/// A `LowerBound` is also the physically correct direction: Landauer's is a **floor**, so
/// "at least this much, plus N operations of unknown cost" is a true statement about the world,
/// whereas any specific larger number would be a guess.
///
/// ## Bits are never summed across observations
///
/// `ZetaFsDeltaLog.TruncateAsync` is `Erasing` through the log's own read surface and
/// `Unmeasured` with respect to the storage medium; `GitDeltaLog.TruncateAsync` is `Erasing`
/// through the read surface and `Reversible` through the commit DAG. Adding those figures would
/// produce a number describing no observer. So an `Account` is a map **keyed by observation**,
/// each with its own `Reading`, and the type offers no way to collapse them. Two honest rows,
/// never one dishonest average.
///
/// ## Fail-closed on a self-contradicting declaration
///
/// A profile declaring `Reversible` while carrying a non-trivial fibre is not free and is not
/// measured — it is broken. `dispositionOf` returns `Malformed`, which lands in the hole set, so
/// a declaration that contradicts itself makes the total a `LowerBound` rather than quietly
/// contributing `0`. `ErasureClass.inconsistencies` reports the same condition to the law pack;
/// this is that refusal, expressed where the money moves.
///
/// Anchors (Beacon): Landauer 1961 (`kT ln 2` per *erased* bit — a floor, hence `LowerBound`);
/// Bennett 1973 (a bijection pays nothing, which is why `Free` requires a measured fibre of 1);
/// Goguen-Meseguer 1982 (noninterference — the ledger is passed, never ambient, so a charge
/// crosses a declared door).
[<RequireQualifiedAccess>]
module ErasureCharge =

    /// What a ledger does with one declared profile. Four cases, and only the first is free.
    [<RequireQualifiedAccess>]
    type Disposition =
        /// Measured injective — fibre 1, exactly 0 bits. Bennett-free, and the *only* route to
        /// zero. Reachable only from a `Reversible` classification backed by a sweep.
        | Free
        /// Measured non-injective — charge the declared, measured `log2(largest fibre)` in ppm.
        /// Always strictly positive; a `Charged 0L` is unrepresentable by construction below.
        | Charged of bitsPpm: int64
        /// No admissible measurement exists. **Not zero, not free.** Carries the written reason
        /// from the declaration so the hole is legible where it surfaces.
        | Unmeasured of reason: string
        /// The declaration contradicts its own evidence. Fails closed into the hole set rather
        /// than contributing nothing.
        | Malformed of complaint: string

    /// The disposition of one profile, derived from `Classification` and `Evidence` **only**.
    ///
    /// The three string fields are never read. A future maintainer who adds a name-based special
    /// case here reintroduces the list this module was built to delete, and the law pack's
    /// rename test goes red the moment they do.
    let dispositionOf (p: ErasureClass.Profile) : Disposition =
        match p.Classification, ErasureClass.largestFibre p, ErasureClass.bitsErasedPpm p with
        | ErasureClass.ThermodynamicClass.Reversible, Some 1, Some 0L -> Disposition.Free
        | ErasureClass.ThermodynamicClass.Erasing, Some fibre, Some ppm when fibre > 1 && ppm > 0L ->
            Disposition.Charged ppm
        | ErasureClass.ThermodynamicClass.Unmeasured, None, None ->
            match p.Evidence with
            | ErasureClass.Evidence.NoAdmissibleMeasurement reason when not (String.IsNullOrWhiteSpace reason) ->
                Disposition.Unmeasured reason
            | _ -> Disposition.Malformed "Unmeasured with no written reason — a hole must say why it is a hole"
        | _ ->
            // Everything else is a declaration at war with its own evidence: Reversible over a
            // wide fibre, Erasing over a fibre of 1, Unmeasured carrying a sweep. Charging any of
            // them would be picking a side in a contradiction.
            Disposition.Malformed(
                String.Format(
                    CultureInfo.InvariantCulture,
                    "classification {0} does not agree with its evidence (fibre={1}, ppm={2})",
                    p.Classification,
                    (match ErasureClass.largestFibre p with
                     | Some f -> f.ToString(CultureInfo.InvariantCulture)
                     | None -> "none"),
                    (match ErasureClass.bitsErasedPpm p with
                     | Some v -> v.ToString(CultureInfo.InvariantCulture)
                     | None -> "none")
                )
            )

    /// A settled total, for **one** observation.
    ///
    /// There is no `int64` accessor beside these two cases on purpose: reading the number and
    /// learning whether it is complete are the same act.
    [<RequireQualifiedAccess>]
    type Reading =
        /// Every posting was measured. The sum is the whole cost under this observation.
        | Complete of bitsPpm: int64
        /// At least one posting had no admissible measurement, or contradicted itself. The sum is
        /// what the *measured* postings cost; `holes` names every operation whose cost is unknown,
        /// keyed by `ErasureClass.key`. Never read the first component alone.
        | LowerBound of bitsPpm: int64 * holes: (string * string) list

    /// Bits-ppm of a reading, and whether that number is the whole story. Provided so a caller
    /// that genuinely wants both can take both in one step — never so it can take the number
    /// alone, which is why the flag is not optional.
    let readingParts (r: Reading) : int64 * bool =
        match r with
        | Reading.Complete bits -> bits, true
        | Reading.LowerBound(bits, _) -> bits, false

    let renderReading (r: Reading) : string =
        match r with
        | Reading.Complete bits ->
            String.Format(CultureInfo.InvariantCulture, "{0} bits-ppm (complete)", bits)
        | Reading.LowerBound(bits, holes) ->
            String.Format(
                CultureInfo.InvariantCulture,
                "at least {0} bits-ppm, plus {1} operation(s) of unknown cost: {2}",
                bits,
                List.length holes,
                String.Join("; ", holes |> List.map fst)
            )

    /// The charge accumulated under ONE declared observation. Immutable; every `post` returns a
    /// new ledger, so it replays deterministically and captures nothing (§7 DST, §3 weight-free).
    [<Sealed>]
    type Ledger private (bitsPpm: int64, charged: int, free: int, holes: Map<string, string>, holePostings: int) =

        static member Empty = Ledger(0L, 0, 0, Map.empty, 0)

        /// Postings whose profile was measured non-injective.
        member _.ChargedPostings = charged
        /// Postings whose profile was measured injective. Zero bits, and *measured* zero.
        member _.FreePostings = free
        /// Postings whose cost is unknown — unmeasured or self-contradicting. Counted as
        /// invocations, so a hole hit a thousand times is visibly not a hole hit once.
        member _.HolePostings = holePostings
        /// The distinct unknown-cost operations seen, keyed by `ErasureClass.key`. A set, so
        /// re-posting the same hole is idempotent in the *identity* register (§12).
        member _.Holes: (string * string) list = holes |> Map.toList

        /// The settled total. `Complete` iff no hole was ever posted.
        member _.Reading: Reading =
            if Map.isEmpty holes then Reading.Complete bitsPpm
            else Reading.LowerBound(bitsPpm, Map.toList holes)

        /// Charge one invocation of the operation this profile describes.
        member _.Post(p: ErasureClass.Profile) : Ledger =
            let k = ErasureClass.key p

            match dispositionOf p with
            | Disposition.Free -> Ledger(bitsPpm, charged, free + 1, holes, holePostings)
            | Disposition.Charged ppm -> Ledger(bitsPpm + ppm, charged + 1, free, holes, holePostings)
            | Disposition.Unmeasured reason ->
                Ledger(bitsPpm, charged, free, Map.add k ("unmeasured: " + reason) holes, holePostings + 1)
            | Disposition.Malformed complaint ->
                Ledger(bitsPpm, charged, free, Map.add k ("malformed: " + complaint) holes, holePostings + 1)

    /// Charges accumulated across several observations, never summed between them.
    ///
    /// `ZetaFsDeltaLog.TruncateAsync` costs 3.700 bits through the log's read surface and an
    /// unknown amount on the physical medium. One number cannot mean both, so there is no
    /// operation on this type that produces one.
    [<Sealed>]
    type Account private (byObservation: Map<string, Ledger>) =

        static member Empty = Account(Map.empty)

        /// The observations this account has seen, ordinally sorted (never a culture collation).
        member _.Observations: string list =
            byObservation |> Map.toList |> List.map fst |> List.sortWith (fun a b -> String.CompareOrdinal(a, b))

        member _.LedgerFor(observation: string) : Ledger option = Map.tryFind observation byObservation

        /// One reading per observation. The plural return type IS the refusal to average.
        member this.Readings: (string * Reading) list =
            this.Observations
            |> List.map (fun o -> o, (Map.find o byObservation).Reading)

        /// Post one invocation, routed to the ledger for the profile's declared observation.
        member _.Post(p: ErasureClass.Profile) : Account =
            let existing =
                Map.tryFind p.Observation byObservation |> Option.defaultValue Ledger.Empty

            Account(Map.add p.Observation (existing.Post p) byObservation)

        member this.PostAll(ps: ErasureClass.Profile seq) : Account =
            ps |> Seq.fold (fun (acc: Account) p -> acc.Post p) this

        /// Every observation whose reading is not `Complete`, with its holes. Empty iff the whole
        /// account is measured.
        member this.IncompleteObservations: (string * (string * string) list) list =
            this.Readings
            |> List.choose (fun (o, r) ->
                match r with
                | Reading.Complete _ -> None
                | Reading.LowerBound(_, holes) -> Some(o, holes))

        member this.Render: string =
            if List.isEmpty this.Readings then
                "no erasure posted"
            else
                this.Readings
                |> List.map (fun (o, r) ->
                    String.Format(CultureInfo.InvariantCulture, "[{0}] {1}", o, renderReading r))
                |> String.concat Environment.NewLine
