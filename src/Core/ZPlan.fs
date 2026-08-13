namespace Zeta.Core

// ═══════════════════════════════════════════════════════════════════
//  ZPlan — the TYPED OPERATOR IR over the polymorphic Z-set base atom
//  (081KYWE8Q3508QG0R000KZ5PWR, increment 2: the "typed operator IR /
//  plan node" the increment-1 STATUS listed as STILL OPEN).
//
//  Aaron 2026-07-31: open-generics dispatch over Z-sets + schema-on-
//  Z-sets "is our entire db stored-proc architecture long term." This
//  file is the piece that joins the two shipped halves: `ZAtomDispatch`
//  gave us ONE dispatched operator applied to ONE Z-set; a stored
//  procedure is a PLAN — a tree of operators over named sources — and
//  the plan must be checkable BEFORE any row is touched. The shape a
//  stored procedure compiles to (`ZAtom.fs` docstring): "the plan names
//  an operator, the rows name their types, and the dictionary joins
//  them." Here the joining happens twice, deliberately:
//   • AT PLAN TIME — `inferTypes`/`validate` runs a TYPE-FLOW analysis:
//     each node's possible type-tag set is computed from the sources'
//     declared tags, and every `Dispatch` node is checked against the
//     registry (tag registered? operator implemented?). A plan that can
//     meet an unroutable row is rejected as a PLAN, with every failure
//     listed — not discovered row-by-row in production.
//   • AT RUN TIME — `run` evaluates the tree with the same all-or-
//     nothing loud-failure discipline as `ZAtomDispatch.mapValues`
//     (nothing silently dropped; a partial result would be a silent
//     drop wearing an `Ok`).
//
//  THE IR IS DELIBERATELY Z-LINEAR. Every constructor denotes a
//  Z-linear operator (`Source` = projection, `Dispatch` = key-rewrite
//  with weight untouched, `FilterType` = restriction, `Sum` = group
//  add, `Negate` = additive inverse), so EVERY plan `p` satisfies
//  `run p (a + b) = run p a + run p b` — a quantified law in
//  ZPlan.Tests.fs, not a hope. By DBSP linearity (Budiu et al., VLDB
//  2023: linear ⇒ `Q^Δ = Q`) a ZPlan is its OWN incremental form: feed
//  it deltas and it emits deltas, no lifting required. Nonlinear nodes
//  (distinct, join) are deliberately ABSENT from this increment — each
//  needs its integration story stated before it can ride the IR, and an
//  IR that quietly mixes linear and nonlinear nodes loses the theorem
//  that makes plans-as-deltas sound.
//
//  SCHEMA IS THE SOURCE DECLARATION. `sourceTypesOfLog` bridges the
//  schema plane (`SchemaLog`, the fold-is-the-schema event log) to the
//  type-flow analysis: a source's declared tag set is the fold of its
//  schema log, so "validate this stored proc against the live schema"
//  is `validateAgainstLogs` — the SchemaLog→stored-proc wiring the Q40
//  work-item names.
//
//  Anchors (Beacon): Wadler & Blott 1989 (the registry as explicit
//  dictionary); Budiu et al., DBSP (VLDB 2023) §linear operators;
//  Green, Karvounarakis & Tannen (PODS 2007) — the weight ring the rows
//  ride; Codd 1970 (plans over declared schemas, checked before data).
// ═══════════════════════════════════════════════════════════════════

