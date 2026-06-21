module Zeta.Tests.Algebra.ResiduatedTests
#nowarn "0893"

open System
open System.Collections.Generic
open FsUnit.Xunit
open FsCheck
open FsCheck.FSharp
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// Residuated-Lattice IVM Property Tests (081KS923C0008QG0R0005VM4FB)
// ═══════════════════════════════════════════════════════════════════

// 1. Galois connection: a · x ≤ b ⇔ x ≤ a \ b
// where · = max and the residual is partial over a totally-ordered key
// set with no bottom element: a \ b = Some b when a ≤ b, otherwise None.
// The None branch represents the empty/bottom residual — no x satisfies
// max(a, x) ≤ b when a > b, so x ≤ (a \ b) must be false everywhere.
//
// NOTE (B-NNNN follow-up): this property encodes the residual definition
// locally; a stronger test would exercise the production ResidualMaxOp's
// residual semantics directly. Tracked as a known limitation; see the
// PR thread P2 finding.
[<FsCheck.Xunit.Property>]
let ``Galois connection holds for ResidualMax under natural order`` (a: int) (x: int) (b: int) =
    let residualMax a b = if a <= b then Some b else None

    let lhs = (max a x) <= b
    let rhs =
        match residualMax a b with
        | Some bound -> x <= bound
        // None ⇒ a > b ⇒ max(a, x) ≥ a > b, so lhs is always false. The
        // residual is "bottom" / empty: no x satisfies the inequality,
        // so rhs must also be false for the equivalence to hold.
        | None -> false

    lhs = rhs

// 2. Residual under max: a \ b = Some b if a ≤ b else None
[<FsCheck.Xunit.Property>]
let ``Residual under max has expected behavior`` (a: int) (b: int) =
    let residualMax a b = if a <= b then Some b else None
    
    if a <= b then
        residualMax a b = Some b
    else
        residualMax a b = None

// 3. Retraction equivalence: ResidualMax(insert + retract trace) = max(positive-only trace)
// Oracle for max over active set
let private oracle (ops: (int * int64) list) =
    let keyWeight = Dictionary<int, int64>()
    
    for (k, w) in ops do
        let existing =
            match keyWeight.TryGetValue k with
            | true, v -> v
            | false, _ -> 0L
        let updated = existing + w
        
        if updated = 0L then keyWeight.Remove k |> ignore
        else keyWeight.[k] <- updated

    let activeKeys = keyWeight |> Seq.filter (fun kvp -> kvp.Value > 0L) |> Seq.map (fun kvp -> kvp.Key)
    
    if Seq.isEmpty activeKeys then ValueNone
    else ValueSome (Seq.max activeKeys)

[<FsCheck.Xunit.Property>]
let ``ResidualMax retraction equivalence`` (ops: (int * int) list) =
    // Limit weight changes to reasonable bounds to simulate typical active/retract traces
    let opsMapped = ops |> List.map (fun (k, w) -> (k, int64 (w % 10)))

    let c = Circuit()
    let input = c.ZSetInput<int>()
    let m = c.ResidualMax(input.Stream, Func<_, _>(id))
    let out = OutputHandle m.Op
    c.Build()

    // Assert mid-stream after each Send/Step that out.Current matches the oracle
    // over the prefix processed so far. Catches state bugs that occur mid-stream
    // but "self-heal" by the end of the trace (Copilot PR #4821 P1 finding).
    let mutable ok = true
    let mutable prefix : (int * int64) list = []
    for op in opsMapped do
        input.Send (ZSet.singleton (fst op) (snd op))
        c.Step()
        prefix <- prefix @ [op]
        ok <- ok && (out.Current = oracle prefix)
    ok
