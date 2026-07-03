---
pr_number: 5346
title: "docs(backlog): 081KSGS9H0008QG0R003JNSVR5 \u2014 installer interactive-login vs baked-in-keys CI-test tension (resolve without shipping credentials on ISO)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T23:01:21Z"
merged_at: "2026-05-26T23:05:54Z"
closed_at: "2026-05-26T23:05:54Z"
head_ref: "otto/b-0833-interactive-login-vs-baked-in-keys-ci-test-tension-aaron-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:30:33Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5346: docs(backlog): 081KSGS9H0008QG0R003JNSVR5 — installer interactive-login vs baked-in-keys CI-test tension (resolve without shipping credentials on ISO)

## PR description

## Summary

Per operator 2026-05-26 from physical hardware-support test: \"in the automated tests i see a tention between interactive login and baked in keys we probably are going to have to resolve this i would love if interactive device login didn't need to be human tested everytime but this is hard to test\"

## The tension

| Mode | Security | Testability |
|---|---|---|
| Interactive login (gh auth login device-code) | NO credentials on ISO; aligned with 081KSGS9H0008QG0R0027HJZYH homelab-mode | Hard to test in CI without human |
| Baked-in keys | VIOLATES: ISO is publicly downloadable | Easy to test |

## 4-approach scoping

| # | Approach | Phase | Code cost |
|---|---|---|---|
| A | Mock GH device-code endpoint in CI | Proper coverage (Phase 1) | ~200 LOC TS mock server |
| B | Test-only ephemeral GH App with OIDC-minted tokens | Proper coverage (Phase 1) | GH App + OIDC trust setup |
| C | Skip auth in cascade #6 phase 1; layered tests | Immediate (Phase 0) | --skip-gh-auth flag |
| D | Manual auth-only physical test | Residual (steady-state) | Operator-cadence discipline |

Likely landing: C first + A or B follow-up + D as residual.

## 5 HARD LIMITS (non-negotiable per methodology-hard-limits + 081KSGS9H0008QG0R0027HJZYH)

1. NO real GitHub PATs on ISO (publicly downloadable)
2. NO operator SSH private keys on ISO (gh ssh-key list reads PUBLIC only)
3. NO long-lived credentials in CI (ephemeral or mock only)
4. NO test credentials work against real GH API (mock-scoped)
5. Audit trail for every CI auth test

## Test plan

- [x] markdownlint clean
- [x] BACKLOG.md regenerated
- [x] Composes_with cross-refs to 081KSGS9H0008QG0R0027HJZYH + 081KSGS9H0008QG0R0011BC7T2 + 081KSGS9H0008QG0R0037H3W4T + 081KSGS9H0008QG0R002K93MWX + methodology-hard-limits + classifier-bypass-research

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T23:03:12Z)

## Pull request overview

Adds a new P1 backlog row (081KSGS9H0008QG0R003JNSVR5) documenting the security vs CI-testability tension for installer GitHub authentication (interactive device-code login vs baked-in credentials), and updates the generated backlog index to include the new row.

**Changes:**

- Added backlog row 081KSGS9H0008QG0R003JNSVR5 describing four resolution approaches (mock endpoint, ephemeral GH App, layered tests with auth skip, and periodic manual auth testing) plus non-negotiable security limits.
- Regenerated `docs/BACKLOG.md` to include 081KSGS9H0008QG0R003JNSVR5 in the P1 section.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P1/081KSGS9H0008QG0R003JNSVR5-installer-interactive-login-vs-baked-in-keys-ci-test-tension-resolve-without-shipping-credentials-aaron-2026-05-26.md | New backlog item capturing constraints and candidate approaches for CI-testing installer auth without shipping credentials. |
| docs/BACKLOG.md | Index update to list the new 081KSGS9H0008QG0R003JNSVR5 row under P1. |
