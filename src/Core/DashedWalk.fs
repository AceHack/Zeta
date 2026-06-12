namespace Zeta.Core

/// DashedWalk — **REPORT #5's restricted span, executable**: the bridge between braid words and
/// adinkra dashings, built exactly where the math team said it lives (and nowhere it said it
/// doesn't).
///
/// The span (math REPORT #5 §4):
///
///     DashedWords₃₂ (Eulerian signed color words on Q₄, allFacesOdd)
///        /                                   \
///   σ-substitution (word → braid)        forget order (word → dashing)
///
/// A braid letter c (±1..±4) walks the N=4 hypercube: color i = |c|−1 flips bit i from the
/// current vertex, and the letter's SIGN is deposited on the traversed edge (negative = dashed —
/// ferry 18 §4's "the dotted lines are the over/under"). Honest bounds carried from REPORT #5:
/// generic words conflict or miss the dashing family (codimension 17 — only 2¹⁵ of 2³² total
/// sign assignments are dashings); the words that DO land are exactly the Eulerian
/// serializations of valid dashings, which `serialize` produces and `walk` round-trips. The
/// sign record is WORD data, not braid data (H₁(Bₙ) = ℤ — `Braid.signedPairLoad`'s caveat).
[<RequireQualifiedAccess>]
module DashedWalk =

    /// A partial signed edge assignment from a walk: edge → isDashed (sign = −1).
    type Assignment = Map<AdinkraViz.Edge, bool>

    /// Walk a braid word over Q₄ from vertex 0, depositing each letter's sign on its edge.
    /// Returns the final vertex + assignment, or the first CONFLICT (an edge revisited with the
    /// opposite sign) — the refusal carries the edge and both signs (decline-don't-coerce).
    let walk (word: int list) : Result<int * Assignment, string> =
        let step (state: Result<int * Assignment, string>) (c: int) =
            match state with
            | Error _ -> state
            | Ok(v, acc) ->
                if c = 0 || abs c > 4 then
                    Error(sprintf "letter %d out of range for Q4 (need ±1..±4)" c)
                else
                    let bit = abs c - 1
                    let lower = (if v &&& (1 <<< bit) = 0 then v else v ^^^ (1 <<< bit)), bit
                    let dashed = c < 0
                    match acc.TryFind lower with
                    | Some prior when prior <> dashed ->
                        Error(sprintf "conflict at edge (v=%d, bit=%d): walked with both signs" (fst lower) bit)
                    | _ -> Ok(v ^^^ (1 <<< bit), acc.Add(lower, dashed))

        word |> List.fold step (Ok(0, Map.empty))

    /// A TOTAL assignment (all 32 edges) read as a dashing (the dashed-edge set).
    /// Partial assignments are refused — a dashing is a statement about every edge.
    let toDashing (a: Assignment) : Result<AdinkraViz.Dashing, string> =
        if a.Count <> List.length AdinkraViz.allEdges then
            Error(sprintf "assignment covers %d of 32 edges — not total" a.Count)
        else
            Ok(a |> Map.toList |> List.filter snd |> List.map fst |> Set.ofList)

    /// Eulerian serialization of a dashing: a length-32 braid word covering every Q₄ edge exactly
    /// once (Hierholzer — Q₄ is connected and 4-regular, so a circuit from vertex 0 exists), each
    /// letter signed by the dashing (dashed → negative). This is the span's apex element for d.
    let serialize (d: AdinkraViz.Dashing) : int list =
        // Hierholzer: walk unused edges until stuck (returns to start in an even graph), splice.
        let mutable unused = Set.ofList AdinkraViz.allEdges
        let edgeAt (v: int) (bit: int) : AdinkraViz.Edge =
            (if v &&& (1 <<< bit) = 0 then v else v ^^^ (1 <<< bit)), bit

        let rec cycleFrom (v: int) : int list =
            // greedy closed trail from v over unused edges, recorded as vertices visited
            let mutable path = [ v ]
            let mutable cur = v
            let mutable go = true
            while go do
                match [ 0 .. 3 ] |> List.tryFind (fun bit -> unused.Contains(edgeAt cur bit)) with
                | Some bit ->
                    unused <- unused.Remove(edgeAt cur bit)
                    cur <- cur ^^^ (1 <<< bit)
                    path <- cur :: path
                | None -> go <- false
            List.rev path

        // build the full circuit by splicing sub-cycles at vertices with unused edges
        let rec splice (circuit: int list) : int list =
            match circuit |> List.tryFindIndex (fun v -> [ 0 .. 3 ] |> List.exists (fun bit -> unused.Contains(edgeAt v bit))) with
            | None -> circuit
            | Some idx ->
                let v = circuit.[idx]
                let sub = cycleFrom v
                // splice sub (v ... v) into circuit at idx
                splice (List.take idx circuit @ sub @ List.skip (idx + 1) circuit)

        let circuit = splice (cycleFrom 0)
        // vertices → letters: consecutive pair differs in one bit; sign from the dashing
        circuit
        |> List.pairwise
        |> List.map (fun (a, b) ->
            let bit = System.Numerics.BitOperations.TrailingZeroCount(uint (a ^^^ b))
            let c = bit + 1
            if AdinkraViz.isDashed d a bit then -c else c)

    // ── The face system over GF(2): the codimension-17 theorem, computed exactly ─────────────
    // Unknowns: 32 edge-dash bits. Equations: each of the 24 two-colored faces has ODD dash
    // count (the Gates condition). REPORT #5: rank = 17, solution dimension = 15 (2¹⁵ dashings).

    /// The 24 distinct 2-colored faces of Q₄: colors i<j and a corner v with bits i,j clear.
    let faces : (int * int * int) list =
        [ for i in 0 .. 3 do
            for j in i + 1 .. 3 do
                for v in 0 .. 15 do
                    if v &&& (1 <<< i) = 0 && v &&& (1 <<< j) = 0 then yield v, i, j ]

    /// Each face as a GF(2) row over the 32 edges (bitmask in edge order), RHS = 1 (odd).
    let private faceRow (v: int, i: int, j: int) : uint64 =
        let edgeIndex =
            AdinkraViz.allEdges |> List.mapi (fun k e -> e, k) |> Map.ofList
        let canon (v: int) (bit: int) = (if v &&& (1 <<< bit) = 0 then v else v ^^^ (1 <<< bit)), bit
        let vi = v ^^^ (1 <<< i)
        let vj = v ^^^ (1 <<< j)
        [ canon v i; canon vi j; canon vj i; canon v j ]
        |> List.fold (fun acc e -> acc ||| (1UL <<< edgeIndex.[e])) 0UL

    /// GF(2) rank of the 24-face system (Gaussian elimination on 64-bit row masks — exact
    /// integer arithmetic, no floats; the no-binary-in-proof-lineage carrier for linear algebra).
    /// Each pivot is stored at its LOWEST set bit; reducing a row ascending-bit-wise clears every
    /// covered bit (a pivot's lower bits are clear by construction, so each XOR only touches
    /// bits ≥ the pivot position).
    let faceSystemRank : int =
        let pivotAt = Array.create 32 0UL
        let mutable rank = 0
        for row in faces |> List.map faceRow do
            let mutable r = row
            for bit in 0 .. 31 do
                if r &&& (1UL <<< bit) <> 0UL && pivotAt.[bit] <> 0UL then
                    r <- r ^^^ pivotAt.[bit]
            if r <> 0UL then
                let lead = [ 0 .. 31 ] |> List.find (fun b -> r &&& (1UL <<< b) <> 0UL)
                pivotAt.[lead] <- r
                rank <- rank + 1
        rank
