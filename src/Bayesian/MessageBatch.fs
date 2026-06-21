namespace Zeta.Bayesian

open Apache.Arrow
open Apache.Arrow.Types

/// # Columnar message batches — Apache Arrow in-memory store for
/// bit-efficient message passing of state (081KT2T2J0008QG0R000S7GHQ8)
///
/// A batch of N messages of one exponential family, stored as
/// **struct-of-arrays in NATURAL parameters**: K columns, each a
/// length-N `float[]`. In natural parameters message **product = column-
/// wise ADD** and **divide = column-wise SUBTRACT**, so batched message
/// passing is a contiguous, SIMD-friendly vector op — and the columns map
/// 1:1 onto Apache Arrow `DoubleArray`s for the in-memory columnar store
/// + zero-copy, cross-language transfer (composes `ArrowSerializer`).
///
/// Each family supplies an `IColumnar<'M>` adapter (its natural-parameter
/// columns): Gaussian = `(ν, τ)` (identity); Beta = `(α-1, β-1)`;
/// Bernoulli = `log-odds`. The columnar `product`/`divide` agree with the
/// scalar `Message` ops on the VALUE, within float tolerance (property-
/// tested: 081KT2T2J0008QG0R000YZ3NMY C11). They are bit-exact only for **Gaussian** (identity
/// columns, same adds in the same order); for **Beta** they differ by
/// last-ULP reassociation ((α-1)+(α'-1)+1 vs α+α'-1), and for **Bernoulli**
/// by representation (scalar product is computed in probability space
/// `t/(t+f)`, the column is log-odds add) — value-equivalent, not bit-equal.

/// A columnar batch in natural parameters: `Columns.[k].[i]` is the k-th
/// natural parameter of the i-th message. `product`/`divide` are
/// column-wise vector add/subtract.
type NaturalBatch =
    { Columns: float[][] }

    /// Number of messages in the batch (N).
    member this.Count = if this.Columns.Length = 0 then 0 else this.Columns.[0].Length

    /// Natural-parameter dimension (K = number of columns).
    member this.Dim = this.Columns.Length

/// Per-family columnar adapter: the family's natural-parameter columns
/// and the round-trip to/from the message array. (cf. `IMessage` — the
/// scalar dictionary; this is the columnar twin.)
type IColumnar<'M> =
    abstract Dim : int
    abstract ColumnNames : string[]
    abstract ToColumns : 'M[] -> float[][]
    abstract OfColumns : float[][] -> 'M[]

[<RequireQualifiedAccess>]
module Columnar =

    /// Gaussian columns = the natural parameters `(ν, τ)` directly.
    let gaussian : IColumnar<Gaussian> =
        { new IColumnar<Gaussian> with
            member _.Dim = 2
            member _.ColumnNames = [| "precisionMean"; "precision" |]
            member _.ToColumns gs =
                [| Array.map (fun (g: Gaussian) -> g.PrecisionMean) gs
                   Array.map (fun (g: Gaussian) -> g.Precision) gs |]
            member _.OfColumns cols =
                Array.init (if cols.Length = 0 then 0 else cols.[0].Length) (fun i ->
                    { PrecisionMean = cols.[0].[i]; Precision = cols.[1].[i] }) }

    /// Beta columns = natural parameters `(α-1, β-1)` so product is a
    /// raw column add (α_prod = α+α'-1 falls out on round-trip).
    let beta : IColumnar<Beta> =
        { new IColumnar<Beta> with
            member _.Dim = 2
            member _.ColumnNames = [| "alphaMinus1"; "betaMinus1" |]
            member _.ToColumns bs =
                [| Array.map (fun (d: Beta) -> d.Alpha - 1.0) bs
                   Array.map (fun (d: Beta) -> d.Beta - 1.0) bs |]
            member _.OfColumns cols =
                Array.init (if cols.Length = 0 then 0 else cols.[0].Length) (fun i ->
                    { Alpha = cols.[0].[i] + 1.0; Beta = cols.[1].[i] + 1.0 }) }

    /// Bernoulli column = the natural parameter, the log-odds
    /// `log(p/(1-p))`, so product is a raw column add (= adding log-odds).
    let bernoulli : IColumnar<Bernoulli> =
        { new IColumnar<Bernoulli> with
            member _.Dim = 1
            member _.ColumnNames = [| "logOdds" |]
            member _.ToColumns bs =
                [| Array.map (fun (b: Bernoulli) -> log (b.ProbTrue / (1.0 - b.ProbTrue))) bs |]
            member _.OfColumns cols =
                Array.init (if cols.Length = 0 then 0 else cols.[0].Length) (fun i ->
                    { ProbTrue = 1.0 / (1.0 + exp (-cols.[0].[i])) }) }

[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module NaturalBatch =

    /// Pack a message array into a columnar batch (its natural-parameter
    /// columns).
    let ofMessages (c: IColumnar<'M>) (msgs: 'M[]) : NaturalBatch = { Columns = c.ToColumns msgs }

    /// Unpack a columnar batch back into messages.
    let toMessages (c: IColumnar<'M>) (b: NaturalBatch) : 'M[] = c.OfColumns b.Columns

    /// Batched message **product** = column-wise vector ADD (natural
    /// parameters). Agrees with the scalar `product` element-wise on the
    /// VALUE within float tolerance (081KT2T2J0008QG0R000YZ3NMY C11; bit-exact for Gaussian,
    /// value-equal for Beta/Bernoulli) — and SIMD-friendly over the
    /// contiguous columns.
    let product (a: NaturalBatch) (b: NaturalBatch) : NaturalBatch =
        { Columns = Array.map2 (fun (x: float[]) (y: float[]) -> Array.map2 (+) x y) a.Columns b.Columns }

    /// Batched message **divide** (EP cavity) = column-wise vector
    /// SUBTRACT.
    let divide (a: NaturalBatch) (b: NaturalBatch) : NaturalBatch =
        { Columns = Array.map2 (fun (x: float[]) (y: float[]) -> Array.map2 (-) x y) a.Columns b.Columns }

    /// To an Apache Arrow `RecordBatch` — one `DoubleArray` column per
    /// natural parameter (the in-memory columnar store; zero-copy,
    /// cross-language, SIMD-friendly).
    let toRecordBatch (names: string[]) (b: NaturalBatch) : RecordBatch =
        let fields = names |> Array.map (fun n -> Field(n, DoubleType.Default, nullable = false))
        let schema = Schema(fields, null)
        let arrays =
            b.Columns
            |> Array.map (fun col ->
                let builder = DoubleArray.Builder()
                for v in col do
                    builder.Append(v) |> ignore
                builder.Build() :> IArrowArray)
        new RecordBatch(schema, arrays, b.Count)

    /// From an Apache Arrow `RecordBatch` of `DoubleArray` columns.
    let ofRecordBatch (rb: RecordBatch) : NaturalBatch =
        let cols =
            Array.init rb.ColumnCount (fun k ->
                let arr = rb.Column k :?> DoubleArray
                Array.init arr.Length (fun i -> arr.GetValue(i).Value))
        { Columns = cols }
