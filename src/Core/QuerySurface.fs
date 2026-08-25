namespace Zeta.Core.QuerySurface

open System
open System.Collections.Generic
open System.Text
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════════
//  QuerySurface — ONE logical plan, many front ends, two execution modes.
//
//  STATUS: **toy** (`.claude/rules/toy-is-free-metered-must-be-earned.md`).
//  Every public name here is prefixed `Toy*` or lives under the
//  `QuerySurface` namespace and is documented EXPERIMENTAL. It earns
//  `unmetered` only when a consumer outside the tests uses it, and
//  `metered` only when the mode-equivalence law below is checked against
//  a real workload rather than the hand-built fixtures in
//  `QuerySurface.Equivalence.Tests.fs`.
//
//  ── The one idea ────────────────────────────────────────────────────
//  A table is a materialized stream; a stream is the changelog of a
//  table (the stream/table duality). So there is no "SQL surface" and a
//  separate "streaming surface" — there is ONE surface, and two ways to
//  execute the plan it produces:
//
//    Batch      — feed the whole relation as a single delta at tick 1.
//                 The tick-1 output IS the answer. Answers a question.
//    Streaming  — feed the relation as a sequence of deltas. Each tick
//                 emits the CHANGE to the answer. Installs a standing
//                 subscription.
//
//  The law that makes them one thing, and the falsifier this file exists
//  to earn (`ToyPlan.modeEquivalence` in the tests):
//
//      batch(R)  ==  Σ_t streaming(ΔR_t)      where R = Σ_t ΔR_t
//
//  This is DBSP's `Q^Δ = D ∘ Q ∘ I` (Budiu et al. 2022) stated as a
//  test. It is NOT free: it holds only because the lowering picks a
//  DIFFERENT physical operator for the non-linear/bilinear cases.
//    • `Where` / `Select` are LINEAR — `Q^Δ = Q`, same op in both modes.
//    • `Join` is BILINEAR — batch uses `Circuit.Join`, streaming MUST use
//      `Circuit.IncrementalJoin` (the three-term formula in
//      `Incremental.fs`). Using `Circuit.Join` on deltas silently returns
//      the wrong answer; the mode-equivalence test is what catches it.
//
//  ── Anchors (Beacon) ────────────────────────────────────────────────
//  • DBSP / Z-sets / `Q^Δ = D∘Q∘I` — Budiu, McSherry, Ryzhyk, Tannen,
//    "DBSP: Automatic Incremental View Maintenance for Rich Query
//    Languages" (VLDB 2023). The substrate this lowers onto.
//  • Differential Dataflow — McSherry, Murray, Isaacs, Isard (CIDR 2013).
//    The lineage DBSP sharpens.
//  • Stream/relation conversion semantics — Arasu, Babu, Widom, "The CQL
//    continuous query language: semantic foundations and query execution"
//    (VLDB Journal 2006). CQL is where "events are just like rows" is
//    made rigorous: explicit stream→relation (windows) and
//    relation→stream (Istream/Dstream/Rstream) operators. We deliberately
//    ship NEITHER — see "Deliberately left out" below — which is exactly
//    why this prototype cannot yet claim CQL's generality.
//  • Unified batch/streaming SQL — Carbone et al., "Apache Flink: Stream
//    and Batch Processing in a Single Engine" (IEEE Data Eng. Bull. 2015)
//    — Dynamic Tables; and Begoli, Chandramouli, Hueske, Sabharwal et
//    al., "One SQL to Rule Them All" (SIGMOD 2019).
//  • Relational algebra — Codd, "A Relational Model of Data for Large
//    Shared Data Banks" (CACM 1970). `Join`-then-`Select` below is Codd's
//    factoring, not a convenience.
//
//  NOTE on the Flink/Calcite anchors: they are cited from the PAPERS
//  only. No competitor engine source was read — see
//  `.claude/rules/cleanroom-two-team-separation.md`.
// ═══════════════════════════════════════════════════════════════════════


