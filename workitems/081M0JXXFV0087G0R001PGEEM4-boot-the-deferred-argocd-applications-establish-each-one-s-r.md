---
id: 081M0JXXFV0087G0R001PGEEM4
type: task
state: backlog
priority: P2
slug: boot-the-deferred-argocd-applications-establish-each-one-s-r
title: "Boot the deferred ArgoCD Applications: establish each one's real blocker and land the cheap ones"
created: 2026-08-21T19:49:10.112Z
depends_on: []
composes_with: []
---

# Boot the deferred ArgoCD Applications: establish each one's real blocker and land the cheap ones

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0JXXFV0087G0R001PGEEM4-*.md` glob. -->

## Findings (2026-08-21)

Twelve Applications were in scope: the eight `DEV_INCLUDED_PROOF_DEFERRED_DIRS`
entries plus the four GPU entries of `DEV_EXCLUDED_DIRS`. Full write-up, with
the per-app blocker and the evidence:
[`docs/research/2026-08-21-what-each-deferred-argocd-application-needs-to-boot.md`](../docs/research/2026-08-21-what-each-deferred-argocd-application-needs-to-boot.md).

Headline: **nine of the twelve were never applied to a CI cluster at all** —
they were named in `DEFAULT_ROOT_DEV_CATALOG.excludeGlob` (`ports.ts`), a rule
upstream of the two hand lists everyone reads. Six of the eight deferred rows
carried no recorded reason; all six now do.

### Landed

`deepseek-coder`, `qwen-coder`, `orleans` — asserted under the **full**
auto-sync Synced+Healthy contract (`manualSync=false`), not the manual-sync one.
The included proof goes 19/45 -> 22/45.

### Still open

- `agent-memory`, `platform`, `ollama`, `vllm` — held by the missing dev
  `longhorn` StorageClass, independently of any hand list. Blocked on another
  agent's scope.
- `gitlab`, `temporal`, `spire` — real dependency chains (a secret store; a
  datastore that is itself longhorn-blocked; an initialised Vault).
- `forgejo`, `vault` — WRONG-TO-TEST. Asserting `forgejo` would assert the
  manual-sync contract (the cdi/kubevirt vacuity); `vault` requires the gated
  operator-init ceremony CI must never run.

### Follow-up worth filing separately

`auditAppliedButUnasserted` audits only applied-but-unasserted. The inverse,
**asserted-but-never-applied**, has no audit — measured: it stays exit 0 while
the harness asserts an Application ArgoCD never applies.
