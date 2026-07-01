namespace Zeta.Core

open System
open System.Collections.Generic

/// Compact representation of a binary vector of length N = 8 over F_2.
[<Struct; CustomEquality; CustomComparison>]
type BinaryVector =
    val Value : uint8
    new(v: uint8) = { Value = v }

    /// Create a BinaryVector from a boolean array of length 8.
    static member FromBits(bits: bool[]) =
        if bits.Length <> 8 then invalidArg (nameof bits) "Length must be exactly 8"
        let mutable v = 0uy
        for i in 0 .. 7 do
            if bits.[i] then
                v <- v ||| (1uy <<< i)
        BinaryVector(v)

    /// Get the i-th bit (0-indexed, 0..7).
    member this.GetBit(i: int) =
        if i < 0 || i >= 8 then invalidArg (nameof i) "Bit index must be 0..7"
        ((this.Value >>> i) &&& 1uy) = 1uy

    /// Compute the Hamming weight of the vector (number of 1s).
    member this.Weight =
        let mutable count = 0
        let mutable temp = this.Value
        while temp > 0uy do
            if (temp &&& 1uy) = 1uy then count <- count + 1
            temp <- temp >>> 1
        count

    /// Addition in F_2^8 (bitwise XOR).
    static member (+) (a: BinaryVector, b: BinaryVector) =
        BinaryVector(a.Value ^^^ b.Value)

    /// Multiplication in F_2^8 (bitwise AND).
    static member (*) (a: BinaryVector, b: BinaryVector) =
        BinaryVector(a.Value &&& b.Value)

    /// Modulo-2 dot product.
    static member Dot(a: BinaryVector, b: BinaryVector) =
        let intersection = a * b
        int (intersection.Weight % 2)

    override this.Equals(other) =
        match other with
        | :? BinaryVector as o -> this.Value = o.Value
        | _ -> false

    override this.GetHashCode() = this.Value.GetHashCode()

    interface IComparable with
        member this.CompareTo(other) =
            match other with
            | :? BinaryVector as o -> compare this.Value o.Value
            | _ -> invalidArg "other" "not a BinaryVector"

    override this.ToString() =
        let copy = this
        let chars = Array.init 8 (fun i -> if copy.GetBit(i) then '1' else '0')
        String(chars)


/// Vertex parity in the bipartite Adinkra chromotopology.
type Parity =
    | Boson   // Even weight parity
    | Fermion // Odd weight parity

    member this.Opposite =
        match this with
        | Boson -> Fermion
        | Fermion -> Boson


/// Represents a vertex in the Adinkra graph quotient H_8 / C.
[<CustomEquality; CustomComparison>]
type AdinkraVertex =
    { CanonicalRepresentative : BinaryVector
      Parity : Parity
      Height : int
      Version : int64 }

    override this.Equals(other) =
        match other with
        | :? AdinkraVertex as o -> this.CanonicalRepresentative = o.CanonicalRepresentative
        | _ -> false

    override this.GetHashCode() = this.CanonicalRepresentative.GetHashCode()

    interface IComparable with
        member this.CompareTo(other) =
            match other with
            | :? AdinkraVertex as o -> compare this.CanonicalRepresentative o.CanonicalRepresentative
            | _ -> invalidArg "other" "not an AdinkraVertex"


/// Represents a colored, signed edge in the Adinkra graph.
type AdinkraEdge =
    { Color : int // Coordinate color index (1..8)
      Sign : int  // +1 or -1
      Source : AdinkraVertex
      Target : AdinkraVertex }


