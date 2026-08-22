module Zeta.Tests.ClaimLaneTests

open System
open System.IO
open global.Xunit
open Zeta.Core

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Tests for the lane classifier (work-item 081M00TS219087G0R0016S5PMC).
//
// The bar these tests exist to clear, stated so a reviewer can check it was cleared:
//
//   A. an edit pair that genuinely CANNOT be commutatively represented routes to Lane 2;
//   B. an edit pair that CAN routes to Lane 1, and its merge is order-independent + redelivery-safe;
//   C. the classifier can be caught being wrong — every guard, removed one at a time, flips a case
//      from Lane 2 to Lane 1, with a coverage floor so an empty mutant set fails instead of passing;
//   D. the |Aut| rigidity gate catches a case every per-edit predicate misses;
//   E. the Z-set fragment of QuorumAlgebra is exact (the EPS caveat does not bite);
//   F. the real claim document parses, with a floor so a broken parser fails rather than reporting
//      a clean empty scan.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

let private doc (entries: string list) : ClaimLane.ClaimDoc =
    ClaimLane.parse (String.Join("\n", entries))

/// An entry in the claim format: `- **ID** *body.*` followed by indented prose.
let private entry (id: string) (body: string) (prose: string) : string =
    sprintf "- **%s** *%s*\n  %s" id body prose

let private isLane1 (v: ClaimLane.Verdict) =
    match v with
    | ClaimLane.Verdict.Lane1 -> true
    | ClaimLane.Verdict.Lane2 _ -> false

let private reasonsOf (v: ClaimLane.Verdict) =
    match v with
    | ClaimLane.Verdict.Lane1 -> []
    | ClaimLane.Verdict.Lane2 rs -> rs

// ══ §A — the judgment case routes to Lane 2 ═══════════════════════════════════════════════════════

[<Fact>]
let ``A1: two sites reword the same claim differently - NOT commutatively representable - Lane 2`` () =
    // The forcing case. Both sites keep the id BP-01 and change what it says, in incompatible
    // directions. There is no assert/retract over a shared vocabulary that expresses this: the
    // vocabulary atom itself is contested. A commutative union here would silently hold both.
    let b = doc [ entry "BP-01" "Descriptions are third-person." "Rationale: selection accuracy." ]
    let a = doc [ entry "BP-01" "Descriptions are second-person." "Rationale: selection accuracy." ]
    let c = doc [ entry "BP-01" "Descriptions are first-person." "Rationale: selection accuracy." ]

    let v = ClaimLane.classify b a c
    Assert.False(isLane1 v, "a contested claim body must never reach the commutative lane")
    Assert.Contains(ClaimLane.Reason.SameIdDifferentBody "BP-01", reasonsOf v)

[<Fact>]
let ``A2: prose edits never reach Lane 1 - the irreducibly non-commutative region`` () =
    let b = doc [ entry "BP-01" "Descriptions are third-person." "Rationale: selection accuracy." ]
    let a = doc [ entry "BP-01" "Descriptions are third-person." "Rationale: it reads better this way." ]
    let v = ClaimLane.classify b a b
    Assert.False(isLane1 v)
    Assert.Contains(ClaimLane.Reason.ProseTouched "BP-01", reasonsOf v)

// ══ §B — the commutative case routes to Lane 1, and the merge behaves ═════════════════════════════

[<Fact>]
let ``B1: two sites each add a distinct fresh claim - commutative - Lane 1`` () =
    // Pure monotone addition over disjoint fresh ids. No existing atom is touched, nothing cites the
    // new claims, no prose of an existing claim moves. This is exactly what Lane 1 is for.
    let b = doc [ entry "BP-01" "Descriptions are third-person." "Rationale: selection accuracy." ]
    let a = doc [ entry "BP-01" "Descriptions are third-person." "Rationale: selection accuracy."
                  entry "BP-02" "Every skill declares what it does not do." "Rationale: scope gate." ]
    let c = doc [ entry "BP-01" "Descriptions are third-person." "Rationale: selection accuracy."
                  entry "BP-03" "Skill bodies stay under three hundred lines." "Rationale: bloat dilutes." ]

    Assert.True(isLane1 (ClaimLane.classify b a c),
                sprintf "expected Lane 1, got %A" (reasonsOf (ClaimLane.classify b a c)))