/// A scalar value in a row. Deliberately tiny — two ground types, no
/// nulls, no decimals, no dates. EXPERIMENTAL.
[<RequireQualifiedAccess>]
type ToyValue =
    | VInt of int64
    | VStr of string
    | VBool of bool

    /// Canonical, ordinal-comparable, never-null rendering. Used as the
    /// equi-join key so the join key type is `string` (satisfying the
    /// `'K : not null` constraint on `Circuit.Join`) while still
    /// distinguishing `VInt 1L` from `VStr "1"` by its type tag.
    member this.Canonical : string =
        match this with
        | ToyValue.VInt i -> "i:" + i.ToString(Globalization.CultureInfo.InvariantCulture)
        | ToyValue.VStr s -> "s:" + s
        | ToyValue.VBool b -> if b then "b:1" else "b:0"


/// A row is a flat, alias-qualified cell map. Erased rather than typed:
/// the plan references columns by `(alias, field)` so the SAME plan node
/// can be produced by a typed C# `IQueryable<T>` and by the untyped F#
/// combinator CE. `Map` gives structural comparison, which is what
/// `ZSet<'K>` requires. EXPERIMENTAL.
type ToyRow =
    { Cells: Map<string, ToyValue> }

    /// Look up `alias.field`. Missing cells are an authoring error and
    /// throw rather than defaulting — a silently-absent column would make
    /// the plan-equivalence test vacuous.
    member this.Item
        with get (alias: string, field: string) : ToyValue =
            let key = alias + "." + field
            match this.Cells.TryFind key with
            | Some v -> v
            | None ->
                raise (
                    KeyNotFoundException(
                        String.Format(
                            Globalization.CultureInfo.InvariantCulture,
                            "ToyRow has no cell '{0}'. Present: [{1}].",
                            key,
                            String.Join("; ", this.Cells |> Seq.map (fun kv -> kv.Key)))))


/// Closure-free scalar expression. Closure-freedom is the load-bearing
/// property: it is what lets two independently-written front ends be
/// compared for STRUCTURAL equality including their predicates. An IR
/// holding opaque lambdas would make the equivalence test vacuous — two
/// different predicates would both read as "a filter".
/// EXPERIMENTAL.
[<RequireQualifiedAccess>]
type ToyScalar =
    /// Alias-qualified column reference.
    | Col of alias: string * field: string
    | Lit of ToyValue
    | Eq of ToyScalar * ToyScalar
    | Gt of ToyScalar * ToyScalar
    | Lt of ToyScalar * ToyScalar
    | AndAlso of ToyScalar * ToyScalar


/// The logical plan. Closure-free, structurally comparable, and the
/// single thing every front end must produce. `Join`-then-`Select`
/// follows Codd's factoring: a join yields the merged row, and shaping
/// the output is a separate projection.
/// EXPERIMENTAL.
[<RequireQualifiedAccess>]
type ToyPlan =
    /// A named relation. `columns` is declared for canonical-form
    /// printing and schema echo; it is not enforced against the rows.
    | Source of alias: string * columns: string list
    | Where of input: ToyPlan * predicate: ToyScalar
    /// Output cell name (already alias-qualified by the front end) paired
    /// with the expression producing it.
    | Select of input: ToyPlan * projections: (string * ToyScalar) list
    /// Inner equi-join. The output row is the union of both sides' cells.
    | Join of left: ToyPlan * right: ToyPlan * leftKey: ToyScalar * rightKey: ToyScalar
    /// **Stream → relation.** Materialize the input's changelog into the
    /// relation it denotes: lowers to `Circuit.IntegrateZSet`, DBSP's `I`.
    ///
    /// This is the node that makes "join between streams and tables" need
    /// NO new mechanism — a table IS a stream you integrated, so the join
    /// on the other side of it is the join we already had. `I` and `D` are
    /// implemented in `Primitive.fs`, both `IsLinear`, mutually inverse,
    /// and already used exactly this way in production code
    /// (`GeneratorIrRegistry.fs`).
    ///
    /// ⚠ A join whose right side is `AsTable` is NOT retroactive, and
    /// therefore does NOT satisfy the batch ≡ Σ-streaming law in general —
    /// only when the table is fully loaded before the stream side flows.
    /// This is the same distinction Flink draws between a regular join and
    /// a temporal/lookup join. It is a real semantic difference, not an
    /// implementation gap, and there is a test pinning BOTH halves.
    | AsTable of input: ToyPlan


