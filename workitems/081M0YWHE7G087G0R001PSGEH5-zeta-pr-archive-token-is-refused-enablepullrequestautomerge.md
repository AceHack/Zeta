---
id: 081M0YWHE7G087G0R001PSGEH5
type: bug
state: backlog
priority: P1
slug: zeta-pr-archive-token-is-refused-enablepullrequestautomerge
title: "ZETA_PR_ARCHIVE_TOKEN is refused enablePullRequestAutoMerge, so every heartbeat merge lands with no gate verdict"
created: 2026-08-26T11:15:59.856Z
depends_on: []
composes_with: [081M05G8D36087G0R0034D3QPA]
---

# ZETA_PR_ARCHIVE_TOKEN is refused enablePullRequestAutoMerge, so every heartbeat merge lands with no gate verdict

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0YWHE7G087G0R001PSGEH5-*.md` glob. -->

## NEEDS THE OPERATOR — this cannot be fixed from inside the repo

The blocker is a **credential scope**, not a workflow defect. The workflow already prefers
the PAT, already detects the refusal, already names the missing scope, and already logs the
degradation. There is nothing left for an agent to write; what is missing is a permission
grant on a fine-grained PAT, which is an operator-approved action.

> **Operator action:** grant `Pull requests: Read and write` to **`ZETA_PR_ARCHIVE_TOKEN`**
> on `Lucent-Financial-Group/Zeta`.

Distinct from `081M05G8D36087G0R0034D3QPA`, which is the same class of denial on a
**different token** (`ZETA_TELEMETRY_FLUSH_TOKEN`, the BRANCH-PUSH role). Two tokens, two
roles, two grants; neither substitutes for the other, per the role table in
`docs/security/2026-08-17-society-heartbeat-token-boundary-and-gate-start-failure.md`.

## The chain, measured 2026-08-26

Each link is measured rather than inferred, and the last one is the newly-priced part.

1. **The step prefers the PAT and is refused the GraphQL mutation.** Job `98152703368`
   (`alexa heartbeat tick`, run `32960872768`), step _Auto-merge clean PRs_:

   ```
   10:59:01Z ##[warning]ZETA_PR_ARCHIVE_TOKEN (the PR-create role credential) was refused
             the GraphQL mutation, so arming falls back to GITHUB_TOKEN ...
   10:59:03Z [merge] armed auto-merge on PR #15587 (credential: degraded-to-workflow-token)
   10:59:05Z [merge] armed auto-merge on PR #15588 (credential: degraded-to-workflow-token)
   10:59:07Z [merge] armed auto-merge on PR #15589 (credential: degraded-to-workflow-token)
   10:59:07Z [merge] armed 3 of 3 (attempted 3, 4 unarmed in queue,
             credential: degraded-to-workflow-token)
   ```

   `degraded-to-workflow-token` is set **only** in the refusal branch — the absent-secret
   branch sets `workflow-token-only`. So this is conclusive about which fault it is: the
   secret **is** set, and the PAT **was** refused. `enablePullRequestAutoMerge` is
   GraphQL-only; there is no REST equivalent to fall back to.

2. **GitHub auto-merge merges as the arming identity.** PR #15589's timeline:
   `auto_squash_enabled github-actions[bot]` -> `merged github-actions[bot]`.

3. **A `GITHUB_TOKEN` merge triggers no workflow run** (GitHub's recursion guard), so the
   merged commit gets **no `gate` push run** and therefore **no post-merge verdict**.

## The discriminator, over a full population

89 `main` commits, `2026-08-26T06:00Z` .. `11:10Z`, each queried per-SHA for `gate` runs
with `event=push`, then mapped to its merged PR. **Total separation, 89 of 89:**

| merged by                            | gate push run  | commits |
| ------------------------------------ | -------------- | ------- |
| `AceHack` (PAT)                      | **yes**, 63/63 | 63      |
| `github-actions[bot]` (GITHUB_TOKEN) | **no**, 26/26  | 26      |

All 26 of the no-run class are `heartbeat/*`. Ten `heartbeat/*` commits **did** get a run in
the same window — those were armed by `AceHack`, which is what shows the lane is not the
cause and the credential is.

This reproduces
`docs/research/2026-08-26-three-verdict-loss-mechanisms-on-main-only-one-is-concurrency-and-the-largest-is-invisible-to-both-designs.md`
§2 (which sampled 20 + 18 and measured 40.0% over 245 commits) on a fresh full population.

## Why it is P1, and what is NOT lost

`agent-heartbeat.yml` already documents this mechanism as an **archive**-coverage defect —
measured 2026-08-21..25, 747 of 765 unarchived PRs bot-merged. That reading is correct and
under-prices it. The same suppressed event costs the **post-merge gate verdict**, which is
the larger consequence:

- `CI Gate` has `strict_required_status_checks_policy: false`, so a PR may merge without
  being up to date with `main`. The post-merge push run is the **only** thing covering the
  class _two PRs that each pass alone and break together_.
- Every one of those commits **was** gated pre-merge on its own PR. What is lost is the
  post-merge verdict, and losing ~29% of them is losing ~29% of the coverage of that class —
  no more, and no less.

Nothing is lost from the telemetry itself: the payload lands, the flush is idempotent
(G-Set union), and re-flushing an already-landed event set is a no-op.

## What was considered and refused

- **Substituting `ZETA_TELEMETRY_FLUSH_TOKEN` for arming.** That is the `||` role-collapse
  the repo already removed once: two roles in one variable, silently selecting on emptiness.
  Whether that token carries the mutation is untested and untestable without the secret, so
  swapping it in would be a guess wearing a fix's clothes.
- **A `schedule:` sweep that dispatches `gate` at unchecked commits.** It manufactures a
  verdict without the merge having been gated — the vacuity class with extra machinery.
- **Refusing to degrade at all.** An unarmed PR stalls the merge queue, which
  `.claude/rules.bak/tick-must-never-stop.md` forbids. The existing degradation is a
  deliberate, documented tradeoff and reversing it unilaterally would be a worse failure
  than the one it treats.

## The falsifier for the fix

After the grant, one heartbeat tick should show
`credential: pat` in the _Auto-merge clean PRs_ step, and the next `heartbeat/*` merge
commit should answer non-zero to:

```bash
gh api "repos/Lucent-Financial-Group/Zeta/actions/workflows/262890041/runs?head_sha=<sha>&event=push" --jq .total_count
```

Re-run the 89-commit sweep above; the `github-actions[bot]` row should empty out.
