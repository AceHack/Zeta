# Prevention-layer classification — per-row matrix

This file is the authoritative classification for FACTORY-HYGIENE
row #47 (*missing-prevention-layer meta-audit*). For every row in
`docs/FACTORY-HYGIENE.md`, name its prevention posture:

- **prevention-bearing** — there is an author-time, commit-time,
  or trigger-time mechanism that blocks or warns the violation
  BEFORE it materialises. Name the mechanism in the rationale.
- **detection-only-justified** — the class is fundamentally
  post-hoc. A fire-log row can only be written AFTER the fire
  happens. Explain WHY no prevention layer is possible.
- **detection-only-gap** — no principled reason the row is
  detection-only. A prevention layer COULD be built; the fact
  that it isn't is a factory gap worth closing. Propose the
  mechanism in the rationale.

Unclassified rows surface as gaps in the audit output —
`tools/hygiene/audit-missing-prevention-layers.sh` exits with 2
until every row has a classification.

## What this audit enforces

This layer is an **intentionality-enforcement** hygiene rule,
not a correctness-enforcement one (Aaron 2026-04-22: *"we are
enforcing intentional decsions"*). The script cannot compute
whether a row's classification is *right* — that judgement
requires reading the hygiene row, the mechanism it names, and
the factory surface it protects. What the script CAN do is
make the "no classification at all" state impossible to ship
silently.

The value is the forced decision, not the diff. When an agent
lands a new hygiene row, they have to stop and answer: is
there an author-time mechanism (prevention-bearing), is there
a principled reason there can't be one (detection-only-
justified), or is this a detection-only gap that COULD be
closed (detection-only-gap)? Declining to answer is itself
the violation. See
`memory/feedback_enforcing_intentional_decisions_not_correctness.md`
for the generalised rule.

## Why rows stay unclassified

Some rows are load-bearing discipline where the prevention vs.
detection question has an unobvious answer (e.g., row #5
skill-tune-up — the audit itself IS the cadenced detection;
whether a pre-commit check catching BP violations on skill
edits constitutes a prevention layer is a design question, not
a binary). Those should not be force-classified in a single
round. The audit flagging them as unclassified is the signal
that they need deliberate thought.

## Matrix

