---
id: 081KSGS9H0008QG0R0037H3W4T
priority: P1
status: open
title: iter-5.4.1 — node self-registers via commit+push to `maintainers/<operator>/cluster-nodes/<hostname>/node.yaml` at install time — builds directly on iter-5.4.0 (PR #5210) gh-auth foothold; advances 081KSGS9H0008QG0R0027HJZYH sub-target 3 from minimum-viable (pubkey-copy only) to full (commit+push)
effort: M
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R0027HJZYH
composes_with:
  - 081KSGS9H0008QG0R00153CQ8B
  - 081KSE6WT0008QG0R003CMCX84
  - 081KSGS9H0008QG0R002T3BJ2R
tags: [iter-5, iter-5.4, self-registration, gh-auth, commit-push, maintainers-subtree, gitops-native-cluster-bringup, b0794-sub-target-3]
---

## Problem

[081KSGS9H0008QG0R0027HJZYH](081KSGS9H0008QG0R0027HJZYH-node-self-registers-in-git-under-maintainers-cluster-nodes-triggers-argocd-full-bringup-of-k8s-apps-charts-gitops-native-cluster-substrate-aaron-2026-05-26.md) names 6 sub-targets for full GitOps-native cluster bring-up. **iter-5.4.0** (PR #5210, just shipped) implements the minimum-viable subset:

- Operator runs `gh auth login` at install time (homelab-first per Mika)
- `gh ssh-key list` extracts operator's GitHub SSH pubkeys
- Writes to `/mnt/etc/zeta/operator-authorized-keys` → `operator-authorized-keys.nix` injects into `users.users.zeta.openssh.authorizedKeys.keys`

That gets ssh-from-anywhere-operator-has-keys working on first boot. **It does NOT yet make the node self-register in git** — sub-target 3 of 081KSGS9H0008QG0R0027HJZYH ("zeta-register.service systemd unit") is the next slice.

## Target

Extend zeta-install.sh's Step 6.8 (iter-5.4.0 gh-auth) into Step 6.9 (iter-5.4.1 self-registration commit+push). After gh-auth-login succeeds + operator pubkeys are captured:

1. **Probe the node** for hostname (already in `/mnt/etc/zeta/cluster-node-id` per iter-5.2) + roles (iter-5.3) + hardware (CPU/RAM/GPU/storage/IP/MAC)
2. **Compose `node.yaml`** matching the schema from 081KSGS9H0008QG0R0027HJZYH sub-target 2 (provisional CRD `zeta.lucent-financial-group.com/v1 ClusterNode`)
3. **Clone the Zeta repo** to a temp location using gh-managed auth (or use `gh repo clone Lucent-Financial-Group/Zeta`)
4. **Write to `maintainers/<operator-gh-user>/cluster-nodes/<hostname>/node.yaml`** (operator-gh-user is `gh api /user --jq .login`)
5. **Commit + push** via `gh` so commit-author = the operator (no shipped credentials; clean attribution chain)
6. **Output the PR URL** in the install banner so operator sees their node's registration commit

Composes additively with iter-5.4.0: if iter-5.4.0's gh-auth succeeds, this sub-target's commit+push works too. If iter-5.4.0 was skipped, this sub-target also skips (gh isn't auth'd).

## Sub-targets

### Sub-target 1 — hardware-probe shell function

Bash function in zeta-install.sh that emits a YAML fragment:

```bash
probe_hardware() {
  cat <<EOF
hardware:
  cpu: "$(grep 'model name' /proc/cpuinfo | head -1 | cut -d: -f2 | sed 's/^[[:space:]]*//')"
  memory: "$(free -h --si | awk '/Mem:/{print $2}')"
  cores: $(nproc)
  gpu: "$(lspci -nn | grep -iE 'vga|3d|display' | head -1 || echo none)"
  storage:
$(lsblk -ndo NAME,SIZE,TYPE -e7 | awk '$3=="disk"{print "    - \"/dev/" $1 " " $2 "\""}')
  network:
    ip: "$(ip -4 -o addr | awk '/inet/ && !/lo/{print $4; exit}')"
    mac: "$(ip -o link | awk '!/loopback/{print $(NF-2); exit}')"
EOF
}
```

### Sub-target 2 — compose node.yaml + write to maintainers tree

Build the full `ClusterNode` resource per the 081KSGS9H0008QG0R0027HJZYH sub-target 2 schema, including the iter-5.x-provided fields (hostname, roles, registration timestamp, flake commit) AND the probed hardware fields.

### Sub-target 3 — commit + push via gh

```bash
WORK_DIR=$(mktemp -d)
gh repo clone Lucent-Financial-Group/Zeta "$WORK_DIR" -- --depth 1
MAINTAINER=$(gh api /user --jq .login)
mkdir -p "$WORK_DIR/maintainers/$MAINTAINER/cluster-nodes/$HOSTNAME"
echo "$node_yaml" > "$WORK_DIR/maintainers/$MAINTAINER/cluster-nodes/$HOSTNAME/node.yaml"
cd "$WORK_DIR"
git add "maintainers/$MAINTAINER/cluster-nodes/$HOSTNAME/"
git commit -m "feat(node-register): $HOSTNAME self-registers via iter-5.4.1"
git push origin main  # OR push to a fresh branch + gh pr create
```

Decision-point: push directly to main OR open PR? PR is safer (operator reviews node-config before it lands; ArgoCD doesn't reconcile a half-baked node-config); direct-to-main is simpler. Default: open PR. Operator can merge from their phone.

### Sub-target 4 — install banner shows registration PR URL

Update the install-complete banner to include the registration PR URL when iter-5.4.1 succeeds:

```
iter-5.4.1 SELF-REGISTRATION: SUCCESS
  Node-registration PR opened:
    https://github.com/Lucent-Financial-Group/Zeta/pull/NNNN
  Review + merge → ArgoCD reconciles → node joins cluster
```

## Acceptance

- [ ] hardware-probe shell function emits valid YAML on amd64 + arm64 Linux
- [ ] node.yaml conforms to provisional `ClusterNode` schema from 081KSGS9H0008QG0R0027HJZYH sub-target 2
- [ ] commit+push opens a PR (default) OR direct-to-main (opt-in flag)
- [ ] install banner shows registration PR URL
- [ ] empirical end-to-end: zflash → boot → install → gh-auth (iter-5.4.0) → self-register PR opens → operator merges → node visible in maintainers/<operator>/cluster-nodes/<hostname>/node.yaml on main

## Out of scope (081KSGS9H0008QG0R0027HJZYH future sub-rows)

- ArgoCD app watching the tree (081KSGS9H0008QG0R0027HJZYH sub-target 4; tracked as a separate row)
- `--maintainer` flag at zflash time (081KSGS9H0008QG0R0027HJZYH sub-target 5; operator-gh-user-derived default works first)
- Production-mode bootstrap-key rotation (deferred per Aaron's homelab-first direction)
- Multi-maintainer governance (081KSGS9H0008QG0R0027HJZYH sub-target 6; future)

## Composes with

- **[081KSGS9H0008QG0R0027HJZYH](081KSGS9H0008QG0R0027HJZYH-node-self-registers-in-git-under-maintainers-cluster-nodes-triggers-argocd-full-bringup-of-k8s-apps-charts-gitops-native-cluster-substrate-aaron-2026-05-26.md)** (parent; this row is sub-target 3 minimum-viable extension)
- **[081KSGS9H0008QG0R002T3BJ2R](081KSGS9H0008QG0R002T3BJ2R-iter-5-plus-cluster-as-pr-author-cross-substrate-write-back-without-operator-machine-aaron-2026-05-26.md)** — cluster-as-PR-author substrate; this row's commit+push pattern is the homelab-first instance of 081KSGS9H0008QG0R002T3BJ2R (no per-node deploy key needed; uses operator's gh-auth from iter-5.4.0)
- **[081KSGS9H0008QG0R00153CQ8B](../P1/081KSGS9H0008QG0R00153CQ8B-zero-dev-machines-cluster-native-architecture-all-prs-from-cluster-voice-as-primary-operator-surface-aaron-2026-05-26.md)** — zero-dev-machine end-state requires this (operator's phone can review + merge the registration PR; no laptop kubectl)
- **[081KSE6WT0008QG0R003CMCX84](../P1/081KSE6WT0008QG0R003CMCX84-cluster-is-the-deterministic-information-object-zeta-cluster-substrate-end-state-aaron-2026-05-26.md)** — cluster-IS-DIO requires git-native node substrate; this row IS the bridge from "node booted" → "node IS git-native cluster substrate"

## Substrate-inventory pass

Per [`.claude/rules/verify-existing-substrate-before-authoring.md`](../../.claude/rules/verify-existing-substrate-before-authoring.md):

- `grep -rlF "iter-5.4.1"` → none on main; safe to use this name
- `grep -rlF "self-registration"` → 1 existing reference (081KSGS9H0008QG0R0027HJZYH itself); this row extends it
- ID `081KSGS9H0008QG0R0037H3W4T` next-free per `git ls-tree origin/main` (highest = 081KSE6WT0008QG0R002CC6314)
- 081KSGS9H0008QG0R0027HJZYH + 081KSGS9H0008QG0R002T3BJ2R + 081KSGS9H0008QG0R00153CQ8B + 081KSE6WT0008QG0R003CMCX84 all exist on main + cross-reference correctly

## Origin

Direct decomposition of 081KSGS9H0008QG0R0027HJZYH sub-target 3 (the maintainer 2026-05-26 cluster-self-registration-target) after iter-5.4.0 (PR #5210) lands the gh-auth foothold this row builds on.