[<Fact>]
let ``B2: the Lane 1 merge is order-independent and redelivery-safe`` () =
    // Order-independence is `interfere`'s commutativity; redelivery-safety is `join`'s idempotence.
    // Both are needed and neither implies the other — an idempotent group is trivial, so one
    // operator could not have supplied both (BeliefConvergence.fs).
    let b = doc [ entry "BP-01" "Descriptions are third-person." "Rationale: selection accuracy." ]
    let a = doc [ entry "BP-01" "Descriptions are third-person." "Rationale: selection accuracy."
                  entry "BP-02" "Every skill declares what it does not do." "Rationale: scope gate." ]
    let c = doc [ entry "BP-01" "Descriptions are third-person." "Rationale: selection accuracy."
                  entry "BP-03" "Skill bodies stay under three hundred lines." "Rationale: bloat dilutes." ]

    let ab = ClaimLane.lane1Merge b [ "A", a; "B", c ]
    let ba = ClaimLane.lane1Merge b [ "B", c; "A", a ]
    Assert.Equal<(string * float) list>(ab, ba)

    // redelivery: the same site's contribution arriving twice must count once.
    let twice = ClaimLane.lane1Merge b [ "A", a; "B", c; "A", a ]
    Assert.Equal<(string * float) list>(ab, twice)

    // and the merged set is a valid claim set — every atom weight in {0,1}.
    Assert.Empty(ClaimLane.lane1Anomalies ab)
    Assert.Equal(3, ab |> List.filter (fun (_, w) -> w > 0.5) |> List.length)

// ══ §C — the mutation harness: prove the classifier can be caught being wrong ═════════════════════

/// One mutant: a guard removed, and a case that the full classifier refuses. If removing the guard
/// does not flip that case to Lane 1, the guard is not load-bearing on it and the test says so.
type private Mutant =
    { Guard: ClaimLane.Guard
      Name: string
      Base: ClaimLane.ClaimDoc
      A: ClaimLane.ClaimDoc
      B: ClaimLane.ClaimDoc }

let private mutants : Mutant list =
    let plain id body = entry id body "Rationale: unremarkable."
    [
      // Prose — an uncited claim whose rationale moved and nothing else.
      { Guard = ClaimLane.Guard.Prose
        Name = "prose edit slips into the commutative lane"
        Base = doc [ plain "BP-01" "Descriptions are third-person." ]
        A = doc [ entry "BP-01" "Descriptions are third-person." "Rationale: entirely rewritten." ]
        B = doc [ plain "BP-01" "Descriptions are third-person." ] }

      // SameIdDifferentBody — the headline collision.
      { Guard = ClaimLane.Guard.SameIdDifferentBody
        Name = "two incompatible meanings union under one id"
        Base = doc [ plain "BP-01" "Descriptions are third-person." ]
        A = doc [ plain "BP-01" "Descriptions are second-person." ]
        B = doc [ plain "BP-01" "Descriptions are first-person." ] }

      // RetractRacesEdit — withdrawal on one side, revision on the other.
      { Guard = ClaimLane.Guard.RetractRacesEdit
        Name = "a retraction races an edit to the same claim"
        Base = doc [ plain "BP-01" "Descriptions are third-person." ]
        A = doc [ ]
        B = doc [ entry "BP-01" "Descriptions are third-person." "Rationale: unremarkable. <https://example.org/x>" ] }

      // DependencyCheck — Bayou's mechanism: the edited claim is cited by another.
      { Guard = ClaimLane.Guard.DependencyCheck
        Name = "a cited claim is revised out from under its citer"
        Base = doc [ plain "BP-01" "Descriptions are third-person."
                     entry "BP-02" "Skills declare non-goals." "Rationale: see BP-01 for the scope gate." ]
        A = doc [ plain "BP-01" "Descriptions are keyword-rich only."
                  entry "BP-02" "Skills declare non-goals." "Rationale: see BP-01 for the scope gate." ]
        B = doc [ plain "BP-01" "Descriptions are third-person."
                  entry "BP-02" "Skills declare non-goals." "Rationale: see BP-01 for the scope gate." ] }

      // Parseability — unsure must route to Lane 2, not be dropped.
      { Guard = ClaimLane.Guard.Parseability
        Name = "an unresolvable entry is treated as if it were nothing"
        Base = doc [ plain "BP-01" "Descriptions are third-person."; "- **BP-77** **Rationale:** no claim body here" ]
        A = doc [ plain "BP-01" "Descriptions are third-person."; "- **BP-77** **Rationale:** no claim body here" ]
        B = doc [ plain "BP-01" "Descriptions are third-person."; "- **BP-77** **Rationale:** no claim body here" ] }

      // VocabularyRigidity — the |Aut| gate; see §D for why nothing else catches this.
      { Guard = ClaimLane.Guard.VocabularyRigidity
        Name = "interchangeable ids let two retractions annihilate a claim"
        Base = doc [ plain "BP-01" "Descriptions are third-person."
                     plain "BP-02" "Descriptions are third-person." ]
        A = doc [ plain "BP-02" "Descriptions are third-person." ]
        B = doc [ plain "BP-01" "Descriptions are third-person." ] }
    ]

