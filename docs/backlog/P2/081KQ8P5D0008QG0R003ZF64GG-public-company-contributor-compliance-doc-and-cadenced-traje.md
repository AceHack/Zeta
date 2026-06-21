---
id: 081KQ8P5D0008QG0R003ZF64GG
priority: P2
status: open
title: Public-company contributor compliance — doc + cadenced trajectories (audit-on-commit, weekly/monthly compliance review, on-PR audit, on-onboarding briefing, drift retrospective)
tier: factory-hygiene
effort: M
ask: maintainer Aaron 2026-04-28T23ish *"we definitely need some contributor works for public company watch for insider information generalization in the factory, that can be used by anyone at service titan to when working on public repos or any one who works for any public company, that's reusable substrate."* + *"probably comes with trajectories I would think."*
created: 2026-04-28
last_updated: 2026-05-02
depends_on: []
composes_with:
  - 081KQ8P5D0008QG0R0002TN22C
tags: [aaron-2026-04-28, factory-hygiene, contributor-compliance, public-company, insider-information, cadenced-trajectories, sec-rule-10b-5, reg-fd, sarbanes-oxley]
type: friction-reducer
---

# 081KQ8P5D0008QG0R003ZF64GG — Public-company contributor compliance + cadenced trajectories

## Source

Aaron 2026-04-28T23ish, generalizing the ServiceTitan-specific
rule into reusable factory substrate:

> *"we definitely need some contributor works for public
> company watch for insider information generalization in the
> factory, that can be used by anyone at service titan to when
> working on public repos or any one who works for any public
> company, that's reusable substrate."*

> *"probably comes with trajectories I would think."*

Encoded as rule in
`memory/feedback_public_company_contributor_compliance_no_insider_info_in_public_repos_with_trajectories_aaron_2026_04_28.md`.

## Why P2

The compliance risk is real but not blocking. Forward-going
work needs the discipline applied; existing surfaces can be
audited on the cadence established by this row.

## Scope

### 1. Contributor-compliance doc (new)

File: `docs/CONTRIBUTOR-COMPLIANCE.md` (proposed name; bikeshed
welcome).

Content:

- Plain-language statement of the rule (publicly-traded-employer
  contributors keep MNPI off the public substrate).
- Industry-general vs company-specific framing examples.
- Public-source citation requirement for company-specific
  claims.
- Otto-side enforcement: reframe-on-find, refuse-to-encode,
  industry-general questioning.
- Contributor-side responsibilities: don't volunteer; cite
  public sources; ask compliance counsel if unsure.
- External lineage (SEC Rule 10b-5, Reg FD, Sarbanes-Oxley,
  industry compliance practice).

### 2. AGENTS.md / CONTRIBUTING.md cross-reference

Pointer in:

- `AGENTS.md` (universal handbook) — onboarding-stage briefing.
- `CONTRIBUTING.md` (if exists or once created) — contributor
  agreement section.
- `GOVERNANCE.md` (if relevant) — factory-rule listing.

### 3. Trajectories — continuous practice surface

Per Aaron's *"probably comes with trajectories"* framing,
encode 5 cadenced trajectories:

#### T1 — Continuous self-audit (every commit)

Pre-commit audit regex:

```bash
rg -ni "\binsider\b|\bprivileged\b|\binternal-only\b|\bconfidential\b" \
   <files-being-changed>
```

For each hit, manual inspect:

