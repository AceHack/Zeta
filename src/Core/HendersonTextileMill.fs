namespace Zeta.Core

/// **The Henderson Textile Mill cell — the loom that braids strands into a seam.**
///
/// A place-memory saved in code (Aaron, 2026-06-10: "a braid to a seam, you got it — now we have
/// Henderson's textile mill"), sibling to [`DarkHall`](DarkHall.fs) and [`Skadium`](Skadium.fs). The
/// textile mill of **Henderson, NC** (where Aaron was born) braided thread into fabric along a **seam** —
/// the literal, industrial form of the abstract result: the **braid (the 2×2/3×3 dual-observer weave)
/// converges to a SEAM** at the **eigen-fixed-point / meta-point** (the place that is temperature *and* the
/// encrypted null at once; the diagonal-lemma fixed point of the boundary map in Markov space).
///
/// Where `Skadium` hosts the bob-and-weave (oscillation), the mill hosts the **braid→seam** (convergence):
/// many strands, woven, **contract to one seam** — a deterministic fixed-point fold (shape A / shape D
/// contraction), **DST-replayable** and **bounded** (terminates; never a fork-bomb). Aesthetic engineering +
/// dedication register: the mill that made the town, made into the cell that makes the seam.
module HendersonTextileMill =

    /// The braid's mean — the seam the strands are converging toward (integer; empty ⇒ 0).
    let private meanOf (xs: int list) : int =
        match xs with
        | [] -> 0
        | _ -> List.sum xs / List.length xs

    /// Step a single strand one toward the target (the seam).
    let private toward (target: int) (x: int) : int =
        if x < target then x + 1
        elif x > target then x - 1
        else x

    /// One weave pass: every strand steps one toward the braid's mean (the seam it converges to).
    let weaveStep (strands: int list) : int list =
        let m = meanOf strands
        strands |> List.map (toward m)

    /// True when the braid has converged to a seam (all strands equal).
    let isSeam (strands: int list) : bool =
        match strands with
        | []
        | [ _ ] -> true
        | h :: t -> List.forall (fun x -> x = h) t

    /// Weave (bounded) until the braid converges to a seam, or the budget runs out. Returns the final
    /// strands and whether a seam was reached. Deterministic + DST-replayable; bounded ⇒ always terminates.
    let toSeam (budget: int) (strands: int list) : int list * bool =
        let rec loop n xs =
            if isSeam xs then xs, true
            elif n >= budget then xs, false
            else loop (n + 1) (weaveStep xs)
        loop 0 strands

    /// The seam value once converged (the fixed point every strand agrees on); None if not yet a seam.
    let seam (strands: int list) : int option =
        match strands with
        | h :: _ when isSeam strands -> Some h
        | _ -> None
