---
id: 081KTGF7GE808QG0R001A5H37X
type: bug
state: backlog
priority: P1
slug: ci-gate-goes-whole-gate-red-on-transient-kind-0-31-0-downloa
title: "CI gate goes whole-gate-red on transient kind@0.31.0 download 504 in toolchain install — retry on 5xx or make kind optional for jobs that don't need it"
created: 2026-06-07T07:19:49.960Z
depends_on: []
composes_with: []
---

# CI gate goes whole-gate-red on transient kind@0.31.0 download 504 in toolchain install — retry on 5xx or make kind optional for jobs that don't need it

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTGF7GE808QG0R001A5H37X-*.md` glob. -->

## Symptom (observed 2026-06-07)

The `gate` workflow went red across multiple consecutive `main` commits (#6734/#6735/#6736 and the
#6737 tip run). Every failing job failed in the **same step** — `Install toolchain via three-way-parity
script (GOVERNANCE §24)` (`tools/setup/install.sh`) — with:

```
mise ERROR Failed to install aqua:kubernetes-sigs/kind@0.31.0:
  HTTP status server error (504 Gateway Timeout) for url
  (https://github.com/kubernetes-sigs/kind/releases/download/v0.31.0/kind-linux-amd64)
```

It hit jobs that have nothing to do with k8s — `lint (no conflict markers)`, `lint (§33 migration
xrefs)`, `lint (markdownlint)` — because they all run the full toolchain install first. So a single
transient GitHub-releases-CDN 504 on the `kind` binary turns the **whole gate red**, masking real
signal and blocking auto-merge. The actual content (markdownlint, conflict-markers, tests) was fine.

## Why it matters

- **False red across the board:** a transient 504 on one optional tool fails unrelated lint/build jobs.
- **Masks real failures:** when everything is red for an infra reason, a genuine regression hides.
- **Blocks auto-merge / keeps main red**, which the steward then has to re-run by hand.

## Fix options (DevOps — Dejan owns the install script per GOVERNANCE §24)

1. **Retry on 5xx** — wrap aqua/mise tool installs in a bounded retry-with-backoff for transient
   HTTP 5xx / timeout (the cheapest, highest-leverage fix; aqua downloads are idempotent).
2. **Make `kind` (and other k8s-only tools) optional / lazy** — don't install `kind` in jobs that don't
   need it (lint, markdownlint, conflict-markers, most build-test). Scope the heavy/optional tools to the
   jobs that actually use them, or a separate install profile.
3. **Pin to a mirror / cache the binary** — cache `kind` (and similar GitHub-release binaries) so a CDN
   504 doesn't reach the critical path.

Recommendation: (1) retry-on-5xx as the immediate resilience win + (2) profile-scope optional tools so
a lint job never depends on `kind` at all.

## Anchors

- `tools/setup/install.sh` (the one install script, three-way parity — GOVERNANCE §24), `tools/setup/common/mise.sh`.
- `.github/workflows/gate.yml` (the gate that goes red). Owner: Dejan (devops-engineer).
- Composes-with: nothing functional; pure CI-reliability. Advisory routing — binding via Architect/human.
