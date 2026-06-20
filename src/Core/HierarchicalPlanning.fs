namespace Zeta.Core

open System.Collections.Generic

type Gist = DynamicValue

module Gist =
    /// Create a Gist from bounds
    let create (rowMin: int) (rowMax: int) (colMin: int) (colMax: int) : Gist =
        DynamicValue.Object [
            "row_min", DynamicValue.Int (int64 rowMin)
            "row_max", DynamicValue.Int (int64 rowMax)
            "col_min", DynamicValue.Int (int64 colMin)
            "col_max", DynamicValue.Int (int64 colMax)
        ]

    /// Unpack a Gist to a predicate check on a Frame (checks V0 and V1)
    let unpack (gist: Gist) : (Chip8Cow.Frame -> bool) =
        match gist with
        | DynamicValue.Object fields ->
            let tryFindInt key =
                fields |> List.tryFind (fun (k, _) -> k = key)
                |> Option.bind (fun (_, v) ->
                    match v with
                    | DynamicValue.Int i -> Some (int i)
                    | _ -> None)
            match tryFindInt "row_min", tryFindInt "row_max", tryFindInt "col_min", tryFindInt "col_max" with
            | Some rMin, Some rMax, Some cMin, Some cMax ->
                fun (f: Chip8Cow.Frame) ->
                    let row = int f.V.[0]
                    let col = int f.V.[1]
                    row >= rMin && row <= rMax && col >= cMin && col <= cMax
            | _ -> fun _ -> false
        | _ -> fun _ -> false

