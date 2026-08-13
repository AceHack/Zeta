module Zeta.Tests.Algebra.ZPlanTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// ZPlan — the typed operator IR over the polymorphic base atom
// (081KYWE8Q3508QG0R000KZ5PWR, increment 2).
//
// Four law families:
//  1. PLAN-TIME HONESTY — the type-flow analysis rejects, as a PLAN,
//     exactly the shapes that would meet an unroutable row: unknown
//     source, unregistered tag, unsupported operator. All failures are
//     listed, never just the first.
//  2. WHOLE-PLAN Z-LINEARITY — every constructor is Z-linear, so for
//     EVERY plan `run p (a+b) = run p a + run p b`. This is the DBSP
//     theorem that makes a ZPlan its own incremental form (linear ⇒
//     Q^Δ = Q; Budiu et al., VLDB 2023) — quantified over random plan
//     TREES, not spot-checked on one shape.
//  3. RUN-TIME HONESTY — all-or-nothing evaluation; errors from BOTH
//     branches of a Sum surface together; nothing is silently dropped.
//  4. SCHEMA BRIDGE — `validateAgainstLogs` joins the schema plane's
//     fold to the plan gate: a schema migration (an appended event)
//     flips a plan between valid and invalid with no code change.
// ═══════════════════════════════════════════════════════════════════

let private i (v: int64) = Int64AtomType.Atom v
let private s (v: string) = StringAtomType.Atom v
let private reg = ZAtomRegistry.standard

let private intTag = ZAtomType.ofDynamicValueType DynamicValueType.Int
let private stringTag = ZAtomType.ofDynamicValueType DynamicValueType.String

/// Declared tag sets for the two standard sources used across the file.
let private declared: Map<string, Set<string>> =
    Map.ofList [ "A", Set.ofList [ intTag; stringTag ]; "B", Set.ofList [ intTag; stringTag ] ]

// ── generators: bounded pools so keys collide and `double` never overflows ──

type private PlanArb =
    static member private GenAtom: Gen<ZAtom> =
        gen {
            let! which = Gen.choose (0, 1)
            if which = 0 then
                let! v = Gen.elements [ -3L; -1L; 0L; 1L; 2L; 7L ]
                return i v
            else
                let! t = Gen.elements [ ""; "a"; "b"; "ab"; "zz" ]
                return s t
        }

    static member private GenAtomZSet: Gen<ZSet<ZAtom>> =
        gen {
            let! rows =
                Gen.listOf (
                    gen {
                        let! a = PlanArb.GenAtom
                        let! w = Gen.elements [ -2L; -1L; 1L; 2L; 3L ]
                        return a, w
                    }
                )
            return ZSet.ofSeq rows
        }

    static member private GenPlan(depth: int) : Gen<ZPlan> =
        if depth <= 0 then
            Gen.elements [ Source "A"; Source "B" ]
        else
            gen {
                let! which = Gen.choose (0, 4)
                match which with
                | 0 -> return! Gen.elements [ Source "A"; Source "B" ]
                | 1 ->
                    let! p = PlanArb.GenPlan(depth - 1)
                    return Dispatch("double", p)
                | 2 ->
                    let! t = Gen.elements [ intTag; stringTag ]
                    let! p = PlanArb.GenPlan(depth - 1)
                    return FilterType(t, p)
                | 3 ->
                    let! l = PlanArb.GenPlan(depth - 1)
                    let! r = PlanArb.GenPlan(depth - 1)
                    return Sum(l, r)
                | _ ->
                    let! p = PlanArb.GenPlan(depth - 1)
                    return Negate p
            }

    static member ZPlan() = Arb.fromGen (Gen.sized (fun n -> PlanArb.GenPlan(min 4 (n / 8))))
    static member AtomZSet() = Arb.fromGen PlanArb.GenAtomZSet

let private sourcesOf (a: ZSet<ZAtom>) (b: ZSet<ZAtom>) : Map<string, ZSet<ZAtom>> =
    Map.ofList [ "A", a; "B", b ]