- Implying non-public access → reframe to industry-general.
- Legitimate technical use → leave (e.g., "internal-only
  API" describing factory's own code).

#### T2 — Cadenced compliance review (weekly / monthly)

- **Weekly:** scan last 7 days of PRs / commits / new memory
  files. 3-bucket: CLEAN / NEEDS-REWORD / NEEDS-REDACTION.
- **Monthly:** broader sweep — pitch docs, research, demo
  surfaces. Verify public-source citations + industry-general
  framing.
- **On-demand:** any time a contributor mentions their public-
  company employer in chat.

#### T3 — On-PR audit (CI surface, eventual)

Add CI lint that flags insider-information-register hits in
PR diffs:

- Comment on PR with manual-inspection candidates.
- Do NOT auto-block (false-positive risk).
- Flag for human / Otto review.

#### T4 — On-onboarding compliance briefing

When new contributor onboards:

- Surface the rule + cite the doc.
- Make them aware of:
  - Factory's repos are public.
  - Their employer's policies may apply to disclosures.
  - Industry-general framing > company-specific framing.
  - Otto won't ask for non-public info; don't volunteer.

#### T5 — Drift retrospective (per round / quarter)

On round-close / quarterly cadence:

- Sample N% of recent commits / memory files / docs.
- Track hits-per-round metric.
- If trending up → reinforce rule + file improvement task.

## Acceptance

- [ ] `docs/CONTRIBUTOR-COMPLIANCE.md` (or named-equivalent) exists with the rule + framing examples + lineage.
- [ ] Cross-reference from `AGENTS.md` / `CONTRIBUTING.md` / `GOVERNANCE.md` as relevant.
- [ ] Trajectories T1-T5 encoded as cadenced practice (runnable scripts where applicable; written cadence-rules where applicable).
- [ ] Worked example from this session (the ServiceTitan / TTAN cascade) cited as the origin substrate.
- [ ] T2 audit is added to the weekly + monthly recurring schedules (per the lost-substrate cadence framework — same audit cadence pattern).
- [ ] T3 (CI lint) tracked as separate sibling backlog row when scoping firms up; not blocking on this row.

## Composes with

- **`memory/feedback_public_company_contributor_compliance_no_insider_info_in_public_repos_with_trajectories_aaron_2026_04_28.md`** — the rule this row operationalizes.
- **`memory/feedback_servicetitan_naming_scope_of_org_access_external_ui_demo_aaron_2026_04_28.md`** — the Aaron-specific worked example; this row's general rule extends that.
- **081KQ8P5D0008QG0R0002TN22C** (cadenced lost-substrate audit) — same cadence framework; this row's trajectories run on similar weekly/monthly cycles.
- **081KQ8P5D0008QG0R00353940P** (audit + rename ServiceTitan refs) — the immediate-instance work-stream that this rule generalizes from.
- **`memory/feedback_input_is_not_directive_provenance_framing_rule_aaron_amara_2026_04_28.md`** — same word-choice-shapes-agency-model family; the "insider" register is a sibling of the "directive" register.

## What this row does NOT do

- **Does NOT** require redacting historical surfaces. Memory files / round-history / archives stay verbatim per the no-churn-history rule.
- **Does NOT** auto-block PRs / commits. The trajectories are inspection-cadenced + reframe-on-find; not gating.
- **Does NOT** replace legal counsel. Factory-side discipline only; contributors' actual legal obligations are determined by their employer's compliance function and applicable law.
- **Does NOT** apply identically to private-company contributors. Different disclosure constraints; case-by-case.

## Pickup

When picking this up:

1. Read `memory/feedback_public_company_contributor_compliance_no_insider_info_in_public_repos_with_trajectories_aaron_2026_04_28.md` first for the rule.
2. Draft the doc; circulate for review (Aaron + compliance-shaped peer-AIs if any).
3. Land cross-references in AGENTS.md / CONTRIBUTING.md / GOVERNANCE.md.
4. Encode T1-T5 cadences. T1 + T2 land first (lowest cost); T3 (CI lint) deferred to sibling row; T4-T5 land with onboarding doc updates.
5. First T2 audit cycle: run within 7 days of doc landing; establish baseline metric.

## Pre-start checklist (backlog-item start gate)

**Completed 2026-05-11 before decomposition work:**

1. **Prior-art search**:
   - Ran `bun tools/github/refresh-worldview.ts` (0 open PRs, 62 claims, recent 081KQ8P5D0008QG0R0002TN22C re-decomp PR #2680).
   - Grep for compliance / insider / MNPI / 10b-5 across docs/backlog, memory/, docs/ — no colliding B-ID or active claim on 081KQ8P5D0008QG0R003ZF64GG.
   - Inspected 081KQ8P5D0008QG0R0002TN22C (cadenced audit), 081KQ8P5D0008QG0R00353940P (ServiceTitan rename), similar decomposition patterns in 081KQ8P5D0008QG0R002FSTGXP/ 081KQ3HBZ0008QG0R001K0EC2C/ 081KQ8P5D0008QG0R0002TN22C.
   - No prior-art surface satisfies the full rule; this row is the canonical generalization.

2. **Dependency-restructure**:
   - Original depends_on: []
   - Composes_with: 081KQ8P5D0008QG0R0002TN22C, 081KQ8P5D0008QG0R00353940P, 081KQ8P5D0008QG0R0002TN22C cadence framework.
   - Backfilled reciprocal: 081KQ8P5D0008QG0R0002TN22C now lists this as related compliance surface (will be done in follow-up).
   - No broken pointers; supersession clean (origin from memory/feedback_*_aaron_2026-04-28.md).

**Decomposition note**: 081KQ8P5D0008QG0R003ZF64GG treated as broad (doc + 5 trajectories). Re-decomposed per "always re-decompose... assume mistakes" into 4 atomic children below. T3 deferred per original scope.

## Decomposition (2026-05-11, one bounded step; renumbered 2026-05-14)

081KQ8P5D0008QG0R003ZF64GG decomposed into 4 smallest dependency-ordered atomic child rows. Originally numbered 081KR2E4K0008QG0R000ARCH0X..081KR50HA0008QG0R001NNPEXC, renumbered to 081KRA5AR0008QG0R0029YWXYW..081KRA5AR0008QG0R0033TJSAF on 2026-05-14 to resolve ID collision with the earlier 081KR2E4K0008QG0R000ARCH0X..081KR50HA0008QG0R001NNPEXC P1 set (durable/SEO/sitemap/alignment, from PR #2269). Parent now depends_on children; pickup order enforced by graph.

- 081KRA5AR0008QG0R0029YWXYW (renumbered from 081KR2E4K0008QG0R000ARCH0X): Author core `docs/CONTRIBUTOR-COMPLIANCE.md` (rule + examples + SEC lineage)
- 081KRA5AR0008QG0R0004P7SWS (renumbered from 081KR2E4K0008QG0R001733JTN): Cross-reference integration (AGENTS.md + CONTRIBUTING.md + GOVERNANCE.md)
- 081KRA5AR0008QG0R003F6TA3A (renumbered from 081KR2E4K0008QG0R0015BCPF7): T1 self-audit + T2 weekly/monthly cadenced review (TS tooling preferred)
- 081KRA5AR0008QG0R0033TJSAF (renumbered from 081KR50HA0008QG0R001NNPEXC): T4 onboarding briefing + T5 drift retrospective (trajectory packets)

`last_updated`: 2026-05-14
`children`: [081KRA5AR0008QG0R0029YWXYW, 081KRA5AR0008QG0R0004P7SWS, 081KRA5AR0008QG0R003F6TA3A, 081KRA5AR0008QG0R0033TJSAF]
`decomposition`: clean
`depends_on`: [081KRA5AR0008QG0R0029YWXYW, 081KRA5AR0008QG0R0004P7SWS, 081KRA5AR0008QG0R003F6TA3A, 081KRA5AR0008QG0R0033TJSAF]
