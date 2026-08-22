---
id: 081M00QCNZG087G0R0008TD6D1
type: task
state: backlog
priority: P2
slug: promote-live-kind-included-off-continue-on-error-4-4-recent
title: "promote live-kind-included off continue-on-error -- 4/4 recent runs green in 10-13min against a 60min cap"
created: 2026-08-14T18:08:48.112Z
depends_on: []
composes_with: []
---

# promote live-kind-included off continue-on-error -- 4/4 recent runs green in 10-13min against a 60min cap

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00QCNZG087G0R0008TD6D1-*.md` glob. -->

## The finding

`.github/workflows/k8s-argocd-health-test.yml`, job `live-kind-included`, line
~205:

```yaml
live-kind-included:
  name: live kind included Synced+Healthy proof (${{ matrix.runner }})
  needs: dry-run
  continue-on-error: true
```

`continue-on-error: true` means this job's result never affects the workflow's
conclusion. It is the only proof in the repo that ArgoCD Applications actually
reach Synced+Healthy, and it cannot fail a PR.

## It has earned promotion — measured, not assumed

Last four runs of `k8s-argocd-health-test.yml`:

| run         | conclusion | duration | cap    |
| ----------- | ---------- | -------- | ------ |
| 31823013827 | success    | 10 min   | 60 min |
| 31813467530 | success    | 13 min   | 60 min |
| 31801892836 | success    | 10 min   | 60 min |
| 31766257358 | success    | 11 min   | 60 min |

4/4 green, worst case 13 min against a 60-minute `timeout-minutes`. There is 4.6x
headroom and no observed flake.

## Cost of promotion

Zero additional CI minutes — the job already runs on every trigger. The only
change is that its result counts. Billable cost is confirmed 0 for this
workflow (public repo, GitHub-hosted standard runners; the workflow's own header
records `billable.UBUNTU.total_ms = 0` for run 31754638408).

## The one-line diff

Delete `continue-on-error: true` from the `live-kind-included` job.

## Why it was not done in the PR that filed it

Promoting an advisory job to a gating job changes what can block a merge for
every contributor. GOVERNANCE round-29: that lands with maintainer sign-off, not
on an agent's own judgement. Evidence is assembled here so the decision is a
yes/no rather than an investigation.

## Caveat worth stating with the promotion

The job proves 17 of 43 Applications; the other 26 are excluded
(081M00QCNYM087G0R000ZS3CE2). Promoting it makes a real gate out of a real but
PARTIAL proof. That is strictly better than a real proof nobody reads, but the
scope should be stated when it is promoted so nobody reads a green
`live-kind-included` as "the cluster comes up".

## Done when

- [ ] Maintainer signs off.
- [ ] `continue-on-error: true` removed.
- [ ] The job's partial scope is noted in its `name:` or a comment above it.
