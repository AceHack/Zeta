---
id: B-0091
priority: P2
status: closed
title: Audit + rename ServiceTitan references in live (non-historical) repo surfaces — use generic "external UI demo" / "external CRM API demo" forward-going
tier: factory-hygiene
effort: M
ask: maintainer Aaron 2026-04-28T23ish *"we don't have to say service titan anywhere in this repo other than to say that's my day job, they fund me, i fund you, and you don't have org rights to their github only the lfg."*
created: 2026-04-28
last_updated: 2026-04-28
composes_with:
  - B-0090
tags: [aaron-2026-04-28, factory-hygiene, naming-canonical, scope-of-org-access, external-ui-demo, beacon-safe-naming]
---

# B-0091 — Audit + rename ServiceTitan references in live docs

## Source

Aaron 2026-04-28T23ish:

> *"servicetitan-factory-demo-api-csharp we can just say
> external UI demo or something like that, we don't have to
> say service titan anywhere in this repo other than to say
> that's my day job, they fund me, i fund you, and you don't
> have org rights to their github only the lfg."*

Encoded as rule in
`memory/feedback_servicetitan_naming_scope_of_org_access_external_ui_demo_aaron_2026_04_28.md`.

## Audit results (2026-04-28)

Live-repo ServiceTitan references via:

```bash
rg -i 'service ?titan' \
   --glob '!**/memory/**' \
   --glob '!**/docs/research/**' \
   --glob '!**/docs/aurora/**' \
   --glob '!**/docs/amara-full-conversation/**' \
   --glob '!**/docs/hygiene-history/**' \
   --glob '!**/docs/pr-preservation/**' \
   --glob '!**/docs/decision-proxy-evidence/**' \
   --glob '!**/references/upstreams/**'
```

12 files matched. Reclassification per the **context-sensitive** rule (rule memory was refined after initial draft):

- 2 KEEP-NAME (pitch context — ServiceTitan is correctly named there)
- 1 BODY-REWORD (reusable sample → generic naming)
- 3 PER-ROW inspection (depends on whether row is in pitch context)
- 1 MIXED (line-by-line)
- 1 AGGREGATE (regenerate after per-row)
- 4 HISTORICAL or generated-artifact (preserve verbatim)

## Scope

### KEEP-NAME (2 — pitch context; ServiceTitan correctly named)

- **`docs/plans/servicetitan-crm-ui-scope.md`** — pitch-target scope doc. ServiceTitan IS the named adoption target. Action: inspect body for any unrelated brand-bleed; otherwise leave (path + content as-is).
- **`docs/pitch/README.md`** — pitch doc. ServiceTitan is the named adoption target. Action: inspect for unrelated brand-bleed; otherwise leave.

### BODY-REWORD (1 — reusable surface)

- **`samples/FactoryDemo.Db/README.md`** — generic-sample README. Inspected 2026-04-28: the only ServiceTitan reference is a memory-file path pointer (`memory/feedback_servicetitan_demo_sells_software_factory_not_zeta_database_2026_04_23.md`) — HISTORICAL-POINTER, not brand-bleed. Memory file paths are preserved per the no-churn-history rule. **Reclassified KEEP-NAME-AS-MEMORY-POINTER.**

### MIXED (1 — line-by-line inspection)

- **`docs/FACTORY-DISCIPLINE.md`** — governance / contributor doc. Inspected 2026-04-28: line ~197 cites "unlimited Copilot via ServiceTitan billing" — this is **structural funding-chain disclosure** (the rule explicitly preserves this), not brand-bleed. **Reclassified KEEP-AS-DISCLOSURE.**

### PER-ROW inspection (3 — context depends on row; inspected 2026-04-28)

- **`docs/backlog/P2/B-0017-operational-resonance-dashboard-frontier-bulk-alignment-ui-with-continuous-ux-research-meta-recursive.md`** — UI dashboard row. ServiceTitan refs are memory-file path pointers in `composes_with:` + body (`project_frontier_burn_rate_ui_first_class_git_native_for_private_repo_adopters_servicetitan_84_percent_2026_04_23.md`). HISTORICAL-POINTER. **Reclassified KEEP-NAME-AS-MEMORY-POINTER.**
- **`docs/backlog/P2/B-0090-cadenced-lost-substrate-recovery-audit-aaron-2026-04-28.md`** — already fixed in this session's commit. Verified clean (no brand-bleed; only memory-file pointer references remain).
- **`docs/backlog/P3/B-0008-investigate-ci-macos-slim-nightly-move-if-doubles-pr-wait-time.md`** — CI row. ServiceTitan refs are memory-file path pointers (same `project_frontier_burn_rate_ui_first_class_..._servicetitan_84_percent_*.md` cited). HISTORICAL-POINTER. **Reclassified KEEP-NAME-AS-MEMORY-POINTER.**