/// Represents a binary linear code subspace C in F_2^8.
type BinaryCode =
    { Codewords : Set<BinaryVector> }

    /// Check if the code is doubly-even (all codewords have weight divisible by 4).
    member this.IsDoublyEven =
        this.Codewords |> Set.forall (fun w -> w.Weight % 4 = 0)

    /// Check if the code is self-dual (C = C^\perp).
    member this.IsSelfDual =
        if this.Codewords.Count <> 16 then false
        else
            this.Codewords |> Set.forall (fun w1 ->
                this.Codewords |> Set.forall (fun w2 ->
                    BinaryVector.Dot(w1, w2) = 0
                )
            )

    /// Generate a coset v + C for a given vector v.
    member this.Coset(v: BinaryVector) : Set<BinaryVector> =
        this.Codewords |> Set.map (fun c -> v + c)

    /// Get the canonical representative of a coset (lexicographically smallest).
    member this.CanonicalRepresentative(v: BinaryVector) : BinaryVector =
        let coset = this.Coset(v)
        Set.minElement coset

    /// Decode a corrupted vector to the nearest codeword (Maximum Likelihood Decoding).
    member this.Decode(y: BinaryVector) : BinaryVector =
        this.Codewords
        |> Set.toArray
        |> Array.minBy (fun cw -> (y + cw).Weight)

    /// Recover state from incomplete/erased observation bits.
    /// Returns Some codeword if there is a unique matching codeword, otherwise None.
    member this.RecoverState(partialData: Map<int, bool>) : BinaryVector option =
        let matches =
            this.Codewords
            |> Set.filter (fun cw ->
                partialData |> Map.forall (fun idx bit ->
                    cw.GetBit(idx) = bit
                )
            )
        if matches.Count = 1 then
            Some (Set.minElement matches)
        else
            None

    /// Deterministically derive a symmetric key from the code space and seed.
    member this.DerivePrivateKey(seed: byte[]) : byte[] =
        use sha = System.Security.Cryptography.SHA256.Create()
        let sortedCodewords =
            this.Codewords
            |> Set.toArray
            |> Array.sortBy (fun w -> w.Value)
        let cwBytes = sortedCodewords |> Array.map (fun w -> w.Value)
        let input = Array.concat [ seed; cwBytes ]
        sha.ComputeHash(input)


/// Represents the full Adinkra graph quotient H_8 / C.
type AdinkraGraph =
    { Vertices : Set<AdinkraVertex>
      Edges : List<AdinkraEdge> }

    /// Verify the Adinkra loop sign parity condition:
    /// Every 4-cycle in the quotient graph must have a product of edge signs equal to -1.
    member this.VerifyLoopCondition() : bool =
        // 1. Build adjacency list representation.
        let adj = Dictionary<AdinkraVertex, List<AdinkraEdge>>()
        for v in this.Vertices do
            adj.[v] <- List<AdinkraEdge>()
        for e in this.Edges do
            adj.[e.Source].Add(e)
            adj.[e.Target].Add(e)

        // 2. Find all 2-colored 4-cycles.
        // A 4-cycle is v0 -> v1 -> v2 -> v3 -> v0 where vertices are distinct.
        // To avoid counting the same cycle multiple times and running into infinite back-and-forth loops,
        // we enforce a strict ordering on the vertices v0 < v2 and v1 < v3.
        let cycles = List<AdinkraVertex * AdinkraEdge * AdinkraVertex * AdinkraEdge * AdinkraVertex * AdinkraEdge * AdinkraVertex * AdinkraEdge>()

        let vertices = this.Vertices |> Set.toArray
        for i in 0 .. vertices.Length - 1 do
            let v0 = vertices.[i]
            for e1 in adj.[v0] do
                let v1 = if e1.Source = v0 then e1.Target else e1.Source
                for e2 in adj.[v1] do
                    let v2 = if e2.Source = v1 then e2.Target else e2.Source
                    if v2 <> v0 then
                        for e3 in adj.[v2] do
                            let v3 = if e3.Source = v2 then e3.Target else e3.Source
                            if v3 <> v1 && v3 <> v0 then
                                for e4 in adj.[v3] do
                                    let finalV = if e4.Source = v3 then e4.Target else e4.Source
                                    if finalV = v0 then
                                        // Standardize to prevent duplicates and only keep 2-colored 4-cycles.
                                        if v0.CanonicalRepresentative.Value < v2.CanonicalRepresentative.Value &&
                                           v1.CanonicalRepresentative.Value < v3.CanonicalRepresentative.Value &&
                                           e1.Color = e3.Color && e2.Color = e4.Color then
                                            cycles.Add((v0, e1, v1, e2, v2, e3, v3, e4))

        if cycles.Count = 0 then
            false
        else
            cycles |> Seq.forall (fun (v0, e1, v1, e2, v2, e3, v3, e4) ->
                let prod = e1.Sign * e2.Sign * e3.Sign * e4.Sign
                prod = -1
            )


