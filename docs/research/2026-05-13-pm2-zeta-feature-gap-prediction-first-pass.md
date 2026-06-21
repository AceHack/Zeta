# PM-2 Feature-Gap Prediction — First Research Pass
<!-- 081KR2E4K0008QG0R003VB7ZZR deliverable. Produced 2026-05-13 by Otto wearing the PM-2 skill. -->

**PM-2 role:** proactive gap-prediction before consumer friction.
**Sources checked:** README, TECH-RADAR, VISION, `src/Core/`, `src/Core.CSharp/`,
`Directory.Build.props`, `docs/backlog/P*/B-0*.md` (544 rows), recent PRs,
`samples/`, `proofs/`.
**Prior-art search:** ran before each gap; no duplicate rows found except where noted.

---

## Gap 1 — No getting-started guide for library consumers

### Product Bet

- **User / moment:** external .NET developer who finds `Zeta.Core` on NuGet or GitHub
  and wants to write their first incremental circuit. They land on the README and
  encounter Budiu et al. VLDB'23 math in the second paragraph.
- **Signal:** `docs/getting-started.md` does not exist. The README's introductory
  paragraphs target readers already familiar with DBSP theory. No "hello world"
  circuit example appears before the operator catalogue.
- **Proposed slices:**
  1. `docs/getting-started.md` — 5-step quickstart: install → create circuit → map →
     step/tick → inspect output. Targets a C# developer who has never heard of DBSP.
  2. `samples/QuickStart/` — minimal standalone project (single `.csproj`) that mirrors
     the quickstart doc.
  3. Pin a "Getting Started" link in the top-level README badge row.
- **Why now:** every new consumer who bounces in the first 5 minutes is a permanent
  loss. The library is production-ready (0 warnings, extensive tests, TECH-RADAR
  stability notes) but the entry path is research-paper difficulty. The mismatch is
  the gap.
- **Non-goals:** does not replace the operator catalogue; does not add new operators;
  does not touch the F# API surface.
- **Acceptance criteria:**
  - `docs/getting-started.md` exists with a working 5-step C# example.
  - `samples/QuickStart/` builds and runs with `dotnet run`.
  - README links to the guide within the first 10 lines.
- **Kill criteria:** if the Aurora pitch / factory-demo demo-path already covers this
  consumer moment, promote that as the canonical quickstart instead of creating a
  parallel doc.
- **New backlog row:** 081KRFA460008QG0R001SXP0C2

---

## Gap 2 — C# operator surface covers only variance shims

### Product Bet

- **User / moment:** C# developer who prefers fluent-builder or extension-method style.
  They open `Zeta.Core.CSharp` and find one file: `Variance.cs` — declaration-site
  variant interfaces. Every operator (`Map`, `Filter`, `Join`, `Distinct`, `GroupBy`,
  `Window`) requires F# idioms.
- **Signal:** `src/Core.CSharp/` contains exactly `Variance.cs`. The CSharp sample in
  `samples/FactoryDemo.Api.CSharp/` builds against `Zeta.Core` (F# surface) directly.
  No C#-idiomatic entry path exists for the core circuit-building API.
- **Proposed slices:**
  1. `ZetaBuilder<T>` — a C# fluent class wrapping `Circuit` and the `Op<'T>` graph
     so consumers can write `circuit.From(source).Map(...).Filter(...).Join(...)`.
  2. Extension methods on `Op<ZSet<'K>>` for the most common operators.
  3. XML doc comments on all public C# symbols (IntelliSense parity with the F# surface).
- **Why now:** the README says "a surface that feels native to both F# and C#" — the
  current state does not deliver on that claim for the operator layer. The CSharp sample
  builds but uses the F# discriminated-union surface directly, which is awkward for
  everyday C# style.
- **Non-goals:** does not rewrite the F# core; does not change operator semantics.
- **Acceptance criteria:**
  - `samples/FactoryDemo.Api.CSharp/` rewritten to use the new C# fluent API, not
    raw F# types.
  - All operators covered: Map, Filter, Join, GroupBy, Distinct, Window (sliding).
  - `dotnet build -c Release` 0 warnings.
- **Kill criteria:** if the Aurora pitch routes exclusively through F# (no C# consumer
  target), defer to P2.
