namespace Zeta.Core

/// IbltReconcile — **O(|Δ|) set reconciliation between rooms** (Aaron 2026-06-13: "yep lets do
/// this" — the named slice from the fingerprint↔factor-graph capture). An Invertible Bloom
/// Lookup Table (Goodrich & Mitzenmacher 2011): each side summarizes its key set into m cells
/// (count, keySum, hashSum) under k deterministic hash functions; SUBTRACT the two tables and the
/// difference table encodes exactly the symmetric difference; PEEL pure cells to recover it.
///
/// THE PEELING IS BELIEF PROPAGATION WITH HARD MESSAGES — the same decoder family as LDPC
/// (Gallager 1962) and fountain codes (Luby): a "pure" cell is a factor with one unresolved
/// neighbor; resolving it sends a hard message that may purify others. This module is the
/// meeting point of our forward fingerprints and our inverse factor graphs, running as code.
///
/// Disciplines: DST (SplitMix64 with FIXED seeds — same sets, same cells, byte-stable);
/// exact integers (XOR sums, no floats); Result-over-exception (an undersized table yields
/// `Partial` — the recovered prefix plus the honest flag — NEVER a wrong answer or a throw);
/// O(|Δ|) decode (cells ~ 1.5–2× |Δ|, k=3 — the standard regime).
[<RequireQualifiedAccess>]
module IbltReconcile =

    /// One cell: how many keys landed here (signed after subtraction), XOR of keys, XOR of key-hashes.
    type Cell = { Count: int; KeySum: uint64; HashSum: uint64 }

    /// The table: cells + the fixed geometry (cells.Length, k) — both sides MUST agree on geometry.
    type Table = { Cells: Cell[]; K: int }

    let private emptyCell = { Count = 0; KeySum = 0UL; HashSum = 0UL }

    // deterministic mixers (SplitMix64 family; fixed seeds = the DST treaty)
    let private mix (seed: uint64) (z0: uint64) : uint64 =
        let z = (z0 ^^^ seed) + 0x9E3779B97F4A7C15UL
        let z = (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9UL
        let z = (z ^^^ (z >>> 27)) * 0x94D049BB133111EBUL
        z ^^^ (z >>> 31)

    /// The check-hash guarding purity (seed disjoint from bucket seeds).
    let private checkHash (key: uint64) : uint64 = mix 0xC0FFEEUL key

    /// The k bucket indices for a key — PARTITIONED sub-tables (the standard IBLT geometry:
    /// segment i gets one bucket, so a key's k cells are DISTINCT by construction; the naive
    /// k-hashes-over-one-range version let two hashes land on the same cell, double-XORing the
    /// key into it — which CANCELS it and strands the peeling; caught by the first test run).
    let private buckets (k: int) (cells: int) (key: uint64) : int list =
        let seg = max 1 (cells / k)
        [ for i in 0 .. k - 1 -> i * seg + int (mix (uint64 (0xB000 + i)) key % uint64 seg) ]

    /// Build a table from a key set. Geometry: `cells` should be ≥ ~2× the EXPECTED difference
    /// (not the set size — that is the whole point); k = 3 is the standard regime.
    let build (cells: int) (k: int) (keys: seq<uint64>) : Table =
        let arr = Array.create (max 1 cells) emptyCell
        for key in keys do
            for b in buckets k arr.Length key do
                let c = arr.[b]
                arr.[b] <- { Count = c.Count + 1; KeySum = c.KeySum ^^^ key; HashSum = c.HashSum ^^^ checkHash key }
        { Cells = arr; K = k }

    /// Cell-wise subtraction: the result encodes the symmetric difference of the two key sets
    /// (shared keys cancel exactly — XOR and count both annihilate).
    let subtract (a: Table) (b: Table) : Table =
        { a with
            Cells =
                Array.init a.Cells.Length (fun i ->
                    { Count = a.Cells.[i].Count - b.Cells.[i].Count
                      KeySum = a.Cells.[i].KeySum ^^^ b.Cells.[i].KeySum
                      HashSum = a.Cells.[i].HashSum ^^^ b.Cells.[i].HashSum }) }

    /// The decode outcome — total and honest: `Partial` carries what WAS recovered plus the fact
    /// that cells remain (undersized table / hash collision residue); never a wrong answer.
    type Reconciliation =
        | Decoded of onlyInA: uint64 list * onlyInB: uint64 list
        | Partial of onlyInA: uint64 list * onlyInB: uint64 list * cellsRemaining: int

    /// PEEL the difference table (BP with hard messages): a pure cell (count ±1 and the check
    /// hash matches its keySum) yields one key for one side; remove it everywhere; repeat until
    /// the table empties (Decoded) or no pure cell remains (Partial — honest).
    let peel (diff: Table) : Reconciliation =
        let arr = Array.copy diff.Cells
        let onlyA = ResizeArray<uint64>()
        let onlyB = ResizeArray<uint64>()

        let isPure (c: Cell) =
            (c.Count = 1 || c.Count = -1) && checkHash c.KeySum = c.HashSum

        let remove (key: uint64) (sign: int) =
            for b in buckets diff.K arr.Length key do
                let c = arr.[b]
                arr.[b] <- { Count = c.Count - sign; KeySum = c.KeySum ^^^ key; HashSum = c.HashSum ^^^ checkHash key }

        let mutable progressing = true
        while progressing do
            progressing <- false
            for i in 0 .. arr.Length - 1 do
                let c = arr.[i]
                if isPure c then
                    let key = c.KeySum
                    if c.Count = 1 then onlyA.Add key else onlyB.Add key
                    remove key c.Count
                    progressing <- true

        let remaining = arr |> Array.filter (fun c -> c.Count <> 0 || c.KeySum <> 0UL || c.HashSum <> 0UL) |> Array.length
        let a = onlyA |> List.ofSeq |> List.sort
        let b = onlyB |> List.ofSeq |> List.sort
        if remaining = 0 then Decoded(a, b) else Partial(a, b, remaining)

    /// The whole protocol in one call: each room builds, one subtract, one peel — O(|Δ|) wire
    /// cost (the tables, sized to the difference) and O(|Δ|) decode.
    let reconcile (cells: int) (k: int) (roomA: seq<uint64>) (roomB: seq<uint64>) : Reconciliation =
        peel (subtract (build cells k roomA) (build cells k roomB))
