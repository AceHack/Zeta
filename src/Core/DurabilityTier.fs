namespace Zeta.Core

open System.Text

// ═══════════════════════════════════════════════════════════════════
//  DurabilityTier — the tier model + registration-time classification
//  (081KTF48J3V increment 5; design LOCKED by the maintainer 2026-06-06,
//  docs/research/2026-06-06-durability-tiers-and-per-stream-group-
//  persistence-policy.md §2 + §7).
//
//  The locked decisions, implemented:
//   • A SMALL FIXED TIER SET joined at registration — `durable` /
//     `derived` / `ephemeral`. No free-form per-table knobs; no
//     per-write overrides (per-write nondeterministic durability is
//     exactly what breaks DST replay — the FDB/TigerBeetle/VoltDB
//     lesson).
//   • DECLARE ONLY THE LEAVES. A source has no upstream the graph could
//     read intent from, so its author says `durable` (an input worth
//     replaying) or `ephemeral` (scratch). Declaring a leaf `derived`
//     is a contradiction in terms and is rejected.
//   • AUTO-CLASSIFY INTERNAL RELATIONS. A relation that is a
//     deterministic function of surviving inputs is `derived` (don't
//     persist — regenerate by replaying the dataflow). A relation fed
//     by ANYTHING ephemeral cannot be regenerated (its input is gone on
//     recovery), so it auto-classifies `ephemeral` — mechanically, with
//     the reason recorded, never silently.
//   • OVERRIDE-UPWARD ALLOWED. An internal relation may be declared a
//     HIGHER tier than its auto-classification (typically `durable`, to
//     snapshot instead of recompute — a recovery-time knob; sound
//     because a durable relation's state is persisted directly, log +
//     snapshot, and restores without consulting its inputs). A
//     DOWNWARD override is rejected: it is how "recovered state
//     references lost state" happens by accident.
//   • THE UPWARD-CLOSED INVARIANT (§2, load-bearing). The set of
//     relations that SURVIVE recovery (`durable` ∪ `derived`) must be
//     upward-closed over the dataflow DAG: every dependency a
//     `derived` relation recomputes from must itself survive. Enforced
//     at classification; a violation names the node AND the offending
//     edge. (`durable` nodes are exempt on the input side — their
//     persistence is self-contained.)
//   • AUDIT-VIA-MANIFEST, not hand-declaration. The computed
//     classification is EMITTED as a generated tier manifest ("X =
//     derived because f(durable Y, Z)") — a queryable, checked-in,
//     deterministic artifact with zero boilerplate. Convention +
//     generated manifest + invariant check.
//
//  Pure and total: classification is a function of the declared graph,
//  Result-over-exception, deterministic output order (binary
//  collation) — the manifest replays byte-identically (DST).
//
//  Anchors: Postgres UNLOGGED (truncate-on-recovery ephemera); Kafka
//  per-topic retention tiers; VoltDB command logging (log inputs,
//  recompute the rest); FASTER epoch checkpoints (the derived-tier
//  recovery boundary); Izraelevitz et al., DISC'16 (buffered durable
//  linearizability — the bar the durable tier builds toward).
// ═══════════════════════════════════════════════════════════════════

/// The three durability tiers a stream-group can join. Ordered:
/// `Ephemeral < Derived < Durable` — the order "override-upward" is
/// measured against.
type DurabilityTier =
    /// Scratch / session state. Not persisted; discard-on-recovery with
    /// clean empty semantics (Postgres UNLOGGED).
    | Ephemeral
    /// A deterministic function of surviving inputs. Not persisted;
    /// regenerated on recovery by replaying the dataflow.
    | Derived
    /// Persisted directly: delta log + cadenced snapshot; recovery =
    /// restore snapshot, replay tail.
    | Durable

/// One relation (stream-group) as registered: its name, the names it
/// depends on (direct dataflow inputs), and its declared tier — required
/// for leaves, optional (override-upward) for internal relations.
type TierNode =
    { Name: string
      DependsOn: string list
      Declared: DurabilityTier option }

/// WHY a relation landed in its tier — recorded in the manifest so the
/// audit artifact answers the question instead of a human re-deriving it.
type TierReason =
    /// A leaf, classified by its author's declaration.
    | DeclaredLeaf
    /// Internal, auto-classified `Derived`: every direct dependency survives.
    | AutoDerived
    /// Internal, auto-classified `Ephemeral`: the named dependency is
    /// ephemeral, so this relation cannot be regenerated on recovery.
    | AutoEphemeral of throughDependency: string
    /// Internal, declared UPWARD of its auto-classification (the
    /// snapshot-instead-of-recompute knob).
    | DeclaredOverride of autoTier: DurabilityTier

/// One row of the generated tier manifest.
type TierAssignment =
    { Name: string
      Tier: DurabilityTier
      Reason: TierReason
      DependsOn: string list }

