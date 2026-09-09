namespace Zeta.E8Render

open System.Numerics

/// **`E8Clifford` — Cl(8,0), GENERATED, not tabulated.**
///
/// There is no multiplication table in this file. A basis blade IS a subset bitmask of the
/// eight generators, and the sign of a product is produced by counting the transpositions
/// that sort the concatenated generator list. That single rule generates all 65,536 basis
/// products, which is `only-the-irreducible-is-primitive-generate-the-rest` at the level of
/// the algebra: the free object is primitive and everything else is derived and therefore
/// checkable.
///
/// Integers throughout. Every root of E8 in the doubled frame is an integer vector, so every
/// sandwich below stays exact; nothing here can round.
///
/// Anchors (Beacon): **William Kingdon Clifford** (1878) — the geometric product;
/// **David Hestenes & Garret Sobczyk**, *Clifford Algebra to Geometric Calculus* (Reidel,
/// 1984) — the grade decomposition and the reversion antiautomorphism; **Leo Dorst, Daniel
/// Fontijne & Stephen Mann**, *Geometric Algebra for Computer Science* (Morgan Kaufmann,
/// 2007) — the versor sandwich `-a v a^-1` for a reflection and `R v R~` for a rotation, and
/// the contraction/outer split of `v B`.
[<RequireQualifiedAccess>]
module E8Clifford =

    /// Generators of the algebra.
    [<Literal>]
    let Dimension = 8

    /// Basis blades of Cl(8,0): one per subset of the generators.
    [<Literal>]
    let MultivectorLength = 256

    /// The grade of a blade is the size of its generator subset.
    let bladeGrade (mask: int) : int = BitOperations.PopCount(uint32 mask)

    /// The sign of `e_A e_B`, from the transposition count that sorts `A ++ B`.
    ///
    /// Generated: for each generator of `a`, count how many generators of `b` sit below it;
    /// each such pair costs one anticommutation. Generators square to `+1`, so the shared
    /// generators contribute nothing beyond the swaps already counted.
    let reorderSign (a: int) (b: int) : int =
        let mutable swaps = 0
        let mutable bit = Dimension - 1

        while bit >= 0 do
            if (a >>> bit) &&& 1 = 1 then
                swaps <- swaps + BitOperations.PopCount(uint32 (b &&& ((1 <<< bit) - 1)))

            bit <- bit - 1

        if swaps % 2 = 0 then 1 else -1

    /// A multivector: 256 integer coefficients, indexed by blade mask.
    type Multivector = int[]

    /// The zero multivector.
    let zero () : Multivector = Array.zeroCreate<int> MultivectorLength

    /// The geometric product, generated from `reorderSign` alone.
    let geometricProduct (x: Multivector) (y: Multivector) : Multivector =
        let out = zero ()

        for a in 0 .. MultivectorLength - 1 do
            if x.[a] <> 0 then
                for b in 0 .. MultivectorLength - 1 do
                    if y.[b] <> 0 then
                        let target = a ^^^ b
                        out.[target] <- out.[target] + reorderSign a b * x.[a] * y.[b]

        out

    /// Reversion: grade `g` picks up `(-1)^(g(g-1)/2)`.
    let reverse (x: Multivector) : Multivector =
        Array.init MultivectorLength (fun m ->
            let g = bladeGrade m
            if (g * (g - 1) / 2) % 2 = 0 then x.[m] else -x.[m])

    /// The grade-`g` part.
    let gradePart (g: int) (x: Multivector) : Multivector =
        Array.init MultivectorLength (fun m -> if bladeGrade m = g then x.[m] else 0)

    /// Which grades are present, ascending.
    let gradesPresent (x: Multivector) : int[] =
        let seen = System.Collections.Generic.SortedSet<int>()

        for m in 0 .. MultivectorLength - 1 do
            if x.[m] <> 0 then seen.Add(bladeGrade m) |> ignore

        Seq.toArray seen

    /// Lift a vector into the algebra.
    let ofVector (v: int[]) : Multivector =
        let out = zero ()

        for i in 0 .. Dimension - 1 do
            out.[1 <<< i] <- v.[i]

        out

    /// Project the grade-1 part back out.
    let toVector (x: Multivector) : int[] =
        Array.init Dimension (fun i -> x.[1 <<< i])

    /// The 28 grade-2 basis blades `e_i ^ e_j`, ascending `(i, j)`.
    let bivectorPairs: struct (int * int)[] =
        [| for i in 0 .. Dimension - 1 do
               for j in i + 1 .. Dimension - 1 -> struct (i, j) |]

    /// The 56 grade-3 basis blades, ascending `(i, j, k)`.
    let trivectorTriples: struct (int * int * int)[] =
        [| for i in 0 .. Dimension - 1 do
               for j in i + 1 .. Dimension - 1 do
                   for k in j + 1 .. Dimension - 1 -> struct (i, j, k) |]

    /// Slot of `e_i ^ e_j` in `bivectorPairs`, either ordering; `-1` on the diagonal.
    let private bivectorSlot: int[] =
        let out = Array.create (Dimension * Dimension) -1

        bivectorPairs
        |> Array.iteri (fun k (struct (i, j)) ->
            out.[i * Dimension + j] <- k
            out.[j * Dimension + i] <- k)

        out

    /// `B_{ij}`, antisymmetric: `B_{ji} = -B_{ij}`.
    let bivectorAt (bivector: int[]) (i: int) (j: int) : int =
        let k = bivectorSlot.[i * Dimension + j]

        if k < 0 then 0
        elif i < j then bivector.[k]
        else -bivector.[k]

    /// Lift a 28-component bivector into the algebra.
    let ofBivector (bivector: int[]) : Multivector =
        let out = zero ()

        bivectorPairs
        |> Array.iteri (fun k (struct (i, j)) -> out.[(1 <<< i) ||| (1 <<< j)] <- bivector.[k])

        out

    /// `(b - a) ^ (c - a)`, 28 exact integer components: the oriented plane of a face.
    let faceBivector (a: int[]) (b: int[]) (c: int[]) : int[] =
        let u = Array.init E8Exact.AmbientDimension (fun k -> b.[k] - a.[k])
        let v = Array.init E8Exact.AmbientDimension (fun k -> c.[k] - a.[k])
        bivectorPairs |> Array.map (fun (struct (i, j)) -> u.[i] * v.[j] - u.[j] * v.[i])

    /// `sum B_ij^2`. Exact on integers.
    let bivectorNormSquared (bivector: int[]) : int =
        bivector |> Array.sumBy (fun x -> x * x)

    /// `<v _| B>` — the grade-1 part of `v B`, specialised.
    ///
    /// The hot path uses this; the sibling test checks it against the full generated
    /// product, which is the second mechanism for one answer.
    let contractVectorBivector (v: int[]) (bivector: int[]) : int[] =
        let out = Array.zeroCreate<int> Dimension

        bivectorPairs
        |> Array.iteri (fun k (struct (i, j)) ->
            let c = bivector.[k]

            if c <> 0 then
                // e_i (e_i ^ e_j) = e_j and e_j (e_i ^ e_j) = -e_i, with e_k^2 = +1.
                out.[j] <- out.[j] + v.[i] * c
                out.[i] <- out.[i] - v.[j] * c)

        out

    /// `v ^ B` — the grade-3 part of `v B`, 56 components in `trivectorTriples` order.
    let wedgeVectorBivector (v: int[]) (bivector: int[]) : int[] =
        trivectorTriples
        |> Array.map (fun (struct (i, j, k)) ->
            v.[i] * bivectorAt bivector j k - v.[j] * bivectorAt bivector i k
            + v.[k] * bivectorAt bivector i j)

    /// An exact vector-valued result: `Components / Denominator`.
    type ExactVector =
        { /// Numerators, exact integers.
          Components: int[]
          /// Common denominator, exact integer.
          Denominator: int }

    /// Reflection of `v` in the hyperplane orthogonal to `axis`: `-a v a / |a|^2`.
    let reflectInHyperplane (v: int[]) (axis: int[]) : ExactVector =
        let a = ofVector axis
        let sandwich = geometricProduct (geometricProduct a (ofVector v)) a
        { Components = toVector sandwich |> Array.map (fun x -> -x)
          Denominator = E8Exact.dot axis axis }

    /// Reflection of the light in a face's plane: `-(B L B~) / |B|^2`.
    ///
    /// The sign is derived rather than chosen: `B L B~ / |B|^2` evaluates to
    /// `L_perp - L_par`, so the mirror a surface performs — tangential kept, normal
    /// flipped — is its negation.
    let mirrorInPlane (light: int[]) (bivector: int[]) : ExactVector =
        let b = ofBivector bivector
        let sandwich = geometricProduct (geometricProduct b (ofVector light)) (reverse b)
        { Components = toVector sandwich |> Array.map (fun x -> -x)
          Denominator = bivectorNormSquared bivector }