[<Fact>]
let ``C1: every guard is load-bearing - removing it routes a judgment case to Lane 1`` () =
    // COVERAGE FLOOR. An empty or shrunken mutant list must fail here rather than report success on
    // an empty set — the failure mode this repo has spent the day removing.
    Assert.Equal(List.length ClaimLane.allGuards, List.length mutants)
    Assert.Equal<ClaimLane.Guard list>(
        ClaimLane.allGuards |> List.sortBy (sprintf "%A"),
        mutants |> List.map (fun m -> m.Guard) |> List.sortBy (sprintf "%A"))
    Assert.True(List.length mutants >= 6, "mutant corpus floor: at least one case per guard")

    for m in mutants do
        // The full classifier must refuse this case...
        let full = ClaimLane.classify m.Base m.A m.B
        Assert.False(isLane1 full, sprintf "guard %A: full classifier should refuse Lane 1 for '%s'" m.Guard m.Name)

        // ...and the permissive mutant with exactly that guard removed must admit it. This is the
        // demonstrated red: the guard alone is what stands between this edit and a green union.
        let enabled = ClaimLane.allGuards |> List.filter (fun g -> g <> m.Guard) |> Set.ofList
        let mutated = ClaimLane.classifyOmitting enabled m.Base m.A m.B
        Assert.True(isLane1 mutated,
                    sprintf "guard %A is NOT load-bearing for '%s': removing it still gave %A"
                            m.Guard m.Name (reasonsOf mutated))

[<Fact>]
let ``C2: the permissive classifier unions two incompatible meanings under one id`` () =
    // The failure this design exists to prevent, executed end to end. With SameIdDifferentBody
    // removed, the classifier routes two incompatible rewordings to Lane 1 and the merged result
    // holds BOTH meanings under the single name BP-01.
    //
    // CORRECTION TO THIS TEST'S FIRST DRAFT, kept visible because it sharpens the real finding:
    // I first asserted the merge stays silent here. It does not — the base atom is retracted by
    // both sites and sums to -1, which `lane1Anomalies` reports. So for THIS misclassification the
    // Z-set weights are a genuine second line of defence, and the "green while wrong" claim is too
    // strong. The case where every check really is silent is D2, and that is the one that justifies
    // the rigidity gate.
    let m = mutants |> List.find (fun m -> m.Guard = ClaimLane.Guard.SameIdDifferentBody)
    let enabled = ClaimLane.allGuards |> List.filter (fun g -> g <> m.Guard) |> Set.ofList
    Assert.True(isLane1 (ClaimLane.classifyOmitting enabled m.Base m.A m.B))

    let merged = ClaimLane.lane1Merge m.Base [ "A", m.A; "B", m.B ]
    let live = merged |> List.filter (fun (_, w) -> w > 0.5) |> List.map fst

    // Two surviving atoms for the SAME claim id — two meanings unioned under one name.
    Assert.Equal(2, live |> List.filter (fun a -> a.StartsWith("BP-01", StringComparison.Ordinal)) |> List.length)

    // And the measured truth: the weight check DOES fire here, on the doubly-retracted base atom.
    let anomalies = ClaimLane.lane1Anomalies merged
    Assert.NotEmpty(anomalies)
    Assert.All(anomalies, fun (_, w) -> Assert.Equal(-1.0, w))

// ══ §D — the |Aut| investigation: does the imposition budget find a Lane-2 trigger? ════════════════

[<Fact>]
let ``D1: a vocabulary with distinct claims is rigid - upper bound 1 is exact`` () =
    let d = doc [ entry "BP-01" "Descriptions are third-person." "Rationale: selection accuracy."
                  entry "BP-02" "Skills declare non-goals." "Rationale: scope gate." ]
    Assert.Equal(bigint 1, ClaimLane.autUpperBound d)
    Assert.True(ClaimLane.isRigid d)
    Assert.Equal(0.0, ClaimLane.impositionBits d)

