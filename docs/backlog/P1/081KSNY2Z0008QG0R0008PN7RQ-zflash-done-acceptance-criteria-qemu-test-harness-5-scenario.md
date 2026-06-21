---
id: 081KSNY2Z0008QG0R0008PN7RQ
priority: P1
status: open
title: zflash "done" acceptance criteria + QEMU test harness — 5-scenario test matrix (initial format / cluster up / reformat-with-retention / reformat-from-scratch / cluster joining); operator wants testing to begin NOW + offers collaborative testing
effort: L
ask: aaron 2026-05-28 acceptance-criteria
created: 2026-05-28
last_updated: 2026-06-01
depends_on:
  - 081KSGS9H0008QG0R001EZKNCB
  - 081KSKBP80008QG0R003AX2A69
  - 081KSKBP80008QG0R003ETGS01
  - 081KSE6WT0008QG0R003WZAQKV
composes_with:
  - 081KSGS9H0008QG0R001EZKNCB
  - 081KSKBP80008QG0R003AX2A69
  - 081KSKBP80008QG0R003ETGS01
  - 081KSE6WT0008QG0R003WZAQKV
  - 081KSNY2Z0008QG0R0011XCT94
  - 081KSNY2Z0008QG0R0034FR5FG
  - 081KSNY2Z0008QG0R002CR38D8
  - 081KSNY2Z0008QG0R003FR5TVG
  - 081KRQ1AB0008QG0R002G93CM7
  - 081KSE6WT0008QG0R0029S1D5Z
  - 081KSE6WT0008QG0R0004AP0ZA
  - 081KSXN940008QG0R000SCP2H1
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
  - k8s-argocd-health-carved-to-b-0967
---

## Operator framing 2026-05-28

> _"we really want zflash testable in qemu and also the usb and the inital format and cluster comming up sucessfully and then reformat with retaining the selelctions and keys and then reformat from scratch and then cluster joining that's the acceptace critera i'm looking for for done aaron should really consider testing now and all the enhancements weve backlog, i can test some along the way too."_

Concrete operator-set acceptance criteria for zflash "done" + signal that testing should begin NOW (operator-personal-axis top priority per 081KSNY2Z0008QG0R002CR38D8) + offer to do some testing collaboratively.

## 5-scenario test matrix (acceptance criteria for "done")

| #     | Scenario                                      | What proves done                                                                                                                                                                                                                                 |
| ----- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1** | **Initial format (USB-bake from zero)**       | `zflash` script runs cleanly + produces bootable USB image with operator-chosen credentials baked in; passes ISO content audit (per existing `tools/ci/audit-installer-iso-content.ts` substrate); QEMU boots the image to a usable state        |
| **2** | **Initial boot + cluster comes up**           | USB boots in QEMU; cluster nodes (mini-PC fleet per 081KRQ1AB0008QG0R002G93CM7) come up successfully; reach steady-state with all expected services running; observability backend reports healthy                                                                   |
| **3** | **Reformat WITH key + selection retention**   | Re-bake USB with existing operator-chosen credentials + auth settings (Touch ID per 081KSE6WT0008QG0R003WZAQKV, passphrase per 081KSKBP80008QG0R003AX2A69) + UUID-bound keys preserved; no need to re-enter passphrase or re-pair Touch ID; existing cluster recognizes the re-baked USB |
| **4** | **Reformat from scratch (wipe + fresh keys)** | Wipe-and-rebake from zero state; fresh keys; new USB UUID; operator can choose to migrate existing cluster's credentials onto new USB OR start fresh cluster — both paths supported                                                              |
| **5** | **Cluster joining (new node)**                | New node boots from USB; joins existing running cluster cleanly; gets credentials provisioned per 081KSKBP80008QG0R003ETGS01 cred-picker integration; appears in cluster state within bounded time                                                                 |

## Scope clarification 2026-05-31

Aaron clarified that Kubernetes and ArgoCD health need their own integration
test lane, using kind/k3d or equivalent local-cluster substrate. This 081KSNY2Z0008QG0R0008PN7RQ
USB/ISO lane should mostly prove:

- `zflash` and the ISO/USB boot path work,
- retention reformat keeps the same cluster/node identity,
- no-retention reformat creates a new cluster/node identity,
- one authenticated or local-LLM/no-account agent path starts, and
- physical hardware testing covers biometric behavior that QEMU cannot model
  honestly.

Full Kubernetes and ArgoCD health is carved out to **081KSXN940008QG0R000SCP2H1**. 081KSNY2Z0008QG0R0008PN7RQ may keep
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
- Operator demos at work (per 081KSNY2Z0008QG0R002CR38D8 in-front-of-eyes word-of-mouth priority) need physical USB
- Composes with 081KRQ1AB0008QG0R002G93CM7 fleet-replication-20-machines for at-scale validation
- KVM substrate (081KSE6WT0008QG0R0029S1D5Z + 081KSE6WT0008QG0R0004AP0ZA) enables remote USB-boot of remote machines for fleet-scale tests