let private runOk (srcs: Map<string, ZSet<ZAtom>>) (p: ZPlan) : ZSet<ZAtom> =
    match ZPlan.run reg srcs p with
    | Ok z -> z
    | Error e -> failwithf "expected Ok, got %A" e

// ── 1. Plan-time honesty ─────────────────────────────────────────────

[<Fact>]
let ``unknown source is a PLAN error, not a runtime surprise`` () =
    match ZPlan.validate reg declared (Sum(Source "A", Source "nope")) with
    | Ok () -> failwith "expected Error"
    | Error errs -> Assert.Equal<ZPlanError list>([ UnknownSource "nope" ], errs)

[<Fact>]
let ``an operator not implemented by a reachable tag rejects the plan, naming tag + operator + supported list`` () =
    // `succ` exists for int64 only; a string row can reach the Dispatch node.
    match ZPlan.validate reg declared (Dispatch("succ", Source "A")) with
    | Ok () -> failwith "expected Error"
    | Error [ PlanDispatch ("succ", [ OperatorNotSupported (tid, op, supported) ]) ] ->
        Assert.Equal<string>(stringTag, tid)
        Assert.Equal<string>("succ", op)
        Assert.Equal<string list>([ "double" ], supported)
    | Error other -> failwithf "unexpected error shape: %A" other

[<Fact>]
let ``FilterType narrows the flow: filtering to int64 makes succ valid`` () =
    ZPlan.validate reg declared (Dispatch("succ", FilterType(intTag, Source "A")))
    |> function
        | Ok () -> ()
        | Error e -> failwithf "expected Ok, got %A" e

[<Fact>]
let ``ALL failures are listed — both branches of a Sum, deduplicated`` () =
    let plan = Sum(Dispatch("succ", Source "A"), Sum(Source "missing", Dispatch("succ", Source "B")))
    match ZPlan.validate reg declared plan with
    | Ok () -> failwith "expected Error"
    | Error errs ->
        Assert.Contains(UnknownSource "missing", errs)
        // the two identical succ failures deduplicate to one fact
        Assert.Equal(2, List.length errs)

[<Fact>]
let ``an unregistered tag reaching a Dispatch node rejects the plan`` () =
    let withAlien = Map.add "A" (Set.ofList [ "float" ]) declared
    match ZPlan.validate reg withAlien (Dispatch("double", Source "A")) with
    | Error [ PlanDispatch ("double", [ UnregisteredType "float" ]) ] -> ()
    | other -> failwithf "unexpected: %A" other

[<Property(Arbitrary = [| typeof<PlanArb> |])>]
let ``inferTypes never claims a tag the evaluator can produce outside it`` (plan: ZPlan) (a: ZSet<ZAtom>) (b: ZSet<ZAtom>) =
    // Soundness of the flow analysis: every tag in the OUTPUT of `run` is in
    // the inferred set (declared tags cover the generated data by construction).
    match ZPlan.inferTypes reg declared plan, ZPlan.run reg (sourcesOf a b) plan with
    | Ok tags, Ok out -> Seq.forall (fun (e: ZEntry<ZAtom>) -> Set.contains e.Key.TypeId tags) out
    | Ok _, Error e -> failwithf "validated plan failed at runtime on covered data: %A" e
    | Error e, _ -> failwithf "generated plan should validate against its own declaration: %A" e

// ── 2. Whole-plan Z-linearity ────────────────────────────────────────

[<Property(Arbitrary = [| typeof<PlanArb> |])>]
let ``Z-LINEARITY: run p (a + b) = run p a + run p b — for EVERY plan tree`` (plan: ZPlan) (a1: ZSet<ZAtom>) (b1: ZSet<ZAtom>) (a2: ZSet<ZAtom>) (b2: ZSet<ZAtom>) =
    let merged = runOk (sourcesOf (a1 + a2) (b1 + b2)) plan
    let split = runOk (sourcesOf a1 b1) plan + runOk (sourcesOf a2 b2) plan
    merged = split

