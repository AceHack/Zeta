namespace Zeta.Core

/// **FrameDelta — the transformation group of the traveler frame (Layer-0 group law).**
/// (`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B-frame, Layer 0 — the last sub-leg.)
///
/// `TravelerFrame.transform` (the causal-join) is a join-semilattice: it is the irreversible MERGE by
/// which travelers converge to a common frame — idempotent, monotone, NO inverses (you cannot un-join).
/// The *group* structure lives in a different object: the relative **offset** between two frames. A
/// `Delta` is a per-actor integer shift; the offsets form an **abelian group** under composition
/// (pointwise `+`), with identity (no shift) and inverse (negate), and the group **acts on frames by
/// translation**. This is the discrete analog of the relativistic transformation group — the
/// boost-between-frames that composes, inverts, and associates — as opposed to the merge.
///
/// Honest scope: this is the *abelian translation group* of frame-offsets (the genuine structure a
/// discrete causal/vector-clock frame carries). The full **non-abelian Lorentz** group would require a
/// boost-velocity / metric the discrete causal model does not carry — so the honest group law here is
/// the translation group, named as such, not the Lorentz group. Proven in FrameDelta.Tests: the abelian
/// group axioms (identity/associativity/commutativity/inverse) and the group-action laws
/// (apply identity, apply compose = compose of applies, `between` takes a→b, the cocycle
/// `between a b ∘ between b c = between a c`, and `inverse (between a b) = between b a`).
///
/// Anchors: free abelian group on the actor set (ℤ^actors); group action by translation; relativistic
/// frame-transformation group (the boost analog). Composes [[TravelerFrame]] (the merge/consistency law).
[<RequireQualifiedAccess>]
module FrameDelta =

    /// A relative transformation between traveler frames: a per-actor integer shift. Normalized to drop
    /// zero shifts so structural equality coincides with semantic equality.
    type Delta = { Shifts: Map<string, int64> }

    let private normalize (m: Map<string, int64>) : Map<string, int64> =
        m |> Map.filter (fun _ v -> v <> 0L)

    let private keysOf (d: Delta) : Set<string> =
        d.Shifts |> Map.toSeq |> Seq.map fst |> Set.ofSeq

    let private frameKeys (f: TravelerFrame.Frame) : Set<string> =
        f.Coords |> Map.toSeq |> Seq.map fst |> Set.ofSeq

    /// The shift for an actor (0 if absent).
    let shift (actor: string) (d: Delta) : int64 =
        match Map.tryFind actor d.Shifts with
        | Some v -> v
        | None -> 0L

    /// The identity transformation (no shift) — the group identity.
    let identity: Delta = { Shifts = Map.empty }

    /// Compose two transformations (the group operation): pointwise add of shifts. Abelian.
    let compose (a: Delta) (b: Delta) : Delta =
        let keys = Set.union (keysOf a) (keysOf b)
        { Shifts =
            keys
            |> Set.fold (fun acc k -> Map.add k (shift k a + shift k b) acc) Map.empty
            |> normalize }

    /// The inverse transformation (the group inverse): negate every shift.
    let inverse (d: Delta) : Delta =
        { Shifts = d.Shifts |> Map.map (fun _ v -> -v) |> normalize }

    /// The transformation taking frame `a` to frame `b`: per-actor `b - a`.
    let between (a: TravelerFrame.Frame) (b: TravelerFrame.Frame) : Delta =
        let keys = Set.union (frameKeys a) (frameKeys b)
        { Shifts =
            keys
            |> Set.fold
                (fun acc k -> Map.add k ((TravelerFrame.coord k b).Version - (TravelerFrame.coord k a).Version) acc)
                Map.empty
            |> normalize }

    /// Apply a transformation to a frame (the group action by translation).
    let apply (d: Delta) (f: TravelerFrame.Frame) : TravelerFrame.Frame =
        let keys = Set.union (keysOf d) (frameKeys f)
        { Coords =
            keys
            |> Set.fold
                (fun acc k -> Map.add k (Versionstamp.ofInt64 ((TravelerFrame.coord k f).Version + shift k d)) acc)
                Map.empty }

    /// Semantic frame equality over the union of actors (missing coordinate = origin). Used for the
    /// group-action laws, where applied frames may carry different explicit key-sets.
    let sameFrame (a: TravelerFrame.Frame) (b: TravelerFrame.Frame) : bool =
        Set.union (frameKeys a) (frameKeys b)
        |> Set.forall (fun k -> (TravelerFrame.coord k a).Version = (TravelerFrame.coord k b).Version)