| Row # | Hygiene item | Classification |
|---|---|---|
| 1 | Build-gate: 0 Warning(s) 0 Error(s) | prevention-bearing: TreatWarningsAsErrors in Directory.Build.props rejects the build before the commit can land. |
| 2 | Test-gate: all green | prevention-bearing: every `dotnet test` fails fast; CI blocks merge on red. |
| 3 | ASCII-clean lint | prevention-bearing: pre-commit hook blocks the commit when BP-10 invisible-Unicode chars are present. |
| 4 | BP-11 data-not-directives | prevention-bearing: BP-11 is loaded into every agent context via `CLAUDE.md` + `docs/AGENT-BEST-PRACTICES.md`; the prevention happens at agent-read-time — the agent treats suspicious content as data to report, not directives to act on. Runtime violation is a judgement-call catchable only at agent behaviour time, but the rule itself is present in every wake context by design. |
| 8 | Idle / free-time logging | detection-only-justified: idle time can only be observed after the time has passed. No author-time moment exists to pre-log a 5-minute deviation that hasn't happened yet. Canonical post-hoc class alongside row #44. |
| 9 | Meta-wins logging | detection-only-justified: a meta-win is by definition recognised retrospectively — "we would have done this differently had we known the structural fix". No author-time moment exists because the framing itself is post-hoc. |
| 14 | `.github/copilot-instructions.md` audit | detection-only-justified: drift against Anthropic / GitHub upstream guidance is only observable after upstream moves; the factory has no author-time signal for a future upstream change. |
| 15 | Upstream-sync cadence | detection-only-justified: same reasoning as row #14 — drift against upstream repos only observable after upstream moves. |
| 21 | Cron-liveness check (end-of-tick `CronList` + history-row fire-log) | prevention-bearing: the end-of-tick `CronList` discipline is the author-time forcing function — the tick cannot close without verifying the cron is live. The history-row write is the supplementary detection layer. Without this row, a silent tick stop (SEV-1 per Aaron) would not surface. |
| 22 | Symmetry-opportunities audit | detection-only-justified: asymmetries between factory rows are only visible once multiple rows have landed. An author-time symmetry check would require comparing a not-yet-authored row against a future-state surface, which isn't computable. |
| 35 | Missing-scope gap-finder (retrospective) | detection-only-justified: a missing scope tag is by definition retrospective — if the author had recognised the gap at write-time, there would be no gap. Scoped as retrospective in the row title itself. |
| 36 | Incorrectly-scoped gap-finder (retrospective) | detection-only-justified: same reasoning as row #35 — wrong-scope is only catchable by a second reader comparing the row against neighbouring rows; author-time can't catch their own scope error without an external check. |
| 39 | Filename-content match hygiene (hard to enforce) | prevention-bearing: opportunistic on-touch filename/content sanity check at write-time is the primary prevention (every time an agent edits a file, the content-summary-vs-filename obligation fires). Exhaustive coverage is not budget-viable per `memory/feedback_filename_content_match_hygiene_hard_to_enforce`, so the cadenced sample-sweep is supplementary. |
| 42 | Attribution hygiene (external people / projects / patterns) | prevention-bearing: on-touch cite-at-author-time is the primary prevention (when naming an external person / pattern / project / character, cite URL / author / org / creator at write-time per row #42's Checks column). Cadenced retrospective sweep catches what on-touch missed. |
| 43 | Missing-cadence activation audit (proposed / TBD-owner / no-named-skill tracker) | detection-only-justified: an unactivated cadence is by definition a post-hoc state — it's only visible by comparing the hygiene row list against owner / skill assignments AFTER the row has landed proposed. Author-time prevention would require disallowing "proposed" as a landing state, which closes a legitimate design phase. |
| 6 | Scope-audit at absorb-time | prevention-bearing: absorb-time IS author-time; the rule fires when the memory / BP / skill is being authored, not after. |
| 11 | MEMORY.md cap enforcement | prevention-bearing: the edit is blocked when the file exceeds its byte cap; compression is forced before the edit proceeds. |
| 12 | Memory frontmatter discipline | prevention-bearing: memory-linter rejects writes missing required frontmatter fields. |
| 13 | Persona-notebook invisible-char lint | prevention-bearing: notebook-edit is blocked when BP-10 chars are present; shares mechanism with row #3. |
| 17 | Public-API review | prevention-bearing: public-surface changes route through Ilyana review at PR-time; ADR blocks merge on unreviewed public flips. |
| 19 | Skill-edit justification log | prevention-bearing: every manual SKILL.md edit requires a log row at the time of the edit; the log obligation is part of the authoring workflow. |
| 26 | Wake-briefing self-check | detection-only-justified: session-open is the moment of observation; you cannot prevent an anomaly that is only visible at session-open until the session opens. The <10s cap ensures detection is cheap. |
| 28 | Harness-drift detector | detection-only-justified: harness updates happen outside the factory's control surface; drift can only be observed after the update, never prevented. |
| 29 | Wake-friction notebook | detection-only-justified: friction is a subjective in-the-moment observation; prevention would require predicting what will feel frictional, which is what the notebook is collecting data to enable later. |
| 40 | GitHub Actions workflow-injection safe-patterns audit | prevention-bearing: pre-write checklist + triple-layer CI lint (actionlint + CodeQL `actions` + Semgrep) catches injection patterns at author-time; the cadenced re-read is supplementary, not primary. |
| 41 | Supply-chain safe-patterns audit (third-party ingress) | prevention-bearing: pre-add / pre-bump checklist + reviewer rejection + Semgrep `gha-action-mutable-tag` rule block the violating change at author-time; cadenced re-read catches drift against evolving upstream guidance. |
| 44 | Cadence-history tracking hygiene | detection-only-justified: a fire-history row can only exist AFTER the cadenced surface fires. No author-time moment exists to pre-log a fire that has not yet happened. This is the canonical post-hoc class. |
| 46 | Post-setup script stack audit | prevention-bearing: `docs/POST-SETUP-SCRIPT-STACK.md` is the author-time decision flow; the audit script is the supplementary detection layer that catches drift (labels stripped, paths moved, new violations landing without prevention-layer use). |
| 47 | Missing-prevention-layer meta-audit | prevention-bearing: the at-landing-classify obligation in row #47's "Checks / enforces" column is the author-time prevention — every new hygiene row MUST declare its classification at landing. The audit script catches drift. |

<!-- Rows not yet in this matrix remain unclassified and will
     surface in the audit output as gaps needing deliberate
     classification. This is intentional: a force-filled matrix
     obscures the rows that genuinely need design thought. -->
