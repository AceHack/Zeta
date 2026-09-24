---
id: 081M39EMBRW087G0R001RHMEDJ
type: task
state: backlog
priority: P2
slug: helm-render-nondeterminism-census-seaweedfs-sftp-creds-gitla
title: "Helm-render nondeterminism census: seaweedfs SFTP creds + gitlab test-hook pod name also regenerate on every render (cilium/weaviate already fixed)"
created: 2026-09-24T10:15:57.980Z
depends_on: []
composes_with: []
---

# Helm-render nondeterminism census: seaweedfs SFTP creds + gitlab test-hook pod name also regenerate on every render (cilium/weaviate already fixed)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M39EMBRW087G0R001RHMEDJ-*.md` glob. -->

## Why this exists

WP26 (081M38GCTFX087G0R003MMTXJE) found the same shape twice — weaviate's
`weaviate-cluster-api-basic-auth` Secret and cilium's three TLS Secrets
regenerate fresh random content on every `helm template` render, which
ArgoCD's repo-server calls on every reconcile with no way to `lookup` the
live value. The architect asked: is this two coincidences or a property of
the roster — checkable by rendering every Application at its pinned
revision twice and diffing.

## Method

`helm template <release> <chart> --version <pin> -f <valuesObject>` twice per
Helm-sourced Application (via the same command shape
`liveness-kill-budget.ts`'s `renderHelmRaw` already uses, and the same
`readAppSource` parser from `crd-provider-consumer-order.ts`), diffed. Ran
against every `full-ai-cluster/k8s/applications/*/Application.yaml`.

## Result: 4 of 44 applications render non-deterministically

- **44 total**: 33 STABLE, 11 SKIP (directory-sourced, not Helm — no
  `helm template` non-determinism is possible for these), 4 NONDETERMINISTIC.
- **cilium** — FIXED this session (`ignoreDifferences` + `RespectIgnoreDifferences=true`, `full-ai-cluster/k8s/applications/cilium/Application.yaml`).
- **weaviate** — KNOWN, already had the same fix (pre-existing); app verdict
  still open for an unrelated reason (see 081M38GCTFX087G0R003MMTXJE).
- **seaweedfs — NEW, NOT FIXED.** `templates/sftp/sftp-secret.yaml` renders
  fresh `admin_password` / `readonly_password` / `public_user_password` /
  `seaweedfs_sftp_config` / `seaweedfs_sftp_ssh_private_key` on every
  invocation (5 of ~1500+ rendered lines differ). The Secret carries
  `helm.sh/hook: pre-install,pre-upgrade` and
  `helm.sh/resource-policy: keep` — the CHART's own attempt to make this a
  one-time mint (create once, never delete, don't reapply on upgrade) — but
  whether ArgoCD's own hook-resource handling actually honours "don't
  re-apply on subsequent PreSync" the same way `helm upgrade` would is NOT
  verified here. seaweedfs currently reads Healthy in every first-boot-
  replica run measured (35936015368 through 35973241862), so if it IS
  churning, it is not (yet) failing health — consistent with hook resources
  often being excluded from ArgoCD's health aggregation even when they
  resync.
- **gitlab — NEW, LOWER PRIORITY.** `charts/webservice/templates/tests/test-runner.yaml`
  renders `name: gitlab-webservice-test-runner-<5-char-suffix>` differently
  each time — but it carries `helm.sh/hook: test`, and ArgoCD does not apply
  `test`-hook resources during a normal sync (only via an explicit test-hook
  run). gitlab is also in `serve-tree-exclude-glob`'s exclude list — it
  never deploys in the dev/CI lane at all today. Lowest-risk of the four.

## Why seaweedfs was NOT fixed with the same ignoreDifferences pattern here

The strongest lead in 081M38GCTFX087G0R003MMTXJE for cilium/weaviate's
remaining "stuck Progressing forever" mystery is that `RespectIgnoreDifferences=true`
is used by EXACTLY those two Applications and no other — and both are stuck.
Mechanically applying the same `ignoreDifferences` + `RespectIgnoreDifferences=true`
fix to seaweedfs, a CURRENTLY HEALTHY app, risks reproducing that same
unexplained stuck-health symptom on a third app for a credential-churn bug
that (per the hook annotations) may already be inert in practice. Fixing
blind here trades a possible-but-unconfirmed problem for a
confirmed-elsewhere one. Do this only after:

1. Confirming seaweedfs's SFTP secret ACTUALLY churns on a live cluster
   (check `kubectl get secret seaweedfs-sftp-secret -o jsonpath='{.data.admin_password}'`
   across two ArgoCD syncs — if the hook protects it, the value never
   changes and there is nothing to fix).
2. If it does churn, understanding the `RespectIgnoreDifferences` stuck-health
   correlation first (081M38GCTFX087G0R003MMTXJE's open lead) so a third
   data point does not just get added to the same live bug instead of
   avoiding it.

## Pointers

- Census script (not committed — one-off, reusable if needed):
  `helm template` twice via `readAppSource`
  (`src/Core.TypeScript/cluster/crd-provider-consumer-order.ts`) +
  `renderHelmRaw`'s command shape
  (`src/Core.TypeScript/cluster/liveness-kill-budget.ts`).
- `full-ai-cluster/k8s/applications/cilium/Application.yaml` — the landed fix,
  as a template for seaweedfs's eventual one.
- 081M38GCTFX087G0R003MMTXJE — the RespectIgnoreDifferences lead this
  workitem's "don't fix blind" section depends on.