- **New backlog row:** 081KRFA460008QG0R002JQERS5

---

## Gap 3 — Core DBSP identities are executable tests, not formal proofs

### Product Bet

- **User / moment:** academic reviewer, potential enterprise adopter, or alignment
  researcher who wants to cite Zeta as a verified implementation of DBSP. They
  look for `proofs/` and find `ChainRule.lean` — a stub with no body.
- **Signal:** `proofs/lean/ChainRule.lean` is a stub. TECH-RADAR lists Lean 4 +
  Mathlib as "Assess" (Round 10). The four core identities (`I ∘ D = D ∘ I = id`,
  chain rule for composition, linearity `Q^Δ = Q`, bilinear join rule) are tested
  as executable F# property tests but carry no formal proof certificate.
- **Proposed slices:**
  1. Complete `ChainRule.lean` — prove `D ∘ I = id` and `I ∘ D = id` for `ZSet`.
  2. `proofs/lean/LinearityRule.lean` — prove `Q^Δ = Q` for linear operators.
  3. Promote TECH-RADAR Lean 4 from Assess → Trial.
  4. README badge: "formally verified core identities."
- **Why now:** the TECH-RADAR has had Lean 4 on "Assess" since Round 10. The
  stub proof has not progressed. The F* extraction path (TECH-RADAR "Assess" entry)
  remains blocked on FastCdc off-by-one risk. A Lean-first proof of the core
  stream-calculus identities is the lowest-effort step to a verified claim, independent
  of the F* track.
- **Non-goals:** does not prove every operator; does not require full Mathlib port.
- **Acceptance criteria:**
  - `ChainRule.lean` has a complete, checked proof (no `sorry`).
  - CI runs `lake build` in `proofs/lean/` as a required check.
  - TECH-RADAR Lean 4 promoted to Trial.
- **Kill criteria:** if the F* extraction path (TECH-RADAR entry) ships first and
  covers the same identities, subsume this row under that.
- **New backlog row:** 081KRFA460008QG0R00168759Y

---

## Gap 4 — NuGet package metadata is sparse

### Product Bet

- **User / moment:** developer searching NuGet for an incremental / streaming operator
  library. They see `Zeta.Core` with author "zeta contributors" and a blank
  `PackageDescription`.
- **Signal:** `Directory.Build.props` has `<Authors>zeta contributors</Authors>` but
  no `<PackageDescription>`, `<PackageTags>`, `<RepositoryUrl>`, `<PackageLicenseExpression>`,
  or `<PackageProjectUrl>`. `PackageVersion` is absent (defaults to `1.0.0` on every
  build). This means the NuGet listing would have no description, no tags for search,
  no source-link URL, and a static version.
- **Proposed slices:**
  1. Add `PackageDescription`, `PackageTags` (dbsp, incremental, streaming, retraction,
     fsharp, dotnet), `RepositoryUrl`, `PackageLicenseExpression` to
     `Directory.Build.props`.
  2. Wire semantic versioning: `Version` driven by a `VERSION` file or git tag.
  3. Add `SourceLink` (Microsoft.SourceLink.GitHub) for debugger source navigation.
- **Why now:** the library is at a state where external interest is realistic (Aurora
  pitch active, 081KQGDBJ0008QG0R002NV04N9 GitHub Pages SEO row open). A NuGet listing with no description
  and no tags is invisible to search and looks abandoned.
- **Non-goals:** does not require publishing to NuGet.org yet; just ensures the metadata
  is correct for when publishing happens.
- **Acceptance criteria:**
  - `dotnet pack` produces a `.nupkg` with Description, Tags, RepositoryUrl populated.
  - Version is driven by a file/tag, not hard-coded `1.0.0`.
  - SourceLink verified by `dotnet pack --include-symbols`.
- **Kill criteria:** if NuGet publishing is explicitly deferred (WONT-DO) before Aurora
  pitch, note that in the row and defer to P3.
- **New backlog row:** 081KRFA460008QG0R000EJK30F

---

## Gap 5 — Shadow CLI slices 3–5 are P0 but have no implementation owner

### Product Bet

