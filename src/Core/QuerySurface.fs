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
/// "run the query", "subscribe to the query", and "evaluate it right here
/// over materialized relations" — the plan is identical in all three.
/// EXPERIMENTAL.
[<RequireQualifiedAccess>]
type ToyExecutionMode =
    /// Whole relation as one delta; tick-1 output is the answer.
    | Batch
    /// Deltas over many ticks; each tick emits the change to the answer.
    /// Selects the incremental lowering for bilinear operators.
    | Streaming
    /// **No circuit at all.** Evaluate the plan directly over materialized
    /// `ZSet` relations, bottom-up, through the same `ZSet.filter` /
    /// `ZSet.map` / `ZSet.join` primitives the circuit operators call.
    ///
    /// Eager evaluation is a legitimate feature — it skips scheduler setup
    /// for a one-shot answer over relations already in memory — and
    /// `Zeta.Core.Sql`'s `zeta { }` CE was carrying a private evaluator to
    /// get it. This mode is the plan-level home for that capability.
    ///
    /// **Stated precisely, because the loose version is false.** `zeta { }`
    /// does NOT build a `ToyPlan` and does NOT call `ToyEager.run` — it
    /// cannot, because its rows are generic and its predicates are F#
    /// closures, while `ToyPlan` is closure-free over an erased `ToyRow`.
    /// What the two share is the layer BELOW the IR: the same `ZSet.filter`
    /// / `ZSet.map` / `ZSet.join` primitives. So this mode is not "where
    /// `zeta { }` now executes"; it is the eager execution of *this* plan,
    /// built on the same primitives `zeta { }` was moved onto.
    ///
    /// `Eager` is NOT a circuit lowering: `ToyLowering.lower` refuses it
    /// loudly. `ToyExecution.run` is the entry point that accepts it.
    ///
    /// Equivalence to `Batch` is a THEOREM, not a coincidence, and it is
    /// tested: over a single tick the running integral `I` equals its
    /// input, so `AsTable` is the identity, and every other node makes the
    /// same `ZSet.*` call the corresponding `Op` makes in `StepAsync`.
    | Eager


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


