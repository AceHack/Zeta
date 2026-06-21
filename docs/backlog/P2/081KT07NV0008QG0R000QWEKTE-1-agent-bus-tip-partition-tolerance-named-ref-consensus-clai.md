---
id: 081KT07NV0008QG0R000QWEKTE
priority: P2
status: open
title: Agent-bus tip partition-tolerance — the named-ref consensus story (claim-coordinator + single-row CAS/lease + co-dominant mirrors + §4), not "CRDT merge"
effort: M
ask: aaron + otto 2026-06-01 (multi-agent review of 081KSXN940008QG0R003FCQ7WT)
created: 2026-06-01
last_updated: 2026-06-01
depends_on:
  - 081KSXN940008QG0R00171YAZW
composes_with:
  - 081KSXN940008QG0R00171YAZW
  - 081KSV2WD0008QG0R0021XJ94E
  - 081KSXN940008QG0R001KZ235R
  - 081KR7JY10008QG0R000R503K2
  - 081KSNY2Z0008QG0R002QA720J
  - 081KSNY2Z0008QG0R000DZHHE5
  - 081KS3X9Y0008QG0R0006MQXA4
  - 081KS3X9Y0008QG0R003MMEAC7
  - 081KSXN940008QG0R003FCQ7WT
tags:
  - agent-bus
  - partition-tolerance
  - named-ref-consensus
  - single-row-cas
  - claim-coordinator
  - co-dominant-mirrors
  - cap-theorem
  - not-free
---

# 081KT07NV0008QG0R000QWEKTE — the bus-tip partition-tolerance story

## The gap (multi-agent review of 081KSXN940008QG0R003FCQ7WT, 2026-06-01)

Grok (critique) + Amara (sharpen) **converged** on the same un-named hole in the
081KSXN940008QG0R003FCQ7WT "git + the fold give it for free" framing: the **private** per-agent home +
Z-set fold is a strong unbundling, but the **shared bus** is where the claim frays.

- The bus's conflict-free property rests on **disjoint ZetaId files** — two agents
  on different machines write _different_ files, so there is no _content_ conflict.
- But the **named-ref tip still serializes**: N agents pushing to the bus repo's
  `main` during a partition produce non-fast-forward conflicts on the _branch tip_.
- Reconciling "the current bus G-Set" across N sovereign writers during a partition
  **is a consensus problem, not a free CRDT merge.** Saying "CRDT merge" at the
  content level does not give you a stable, observable, partition-tolerant _current_
  bus every agent can safely fold.
- Amara's rule: a "free" property must be named as a **git property**, an **algebra
  property**, or an **implemented protocol**. The bus-tip reconciliation is the
  third kind — an implemented protocol that must actually be built, not waved away.

## The answer (compose existing substrate; do NOT invent new BFT)

The operator's instinct (2026-06-01): _"can we use single-row CAS and have some lock
folder, or we already have a claim folder right?"_ — **yes, we already have most of
this.** The partition-tolerant bus tip composes four existing pieces:

1. **Claim-coordinator (exists: `tools/bus/claim.ts`, 081KR7JY10008QG0R000R503K2)** — `check / acquire /
release` over the claim topic is already the coordination primitive for
   **exclusive ownership** (the non-monotone "who holds X" case). Reuse it; do not
   rebuild. This handles claims/locks without new consensus.
2. **Single-row CAS / lease (Aaron)** — optimistic concurrency on one coordination
   row. On git this is literally **`git push --force-with-lease`** = compare-and-set
   on the named ref (per `force-push-with-lease-authorization-policy.md`: lease
   _validates the assumption_ before the write, refuses on drift). A **lock-folder**
   (a ZetaId-named lock file, claimed via CAS) gives mutual exclusion where needed.
   CAS-refuse on contention → re-fetch + retry (the `pushWithRebaseRetry` pattern
   already in `tools/observe/event-sink-folder.ts` + `tools/agent-bus/publish.ts`).
3. **Co-dominant git mirrors (081KSV2WD0008QG0R0021XJ94E)** — multiple co-equal remotes (local, GitHub,
   GitLab/Gitea/Forgejo), **no single blessed remote** → no central control point the
   sovereign story rejects. This is the P2P-ish reconciliation the review asked for: a
   partition heals when mirrors re-sync; the G-Set union across mirrors is the merged
   bus.