/// **The typed plan IR.** A tree of Z-linear operators over named
/// sources of heterogeneous `ZSet<ZAtom>` rows. Constructors are the
/// full grammar — no wildcard, so a new node class breaks every
/// consumer's `match` at compile time rather than silently landing in a
/// default bucket.
type ZPlan =
    /// A named input relation. The leaf; its tag set comes from the
    /// caller's declaration (in production: the fold of its schema log).
    | Source of sourceName: string
    /// Apply a dispatched operator (`ZAtomDispatch.mapValues`) to every
    /// row of the input. Weight rides through untouched — Z-linear.
    | Dispatch of operatorName: string * dispatchInput: ZPlan
    /// Keep only rows whose type tag equals `keepTypeId` (weights
    /// preserved). Restriction is Z-linear; the type-flow analysis
    /// narrows to `{keepTypeId}` past this node.
    | FilterType of keepTypeId: string * filterInput: ZPlan
    /// Z-set sum of two subplans (the abelian-group `+`).
    | Sum of sumLeft: ZPlan * sumRight: ZPlan
    /// Additive inverse of a subplan — retraction as a plan node.
    | Negate of negated: ZPlan

/// Why a plan is not runnable. Every case names the FACT and carries
/// the payload needed to act on it; plan-time and run-time failures
/// share this one type so a caller's handling cannot drift between the
/// two phases.
type ZPlanError =
    /// The plan names a source the caller did not supply/declare.
    | UnknownSource of missingSource: string
    /// A `Dispatch` node cannot route rows: the operator name plus the
    /// underlying dispatch facts (unregistered tag / unsupported
    /// operator / malformed atom / per-row failure).
    | PlanDispatch of planOperator: string * dispatchErrors: ZDispatchError list

