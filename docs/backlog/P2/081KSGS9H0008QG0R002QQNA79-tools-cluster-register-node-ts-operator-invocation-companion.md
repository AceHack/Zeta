---
id: 081KSGS9H0008QG0R002QQNA79
priority: P2
status: open
title: tools/cluster/register-node.ts — operator-invocation companion symmetric to deregister-node.ts (081KSGS9H0008QG0R000EPPQTR); thin wrapper for manual register/re-register cases (post-wipe, legacy hardware, override metadata); composes with iter-5.4.1 self-registration (081KSGS9H0008QG0R0037H3W4T) for the AUTO path
effort: S
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R0027HJZYH
  - 081KSGS9H0008QG0R000EPPQTR
composes_with:
  - 081KSGS9H0008QG0R0037H3W4T
  - 081KSGS9H0008QG0R002K93MWX
  - 081KSGS9H0008QG0R000JVGZKG
  - 081KSGS9H0008QG0R003A37Z65
tags: [cluster-tooling, register, operator-invocation, gh-auth, ts-rule-0-compliant, iter-5-4-sibling, symmetric-to-deregister]
---

## Problem

Today's iter-5.4 substrate has the AUTO path (node self-registers via systemd service at install-time per 081KSGS9H0008QG0R0037H3W4T iter-5.4.1) and the MANUAL DEREGISTER path ([081KSGS9H0008QG0R000EPPQTR](../P1/081KSGS9H0008QG0R000EPPQTR-tools-cluster-deregister-node-ts-removes-registered-machine-from-git-sibling-to-iter-5-4-1-self-registration-aaron-2026-05-26.md) `tools/cluster/deregister-node.ts`). Missing: the MANUAL REGISTER path.

Operator-invocation manual register is useful for:

- **Wipe + reinstall workflow**: operator wipes a machine, re-installs, but self-registration fails for some reason (network down, gh-auth-rate-limited, etc.); operator manually re-registers from their workstation
- **Legacy hardware adoption**: a machine that was installed via some other path (NixOS-manual / non-NixOS distro per the 081KSGS9H0008QG0R003A37Z65 cross-distro framing) needs to join the cluster
- **Override metadata correction**: hardware changed (GPU swap, disk replace) but the node hasn't re-run self-registration yet; operator manually pushes corrected node.yaml
- **Test-substrate**: operator wants to register a fake/test node without booting hardware

Without a manual register tool, all four cases require operator-side `git rm` / `git commit` / `gh pr create` choreography — friction + footgun (wrong path = wrong tree edit).

## Target

Ship `tools/cluster/register-node.ts` as a Bun TS script (per Rule 0). Symmetric to deregister-node.ts:

```bash
bun tools/cluster/register-node.ts \
    --host pikachu \
    --roles control-plane,worker-gpu \
    [--maintainer aaron] \
    [--ip 192.168.4.36] \
    [--mac 66:bf:3a:3d:56:c3] \
    [--from-yaml ./node.yaml] \
    [--push-direct] \
    [--reason "manual re-register after wipe"]
```

Two operational modes:

1. **Compose mode** (default): build node.yaml from CLI args using the same schema iter-5.4.1's auto-register would emit. Suitable for re-register / legacy-adopt / test cases.
2. **Pass-through mode** (`--from-yaml`): operator provides a pre-composed node.yaml; tool validates + commits + pushes. Suitable for metadata-override or copy-from-other-cluster cases.

## Sub-targets

### Sub-target 1 — argument parsing + operator resolution

Mirror deregister-node.ts pattern.