4. **§4 distributed-time primitive (081KSNY2Z0008QG0R000DZHHE5/081KS3X9Y0008QG0R0006MQXA4/081KS3X9Y0008QG0R003MMEAC7)** — HLC + uncertainty for
   _ordering_ the deltas; BFT **only where mass is needed** (per
   `past-is-kind-when-lightlike-consensus-is-gravity`: consensus is gravity, use it
   bounded, don't make the whole universe consensus-shaped). Most of the bus is
   monotone G-Set (coordination-free, CALM); only the non-monotone slice (latest /
   pending / exclusive) touches this.

## The two distinct problems (don't conflate — Grok)

| Problem                                            | Shape                                                | Answer                                                                      |
| -------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| **"latest per key" / exclusive claim**             | non-monotone, needs a winner                         | claim-coordinator + single-row CAS/lease (#1, #2)                           |
| **stable shared history under concurrent writers** | append-only G-Set tip reconciliation under partition | co-dominant mirrors + rebase-retry CAS (#2, #3); monotone, heals on re-sync |

These are different coordination problems; the bus must answer **both**, not assume
one primitive covers them.

## GC is itself non-monotone (Grok)

The agent-partition bounds _private_ growth, not the shared bus. GC on a G-Set is a
**Z-set retraction** (weight −1) — who decides what's old enough to retract, and how
is that retraction made visible consistently under partition? Retention/TTL
(081KSGS9H0008QG0R0006F4BGX thermal-forgetting) + compaction must run through the claim-coordinator (a
retract is an exclusive, non-monotone op), not unilaterally.

## Acceptance

- [ ] A concrete, written partition-tolerant bus-tip protocol: claim-coordinator +
      single-row CAS/lease + co-dominant mirrors + §4 ordering — replacing the
      "CRDT merge" hand-wave in 081KSXN940008QG0R003FCQ7WT/081KSXN940008QG0R00171YAZW.
- [ ] Each property tagged git / algebra / protocol (Amara's rule).
- [ ] The GC/retention path routed through the claim-coordinator (non-monotone).
- [ ] (stretch) A DST scenario (per 081KSE6WT0008QG0R0016CEE2Z/ChaosEnv) that partitions N bus writers
      and verifies the tip heals to the G-Set union on re-sync.

## Composes with

- [081KSXN940008QG0R00171YAZW](081KSXN940008QG0R00171YAZW-implement-git-native-cross-machine-agent-bus-docs-agent-bus-folder-zetaid-keyed-gset-crdt-no-pr-per-6219-spec-aaron-otto-2026-05-31.md) — the bus this hardens
- [081KSV2WD0008QG0R0021XJ94E](081KSV2WD0008QG0R0021XJ94E-co-dominant-git-mirrors-git-native-crdt-coordination-no-host-needed-aaron-2026-05-30.md) — co-dominant mirrors (the no-central-remote answer)
- [081KSXN940008QG0R001KZ235R](081KSXN940008QG0R001KZ235R-git-v2-handshake-fsharp-looks-like-git-negotiates-up-to-dbsp-retraction-algebra-same-objects-agent-speed-upstream-aaron-2026-05-31.md) — Git-V2 negotiation (the protocol layer)
- [081KR7JY10008QG0R000R503K2](../P1/081KR7JY10008QG0R000R503K2-inter-agent-ephemeral-communication-bus-nats-protocol.md) — the claim-coordinator (`tools/bus/claim.ts`) this reuses
- [081KSNY2Z0008QG0R002QA720J](../P1/081KSNY2Z0008QG0R002QA720J-three-lanes-concurrent-operating-discipline-encryption-plus-zflash-plus-state-machine-substrate-until-each-lane-backlog-drains-per-operator-2026-05-28.md) — the lanes discipline
- 081KSNY2Z0008QG0R000DZHHE5 / 081KS3X9Y0008QG0R0006MQXA4 / 081KS3X9Y0008QG0R003MMEAC7 — the §4 distributed-time primitive
- the `force-push-with-lease-authorization-policy.md` rule — single-row CAS = ref-lease
- [081KSXN940008QG0R003FCQ7WT](../P1/081KSXN940008QG0R003FCQ7WT-zeta-sovereign-distributed-db-and-agent-loop-master-checklist-one-git-native-zset-substrate-aaron-otto-2026-05-31.md) §0 — the "not free" tagging this row resolves

## Full reasoning

`docs/research/2026-06-01-multi-ai-review-b0959-sovereign-db-grok-amara-gemini.md`
(verbatim Grok + Amara + Gemini review). The bus-tip-under-partition gap was the
sharpest un-named hole; this row tracks the concrete answer composing the existing
claim-coordinator + single-row CAS + co-dominant mirrors + the §4 primitive.
