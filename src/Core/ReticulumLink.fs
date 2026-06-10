namespace Zeta.Core

/// Reticulum-overlay link layer for the DST "can our tests connect" handshake — a
/// DETERMINISTIC, in-process simulation of the network/ Reticulum overlay
/// (network/README.md): destinations are ZetaId-shaped self-certifying addresses;
/// `connect` requires BOTH ends announced (discovery); delivery is ordered and
/// scheduler-stamped so the whole exchange replays from a seed (DST, manifesto spec #7).
///
/// Honest scope (peel): this sims the link IN-PROCESS — DoP=1, no threads, no real
/// I/O — i.e. the deterministic-simulation half of "DST + Reticulum". Wiring to a real
/// RNS daemon over the wire, and to the governed `Zeta.Core.FSharp.ZetaId` minter for
/// the address, is the follow-up. Result-over-exception: the connect path never throws.
///
/// Anchors (Beacon): Reticulum (self-certifying, key-bound destinations; announce /
/// discovery; the overlay in network/README) · ZetaId = the 128-bit destination address
/// · FoundationDB-style deterministic simulation (one seeded loop, replayable) · this
/// module's clock is `Clock.fs` `Scheduler`/`Versionstamp` (the injected DST time).
module ReticulumLink =

    /// A ZetaId-shaped 128-bit self-certifying destination address. Stands in for the
    /// governed `Zeta.Core.FSharp.ZetaId` destination (Reticulum binds address↔key); the
    /// real minter is wired in the follow-up.
    type Destination = { Hi: uint64; Lo: uint64 }

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
