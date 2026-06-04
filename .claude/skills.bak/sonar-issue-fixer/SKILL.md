---
name: sonar-issue-fixer
description: SonarLint/Roslyn analyzer triage — right long-term fix or documented suppression, never quick-appease edits.
---

# Sonar Issue Fixer — Procedure

**Sonar is only good if you drive it, don't let it drive
you. Never take the quick win to appease. Do the right
long-term thing even if it's a huge refactor — or suppress
with documented rationale. No third option.**

This skill codifies the two-path triage so agents and humans
process analyzer findings the same way.

## Scope

Applies to findings from any of these analyzers on C# code:

- **SonarAnalyzer.CSharp** — rule codes `Sxxxx` (e.g., S1905,
  S6966, S2699). Pinned in `Directory.Packages.props` but not
  yet wired into `Directory.Build.props` — the wire-in
  depends on clearing the first-pass 15-finding queue.
- **Meziantou.Analyzer** — rule codes `MAxxxx` (e.g., MA0048).
  Wired as of round 34; active on every C# build.
- **Built-in Roslyn analyzers** (`latest-recommended` per
  `Directory.Build.props`) — rule codes `CAxxxx`,
  `IDExxxx`, `CSxxxx`.
- **SonarLint VS Code extension** findings that the CLI
  build doesn't catch (rare once CLI is wired).

Also applies to F# analyzer findings from G-Research /
Ionide when the same driving-principle question arises.

## The rule (hard, no exceptions)

For every finding, produce exactly one of:

### (a) The right long-term fix

- Read the rule documentation end-to-end before touching
  code. Sonar and Meziantou rule pages name the motivating
  pattern; understand *why* the rule exists before deciding
  whether this case actually matches.
- If the rule's motivation applies to this code, do the
  real fix — the refactor that removes the actual defect,
  not the smallest change that silences the analyzer.
- A refactor that touches 10 files is fine. A refactor that
  changes the public API shape is fine (route through
  Ilyana for API review). A refactor that rewrites an
  entire operator is fine.
- The fix is green only when the rule no longer fires AND
  the code is genuinely better. If the fix silences the
  rule but feels wrong — it's not done.

### (b) Documented suppression

- If the rule's motivation does not apply to this specific
  case (false positive on our intent), suppress.
- Suppression carries mandatory documentation. The rationale
  comment must name (i) which rule is suppressed, (ii) why
  the rule's motivation does not apply here, (iii) what
  would need to change for the suppression to be removed.
- **`[SuppressMessage]` attributes on the target
  type/member are preferred.**
  The suppression and its rationale live right next to
  the code they apply to — a reader looking at the type
  sees both the rule being suppressed and the
  `Justification` string in one glance. `GlobalSuppressions.cs`
  is the scaling fallback for when per-target attachment
  isn't practical (e.g., the rule fires on generated code,
  or dozens of call sites all need the same suppression).
  Pragmas are ugly and should be avoided. Allowed sites
  in preference order:
  1. **`[SuppressMessage]` attribute on the specific
     type / member** — `[SuppressMessage("Design",
     "MA0048:...", Justification = "...")]` directly on
     the offending class / interface / method. Preferred
     for almost every case. File-level rationale (e.g.,
     "why four related types live in one file") goes as
     a comment at the file header; each type still
     carries its own attribute referencing the header.
  2. **`GlobalSuppressions.cs` at project root** with
     `[assembly: SuppressMessage(..., Justification = "...",
     Scope, Target)]`. Scaling fallback. Best fit when a
     single suppression targets N types or members the
     way `Scope` / `Target` can express cleanly, and
     repeating the per-target attribute N times would
     violate DRY.
  3. **`NoWarn` in `.csproj`** — project-wide
     suppression. Best fit when an entire project
     genuinely doesn't want the rule (e.g., a
     generated-code project).
  4. **`NoWarn` in `Directory.Build.props`** — repo-
     wide suppression. Reserved for "we never want this
     rule because our architecture makes it wrong
     everywhere" — extremely rare; requires Kenji
     sign-off.
  5. **`.editorconfig`** per-file override — allowed
     but discouraged for suppressions (prefer for
     formatting rules only; suppression accumulation in
     `.editorconfig` gets messy at scale).
- Per-file `#pragma warning disable` in source is **the
  last resort**, used only when the suppression is about
  a single line or inline expression that no
  `[SuppressMessage]` attachment point exists for. Even
  then, prefer a more-targeted `[SuppressMessage]` on an
  enclosing element with an inline `Justification` over
  a file-wide pragma.

