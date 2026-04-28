---
name: Demo from Lucent-Financial-Group (LFG), not AceHack — LFG is the professional / demo-facing repo, AceHack is the poor-man's cost-cutting internal mirror; professional etiquette applies
description: Aaron's 2026-04-23 reminder on the repo-pair positioning. Two GitHub repos mirror the Zeta project — Lucent-Financial-Group/Zeta (the public, demo-facing home with issues + PRs + governance) and AceHack/Zeta (the fork used as a cost-cutting substrate for agent experimentation and broader branch churn). When demoing, linking, or publicly referencing, use LFG. AceHack stays internal by professional etiquette, not policy.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# LFG is demo-facing, AceHack is internal cost-cutting

## Verbatim (2026-04-23)

> and we want to demo from LFG not AceHack that's just
> professional edicute, AceHack is our poor-mans cost cutting
> measures remember?

## What this means

The Zeta project has two GitHub repos that mirror the same
codebase:

1. **`Lucent-Financial-Group/Zeta`** — the public / professional
   / demo-facing home. Issues, PRs, governance surfaces, public
   identity. Everything external (demos, linked documentation,
   partnership material) references this repo.
2. **`AceHack/Zeta`** — the fork used for cost-cutting and
   agent-experimentation. Internal substrate. More commits,
   more branch churn, less presentation polish. Not for public
   reference.

Per Amara's transfer report (landed under
`docs/aurora/2026-04-23-transfer-report-from-amara.md`):

- LFG: 59 commits visible, 28 issues, 5 PRs, 42,097 KB
- AceHack: 111 commits, 0 surfaced PRs, 41,173 KB,
  explicitly marked as a fork

The operational emphasis differs; the substrate is the same.

## Rule

**When demoing or referencing Zeta publicly, use LFG links.**
Including:

- PR links in commit messages, memory notes, docs
- URL citations in READMEs
- Fork / clone instructions for visitors
- Partnership or evaluation conversations
- Paper submissions, research citations
- Social / public channel mentions

**AceHack references stay internal:**

- Aaron's personal dev workflows (his fork is his working copy)
- Agent-experimental branches that don't need public visibility
- Cost-cutting substrate choices (free tiers, fewer paid features)
- Memory / internal notes when the AceHack vs LFG distinction
  genuinely matters

## How to apply

- **Check PR-link references in any new doc** before landing —
  ensure any `github.com/AceHack/Zeta/pull/...` URLs are flipped
  to `github.com/Lucent-Financial-Group/Zeta/pull/...` unless
  the AceHack identity is deliberately chosen.
- **Remote verification before pushing demos.** The current
  working tree's `origin` is already Lucent-Financial-Group
  (verified via `git remote -v` in prior ticks). PRs opened
  from this working tree land on LFG by default — no
  special action needed, just don't get clever.
- **Branch-name cleanliness.** Branch names created on LFG
  ideally stay neutral (no `acehack-` prefix or similar) so
  they read professionally in the LFG PR list.
- **Commit author / email.** The git user is `Aaron Stainback`
  per the repo config — that's fine for either repo. No
  action needed.

## What this is NOT

- Not a directive to delete AceHack references from git history.
  Git history is history — existing mentions stay.
- Not a claim AceHack is lower-quality. It's the same code.
  The distinction is presentation posture, not substance.
- Not a rule that AceHack must never be mentioned in-repo.
  Amara's transfer report references both repos analytically;
  that's correct because the analysis scoped both. Analysis ≠
  demo.
- Not a restriction on individual contributors pulling to their
  own forks. Aaron's AceHack fork is his working copy; other
  contributors may have their own forks; those are normal.

## Composes with

- `memory/feedback_open_source_repo_demos_stay_generic_not_company_specific_2026_04_23.md`
  (generic-not-company-specific — AceHack/LFG is orthogonal;
  demo should be both generic AND LFG-linked)
- `memory/feedback_servicetitan_demo_sells_software_factory_not_zeta_database_2026_04_23.md`
  (software-factory-demo framing — the factory-demo lives in
  LFG, not AceHack)
- `docs/aurora/2026-04-23-transfer-report-from-amara.md`
  (Amara's report analytically cites both repos — the
  analytical reference is fine)
- `memory/project_aaron_funding_posture_servicetitan_salary_plus_other_sources_2026_04_23.md`
  (the AceHack "cost-cutting" framing ties to the funding-
  material-substrate angle — minimising paid dependencies
  extends factory freedom)
