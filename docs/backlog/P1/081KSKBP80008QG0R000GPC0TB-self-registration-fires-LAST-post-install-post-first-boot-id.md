---
id: 081KSKBP80008QG0R000GPC0TB
priority: P1
status: open
title: self-registration fires LAST (post-install + post-first-boot, when cluster is operational) + idempotent across reboots + de-duped against existing-registration AND in-flight-registration-PRs; cluster-agent coordination via /tmp folder OR Otto-pushes-PR-across-finish-line (Aaron 2026-05-27)
effort: M
ask: aaron 2026-05-27
created: 2026-05-27
last_updated: 2026-05-27
depends_on: []
composes_with:
  - 081KSGS9H0008QG0R0037H3W4T
  - 081KSGS9H0008QG0R002K93MWX
  - 081KSGS9H0008QG0R00120EEHM
  - 081KSKBP80008QG0R003Z4C0D0
  - 081KSKBP80008QG0R00248VEWT
  - 081KSKBP80008QG0R003AX2A69
tags: [self-registration, iter-5-4-1, idempotency, dedup, last-step-discipline, cluster-coordination, tmp-folder-coordination, otto-pushes-across-finish-line, b0812-architecture-fix, install-vs-first-boot, reboot-safety]
---

## Operator framing (Aaron 2026-05-27)

After PR #5408 was auto-opened mid-install (then orphaned by the P0 nixos-install `--fallback` failure that dropped the install to interactive shell):

> *"we can close PR #5408 also how did it register before it even rebooted? it should not register until the last step when everything comes up and if it reboots it should not register over and over and cluster agents should get the pr though, they are going to need to communicate over some /tmp folder standard or something or we can just worry about one you otto pushing the pr across the finish line on bootup but the cluster should realize it's register or has a pr in flight for register and not duplicate."*

PR #5408 closed substrate-honestly. This row captures the architectural fix.

## What's wrong today (081KSGS9H0008QG0R0037H3W4T iter-5.4.1 as shipped)

Self-registration fires inside `zeta-install.sh` Step 6.9 — AFTER the gh-auth flow (Step 6.8) but BEFORE the install completes (Step 7 prints credentials; then operator must reboot manually OR zeta-first-boot reboots after `zeta-install` exits 0).

Two failure modes the current architecture has:

1. **Registers before reboot** — Step 6.9 fires while still booted from the live USB into the installer environment. The node-yaml claims a cluster identity that the actually-installed OS hasn't come up under yet. If install fails downstream (e.g., today's P0 `--fallback` bug), the registration PR is orphaned for a node-id that never came up.