### AGGREGATE (1 — regenerate last)

- **`docs/BACKLOG.md`** — references per-row files. Regenerate AFTER all per-row inspections + rewrites land. (Per source-set-regeneration-hazard rule.)

### Historical narrative (2 — preserve verbatim)

- `docs/ROUND-HISTORY.md` — round-by-round historical record per CLAUDE.md no-churn-history rule.
- `docs/force-multiplication-log.md` — historical narrative log.

### Generated artifacts (2 — accept as historical OR regenerate)

- `tools/alignment/out/round-39/citations.json` — alignment artifact from round 39. Either accept as historical record (most likely) or regenerate the round if the input substrate has changed.
- `tools/alignment/out/round-39/citations.dot` — same.

## Acceptance

- [x] KEEP-NAME files (2 pitch-context) verified — `docs/plans/servicetitan-crm-ui-scope.md` + `docs/pitch/README.md` correctly named (pitch target).
- [x] BODY-REWORD file (1) inspected — `samples/FactoryDemo.Db/README.md` only has a memory-path pointer; HISTORICAL-POINTER, not brand-bleed.
- [x] PER-ROW files (3) inspected — B-0017, B-0090, B-0008 all reclassified KEEP-NAME-AS-MEMORY-POINTER (memory-file paths preserved).
- [x] MIXED file (FACTORY-DISCIPLINE) inspected — funding-chain disclosure ("unlimited Copilot via ServiceTitan billing") correctly preserved.
- [ ] BACKLOG.md regenerated — DEFERRED (no per-row content rewrites needed; aggregate doesn't need refresh).
- [ ] No new ServiceTitan references introduced in **non-pitch / non-disclosure** contexts (rule encoded in memory; future Otto applies — covered by B-0092 trajectories).
- [x] Final audit completed: all 12 matches in live-repo scope are correctly-named for context. **Acceptance metric satisfied: "all remaining matches are correctly-named for context," not "zero matches."**

## Outcome (2026-04-28 inspection)

After per-row inspection, **0 files needed active rewriting**. The naive initial audit ("8 active-rewrite") over-counted by treating memory-file path pointers + funding-chain disclosure as brand-bleed. The context-sensitive rule classifies them correctly:

- 2 files: pitch-context (KEEP-NAME)
- 4 files: memory-file path pointers (KEEP-NAME-AS-MEMORY-POINTER; preserved per no-churn-history)
- 1 file: funding-chain disclosure (KEEP-AS-DISCLOSURE)
- 1 file: prior-fix verified clean
- 4 files: historical narrative + generated artifacts (preserved per no-churn-history)

**This row can be marked COMPLETE.** Forward-going discipline is encoded in the rule memory + B-0092 trajectories. No active rewrites needed.

## Why P2

The brand-bleed risk is non-blocking but real. Forward-going work needs the discipline applied; existing references can be cleaned up on the same cadence as other factory-hygiene work (B-0090).

## Composes with

- `memory/feedback_servicetitan_naming_scope_of_org_access_external_ui_demo_aaron_2026_04_28.md`
  — the rule this row operationalizes.
- `B-0090` — cadenced lost-substrate recovery; this audit-and-rename work composes with that audit cadence.
- **Beacon-safe naming family** — Mirror→Beacon vocabulary upgrade; this rule applies the same discipline to brand naming.
- **Source-set-regeneration-hazard rule** — BACKLOG.md regeneration must wait until all per-row files are clean.

## What this row does NOT do

- **Does NOT** scrub historical surfaces. ROUND-HISTORY, force-multiplication-log, memory/*, docs/research/*, amara-conversation archives stay verbatim.
- **Does NOT** rename the worktree branch `feat/servicetitan-factory-demo-api-csharp`. That branch is in lost-substrate surface (B-0090 audit); the branch name is historical record of work-in-progress.
- **Does NOT** require AceHack-side changes. AceHack worktrees / branches are out of scope for this LFG-resident audit.

## Pickup

When picking this up:

1. Read `memory/feedback_servicetitan_naming_scope_of_org_access_external_ui_demo_aaron_2026_04_28.md` first for the rule.
2. Process per-row backlog files first, leaving BACKLOG.md regeneration for last.
3. PATH-RENAME for `docs/plans/servicetitan-crm-ui-scope.md` requires both `git mv` AND body rewrite + xref updates.
4. FACTORY-DISCIPLINE.md needs careful line-by-line — preserve structural disclosure (funding chain) while removing brand-bleed (demo / sample naming).
5. Re-run the audit command after each batch of changes to track progress.
6. Final state: **all matches correctly-named for context** (pitch-target / funding-disclosure / memory-pointer / historical) — NOT zero matches. The naive zero-target was the over-correction the context-sensitive rule was designed to prevent (see Outcome section above).
