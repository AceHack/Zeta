---
id: 081M3K7CRZW087G0R002W225YV
type: bug
state: done
priority: P2
slug: portal-blueprint-agent-drafts-use-opt-steamcmd-a-404-gmod-ta
title: "Portal blueprint-agent drafts use /opt/steamcmd, a 404 gmod tag and bare atmoz sidecars - the contract the shipped library already fixed"
created: 2026-09-28T05:21:53.660Z
completed: 2026-09-28T05:22:17.745Z
depends_on: []
composes_with: []
---

# Portal blueprint-agent drafts use /opt/steamcmd, a 404 gmod tag and bare atmoz sidecars - the contract the shipped library already fixed

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3K7CRZW087G0R002W225YV-*.md` glob. -->

## Finding

`full-ai-cluster/portal/src/blueprint-agent.ts` generates Blueprint drafts. Its drafts
still used the contract that the shipped library fixed in #17729 and #17736:
- The gmod, unturned, valheim and rust drafts ran `/opt/steamcmd/steamcmd.sh`, overrode
  `command`, and mounted `/data`. The ich777 images ship no `/opt/steamcmd`, and the
  command override skips their `/opt/scripts/start.sh`.
- The gmod draft used `ghcr.io/ich777/steamcmd:gmod`, which is not a tag (the manifest
  fetch fails). The publisher's tag is `garrysmod`.
- Every draft had a bare `atmoz/sftp` sidecar, which crash-loops.
- The "add sftp" follow-up added the same bare sidecar.

## Fix

- ich777 drafts are configured by env: `GAME_ID`, plus `GAME_NAME` for gmod,
  `GAME_PARAMS`, `GAME_PORT` and `VALIDATE`. valheim also sets `SRV_NAME`,
  `WORLD_NAME` and `SRV_PWD`; rust sets `SERVER_NAME`. Drafts set no
  install/command/args, and the PVC mounts at `/serverdata/serverfiles`.
- gmod uses the `garrysmod` tag.
- All SFTP sidecars use the opt-in gate with the optional `${RESOURCE_NAME}-sftp-keys`
  ConfigMap, running as the data owner:
  - 99:100 for ich777 images;
  - 1000:1000 for itzg/minecraft-server (verified from its registry config: `UID=1000`,
    `GID=1000`, no User);
  - 1000:1000 (the pod fsGroup) for arma-reforger, whose image runs as root.

Anti-drift: `platform-controller/src/steamcmd-contract.ts` holds pure checks used by both
`blueprint.test.ts` (the shipped library) and `portal/src/blueprint-agent.test.ts`. The
portal test renders each draft through `renderDeployable`. Control tests show the checks
report the old gmod shape and the bare sidecar as violations.

Red on origin/main: 13 portal failures. Green after the fix.

## Not verified

- No live pod was run.
- The valheim and rust contracts were read from their upstream `start-server.sh` and
  registry config only. Their image layers were not diffed against upstream, unlike
  garrysmod and unturned.
