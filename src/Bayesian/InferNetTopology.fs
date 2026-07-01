namespace Zeta.Bayesian

open System

/// Represents an AOT-friendly native F# belief propagation simulation for
/// neural topology reconstruction, demonstrating the mathematical identity
/// I(D(x)) ≈ x under noise.
[<Sealed>]
type InferNetTopology(numNodes: int, numProjections: int) =
    let n = numNodes
    let m = numProjections
    
    do
        if numNodes <= 0 then
            invalidArg (nameof numNodes) "Number of nodes must be positive"
        if numProjections <= 0 then
            invalidArg (nameof numProjections) "Number of projections must be positive"
            
    // Adjacency and couplings
    let couplings = Array2D.create n n 0.0
    // Directed edges set and list to avoid scanning the 2D array
    let edgesSet = System.Collections.Generic.HashSet<int * int>()
    let mutable edges : (int * int)[] = [||]
    
    // The fixed, deterministic projection matrix P of size M x N
    // This is initialized with a deterministic orthogonal or pseudo-random pattern
    // to guarantee repeatable tests ("reproducible stability").
    let projectionMatrix = 
        Array2D.init m n (fun i j ->
            // Deterministic pseudo-random values in [-1.0, 1.0] using a simple sine wave hash
            let seed = float (i * 13 + j * 37 + 1)
            let raw = sin seed * 1000.0
            let r = raw - floor raw
            (r * 2.0 - 1.0) / sqrt (float m)
        )

    /// Configure the topological connection weight between node i and node j.
    member this.SetCoupling(i: int, j: int, weight: float) =
        if i < 0 || i >= n then
            invalidArg (nameof i) "Node index out of range"
        if j < 0 || j >= n then
            invalidArg (nameof j) "Node index out of range"
        if Double.IsNaN weight || Double.IsInfinity weight then
            invalidArg (nameof weight) "Coupling weight must be finite"
            
        couplings.[i, j] <- weight
        couplings.[j, i] <- weight // Symmetric
        
        // Rebuild/maintain edges list incrementally
        if i <> j then
            let changed =
                if weight <> 0.0 then
                    let a = edgesSet.Add((i, j))
                    let b = edgesSet.Add((j, i))
                    a || b
                else
                    let a = edgesSet.Remove((i, j))
                    let b = edgesSet.Remove((j, i))
                    a || b
            if changed then
                edges <- 
                    edgesSet 
                    |> Seq.toArray 
                    |> Array.sortWith (fun (x1, y1) (x2, y2) ->
                        let cmp = compare x1 x2
                        if cmp <> 0 then cmp else compare y1 y2
                    )

    /// Set up a ring or chain topology automatically.
    member this.SetChainCouplings(weight: float) =
        for i in 0 .. n - 2 do
            this.SetCoupling(i, i + 1, weight)

    member this.SetRingCouplings(weight: float) =
        this.SetChainCouplings(weight)
        this.SetCoupling(n - 1, 0, weight)

    /// The projection operator D(x) = P * x + noise.
    /// Projects a high-dimensional topology vector x (size N) to low-dimensional
    /// tension space y (size M).
    member _.Project(x: float[], noiseSigma: float, seed: int) : float[] =
        if x.Length <> n then
            invalidArg (nameof x) $"Input must have length {n}"
        if noiseSigma < 0.0 then
            invalidArg (nameof noiseSigma) "Noise sigma cannot be negative"
        for i in 0 .. x.Length - 1 do
            if Double.IsNaN x.[i] || Double.IsInfinity x.[i] then
                invalidArg (nameof x) "Input vector elements must be finite"
        
        let y = Array.zeroCreate m
        let rand = Random(seed)
        
        for i in 0 .. m - 1 do
            let mutable sum = 0.0
            for j in 0 .. n - 1 do
                sum <- sum + projectionMatrix.[i, j] * x.[j]
            // Add Gaussian noise using Box-Muller transform
            let noise = 
                if noiseSigma > 0.0 then
                    let u1 = max 1e-15 (rand.NextDouble())
                    let u2 = rand.NextDouble()
                    noiseSigma * sqrt(-2.0 * log u1) * cos(2.0 * Math.PI * u2)
                else 0.0
            y.[i] <- sum + noise
        y

    /// The integration/reconstruction operator I(y).
    /// Reconstructs the high-dimensional topology vector x using Loopy Belief Propagation
    /// over the factor graph representing the topological constraints.
    member _.Reconstruct(y: float[], maxIterations: int, lambda: float) : float[] =
        if y.Length <> m then
            invalidArg (nameof y) $"Input must have length {m}"
        if maxIterations <= 0 then
            invalidArg (nameof maxIterations) "Number of iterations must be positive"
        if Double.IsNaN lambda || Double.IsInfinity lambda then
            invalidArg (nameof lambda) "Lambda must be finite"
        for i in 0 .. y.Length - 1 do
            if Double.IsNaN y.[i] || Double.IsInfinity y.[i] then
                invalidArg (nameof y) "Input vector elements must be finite"
            
        // 1. Back-project the low-dimensional tension to local fields (h_i)
        let h = Array.zeroCreate n
        for i in 0 .. n - 1 do
            let mutable sum = 0.0
            for j in 0 .. m - 1 do
                // P^T * y
                sum <- sum + projectionMatrix.[j, i] * y.[j]
            h.[i] <- lambda * sum

        // 2. Initialize log-messages to 0.0
        // Directed messages index: (sender, receiver) -> log-message value
        // We use a mutable array to store current messages corresponding to the 'edges' list
        let currentMessages = Array.zeroCreate edges.Length
        let nextMessages = Array.zeroCreate edges.Length

        // Clip tanh argument to prevent division by zero or infinite log values in inverse tanh
        let eps = 1e-12
        let clip v =
            if v >= 1.0 - eps then 1.0 - eps
            elif v <= -1.0 + eps then -1.0 + eps
            else v

        // Inverse hyperbolic tangent
        let atanh x =
            0.5 * log ((1.0 + x) / (1.0 - x))

        // 3. Iterative message updates using the log-likelihood LLR updates
        for _iter in 1 .. maxIterations do
            for edgeIdx in 0 .. edges.Length - 1 do
                let (sender, receiver) = edges.[edgeIdx]
                let J_sr = couplings.[sender, receiver]
                
                // Compute sum of incoming messages to sender, excluding the receiver
                let mutable sumIncoming = h.[sender]
                for otherEdgeIdx in 0 .. edges.Length - 1 do
                    let (otherSender, otherReceiver) = edges.[otherEdgeIdx]
                    // If otherReceiver is sender, it is an incoming message to sender
                    // but exclude if otherSender is receiver (the message we are computing for)
                    if otherReceiver = sender && otherSender <> receiver then
                        sumIncoming <- sumIncoming + currentMessages.[otherEdgeIdx]
                
                // LLR sum-product update: L_{s -> r} = 2 * atanh( tanh(J_{sr}) * tanh(S_{s \ r} / 2) )
                let tanh_J = tanh J_sr
                let tanh_S = tanh (sumIncoming / 2.0)
                let valToAtanh = clip (tanh_J * tanh_S)
                nextMessages.[edgeIdx] <- 2.0 * atanh valToAtanh
            
            // Copy nextMessages to currentMessages
            Array.Copy(nextMessages, currentMessages, edges.Length)

        // 4. Compute final log-beliefs and reconstruct soft predictions
        let reconstructed = Array.zeroCreate n
        for i in 0 .. n - 1 do
            let mutable sumIncoming = h.[i]
            for edgeIdx in 0 .. edges.Length - 1 do
                let (_sender, receiver) = edges.[edgeIdx]
                if receiver = i then
                    sumIncoming <- sumIncoming + currentMessages.[edgeIdx]
            
            // Soft reconstruction prediction using tanh(L_i / 2)
            reconstructed.[i] <- tanh (sumIncoming / 2.0)
        reconstructed

    /// Access the internal projection matrix for audit/transparency
    member _.ProjectionMatrix = projectionMatrix.Clone() :?> float[,]