/// **The operator semantics, in ONE place.**
///
/// Every execution mode needs the same four functions: turn a `ToyScalar`
/// predicate into a row test, turn a projection list into a row rewrite,
/// turn a key expression into a join key, and merge two joined rows.
/// Before this module existed, `ToyLowering.lower` built them inline —
/// which was fine while there was exactly one engine, and would have
/// become a second copy the moment a second engine appeared.
///
/// It has, so they live here. `ToyLowering.lower` (circuit) and
/// `ToyEager.run` (no circuit) both call these; neither has a private
/// version. That is what makes `Eager ≡ Batch` a structural fact with a
/// test on top of it, rather than two implementations that happen to
/// agree today.
///
/// EXPERIMENTAL.
[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module ToyOps =

    /// σ — the row test for a `Where` node.
    let predicateOf (predicate: ToyScalar) : ToyRow -> bool =
        fun r -> ToyScalar.evalPredicate r predicate

    /// π — the row rewrite for a `Select` node. Builds a fresh cell map
    /// from the projection list; cells not projected are DROPPED, which is
    /// what makes a projection non-injective and therefore what makes
    /// `ZSet.map`'s consolidation load-bearing.
    let projectorOf (projections: (string * ToyScalar) list) : ToyRow -> ToyRow =
        fun r ->
            let cells =
                projections
                |> List.fold
                    (fun (acc: Map<string, ToyValue>) (name, e) -> acc.Add(name, ToyScalar.eval r e))
                    Map.empty
            { Cells = cells }

    /// The equi-join key. `Canonical` keeps the key a `string` (satisfying
    /// `'K : not null` on `ZSet.join` / `Circuit.Join`) while still
    /// distinguishing `VInt 1L` from `VStr "1"` by its type tag.
    let keyOf (e: ToyScalar) : ToyRow -> string =
        fun r -> (ToyScalar.eval r e).Canonical

    /// Row merge for a join. Right-hand cells win on an alias-qualified
    /// collision, which cannot happen for distinct aliases.
    let mergeRows (a: ToyRow) (b: ToyRow) : ToyRow =
        { Cells = b.Cells |> Map.fold (fun (acc: Map<string, ToyValue>) k v -> acc.Add(k, v)) a.Cells }


/// **`ToyExecutionMode.Eager` — the plan evaluated with no circuit.**
///
/// This is the execution mode that `Zeta.Core.Sql`'s `zeta { }` CE used to
/// obtain by carrying its own evaluator. It is a bottom-up fold over the
/// plan against materialized relations, and every node delegates to the
/// SAME `ZSet` primitive its circuit `Op` delegates to:
///
/// | plan node | this module | the circuit `Op` (`Operators.fs`)     |
/// |-----------|-------------|----------------------------------------|
/// | `Where`   | `ZSet.filter` | `FilterZSetOp.StepAsync` → `ZSet.filter` |
/// | `Select`  | `ZSet.map`    | `MapZSetOp.StepAsync` → `ZSet.map`       |
/// | `Join`    | `ZSet.join`   | `JoinZSetOp.StepAsync` → `ZSet.join`     |
/// | `AsTable` | identity      | `IntegrateZSet` (running sum)            |
///
/// `AsTable` is the one row that needs an argument rather than a citation.
/// `I` is a running sum over ticks; eager evaluation has exactly ONE tick,
/// and the running sum of a single delta is that delta. This is the same
/// reasoning `ToyLowering.lower` already records for `Batch`, and it is
/// why `Eager ≡ Batch` rather than merely "close".
///
/// **What Eager cannot do**, stated so the mode is not oversold: there is
/// no incremental mode here and there never will be. Incrementality is
/// what the circuit is FOR — `Q^Δ = D ∘ Q ∘ I` needs the `z⁻¹` delay that
/// only a scheduled circuit has. Eager answers a question; it cannot
/// install a subscription.
///
/// EXPERIMENTAL.
[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module ToyEager =

    /// Evaluate `plan` against materialized relations, one per source
    /// alias. An alias with no binding throws — a silently-empty source
    /// would make the Eager/Batch equivalence test pass vacuously by
    /// producing the empty Z-set on both sides.
    let run (bindings: Map<string, ZSet<ToyRow>>) (plan: ToyPlan) : ZSet<ToyRow> =
        let rec go (p: ToyPlan) : ZSet<ToyRow> =
            match p with
            | ToyPlan.Source(alias, _) ->
                match bindings.TryFind alias with
                | Some z -> z
                | None ->
                    raise (
                        ArgumentException(
                            String.Format(
                                Globalization.CultureInfo.InvariantCulture,
                                "No relation bound for source '{0}'. Bound: [{1}].",
                                alias,
                                String.Join("; ", bindings |> Seq.map (fun kv -> kv.Key)))))

            | ToyPlan.Where(input, predicate) ->
                ZSet.filter (ToyOps.predicateOf predicate) (go input)

            | ToyPlan.Select(input, projections) ->
                ZSet.map (ToyOps.projectorOf projections) (go input)

            | ToyPlan.AsTable input ->
                // `I` over a single tick is the identity — see the module
                // doc. NOT a shortcut: the batch lowering emits a real
                // `IntegrateZSet` and gets the same answer for the same
                // reason.
                go input

            | ToyPlan.Join(left, right, leftKey, rightKey) ->
                ZSet.join (ToyOps.keyOf leftKey) (ToyOps.keyOf rightKey) ToyOps.mergeRows (go left) (go right)

        go plan


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
        // `Eager` is a real execution mode of the shared plan, but it is
        // NOT a circuit lowering — it has no scheduler, no `z⁻¹`, and no
        // ticks. Refusing it here is louder than silently treating it as
        // `Batch`: a caller who asked for eager and got a circuit would
        // still get the right ANSWER, and would never learn that the mode
        // argument was ignored.
        if mode = ToyExecutionMode.Eager then
            raise (
                ArgumentException(
                    "ToyExecutionMode.Eager has no circuit lowering — it evaluates the plan "
                    + "directly over materialized relations. Call ToyEager.run instead.",
                    nameof mode))

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
                // `ToyOps.predicateOf` — the SAME function `ToyEager.run`
                // hands to `ZSet.filter`. `FilterZSetOp` will call
                // `ZSet.filter` with it, so the two modes are not merely
                // consistent, they are the same call.
                circuit.Filter(go input, Func<ToyRow, bool>(ToyOps.predicateOf predicate))

            | ToyPlan.Select(input, projections) ->
                // LINEAR: `Q^Δ = Q`. Identical in both modes.
                circuit.Map(go input, Func<ToyRow, ToyRow>(ToyOps.projectorOf projections))

            | ToyPlan.AsTable input ->
                // Stream → relation. DBSP's `I`. LINEAR, so it is the same
                // operator in both modes: in Batch there is a single tick, so
                // the running integral equals the input and `I` is a no-op.
                circuit.IntegrateZSet(go input)

            | ToyPlan.Join(left, right, leftKey, rightKey) ->
                let ls = go left
                let rs = go right
                // All three from `ToyOps` — the same key functions and row
                // merge `ToyEager.run` hands to `ZSet.join`.
                let keyL = Func<ToyRow, string>(ToyOps.keyOf leftKey)
                let keyR = Func<ToyRow, string>(ToyOps.keyOf rightKey)
                let combine = Func<ToyRow, ToyRow, ToyRow>(ToyOps.mergeRows)

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

                | ToyExecutionMode.Eager, _ ->
                    // Unreachable — refused at entry. Spelled out rather
                    // than wildcarded so that adding a FOURTH mode is a
                    // compile error here instead of a silent fall-through
                    // into the batch join.
                    raise (InvalidOperationException "unreachable: Eager is refused by ToyLowering.lower")

        let outStream = go plan
        let output = circuit.Output outStream
        ToyLowered(circuit, inputs, output, mode)


/// **The single entry point over all three execution modes.**
///
/// Without this, `ToyExecutionMode.Eager` would be a case that nothing
/// ACCEPTS — `ToyLowering.lower` only rejects it and `ToyEager.run` takes
/// no mode at all. A mode no function accepts is not a mode; it is a label
/// on a comment. This module is what makes "one plan, three modes" a
/// property of the code rather than of the prose.
///
/// Note what is deliberately NOT unified here: `Streaming` cannot share
/// this signature honestly. Batch and Eager both answer *one question over
/// one set of relations*, so `(alias, relation) list -> ZSet<ToyRow>` is
/// their true shape. Streaming consumes a SEQUENCE of deltas and emits a
/// change per tick — a different signature, and flattening it into this
/// one would mean feeding the whole relation as a single delta, which is
/// just Batch wearing a different name. So `runStreaming` takes ticks, and
/// the three modes meet at `ToyPlan`, not at one function signature.
/// EXPERIMENTAL.
[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module ToyExecution =

    /// Run a plan in `Batch` or `Eager` against materialized relations.
    /// `Streaming` is refused here and routed to `runStreaming`, because a
    /// one-shot feed of a streaming plan is Batch by another name and
    /// would silently answer a different question than the caller asked.
    let run
        (mode: ToyExecutionMode)
        (plan: ToyPlan)
        (relations: (string * ZSet<ToyRow>) list)
        : ZSet<ToyRow> =
        match mode with
        | ToyExecutionMode.Eager -> ToyEager.run (Map.ofList relations) plan
        | ToyExecutionMode.Batch ->
            let c = Circuit.create ()
            let lowered = ToyLowering.lower c ToyExecutionMode.Batch plan
            for alias, z in relations do
                lowered.Send(alias, z)
            c.Step()
            lowered.Output.Current
        | ToyExecutionMode.Streaming ->
            raise (
                ArgumentException(
                    "ToyExecutionMode.Streaming consumes a sequence of deltas, not one relation set. "
                    + "Use ToyExecution.runStreaming.",
                    nameof mode))

    /// Run a plan in `Streaming` mode over a sequence of tick-feeds,
    /// returning the SUM of the per-tick changes — which is the quantity
    /// `batch(R) == Σ_t streaming(ΔR_t)` compares against.
    let runStreaming (plan: ToyPlan) (ticks: (string * ZSet<ToyRow>) list list) : ZSet<ToyRow> =
        let c = Circuit.create ()
        let lowered = ToyLowering.lower c ToyExecutionMode.Streaming plan
        let mutable acc = ZSet.empty
        for tick in ticks do
            for alias, z in tick do
                lowered.Send(alias, z)
            c.Step()
            acc <- ZSet.add acc lowered.Output.Current
        acc