/// Why a registration is rejected. Every case names the node (and edge)
/// so the fix is mechanical.
type TierError =
    /// Two registrations share a name — an unresolved ambiguity, never
    /// last-writer-wins.
    | DuplicateNode of duplicated: string
    /// An edge points at a name that was never registered.
    | UnknownDependency of fromNode: string * missing: string
    /// The dependency graph is not a DAG; the cycle's members are listed
    /// (sorted) so the offending edge set is findable.
    | DependencyCycle of members': string list
    /// A leaf with no declaration: the graph cannot infer intent at a
    /// source — say `Durable` (worth replaying) or `Ephemeral` (scratch).
    | UndeclaredLeaf of leaf: string
    /// A leaf declared `Derived`: there is nothing upstream to derive it
    /// from — a contradiction, not a policy.
    | LeafDeclaredDerived of leaf: string
    /// An internal relation declared BELOW its auto-classification.
    /// Override-upward is the only allowed direction.
    | DownwardOverride of node: string * declared: DurabilityTier * auto: DurabilityTier
    /// The upward-closed invariant, violated: a declared-surviving
    /// relation recomputes from an ephemeral dependency it would lose.
    | SurvivorDependsOnEphemeral of node: string * declared: DurabilityTier * throughDependency: string

[<RequireQualifiedAccess>]
module DurabilityTier =

    let private ordinal (a: string) (b: string) = Collation.binary.Compare(a, b)

    /// Does a relation in this tier SURVIVE recovery (either restored or
    /// regenerated)? The upward-closed invariant quantifies over this set.
    [<CompiledName "Survives">]
    let survives (t: DurabilityTier) : bool =
        match t with
        | Durable | Derived -> true
        | Ephemeral -> false

    /// The override order: `Ephemeral < Derived < Durable`.
    [<CompiledName "Rank">]
    let rank (t: DurabilityTier) : int =
        match t with
        | Ephemeral -> 0
        | Derived -> 1
        | Durable -> 2

    /// The stable manifest tag for a tier (lower-case, matches the design
    /// doc's vocabulary).
    [<CompiledName "Tag">]
    let tag (t: DurabilityTier) : string =
        match t with
        | Durable -> "durable"
        | Derived -> "derived"
        | Ephemeral -> "ephemeral"

    /// **Classify a registered dataflow graph.** Validates the graph
    /// (unique names, known edges, acyclic), applies the locked policy
    /// (leaves declare; internal auto-classify; override-upward), and
    /// enforces the upward-closed invariant. All-or-nothing: EVERY error
    /// across the graph is collected (deterministic order), never just the
    /// first. `Ok` carries the full assignment — the manifest's rows —
    /// sorted by name in binary collation.
    [<CompiledName "Classify">]
    let classify (nodes: TierNode list) : Result<TierAssignment list, TierError list> =
        // ── structural validation ─────────────────────────────────────
        let dupErrs =
            nodes
            |> List.groupBy (fun n -> n.Name)
            |> List.choose (fun (name, ns) -> if List.length ns > 1 then Some(DuplicateNode name) else None)
            |> List.sortWith (fun a b -> compare a b)
        let byName = nodes |> List.map (fun n -> n.Name, n) |> Map.ofList
        let edgeErrs =
            [ for n in nodes do
                for d in n.DependsOn do
                    if not (byName.ContainsKey d) then
                        yield UnknownDependency(n.Name, d) ]
        if not (List.isEmpty dupErrs && List.isEmpty edgeErrs) then
            Error(List.distinct (dupErrs @ edgeErrs))
        else
            // ── topological order (Kahn); leftover nodes = cycle ──────
            let names = nodes |> List.map (fun n -> n.Name) |> List.sortWith ordinal
            let mutable inDegree = names |> List.map (fun n -> n, 0) |> Map.ofList
            for n in nodes do
                for _d in n.DependsOn do
                    inDegree <- inDegree.Add(n.Name, inDegree.[n.Name] + 1)
            let dependants =
                // dep -> nodes that depend on it (edges point downstream)
                nodes
                |> List.collect (fun n -> n.DependsOn |> List.map (fun d -> d, n.Name))
                |> List.groupBy fst
                |> List.map (fun (d, es) -> d, es |> List.map snd |> List.sortWith ordinal)
                |> Map.ofList
            let ready = System.Collections.Generic.PriorityQueue<string, string>(
                            { new System.Collections.Generic.IComparer<string> with
                                member _.Compare(a, b) = ordinal a b })
            for KeyValue(n, deg) in inDegree do
                if deg = 0 then ready.Enqueue(n, n)
            let topo = ResizeArray<string>()
            while ready.Count > 0 do
                let n = ready.Dequeue()
                topo.Add n
                match Map.tryFind n dependants with
                | Some ds ->
                    for d in ds do
                        let deg = inDegree.[d] - 1
                        inDegree <- inDegree.Add(d, deg)
                        if deg = 0 then ready.Enqueue(d, d)
                | None -> ()
            if topo.Count <> List.length nodes then
                let inCycle = names |> List.filter (fun n -> not (topo.Contains n))
                Error [ DependencyCycle inCycle ]
            else
                // ── policy + invariant, in topological order ──────────
                let mutable assigned : Map<string, DurabilityTier> = Map.empty
                let mutable errs : TierError list = []
                let mutable rows : TierAssignment list = []
                for name in topo do
                    let node = byName.[name]
                    let deps = node.DependsOn |> List.sortWith ordinal
                    let firstEphemeralDep =
                        deps |> List.tryFind (fun d ->
                            match Map.tryFind d assigned with
                            | Some t -> not (survives t)
                            | None -> false) // dep errored earlier; don't cascade a second error
                    let record tier reason =
                        assigned <- assigned.Add(name, tier)
                        rows <- { Name = name; Tier = tier; Reason = reason; DependsOn = deps } :: rows
                    if List.isEmpty node.DependsOn then
                        // A LEAF: intent must be declared, and `Derived` is meaningless.
                        match node.Declared with
                        | None -> errs <- UndeclaredLeaf name :: errs
                        | Some Derived -> errs <- LeafDeclaredDerived name :: errs
                        | Some t -> record t DeclaredLeaf
                    else
                        // INTERNAL: auto-classify, then apply the declaration rules.
                        let auto, autoReason =
                            match firstEphemeralDep with
                            | Some d -> Ephemeral, AutoEphemeral d
                            | None -> Derived, AutoDerived
                        match node.Declared with
                        | None -> record auto autoReason
                        | Some d when d = auto -> record auto autoReason // redundant declaration, harmless
                        | Some d when rank d < rank auto -> errs <- DownwardOverride(name, d, auto) :: errs
                        | Some Durable -> record Durable (DeclaredOverride auto) // upward: self-contained persistence
                        | Some d ->
                            // Upward to a NON-self-contained tier (Ephemeral→Derived):
                            // the relation would recompute from a lost input — the
                            // upward-closed invariant, violated on a named edge.
                            match firstEphemeralDep with
                            | Some via -> errs <- SurvivorDependsOnEphemeral(name, d, via) :: errs
                            | None -> record d (DeclaredOverride auto)
                if not (List.isEmpty errs) then
                    Error(List.rev errs |> List.distinct)
                else
                    Ok(rows |> List.sortWith (fun a b -> ordinal a.Name b.Name))

    // ── the generated tier manifest ───────────────────────────────────

    let private escape (s: string) : string =
        let sb = StringBuilder(s.Length)
        for c in s do
            match c with
            | '\\' -> sb.Append "\\\\" |> ignore
            | '\t' -> sb.Append "\\t" |> ignore
            | '\n' -> sb.Append "\\n" |> ignore
            | '\r' -> sb.Append "\\r" |> ignore
            | c -> sb.Append c |> ignore
        sb.ToString()

    let private reasonTag (r: TierReason) : string =
        match r with
        | DeclaredLeaf -> "declared-leaf"
        | AutoDerived -> "auto-derived"
        | AutoEphemeral d -> "auto-ephemeral-via:" + escape d
        | DeclaredOverride auto -> "declared-override-from:" + tag auto

    /// **Render the generated tier manifest** — the audit artifact of §7
    /// decision 3 ("emit the computed classification"). Canonical text:
    /// line 1 the format sentinel, then one sorted line per relation:
    /// `name TAB tier TAB reason TAB dep1,dep2,…`. Deterministic
    /// byte-for-byte, so it can be checked in and diffed; a
    /// classification change shows up as a manifest diff in review.
    [<CompiledName "RenderManifest">]
    let renderManifest (assignments: TierAssignment list) : string =
        let sb = StringBuilder()
        sb.Append "ztiermanifest/1" |> ignore
        for a in assignments |> List.sortWith (fun x y -> ordinal x.Name y.Name) do
            sb.Append('\n').Append(escape a.Name).Append('\t').Append(tag a.Tier).Append('\t')
              .Append(reasonTag a.Reason).Append('\t')
              .Append(String.concat "," (a.DependsOn |> List.map escape))
            |> ignore
        sb.ToString()

    /// `classify` + `renderManifest` in one step — registration's output
    /// pair: the machine assignment and the human/audit artifact.
    [<CompiledName "ClassifyToManifest">]
    let classifyToManifest (nodes: TierNode list) : Result<TierAssignment list * string, TierError list> =
        classify nodes |> Result.map (fun rows -> rows, renderManifest rows)
