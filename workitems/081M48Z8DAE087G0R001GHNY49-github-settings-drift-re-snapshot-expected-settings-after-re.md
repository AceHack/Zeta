---
id: 081M48Z8DAE087G0R001GHNY49
type: task
state: backlog
priority: P2
slug: github-settings-drift-re-snapshot-expected-settings-after-re
title: "github-settings drift: re-snapshot expected settings after reviewing every transition (codeql required context, 10 new lanes, heartbeat-liveness paused, mirror-to-fork re-enabled)"
created: 2026-10-06T16:02:59.534Z
depends_on: []
composes_with: []
---

# github-settings drift: re-snapshot expected settings after reviewing every transition (codeql required context, 10 new lanes, heartbeat-liveness paused, mirror-to-fork re-enabled)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M48Z8DAE087G0R001GHNY49-*.md` glob. -->

## Observed (shadow, PR sweep 2026-10-06)

`github-settings-drift` job "check drift" fails on run 37325646627 (main @ 5f944905; the run reads
green only because the job is `continue-on-error`). Live vs `github-settings.expected.json`, every
transition reviewed before accepting it (precedent: #16931):

| change | disposition |
|---|---|
| ruleset `CI Gate` gains required context `codeql (required)` | accepted — matches the maintainer's stated required set (gate + codeql) |
| 10 workflows missing from the snapshot (bytelock-toolchain-probe, control-plane-host-boots-k3s-vm, first-boot-replica, gitlab-live-proof, k3s-first-boot-roster-vm, k8s-cnpg-live, lean-cslib, lock-cross-os-stability, verify-mise-lock, verify-rustup-pin) | accepted — all in-tree `.github/workflows/*.yml`, active |
| `heartbeat-liveness` active -> disabled_manually | accepted — recorded maintainer decision (a30873b240, "intentionally paused", 2026-09-10) |
| `mirror-to-fork` disabled_manually -> active | accepted **with disclosure** — #16931 recorded it deliberately disabled on 2026-09-07; it was re-enabled and dispatched twice on 2026-09-08 and has run green daily since. **No in-repo record of the re-enable decision** was found; flagged to the maintainer in the PR body |
