---
id: 081KSGS9H0008QG0R000EPPQTR
priority: P1
status: open
title: tools/cluster/deregister-node.ts — TS tool that removes a registered machine from git via PR (sibling inverse to iter-5.4.1 self-registration; cluster operators iterate fast in homelab; 081KSGS9H0008QG0R000EPPQTR)
effort: S
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on: []
composes_with:
  - 081KSGS9H0008QG0R0027HJZYH
  - 081KSGS9H0008QG0R0037H3W4T
  - 081KSGS9H0008QG0R002K93MWX
  - 081KSGS9H0008QG0R000JVGZKG
tags: [cluster-tooling, deregister, gitops, gh-auth, ts-rule-0-compliant, iter-5-4-sibling]
---

## Problem

iter-5.4.1 (081KSGS9H0008QG0R0037H3W4T) registers a machine into git at `maintainers/<operator>/cluster-nodes/<hostname>/`. There is no companion tool to REMOVE a machine from that tree. The maintainer 2026-05-26: *"lets make a ts file for removing machines from git too cause i'm going to delete clusters a lot lol"*.

Without a deregister tool, removing a machine requires:

- Manual `git rm -r maintainers/<op>/cluster-nodes/<host>/`
- Manual commit + push (operator's gh auth)
- Manual PR open + merge

Each manual step is a friction point + footgun (wrong path = wrong node deleted). Bundling into a TS tool gives:

- Operator-name auto-resolved via `gh api /user --jq .login` (matches registration flow)
- Existence verification against `origin/main` (no false-positive "deleted nothing" + no oops-wrong-host)
- Safe-default: opens PR (default) so ArgoCD doesn't reconcile half-baked state; `--push-direct` flag for fast-path
- Composes with iter-5.4.1 + iter-5.4.2 (ArgoCD reconciles the deletion via its `selfHeal + prune` policy)

## Target

Ship `tools/cluster/deregister-node.ts` as a Bun TS script (per Rule 0). Usage:

```bash
bun tools/cluster/deregister-node.ts --host pikachu \
    [--maintainer aaron] [--reason "decommissioning hardware"] [--push-direct]
```

## Sub-targets

### Sub-target 1 — argument parsing + operator resolution

- `--host <hostname>` required
- `--maintainer <name>` optional (default: `gh api /user --jq .login`)
- `--reason "..."` optional (free text included in commit message + PR body)
- `--push-direct` flag (default: open PR)

### Sub-target 2 — existence verification

Before any destructive op: `git ls-tree -d origin/main maintainers/<op>/cluster-nodes/<host>/` must return the dir. If not, exit code 2 ("not found; nothing to deregister").

### Sub-target 3 — temp worktree (don't touch operator's primary checkout)

Per Aaron 2026-05-25 "081KSE6WT0008QG0R003YYC9PV primary checkout is SHARED VIEW + FOR HUMAN; agents NEVER touch it" — the tool creates a `mktemp -d` worktree, does the work there, cleans up. Composes with the worktree-hygiene rule landed earlier.

### Sub-target 4 — commit + push + PR

- Branch: `otto-cli/deregister-<host>-<YYYYMMDD-HHMM>` (unless `--push-direct`)
- Commit message: standard format with co-authored-by + sibling-substrate cross-ref
- `gh pr create` with auto-generated title + body explaining ArgoCD reconciliation behavior

### Sub-target 5 — exit-code contract

| Code | Meaning |
|---|---|
| 0 | PR opened (or direct push succeeded) |
| 1 | Invocation error (missing args, no gh auth, etc.) |
| 2 | Host not found in maintainers/<op>/cluster-nodes/ tree on main |
| 3 | git/push/gh error |

## Acceptance

- [x] `tools/cluster/deregister-node.ts` shipped (PR #5215)
- [ ] `bun tools/cluster/deregister-node.ts --host <fake>` exits with code 2 (host not found)
- [ ] `bun tools/cluster/deregister-node.ts --host <real>` opens PR + correct URL printed
- [ ] `--push-direct` path skips PR; pushes to main; ArgoCD reconciles on next sync
- [ ] No leakage into operator's primary checkout (temp worktree always cleaned)

## Composes with

- **[081KSGS9H0008QG0R0027HJZYH](081KSGS9H0008QG0R0027HJZYH-node-self-registers-in-git-under-maintainers-cluster-nodes-triggers-argocd-full-bringup-of-k8s-apps-charts-gitops-native-cluster-substrate-aaron-2026-05-26.md)** — parent cluster-bring-up substrate
- **[081KSGS9H0008QG0R0037H3W4T](081KSGS9H0008QG0R0037H3W4T-iter-5-4-1-self-registration-commit-push-to-maintainers-cluster-nodes-builds-on-iter-5-4-0-gh-auth-foothold-aaron-2026-05-26.md)** — iter-5.4.1 self-registration; this is the inverse
- **[081KSGS9H0008QG0R002K93MWX](081KSGS9H0008QG0R002K93MWX-iter-5-4-2-argocd-app-watches-maintainers-cluster-nodes-tree-reconciles-on-pr-merge-completes-gh-auth-to-cluster-bringup-arc-aaron-2026-05-26.md)** — iter-5.4.2 ArgoCD reconciler; deregistration relies on the reconciler's `selfHeal + prune` policy to clean up K8s state on PR-merge
- **[081KSGS9H0008QG0R000JVGZKG](../P2/081KSGS9H0008QG0R000JVGZKG-cluster-node-registration-heartbeat-expiration-pattern-physical-sync-design-aaron-2026-05-26.md)** — heartbeat/expiration design; this tool is the manual path; 081KSGS9H0008QG0R000JVGZKG is the automatic-staleness path

## Substrate-inventory pass

Per [`.claude/rules/verify-existing-substrate-before-authoring.md`](../../../.claude/rules/verify-existing-substrate-before-authoring.md):

- `grep -rlF "deregister-node"` → none on main; safe
- `tools/cluster/` directory does NOT yet exist; PR creates it
- ID 081KSGS9H0008QG0R000EPPQTR next-free per `git ls-tree origin/main` (highest = 081KSGS9H0008QG0R002K93MWX in flight via PR #5212)

## Origin

The maintainer 2026-05-26 in the iter-5.4 substrate-engineering session:

> *"lets make a ts file for removing machines from git too cause i'm going to delete clusters a lot lol"*

Filed as P1 because cluster operators iterate fast in homelab + the deregister tool is the natural sibling to the registration flow we're building. Status `in-progress` because the tool ships in the same PR as this row.