## Testing-begins-now framing

Operator: _"aaron should really consider testing now and all the enhancements weve backlog, i can test some along the way too."_

Two operational implications:

1. **Testing is not gated on full feature completion** — start exercising the existing substrate (081KSGS9H0008QG0R001EZKNCB zflash agent-mode; 081KSKBP80008QG0R003AX2A69 USB-bound credentials; 081KSKBP80008QG0R003ETGS01 cred-picker; 081KSE6WT0008QG0R003WZAQKV Touch ID) NOW; the 5-scenario test matrix surfaces gaps as they hit
2. **Operator-collaborative testing pattern** — operator runs some scenarios; agents (Otto + others) run others; coordination via the agent-loop substrate (per existing PRs #5666 + #5669)

This composes with the trajectory-async-review surface (081KSNY2Z0008QG0R000F0C5V0) — testing-progress reviewed asynchronously at trajectory scope, not gated on per-test approval.

## Acceptance criteria for THIS row (the test harness)

- `src/Core.TypeScript/zflash/test-harness/` TypeScript module that:
  - Implements all 5 scenarios as discrete tests
  - Runs each scenario in QEMU (configurable VM count + topology for cluster scenarios)
  - Reports pass/fail with structured output (composes with existing CI / audit substrate)
- `.github/workflows/zflash-qemu-test.yml` CI workflow that runs the harness on PR + on cadence
- USB test runner (separate path; operator-invoked when ready to validate on hardware)
- Documentation: how to invoke the harness; how to add scenarios; how to interpret failures
- Composes with 081KSNY2Z0008QG0R0011XCT94 (PQ git-crypt + zflash integration) — test scenarios validate PQ-credential path when 081KSNY2Z0008QG0R0011XCT94 substrate lands
- Composes with 081KSNY2Z0008QG0R0034FR5FG ASAP cluster umbrella — test harness lands within the cluster's Phase 2 (USB high-parallel-track)

## Composition

- **081KSGS9H0008QG0R001EZKNCB** zflash agent-mode native implementation — implementation under test
- **081KSKBP80008QG0R003AX2A69** USB-bound credential substrate — implementation under test
- **081KSKBP80008QG0R003ETGS01** zeta-install.sh step 6.77 cred-picker — implementation under test
- **081KSE6WT0008QG0R003WZAQKV** Touch ID + PAM + ISO-auto-discovery — implementation under test
- **081KSNY2Z0008QG0R0011XCT94** PQ git-crypt + zflash integration — test path extends when this lands
- **081KSNY2Z0008QG0R0034FR5FG** ASAP cluster umbrella — this row belongs in Phase 2 (USB high-parallel-track)
- **081KSNY2Z0008QG0R002CR38D8** two-priority-axes — USB is operator-personal-axis TOP priority; testing-now aligns with that
- **081KSNY2Z0008QG0R003FR5TVG** symbiotic cross-track self-healing — test scenarios include cross-track recovery (cloud-KVM controls local USB-boot)
- **081KRQ1AB0008QG0R002G93CM7** fleet-replication-20-machines — at-scale validation context
- **081KSE6WT0008QG0R0029S1D5Z** GL-iNet Comet Pro IP-KVM — for remote USB-boot fleet testing
- **081KSE6WT0008QG0R0004AP0ZA** commodity hardware reference + fingerbot — hardware context for cluster tests
- **081KSXN940008QG0R000SCP2H1** Kubernetes + ArgoCD kind/k3d integration health tests — separate
  cluster-health proof; this row consumes only a narrow smoke signal from that
  domain

## Substrate-honest framing

P1 per operator framing ("testing now" + operator-personal-axis-USB-top). L effort — test harness for 5 scenarios across QEMU + USB is substantial; not trivial to ship. But operator's "i can test some along the way too" reduces the burden — operator handles physical-USB validation while agents drive QEMU-side iteration.

The 5-scenario matrix is the CONCRETE DEFINITION OF DONE. Implementation work that doesn't move all 5 scenarios toward green isn't the right work. Implementation work that closes gaps surfaced by the test matrix IS the right work.

## Full reasoning

Operator 2026-05-28: _"we really want zflash testable in qemu and also the usb and the inital format and cluster comming up sucessfully and then reformat with retaining the selelctions and keys and then reformat from scratch and then cluster joining that's the acceptace critera i'm looking for for done aaron should really consider testing now and all the enhancements weve backlog, i can test some along the way too."_

The currently-running zflash next-steps background research agent should integrate these acceptance criteria into its plan — extension message sent to agent.
