namespace Zeta.Core

/// **`CliffordE8BladeMask` — F# second oracle for the E8 blade-mask sandwich measurement.**
///
/// This module is the F# counterpart of `src/Core.TypeScript/algebra/e8-blade-mask-sandwich.ts`.
/// Both implement the same measurement in independent languages; the golden numbers must agree
/// bit-for-bit (integer arithmetic throughout — DST-replayable, byte-lockable).
///
/// **What is measured:** For every ordered pair (A, x) of bridged E8 roots, apply the Cl(3,0)
/// versor sandwich s_A(x) = −A·x·Ã / ⟨A·Ã⟩₀ and count how many images are roots.
///
/// **Golden numbers (banked 2026-08-09, cross-language locked):**
///   - Versor-normed elements: exactly 32 of 240
///   - Versor-normed supports: 8 singletons + {0,3,4,7} + {1,2,5,6}
///   - Versor-normed preserve ALL 240 roots: 32 × 240 = 7,680
///   - Per-A histogram: {0:160, 64:32, 128:16, 240:32}
///   - Integer images: 33,024; root images: 11,776; identity-fixed: 352
///
/// **What distinguishes {0,3,4,7} (computed 2026-08-09):**
/// **What distinguishes the two survivors — I-closure (corrected 2026-08-09, PR #10230):**
/// The correct criterion is CLOSURE UNDER i ↦ i⊕7 (pseudoscalar XOR):
///   XOR-closed subgroup   → 3 matches (under-determined)
///   contains pseudoscalar → 7 matches (far too weak)
///   CLOSED UNDER i ↦ i⊕7 → EXACTLY 2: {0,3,4,7} and {1,2,5,6}  ✔
/// Why closure is right: {1,2,5,6} = 1 ⊕ {0,3,4,7} is the COSET, and I-closure is
/// coset-invariant ({1,2,5,6} is also I-closed) while "contains 7" is not. One criterion,
/// both survivors. Algebraically: in Cl(3,0) ≅ ℂ⊗ℍ, versor-normed ⟺ decomposable in ℂ⊗ℍ,
/// and collinearity forces span(q) = span(p), hence I-closure.
///
/// **Two caveats required before FROZEN-CORE:**
/// 1. "32-element E8 fragment" is wrong twice: not a sub-root-system (reflection closure is
///    D₄⊕D₄ = 48 roots, a Borel–de Siebenthal subsystem), and 32 counts root-vectors not
///    symmetries — the 32 induce only 8 distinct maps, generating a group of order 16 ≅ D₄×C₂.
/// 2. 32 IS LABELLING-DEPENDENT. Across all 8! relabellings: 16 in ~47%, 32 in only ~30%.
///    Only the 16 single blades are invariant. "32" is a fact about this pairing of two
///    coordinate conventions, not about E8 and Cl(3,0) in the abstract.
///
/// Anchors: Dechant 2016/2017 (Clifford algebra for root systems); Conway–Sloane SPLAG
/// (Construction A); Gates et al. (adinkra ↔ doubly-even self-dual codes).
[<RequireQualifiedAccess>]
module CliffordE8BladeMask =

    // ── [8,4] extended Hamming code (same generator as AdinkraCode.fs) ─────────
    // Systematic form [I₄ | A] where A is the parity-check block.
    let private generator : int[][] =
        [| [|1;0;0;0;0;1;1;1|]
           [|0;1;0;0;1;0;1;1|]
           [|0;0;1;0;1;1;0;1|]
           [|0;0;0;1;1;1;1;0|] |]

    let private allCodewords () : int[][] =
        [| for m in 0..15 do
               yield Array.init 8 (fun j ->
                   let mutable acc = 0
                   for i in 0..3 do
                       acc <- acc ^^^ (((m >>> i) &&& 1) &&& generator.[i].[j])
                   acc) |]

    // ── E8 roots via Construction A (same as E8Lattice.fs) ───────────────────
    let e8Roots () : int[][] =
        [| // 16 even roots: ±2·eᵢ
           for i in 0..7 do
               for s in [2; -2] do
                   yield Array.init 8 (fun j -> if j = i then s else 0)
           // 224 odd roots: weight-4 codewords, all 16 sign patterns
           for c in allCodewords () do
               if Array.sum c = 4 then
                   let support = [| for j in 0..7 do if c.[j] = 1 then yield j |]
                   for signs in 0..15 do
                       yield Array.init 8 (fun j ->
                           match Array.tryFindIndex ((=) j) support with
                           | None -> 0
                           | Some k -> if (signs >>> k) &&& 1 = 1 then -1 else 1) |]

    // ── Cl(3,0) geometric product on blade-mask coordinates (Cl3.fs) ─────────
    // reorderSign: count bit-swaps needed to move bits of `a` past bits of `b`
    let private reorderSign (a : int) (b : int) : int =
        let mutable aShift = a >>> 1
        let mutable swaps = 0
        while aShift <> 0 do
            let mutable x = aShift &&& b
            while x <> 0 do
                swaps <- swaps + (x &&& 1)
                x <- x >>> 1
            aShift <- aShift >>> 1
        if swaps % 2 = 0 then 1 else -1

    // Geometric product: result[i XOR j] += x[i] * y[j] * reorderSign(i,j)
    let private gp (x : int[]) (y : int[]) : int[] =
        let r = Array.zeroCreate 8
        for i in 0..7 do
            if x.[i] <> 0 then
                for j in 0..7 do
                    if y.[j] <> 0 then
                        r.[i ^^^ j] <- r.[i ^^^ j] + x.[i] * y.[j] * reorderSign i j
        r

    // Reverse: flip sign of grade-2 and grade-3 blades
    // REVERSE_SIGN for indices 0..7: grades [0,1,1,2,1,2,2,3] → signs [1,1,1,-1,1,-1,-1,-1]
    let private reverseSign = [|1;1;1;-1;1;-1;-1;-1|]

    let private rev (x : int[]) : int[] =
        Array.mapi (fun i v -> v * reverseSign.[i]) x

    // ── Measurement result type ───────────────────────────────────────────────
    type MeasureResult = {
        RootCount           : int
        ClassicalPreserved  : int
        VersorNormedCount   : int
        VersorNormedSupports: string list
        IntegerImages       : int
        RootImages          : int
        IdentityFixedPairs  : int
        VersorPreserved     : int
        PerAHistogram       : (int * int) list   // (preserved, #A)
    }

    // ── Main measurement ─────────────────────────────────────────────────────
    let measure () : MeasureResult =
        let roots = e8Roots ()
        let rootSet = System.Collections.Generic.HashSet<string>(
                          roots |> Array.map (fun r -> System.String.Join(",", r)))

        // Classical ℝ⁸ reflection baseline: x ↦ x − 2(x·r)/(r·r)·r
        // r·r = 4 for all E8 roots, so x ↦ x − ½(x·r)·r
        let mutable classical = 0
        for r in roots do
            for x in roots do
                let dot = Array.map2 (*) r x |> Array.sum
                let reflected = Array.init 8 (fun j -> x.[j] - dot * r.[j] / 2)
                if rootSet.Contains(System.String.Join(",", reflected)) then
                    classical <- classical + 1

        // Versor sandwich: s_A(x) = −A·x·Ã / ⟨A·Ã⟩₀
        let mutable versorNormedCount = 0
        let supports = System.Collections.Generic.SortedSet<string>()
        let mutable integerImages = 0
        let mutable rootImages = 0
        let mutable identityFixed = 0
        let mutable versorPreserved = 0
        let hist = System.Collections.Generic.Dictionary<int, int>()

        for a in roots do
            let aRev = rev a
            let aaRev = gp a aRev
            // Check if A·Ã is scalar (blade 0 only)
            let isVersorNormed =
                let mutable scalar = true
                for i in 1..7 do if aaRev.[i] <> 0 then scalar <- false
                scalar
            if isVersorNormed then
                versorNormedCount <- versorNormedCount + 1
                // Record support
                let nonzero = [| for i in 0..7 do if a.[i] <> 0 then yield i |]
                let supportStr =
                    if nonzero.Length = 1 then string nonzero.[0]
                    else System.String.Join("+", nonzero)
                supports.Add(supportStr) |> ignore

            let norm0 = aaRev.[0]  // scalar part of A·Ã
            let mutable preserved = 0
            for x in roots do
                // Compute −A·x·Ã
                let ax = gp a x
                let axaRev = gp ax aRev
                // Check if result is integer-valued (all components divisible by norm0)
                if norm0 <> 0 then
                    let isInt = axaRev |> Array.forall (fun v -> v % norm0 = 0)
                    if isInt then
                        integerImages <- integerImages + 1
                        let image = Array.map (fun v -> -v / norm0) axaRev
                        if rootSet.Contains(System.String.Join(",", image)) then
                            rootImages <- rootImages + 1
                            preserved <- preserved + 1
                            if image = x then identityFixed <- identityFixed + 1

            if isVersorNormed then versorPreserved <- versorPreserved + preserved
            let cur = if hist.ContainsKey(preserved) then hist.[preserved] else 0
            hist.[preserved] <- cur + 1

        {   RootCount           = roots.Length
            ClassicalPreserved  = classical
            VersorNormedCount   = versorNormedCount
            VersorNormedSupports= supports |> Seq.toList
            IntegerImages       = integerImages
            RootImages          = rootImages
            IdentityFixedPairs  = identityFixed
            VersorPreserved     = versorPreserved
            PerAHistogram       = hist |> Seq.map (fun kv -> kv.Key, kv.Value)
                                       |> Seq.sortBy fst |> Seq.toList }
