namespace Zeta.Core

/// **Traveler frame — Layer-0 of the traveler-self-frame-over-DBSP.**
/// (`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B-frame, Layer 0.)
///
/// A traveler has **no global frame** — no universal clock, no universal identity, perspectival.
/// So it constructs its **own local causal reference frame** incrementally over the DBSP stream:
/// a vector clock `actor → versionstamp` = *"how far I have seen each traveler's timeline."*
/// (Lamport 1978, vector/causal clocks — relative time with no global *now*.)
///
/// **The leg this module discharges** (the one open obligation for Layer-0 promotion, per the
/// register): the **inter-frame transformation law**. In every system that has relative frames —
/// relativity (worldline + tetrad, related by transformations) and distributed systems (causal
/// views, merged) — *the transformation between frames is the content; the axes are secondary.*
/// Here the transformation is the **causal-join** (pointwise `max` = the least upper bound), and the
/// theorem is that it forms a **bounded join-semilattice**: it has an identity (the origin frame ⊥),
/// and is **idempotent, commutative, associative, and monotone**. Therefore the transformation is
/// **order-independent**, and any set of travelers reaches **one common frame** (the LUB) regardless
/// of the order in which views are merged — the **relative-frame consistency law**
/// (= convergence-despite-reordering, applied at the *frame* level).
///
/// Builds entirely on the proven floor: `Versionstamp` (Clock.fs, the per-actor monotone coordinate)
/// and the CRDT join-semilattice (Crdt.fs G-Counter, the same pointwise-`max` algebra). This module
/// lifts that algebra to a first-class *frame* with frame semantics (`observe` / `transform` /
/// `commonFrame` / `dominates`) so the relative-frame *interpretation* is itself a proven primitive.
///
/// Anchors: Lamport (vector clocks); Shapiro et al. (CRDT join-semilattice / state-based convergence);
/// FoundationDB versionstamp (the monotone coordinate); the relativistic frame-transformation lens.
///
/// Scope note (honest, per the register): this discharges the *distributed-systems half* of the
/// transformation law — the monotone join-semilattice. The full relativistic-**group** structure
/// (inverses / boosts) and the **uncertainty-window** combination (CockroachDB HLC) remain §B
/// sub-legs; this is the consistency law, not yet the group law.
[<RequireQualifiedAccess>]
module TravelerFrame =

    /// A traveler's local causal reference frame: per-actor, the furthest versionstamp this traveler
    /// has observed on that actor's timeline. Absent actor = origin (`Versionstamp.zero`), so two
    /// frames over different key-sets compare/merge by treating missing coordinates as ⊥.
    type Frame = { Coords: Map<string, Versionstamp> }

    /// The origin frame ⊥ — the bottom of the semilattice (no traveler seen). Identity of `transform`.
    let origin: Frame = { Coords = Map.empty }

    /// This traveler observes `actor`'s timeline reaching `stamp`. Monotone: a coordinate only ever
    /// advances (`max`) — re-observing an older or equal stamp is a no-op (idempotent at the coord).
    let observe (actor: string) (stamp: Versionstamp) (f: Frame) : Frame =
        let next =
            match Map.tryFind actor f.Coords with
            | Some cur when cur.Version >= stamp.Version -> cur
            | _ -> stamp
        { Coords = Map.add actor next f.Coords }

    /// Read a coordinate (⊥ for an unseen actor).
    let coord (actor: string) (f: Frame) : Versionstamp =
        match Map.tryFind actor f.Coords with
        | Some v -> v
        | None -> Versionstamp.zero

    /// **The inter-frame transformation law** — the causal-join of two frames: the pointwise `max`
    /// over the union of coordinates. This is the least frame dominating both (their LUB) — "the
    /// common frame two travelers agree on after exchanging causal views." Idempotent + commutative
    /// + associative + monotone ⇒ order-independent (proven in TravelerFrame.Tests).
    let transform (a: Frame) (b: Frame) : Frame =
        let keys = Set.union (a.Coords |> Map.toSeq |> Seq.map fst |> Set.ofSeq)
                             (b.Coords |> Map.toSeq |> Seq.map fst |> Set.ofSeq)
        let coords =
            keys
            |> Set.fold (fun acc k ->
                let va = (coord k a).Version
                let vb = (coord k b).Version
                Map.add k (Versionstamp.ofInt64 (max va vb)) acc) Map.empty
        { Coords = coords }

    /// `a` dominates `b` (`a ≥ b`): `a` has seen at least as far as `b` on *every* coordinate —
    /// `a`'s causal view contains `b`'s. The semilattice partial order.
    let dominates (a: Frame) (b: Frame) : bool =
        b.Coords
        |> Map.forall (fun k vb -> (coord k a).Version >= vb.Version)

    /// `a` and `b` are **concurrent** — spacelike / causally incomparable (`a ‖ b`): neither's
    /// causal view contains the other's, i.e. **each has seen something the other has not** (a
    /// genuine fork in the causal DAG). Because the partial order is `dominates`, for any two frames
    /// EXACTLY ONE of the four cells of `(dominates a b, dominates b a) ∈ 𝔹²` holds — equal (mutual
    /// dominance) · `a▷b` · `b▷a` · `a‖b` — and `concurrent` is that last cell. **Symmetric** and
    /// **irreflexive** (a frame never forks itself, since it always dominates itself).
    ///
    /// This is the **sole legal gate for spacelike pair-selection** — e.g. the CHSH
    /// interference-monitor may only fold a commit/message pair into a Bell correlation when the two
    /// are `concurrent`, never when one is causally before the other (that would be a signaling
    /// pair). Concurrency is decided by the **versionstamp partial order ONLY, never by wall-clock**:
    /// two observers with different receive-times must classify the same pair identically
    /// (`local-time-never-enters-the-shared-fold`). This is the distributed-systems reading of
    /// spacelike separation — the light cone drawn by causality, not by any node's clock.
    let concurrent (a: Frame) (b: Frame) : bool =
        not (dominates a b) && not (dominates b a)

    /// The common frame of a set of travelers: fold `transform` from the origin. Because `transform`
    /// is a commutative/associative/idempotent join, this is the LUB and is **independent of the
    /// order** the frames are folded in — the relative-frame consistency law (proven in tests).
    let commonFrame (frames: Frame seq) : Frame =
        Seq.fold transform origin frames