2. **Re-registers on retry / re-boot of installer** — if operator re-boots the USB to retry install (because of #5408's case), Step 6.9 fires AGAIN. New branch, new PR, same node. The maintainers/`AceHack`/cluster-nodes/ tree accumulates phantom PRs for the same physical node.

Both stem from "registration is part of install" vs "registration is the LAST step after the cluster is operationally up."

## Architectural fix (this row)

### Change 1 — Move self-registration to fire LAST

Move iter-5.4.1 self-registration OUT of `zeta-install.sh` Step 6.9 into a systemd ONE-SHOT service that runs on FIRST BOOT of the installed OS, AFTER:

- nixos-install completed cleanly
- System rebooted into installed OS
- Network is up (`network-online.target` after)
- Operator's chosen creds are restored (composes with 081KSKBP80008QG0R003AX2A69 cred persistence)
- Cluster-side substrate is reachable (gh API responding; argocd reachable when applicable)

Service: `zeta-self-register.service` (Type=oneshot; ConditionFirstBoot=true; After=network-online.target zeta-creds-restore.service).

### Change 2 — Idempotency: detect existing registration before composing PR

The new self-register service MUST check (in order):

1. Does `~/.config/zeta/self-registered.marker` exist on the local node? → already registered; skip
2. Does `maintainers/<op>/cluster-nodes/<node-name>/node.yaml` exist on `origin/main`? → already registered upstream; write marker; skip
3. Is there an OPEN PR on origin with title-pattern matching `node-register: <node-name>` (or similar) authored by this operator? → in-flight; skip
4. Otherwise: compose YAML + open PR + write marker

Marker file is the FAST PATH (no GraphQL needed on subsequent boots). Upstream checks fire only on first boot OR when marker is absent (e.g., re-install).

### Change 3 — Cluster-agent coordination mechanism

Per Aaron's framing, two paths offered:

#### Path A — `/tmp` folder coordination standard

A shared `/tmp/zeta-cluster-state/` directory where each cluster agent advertises its registration state:

```text
/tmp/zeta-cluster-state/
├── nodes/
│   ├── <node-name>/
│   │   ├── self-registered.marker  (timestamp; PR URL when known)
│   │   ├── register-pr-in-flight.lock  (PR number; expires on TTL)
│   │   └── last-seen.iso
└── README.md  (schema doc)
```

Cluster agents (other systemd services on the same node OR sibling nodes via shared NFS / similar) read these markers to coordinate. Composes with `tools/bus/` envelope substrate (the bus does the cross-node coordination at scope; this is the per-node-state surface).

#### Path B — Otto pushes the PR across the finish line on bootup

Single-source-of-truth: Otto running on the node (per 081KSKBP80008QG0R003Z4C0D0 multi-vendor systemd substrate) is responsible for PR lifecycle. The self-register service writes intent (composed YAML + branch name); Otto's tick monitors + opens the PR + arms auto-merge + waits for ratification.

This is the simpler architectural shape — it composes with the existing 081KSKBP80008QG0R003Z4C0D0 + 081KSKBP80008QG0R00248VEWT systemd guard-post substrate. The intent + execution are decoupled (which fits the persona-first design principle).

**Aaron's framing leans toward path B**: *"we can just worry about one you otto pushing the pr across the finish line on bootup"*.

Phase 1 (this row's bounded slice): implement path B as the simpler form. Path A becomes a future enhancement when multi-agent cluster coordination needs the per-node surface.

### Change 4 — De-dup discipline

Even with Otto-pushes-across-finish-line:

- Otto checks for in-flight PR before opening new one (existing `gh pr list --author "@me" --head <branch>` pattern)
- Otto's PR-creation uses idempotent branch naming (e.g., `register-node-<node-name>` NOT `register-node-<node-name>-<timestamp>`) so re-opens hit the same branch + same PR
- If the same branch exists upstream with an open PR: Otto adds a comment + monitors instead of opening duplicate
- If the branch exists but PR is closed: Otto re-opens with substrate-honest comment about the prior close (or files NEW branch only after operator authorization)

## Sub-rows to file when implementing

- 081KSKBP80008QG0R000GPC0TB.1 — `zeta-self-register.service` NixOS module (oneshot; ConditionFirstBoot=true)
- 081KSKBP80008QG0R000GPC0TB.2 — TS self-register module (`tools/installer/zeta-self-register.ts`) — composes YAML + writes marker + delegates PR-push to Otto
- 081KSKBP80008QG0R000GPC0TB.3 — Otto-pushes-PR-across-finish-line implementation (Otto's tick checks self-registered.marker + PR state + opens/comments idempotently)
- 081KSKBP80008QG0R000GPC0TB.4 — `~/.config/zeta/self-registered.marker` schema + read/write helpers
- 081KSKBP80008QG0R000GPC0TB.5 — `zeta-install.sh` Step 6.9 REMOVED (self-registration no longer fires here; replaced by marker-file write of "intent to register")
- 081KSKBP80008QG0R000GPC0TB.6 — empirical test: fresh USB → first boot → registration fires + PR opens; reboot → registration does NOT re-fire; reinstall → re-registration possible after marker reset
- 081KSKBP80008QG0R000GPC0TB.7 — composes-with check + memory file landing for "registration is LAST + idempotent + de-duped" as architectural pattern

Order suggestion: 1 → 2 → 4 (foundational substrate); 5 (remove the wrong-place implementation); 3 (Otto integration); 6 (validation); 7 (substrate landing).

## What this is NOT

- NOT a deletion of 081KSGS9H0008QG0R0037H3W4T's substrate — 081KSGS9H0008QG0R0037H3W4T named the core requirement (nodes self-register); this row fixes WHEN + HOW
- NOT a replacement for ArgoCD reconciliation (081KSGS9H0008QG0R002K93MWX iter-5.4.2; ratification path stays the same)
- NOT a full multi-agent cluster-coordination scheme (path A deferred to future row)
- NOT a removal of the manual `register-node.ts` fallback (operator-supervised manual fallback stays available)

## Composes with

- **081KSGS9H0008QG0R0037H3W4T** (parent ancestry) — iter-5.4.1 self-registration commit+push; this row moves the firing point + adds idempotency
- **081KSGS9H0008QG0R002K93MWX** — iter-5.4.2 ArgoCD reconciliation after merge; unchanged composition
- **081KSGS9H0008QG0R00120EEHM** — installer-config-bugs canonical bag (adds the "registered-before-rebooted" + "re-registers on retry" bug entries)
- **081KSKBP80008QG0R003Z4C0D0** — multi-vendor systemd substrate; Otto's tick (path B) runs as systemd service
- **081KSKBP80008QG0R00248VEWT** — persona-first scheduler; Otto's PR-push is one of the things the scheduler delegates to whichever persona is at the guard post
- **081KSKBP80008QG0R003AX2A69** — cred persistence; restored creds (gh + claude + gemini + codex) are pre-condition for self-register service
- 081KSGS9H0008QG0R002CY8Q24 / 081KSE6WT0008QG0R002CC6314 / 081KSGS9H0008QG0R000EPPQTR (sibling iter-5.4.x cluster substrate)
- `tools/bus/` envelope substrate (composes with path A future enhancement)
- `tools/cluster/register-node.ts` (manual fallback; unchanged)
- `.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md` — implementation in isolated worktrees

## Composes with prior substrate

- PR #5408 (the empirical anchor; closed 2026-05-27 substrate-honestly)
- PR #5410 (the P0 `--fallback` fix that surfaced this architectural gap)
- iter-5.4.0 + 5.4.1 + 5.4.2 lineage (the existing self-register substrate this row refines)

## Acceptance criteria

- [ ] Fresh USB + clean install + first boot: self-register service fires ONCE; marker written; PR opened
- [ ] Reboot of installed OS: self-register service does NOT fire again (marker present); no new PR
- [ ] Re-install on same physical disk (re-flash USB, re-boot installer, re-install): registration is operator-decision (marker absent → re-fire OK; marker present from cred-persistence-blob restore → skip)
- [ ] In-flight PR detection: if PR already open for this node-name, Otto adds comment + monitors; does NOT open duplicate
- [ ] Otto-pushes-across-finish-line: PR auto-merge armed by Otto; reaches main without operator intervention (composes with 081KSGS9H0008QG0R002K93MWX ArgoCD reconciliation)
- [ ] Install failure path: if nixos-install fails (like today's P0), NO registration PR opens (registration is post-install-success, not mid-install)

## Why P1

- Operator explicitly authorized + named the scope ("how did it register before it even rebooted? it should not register until the last step")
- Removes immediate operational pain (orphaned registration PRs on failed installs)
- Bounded scope (Phase 1 = move firing point + add marker + path B Otto-pushes; ~6 sub-rows)
- Composes cleanly with 081KSKBP80008QG0R003Z4C0D0 + 081KSKBP80008QG0R00248VEWT systemd substrate (already shipping)
- Unblocks the next ISO test-cycle from accumulating phantom registration PRs

## Substrate-honest framing

This row REFINES 081KSGS9H0008QG0R0037H3W4T (not replaces it). 081KSGS9H0008QG0R0037H3W4T's substrate-engineering claim — that nodes self-register — stays correct. The architectural gap is WHEN the registration fires + WHETHER it's idempotent across reboots.

Path A (per-node `/tmp` coordination) is deferred to future row when multi-agent cluster coordination needs the per-node surface. Path B (Otto-pushes-across-finish-line) is Phase 1's simpler shape per Aaron's explicit framing.

## Full reasoning

Aaron 2026-05-27 conversation arc:

1. Empirical anchor: PR #5408 auto-opened mid-install for `node-0fe6eb`; install then failed downstream at nixos-install `--fallback` bug; PR was orphaned for a node-id that never came up
2. Operator catch: registration fired BEFORE reboot; should fire LAST after everything is up
3. Operator concern: reboot of install → re-registration cycle; no de-dup
4. Operator design hint: cluster agents need coordination — either `/tmp` folder standard OR Otto-pushes-across-finish-line (single-source-of-truth)
5. Operator preference: simpler form first ("we can just worry about one you otto pushing the pr across the finish line on bootup")

Substrate-inventory pass (per `.claude/rules/verify-existing-substrate-before-authoring.md`):

- Topic: self-registration timing / idempotency / reboot safety / cluster-agent coordination
- Searched: docs/backlog/ (081KSGS9H0008QG0R0037H3W4T / 0813 / 0835 cover iter-5.4.x lineage); docs/agendas/ (no specific match); memory/ (no prior memory on this gap)
- Found: 081KSGS9H0008QG0R0037H3W4T (the substrate this row refines); 081KSGS9H0008QG0R002K93MWX (ArgoCD reconciliation; unchanged); 081KSGS9H0008QG0R00120EEHM (bug bag; this row's anchor becomes Bug 10)
- Conclusion: no existing substrate covers this architectural fix; this row is the operational refinement