[<RequireQualifiedAccess>]
module ZPlan =

    let private ordinal (a: string) (b: string) = Collation.binary.Compare(a, b)

    /// The named sources a plan reads, in `Collation.binary` order —
    /// deterministic, so a report of the plan replays byte-identically.
    [<CompiledName "Sources">]
    let sources (plan: ZPlan) : string list =
        let rec go acc p =
            match p with
            | Source n -> n :: acc
            | Dispatch (_, i) -> go acc i
            | FilterType (_, i) -> go acc i
            | Sum (l, r) -> go (go acc l) r
            | Negate i -> go acc i
        go [] plan |> List.distinct |> List.sortWith ordinal

    // ── Plan-time analysis: type flow + dispatch coverage ─────────────

    /// **Type-flow analysis.** Compute the set of type tags that can
    /// reach each node, from the declared per-source tag sets, checking
    /// every `Dispatch` node against the registry along the way. The
    /// flow rules mirror the evaluator exactly (they are the same
    /// recursion): `Source` = declaration; `Dispatch` preserves tags
    /// (`mapValues` rewrites the canon, never the tag) but REQUIRES
    /// every inbound tag to be registered and to implement the
    /// operator; `FilterType` intersects with `{keepTypeId}`; `Sum`
    /// unions; `Negate` preserves. All-or-nothing: every failure in the
    /// whole tree is collected (deduplicated, deterministic order),
    /// never just the first.
    [<CompiledName "InferTypes">]
    let inferTypes
        (reg: ZAtomRegistry)
        (sourceTypes: Map<string, Set<string>>)
        (plan: ZPlan)
        : Result<Set<string>, ZPlanError list> =
        let rec go p : Set<string> * ZPlanError list =
            match p with
            | Source n ->
                match Map.tryFind n sourceTypes with
                | Some tags -> tags, []
                | None -> Set.empty, [ UnknownSource n ]
            | Dispatch (op, input) ->
                let tags, errs = go input
                let dispatchErrs =
                    [ for tid in Set.toList tags |> List.sortWith ordinal do
                        match ZAtomRegistry.tryFind tid reg with
                        | None -> yield UnregisteredType tid
                        | Some t ->
                            match t.TryOperator op with
                            | None -> yield OperatorNotSupported(tid, op, List.ofSeq t.OperatorNames)
                            | Some _ -> () ]
                let errs' =
                    if List.isEmpty dispatchErrs then errs
                    else errs @ [ PlanDispatch(op, dispatchErrs) ]
                tags, errs'
            | FilterType (tid, input) ->
                let tags, errs = go input
                Set.intersect tags (Set.singleton tid), errs
            | Sum (l, r) ->
                let lt, le = go l
                let rt, re = go r
                Set.union lt rt, le @ re
            | Negate input -> go input
        let tags, errs = go plan
        if List.isEmpty errs then Ok tags else Error(List.distinct errs)

    /// Plan-time validation: the plan is runnable against these declared
    /// sources and this registry — every source known, every `Dispatch`
    /// node routable for every tag that can reach it. The stored-proc
    /// compile gate: reject the PLAN, not the ten-thousandth row.
    [<CompiledName "Validate">]
    let validate (reg: ZAtomRegistry) (sourceTypes: Map<string, Set<string>>) (plan: ZPlan) : Result<unit, ZPlanError list> =
        inferTypes reg sourceTypes plan |> Result.map ignore

    // ── The SchemaLog bridge (081KYWE8Q4008QG0R000H558SH wiring) ──────

    /// The type tags a schema log's CURRENT schema declares — the fold
    /// of the event log projected through the schema→dispatch bridge
    /// (`ZAtomType.ofDynamicValueType`). This is a source's declared
    /// tag set: schema-as-events feeding the stored-proc compile gate.
    [<CompiledName "SourceTypesOfLog">]
    let sourceTypesOfLog (log: SchemaEvent seq) : Set<string> =
        SchemaLog.fields log
        |> List.map (fun f -> ZAtomType.ofDynamicValueType f.Type)
        |> Set.ofList

    /// `validate` with each source's tag set taken from its schema log.
    /// The SchemaLog→stored-proc-surface wiring: a plan is checked
    /// against what the schema plane says the sources CAN contain, so a
    /// schema migration that breaks a stored proc is caught by re-running
    /// this gate — before any data moves.
    [<CompiledName "ValidateAgainstLogs">]
    let validateAgainstLogs (reg: ZAtomRegistry) (logs: Map<string, SchemaLog>) (plan: ZPlan) : Result<unit, ZPlanError list> =
        validate reg (logs |> Map.map (fun _ log -> sourceTypesOfLog log)) plan

    // ── The evaluator ─────────────────────────────────────────────────

    /// **Run a plan.** Pure, deterministic, all-or-nothing: every error
    /// across the whole tree is collected (deduplicated, deterministic
    /// order); a partial result is never returned. Because every node is
    /// Z-linear, `run reg s p` is linear in `s` — feed deltas, get
    /// deltas (the DBSP incremental story, unchanged by polymorphism).
    [<CompiledName "Run">]
    let run (reg: ZAtomRegistry) (sources: Map<string, ZSet<ZAtom>>) (plan: ZPlan) : Result<ZSet<ZAtom>, ZPlanError list> =
        let rec go p : Result<ZSet<ZAtom>, ZPlanError list> =
            match p with
            | Source n ->
                match Map.tryFind n sources with
                | Some z -> Ok z
                | None -> Error [ UnknownSource n ]
            | Dispatch (op, input) ->
                match go input with
                | Error e -> Error e
                | Ok z ->
                    match ZAtomDispatch.mapValues reg op z with
                    | Ok z' -> Ok z'
                    | Error de -> Error [ PlanDispatch(op, de) ]
            | FilterType (tid, input) ->
                go input
                |> Result.map (ZSet.filter (fun (a: ZAtom) -> System.String.Equals(a.TypeId, tid, System.StringComparison.Ordinal)))
            | Sum (l, r) ->
                // Evaluate BOTH sides before deciding — errors from the right
                // side must not be masked by errors from the left (all-or-
                // nothing applies to the tree, not to the first failing branch).
                match go l, go r with
                | Ok a, Ok b -> Ok(a + b)
                | Error e, Ok _ | Ok _, Error e -> Error e
                | Error e1, Error e2 -> Error(e1 @ e2)
            | Negate input -> go input |> Result.map (fun z -> -z)
        go plan |> Result.mapError List.distinct
