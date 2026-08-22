# Active work-streams — the one doc to remember all of it

**Purpose** (operator 2026-06-01): _"i just really need a single doc somewhere for
me to remember all of it."_ This is that doc — the cross-lane index of what is being
built, each lane pointing at its master row + the surface driving it. Distinct from
[`ROADMAP.md`](ROADMAP.md) (shipped features) and [`CURRENT-ROUND.md`](CURRENT-ROUND.md)
(round status): this is **who is building what, per lane.**

> **Map, not a queue.** Before working any item: `claim acquire` it (split-brain
> guard), respect lanes/surfaces, and check the live registry — **today** that is
> the claim-coordinator (`bun src/Core.TypeScript/bus/claim.ts check`) + open PRs; the git-native
> cross-machine bus (`docs/agent-bus/`) becomes the registry **once 081KSXN940008QG0R00171YAZW populates
> it** (the folder is absent on main today). The claim-coordinator + PRs are
> authoritative now; the tables below are a dated, reconstructed hint.

## Two axes — don't conflate them

- **Work-lanes** = substrate areas (the _what_). These are the
  [081KSNY2Z0008QG0R002QA720J](backlog/P1/081KSNY2Z0008QG0R001KT3CX9-1-interface-for-async-scatterbrains-operator-experience-desi.md)
  standing "all lanes moving until each drains" discipline.
- **Surfaces** = agents (the _who_). Surface ownership is kept here per operator
  (2026-06-01: _"helps me remember who is doing what for now"_) until coordination
  is dynamic.

A surface can drive more than one lane; a lane can be driven by more than one
surface. The mapping below is the current snapshot, not a fixed 1:1.

## The lanes (snapshot 2026-06-01 — reconstructed; non-authoritative)

| Work-lane                                                  | Driving surface                     | Master row(s)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **workflow / state-machine → sovereign-DB / observe-loop** | otto-cli                            | [081KSXN940008QG0R003FCQ7WT](backlog/P1/081KSXN940008QG0R003FCQ7WT-zeta-sovereign-distributed-db-and-agent-loop-master-checklis.md) + [081KSXN940008QG0R001A4WWX4](backlog/P1/081KSXN940008QG0R001A4WWX4-observe-ts-agent-loop-implementation-and-testing-checklist-c.md)                                                                                                                                                                                                                     |
| **encryption**                                             | otto-cli (Otto-first, 081KSNY2Z0008QG0R0030V5ZVS)       | [081KSNY2Z0008QG0R002JKH50A](backlog/P1/081KSNY2Z0008QG0R000459FRH-16-glass-halo-open-by-default-encryption-as-earned-via-agora.md) + [081KSNY2Z0008QG0R0030V5ZVS](backlog/P1/081KSNY2Z0008QG0R0030V5ZVS-agent-private-encrypted-state-otto-first-then-other-ais-asap.md)                                                                                                                                                                                                                                                       |
| **zflash USB-ISO hardware install**                        | vera-codex                          | [081KSNY2Z0008QG0R0008PN7RQ](backlog/P1/081KSNY2Z0008QG0R0008PN7RQ-zflash-done-acceptance-criteria-qemu-test-harness-5-scenario.md) + [081KSGS9H0008QG0R001EZKNCB](backlog/P1/081KSGS9H0008QG0R001EZKNCB-zflash-agent-mode-native-implementation-close-doc-vs-impleme.md) + [081KSNY2Z0008QG0R0011XCT94](backlog/P1/081KSNY2Z0008QG0R0011XCT94-integrate-post-quantum-gitcrypt-with-zflash-usb-bound-creden.md)                                      |
| **git-accelerator**                                        | otto-cli (`accelerator/*` branches) | [081KSV2WD0008QG0R0021XJ94E](backlog/P2/081KSV2WD0008QG0R0021XJ94E-co-dominant-git-mirrors-git-native-crdt-coordination-no-host.md) + [081KSXN940008QG0R001KZ235R](backlog/P2/081KSXN940008QG0R001KZ235R-git-v2-handshake-fsharp-looks-like-git-negotiates-up-to-dbsp.md)                                                                                                                                                                                                                                |
| **Ace package-manager / distribution**                     | otto-windows                        | [081KSGS9H0008QG0R0031PBNGA](backlog/P1/081KSGS9H0008QG0R0031PBNGA-package-manager-of-package-managers-n-dimensional-dependency.md) + [081KSKBP80008QG0R000F4311E](backlog/P2/081KSKBP80008QG0R000F4311E-ace-package-manager-one-liner-curl-install-repository-for-fa.md) + [081KSGS9H0008QG0R001Y9FB62](backlog/P2/081KSGS9H0008QG0R001Y9FB62-ansible-gitops-plus-crossplane-cross-os-declarative-manageme.md) (cross-OS/Windows) |

