# Active work-streams — the one doc to remember all of it

**Purpose** (operator 2026-06-01): _"i just really need a single doc somewhere for
me to remember all of it."_ This is that doc — the cross-lane index of what is being
built, each lane pointing at its master row + the surface driving it. Distinct from
[`ROADMAP.md`](ROADMAP.md) (shipped features) and [`CURRENT-ROUND.md`](CURRENT-ROUND.md)
(round status): this is **who is building what, per lane.**

> **Map, not a queue.** Before working any item: `claim acquire` it (split-brain
> guard), respect lanes/surfaces, and check the live registry — **today** that is
> the claim-coordinator (`bun tools/bus/claim.ts check`) + open PRs; the git-native
> cross-machine bus (`docs/agent-bus/`) becomes the registry **once B-0954 populates
> it** (the folder is absent on main today). The claim-coordinator + PRs are
> authoritative now; the tables below are a dated, reconstructed hint.

## Two axes — don't conflate them

- **Work-lanes** = substrate areas (the _what_). These are the
  [B-0892](backlog/P1/B-0892-three-lanes-concurrent-operating-discipline-encryption-plus-zflash-plus-state-machine-substrate-until-each-lane-backlog-drains-per-operator-2026-05-28.md)
  standing "all lanes moving until each drains" discipline.
- **Surfaces** = agents (the _who_). Surface ownership is kept here per operator
  (2026-06-01: _"helps me remember who is doing what for now"_) until coordination
  is dynamic.

A surface can drive more than one lane; a lane can be driven by more than one
surface. The mapping below is the current snapshot, not a fixed 1:1.

## The lanes (snapshot 2026-06-01 — reconstructed; non-authoritative)

| Work-lane                                                  | Driving surface                     | Master row(s)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **workflow / state-machine → sovereign-DB / observe-loop** | otto-cli                            | [B-0959](backlog/P1/B-0959-zeta-sovereign-distributed-db-and-agent-loop-master-checklist-one-git-native-zset-substrate-aaron-otto-2026-05-31.md) + [B-0958](backlog/P1/B-0958-observe-ts-agent-loop-implementation-and-testing-checklist-closed-loop-toward-vendor-store-aaron-otto-2026-05-31.md)                                                                                                                                                                                                                     |
| **encryption**                                             | otto-cli (Otto-first, B-0885)       | [B-0883](backlog/P1/B-0883-better-gitcrypt-post-quantum-lattice-based-retraction-native-diff-readable-bouncy-castle-patterns-aaron-2026-05-28.md) + [B-0885](backlog/P1/B-0885-agent-private-encrypted-state-otto-first-then-other-ais-asap-aaron-2026-05-28.md)                                                                                                                                                                                                                                                       |
| **zflash USB-ISO hardware install**                        | vera-codex                          | [B-0891](backlog/P1/B-0891-zflash-done-acceptance-criteria-qemu-test-harness-5-scenarios-initial-format-cluster-up-reformat-with-retention-reformat-from-scratch-cluster-joining-aaron-2026-05-28.md) + [B-0844](backlog/P1/B-0844-zflash-agent-mode-native-implementation-close-doc-vs-implementation-gap-aaron-2026-05-26.md) + [B-0884](backlog/P1/B-0884-integrate-post-quantum-gitcrypt-with-zflash-usb-bound-credential-substrate-b-0852-b-0844-b-0737-aaron-2026-05-28.md)                                      |
| **git-accelerator**                                        | otto-cli (`accelerator/*` branches) | [B-0942](backlog/P2/B-0942-co-dominant-git-mirrors-git-native-crdt-coordination-no-host-needed-aaron-2026-05-30.md) + [B-0953](backlog/P2/B-0953-git-v2-handshake-fsharp-looks-like-git-negotiates-up-to-dbsp-retraction-algebra-same-objects-agent-speed-upstream-aaron-2026-05-31.md)                                                                                                                                                                                                                                |
| **Ace package-manager / distribution**                     | otto-windows                        | [B-0824](backlog/P1/B-0824-package-manager-of-package-managers-n-dimensional-dependency-space-holographic-projection-ai-rate-continuous-upstream-negotiation-aaron-2026-05-26.md) + [B-0863](backlog/P2/B-0863-ace-package-manager-one-liner-curl-install-repository-for-fast-moving-tools-hermes-agent-as-canonical-example-aaron-2026-05-27.md) + [B-0806](backlog/P2/B-0806-ansible-gitops-plus-crossplane-cross-os-declarative-management-for-windows-macs-non-nixos-linux-aaron-2026-05-26.md) (cross-OS/Windows) |

Operator 2026-06-01 confirmed these **five** lanes (each its own lane, including
git-accelerator and Ace-distribution). History note: B-0892's original three
(encryption + zflash + state-machine) was an earlier snapshot — "ace/windows was
not in there" referred to _that_ historical set; the **current** set is these five.
The **workflow / state-machine** lane **grew into the sovereign-DB arc**
(operator-confirmed) — lane 1 and the workflow-DU work are the same lane.

## Per-lane detail

- **workflow / state-machine → sovereign-DB / observe-loop** — the whole arc is in
  **B-0959**: one git-native Z-set substrate; the unbundled engine; algebra ladder
  (G-Set → Bag → Z-set); observe loop (B-0958); the git-native bus; distributed-time
  primitive; 4-language 4-oracle; dual-mode transport. Remember one handle: **B-0959**.
  **Possible future split** (operator 2026-06-01): this single lane may eventually
  split into (a) **workflow / DU creation per plugin** — github / gitlab / jira / …
  action grammars (the B-0867 workflow-engine side) — and (b) **distributed
  agent-home / intelligence-DB** — the encrypted-home + Z-set substrate side. One
  lane today; two later.
- **encryption** — better-git-crypt (post-quantum, retraction-native diff-readable,
  B-0883) + per-agent private encrypted state (Otto-first, B-0885). The "encrypted
  home" floor of the §0 topology.
- **zflash** — bare-metal install: done-acceptance + QEMU 5-scenario harness
  (B-0891), agent-mode native impl (B-0844), PQ git-crypt USB-bound creds (B-0884).
  In flight: PR #6220.
- **git-accelerator** — co-dominant git mirrors / git-native CRDT, no host needed
  (B-0942) + Git-V2 handshake (B-0953: F# looks-like-git, negotiates up to a
  DBSP/retraction protocol at agent-coordination speed). Live: `accelerator/pr-less-git-monster`.
- **Ace package-manager / distribution** — the n-dimensional dependency manager
  (B-0824) + the one-liner curl-install repo for fast-moving tools (B-0863) +
  cross-OS / Windows reach (B-0806), i.e. how Zeta + its tools get distributed
  beyond macOS/NixOS. Surface: otto-windows (PRs #6330, #6320).

## Coordination discipline

Composes with [B-0892](backlog/P1/B-0892-three-lanes-concurrent-operating-discipline-encryption-plus-zflash-plus-state-machine-substrate-until-each-lane-backlog-drains-per-operator-2026-05-28.md)
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