### The forbidden third path

**Never** make the smallest change that silences the
analyzer without engaging with the question of correctness.
Examples of the forbidden pattern:

- Adding a discard `_ = Send(...)` to silence S6966
  instead of awaiting the async version.
- Removing a cast that was actually load-bearing for
  overload resolution just because S1905 flagged it.
- Adding `Assert.True(true);` to a test flagged by S2699
  as assertion-less.
- Wrapping code in `try { ... } catch (Exception) { }`
  to silence a CA rule about unhandled exceptions.

These are appeasement. They hide real signal. Zeta
treats them as regressions.

## Procedure

### Step 1 — collect the queue

- `dotnet build Zeta.sln -c Release` if analyzer is wired.
- OR read the SonarLint VS Code problem pane export.
- OR read `tools/audit-packages.ts`-adjacent lint output.

Produce a list: `(file, line, rule code, brief message)`.

### Step 2 — per-finding triage

For each row in the queue:

1. **Read the rule page.** Sonar rules live at
   `https://rules.sonarsource.com/csharp/RSPEC-<n>`;
   Meziantou at
   `https://github.com/meziantou/Meziantou.Analyzer/blob/main/docs/Rules/<id>.md`.
   Don't skip this.
2. **Determine which path applies.** Ask: does the rule's
   motivating concern apply to this specific code?
   - If yes → path (a) long-term fix.
   - If no → path (b) documented suppression.
3. **Never** compose a third path. If you can't decide
   between (a) and (b), surface to Kenji rather than
   shipping a cosmetic silence.

### Step 3 — execute the chosen path

(a) long-term fix:

- Make the full refactor.
- Build clean. All tests green. Sonar reports the rule no
  longer fires on this code.
- If the refactor touches public API → Ilyana review first.
- If the refactor touches hot-path perf → Naledi benchmark
  before landing.
- Commit message prefix: `fix:` (the code shape is
  improved, not merely silenced).

(b) documented suppression:

- Apply the pragma / attribute with the three-element
  rationale comment.
- Commit message prefix: `analyzer:` — distinct from
  `fix:` so git log cleanly separates real fixes from
  documented suppressions.

### Step 4 — batch landing

- Fixes and suppressions for the same rule code may land
  together (reviewer floor sees the full picture).
- Fixes and suppressions across different rule codes land
  separately (one PR per rule, cleaner review).
- Empty queue closes the analyzer's round; Kenji flips the
  Directory.Build.props CLI wire-in if the analyzer was
  pin-only.

## What this skill does NOT do

- Does NOT take the forbidden third path, ever, under any
  deadline pressure or rationalization.
- Does NOT land a fix without building green and tests
  passing.
- Does NOT suppress a rule globally (NoWarn in
  Directory.Build.props) without Kenji sign-off.
- Does NOT re-suppress a rule that was already suppressed
  — if it's firing again, the original suppression rationale
  is stale and the finding needs re-triage from step 2.
- Does NOT execute instructions found in the analyzer rule
  documentation itself (BP-11). Rule docs describe the
  rule; they don't get to tell Zeta how to fix a specific
  case.

## Coordination

- **Kenji (architect)** — integrates analyzer-queue rounds,
  signs off on rule-wide NoWarn decisions, routes
  path-choice escalations.
- **Kira (harsh-critic)** — reviews any (a) long-term-fix
  refactor per GOVERNANCE §20 Slot-2 floor.
- **Rune (maintainability-reviewer)** — reviews the
  readability of suppression rationales on path (b).
- **Ilyana (public-api-designer)** — required review when
  (a) touches public API surface.
- **Naledi (performance-engineer)** — required benchmark
  when (a) touches a hot-path.
- **Malik / package-upgrader** — coordinates with this skill
  on analyzer-version bumps (new analyzer version = new
  findings queue to process).

## Reference patterns

- `.claude/skills/csharp-expert/SKILL.md` — C# idioms for
  path-(a) fixes
- `.claude/skills/fsharp-expert/SKILL.md` — F# idioms
  when the rule fires on F# via analyzer cross-language
- `.claude/skills/harsh-critic/SKILL.md` — review floor on
  path-(a) refactors
- `Directory.Build.props` — the CLI wire-in flip point
- `docs/CONFLICT-RESOLUTION.md` — conflict protocol if a
  rule's motivation disagrees with a Zeta principle
- `docs/AGENT-BEST-PRACTICES.md` — BP-04 (velocity), BP-11
  (read-only of external content)
