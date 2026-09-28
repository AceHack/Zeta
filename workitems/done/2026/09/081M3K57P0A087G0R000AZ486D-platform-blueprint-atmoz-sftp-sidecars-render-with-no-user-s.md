---
id: 081M3K57P0A087G0R000AZ486D
type: bug
state: done
priority: P2
slug: platform-blueprint-atmoz-sftp-sidecars-render-with-no-user-s
title: "Platform Blueprint atmoz/sftp sidecars render with no user spec and no keys mount, so they crash-loop and hold game pods unready"
created: 2026-09-28T04:44:09.610Z
completed: 2026-09-28T04:44:30.367Z
depends_on: []
composes_with: []
---

# Platform Blueprint atmoz/sftp sidecars render with no user spec and no keys mount, so they crash-loop and hold game pods unready

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3K57P0A087G0R000AZ486D-*.md` glob. -->

## Finding (surfaced by PR #17722)

`full-ai-cluster/k8s/applications/platform/blueprints.yaml` declared three
`atmoz/sftp:alpine` sidecars (`gmod`, `unturned`, `arma-reforger`) that
`platform-controller/src/blueprint.ts` rendered with no args (no user spec) and no
keys mount. atmoz's `create-sftp-user` needs a user spec and, for a key-only user,
runs `cat /home/<user>/.ssh/keys/*` under `set -Eeo pipefail`, which fails when
no key is present. The sidecar crash-loops and every such game-server pod stays unready.

## Fix

The same opt-in pattern as the standalone gmod StatefulSet (#17722):
- The engine gains a generic `sidecar.configMaps` field: read-only mounts with a
  templated name and optional `optional`. It is kept on both StatefulSets and Deployments.
- Each sftp sidecar mounts the OPTIONAL ConfigMap `${RESOURCE_NAME}-sftp-keys` at
  `/home/zeta/.ssh/keys`.
- A `sh -c` gate logs "SFTP disabled" and idles while that directory holds no key
  file. `..data` is a dotfile, so `*` does not match it. Once a key appears, the gate
  runs `exec /entrypoint zeta::<uid>:<gid>`.
- uid/gid is the data owner: 99:100 for the ich777 images, whose start.sh chowns
  DATA_DIR to UID=99 GID=100. arma-reforger (acemod, no `User`, so root) uses the
  fsGroup 1000:1000 instead. Its write access to files the game created is not guaranteed.

Test: `full-ai-cluster/platform-controller/src/blueprint.test.ts`. It runs the
rendered script against a stub of atmoz. The test was red on the base branch
(12 failing) and is green after the fix.

## Not verified

No live pod has been run. In particular, it is not checked that sshd accepts a
`/home/zeta/.ssh` directory created by the kubelet for the keys mount (the gmod
StatefulSet uses the same layout), and it is not checked whether atmoz's chroot
tolerates the data mount's ownership.