[<Fact>]
let ``D2: interchangeable ids are the Lane-2 trigger the per-edit predicates miss`` () =
    // THE INVESTIGATION RESULT, stated as an executable claim.
    //
    // Two claims identical in every declared invariant. Site A retracts one, site B retracts the
    // other. Each site believes it removed a duplicate; together they remove the claim entirely.
    let b = doc [ entry "BP-01" "Descriptions are third-person." "Rationale: unremarkable."
                  entry "BP-02" "Descriptions are third-person." "Rationale: unremarkable." ]
    let a = doc [ entry "BP-02" "Descriptions are third-person." "Rationale: unremarkable." ]
    let c = doc [ entry "BP-01" "Descriptions are third-person." "Rationale: unremarkable." ]

    // The vocabulary is floppy: BP-01 and BP-02 are interchangeable, so |Aut| >= 2! = 2.
    Assert.Equal(bigint 2, ClaimLane.autUpperBound b)
    Assert.Equal(1.0, ClaimLane.impositionBits b)

    // 1. Every per-edit predicate is SILENT. With rigidity removed, this routes to Lane 1.
    let perEdit =
        ClaimLane.allGuards
        |> List.filter (fun g -> g <> ClaimLane.Guard.VocabularyRigidity)
        |> Set.ofList
    Assert.True(isLane1 (ClaimLane.classifyOmitting perEdit b a c),
                "expected every per-edit predicate to be silent on the interchangeable-id case")

    // 2. The post-hoc weight check is ALSO silent — every atom lands in {0,1}, so the merge itself
    //    cannot notice. This is what makes the rigidity gate non-redundant rather than a second
    //    spelling of the anomaly check.
    let merged = ClaimLane.lane1Merge b [ "A", a; "B", c ]
    Assert.Empty(ClaimLane.lane1Anomalies merged)
    Assert.Empty(merged |> List.filter (fun (_, w) -> w > 0.5))   // the claim is gone entirely

    // 3. The full classifier refuses, and names the reason.
    let v = ClaimLane.classify b a c
    Assert.False(isLane1 v)
    Assert.Contains(ClaimLane.Reason.VocabularyNotRigid "2", reasonsOf v)

[<Fact>]
let ``D3: rigidity is a property of the vocabulary - it fires with an empty diff`` () =
    // The honest shape of the finding: this is a PRECONDITION on the lane, not a per-edit trigger.
    // Nothing was edited at all and Lane 1 is still refused, which no per-edit predicate can do.
    let b = doc [ entry "BP-01" "Descriptions are third-person." "Rationale: unremarkable."
                  entry "BP-02" "Descriptions are third-person." "Rationale: unremarkable." ]
    Assert.Empty(ClaimLane.diff b b)
    Assert.False(isLane1 (ClaimLane.classify b b b))

// ══ §E — the Z-set fragment of QuorumAlgebra is exact ═════════════════════════════════════════════

[<Fact>]
let ``E1: assert and retract annihilate exactly - the EPS drop is the Z-set zero convention`` () =
    // QuorumAlgebra's float caveat (EPS = 1e-12 breaks associativity for general amplitudes) does not
    // bite for Z-set weights: +1 and -1 are exact in IEEE-754, every partial sum is an exact integer,
    // so the drop fires at sum = 0 and nowhere else. Claimed in the module header; pinned here.
    let b = doc [ entry "BP-01" "Descriptions are third-person." "Rationale: unremarkable." ]
    let a = doc [ ]                                  // A retracts the only claim
    let merged = ClaimLane.lane1Merge b [ "A", a ]
    Assert.Empty(merged)                             // exact annihilation, atom dropped

    // ...and a lone assert survives with weight exactly 1.0, not 0.9999...
    let c = doc [ entry "BP-01" "Descriptions are third-person." "Rationale: unremarkable."
                  entry "BP-02" "Skills declare non-goals." "Rationale: scope gate." ]
    let m2 = ClaimLane.lane1Merge b [ "A", c ]
    Assert.All(m2, fun (_, w) -> Assert.Equal(1.0, w))