/// How a plan is executed. This is the ONLY thing that differs between
/// "run the query" and "subscribe to the query" — the plan is identical.
/// EXPERIMENTAL.
[<RequireQualifiedAccess>]
type ToyExecutionMode =
    /// Whole relation as one delta; tick-1 output is the answer.
    | Batch
    /// Deltas over many ticks; each tick emits the change to the answer.
    /// Selects the incremental lowering for bilinear operators.
    | Streaming


[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module ToyScalar =

    /// Evaluate against a row. Total on well-formed plans; throws on a
    /// missing column (see `ToyRow.Item`) and on a type mismatch, because
    /// a silent coercion here would let two different plans agree.
    let rec eval (row: ToyRow) (e: ToyScalar) : ToyValue =
        match e with
        | ToyScalar.Col(alias, field) -> row.[alias, field]
        | ToyScalar.Lit v -> v
        | ToyScalar.Eq(a, b) -> ToyValue.VBool(eval row a = eval row b)
        | ToyScalar.Gt(a, b) -> ToyValue.VBool(compareVals (eval row a) (eval row b) > 0)
        | ToyScalar.Lt(a, b) -> ToyValue.VBool(compareVals (eval row a) (eval row b) < 0)
        | ToyScalar.AndAlso(a, b) ->
            ToyValue.VBool(asBool (eval row a) && asBool (eval row b))

    and private compareVals (a: ToyValue) (b: ToyValue) : int =
        match a, b with
        | ToyValue.VInt x, ToyValue.VInt y -> compare x y
        // Ordinal, never culture-aware — `.claude/rules/culture-invariant-by-default.md`.
        | ToyValue.VStr x, ToyValue.VStr y -> String.CompareOrdinal(x, y)
        | ToyValue.VBool x, ToyValue.VBool y -> compare x y
        | _ ->
            raise (
                InvalidOperationException(
                    String.Format(
                        Globalization.CultureInfo.InvariantCulture,
                        "ToyScalar: cannot order {0} against {1} — mixed types are an authoring error.",
                        a, b)))

    and private asBool (v: ToyValue) : bool =
        match v with
        | ToyValue.VBool b -> b
        | other ->
            raise (
                InvalidOperationException(
                    String.Format(
                        Globalization.CultureInfo.InvariantCulture,
                        "ToyScalar: expected a boolean, got {0}.",
                        other)))

    /// Evaluate a predicate.
    let evalPredicate (row: ToyRow) (e: ToyScalar) : bool =
        match eval row e with
        | ToyValue.VBool b -> b
        | other ->
            raise (
                InvalidOperationException(
                    String.Format(
                        Globalization.CultureInfo.InvariantCulture,
                        "ToyScalar: predicate did not evaluate to a boolean, got {0}.",
                        other)))

    // ── Combinators for the F# CE front end ──────────────────────────
    let col (alias: string) (field: string) : ToyScalar = ToyScalar.Col(alias, field)
    let int64Lit (v: int64) : ToyScalar = ToyScalar.Lit(ToyValue.VInt v)
    let strLit (v: string) : ToyScalar = ToyScalar.Lit(ToyValue.VStr v)


[<AutoOpen>]
module ToyScalarOperators =
    /// `=` on scalars. Spelled `.=.` so it cannot shadow F# equality.
    let ( .=. ) (a: ToyScalar) (b: ToyScalar) = ToyScalar.Eq(a, b)
    let ( .>. ) (a: ToyScalar) (b: ToyScalar) = ToyScalar.Gt(a, b)
    let ( .<. ) (a: ToyScalar) (b: ToyScalar) = ToyScalar.Lt(a, b)
    let ( .&&. ) (a: ToyScalar) (b: ToyScalar) = ToyScalar.AndAlso(a, b)


[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module ToyPlan =

    let private scalarToText (e: ToyScalar) : string =
        let rec go (e: ToyScalar) (sb: StringBuilder) =
            match e with
            | ToyScalar.Col(a, f) -> sb.Append(a).Append('.').Append(f) |> ignore
            | ToyScalar.Lit v -> sb.Append(v.Canonical) |> ignore
            | ToyScalar.Eq(a, b) -> binary "=" a b sb
            | ToyScalar.Gt(a, b) -> binary ">" a b sb
            | ToyScalar.Lt(a, b) -> binary "<" a b sb
            | ToyScalar.AndAlso(a, b) -> binary "AND" a b sb

        and binary (op: string) a b (sb: StringBuilder) =
            sb.Append('(') |> ignore
            go a sb
            sb.Append(' ').Append(op).Append(' ') |> ignore
            go b sb
            sb.Append(')') |> ignore

        let sb = StringBuilder()
        go e sb
        sb.ToString()

    /// The canonical TEXT form of a plan — the golden vector.
    ///
    /// Text, not a binary blob, per
    /// `.claude/rules/no-binary-in-proof-lineage.md`: every plan change is
    /// a readable `git` diff, and two front ends can be compared by a
    /// human as well as by an assert.
    let canonical (plan: ToyPlan) : string =
        let sb = StringBuilder()

        let rec go (p: ToyPlan) (depth: int) =
            let pad = String(' ', depth * 2)
            match p with
            | ToyPlan.Source(alias, columns) ->
                sb.Append(pad)
                  .Append("Source ")
                  .Append(alias)
                  .Append(" [")
                  .Append(String.Join(", ", columns))
                  .Append(']')
                  .Append('\n')
                |> ignore
            | ToyPlan.Where(input, predicate) ->
                sb.Append(pad).Append("Where ").Append(scalarToText predicate).Append('\n') |> ignore
                go input (depth + 1)
            | ToyPlan.Select(input, projections) ->
                let cols =
                    projections
                    |> List.map (fun (name, e) -> name + " := " + scalarToText e)
                sb.Append(pad).Append("Select ").Append(String.Join(", ", cols)).Append('\n') |> ignore
                go input (depth + 1)
            | ToyPlan.Join(left, right, lk, rk) ->
                sb.Append(pad)
                  .Append("Join ON ")
                  .Append(scalarToText lk)
                  .Append(" = ")
                  .Append(scalarToText rk)
                  .Append('\n')
                |> ignore
                go left (depth + 1)
                go right (depth + 1)
            | ToyPlan.AsTable input ->
                sb.Append(pad).Append("AsTable (I)").Append('\n') |> ignore
                go input (depth + 1)

        go plan 0
        sb.ToString()

    /// Every source alias in the plan, in deterministic (sorted) order.
    let sources (plan: ToyPlan) : (string * string list) list =
        let rec go p acc =
            match p with
            | ToyPlan.Source(alias, cols) -> (alias, cols) :: acc
            | ToyPlan.Where(input, _) -> go input acc
            | ToyPlan.Select(input, _) -> go input acc
            | ToyPlan.Join(l, r, _, _) -> go l (go r acc)
            | ToyPlan.AsTable input -> go input acc
        go plan [] |> List.sortBy fst


/// The F# computation-expression front end.
///
/// ## Why the source is a builder ARGUMENT rather than a `for` binding
///
/// `zquery src { ... }`, not `zquery { for x in src do ... }`. This is a
/// deliberate, and load-bearing, departure from FSharp.Core's `query { }`.
///
/// F# CEs are genuinely awkward at multi-source joins. `query { }` handles
/// it by making the whole CE body a QUOTATION (`member _.Quote()`) and
/// re-interpreting the resulting `Expr` tree — which is how it reaches an
/// `IQueryable` provider at all. Taking `[<ProjectionParameter>]` lambdas
/// WITHOUT quoting them gets you closures, and a closure in the IR makes
/// the plan-equivalence test vacuous: two different predicates both read
/// as "some filter".
///
/// So this CE takes explicit `ToyScalar` combinators instead of lambdas.
/// The cost is honest and should be stated plainly: **it is less pretty
/// than `where (fun o -> o.Amount > 100L)`**. What it buys is an IR that
/// is closure-free by construction, so the falsifier is real.
///
/// The route not taken — `member _.Quote()` plus quotation-splitting to
/// recover `ToyScalar` from a typed lambda — is the right next step and is
/// listed under "Deliberately left out" in the design doc. It is strictly
/// more work, not a different design.
///
/// Joins, notably, are FINE here: `join` is a custom operation taking the
/// right-hand plan and both key expressions. The awkwardness in F# CEs is
/// specifically about binding multiple typed sources into scope, which is
/// exactly the problem the combinator route sidesteps.
///
/// ```fsharp
/// let plan =
///     zquery (ToyPlan.Source("orders", [ "id"; "cust"; "amount" ])) {
///         join (ToyPlan.Source("customers", [ "id"; "name" ]))
///              (ToyScalar.col "orders" "cust")
///              (ToyScalar.col "customers" "id")
///         where (ToyScalar.col "orders" "amount" .>. ToyScalar.int64Lit 100L)
///         select [ "out.name",   ToyScalar.col "customers" "name"
///                  "out.amount", ToyScalar.col "orders" "amount" ]
///     }
/// ```
/// EXPERIMENTAL.
[<Sealed>]
type ToyQueryBuilder(source: ToyPlan) =

    /// Seeds the pipeline with the source handed to the builder. The
    /// `unit` yield is the standard F# idiom for a CE whose body is made
    /// entirely of custom operations.
    member _.Yield(_: unit) : ToyPlan = source

    member _.Zero() : ToyPlan = source

    [<CustomOperation("where", MaintainsVariableSpace = true)>]
    member _.Where(input: ToyPlan, predicate: ToyScalar) : ToyPlan =
        ToyPlan.Where(input, predicate)

    [<CustomOperation("select")>]
    member _.Select(input: ToyPlan, projections: (string * ToyScalar) list) : ToyPlan =
        ToyPlan.Select(input, projections)

    [<CustomOperation("join")>]
    member _.Join(input: ToyPlan, right: ToyPlan, leftKey: ToyScalar, rightKey: ToyScalar) : ToyPlan =
        ToyPlan.Join(input, right, leftKey, rightKey)


[<AutoOpen>]
module ToyQueryBuilderModule =
    /// Open the `zquery` CE over a source relation. EXPERIMENTAL.
    let zquery (source: ToyPlan) = ToyQueryBuilder(source)


/// A plan lowered onto a live `Circuit`: the input handles to feed and
/// the output handle to read. EXPERIMENTAL.
[<Sealed>]
type ToyLowered
    internal
    (
        circuit: Circuit,
        inputs: Map<string, ZSetInputHandle<ToyRow>>,
        output: OutputHandle<ZSet<ToyRow>>,
        mode: ToyExecutionMode
    ) =
    member _.Circuit = circuit
    member _.Inputs = inputs
    member _.Output = output
    member _.Mode = mode

    /// Feed one delta to a named source. Unknown aliases throw — a
    /// silently-dropped delta would make the mode-equivalence law appear
    /// to hold when it does not.
    member _.Send(alias: string, delta: ZSet<ToyRow>) : unit =
        match inputs.TryFind alias with
        | Some h -> h.Send delta
        | None ->
            raise (
                ArgumentException(
                    String.Format(
                        Globalization.CultureInfo.InvariantCulture,
                        "No source '{0}' in this plan. Known: [{1}].",
                        alias,
                        String.Join("; ", inputs |> Seq.map (fun kv -> kv.Key)))))


[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module ToyLowering =

    /// Lower a logical plan onto the EXISTING DBSP operator algebra —
    /// `Circuit.Filter`, `Circuit.Map`, `Circuit.Join` /
    /// `Circuit.IncrementalJoin` from `Operators.fs` / `Incremental.fs`.
    /// Nothing new is implemented at the operator layer; this is a
    /// translation, which is the whole point of "two front ends, one
    /// plan".
    ///
    /// The mode enters at EXACTLY ONE place — the bilinear `Join`. That
    /// single `match` is the entire set-at-a-time / delta-at-a-time
    /// difference, and it is why the two are one surface rather than two.
    let lower (circuit: Circuit) (mode: ToyExecutionMode) (plan: ToyPlan) : ToyLowered =
        let mutable inputs = Map.empty<string, ZSetInputHandle<ToyRow>>

        let rec go (p: ToyPlan) : Stream<ZSet<ToyRow>> =
            match p with
            | ToyPlan.Source(alias, _) ->
                match inputs.TryFind alias with
                | Some h -> h.Stream
                | None ->
                    let h = circuit.ZSetInput<ToyRow>()
                    inputs <- inputs.Add(alias, h)
                    h.Stream

            | ToyPlan.Where(input, predicate) ->
                // LINEAR: `Q^Δ = Q`. Identical in both modes.
                circuit.Filter(go input, Func<ToyRow, bool>(fun r -> ToyScalar.evalPredicate r predicate))

            | ToyPlan.Select(input, projections) ->
                // LINEAR: `Q^Δ = Q`. Identical in both modes.
                let project (r: ToyRow) : ToyRow =
                    let cells =
                        projections
                        |> List.fold
                            (fun (acc: Map<string, ToyValue>) (name, e) -> acc.Add(name, ToyScalar.eval r e))
                            Map.empty
                    { Cells = cells }
                circuit.Map(go input, Func<ToyRow, ToyRow>(project))

            | ToyPlan.AsTable input ->
                // Stream → relation. DBSP's `I`. LINEAR, so it is the same
                // operator in both modes: in Batch there is a single tick, so
                // the running integral equals the input and `I` is a no-op.
                circuit.IntegrateZSet(go input)

            | ToyPlan.Join(left, right, leftKey, rightKey) ->
                let ls = go left
                let rs = go right
                let keyL = Func<ToyRow, string>(fun r -> (ToyScalar.eval r leftKey).Canonical)
                let keyR = Func<ToyRow, string>(fun r -> (ToyScalar.eval r rightKey).Canonical)
                // Row merge. Right-hand cells win on an alias-qualified
                // collision, which cannot happen for distinct aliases.
                let combine =
                    Func<ToyRow, ToyRow, ToyRow>(fun a b ->
                        { Cells = b.Cells |> Map.fold (fun (acc: Map<string, ToyValue>) k v -> acc.Add(k, v)) a.Cells })

                // ─── THE ONE PLACE THE MODE MATTERS ───────────────────
                // `Join` is BILINEAR, so `Q^Δ ≠ Q`. Feeding deltas to the
                // batch operator returns a WRONG answer rather than an
                // error, so `ToyPlan.modeEquivalence` in the tests is the
                // only thing standing between this line and a silent bug.
                match mode, right with
                | ToyExecutionMode.Batch, _ ->
                    // One tick, whole relation. `Join` is exactly Codd's
                    // equi-join here.
                    circuit.Join(ls, rs, keyL, keyR, combine)

                | ToyExecutionMode.Streaming, ToyPlan.AsTable _ ->
                    // STREAM ⋈ TABLE (the Rx / ASA "join a stream against
                    // reference data" shape). `rs` is ALREADY the running
                    // integral `I(right)` — `go` emitted `IntegrateZSet` for
                    // the `AsTable` node — so a plain join is
                    // `Δleft ⋈ table_now`, which is the intended semantics
                    // and needs no new operator.
                    //
                    // Deliberately NOT retroactive: a left row that arrives
                    // BEFORE its matching table row is never re-emitted when
                    // that row later lands. So this lowering does not satisfy
                    // batch ≡ Σ-streaming unless the table is loaded first —
                    // pinned from both sides by the divergence test.
                    circuit.Join(ls, rs, keyL, keyR, combine)

                | ToyExecutionMode.Streaming, _ ->
                    // STREAM ⋈ STREAM. The three-term bilinear formula:
                    //   (a ⋈ b)^Δ = Δa ⋈ Δb + z⁻¹(I(a)) ⋈ Δb + Δa ⋈ z⁻¹(I(b))
                    // Retroactive, and therefore batch-equivalent.
                    circuit.IncrementalJoin(ls, rs, keyL, keyR, combine)

        let outStream = go plan
        let output = circuit.Output outStream
        ToyLowered(circuit, inputs, output, mode)
