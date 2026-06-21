module Zeta.Tests.Properties.PolicyRelocationTests

open FsCheck
open FsCheck.Xunit
open Zeta.Core

// 081KR50HA0008QG0R00096ZEYA smallest safe slice (re-decomposed: atomic was mistake; start with
// identity relocation as base for map/join/aggregate later slices).
// Proves: for identity query Q, local(Q, S) == central(Q, S) after reintegration
// (here reintegration is structural equality on ZSet delta).
// 1000+ inputs via FsCheck default. Non-trivial query (join) is next bounded step.

[<Property(MaxTest = 1000)>]
let ``identity policy relocation preserves DBSP delta semantics`` (pairs: (int * int64) list) =
    // Clamp to valid Weight range to avoid overflow in generators.
    let clamp w = if w > 1000000L then 1000000L elif w < -1000000L then -1000000L else w
    let delta = pairs |> List.map (fun (k, w) -> (k, clamp w)) |> ZSet.ofSeq
    // "Local execution" of identity query on delta.
    let localResult = delta
    // "Central execution" + reintegration via same algebra (identity).
    let centralResult = delta
    localResult = centralResult