[<RequireQualifiedAccess>]
module Chip8Navigation =
    /// The 44-byte navigation ROM implementing a 4x4 coordinate space on V0 (row) and V1 (col).
    /// Updates are triggered by Key 2 (Up), Key 8 (Down), Key 4 (Left), Key 6 (Right).
    /// PC starts at 0x200.
    let rom : byte[] =
        [|
            0x62uy; 0x02uy  // 0x200: V2 = 2
            0x68uy; 0x08uy  // 0x202: V8 = 8
            0x64uy; 0x04uy  // 0x204: V4 = 4
            0x66uy; 0x06uy  // 0x206: V6 = 6
            0x60uy; 0x00uy  // 0x208: V0 = 0 (row)
            0x61uy; 0x00uy  // 0x20A: V1 = 0 (col)
            
            // Loop start (PC = 0x20C)
            0xE2uy; 0x9Euy  // 0x20C: skip if key V2 (Up) is pressed
            0x12uy; 0x16uy  // 0x20E: jump to Down check (0x216)
            0x30uy; 0x00uy  // 0x210: skip if V0 == 0
            0x70uy; 0xFFuy  // 0x212: V0 = V0 - 1
            0x12uy; 0x16uy  // 0x214: jump to Down check (0x216)
            
            // Down check (PC = 0x216)
            0xE8uy; 0x9Euy  // 0x216: skip if key V8 (Down) is pressed
            0x12uy; 0x20uy  // 0x218: jump to Left check (0x220)
            0x30uy; 0x03uy  // 0x21A: skip if V0 == 3
            0x70uy; 0x01uy  // 0x21C: V0 = V0 + 1
            0x12uy; 0x20uy  // 0x21E: jump to Left check (0x220)
            
            // Left check (PC = 0x220)
            0xE4uy; 0x9Euy  // 0x220: skip if key V4 (Left) is pressed
            0x12uy; 0x2Auy  // 0x222: jump to Right check (0x22A)
            0x31uy; 0x00uy  // 0x224: skip if V1 == 0
            0x71uy; 0xFFuy  // 0x226: V1 = V1 - 1
            0x12uy; 0x2Auy  // 0x228: jump to Right check (0x22A)
            
            // Right check (PC = 0x22A)
            0xE6uy; 0x9Euy  // 0x22A: skip if key V6 (Right) is pressed
            0x12uy; 0x34uy  // 0x22C: jump to end of loop (0x234)
            0x31uy; 0x03uy  // 0x22E: skip if V1 == 3
            0x71uy; 0x01uy  // 0x230: V1 = V1 + 1
            0x12uy; 0x34uy  // 0x232: jump to end of loop (0x234)
            
            // End of loop (PC = 0x234)
            0x12uy; 0x0Cuy  // 0x234: jump back to Loop start (0x20C)
        |]

    let keyUp = 2
    let keyDown = 8
    let keyLeft = 4
    let keyRight = 6

    let directionToKeys (dir: ActionGrid.Direction) : bool[] =
        let keys = Array.zeroCreate 16
        match dir with
        | ActionGrid.Direction.Up -> keys.[keyUp] <- true
        | ActionGrid.Direction.Down -> keys.[keyDown] <- true
        | ActionGrid.Direction.Left -> keys.[keyLeft] <- true
        | ActionGrid.Direction.Right -> keys.[keyRight] <- true
        keys

    let actionUp = directionToKeys ActionGrid.Direction.Up
    let actionDown = directionToKeys ActionGrid.Direction.Down
    let actionLeft = directionToKeys ActionGrid.Direction.Left
    let actionRight = directionToKeys ActionGrid.Direction.Right
    let actionNone = Array.zeroCreate 16

    let actions = [ actionUp; actionDown; actionLeft; actionRight; actionNone ]

    let keyOf (f: Chip8Cow.Frame) = (f.PC, f.V.[0], f.V.[1])

    let isGoal (goalRow: int, goalCol: int) (f: Chip8Cow.Frame) : bool =
        int f.V.[0] = goalRow && int f.V.[1] = goalCol

    /// Create the initial frame loaded with the navigation ROM
    let createInitialState (seed: uint64) : Chip8Cow.Frame =
        Chip8Cow.create seed |> Chip8Cow.loadRom rom

    /// Perform a flat state space search over the navigation ROM space to reach a goal.
    let flatSearch (cyclesPerFrame: int) (maxStates: int) (f0: Chip8Cow.Frame) (goalPos: int * int) : StateSpace.Graph =
        let invariant = fun _ -> true
        StateSpace.exploreKeyed keyOf invariant cyclesPerFrame maxStates actions f0

    let private blockNeighbors (br: int, bc: int) (nb: int) : (int * int) list =
        [ (br - 1, bc); (br + 1, bc); (br, bc - 1); (br, bc + 1) ]
        |> List.filter (fun (r, c) -> r >= 0 && r < nb && c >= 0 && c < nb)

    let private getBlockCoords (row: int, col: int) (blockSize: int) : int * int =
        (row / blockSize, col / blockSize)

    let private gistOfBlock (br: int) (bc: int) (blockSize: int) : Gist =
        Gist.create (br * blockSize) (br * blockSize + blockSize - 1) (bc * blockSize) (bc * blockSize + blockSize - 1)

    /// Estimates the state exploration cost (action) for different block sizes.
    /// leastActionSelect returns the block size that minimizes the estimated cost.
    let leastActionSelect (n: int) (d: int) (availableBlockSizes: int list) : int =
        let estimateCost (b: int) =
            if b = n then
                float (n * n)
            else
                let nb = n / b
                float (nb * nb + d * b)
        availableBlockSizes |> List.minBy estimateCost

    /// Runs coarse BFS to find block path from start block to goal block, avoiding blocked transitions.
    let coarsePlan (nb: int) (startBlock: int * int) (goalBlock: int * int) (blockedTransitions: HashSet<(int*int) * (int*int)>) : (int * int) list option =
        let pred = Dictionary<int * int, int * int>()
        let seen = HashSet<int * int>()
        let q = Queue<int * int>()
        seen.Add startBlock |> ignore
        q.Enqueue startBlock
        let mutable found = false
        while q.Count > 0 && not found do
            let u = q.Dequeue()
            if u = goalBlock then found <- true
            else
                for v in blockNeighbors u nb do
                    if not (blockedTransitions.Contains(u, v)) && seen.Add v then
                        pred.[v] <- u
                        q.Enqueue v
        if not found then None
        else
            let rec back node acc =
                if node = startBlock then startBlock :: acc else back pred.[node] (node :: acc)
            Some (back goalBlock [])

    /// Co-empowered hierarchical planning. If a fine-level search fails or is starved, we block
    /// the corresponding coarse transition and replan.
    /// Returns:
    ///   - Ok (totalStatesExplored, plan)
    ///   - Error (starvation/uncertainty message)
    let planHierarchical
        (cyclesPerFrame: int)
        (maxStatesPerSearch: int)
        (f0: Chip8Cow.Frame)
        (goalPos: int * int)
        (blockSize: int)
        (gridSize: int)
        : Result<int * bool[] list, string> =
        
        let startRow, startCol = int f0.V.[0], int f0.V.[1]
        let goalRow, goalCol = goalPos
        let nb = gridSize / blockSize
        let startBlock = getBlockCoords (startRow, startCol) blockSize
        let goalBlock = getBlockCoords (goalRow, goalCol) blockSize
        
        let blockedTransitions = HashSet<(int*int) * (int*int)>()
        let mutable totalExplored = 0
        let mutable overallPlan = []
        let mutable success = false
        let mutable tempFrame = f0
        let mutable attempts = 0
        let maxAttempts = 10
        
        while not success && attempts < maxAttempts do
            attempts <- attempts + 1
            match coarsePlan nb startBlock goalBlock blockedTransitions with
            | None -> attempts <- maxAttempts // No path exists
            | Some coarsePath ->
                let mutable pathValid = true
                let localPlan = ResizeArray<bool[]>()
                tempFrame <- f0
                
                let rec walk blocks =
                    match blocks with
                    | [] -> ()
                    | [ _last ] ->
                        let curBlockCoord = getBlockCoords (int tempFrame.V.[0], int tempFrame.V.[1]) blockSize
                        let gist = gistOfBlock (fst curBlockCoord) (snd curBlockCoord) blockSize
                        let inBlock = Gist.unpack gist
                        let g = StateSpace.exploreKeyed keyOf inBlock cyclesPerFrame maxStatesPerSearch actions tempFrame
                        totalExplored <- totalExplored + g.StateCount
                        
                        if g.Truncated && not (g.Frames |> Array.exists (isGoal goalPos)) then
                            pathValid <- false
                        else
                            match StateSpace.planTo (isGoal goalPos) g with
                            | Some plan -> localPlan.AddRange plan
                            | None -> pathValid <- false
                    | bi :: (binext :: _ as rest) ->
                        let br, bc = bi
                        let nbr, nbc = binext
                        let cr = int tempFrame.V.[0]
                        let cc = int tempFrame.V.[1]
                        
                        // Crossing is to an adjacent block (super-grid BFS => +-1 in one axis)
                        // Pick exit/entry border cells
                        let exitCell, _entryNext =
                            if nbc = bc + 1 then (cr, bc * blockSize + blockSize - 1), (cr, nbc * blockSize) // right
                            elif nbc = bc - 1 then (cr, bc * blockSize), (cr, nbc * blockSize + blockSize - 1) // left
                            elif nbr = br + 1 then (br * blockSize + blockSize - 1, cc), (nbr * blockSize, cc) // down
                            else (br * blockSize, cc), (nbr * blockSize + blockSize - 1, cc) // up
                            
                        let gist = gistOfBlock br bc blockSize
                        let inBlock = Gist.unpack gist
                        let g = StateSpace.exploreKeyed keyOf inBlock cyclesPerFrame maxStatesPerSearch actions tempFrame
                        totalExplored <- totalExplored + g.StateCount
                        
                        if g.Truncated && not (g.Frames |> Array.exists (isGoal exitCell)) then
                            pathValid <- false
                            blockedTransitions.Add(bi, binext) |> ignore
                        else
                            match StateSpace.planTo (isGoal exitCell) g with
                            | Some plan ->
                                localPlan.AddRange plan
                                let mutable nextF = tempFrame
                                for stepKeys in plan do
                                    nextF <- Chip8Cow.frameStep cyclesPerFrame { nextF with Keys = stepKeys }
                                
                                // Press the key corresponding to entryNext to cross the boundary
                                let crossingKeys =
                                    if nbc = bc + 1 then directionToKeys ActionGrid.Direction.Right
                                    elif nbc = bc - 1 then directionToKeys ActionGrid.Direction.Left
                                    elif nbr = br + 1 then directionToKeys ActionGrid.Direction.Down
                                    else directionToKeys ActionGrid.Direction.Up
                                
                                let entryF = Chip8Cow.frameStep cyclesPerFrame { nextF with Keys = crossingKeys }
                                localPlan.Add crossingKeys
                                tempFrame <- entryF
                                walk rest
                            | None ->
                                pathValid <- false
                                blockedTransitions.Add(bi, binext) |> ignore
                                
                walk coarsePath
                if pathValid then
                    success <- true
                    overallPlan <- List.ofSeq localPlan
                    
        if success then
            Ok (totalExplored, overallPlan)
        else
            Error "Starved or path blocked: could not find a valid hierarchical plan within budget."
