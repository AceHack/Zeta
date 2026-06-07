module Zeta.Tests.DynamicValueNumericTests

open global.Xunit
open Zeta.Core

module N = Zeta.Core.DynamicValueNumeric

let private i n = DynamicValue.Int n
let private f x = DynamicValue.Float x

// ── Result-typed variant (CPU / correctness) ──────────────────────────────────

[<Fact>]
let ``add: Int+Int, widen Int+Float, Null identity`` () =
    Assert.Equal<Result<DynamicValue, _>>(Ok(i 5L), N.add (i 2L) (i 3L))
    Assert.Equal<Result<DynamicValue, _>>(Ok(f 3.0), N.add (i 2L) (f 1.0)) // widen
    Assert.Equal<Result<DynamicValue, _>>(Ok(i 7L), N.add DynamicValue.Null (i 7L)) // 0 identity
    Assert.Equal<Result<DynamicValue, _>>(Ok(i 7L), N.add (i 7L) DynamicValue.Null)

[<Fact>]
let ``add: type mismatch declines, no silent coercion`` () =
    match N.add (DynamicValue.String "a") (i 1L) with
    | Error(N.TypeMismatch("add", "String", "Int")) -> ()
    | other -> Assert.Fail $"expected TypeMismatch, got {other}"

[<Fact>]
let ``add: integer overflow is a caught Error, never a throw`` () =
    match N.add (i System.Int64.MaxValue) (i 1L) with
    | Error(N.Overflow "add") -> ()
    | other -> Assert.Fail $"expected Overflow, got {other}"

[<Fact>]
let ``mul: Null annihilates; one is identity; negate and subtract`` () =
    Assert.Equal<Result<DynamicValue, _>>(Ok DynamicValue.Null, N.mul DynamicValue.Null (i 9L)) // ×0=0
    Assert.Equal<Result<DynamicValue, _>>(Ok(i 9L), N.mul N.one (i 9L)) // ×1=x
    Assert.Equal<Result<DynamicValue, _>>(Ok(i -4L), N.negate (i 4L))
    Assert.Equal<Result<DynamicValue, _>>(Ok(i 3L), N.subtract (i 10L) (i 7L))
    match N.negate (DynamicValue.String "x") with
    | Error(N.NotNumeric("negate", "String")) -> ()
    | other -> Assert.Fail $"expected NotNumeric, got {other}"

[<Fact>]
let ``sum folds and short-circuits on the first Error`` () =
    Assert.Equal<Result<DynamicValue, _>>(Ok(i 6L), N.sum [ i 1L; i 2L; i 3L ])
    match N.sum [ i 1L; DynamicValue.Bool true; i 3L ] with
    | Error _ -> ()
    | Ok _ -> Assert.Fail "expected the Bool to decline the sum"

// ── Saturating / shader-lowerable variant ─────────────────────────────────────

[<Fact>]
let ``Sat.add: integer overflow saturates (clamp), never errors`` () =
    Assert.Equal<DynamicValue>(i System.Int64.MaxValue, N.Sat.add (i System.Int64.MaxValue) (i 1L))
    Assert.Equal<DynamicValue>(i System.Int64.MinValue, N.Sat.add (i System.Int64.MinValue) (i -1L))
    Assert.Equal<DynamicValue>(i 5L, N.Sat.add (i 2L) (i 3L)) // normal case still exact

[<Fact>]
let ``Sat: out-of-domain poisons to NaN and propagates`` () =
    let poisoned = N.Sat.add (DynamicValue.String "a") (i 1L)

    match poisoned with
    | DynamicValue.Float x -> Assert.True(System.Double.IsNaN x)
    | other -> Assert.Fail $"expected NaN poison, got {other}"

    // NaN propagates through a subsequent op
    match N.Sat.add poisoned (i 10L) with
    | DynamicValue.Float x -> Assert.True(System.Double.IsNaN x)
    | other -> Assert.Fail $"expected NaN to propagate, got {other}"

[<Fact>]
let ``Sat: Null identity/annihilator and widening match the Result variant on the happy path`` () =
    Assert.Equal<DynamicValue>(i 7L, N.Sat.add DynamicValue.Null (i 7L)) // identity
    Assert.Equal<DynamicValue>(DynamicValue.Null, N.Sat.mul DynamicValue.Null (i 9L)) // annihilator
    Assert.Equal<DynamicValue>(f 3.0, N.Sat.add (i 2L) (f 1.0)) // widen
    Assert.Equal<DynamicValue>(i -4L, N.Sat.negate (i 4L))
    // Int.MinValue negate saturates instead of overflowing
    Assert.Equal<DynamicValue>(i System.Int64.MaxValue, N.Sat.negate (i System.Int64.MinValue))
