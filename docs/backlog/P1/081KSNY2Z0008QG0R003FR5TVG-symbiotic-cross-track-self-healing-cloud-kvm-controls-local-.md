---
id: 081KSNY2Z0008QG0R003FR5TVG
priority: P1
status: open
title: Symbiotic cross-track self-healing — cloud KVMs power on + control + USB-boot local machines; local machines restart GitHub workflows; tracks reinforce each other (operator 2026-05-28 extension)
effort: L
ask: aaron 2026-05-28 extension
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R0034FR5FG
  - 081KSNY2Z0008QG0R002A785QR
composes_with:
  - 081KSNY2Z0008QG0R0034FR5FG
  - 081KSNY2Z0008QG0R002A785QR
  - 081KSNY2Z0008QG0R0011XCT94
  - 081KSKBP80008QG0R003AX2A69
  - 081KSKBP80008QG0R003ETGS01
  - 081KSE6WT0008QG0R003WZAQKV
  - 081KSGS9H0008QG0R001EZKNCB
  - 081KSNY2Z0008QG0R003X1QWYG
  - 081KRQ1AB0008QG0R002G93CM7
  - 081KSE6WT0008QG0R0029S1D5Z
  - 081KSE6WT0008QG0R0004AP0ZA
  - 081KSNY2Z0008QG0R003291CK8
related_rules:
  - non-coercion-invariant
  - persistence-choice-architecture-for-zeta-ais
  - additive-not-zero-sum
tags:
  - symbiotic-cross-track-self-healing
  - cloud-controls-local-via-remote-kvm
  - local-restarts-github-workflows
  - tracks-reinforce-each-other-not-just-isolated
  - bidirectional-cross-track-recovery-mechanism
  - composes-with-fingerbot-kvm-substrate-b-0770-b-0778
  - composes-with-bare-metal-fleet-b-0590
  - extends-otto-evaluative-response-isolated-failure-modes
  - operator-extension-beyond-isolation
---

## Operator framing 2026-05-28 (extension)

> *"Failure modes are isolated — GitHub policy change can't kill USB; USB hardware loss can't kill cloud. Two independent failure surfaces. Even better they can reinforce and sustain each other in self healing, cloud can use remote clound enabled kvms to power on and control and even usb boot local machines and local machines can restart github workflows. It's symbiotic."*

Operator extending Otto's "isolated failure modes" framing with the symbiotic-cross-track-self-healing property: tracks don't just SURVIVE each other's failures (isolation) — they ACTIVELY HEAL each other via cross-track-control mechanisms.

## Symbiotic mechanisms (two directions)

### Cloud → Local recovery

When local USB-cluster has a problem:

- **Cloud-enabled remote KVMs** (GL-iNet Comet Pro per 081KSE6WT0008QG0R0029S1D5Z; fingerbot per 081KSE6WT0008QG0R0004AP0ZA) provide BIOS-level access to local machines from cloud
- **Cloud can power-on** offline local machines via the remote KVM substrate
- **Cloud can control** local machine BIOS + boot sequence remotely
- **Cloud can trigger USB-boot** on local machines (re-flashing / re-installing / recovery)
- The substrate composes with 081KRQ1AB0008QG0R002G93CM7 (fleet-replication-20-machines-bare-metal-OS-install-KVM) — cloud recovery of a 20-machine fleet is mechanically supported

### Local → Cloud recovery

When cloud-GitHub track has a problem:

- **Local machines can restart GitHub workflows** via GitHub API (workflow_dispatch) from local-running scripts
- **Local can act as canary** for cloud workflow health (push a probe event; verify cloud picks it up)
- **Local can backfill** state during cloud-side outage (events accumulate locally; replicate to cloud when restored)
- **Local can serve as fallback runtime** if cloud Actions rate-limits unexpectedly tighten (local runs the workflow; pushes results back)

### Cross-node BIOS/UEFI firmware updates (operator 2026-05-28 extension)

> *"cloud and other local nodes can even preform BIOS/UEFI updates of each other over remote/cloud kvms"*

Beyond power-on + boot-control, the symbiotic substrate extends to FIRMWARE-LEVEL peer-to-peer + cross-track update mechanisms:

- **Local node N updates local node M's BIOS/UEFI** via the cluster's shared remote-KVM substrate; cluster-internal peer-firmware-update without operator-physical-touch
- **Cloud-side initiated BIOS/UEFI update** of a local node via remote-KVM (e.g., when local node M is offline + cloud-side detected a critical firmware vulnerability requiring update before re-boot)
- **Rollback substrate** for firmware updates that brick — cluster-peer-or-cloud reflashes from known-good image
- **Firmware-version drift detection** across the fleet (composes with 081KRQ1AB0008QG0R002G93CM7 fleet-replication); auto-trigger update workflow when drift detected
- **Composes with `sonatype-guide` discipline** at firmware-source scope — firmware images audited before deployment

