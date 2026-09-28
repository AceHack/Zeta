---
id: 081M3K1ERX5087G0R002Z8GE0B
type: bug
state: backlog
priority: P2
slug: gmod-sftp-sidecar-crash-loops-on-fresh-install-when-gmod-sft
title: "gmod sftp sidecar crash-loops on fresh install when gmod-sftp-keys ConfigMap is absent"
created: 2026-09-28T03:38:07.653Z
depends_on: []
composes_with: []
---

# gmod sftp sidecar crash-loops on fresh install when gmod-sftp-keys ConfigMap is absent

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3K1ERX5087G0R002Z8GE0B-*.md` glob. -->

Live 2026-09-27 (node-5b2dfa): `game-hosting/gmod-0` 1/2 CrashLoopBackOff. The atmoz/sftp
sidecar's `create-sftp-user` runs `cat /home/gmod/.ssh/keys/*` and exits 1 when the dir is
empty; the keys volume is the `optional` ConfigMap `gmod-sftp-keys`, absent on a fresh install.

Fix: SFTP is opt-in. The sidecar idles and polls while no key file exists, then execs atmoz's
`/entrypoint gmod::1000:1000`. Operator enables it by creating the ConfigMap (see the comment
in `full-ai-cluster/k8s/applications/game-hosting/gmod/statefulset.yaml`).
Falsifier: `src/Core.TypeScript/cluster/gmod-sftp-keys.test.ts` (runs the sidecar script).

Not fixed here: platform blueprints (`full-ai-cluster/k8s/applications/platform/blueprints.yaml`
rendered by `platform-controller/src/blueprint.ts`) ship `atmoz/sftp:alpine` sidecars with no
args (no user spec) and no keys mount; expected to fail at start the same way or worse (not run).