[<Fact>]
let ``E2: double retraction is an anomaly the merge itself reports`` () =
    // Retraction is not idempotent across DISTINCT sources — join dedups by source, so two different
    // sites retracting the same atom sum to -1. That is outside {0,1} and is therefore proof, after
    // the fact, that the pair was not commutative-representable. A second, independent falsifier.
    let b = doc [ entry "BP-01" "Descriptions are third-person." "Rationale: unremarkable."
                  entry "BP-02" "Skills declare non-goals." "Rationale: scope gate." ]
    let a = doc [ entry "BP-02" "Skills declare non-goals." "Rationale: scope gate." ]
    let merged = ClaimLane.lane1Merge b [ "A", a; "B", a ]
    let anomalies = ClaimLane.lane1Anomalies merged
    Assert.NotEmpty(anomalies)
    Assert.All(anomalies, fun (_, w) -> Assert.Equal(-1.0, w))

// ══ §F — the real claim document, with a coverage floor ═══════════════════════════════════════════

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(Reflection.Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

[<Fact>]
let ``F1: the shipped claim layer parses, with a floor so an empty scan cannot pass`` () =
    let path = Path.Join(repoRoot (), "docs", "AGENT-BEST-PRACTICES.md")
    Assert.True(File.Exists path, sprintf "claim document not found: %s" path)

    let d = ClaimLane.parse (File.ReadAllText path)

    // THE FLOOR. A parser that silently matches nothing would otherwise report a clean, rigid,
    // fully-Lane-1 document — a check that did not run looking exactly like one that passed.
    Assert.True(d.Claims.Count >= 20,
                sprintf "coverage floor: expected >= 20 parsed claims, got %d" d.Claims.Count)

    // The dependency-check edge set must be non-empty too, or Bayou's guard is untested in the wild.
    // Measured 2026-08-14: exactly 3 (BP-17<->BP-18, BP-28->BP-27).
    let edges = d.Claims |> Map.toList |> List.sumBy (fun (_, c) -> c.Cites.Count)
    Assert.True(edges >= 3, sprintf "coverage floor: expected >= 3 cross-references, got %d" edges)

    // Structured anchors must be separable from prose in the wild, or the Lane-1 "pointer update"
    // admission is unreachable on the real document. Measured 2026-08-14: 57.
    let anchors = d.Claims |> Map.toList |> List.sumBy (fun (_, c) -> c.Anchors.Count)
    Assert.True(anchors >= 20, sprintf "coverage floor: expected >= 20 structured anchors, got %d" anchors)

    // Every parsed claim has a non-empty id and body — a claim with an empty body would collapse
    // bodies together and silently inflate |Aut|.
    Assert.All(d.Claims |> Map.toList |> List.map snd, fun c ->
        Assert.False(String.IsNullOrWhiteSpace c.Id)
        Assert.False(String.IsNullOrWhiteSpace c.Body))

[<Fact>]
let ``F3: the one non-conforming entry is named, not skipped`` () =
    // FOUND BY THIS WORK, and it is the failure class the classifier exists to prevent, occurring in
    // the parser itself. The first draft of `parse` matched only `- **ID** *body*` and silently
    // DROPPED BP-25, which is written `- **BP-25: title — ...**` with no italic body. 27 of 28
    // entries parsed and nothing reported the 28th: a claim present in the document and absent from
    // the parse, with a green scan on top of it.
    //
    // Fixed by making a bullet whose bold run opens with a claim-id-shaped token, and which does not
    // match the entry format, an explicit `Unparseable` region — so it reaches Lane 2 instead of
    // vanishing. This test pins the known non-conformance so that a NEW one goes red rather than
    // quietly joining it.
    let path = Path.Join(repoRoot (), "docs", "AGENT-BEST-PRACTICES.md")
    let d = ClaimLane.parse (File.ReadAllText path)

    Assert.Equal(1, d.Unparsed.Length)
    Assert.Contains("BP-25", List.head d.Unparsed)

    // Consequence, stated so it is not mistaken for a passing grade: the shipped claim document is
    // NOT fully Lane-1 eligible today, because one entry is unparseable and unsure routes to Lane 2.
    Assert.False(isLane1 (ClaimLane.classify d d d))

[<Fact>]
let ``F2: the shipped claim vocabulary is rigid today - a live regression guard`` () =
    // Measured, not assumed. If a future edit introduces two claims identical in every declared
    // invariant, |Aut| rises above 1, retraction-by-id stops being sound, and this goes red with the
    // offending count in the message.
    let path = Path.Join(repoRoot (), "docs", "AGENT-BEST-PRACTICES.md")
    let d = ClaimLane.parse (File.ReadAllText path)
    let bound = ClaimLane.autUpperBound d
    Assert.True((bound = bigint 1),
                sprintf "claim vocabulary is no longer rigid: |Aut| upper bound = %O (%.4f bits of residual choice)"
                        bound (ClaimLane.impositionBits d))
