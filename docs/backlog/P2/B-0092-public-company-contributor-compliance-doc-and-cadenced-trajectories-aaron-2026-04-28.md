---
id: B-0092
priority: P2
status: open
title: Public-company contributor compliance — doc + cadenced trajectories (audit-on-commit, weekly/monthly compliance review, on-PR audit, on-onboarding briefing, drift retrospective)
tier: factory-hygiene
effort: M
ask: maintainer Aaron 2026-04-28T23ish *"we definitely need some contributor works for public company watch for insider information generalization in the factory, that can be used by anyone at service titan to when working on public repos or any one who works for any public company, that's reusable substrate."* + *"probably comes with trajectories I would think."*
created: 2026-04-28
last_updated: 2026-04-28
composes_with:
  - B-0090
tags: [aaron-2026-04-28, factory-hygiene, contributor-compliance, public-company, insider-information, cadenced-trajectories, sec-rule-10b-5, reg-fd, sarbanes-oxley]
---

# B-0092 — Public-company contributor compliance + cadenced trajectories

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
- **B-0090** (cadenced lost-substrate audit) — same cadence framework; this row's trajectories run on similar weekly/monthly cycles.
- **B-0091** (audit + rename ServiceTitan refs) — the immediate-instance work-stream that this rule generalizes from.
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
