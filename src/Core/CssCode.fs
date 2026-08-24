namespace Zeta.Core

open System
open System.Globalization
open System.Numerics
open System.Security.Cryptography
open System.Text

/// **CssCode — the classical layer of the QEC stack (milestone M1).**
///
/// Implements the routing verdict of
/// `docs/research/2026-08-23-qec-stack-routing-the-adinkra-bridge-closes-at-n8-and-reopens-at-n16-soraya.md`
/// (Soraya, work-item `081M0QFQTS1087G0R002WHZFR7`). That doc computed its algebra in a scratch
/// script **outside the tree** and labelled itself `unmetered` for exactly that reason. This module
/// is where those enumerations become code a test can fail.
///
/// ── REGISTER: WEAK / STRUCTURAL, and the line is drawn on purpose ────────────────────────────────
/// Everything here is **linear algebra over GF(2)**. Not one line of it is a claim that physical
/// quantum effects occur anywhere in Zeta. The CSS construction (Calderbank–Shor 1996, Steane 1996)
/// is a *recipe that takes two classical binary codes and reports the parameters* `[[n, k, d]]` of
/// the stabiliser code they would define. Running the recipe is arithmetic; it is checkable and it
/// is what this repo can earn. Actually *holding* an encoded qubit is a physical claim and is
/// **not** made here, is not implied here, and would need a device this repo does not have.
///
/// The distinction is load-bearing rather than decorative: `k_q` below is an integer produced by
/// `2·dim C − n`, and every property proven about it is a property of that integer.
///
/// ── THE CONVENTION, stated once because two are in circulation ───────────────────────────────────
/// For a single classical code `C ⊆ GF(2)^n` with **`C^⊥ ⊆ C`**, the CSS construction yields
///
///     CSS(C, C) = [[n, 2·dim(C) − n, d]]   where  d = min weight over  C \ C^⊥
///
/// (Nielsen–Chuang states the same object as `CSS(C₁, C₂)` with `C₂ ⊂ C₁` giving `[[n, k₁ − k₂, d]]`;
/// taking `C₁ = C`, `C₂ = C^⊥` makes them the same formula. Mixing the two conventions is the most
/// common way to get `k` wrong by a factor, so only the first is used in this module.)
///
/// **The k=0 theorem, which is why the adinkra lineage does not hand us a quantum code.**
/// A self-dual code has `dim C = n/2` by definition, hence `k_q = 2·(n/2) − n = 0` **identically** —
/// not for our code, for *every* self-dual code at *every* length. `AdinkraCode.generator` is the
/// [8,4] extended Hamming code, doubly-even and self-dual, so `CSS = [[8,0,4]]`: a stabiliser
/// *state*, encoding nothing. See `adinkraClosureLength8` for the exhaustive version of this.
///
/// **Where it reopens.** `RM(1,4)` is doubly-even and self-orthogonal but *not* self-dual (dim 5 of
/// 16), and `RM(1,4)^⊥ = RM(2,4)` exactly, so `CSS(RM(2,4), RM(2,4)) = [[16,6,4]]` — six logical
/// qubits, distance 4 — and its defining code stays inside the adinkra category. `[[16,6,4]]` is a
/// **known** quantum Reed–Muller code (Calderbank–Shor 1996; Steane 1996), not a coinage; what is
/// ours is only the observation about which member of the adinkra family it is.
///
/// Anchors (Beacon): Calderbank & Shor, *Good quantum error-correcting codes exist* (PRA 54, 1996);
/// Steane, *Multiple particle interference and quantum error correction* (Proc. R. Soc. A 452, 1996);
/// Calderbank, Rains, Shor & Sloane, *Quantum error correction and orthogonal geometry* (PRL 78,
/// 1997); Doran, Faux, Gates, Hübsch, Iga & Landweber, *Relating doubly-even error-correcting codes,
/// graphs, and irreducible representations of N-extended supersymmetry* (J. Phys. A 41, 2008,
/// arXiv:0806.0051); Gleason / Mallows–Sloane (doubly-even self-dual codes exist only at length ≡ 0
/// mod 8 — which is why the ladder's rungs are 8, 16, 24 and nothing between); Muller (1954) and
/// Reed (1954) for the Reed–Muller family.
[<RequireQualifiedAccess>]
module CssCode =

    /// Maximum supported code length. Codewords are `int` bitmasks, so the ceiling is the width of
    /// the mask; 30 keeps every intermediate positive and every `1 <<< n` in range.
    [<Literal>]
    let MaxLength = 30

    /// Hamming weight of a codeword-as-bitmask.
    let weight (v: int) : int = BitOperations.PopCount(uint32 v)

    /// GF(2) inner product: `1` when the two words overlap in an odd number of positions.
    let dot (a: int) (b: int) : int = (weight (a &&& b)) % 2

    /// The linear span of a basis over GF(2) — every XOR-combination of the given rows.
    /// Rows need not be independent; the result is the subspace either way.
    let span (basis: int seq) : Set<int> =
        basis
        |> Seq.fold
            (fun (acc: Set<int>) b -> Set.union acc (acc |> Set.map (fun s -> s ^^^ b)))
            (Set.singleton 0)

    /// `dim C = log₂ |C|` — well-defined because a GF(2) subspace always has cardinality `2^k`.
    /// Raises when handed a set that is not a subspace, which is a defect rather than an input.
    let dimension (code: Set<int>) : int =
        let size = Set.count code
        if size = 0 || (size &&& (size - 1)) <> 0 then
            invalidArg "code" (String.Format(CultureInfo.InvariantCulture, "not a GF(2) subspace: |C| = {0} is not a power of two", size))
        BitOperations.Log2(uint32 size)

    /// The dual code `C^⊥ = { v : v · c = 0 for all c ∈ C }`, computed by exhausting `GF(2)^n`.
    /// Exhaustive on purpose: at the lengths this module targets (8 and 16) it is `2^16` dot
    /// products at worst, and an exhaustion cannot be subtly wrong the way a rank computation can.
    let dual (n: int) (code: Set<int>) : Set<int> =
        if n < 0 || n > MaxLength then invalidArg "n" "length out of range"
        seq { 0 .. (1 <<< n) - 1 }
        |> Seq.filter (fun v -> code |> Set.forall (fun c -> dot v c = 0))
        |> Set.ofSeq

    /// **Doubly-even**: every codeword has weight ≡ 0 (mod 4). This is the defining property of the
    /// adinkra category under Doran–Faux–Gates–Hübsch–Iga–Landweber.
    let isDoublyEven (code: Set<int>) : bool =
        code |> Set.forall (fun c -> weight c % 4 = 0)

    /// **Self-orthogonal**: `C ⊆ C^⊥`. Checked directly against every pair rather than inferred from
    /// doubly-evenness, so that `doublyEvenImpliesSelfOrthogonal` below is a *result* and not a
    /// restatement of how it was computed.
    let isSelfOrthogonal (code: Set<int>) : bool =
        code |> Set.forall (fun a -> code |> Set.forall (fun b -> dot a b = 0))

    /// **Self-dual**: `C = C^⊥` as sets. The `k_q = 0` theorem is a corollary of this predicate.
    let isSelfDual (n: int) (code: Set<int>) : bool =
        Set.isEmpty (Set.difference (dual n code) code) && Set.isEmpty (Set.difference code (dual n code))

    /// Minimum nonzero Hamming weight — the classical distance. `None` for the zero code, which has
    /// no nonzero codeword and therefore no distance (rather than distance 0, which would be a lie).
    let minimumDistance (code: Set<int>) : int option =
        code |> Set.filter (fun c -> c <> 0) |> Set.toList |> function
        | [] -> None
        | nonzero -> Some(nonzero |> List.map weight |> List.min)

    /// The weight distribution as `(weight, count)` pairs, ascending. The compact invariant that
    /// discriminates codes which merely share a dimension.
    let weightDistribution (code: Set<int>) : (int * int) list =
        code
        |> Set.toList
        |> List.countBy weight
        |> List.sortBy fst

    // ── Reed–Muller ─────────────────────────────────────────────────────────────────────────────

    /// `RM(r, m)` — the binary Reed–Muller code of order `r` and length `n = 2^m`, built from the
    /// **monomial basis**: one generator per subset `S ⊆ {0..m-1}` with `|S| ≤ r`, whose value at
    /// evaluation point `p ∈ GF(2)^m` is `∏_{i∈S} p_i`. Built from the definition rather than from a
    /// committed matrix, so the construction itself is what the tests check.
    ///
    /// `dim RM(r,m) = Σ_{i≤r} C(m,i)`; `RM(r,m)^⊥ = RM(m−r−1, m)`. Neither identity is assumed
    /// anywhere in this module — both are *verified* by `CssCode.Tests`.
    let reedMuller (r: int) (m: int) : Set<int> =
        if m < 0 || (1 <<< m) > MaxLength then invalidArg "m" "RM length out of range"
        if r < 0 then invalidArg "r" "order must be non-negative"
        let n = 1 <<< m
        let variableSubsets =
            seq { 0 .. (1 <<< m) - 1 }
            |> Seq.filter (fun s -> weight s <= r)
        let monomial (s: int) =
            let mutable v = 0
            for p in 0 .. n - 1 do
                // the monomial is 1 at p exactly when p has a 1 in every variable named by s
                if (p &&& s) = s then v <- v ||| (1 <<< p)
            v
        variableSubsets |> Seq.map monomial |> span

    // ── The CSS construction ────────────────────────────────────────────────────────────────────

    /// Parameters of a stabiliser code: `[[n, k, d]]`.
    /// **Structural register.** These are three integers derived from a binary code by arithmetic.
    /// They describe the code a device *would* implement; they do not assert that one exists here.
    type CssParams =
        { /// Physical qubits — the length of the defining classical code.
          N: int
          /// Logical qubits, `k = 2·dim(C) − n`.
          K: int
          /// Distance. `min weight over C \ C^⊥` when `k > 0`. When `k = 0` there are no logical
          /// operators to have a weight, so the reported value is the min nonzero weight of `C`
          /// itself — the conventional reading for a stabiliser *state*, flagged by `IsState`.
          D: int
          /// `true` when `k = 0`: a stabiliser state, not a code. Kept as an explicit field so a
          /// consumer cannot silently read a state's `D` as a code's distance.
          IsState: bool }

    /// CSS parameters of `CSS(C, C)` for a code satisfying `C^⊥ ⊆ C`.
    /// Returns `None` when the containment fails — the construction is simply not defined there, and
    /// returning `None` rather than a plausible-looking triple is the point.
    let cssFromContainingDual (n: int) (c: Set<int>) : CssParams option =
        let d = dual n c
        if not (Set.isSubset d c) then
            None
        else
            let k = 2 * dimension c - n
            let logicalCoset = Set.difference c d
            if Set.isEmpty logicalCoset then
                // C = C^⊥ (self-dual) ⇒ k = 0 ⇒ a stabiliser state.
                match minimumDistance c with
                | Some dist -> Some { N = n; K = k; D = dist; IsState = true }
                | None -> None
            else
                let dist = logicalCoset |> Set.toList |> List.map weight |> List.min
                Some { N = n; K = k; D = dist; IsState = (k = 0) }

    /// The CSS parameters of the code defined by a **doubly-even self-orthogonal** code `C`, i.e.
    /// `CSS(C^⊥, C^⊥)`. This is the adinkra-category form: `C` is the adinkra's own code, and the
    /// stabiliser code is built from its dual. Yields `[[n, n − 2·dim(C), d]]`.
    ///
    /// **Note on the guard, recorded because mutation testing surfaced it.** The
    /// `isSelfOrthogonal` check below is *provably redundant*: `cssFromContainingDual n (dual n c)`
    /// tests `(C^⊥)^⊥ ⊆ C^⊥`, and because the dual map is an involution on subspaces
    /// (`CssCode.Tests`: "dual is an involution") that is literally `C ⊆ C^⊥`, i.e.
    /// self-orthogonality. So a mutation deleting this guard **survives the test suite by
    /// mathematics, not by test weakness** — the involution test is the proof of the equivalence.
    /// It is kept for the named early refusal, and the redundancy is stated rather than hidden.
    let cssFromAdinkraCode (n: int) (c: Set<int>) : CssParams option =
        if not (isSelfOrthogonal c) then None else cssFromContainingDual n (dual n c)

    // ── The N=8 closure — the load-bearing NEGATIVE ─────────────────────────────────────────────

    /// Every doubly-even code of length 8, enumerated by growing bases over the 72 doubly-even
    /// vectors and deduplicating on the resulting subspace. Returns one entry per *distinct code*.
    let allDoublyEvenCodesLength8 () : Set<int> list =
        let n = 8
        let doublyEvenVectors =
            [ 0 .. (1 <<< n) - 1 ] |> List.filter (fun v -> weight v % 4 = 0)
        let seen = System.Collections.Generic.HashSet<string>(StringComparer.Ordinal)
        let results = ResizeArray<Set<int>>()
        let key (code: Set<int>) =
            code |> Set.toList |> List.map (fun c -> c.ToString(CultureInfo.InvariantCulture)) |> String.concat ","
        let rec grow (code: Set<int>) =
            if seen.Add(key code) then
                results.Add code
                for v in doublyEvenVectors do
                    if v <> 0 && not (Set.contains v code) then
                        let extended = Set.union code (code |> Set.map (fun c -> c ^^^ v))
                        if isDoublyEven extended then grow extended
        grow (Set.singleton 0)
        List.ofSeq results

    /// **The closure table.** For each dimension `0..4`, the *best achievable* distance over all
    /// doubly-even codes of length 8, with the CSS parameters that dimension yields.
    ///
    /// > **The result, and the reason it stops a roadmap.** Over `CSS(C^⊥, C^⊥)` for `C` a
    /// > doubly-even code of length 8 — which **is** the adinkra category at N=8 — there is no code
    /// > that both encodes a qubit and corrects an error. You get `d = 4` with `k = 0`, or `k > 0`
    /// > with `d ≤ 2`. Five rows, and no sixth.
    ///
    /// **The domain is exactly that and no wider.** This does NOT range over all 8-qubit stabiliser
    /// codes. `[[8,3,3]]` (Calderbank–Rains–Shor–Sloane 1997) encodes 3 qubits and corrects 1 error
    /// and beats every row here — but its stabiliser does not split into an X-part and a Z-part, so
    /// it comes from no binary code at all and is not an adinkra object. That code is **cited, not
    /// computed**: nothing in this module enumerates the non-CSS stabiliser space.
    ///
    /// The `dim C = 0` row is the **uncoded** adinkra — the full 8-cube, the second adinkra family,
    /// the homoiconic one. It is required rather than optional: omitting it as degenerate is what
    /// makes the table look like it has a missing escape hatch. It has none; `[[8,8,1]]` is the
    /// *worst* row, because homoiconicity is bought by declining exactly the quotient that
    /// protection lives in.
    let adinkraClosureLength8 () : (int * CssParams) list =
        let n = 8
        allDoublyEvenCodesLength8 ()
        |> List.choose (fun c ->
            cssFromAdinkraCode n c |> Option.map (fun p -> dimension c, p))
        |> List.groupBy fst
        |> List.map (fun (dim, entries) ->
            dim, entries |> List.map snd |> List.maxBy (fun p -> p.D))
        |> List.sortBy fst

    // ── Puncture: Steane's classical ingredient, from our own committed generator ────────────────

    /// Delete coordinate `pos` from every codeword, shortening the length by one.
    let puncture (pos: int) (code: Set<int>) : Set<int> =
        if pos < 0 || pos >= MaxLength then invalidArg "pos" "coordinate out of range"
        let lowMask = (1 <<< pos) - 1
        code |> Set.map (fun c -> (c &&& lowMask) ||| ((c >>> (pos + 1)) <<< pos))

    // ── Stabiliser rows and syndromes (the classical half of the quantum layer) ──────────────────

    /// A basis of the code, in row-echelon form over GF(2) — the rows a parity-check or generator
    /// matrix would carry. Deterministic: the echelon pivot order is fixed by coordinate index, so
    /// the same code always yields the same rows in the same order across oracles. That determinism
    /// is what makes the golden vectors byte-lockable rather than merely equal-up-to-basis.
    let echelonBasis (n: int) (code: Set<int>) : int list =
        if n < 0 || n > MaxLength then invalidArg "n" "length out of range"
        // Standard GF(2) Gaussian elimination: `pivots.[b]` holds the unique reduced row whose
        // leading (highest set) bit is `b`. Inserting in ascending codeword order makes the result
        // a function of the code alone, not of the order the codewords were produced in.
        let pivots : int option[] = Array.create (n + 1) None
        for word in code |> Set.toList |> List.sort do
            let mutable v = word
            while v <> 0 && (pivots.[BitOperations.Log2(uint32 v)]).IsSome do
                v <- v ^^^ (pivots.[BitOperations.Log2(uint32 v)]).Value
            if v <> 0 then
                let p = BitOperations.Log2(uint32 v)
                // BACK-SUBSTITUTE, which is what makes the form REDUCED rather than merely echelon:
                // clear this pivot's bit from every row already recorded. Without this step the rows
                // still span the code and still have distinct leading bits — a mutation that drops
                // it survives every "is it a basis" assertion — but they are no longer a function of
                // the code alone in the strong sense, and `isReducedEchelon` below is what fails.
                for b in 0 .. n do
                    match pivots.[b] with
                    | Some r when (r &&& (1 <<< p)) <> 0 -> pivots.[b] <- Some(r ^^^ v)
                    | _ -> ()
                pivots.[p] <- Some v
        [ for b in n .. -1 .. 0 do
            match pivots.[b] with
            | Some r -> yield r
            | None -> () ]

    /// `true` when `rows` are in **reduced** row echelon form: strictly decreasing leading bits, and
    /// each leading bit set in exactly one row. This is the property that makes `echelonBasis` a
    /// function of the code alone — and therefore the property the golden vectors depend on.
    let isReducedEchelon (rows: int list) : bool =
        let leads = rows |> List.map (fun r -> BitOperations.Log2(uint32 r))
        let strictlyDecreasing = leads = (leads |> List.sortDescending) && leads = List.distinct leads
        let pivotIsolated =
            leads |> List.forall (fun p ->
                rows |> List.filter (fun r -> (r &&& (1 <<< p)) <> 0) |> List.length = 1)
        not (List.contains 0 rows) && strictlyDecreasing && pivotIsolated

    /// The syndrome of an error pattern against a list of check rows, packed as a bitmask whose
    /// bit `i` is the parity `rows[i] · err`.
    let syndrome (rows: int list) (err: int) : int =
        rows
        |> List.mapi (fun i r -> if dot r err = 1 then 1 <<< i else 0)
        |> List.fold (|||) 0

    // ── Hex serialisation — verification artefacts are TEXT ─────────────────────────────────────
    //
    // `.claude/rules/no-binary-in-proof-lineage.md`: golden vectors are hex-in-JSON so every
    // byte-lock change is a readable diff, replays deterministically, and stays mergeable.

    /// A codeword as fixed-width lowercase hex, big-endian, four hex digits per 16 bits of length.
    /// Fixed width so that lexicographic order over the strings matches numeric order over the
    /// codewords — the canonical order the digest below depends on.
    let toHex (n: int) (v: int) : string =
        let digits = max 2 (((n + 7) / 8) * 2)
        v.ToString("x" + digits.ToString(CultureInfo.InvariantCulture), CultureInfo.InvariantCulture)

    /// **The canonical digest of a code** — SHA-256 over every codeword in ascending order, each
    /// rendered by `toHex`, comma-separated. A single wrong, missing or extra codeword changes the
    /// digest, so one 64-character string pins all 2048 codewords of `RM(2,4)` in a diffable line
    /// instead of a 2048-entry array nobody would read.
    ///
    /// Honest limit, because a digest is exactly the kind of artefact that can become unfalsifiable:
    /// a digest pins a set but *explains* nothing, so it is committed **alongside** the weight
    /// distribution and the derived parameters, never instead of them. A mismatch tells you the code
    /// changed; the human-readable rows tell you how.
    let digest (n: int) (code: Set<int>) : string =
        let payload =
            code |> Set.toList |> List.sort |> List.map (toHex n) |> String.concat ","
        use sha = SHA256.Create()
        sha.ComputeHash(Encoding.UTF8.GetBytes payload)
        |> Array.map (fun b -> b.ToString("x2", CultureInfo.InvariantCulture))
        |> String.concat ""
