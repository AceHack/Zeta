---
id: 081KSNY2Z0008QG0R00069RRZ0
priority: P2
status: open
title: PR-discipline rules cross-host framing audit — existing rules encode years of GitHub-specific learning; audit which translate to Zeta-native / cross-host and which need rewrites
effort: M
ask: otto pushback on parallel-tracks design 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R001DFZK4V
  - 081KSNY2Z0008QG0R002A785QR
composes_with:
  - 081KSNY2Z0008QG0R001DFZK4V
  - 081KSNY2Z0008QG0R002A785QR
  - 081KSNY2Z0008QG0R000K3ETGB
  - 081KSNY2Z0008QG0R002WQ747V
  - 081KSNY2Z0008QG0R0004ZF85W
tags:
  - pr-discipline-rules-cross-host-audit
  - existing-rules-encode-github-specific-learning
  - blocked-green-ci-investigate-threads
  - pr-triage-tiers
  - claim-acquire-before-worktree-work
  - zeta-expected-branch
  - codeql-no-source-on-docs-only-pr-broken-commit-canary
  - framing-update-not-semantic-change
  - some-rules-need-host-agnostic-rewrites
  - otto-pushback-from-evaluative-response
---

## What this row tracks

Audit + framing update for existing `.claude/rules/*.md` files that encode GitHub-PR-workflow-specific learning. 081KSNY2Z0008QG0R001DFZK4V claimed these rules need "framing updates but NOT semantic changes." That's mostly true — but the audit work to identify WHICH rules need WHICH treatment is non-trivial and worth scoping explicitly.

## Otto pushback context (operator 2026-05-28)

> *"what do you think of that design"*

Otto evaluative response identified this as scoping gap:

> "Review-substrate maturity windows differ across tracks. Existing PR-discipline rules encode years of GitHub-specific learning. The framing audit to map them to Zeta-native + cross-host isn't trivial."

## Scope of audit

Rules currently identified as PR-discipline-shaped (non-exhaustive):

- `.claude/rules/blocked-green-ci-investigate-threads.md` (GitHub PR threads + GraphQL resolveReviewThread + GitHub-specific check-rollup states)
- `.claude/rules/pr-triage-tiers.md` (GitHub `gh pr` CLI + 5-tier disposition; references GitHub-specific PR object)
- `.claude/rules/claim-acquire-before-worktree-work.md` (worktree discipline composes with PR workflow at certain points)
- `.claude/rules/zeta-expected-branch.md` (branch-guard discipline; GitHub-specific in some hook examples)
- `.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md` (GitHub-specific check naming)
- `.claude/rules/refresh-world-model-poll-pr-gate.md` (GitHub GraphQL rate-limit topology)
- `.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md` (PR-merge-as-trigger; GitHub-specific)
- `.claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md` (PR-based agent coordination)

Plus likely 5-15 more not enumerated here.

## Per-rule classification

Each rule classified into:

| Class | Action |
|---|---|
| **Host-agnostic-already** | No change needed; discipline survives transition unchanged |
| **Framing-update-only** | Discipline preserved; PR-specific vocabulary updated to Zeta-native equivalent (PR → "review trajectory"; thread → "playbook section"; etc.) |
| **Host-specific-but-portable** | Discipline ports to GitLab/Gitea/etc. with adapter-level equivalents; rule gets per-host variants OR adapter-aware-rule |
| **GitHub-only-vestigial-once-Zeta-native-lands** | Rule applies only to legacy GitHub-PR work during transition; retires when transition completes |
| **Semantically-needs-rewriting** | Discipline doesn't translate cleanly; needs fresh substrate-engineering thought |

## Acceptance criteria

- `docs/research/2026-XX-XX-pr-discipline-rules-cross-host-framing-audit.md` covering:
  - Per-rule classification (one of the 5 classes above)
  - Per-rule action items (framing update / variant authoring / retire-on-transition / rewrite)
  - Sub-rows filed for any rule that needs substantive rewriting (rare expected)
  - Cross-host applicability map (which rules apply on GitLab; which on Gitea; etc.)
- Updates to PR-shape language in classified rules where framing-update is the action
- New rule(s) at `.claude/rules/zeta-native-review-discipline.md` where discipline is novel-to-Zeta-substrate

## Composition

- **081KSNY2Z0008QG0R001DFZK4V** (parent — Zeta-native review substrate; relies on existing PR-discipline being preserved)
- **081KSNY2Z0008QG0R002A785QR** (per-host adapters; rule applicability map composes with adapter targets)
- **081KSNY2Z0008QG0R000K3ETGB** + **081KSNY2Z0008QG0R002WQ747V** (error-class extraction + code-review-as-tech-debt-detector compose with the discipline being preserved)
- **081KSNY2Z0008QG0R0004ZF85W** (heterogeneous reviewer ensemble audit composes — discipline applies to all reviewer-classes)

## Substrate-honest framing

POTENTIAL audit row per operator standing direction. P2; M effort because the rule corpus is sizeable + per-rule classification needs careful thought (don't auto-classify; substrate-honest framing matters).

## Full reasoning

Otto evaluative response on operator's "what do you think of that design" 2026-05-28 — pushback item #3 of 4.