- **User / moment:** developer using an IDE (VS Code / Rider) who wants Zeta's
  shadow-mode autocomplete: the grey-text suggestion that accepts on Tab. This is
  the killer consumer feature in 081KR7JY10008QG0R0008NGW95. Without slices 3–5, the shadow observer
  can detect key events (`outlet.ts` ✅) but cannot read IDE grey-text
  (slice 3 — osascript) or provide a stable `zeta shadow --loop` entry point
  (slice 4).
- **Signal:** 081KRFA460008QG0R003C00WKR (slice 3 — macOS grey-text detection), 081KRFA460008QG0R000GVCKHE (slice 4 — CLI
  `--loop` flag), 081KRFA460008QG0R0028CR0N9 (slice 5 — distribution / demo packaging) are all P0 and
  open as of 2026-05-13. `tools/shadow/` contains the applescript
  (`detect-grey-text.applescript`) but no wiring to the shadow observer.
- **Proposed approach:** no new row needed — rows exist. But the PM-2 finding is that
  these three slices together form a **feature-complete shadow mode** and should be
  treated as a sprint unit, not separate atomic rows. The risk is that each slice gets
  deferred individually, leaving shadow mode perpetually "almost done."
- **Why now:** the Aurora pitch and factory-demo consumer moment both converge on "show
  the agent augmenting a real developer workflow." Shadow mode is the only Zeta feature
  that is visibly different from existing IDEs. Every tick these slices are deferred,
  the demo story weakens.
- **Non-goals:** does not add new shadow-mode capabilities; just completes the existing
  design.
- **Acceptance criteria:** 081KRFA460008QG0R003C00WKR + 081KRFA460008QG0R000GVCKHE + 081KRFA460008QG0R0028CR0N9 all closed by the same PR cluster.
- **Existing rows:** 081KRFA460008QG0R003C00WKR, 081KRFA460008QG0R000GVCKHE, 081KRFA460008QG0R0028CR0N9 (no new row needed).
- **Recommendation:** group 081KRFA460008QG0R003C00WKR/081KRFA460008QG0R000GVCKHE/081KRFA460008QG0R0028CR0N9 as a sprint target; treat them as
  blocked-together rather than individually deferrable.

---

## Gap 6 — DBpedia / HKT-MDM canonical demo has no implementation yet

### Product Bet

- **User / moment:** potential enterprise customer evaluating Zeta for master-data
  management. They ask "can I see this working against real data?" There is no running
  demo.
- **Signal:** 081KRFA460008QG0R0018SN61J (DBpedia via dotNetRDF + F# CE) was filed 2026-05-13 and is open.
  The VISION document names "intellectual backup of earth" as the terminal purpose.
  MDM (master data management) is the enterprise instantiation of that purpose.
  Without a demo, the thesis is not demonstrable.
- **Proposed approach:** no new row needed — 081KRFA460008QG0R0018SN61J exists and is unblocked.
- **Why now:** the Aurora pitch (PR #2924) references this demo. The pitch is live.
  The demo does not exist.
- **Non-goals:** does not require the F# type provider path (that's deferred in 081KRFA460008QG0R0018SN61J).
- **Existing row:** 081KRFA460008QG0R0018SN61J.

---

## Summary table

| Gap | Type | New row | Existing row | Priority |
|-----|------|---------|-------------|----------|
| Getting-started guide | UX / adoption | 081KRFA460008QG0R001SXP0C2 | — | P1 |
| C# fluent operator surface | API surface | 081KRFA460008QG0R002JQERS5 | — | P1 |
| Lean 4 formal proof completion | Verification | 081KRFA460008QG0R00168759Y | — | P2 |
| NuGet package metadata | Discoverability | 081KRFA460008QG0R000EJK30F | — | P2 |
| Shadow CLI slices 3–5 | Feature-complete | — | 081KRFA460008QG0R003C00WKR, 081KRFA460008QG0R000GVCKHE, 081KRFA460008QG0R0028CR0N9 | P0 |
| DBpedia / MDM demo | Demo / adoption | — | 081KRFA460008QG0R0018SN61J | P1 |

---

## Methodology note

Surface-first discipline: every gap was checked against the existing 544 backlog rows
before filing. New rows 081KRFA460008QG0R001SXP0C2..081KRFA460008QG0R000EJK30F were verified as net-new coverage. Gaps 5 and 6
point to existing rows rather than inflating the backlog.
