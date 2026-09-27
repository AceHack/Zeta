---
id: 081M3JG75X9087G0R000GHA4QA
type: bug
state: backlog
priority: P2
slug: gmod-steamcmd-install-crash-loops-runs-as-root-fails-missing
title: "gmod SteamCMD install crash-loops: runs as root, fails Missing file permissions"
created: 2026-09-27T22:36:53.033Z
depends_on: []
composes_with: []
---

# gmod SteamCMD install crash-loops: runs as root, fails Missing file permissions

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3JG75X9087G0R000GHA4QA-*.md` glob. -->

Live (node-5b2dfa, fresh bare-metal install 2026-09-27): `game-hosting/gmod-0` init
container `install` exit 8, 8+ restarts, `ERROR! Failed to install app '4020' (Missing
file permissions)`. Pod already had `fsGroup: 1000`; the container ran as **uid 0**
(`cm2network/steamcmd:root`, no `runAsUser`). Fix: run the SteamCMD containers as the
image's `steam` user (1000:1000). Guard: `src/Core.TypeScript/cluster/pvc-write-identity.ts`.