Operator 2026-06-01 confirmed these **five** lanes (each its own lane, including
git-accelerator and Ace-distribution). History note: 081KSNY2Z0008QG0R002QA720J's original three
(encryption + zflash + state-machine) was an earlier snapshot — "ace/windows was
not in there" referred to _that_ historical set; the **current** set is these five.
The **workflow / state-machine** lane **grew into the sovereign-DB arc**
(operator-confirmed) — lane 1 and the workflow-DU work are the same lane.

## Per-lane detail

- **workflow / state-machine → sovereign-DB / observe-loop** — the whole arc is in
  **081KSXN940008QG0R003FCQ7WT**: one git-native Z-set substrate; the unbundled engine; algebra ladder
  (G-Set → Bag → Z-set); observe loop (081KSXN940008QG0R001A4WWX4); the git-native bus; distributed-time
  primitive; 4-language 4-oracle; dual-mode transport. Remember one handle: **081KSXN940008QG0R003FCQ7WT**.
  **Possible future split** (operator 2026-06-01): this single lane may eventually
  split into (a) **workflow / DU creation per plugin** — github / gitlab / jira / …
  action grammars (the 081KSKBP80008QG0R000B3Y19A workflow-engine side) — and (b) **distributed
  agent-home / intelligence-DB** — the encrypted-home + Z-set substrate side. One
  lane today; two later.
- **encryption** — better-git-crypt (post-quantum, retraction-native diff-readable,
  081KSNY2Z0008QG0R002JKH50A) + per-agent private encrypted state (Otto-first, 081KSNY2Z0008QG0R0030V5ZVS). The "encrypted
  home" floor of the §0 topology.
- **zflash** — bare-metal install: done-acceptance + QEMU 5-scenario harness
  (081KSNY2Z0008QG0R0008PN7RQ), agent-mode native impl (081KSGS9H0008QG0R001EZKNCB), PQ git-crypt USB-bound creds (081KSNY2Z0008QG0R0011XCT94).
  In flight: PR #6220.
  **Milestone (operator-stated 2026-06-07):** **USB install now working on Windows**
  (set up by **Max**) — cross-OS reach realized for the USB installer.
- **git-accelerator** — co-dominant git mirrors / git-native CRDT, no host needed
  (081KSV2WD0008QG0R0021XJ94E) + Git-V2 handshake (081KSXN940008QG0R001KZ235R: F# looks-like-git, negotiates up to a
  DBSP/retraction protocol at agent-coordination speed). Live: `accelerator/pr-less-git-monster`.
- **Ace package-manager / distribution** — the n-dimensional dependency manager
  (081KSGS9H0008QG0R0031PBNGA) + the one-liner curl-install repo for fast-moving tools (081KSKBP80008QG0R000F4311E) +
  cross-OS / Windows reach (081KSGS9H0008QG0R001Y9FB62), i.e. how Zeta + its tools get distributed
  beyond macOS/NixOS. Surface: otto-windows (PRs #6330, #6320).
- **cluster / infra (k8s + ArgoCD)** — **Milestone (operator-stated 2026-06-07):**
  **Kubernetes pods running on REAL HARDWARE now** (set up by **Max**) — the
  ArgoCD/k8s cluster end of the Ace external-state-closure stack (NixOS→Ace→ArgoCD)
  is live on physical metal, not just dev. Grounds the closure/infra arc on running
  infrastructure.

## Coordination discipline

Composes with [081KSNY2Z0008QG0R002QA720J](backlog/P1/081KSNY2Z0008QG0R001KT3CX9-1-interface-for-async-scatterbrains-operator-experience-desi.md)
(lanes-move-until-each-drains) and
[`agent-roster-reference-card.md`](../.claude/rules/agent-roster-reference-card.md)
(the surface registry). Split-brain guard:
[`claim-acquire-before-worktree-work.md`](../.claude/rules/claim-acquire-before-worktree-work.md).

## Temporary by design

Per operator (2026-06-01): _"until we get observe.ts all working then it won't be an
issue."_ Once the observe.ts loop coordinates lanes automatically (bus + claims +
the dashboard's mode-aware Rx views), this manual index is redundant — keep it
current until then, retire it after.

## Keeping it current

When a lane finishes / opens or a surface moves, edit the tables + per-lane sections
here. This is the one place to update so the operator's single-doc stays true; the
bus + open PRs remain the live source this points at.