[<Property(Arbitrary = [| typeof<PlanArb> |])>]
let ``retraction rides through any plan: run p (-a) = -(run p a)`` (plan: ZPlan) (a: ZSet<ZAtom>) (b: ZSet<ZAtom>) =
    runOk (sourcesOf (-a) (-b)) plan = -(runOk (sourcesOf a b) plan)

[<Property(Arbitrary = [| typeof<PlanArb> |])>]
let ``determinism: two runs of one plan are equal`` (plan: ZPlan) (a: ZSet<ZAtom>) (b: ZSet<ZAtom>) =
    ZPlan.run reg (sourcesOf a b) plan = ZPlan.run reg (sourcesOf a b) plan

// ── 3. Run-time honesty ──────────────────────────────────────────────

[<Fact>]
let ``a compound plan computes the right answer`` () =
    // (A + (-B)) |> double : the difference delta, doubled per-type.
    let a = ZSet.ofSeq [ i 5L, 2L; s "ab", 1L ]
    let b = ZSet.ofSeq [ i 5L, 1L ]
    let out = runOk (sourcesOf a b) (Dispatch("double", Sum(Source "A", Negate(Source "B"))))
    Assert.Equal(1L, out.[i 10L]) // weight 2 − 1 = 1 rides through the canon rewrite
    Assert.Equal(1L, out.[s "abab"])
    Assert.Equal(2, out.Count)

[<Fact>]
let ``runtime errors from BOTH Sum branches surface together`` () =
    let srcs = sourcesOf (ZSet.ofSeq [ s "x", 1L ]) ZSet.empty
    let plan = Sum(Dispatch("succ", Source "A"), Source "missing")
    match ZPlan.run reg srcs plan with
    | Ok _ -> failwith "expected Error"
    | Error errs ->
        Assert.Contains(UnknownSource "missing", errs)
        Assert.True(errs |> List.exists (function PlanDispatch ("succ", _) -> true | _ -> false))

[<Fact>]
let ``a per-row domain failure (overflow) is loud at run time even though the plan validated`` () =
    // Plan-time checks names and tags; value-dependent failure stays a
    // runtime fact — reported, never dropped.
    Assert.True(ZPlan.validate reg declared (Dispatch("double", FilterType(intTag, Source "A"))) |> Result.isOk)
    let srcs = sourcesOf (ZSet.ofSeq [ i System.Int64.MaxValue, 1L ]) ZSet.empty
    match ZPlan.run reg srcs (Dispatch("double", FilterType(intTag, Source "A"))) with
    | Ok _ -> failwith "expected overflow to surface"
    | Error [ PlanDispatch ("double", [ RowFailed (_, _) ]) ] -> ()
    | Error other -> failwithf "unexpected error shape: %A" other

// ── 4. The schema bridge ─────────────────────────────────────────────

[<Fact>]
let ``a schema MIGRATION flips the plan gate with no code change`` () =
    let ev n op = SchemaEvent.create n op
    // v1 schema: one int field — `succ` over the source validates.
    let log1 = [ ev "e1" (AddField { Name = "count"; Type = DynamicValueType.Int }) ]
    let plan = Dispatch("succ", Source "A")
    Assert.True(ZPlan.validateAgainstLogs reg (Map.ofList [ "A", log1 ]) plan |> Result.isOk)
    // v2 appends a string field: the SAME plan is now rejected at plan time.
    let log2 = log1 @ [ ev "e2" (AddField { Name = "label"; Type = DynamicValueType.String }) ]
    Assert.True(ZPlan.validateAgainstLogs reg (Map.ofList [ "A", log2 ]) plan |> Result.isError)
    // v3 retracts the string field (grant-then-revoke folds to ABSENT): valid again.
    let log3 = log2 @ [ ev "e3" (DropField { Name = "label"; Type = DynamicValueType.String }) ]
    Assert.True(ZPlan.validateAgainstLogs reg (Map.ofList [ "A", log3 ]) plan |> Result.isOk)

[<Fact>]
let ``sources are reported deterministically in binary-collation order`` () =
    let plan = Sum(Source "b", Sum(Source "A", Sum(Source "b", Source "a")))
    Assert.Equal<string list>([ "A"; "a"; "b" ], ZPlan.sources plan)
