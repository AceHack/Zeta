---
id: 081M23C5394087G0R000QS9J9D
type: bug
state: backlog
priority: P2
slug: the-smoke-lane-makes-argocd-clone-a-649-mib-repo-inside-kind
title: "the smoke lane makes ArgoCD clone a 649 MiB repo inside kind, so its verdict tracks repo size and GitHub throughput"
created: 2026-09-09T15:21:32.196Z
depends_on: []
composes_with: []
---

# the smoke lane makes ArgoCD clone a 649 MiB repo inside kind, so its verdict tracks repo size and GitHub throughput

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M23C5394087G0R000QS9J9D-*.md` glob. -->


## What was measured

Run `34367032579`, a workflow_dispatch on unchanged `main` (`28527c40`). BOTH
`live kind ArgoCD health` jobs failed -- amd64 and arm64 -- while the
`live kind included Synced+Healthy proof` in the SAME run passed. The root
Application carried:

    ComparisonError: Failed to load target state: failed to generate manifest
    for source 1 of 1: rpc error: code = DeadlineExceeded desc = context
    deadline exceeded

on

    repoURL:         https://github.com/Lucent-Financial-Group/Zeta
    targetRevision:  28527c40c7a7cf7816dcd535a39c218d166846ba
    directory.recurse: true

`git count-objects -vH` on this repo: **size-pack 649.45 MiB**. ArgoCD's
repo-server has to clone that inside a kind node and finish manifest generation
within `ARGOCD_EXEC_TIMEOUT` (default 90 s). Nothing in
`dev-cluster/use-cases.ts` overrides it -- the install sets exactly one value,
`server.service.type=ClusterIP`.

## The asymmetry is the proof

The included proof runs the same ArgoCD, on the same runner image, against the
same tree -- and never touches this path, because `--serve-tree dev` packs the
tree and serves it from an in-cluster git server:

    [serve-tree] rung=dev files=149 repoURL-rewrites=13 packed=497927B

**497,927 bytes versus 649 MiB -- about 1,300x less to fetch.** That is why one
passed and two failed in the same run, on the same commit.

## Register: ONE occurrence, both architectures, cause named

The smoke lane was green in the three preceding runs (`34254081213`,
`34323056405`, `34338106811`) on the same code path, so this is not yet a
reproducible regression. Both architectures failing simultaneously on an
unchanged tree points at a shared external variable -- GitHub clone throughput at
that moment -- against a margin that repository growth has been eating
monotonically. Recorded as a MARGIN that has become thin, not as a break.

## Why this is not fixed here

Two candidate remedies, and choosing between them is a CI decision rather than a
bug fix:

1. **Raise `ARGOCD_EXEC_TIMEOUT` on the repo-server** (helm `repoServer.env`).
   Cheap, and buys time rather than fixing the trend -- the clone still grows.
2. **Stop cloning the whole history.** A shallow single-revision fetch would cut
   the transfer by orders of magnitude, but the smoke lane exists precisely to
   prove the REAL `repoURL` path works, so any change here narrows what it
   proves and needs saying out loud.

What must NOT happen is pointing the smoke lane at `--serve-tree` to make it
green: that would delete the only place the GitHub-backed App-of-Apps path is
exercised at all, which is the whole reason the lane is separate from the
included proof.

## What would settle the register

A second dispatch on unchanged `main`. Green twice more => thin margin, keep
watching. Red again => reproducible, and remedy 1 or 2 is due.
