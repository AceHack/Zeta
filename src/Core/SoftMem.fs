namespace Zeta.Core

/// **`SoftMem` — soft-Sequoia memory: content addressed by geometric distance (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"Sequoia is a real memory system from Stanford — it uses hard hierarchies for cache and memory. Mine
/// are soft. We can use the same memory model but soft."* **Sequoia** (Fatahalian, Knight, Houston, Erez, Horn
/// et al., *Programming the Memory Hierarchy*, SC 2006) makes the hierarchy explicit: a **tree of discrete
/// levels**, tasks bound to levels, explicit data movement — *hard*. This is the same model softened: the
/// discrete levels become a **continuous geometric distance** (`Cl3.distSq` — the "memory distance"), and a read
/// is **kernel-weighted over all entries by closeness** rather than a hit at one fixed level.
///
/// **The model:**
///   - Each entry has a **position** (a `Cl3` vector — its place in the distance space) and a content `'T`.
///   - **`nearest`** = the hard lookup (closest entry) — Sequoia's "which level" collapsed to a point.
///   - **`softRead τ`** = the *soft* lookup: a distribution over entries with weight `exp(−distSq/τ)` (an RBF /
///     attention kernel). `τ → 0` ⇒ hard nearest; `τ → ∞` ⇒ uniform. This is the soft hierarchy: nearness is
///     graded, not tiered. (Anchor: kernel smoothing / attention / content-addressable memory.)
///   - **`prefetch`** uses **forward momentum** (`Cl3.momentum`): the next access is predicted at
///     `position + momentum`, so prefetch returns the entry nearest the *projected* point — momentum as an
///     eviction/prefetch *direction* in the distance space.
///
/// **Honest scope (peel):** Sequoia's *hardness buys performance portability* — you know exactly where data is
/// and movement is statically analyzable. Softening trades that for continuity: the perf model becomes
/// *probabilistic* (expected distance, not a guaranteed level), and the static movement-cost analysis is lost.
/// Right for *forkable, probabilistic, distance-addressed* memory; wrong for hard real-time placement guarantees.
/// `softRead` is O(n) over all entries (no spatial index yet — a BVH/grid over `Cl3.distSq` is the scaling
/// slice). Euclidean Cl(3,0) distance (flat); conformal CGA is the later upgrade. **Naming:** "Sequoia" is the
/// Stanford system — this is a *soft variant*, not that system; an outward name needs naming-expert + Ilyana.
[<RequireQualifiedAccess>]
module SoftMem =

    /// A distance-addressed soft memory: entries each at a `Cl3` position with content `'T`.
    type SoftMem<'T> = { Entries: (Cl3.Mv * 'T) list }

    let private EPS = 1e-12

    /// The empty memory.
    let empty<'T> : SoftMem<'T> = { Entries = [] }

    /// Store `content` at `position` (a `Cl3` vector). Append — newest last (no dedup; positions may coincide).
    let store (position: Cl3.Mv) (content: 'T) (m: SoftMem<'T>) : SoftMem<'T> =
        { Entries = m.Entries @ [ position, content ] }

    /// Number of entries.
    let count (m: SoftMem<'T>) : int = List.length m.Entries

    /// **Hard lookup:** the content nearest `query` by `Cl3.distSq` (Sequoia's "which level", collapsed). `None`
    /// if empty.
    let nearest (query: Cl3.Mv) (m: SoftMem<'T>) : 'T option =
        match m.Entries with
        | [] -> None
        | es -> es |> List.minBy (fun (p, _) -> Cl3.distSq query p) |> snd |> Some

    /// **Soft lookup:** a normalized distribution over entries, weight `exp(−distSq/τ)` (RBF / attention kernel).
    /// Small `τ` ⇒ sharp (≈ nearest); large `τ` ⇒ diffuse (≈ uniform). The graded soft hierarchy. Empty ⇒ [].
    let softRead (tau: float) (query: Cl3.Mv) (m: SoftMem<'T>) : ('T * float) list =
        let t = max EPS tau
        match m.Entries with
        | [] -> []
        | es ->
            // Stabilized softmax: subtract the min distSq before exp (else small tau underflows all weights to 0).
            let dmin = es |> List.map (fun (p, _) -> Cl3.distSq query p) |> List.min
            let weighted = es |> List.map (fun (p, c) -> c, exp (-(Cl3.distSq query p - dmin) / t))
            let total = weighted |> List.sumBy snd
            if total <= EPS then []
            else weighted |> List.map (fun (c, w) -> c, w / total)

    /// The softmax-weighted *position* actually read for `query` (the soft hierarchy's effective address) —
    /// the kernel-weighted centroid of entry positions. Useful for diagnostics / momentum updates.
    let readPosition (tau: float) (query: Cl3.Mv) (m: SoftMem<'T>) : Cl3.Mv =
        let t = max EPS tau
        match m.Entries with
        | [] -> Cl3.zero
        | es ->
            let dmin = es |> List.map (fun (p, _) -> Cl3.distSq query p) |> List.min
            let weighted = es |> List.map (fun (p, _) -> p, exp (-(Cl3.distSq query p - dmin) / t))
            let total = weighted |> List.sumBy snd
            if total <= EPS then Cl3.zero
            else weighted |> List.fold (fun acc (p, w) -> Cl3.add acc (Cl3.smul (w / total) p)) Cl3.zero

    /// **Forward-momentum prefetch:** predict the next access at `position + momentum` and return the entry
    /// nearest that projected point. Momentum (`Cl3.momentum`) is the access *direction* in the distance space —
    /// the soft analog of a sequential/stride prefetcher. `None` if empty.
    let prefetch (position: Cl3.Mv) (momentum: Cl3.Mv) (m: SoftMem<'T>) : 'T option =
        nearest (Cl3.add position momentum) m

    /// Soft prefetch: the kernel-weighted read at the projected point (a distribution, not a single guess).
    let softPrefetch (tau: float) (position: Cl3.Mv) (momentum: Cl3.Mv) (m: SoftMem<'T>) : ('T * float) list =
        softRead tau (Cl3.add position momentum) m
