# `action_required` holds are a push-credential identity problem — independent of the cancellation root cause

**Date:** 2026-08-14 · **Author:** Dejan (devops-engineer) · **Status:** diagnosed; **no code
change proposed here.** The fix is a credential or a repo setting, both of which need Aaron's
sign-off. **No auto-approver was built, and one should not be.**
**Work-item:** `081M010H4KE087G0R00092AYZS` · **Sibling:** `081M0104E7Y087G0R002X9A6NB`

## Relationship to the cancellation finding: INDEPENDENT

Asked directly whether this shares a root cause with the cancelled-job pattern. It does not.

|                | cancelled runs                               | `action_required` runs                       |
| -------------- | -------------------------------------------- | -------------------------------------------- |
| mechanism      | `apt-get` stalls, job hits `timeout-minutes` | GitHub holds the run pending approval        |
| root cause     | stalled Ubuntu archive mirror                | the run's **actor** is `github-actions[bot]` |
| where it lives | `tools/setup/linux.sh`                       | the credential the heartbeat push uses       |
| fix            | wall-clock bound on apt                      | a token change or a repo setting             |

They share only an **observable**: a check that did not run, presented as one that did or
will. The merge queue therefore has **two independent silent-stall mechanisms**, and the
original task covered only one. Fixing either does nothing for the other.

## The measurement

100 recent workflow runs, cross-tabulated by event and actor:

| event        | actor                         | HELD   | RAN   |
| ------------ | ----------------------------- | ------ | ----- |
| pull_request | AceHack                       | 0      | 46    |
| pull_request | **github-actions[bot]**       | **13** | **0** |
| push         | AceHack                       | 0      | 21    |
| schedule     | AceHack                       | 0      | 5     |
| dynamic      | github-advanced-security[bot] | 0      | 5     |
| workflow_run | AceHack                       | 0      | 2     |

**100% separation on one variable.** Every `pull_request` run actored by
`github-actions[bot]` is held; every one actored by `AceHack` runs.

### Hypotheses tested and refuted

Ruling things out mattered here, because three plausible causes all turned out to be wrong:

- **Fork PRs.** Refuted. All 100 held runs have
  `head_repository = Lucent-Financial-Group/Zeta` and `isCrossRepository: false`.
- **PR author is untrusted.** Refuted. Every recent PR — held and unheld alike — is authored
  by `AceHack`, `author_association: MEMBER`, and AceHack has `admin` on the repo.
- **Commit author identity is unrecognised.** Refuted by its own data. `otto[bot]`,
  `soraya[bot]` and `society[bot]` resolve to no GitHub account (`author: null`), which looked
  decisive — until the same identities appeared on runs that executed normally, and
  `github-actions[bot]` commits appeared on both held (`heartbeat/*`) and executed
  (`automation/pr-archive-*`) runs. Commit authorship is not the discriminator; the **run
  actor** is. These are different fields and conflating them cost a hypothesis.

### The natural experiment

Two bot-driven automations in the same repo, under the same settings, with the same PR author
and association — differing only in the credential that pushes:

| branch prefix             | push credential               | run actor           | HELD | RAN |
| ------------------------- | ----------------------------- | ------------------- | ---- | --- |
| `automation/pr-archive-*` | `ZETA_PR_ARCHIVE_TOKEN` (PAT) | AceHack             | 0    | 2   |
| `heartbeat/*`             | default `GITHUB_TOKEN`        | github-actions[bot] | 13   | 0   |

`agent-heartbeat.yml` checks out with **no `token:` override** (lines 42, 882), so
`actions/checkout` persists the default `GITHUB_TOKEN`, and
`git push --force-with-lease origin "heartbeat/$AGENT"` (line 854) therefore pushes as
`github-actions[bot]`. The resulting `synchronize` event on the open PR is actored by the bot
and held.

Note the same workflow **already** reaches for a PAT elsewhere —
`GH_TOKEN: ${{ secrets.ZETA_TELEMETRY_FLUSH_TOKEN || secrets.ZETA_PR_ARCHIVE_TOKEN || secrets.GITHUB_TOKEN }}`
(line 998) — with a comment recording that `gh pr create` failed under `GITHUB_TOKEN` with
"GitHub Actions is not permitted to create pull requests". That is the **same underlying
constraint** surfacing at a different step: it was worked around for PR _creation_ and left
unaddressed for the _push_.

## Why the runs are held at all

Repo **and** org both carry:

```
GET /repos/:owner/:repo/actions/permissions/fork-pr-contributor-approval
  -> {"approval_policy":"first_time_contributors"}
GET /orgs/Lucent-Financial-Group/actions/permissions/fork-pr-contributor-approval
  -> {"approval_policy":"first_time_contributors"}
```

Under that policy, PR-event runs actored by an identity GitHub does not count as an
established contributor require approval. `github-actions[bot]` is not a repo contributor, so
its `pull_request` runs are held. This is policy behaving as configured, not a GitHub fault
— but it is being applied to **our own automation pushing our own branches**, which is the
part worth fixing.

## The two candidate fixes — both are Aaron's call

### Option A (recommended) — change the push credential, not the security posture

Give the heartbeat checkout the PAT the same workflow already uses:

```yaml
- uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  with:
    ref: main
    fetch-depth: 0
    token: ${{ secrets.ZETA_TELEMETRY_FLUSH_TOKEN || secrets.GITHUB_TOKEN }}
```

The push then carries a human identity, the actor becomes AceHack, and per the table above
AceHack-actored `pull_request` runs are never held (46/46). **No repo security setting
changes**, no new secret, and the approval policy keeps protecting against the fork PRs it
exists for.

Honest cost: a PAT push _does_ trigger workflows where `GITHUB_TOKEN` deliberately does not,
so recursion risk becomes real and the existing `concurrency` groups become load-bearing. The
PAT is also broader-scoped than `GITHUB_TOKEN` and its blast radius is the token's full scope.
This is a real tradeoff, not a free win — which is exactly why it is not being landed here.

### Option B — loosen the approval policy

Set `approval_policy` to `first_time_contributors_new_to_github` at repo and/or org level. One
API call, no workflow change — **but it weakens the policy for genuine first-time fork
contributors on a public repo**, to fix a problem caused by our own push credential. Strictly
worse than Option A on security, and it is a blunt instrument aimed at a precise cause.

## Why no auto-approver was built

Approving a workflow run is **granting execution**, not a convenience. Building a bot that
grants execution to work around a misconfigured credential would:

- put a standing execution-granting capability in the repo to solve a problem that a
  one-line credential change removes entirely;
- require `actions: write` on a workflow that reasons about attacker-influenceable branch
  names, on a public repo where anyone can open a PR;
- leave the actual defect in place, so the approval policy would keep firing and the bot would
  keep silently neutralising it — the root cause becoming permanently invisible.

The measurement says a credential is misconfigured. The correct response to a misconfigured
credential is to configure it, not to automate around it. **Recommendation: do not build the
approver, under either option.**

## What Aaron needs to decide

1. **Option A or Option B?** A is recommended; A is a workflow change on Dejan's surface, B is
   a security setting on Aaron's.
2. **If A:** confirm `ZETA_TELEMETRY_FLUSH_TOKEN` is scoped appropriately for pushing
   `heartbeat/*` and accept the workflow-recursion tradeoff.
3. **Either way:** is the current `first_time_contributors` policy the intended posture for a
   public repo? It is correct and worth keeping on its merits; it was simply never the thing
   holding these runs.