**Required by mode** (Copilot finding on #5221: original draft had `--host` + `--roles` marked required absolutely while `--from-yaml` was "alternative"; these are mutually exclusive — clarified here):

- **Compose mode** (default; when `--from-yaml` ABSENT): `--host` required + DNS-label-validated; `--roles` required + comma-separated
- **Pass-through mode** (when `--from-yaml <path>` PRESENT): `--host` + `--roles` IGNORED (yaml is source of truth); only `--maintainer` + `--push-direct` + `--reason` flags apply

**Always optional** (both modes): `--maintainer` (default = `gh api /user --jq .login`), `--push-direct` flag, `--reason` text.

**Hardware fields** (`--ip` + `--mac`): operator-provided only in compose mode. If omitted, the composed `node.yaml` OMITS the `hardware` field entirely (the 081KSGS9H0008QG0R002K93MWX CRD declares `hardware: { type: object, additionalProperties: true }` — `type: object` is not nullable, so emitting `hardware: null` would produce a CRD-invalid resource that ArgoCD/the apiserver would reject; omitting is valid since `hardware` is not in any `required:` list). Operator can later run iter-5.4.1 (081KSGS9H0008QG0R0037H3W4T systemd self-register) on the live node to populate hardware via actual probe. **Auto-SSH-probe at register-tool time is out of scope** (consistent with "Out of scope" section below; Copilot P? on #5221 noticed internal contradiction in the original draft — corrected here).

Reject `-`-prefixed values for string flags (avoid silent flag-consumption hazard caught on 081KSGS9H0008QG0R000EPPQTR).

### Sub-target 2 — yaml composition

Build `ClusterNode` CR per the 081KSGS9H0008QG0R002K93MWX schema. **`maintainer` lives under `spec.registration`, NOT under `metadata`** (Copilot finding on #5221: K8s ObjectMeta has a fixed schema + does not allow arbitrary fields; placing the operator name there would be silently dropped by the API server). Use `spec.registration.maintainer` instead; if grouping by maintainer is needed at K8s level, add a standard label like `zeta.lucent-financial-group.com/maintainer: <op>`:

```yaml
apiVersion: zeta.lucent-financial-group.com/v1
kind: ClusterNode
metadata:
  name: pikachu
  labels:
    zeta.lucent-financial-group.com/maintainer: aaron
spec:
  hostname: pikachu
  roles:
    - control-plane
    - worker-gpu
  # hardware: only present in --from-yaml pass-through mode (verbatim from
  # operator-supplied yaml); OMITTED in compose mode until iter-5.4.1
  # self-register populates. CRD declares `hardware: { type: object }` —
  # not nullable + not required, so omission is valid; `null` would fail.
  registration:
    timestamp: <now>
    method: manual-via-register-node.ts
    maintainer: aaron
    reason: <--reason value if provided>
```

### Sub-target 3 — existence check (inverse of deregister)

If `maintainers/<op>/cluster-nodes/<host>/` ALREADY exists on origin/main, prompt operator: register intent is RE-register (overwrite) OR new-register (refuse if exists)? Default = refuse (safe); `--force` flag to overwrite.

### Sub-target 4 — commit + push + PR

Same shape as deregister-node.ts: temp worktree (no operator-checkout-touch per 081KSE6WT0008QG0R003YYC9PV); branch `register/<host>-<YYYYMMDD-HHMM>` (NOT otto-cli prefix per Copilot P2 finding on 081KSGS9H0008QG0R000EPPQTR — this is an operator tool); commit message + PR body cite the operational reason.

### Sub-target 5 — `--from-yaml` validation

When operator passes `--from-yaml ./node.yaml`, validate against the ClusterNode schema BEFORE writing to the maintainers tree. Reuse the schema-validation helper from 081KSGS9H0008QG0R002K93MWX sub-target 1 (CRD) — likely a small TS function that mirrors the OpenAPI schema's required fields.

## Acceptance

- [ ] `tools/cluster/register-node.ts` ships
- [ ] Compose mode: `--host <name> --roles <r1,r2>` produces valid node.yaml + PR
- [ ] Pass-through mode: `--from-yaml ./node.yaml` validates + commits the file as-is
- [ ] Existence check: refuses overwrite without `--force`
- [ ] DNS-label validation on `--host` (per 081KSGS9H0008QG0R000EPPQTR P1 fix)
- [ ] Flag-consumption hazard avoided per 081KSGS9H0008QG0R000EPPQTR P1 fix
- [ ] Temp worktree pattern matches 081KSGS9H0008QG0R000EPPQTR (no leakage to operator checkout)
- [ ] Branch prefix `register/` (operator-tool; NOT `otto-cli/`)
- [ ] Exit-code contract matches 081KSGS9H0008QG0R000EPPQTR (0/1/2/3 semantics)
- [ ] `import.meta.main` guard for import-without-side-effects

## Composes with

- **[081KSGS9H0008QG0R0027HJZYH](../P1/081KSGS9H0008QG0R0027HJZYH-node-self-registers-in-git-under-maintainers-cluster-nodes-triggers-argocd-full-bringup-of-k8s-apps-charts-gitops-native-cluster-substrate-aaron-2026-05-26.md)** — parent cluster-bring-up substrate
- **[081KSGS9H0008QG0R000EPPQTR](../P1/081KSGS9H0008QG0R000EPPQTR-tools-cluster-deregister-node-ts-removes-registered-machine-from-git-sibling-to-iter-5-4-1-self-registration-aaron-2026-05-26.md)** — sibling deregister tool; symmetric pattern + shared discipline (DNS-label hostname, temp worktree, etc.)
- **[081KSGS9H0008QG0R0037H3W4T](../P1/081KSGS9H0008QG0R0037H3W4T-iter-5-4-1-self-registration-commit-push-to-maintainers-cluster-nodes-builds-on-iter-5-4-0-gh-auth-foothold-aaron-2026-05-26.md)** — iter-5.4.1 AUTO register path; this row is the MANUAL companion
- **[081KSGS9H0008QG0R002K93MWX](../P1/081KSGS9H0008QG0R002K93MWX-iter-5-4-2-argocd-app-watches-maintainers-cluster-nodes-tree-reconciles-on-pr-merge-completes-gh-auth-to-cluster-bringup-arc-aaron-2026-05-26.md)** — ArgoCD reconciler that reconciles the registered node into K8s state
- **[081KSGS9H0008QG0R000JVGZKG](081KSGS9H0008QG0R000JVGZKG-cluster-node-registration-heartbeat-expiration-pattern-physical-sync-design-aaron-2026-05-26.md)** — heartbeat/expiration scope; expired entries deregister, then re-register via this tool if the machine is still legit
- **[081KSGS9H0008QG0R003A37Z65](../P1/081KSGS9H0008QG0R003A37Z65-architectural-principle-maximize-argocd-scope-minimize-nixos-native-lock-in-cross-cluster-portability-leverage-aaron-2026-05-26.md)** — cross-distro portability principle; manual register IS the path for non-NixOS hosts to join (composes with the legacy-hardware-adoption use case above)

## Out of scope

- Auto-probing hardware via SSH (operator runs that elsewhere OR ships YAML directly via `--from-yaml`); future row could add
- Multi-node bulk register (per-PR, per-node remains the discipline; bulk = scripted loop)
- Cluster-side validation BEFORE PR-merge (that's K8s admission webhook scope; separate row)

## Substrate-inventory pass

Per [`.claude/rules/verify-existing-substrate-before-authoring.md`](../../../.claude/rules/verify-existing-substrate-before-authoring.md):

- `grep -rlF "register-node"` → existing references in 081KSGS9H0008QG0R000EPPQTR (sibling deregister + 081KSGS9H0008QG0R0037H3W4T mentions); no existing register-tool row
- ID 081KSGS9H0008QG0R002QQNA79 next-free per `git ls-tree origin/main` (highest = 081KSGS9H0008QG0R003A37Z65 in flight via #5220)
- Composes with established iter-5.4 + cluster-tooling substrate; not parallel-shape

## Origin

Natural arc-completion: deregister tool (081KSGS9H0008QG0R000EPPQTR) shipped; symmetric register tool fills the manual path for re-register / legacy-adoption / metadata-override / test scenarios. Filed as P2 (deregister is P1 because operator named it; manual register is implied by symmetry but not explicitly named; P2 acknowledges the lower-urgency derivation).
