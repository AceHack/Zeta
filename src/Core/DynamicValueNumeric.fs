namespace Zeta.Core

/// **Numerics inside `DynamicValue` — Result-typed, total, no silent coercion (Aaron 2026-06-07).**
/// Arithmetic over the numeric leaves (`Int`/`Float`): `Int+Int = Int`; `Int`↔`Float` **widens** to `Float`;
/// `Null` is the **additive identity** (acts as 0, so `add Null x = x`) and the **multiplicative annihilator**
/// (`mul Null x = Null`, i.e. ×0 = 0); `Int 1` is the multiplicative identity. Every other shape
/// (`Bool`/`String`/`Bytes`/`Array`/`Object`) or mixed pair **declines with `Error`** — never a silent
/// coercion, never an exception on the hot path (integer overflow is caught and returned as `Error`).
///
/// This is the leaf-numeric algebra *inside* `DynamicValue`. It is a **partial ring expressed total via
/// `Result`** — so it is deliberately NOT an `ISemiring<DynamicValue>` (the interface mandates total
/// `Add`/`Mul`). The .NET generic-math interfaces (`IAdditionOperators` etc.) likewise want *total*
/// operators returning the element type, so they are not applied here; a `DvNumber` newtype could carry them
/// later if ever wanted (the deferred "numeric-only newtype" option). Complements
/// `DynamicValueAlgebra.mergeSemilattice` (the merge/LWW semilattice) — different algebra, same value.
[<RequireQualifiedAccess>]
module DynamicValueNumeric =

    /// Why a numeric op declined.
    type NumericError =
        /// A binary op got a shape pair it has no rule for (e.g. `String` + `Int`).
        | TypeMismatch of op: string * left: string * right: string
        /// A unary op got a non-numeric shape.
        | NotNumeric of op: string * shape: string
        /// An integer op overflowed `int64` (caught, not thrown).
        | Overflow of op: string

    let private shapeName =
        function
        | DynamicValue.Null -> "Null"
        | DynamicValue.Bool _ -> "Bool"
        | DynamicValue.Int _ -> "Int"
        | DynamicValue.Float _ -> "Float"
        | DynamicValue.String _ -> "String"
        | DynamicValue.Bytes _ -> "Bytes"
        | DynamicValue.Array _ -> "Array"
        | DynamicValue.Object _ -> "Object"

    /// Additive identity (0).
    let zero: DynamicValue = DynamicValue.Null

    /// Multiplicative identity (1).
    let one: DynamicValue = DynamicValue.Int 1L

    /// `a + b` over numeric leaves; `Null` is identity; `Int`↔`Float` widens; else `Error`.
    let add (a: DynamicValue) (b: DynamicValue) : Result<DynamicValue, NumericError> =
        match a, b with
        | DynamicValue.Null, x
        | x, DynamicValue.Null -> Ok x // 0 identity
        | DynamicValue.Int x, DynamicValue.Int y ->
            try
                Ok(DynamicValue.Int(Checked.(+) x y))
            with :? System.OverflowException ->
                Error(Overflow "add")
        | DynamicValue.Float x, DynamicValue.Float y -> Ok(DynamicValue.Float(x + y))
        | DynamicValue.Int x, DynamicValue.Float y -> Ok(DynamicValue.Float(float x + y)) // widen
        | DynamicValue.Float x, DynamicValue.Int y -> Ok(DynamicValue.Float(x + float y))
        | _ -> Error(TypeMismatch("add", shapeName a, shapeName b))

    /// `a * b` over numeric leaves; `Null` annihilates (×0 = 0); `Int`↔`Float` widens; else `Error`.
    let mul (a: DynamicValue) (b: DynamicValue) : Result<DynamicValue, NumericError> =
        match a, b with
        | DynamicValue.Null, _
        | _, DynamicValue.Null -> Ok DynamicValue.Null // ×0 = 0 (annihilator)
        | DynamicValue.Int x, DynamicValue.Int y ->
            try
                Ok(DynamicValue.Int(Checked.(*) x y))
            with :? System.OverflowException ->
                Error(Overflow "mul")
        | DynamicValue.Float x, DynamicValue.Float y -> Ok(DynamicValue.Float(x * y))
        | DynamicValue.Int x, DynamicValue.Float y -> Ok(DynamicValue.Float(float x * y)) // widen
        | DynamicValue.Float x, DynamicValue.Int y -> Ok(DynamicValue.Float(x * float y))
        | _ -> Error(TypeMismatch("mul", shapeName a, shapeName b))

    /// Additive inverse over numeric leaves; `Null` → `Null` (−0 = 0); else `Error`.
    let negate (a: DynamicValue) : Result<DynamicValue, NumericError> =
        match a with
        | DynamicValue.Null -> Ok DynamicValue.Null
        | DynamicValue.Int x ->
            try
                Ok(DynamicValue.Int(Checked.(~-) x))
            with :? System.OverflowException ->
                Error(Overflow "negate") // Int64.MinValue
        | DynamicValue.Float x -> Ok(DynamicValue.Float(-x))
        | other -> Error(NotNumeric("negate", shapeName other))

    /// `a - b` = `a + (-b)`.
    let subtract (a: DynamicValue) (b: DynamicValue) : Result<DynamicValue, NumericError> =
        negate b |> Result.bind (add a)

    /// Sum a sequence under `add`, from `zero`; short-circuits on the first `Error`.
    let sum (xs: DynamicValue seq) : Result<DynamicValue, NumericError> =
        (Ok zero, xs)
        ||> Seq.fold (fun acc x -> acc |> Result.bind (fun a -> add a x))

    /// **Shader-lowerable sibling — total, no Result, no escaping exceptions (the GPU-idiom variant).**
    /// Same widening + `Null`-identity/annihilator rules as the Result variant, but **total**: integer
    /// overflow **saturates** (clamp to `Int64.MinValue/MaxValue`) and any out-of-domain pair (non-numeric or
    /// mixed) **poisons** to `Float NaN`, which then propagates through later float ops — exactly GPU
    /// saturating-arithmetic + NaN-propagation. No `Result`, no thrown exception escapes (the internal
    /// overflow probe is caught), so the *semantics* lower to a shader.
    ///
    /// Caveat: `DynamicValue` itself is a heap DU and is never the GPU carrier — actual shader execution runs
    /// these rules on the **flat dense tensor leaf** (`Tensor<T>` / numeric `WeightedSet` buffer). This module
    /// is the CPU stand-in defining *which* rules the shader path uses; pick the Result variant for
    /// correctness/audit, this one for the GPU-lowerable hot path.
    [<RequireQualifiedAccess>]
    module Sat =

        let private poison = DynamicValue.Float nan

        let private satAddI (x: int64) (y: int64) : int64 =
            try
                Checked.(+) x y
            with :? System.OverflowException ->
                if x > 0L then System.Int64.MaxValue else System.Int64.MinValue

        let private satMulI (x: int64) (y: int64) : int64 =
            try
                Checked.(*) x y
            with :? System.OverflowException ->
                if (x > 0L) = (y > 0L) then System.Int64.MaxValue else System.Int64.MinValue

        /// Total `a + b`: `Null` identity; `Int`↔`Float` widen; int overflow saturates; else NaN-poison.
        let add (a: DynamicValue) (b: DynamicValue) : DynamicValue =
            match a, b with
            | DynamicValue.Null, x
            | x, DynamicValue.Null -> x
            | DynamicValue.Int x, DynamicValue.Int y -> DynamicValue.Int(satAddI x y)
            | DynamicValue.Float x, DynamicValue.Float y -> DynamicValue.Float(x + y)
            | DynamicValue.Int x, DynamicValue.Float y -> DynamicValue.Float(float x + y)
            | DynamicValue.Float x, DynamicValue.Int y -> DynamicValue.Float(x + float y)
            | _ -> poison

        /// Total `a * b`: `Null` annihilates (×0=0); widen; int overflow saturates; else NaN-poison.
        let mul (a: DynamicValue) (b: DynamicValue) : DynamicValue =
            match a, b with
            | DynamicValue.Null, _
            | _, DynamicValue.Null -> DynamicValue.Null
            | DynamicValue.Int x, DynamicValue.Int y -> DynamicValue.Int(satMulI x y)
            | DynamicValue.Float x, DynamicValue.Float y -> DynamicValue.Float(x * y)
            | DynamicValue.Int x, DynamicValue.Float y -> DynamicValue.Float(float x * y)
            | DynamicValue.Float x, DynamicValue.Int y -> DynamicValue.Float(x * float y)
            | _ -> poison

        /// Total negate: `Null`→`Null`; `Int.MinValue` saturates to `MaxValue`; non-numeric → NaN-poison.
        let negate (a: DynamicValue) : DynamicValue =
            match a with
            | DynamicValue.Null -> DynamicValue.Null
            | DynamicValue.Int x -> DynamicValue.Int(if x = System.Int64.MinValue then System.Int64.MaxValue else -x)
            | DynamicValue.Float x -> DynamicValue.Float(-x)
            | _ -> poison

        /// Total sum from `zero` (NaN, once introduced, propagates — no short-circuit).
        let sum (xs: DynamicValue seq) : DynamicValue = Seq.fold add zero xs