[<RequireQualifiedAccess>]
module BinaryCode =
    /// The canonical basis generators for the [8,4,4] extended Hamming code.
    let generators = [|
        BinaryVector(225uy) // g0: bits 0, 5, 6, 7
        BinaryVector(210uy) // g1: bits 1, 4, 6, 7
        BinaryVector(180uy) // g2: bits 2, 4, 5, 7
        BinaryVector(120uy) // g3: bits 3, 4, 5, 6
    |]

    /// Construct the standard [8,4,4] extended Hamming code subspace.
    let extendedHamming () : BinaryCode =
        let mutable codewords = Set.empty
        for i in 0 .. 15 do
            let mutable cw = BinaryVector(0uy)
            for j in 0 .. 3 do
                if ((i >>> j) &&& 1) = 1 then
                    cw <- cw + generators.[j]
            codewords <- Set.add cw codewords
        { Codewords = codewords }

    /// Coordinate-based edge sign function: S(v, i) = (-1)^(sum_{k < i} v_k) for coordinate index i (0..7).
    let getSignDecoration (v: BinaryVector) (i: int) : int =
        let mutable sum = 0
        for k in 0 .. i - 1 do
            if v.GetBit(k) then
                sum <- sum + 1
        if sum % 2 = 0 then 1 else -1

    /// Construct the Adinkra graph quotient H_8 / C using the standard [8,4,4] code.
    let constructAdinkra (code: BinaryCode) : AdinkraGraph =
        // 1. Group the 256 hypercube vertices into 16 cosets.
        let cosetMap = Dictionary<BinaryVector, Set<BinaryVector>>()
        let representatives = List<BinaryVector>()

        for valInt in 0uy .. 255uy do
            let v = BinaryVector(valInt)
            let rep = code.CanonicalRepresentative(v)
            if not (cosetMap.ContainsKey(rep)) then
                cosetMap.[rep] <- code.Coset(v)
                representatives.Add(rep)

        // 2. Map representatives to AdinkraVertex.
        let vertexMap = Dictionary<BinaryVector, AdinkraVertex>()
        let mutable vertices = Set.empty

        for rep in representatives do
            let parity = if rep.Weight % 2 = 0 then Boson else Fermion
            // Height classification:
            // C (weight 0 rep) -> height 0
            // odd reps (weight 1) -> height 1
            // even reps (weight 2) -> height 2
            let height =
                if rep.Value = 0uy then 0
                elif parity = Fermion then 1
                else 2
            let vertex =
                { CanonicalRepresentative = rep
                  Parity = parity
                  Height = height
                  Version = 0L }
            vertexMap.[rep] <- vertex
            vertices <- Set.add vertex vertices

        // 3. Construct the 64 colored edges with initial sign = 1.
        let edges = List<AdinkraEdge>()
        let processedEdges = HashSet<uint8 * uint8>() // Set of (u.Value, v.Value) in sorted order to avoid duplicates

        for rep in representatives do
            let uVertex = vertexMap.[rep]
            // We connect this coset to neighbor cosets along coordinate directions.
            for colorIdx in 0 .. 7 do
                let direction = BinaryVector(1uy <<< colorIdx)
                let neighborRep = code.CanonicalRepresentative(rep + direction)
                let vVertex = vertexMap.[neighborRep]

                let uVal = uVertex.CanonicalRepresentative.Value
                let vVal = vVertex.CanonicalRepresentative.Value
                let edgeKey = if uVal < vVal then (uVal, vVal) else (vVal, uVal)

                if processedEdges.Add(edgeKey) then
                    let edge =
                        { Color = colorIdx + 1 // 1..8
                          Sign = 1 // initial sign
                          Source = uVertex
                          Target = vVertex }
                    edges.Add(edge)

        // 4. Find all 2-colored 4-cycles to solve for the well-dashed edge signs using a GF(2) linear solver.
        let adj = Dictionary<AdinkraVertex, List<AdinkraEdge>>()
        for v in vertices do
            adj.[v] <- List<AdinkraEdge>()
        for e in edges do
            adj.[e.Source].Add(e)
            adj.[e.Target].Add(e)

        let cycles = List<AdinkraEdge * AdinkraEdge * AdinkraEdge * AdinkraEdge>()
        let verticesArray = vertices |> Set.toArray
        for i in 0 .. verticesArray.Length - 1 do
            let v0 = verticesArray.[i]
            for e1 in adj.[v0] do
                let v1 = if e1.Source = v0 then e1.Target else e1.Source
                for e2 in adj.[v1] do
                    let v2 = if e2.Source = v1 then e2.Target else e2.Source
                    if v2 <> v0 then
                        for e3 in adj.[v2] do
                            let v3 = if e3.Source = v2 then e3.Target else e3.Source
                            if v3 <> v1 && v3 <> v0 then
                                for e4 in adj.[v3] do
                                    let finalV = if e4.Source = v3 then e4.Target else e4.Source
                                    if finalV = v0 then
                                        // Standardize to prevent duplicates and only keep 2-colored 4-cycles
                                        if v0.CanonicalRepresentative.Value < v2.CanonicalRepresentative.Value &&
                                           v1.CanonicalRepresentative.Value < v3.CanonicalRepresentative.Value &&
                                           e1.Color = e3.Color && e2.Color = e4.Color then
                                            cycles.Add((e1, e2, e3, e4))

        // We solve M * x = b over GF(2)
        let rows = cycles.Count
        let cols = edges.Count
        let mat = Array2D.create rows (cols + 1) 0
        for r in 0 .. rows - 1 do
            let (e1, e2, e3, e4) = cycles.[r]
            let idx1 = edges.IndexOf(e1)
            let idx2 = edges.IndexOf(e2)
            let idx3 = edges.IndexOf(e3)
            let idx4 = edges.IndexOf(e4)
            mat.[r, idx1] <- 1
            mat.[r, idx2] <- 1
            mat.[r, idx3] <- 1
            mat.[r, idx4] <- 1
            mat.[r, cols] <- 1

        let mutable lead = 0
        for c in 0 .. cols - 1 do
            if lead < rows then
                let mutable pivotRow = -1
                for r in lead .. rows - 1 do
                    if mat.[r, c] = 1 && pivotRow = -1 then
                        pivotRow <- r
                if pivotRow <> -1 then
                    if pivotRow <> lead then
                        for j in 0 .. cols do
                            let temp = mat.[lead, j]
                            mat.[lead, j] <- mat.[pivotRow, j]
                            mat.[pivotRow, j] <- temp
                    for r in 0 .. rows - 1 do
                        if r <> lead && mat.[r, c] = 1 then
                            for j in 0 .. cols do
                                mat.[r, j] <- mat.[r, j] ^^^ mat.[lead, j]
                    lead <- lead + 1

        let x = Array.create cols 0
        for r in 0 .. lead - 1 do
            let mutable leadingCol = -1
            for c in 0 .. cols - 1 do
                if mat.[r, c] = 1 && leadingCol = -1 then
                    leadingCol <- c
            if leadingCol <> -1 then
                x.[leadingCol] <- mat.[r, cols]

        let signedEdges = List<AdinkraEdge>()
        for i in 0 .. edges.Count - 1 do
            let e = edges.[i]
            let sign = if x.[i] = 1 then -1 else 1
            signedEdges.Add({ e with Sign = sign })

        { Vertices = vertices; Edges = signedEdges }
