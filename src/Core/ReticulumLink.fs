namespace Zeta.Core

open Zeta.Core.FSharp.ZetaId

/// Reticulum-overlay link layer for the DST "can our tests connect" handshake — a
/// DETERMINISTIC, in-process simulation of the network/ Reticulum overlay
/// (network/README.md): destinations are GOVERNED ZetaId addresses; `connect` requires
/// BOTH ends announced (discovery); delivery is ordered and scheduler-stamped so the
/// whole exchange replays from a seed (DST, manifesto spec #7).
///
/// Governed ZetaId (no inventing): a `Destination` carries a real 128-bit ZetaId minted
/// by `ZetaIdCodec` (Category.Bus = cross-machine agent comms, #6219). Minting is
/// deterministic in (timestamp, seed, location) via an `ISimulationEnvironment` whose
/// randomness field is a pure function of the seed — so the same seed mints the same
/// ZetaId (the ferry's "128-bit seed → the low-entropy Zeta state"; reproducible).
///
/// Honest scope (peel): the LINK is simulated in-process — DoP=1, no threads, no real
/// I/O — the deterministic-simulation half of "DST + Reticulum"; a real RNS daemon over
/// the wire is the follow-up. Result-over-exception: the connect path never throws.
///
/// Anchors (Beacon): Reticulum (self-certifying key-bound destinations; announce /
/// discovery) · `Zeta.Core.FSharp.ZetaId` (the governed 128-bit minter; Category.Bus) ·
/// FoundationDB-style deterministic simulation · `Clock.fs` Scheduler/Versionstamp.
module ReticulumLink =

    /// A Reticulum destination address — the GOVERNED 128-bit ZetaId (minted by
    /// `ZetaIdCodec`, never fabricated). Use `mint` to create one.
    type Destination = { Id: System.UInt128 }

    /// A packet on the medium, stamped with the deterministic scheduler time at send.
    type Packet = { From: Destination; To: Destination; Payload: string; At: Versionstamp }

    /// Why a connect failed — result-over-exception; no throw on the connect path.
    [<RequireQualifiedAccess>]
    type LinkError = | Unreachable of Destination

    /// An established bidirectional link between two announced destinations.
    type Link = { A: Destination; B: Destination }

    /// The deterministic shared transport: the set of announced destinations + the
    /// ordered in-flight packets. Immutable; every transition returns a new medium.
    type Medium = { Announced: Destination list; InFlight: Packet list }

    /// A seed-derived deterministic simulation environment: the 32-bit ZetaId randomness
    /// field is a pure function of the seed (same seed → same ZetaId). Object expression,
    /// not a class (treaty-room discipline).
    let private envOf (seed: int64) : ISimulationEnvironment =
        { new ISimulationEnvironment with
            member _.NextInt64() = seed }

    /// Mint a GOVERNED Bus-category ZetaId destination from a DST timestamp + seed +
    /// location. Category.Bus is an observation category, so this uses the governed
    /// `ZetaIdCodec.pack` (not `packGeneric`). Authority.Simulated is honest — these are
    /// DST-simulated nodes. Deterministic in (ts, seed, location): same inputs → same
    /// ZetaId; distinct seeds → distinct ZetaIds (the ferry's entropy → identity).
    let mint (ts: Versionstamp) (seed: int64) (location: Location) : Destination =
        let tsMs: int64<ms> =
            LanguagePrimitives.Int64WithMeasure(int64 (uint64 ts.Version &&& 0xFFFFFFFFFFFFUL))
        let obs: ZetaObservation =
            { Version = IdVersion.V1
              Timestamp = tsMs
              Chromosome = Chromosome.MetaCoherence
              Category = Category.Bus
              Firefly = Firefly.Off
              Authority = Authority.Simulated
              Persona = Persona.FireflyCoherence
              Momentum = Momentum.Background
              Location = location }
        { Id = ZetaIdCodec.pack obs (envOf seed) }

    /// The empty medium — nothing announced, nothing in flight.
    let empty: Medium = { Announced = []; InFlight = [] }

    /// Announce a destination so it becomes reachable (discovery). Idempotent —
    /// apply-N-times == apply-once (set-add): re-announcing changes nothing.
    let announce (d: Destination) (m: Medium) : Medium =
        if List.contains d m.Announced then m
        else { m with Announced = m.Announced @ [ d ] }

    /// Is a destination reachable (has it announced)?
    let isReachable (d: Destination) (m: Medium) : bool = List.contains d m.Announced

    /// Connect two destinations. Ok only if BOTH have announced (discovery precondition);
    /// otherwise Error with the first unreachable end. Pure — no time advance, no throw.
    let connect (a: Destination) (b: Destination) (m: Medium) : Result<Link, LinkError> =
        if not (isReachable a m) then Error(LinkError.Unreachable a)
        elif not (isReachable b m) then Error(LinkError.Unreachable b)
        else Ok { A = a; B = b }

    /// Send a payload over an established link, stamping the scheduler's current time and
    /// advancing it one tick (DST: deterministic time progression). Returns the updated
    /// medium and the stepped scheduler.
    let send (from: Destination) (toD: Destination) (payload: string) (s: Scheduler) (m: Medium)
        : Medium * Scheduler =
        let pkt = { From = from; To = toD; Payload = payload; At = s.Now }
        { m with InFlight = m.InFlight @ [ pkt ] }, Scheduler.step s

    /// Drain the packets addressed to a destination, in deterministic (send) order;
    /// returns them and the medium with those packets removed.
    let deliver (d: Destination) (m: Medium) : Packet list * Medium =
        let mine = m.InFlight |> List.filter (fun p -> p.To = d)
        let rest = m.InFlight |> List.filter (fun p -> p.To <> d)
        mine, { m with InFlight = rest }
