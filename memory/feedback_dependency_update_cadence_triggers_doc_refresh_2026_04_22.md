---
name: Dependency update cadence must be tracked; dependency releases trigger document refresh on docs referencing that dependency; 2026-04-22
description: Aaron 2026-04-22 auto-loop-20 directive — *"for our dependencies we need to track theri update cadence. it's a trigger for a document refresh on that dependency"*. Names a concrete signal-to-action linkage the factory currently lacks: dependencies age (NuGet packages, external tools, Claude Code harness, SDKs, standards like DORA/SPACE/DV-2.0, AI-model versions) and docs referencing them drift silently. The directive converts dependency-release-events into doc-refresh-triggers, making doc-currency a function of dep-currency rather than a standalone audit. Prevention-layer composition: extends the intentionality-enforcement framework — a dep release without a recorded refresh-decision (refresh / defer / irrelevant-here) is a silent gap. Composes with DV-2.0 `last_updated`, prevention-layer-classification doc, existing submit-nuget workflow (62 components enumerated per build but no downstream doc-refresh wiring), and the hygiene-audit pattern (detect + cadenced + prevention-bearing taxonomy).
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

Aaron 2026-04-22 auto-loop-20 (mid-tick arrival):

> *"for our dependencies we need to track theri update
>  cadence.  it's a trigger for a document refresh on
>  that dependency"*

## The rule

**Every dependency has an update cadence; every dependency
release is a trigger for doc-refresh on docs referencing
that dependency.** Doc-currency must track dep-currency, not
float independently. When a dep releases, the refresh-trigger
fires and every doc that references that dep must either
refresh (if the release changed something doc-relevant),
defer (recorded decision with reason), or be marked
irrelevant-here (this doc references the dep but no release
would ever affect it).

## Why:

- **Docs drift silently under dep motion.** A doc that
  cites `BenchmarkDotNet 0.15.8` today is ambient-wrong
  three months from now when 0.16.0 ships with renamed
  APIs or new primitives. Nothing in the factory currently
  *signals* this — the doc looks the same; the dep has
  moved. The maintainer pays the cost on next read: either
  follows stale instructions, or spends audit-time figuring
  out which version the doc was written against.
- **The factory has partial substrate for this already.**
  (a) `submit-nuget` workflow enumerates 62 NuGet components
  at every build — that's dep-detection. (b) DV-2.0
  frontmatter carries `last_updated` per skill — that's
  doc-currency. (c) Prevention-layer-classification
  separates prevention-bearing from detection-only. What's
  missing is the **wiring**: dep-release-event → doc-refresh-
  trigger. All three substrates are present; the edge
  between them isn't.
- **Intentionality-enforcement generalizes to this.** The
  reframe from the DV-2.0 / post-setup-script-stack work
  (*"we are enforcing intentional decisions"*) applies here
  verbatim: a dep release without a recorded
  refresh-decision is a silent gap; a dep release with a
  recorded decision (refresh / defer / irrelevant-here) is
  intentionality. The hygiene shape already has a template.
- **Cadence is not uniform across deps.** Some deps
  move weekly (Anthropic SDKs, Claude Code harness); some
  quarterly (.NET SDK, BenchmarkDotNet); some semi-annually
  (F# language, Arrow); some rarely (academic standards
  like DORA-four-keys, SPACE, OWASP LLM Top 10 — those
  update on multi-year cycles but still update). The
  tracking shape has to accommodate this heterogeneity —
  a flat "check monthly" audit is wrong shape; per-dep
  cadence is right shape.
- **Dep classes are heterogeneous.** NuGet packages,
  external docs (code.claude.com, platform.claude.com,
  MDN, GitHub Docs), tools (gh CLI, bun, TypeScript,
  PowerShell, dotnet), AI model versions (Opus/Sonnet/
  Haiku tier releases, effort-level semantics), standards
  (DORA, DV-2.0, OWASP, NIST AI RMF), Actions workflow
  versions (actions/checkout@v5, actions/setup-dotnet@vN).
  Each class has a different cadence-detection mechanism:
  NuGet has an API; model-versions track via Anthropic
  changelog; standards track via their own publication
  cadence. Unified audit, heterogeneous detection.
- **The trigger has to be persistent, not one-shot.** A
  single audit run that finds "dep X released on date Y"
  and produces a one-time refresh-list is insufficient —
  the next release needs the next trigger. The discipline
  has to be **cadenced**, with a history of
  detected-release-events and their downstream
  refresh-decisions, so a forensic audit can answer
  *"which dep-release caused this doc refresh?"* from a
  single substrate.

## How to apply:

- **Phase 1: inventory.** Enumerate factory-dependencies
  across all classes (NuGet packages, external-service
  doc URLs, CLI tools, AI model versions, standards,
  workflow-action pins). Output: a dep-registry table
  with (name, class, current-version, cadence-source,
  last-known-release-date, docs-referencing-this-dep).
  Effort: M — most of the data is scattered across
  `.csproj` / `Directory.Build.props` / workflow files /
  skill frontmatter / research docs; one audit pass
  collects it. Owner: Kenji + maintainer for the initial
  pass, then hygiene script maintains after first seed.
- **Phase 2: cadence-detection.** Per-class mechanisms:
  NuGet cadence via NuGet API; workflow-action cadence
  via GitHub Releases API; external-doc cadence via
  HTTP HEAD + Last-Modified; AI-model cadence via
  Anthropic changelog (RSS or scrape); standards
  cadence via their publishing URLs (DORA report
  annual, DV-2.0 multi-year). A cron-driven audit runs
  per-class detection and writes observed release-dates
  to the registry.