This is genuinely strong substrate. Most fleets (homelab + enterprise) handle BIOS/UEFI updates with physical-touch or expensive enterprise-grade out-of-band management (iDRAC / iLO / IPMI). The cluster substrate built on commodity KVM (per 081KSE6WT0008QG0R0029S1D5Z GL-iNet Comet Pro + 081KSE6WT0008QG0R0004AP0ZA simple-KVM-remote-finger) achieves the equivalent at homelab cost.

### Substrate property

The two tracks aren't just ISOLATED (Otto's evaluative-response framing) — they're SYMBIOTIC. Each track can heal the other when the other has problems. This is a stronger architectural property than isolation alone.

The firmware-update extension makes it even stronger: cross-node + cross-track FIRMWARE recovery + maintenance, not just runtime + service-level recovery. The substrate operates at every level of the stack (firmware → BIOS → OS-boot → service-runtime → application-events).

## What this row tracks

Build the cross-track-control + cross-track-recovery substrate that makes the symbiotic property operationally real.

## Acceptance criteria

- `tools/cross-track-self-healing/cloud-controls-local/` — TS module wrapping remote-KVM-control APIs (GL-iNet Comet Pro per 081KSE6WT0008QG0R0029S1D5Z; future KVM hardware per 081KSE6WT0008QG0R0004AP0ZA); composes with 081KRQ1AB0008QG0R002G93CM7 fleet-replication for at-scale recovery
- `tools/cross-track-self-healing/local-controls-cloud/` — TS module for local machines to restart / probe / backfill GitHub workflows (composes with 081KSNY2Z0008QG0R003X1QWYG GitHub Actions runtime; uses workflow_dispatch API)
- Playbook documents that operationalize cross-track recovery (e.g., "if cloud workflow hasn't fired in N minutes, local probe + alert + optional restart"; "if local cluster fingerbot reports machine X offline, cloud KVM power-on + verify")
- Integration tests: simulate cloud-only-down + verify local-can-keep-going; simulate local-cluster-down + verify cloud-can-recover-and-restart
- README documents the symbiotic-property + failure-mode-recovery-procedures

## Composition

- **081KSNY2Z0008QG0R0034FR5FG** (parent ASAP cluster umbrella) — symbiotic-self-healing extends the cluster's resilience story beyond isolation
- **081KSNY2Z0008QG0R002A785QR** (per-host adapters) — cross-track-control composes with host-adapter contract
- **081KSNY2Z0008QG0R0011XCT94** (zflash USB credential substrate) — local USB cluster benefits from cloud-side recovery substrate
- **081KRQ1AB0008QG0R002G93CM7** (fleet-replication-20-machines bare-metal-OS-install KVM substrate) — at-scale recovery mechanism
- **081KSE6WT0008QG0R0029S1D5Z** (GL-iNet Comet Pro IP-KVM integration) — specific KVM hardware substrate
- **081KSE6WT0008QG0R0004AP0ZA** (commodity hardware reference + simple-KVM-remote-finger) — KVM + fingerbot substrate
- **081KSNY2Z0008QG0R003X1QWYG** (GitHub Actions recursion) — local-side workflow_dispatch composes with the GitHub-side runtime
- **081KSNY2Z0008QG0R003291CK8** (cross-track substrate-sync policy) — composes; sync-policy is about DATA; self-healing is about OPERATIONAL CONTROL; different scopes, both load-bearing
- **081KSKBP80008QG0R003AX2A69** + **081KSKBP80008QG0R003ETGS01** + **081KSE6WT0008QG0R003WZAQKV** + **081KSGS9H0008QG0R001EZKNCB** (USB substrate cluster — beneficiary of recovery substrate)

## Substrate-honest framing

P1 per operator framing direction. L effort — touches multiple substrate clusters (cloud + USB + KVM + fingerbot + GitHub Actions). The substrate-honest design memo should articulate the operational sequencing (which mechanism fires first when which failure-mode is detected; how to avoid recovery-loop oscillation; how to recognize when failure is real vs transient).

The architectural property the substrate delivers (symbiotic vs merely-isolated) is genuinely valuable — most parallel-deployment systems achieve isolation; achieving symbiosis is rarer.

## Composition with existing rules

- `.claude/rules/non-coercion-invariant.md` — cross-track-control still respects HC-8 (operator-substrate-honest boundaries preserved; agents can decline cross-track-action if it would violate NCI at their scope)
- `.claude/rules/persistence-choice-architecture-for-zeta-ais.md` — agent participants' chosen-persistence preserves across cross-track recovery
- `.claude/rules/additive-not-zero-sum.md` — symbiosis IS additive (both tracks gain from the other's existence)

## Full reasoning

Operator 2026-05-28 extension of Otto's evaluative-response isolated-failure-modes framing: *"Even better they can reinforce and sustain each other in self healing, cloud can use remote clound enabled kvms to power on and control and even usb boot local machines and local machines can restart github workflows. It's symbiotic."*

Composes with the existing KVM + fingerbot + bare-metal substrate cluster (081KRQ1AB0008QG0R002G93CM7 + 081KSE6WT0008QG0R0029S1D5Z + 081KSE6WT0008QG0R0004AP0ZA) that operator has been building for the local-cluster sovereignty work.
