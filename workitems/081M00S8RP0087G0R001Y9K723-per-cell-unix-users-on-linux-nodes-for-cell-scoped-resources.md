---
id: 081M00S8RP0087G0R001Y9K723
type: task
state: backlog
priority: P2
slug: per-cell-unix-users-on-linux-nodes-for-cell-scoped-resources
title: "Per-cell Unix users on Linux nodes for cell-scoped resources only"
created: 2026-08-14T18:41:36.960Z
depends_on: []
composes_with: []
---

# Per-cell Unix users on Linux nodes for cell-scoped resources only

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00S8RP0087G0R001Y9K723-*.md` glob. -->

## Why

The only "yes" in the enforcement survey. Per-cell Unix users need **no code identity** — which is
what disqualifies the macOS keychain ACL, LSM labels and IMA/EVM on this fleet, since every cell
presents the same one (`bun`, Team ID 7FRXF46ZSN, driving an unsigned `.sh` wrapper). A uid is
issued by nobody, is local to the machine, imports no third-party trust root, and composes with
SEV-SNP/TDX later rather than being replaced by them.

Blocked on 081M00S8MB8087G0R002JMPFVP: scope is **cell-scoped resources only**. Applying this to
agent keys creates a no-forced-upgrade violation at the next rotation.

## Scope

- Linux/NixOS nodes only. `users.users.zeta-cell-N` + systemd `User=`, `ProtectHome=`, `PrivateTmp=`.
- **NOT macOS.** Cells there are launchd *user agents* (`$HOME/Library/LaunchAgents`,
  `gui/$(id -u)`) and are per-user by construction; per-cell users needs a LaunchDaemon conversion
  whose cost currently exceeds the isolation bought.
- **NOT agent keys.** Workspace, logs, scratch, build cache.

## Done when

- Each cell's processes run under a distinct uid on Linux nodes.
- A cell cannot read a peer cell's clone (today all four are `acehack:staff` mode 755).
- A mutant proves it: a test that a cross-cell read is refused, and that fails if the uid split is
  removed.

## Pointers

- `docs/research/2026-08-14-what-can-be-the-enforcer-…md` §2 option 4
- `src/Core.TypeScript/enforcement/credential-reachability.ts` — `assessCellIsolation`