- **Phase 3: refresh-trigger wiring.** When the audit
  observes a release-date newer than the registry's
  last-known-release-date, it produces a refresh-list:
  the set of docs referencing that dep. The refresh-list
  becomes a BACKLOG row (or a labelled Issue) with the
  intentionality-enforcement shape — each doc gets a
  recorded decision (refresh / defer-with-reason /
  irrelevant-here). The audit doesn't refresh docs
  itself — it produces the trigger; a human or an
  agent executes the decision.
- **Phase 4: hygiene-audit composition.** The
  dependency-cadence-audit joins the hygiene ledger
  (FACTORY-HYGIENE row, numbered). Per the
  prevention-layer-classification discipline, it's
  **prevention-bearing**: it prevents silent doc-drift,
  not just detects it. The mini-ADR shape applies —
  each detected release-event gets a recorded decision
  block (date / context / decision / alternatives /
  supersedes / expires-when).
- **Dep-class-specific cadences are not assumed, they
  are observed.** Don't assume "NuGet = monthly"; the
  registry records actual-observed-cadence and updates
  over time. Some deps release faster than expected;
  some slower. The factory observes, doesn't prescribe.
- **Don't over-scope Phase 1.** A naive first pass
  tries to enumerate every single external reference
  across every doc. Better: seed the registry with the
  highest-turnover deps first (Claude Code harness,
  Anthropic SDKs, AI-model versions), let the cadence
  detect its own worth, expand scope as the discipline
  earns trust. The 62-NuGet-component list from
  submit-nuget is a ready-made Phase-1 seed for the
  NuGet class.

## What this memory is NOT

- **NOT a commitment to auto-refresh docs.** The trigger
  fires; the refresh is a recorded decision, not an
  automated rewrite. An AI-drafted doc-refresh can be
  agent-executed, but the *decision* to refresh (vs
  defer vs irrelevant-here) belongs to a human or to
  an agent with Aaron's explicit authorization for that
  class. Automated doc-rewrite on dep-release is not
  what this directive says.
- **NOT a license to expand scope silently.** Aaron said
  *"for our dependencies"* — meaning factory
  dependencies, not every external reference in every
  file. Scope-enumeration in Phase 1 gets flagged to
  Aaron for class-inclusion decisions before the
  registry is locked.
- **NOT a replacement for the existing `submit-nuget`
  workflow.** That workflow produces a snapshot for
  GitHub's dependency graph (SCA / vulnerability
  surface). The cadence-audit produces a refresh-trigger
  for doc-currency. Overlapping data source (NuGet
  components); distinct downstream consumers (security
  vs doc-hygiene).
- **NOT a one-off tool.** The cadence-audit is
  **cadenced** itself — it runs on a cron (daily or
  weekly, TBD), writes to a persistent registry, and
  accumulates release-history. A single audit output is
  insufficient; the substrate is the accumulating
  history of release-events + refresh-decisions.
- **NOT a blocker for other work.** The directive is
  P1 factory-hygiene (prevention-bearing); it does not
  block current ServiceTitan demo work, ARC3-DORA
  research, or drain-PR landings. Phase 1 inventory
  can be time-sliced across ticks.

## Composition with prior memories / docs

- `docs/hygiene-history/prevention-layer-classification.md`
  — dep-cadence audit is prevention-bearing (not
  detection-only); classification row should name it
  once phase 1 inventory lands.
- `feedback_enforcing_intentional_decisions_not_correctness.md`
  — dep-release without a recorded refresh-decision is
  the intentionality gap; decision-shape applies.
- `feedback_dv2_scope_universal_indexing.md` — DV-2.0
  `last_updated` per skill is the doc-currency side of
  the ledger; dep-cadence audit extends this to
  *referenced* deps, not just self-authorship.
- `docs/POST-SETUP-SCRIPT-STACK.md` + Q3 five-exception
  framework — the intentionality-pattern for
  classification is identical in shape: each
  dep-release gets a refresh-decision; each decision is
  auditable.
- `submit-nuget` workflow (`.github/workflows/`) —
  supplies 62 NuGet components as a ready-made Phase-1
  seed for the NuGet dep class.
- `docs/AUTONOMOUS-LOOP.md` Step 0 PR-pool audit —
  similar shape (cadenced audit produces trigger, not
  action); the dep-cadence audit can live as a sibling
  cadenced surface alongside the PR-pool audit.
- Mini-ADR pattern (`feedback_decision_audits_for_everything_that_makes_sense_mini_adr.md`)
  — per-release refresh-decisions ARE mini-ADRs; the
  pattern is already in place.

## Open questions flagged to Aaron, not self-resolved

- **Scope of "our dependencies":** code deps
  (NuGet, bun, .NET SDK) only? Or also external docs
  (code.claude.com, Anthropic changelog)? Or also
  standards (DORA, DV-2.0, OWASP)? Four plausible
  scopes (code-only / code+docs / code+docs+tools /
  code+docs+tools+standards).
- **Cadence-detection authority:** who sets the
  cadence per dep — the audit observes (purely
  empirical), or the registry encodes an
  expected-cadence that the audit compares against?
  First = fewer assumptions, slower signal on
  cadence-change. Second = faster signal, but risks
  prescribing wrong cadence.
- **Refresh-decision authority:** per-doc decisions
  belong to whoever owns the doc (human for
  governance docs; agent for agent-authored docs)?
  Or a central triage?
- **Audit cadence:** daily / weekly / per-tick?
  Per-tick is highest signal but highest noise;
  weekly is most human-readable; daily is probably
  right given AI-model version cadence. TBD with
  Aaron.
- **Historical seeding:** how many prior release-dates
  does the registry need at seed-time? Zero
  (start-tracking-now) is simplest; last-N-months is
  richer but requires historical lookup per class.

Flag these to Aaron when Phase 1 inventory starts; don't
self-resolve.
