---
id: B-0891
priority: P1
status: open
title: zflash "done" acceptance criteria + QEMU test harness — 5-scenario test matrix (initial format / cluster up / reformat-with-retention / reformat-from-scratch / cluster joining); operator wants testing to begin NOW + offers collaborative testing
effort: L
ask: aaron 2026-05-28 acceptance-criteria
created: 2026-05-28
last_updated: 2026-05-31
depends_on:
  - B-0844
  - B-0852
  - B-0852.3
  - B-0737
composes_with:
  - B-0844
  - B-0852
  - B-0852.3
  - B-0737
  - B-0884
  - B-0886
  - B-0886.2
  - B-0889
  - B-0590
  - B-0770
  - B-0778
  - B-0951
related_rules:
  - non-coercion-invariant
  - persistence-choice-architecture-for-zeta-ais
tags:
  - zflash-done-acceptance-criteria
  - qemu-test-harness
  - 5-scenario-test-matrix
  - initial-format-and-cluster-up
  - reformat-with-key-and-selection-retention
  - reformat-from-scratch
  - cluster-joining
  - testing-begins-now-not-later
  - operator-collaborative-testing
  - operator-personal-axis-usb-priority-top
  - composes-with-pq-gitcrypt-zflash-integration-b-0884
  - composes-with-symbiotic-self-healing-b-0889
  - k8s-argocd-health-carved-to-b-0951
---

## Operator framing 2026-05-28

> *"we really want zflash testable in qemu and also the usb and the inital format and cluster comming up sucessfully and then reformat with retaining the selelctions and keys and then reformat from scratch and then cluster joining that's the acceptace critera i'm looking for for done aaron should really consider testing now and all the enhancements weve backlog, i can test some along the way too."*

Concrete operator-set acceptance criteria for zflash "done" + signal that testing should begin NOW (operator-personal-axis top priority per B-0886.2) + offer to do some testing collaboratively.

## 5-scenario test matrix (acceptance criteria for "done")

| # | Scenario | What proves done |
|---|---|---|
| **1** | **Initial format (USB-bake from zero)** | `zflash` script runs cleanly + produces bootable USB image with operator-chosen credentials baked in; passes ISO content audit (per existing `tools/ci/audit-installer-iso-content.ts` substrate); QEMU boots the image to a usable state |
| **2** | **Initial boot + cluster comes up** | USB boots in QEMU; cluster nodes (mini-PC fleet per B-0590) come up successfully; reach steady-state with all expected services running; observability backend reports healthy |
| **3** | **Reformat WITH key + selection retention** | Re-bake USB with existing operator-chosen credentials + auth settings (Touch ID per B-0737, passphrase per B-0852) + UUID-bound keys preserved; no need to re-enter passphrase or re-pair Touch ID; existing cluster recognizes the re-baked USB |
| **4** | **Reformat from scratch (wipe + fresh keys)** | Wipe-and-rebake from zero state; fresh keys; new USB UUID; operator can choose to migrate existing cluster's credentials onto new USB OR start fresh cluster — both paths supported |
| **5** | **Cluster joining (new node)** | New node boots from USB; joins existing running cluster cleanly; gets credentials provisioned per B-0852.3 cred-picker integration; appears in cluster state within bounded time |

## Scope clarification 2026-05-31

Aaron clarified that Kubernetes and ArgoCD health need their own integration
test lane, using kind/k3d or equivalent local-cluster substrate. This B-0891
USB/ISO lane should mostly prove:

- `zflash` and the ISO/USB boot path work,
- retention reformat keeps the same cluster/node identity,
- no-retention reformat creates a new cluster/node identity,
- one authenticated or local-LLM/no-account agent path starts, and
- physical hardware testing covers biometric behavior that QEMU cannot model
  honestly.

Full Kubernetes and ArgoCD health is carved out to **B-0951**. B-0891 may keep
a narrow cluster smoke signal for end-to-end confidence, but should not absorb
the full ArgoCD Application health matrix.

## QEMU test harness scope

QEMU as PRIMARY test environment because:

- Cheap iteration (no physical USB hardware needed for first 4 scenarios)
- Deterministic boot environment (composes with Zeta's DST discipline)
- Cross-platform (operator + Otto + Addison can all run identical tests)
- Composes with existing `docker-nixos-install-sh-test.yml` workflow if applicable

USB testing as VALIDATION step (after QEMU green):

- Physical USB confirms the QEMU-validated behavior survives real hardware
- Operator demos at work (per B-0886.2 in-front-of-eyes word-of-mouth priority) need physical USB
- Composes with B-0590 fleet-replication-20-machines for at-scale validation
- KVM substrate (B-0770 + B-0778) enables remote USB-boot of remote machines for fleet-scale tests

## Testing-begins-now framing

Operator: *"aaron should really consider testing now and all the enhancements weve backlog, i can test some along the way too."*

Two operational implications:

1. **Testing is not gated on full feature completion** — start exercising the existing substrate (B-0844 zflash agent-mode; B-0852 USB-bound credentials; B-0852.3 cred-picker; B-0737 Touch ID) NOW; the 5-scenario test matrix surfaces gaps as they hit
2. **Operator-collaborative testing pattern** — operator runs some scenarios; agents (Otto + others) run others; coordination via the agent-loop substrate (per existing PRs #5666 + #5669)

This composes with the trajectory-async-review surface (B-0873) — testing-progress reviewed asynchronously at trajectory scope, not gated on per-test approval.

## Acceptance criteria for THIS row (the test harness)

- `tools/zflash/test-harness/` TypeScript module that:
  - Implements all 5 scenarios as discrete tests
  - Runs each scenario in QEMU (configurable VM count + topology for cluster scenarios)
  - Reports pass/fail with structured output (composes with existing CI / audit substrate)
- `.github/workflows/zflash-qemu-test.yml` CI workflow that runs the harness on PR + on cadence
- USB test runner (separate path; operator-invoked when ready to validate on hardware)
- Documentation: how to invoke the harness; how to add scenarios; how to interpret failures
- Composes with B-0884 (PQ git-crypt + zflash integration) — test scenarios validate PQ-credential path when B-0884 substrate lands
- Composes with B-0886 ASAP cluster umbrella — test harness lands within the cluster's Phase 2 (USB high-parallel-track)

## Composition

- **B-0844** zflash agent-mode native implementation — implementation under test
- **B-0852** USB-bound credential substrate — implementation under test
- **B-0852.3** zeta-install.sh step 6.77 cred-picker — implementation under test
- **B-0737** Touch ID + PAM + ISO-auto-discovery — implementation under test
- **B-0884** PQ git-crypt + zflash integration — test path extends when this lands
- **B-0886** ASAP cluster umbrella — this row belongs in Phase 2 (USB high-parallel-track)
- **B-0886.2** two-priority-axes — USB is operator-personal-axis TOP priority; testing-now aligns with that
- **B-0889** symbiotic cross-track self-healing — test scenarios include cross-track recovery (cloud-KVM controls local USB-boot)
- **B-0590** fleet-replication-20-machines — at-scale validation context
- **B-0770** GL-iNet Comet Pro IP-KVM — for remote USB-boot fleet testing
- **B-0778** commodity hardware reference + fingerbot — hardware context for cluster tests
- **B-0951** Kubernetes + ArgoCD kind/k3d integration health tests — separate
  cluster-health proof; this row consumes only a narrow smoke signal from that
  domain

## Substrate-honest framing

P1 per operator framing ("testing now" + operator-personal-axis-USB-top). L effort — test harness for 5 scenarios across QEMU + USB is substantial; not trivial to ship. But operator's "i can test some along the way too" reduces the burden — operator handles physical-USB validation while agents drive QEMU-side iteration.

The 5-scenario matrix is the CONCRETE DEFINITION OF DONE. Implementation work that doesn't move all 5 scenarios toward green isn't the right work. Implementation work that closes gaps surfaced by the test matrix IS the right work.

## Full reasoning

Operator 2026-05-28: *"we really want zflash testable in qemu and also the usb and the inital format and cluster comming up sucessfully and then reformat with retaining the selelctions and keys and then reformat from scratch and then cluster joining that's the acceptace critera i'm looking for for done aaron should really consider testing now and all the enhancements weve backlog, i can test some along the way too."*

The currently-running zflash next-steps background research agent should integrate these acceptance criteria into its plan — extension message sent to agent.
