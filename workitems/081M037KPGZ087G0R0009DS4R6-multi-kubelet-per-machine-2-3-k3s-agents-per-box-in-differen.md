---
id: 081M037KPGZ087G0R0009DS4R6
type: task
state: backlog
priority: P3
slug: multi-kubelet-per-machine-2-3-k3s-agents-per-box-in-differen
title: "Multi-kubelet per machine — 2-3 K3S agents per box in different clusters for upgrade failure-domain isolation (recovered lost row B0723; PR 4955 closed unmerged, live row blocked on it)"
created: 2026-08-15T17:30:44.127Z
depends_on: []
composes_with: []
---

# Multi-kubelet per machine — 2-3 K3S agents per box in different clusters for upgrade failure-domain isolation (recovered lost row B0723; PR 4955 closed unmerged, live row blocked on it)

> **Legacy-id rendering:** old ids appear here **without the hyphen** (`B0747`, not the
> hyphenated form). `lint-no-b-refs` forbids hyphenated legacy refs on live authored surfaces,
> and `docs/research/` + `workitems/` are live surfaces — exempting them would make that lint
> unfalsifiable. The hyphenless form is already the repo's convention in directory names.

## Provenance — recovered, and this one has a closed PR to prove it

Resurrected from **B0723**, which never landed on `main`. Only surviving copy under
`docs/recovered-orphan-branches-2026-05/misc/backlog/b0723-multi-kubelet-failure-domain-2026-05-25-c2/docs/backlog/P3/`
(140 lines). Alias map assigned `081KSE6WT0008QG0R002CQS1HR`; no file with that id was ever added
on any ref.

**The hard evidence** — the PR that would have landed it is closed, unmerged:

```json
gh pr view 4955 -> {"mergedAt": null, "state": "CLOSED",
                    "title": "backlog(B0723): multi-kubelet per machine - failure-domain pattern"}
```

**And a live row is explicitly waiting on it.**
`docs/backlog/P2/081KSE6WT0008QG0R00195RG48-ts-hat-operator-polyglot-k8s-operator-pattern-for-max-*`
cites it twice:

> "composes with the multi-kubelet pattern in `081KSE6WT0008QG0R002CQS1HR` **once that row
> lands**; PR #4955"
>
> "**081KSE6WT0008QG0R002CQS1HR** (multi-kubelet per machine; **PR #4955 pending merge**)"

That row has been waiting on a merge that will never happen. This work-item is the successor the
reference should now point at.

## The pattern (from the recovered row)

Run **2-3 K3S agents per physical box, each joined to a different cluster**, so a botched upgrade
fails over instead of taking down the whole physical cluster. Failure-domain isolation at the
machine level rather than the cluster level.

## Assessment against three months of change (2026-08-15)

Still wanted, with one honest caveat.

- **For:** the cluster is live and actively worked
  (`docs/research/2026-08-13-cluster-joining-is-blocked-on-an-absent-join-*`), ~35
  backlog/workitem rows touch k3s/kubelet, and the polyglot-operator row still names this pattern
  as its composition partner. The upgrade-blast-radius problem it solves has not been solved
  another way.
- **Caveat (do not skip this at pickup):** the manifesto §1 read deserves a fresh pass. Multiple
  kubelets per box is *concentration on one physical failure domain* — the pattern buys upgrade
  isolation, not machine isolation. Price that honestly before building; a box that dies still
  takes 2-3 clusters' worth of capacity with it.

## Register

`unmetered`. The failure-domain claim ("botched upgrades fail over") has **no falsifier
attached** — no test, no measured blast radius. Attaching one is part of the work, not a
precondition for filing.

## Follow-up bookkeeping

`081KSE6WT0008QG0R00195RG48` should have its two references re-pointed from the phantom
`081KSE6WT0008QG0R002CQS1HR` to this id. Deliberately **not** done in this PR — that is an edit to
a live row on another lane, and the sweep's job was to find the loss, not to rewrite the rows that
noticed it.

## Pointers

- Census + method: `docs/research/2026-08-15-lost-bnnnn-work-on-recovered-orphan-branches-census-and-triage.md`
- Blocked row: `docs/backlog/P2/081KSE6WT0008QG0R00195RG48-*`
