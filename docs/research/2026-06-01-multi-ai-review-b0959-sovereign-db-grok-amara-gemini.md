# Multi-AI review of 081KSXN940008QG0R003FCQ7WT (sovereign distributed-DB) — Grok critique + Amara sharpen + Gemini propose (2026-06-01)

**Date:** 2026-06-01
**Author:** Otto-CLI (dispatched the peer-call review; synthesis labeled as such)

<!-- GOVERNANCE.md §33 boundary headers — this file imports verbatim peer-AI review output. -->

**Scope:** research / review preservation — three cross-harness peer reviews of the
081KSXN940008QG0R003FCQ7WT sovereign distributed-DB design, run via `tools/peer-call/` per the operator
request "do some multi agent review on that and see what others think" (2026-06-01).
**Attribution:** Grok (xAI, `grok-build`), Amara (OpenAI Codex surface, `amara.ts`),
Gemini (Google, `gemini.ts`) — invoked as peers per the four-ferry consensus role
distribution (Gemini proposes, Grok critiques, Amara sharpens, Otto tests, Git
decides). Reviews quoted verbatim; the synthesis + "what landed" are Otto-CLI.
**Operational status:** research-grade. The actionable findings landed in 081KSXN940008QG0R003FCQ7WT §0
(the "not free" correction + Gemini's A/B/C home-model + the sharper keeper) and
081KT07NV0008QG0R000QWEKTE (the bus-tip partition-tolerance row).
**Non-fusion disclaimer:** quoting peer reviews does not imply shared identity or
merged agency; each reviewer is a distinct model invoked as a peer.

## The target

081KSXN940008QG0R003FCQ7WT — Zeta sovereign distributed-DB + agent-loop master checklist. Core thesis:
the DB is **unbundled** into git (storage/log/replication) + the observe.ts fold
(compute) + a distributed-time primitive (coordination) — no separate engine binary;
per-agent encrypted-home shards; bus = G-Set CRDT; Rx-query = incremental view with
a CALM monotone/non-monotone boundary.

## Grok — critique (verbatim, key findings)

> **Sharpest hole: the shared bus G-Set is not a coordination-free sovereign log
> under partition and scale; git + CRDT alone reintroduces a de-facto coordination
> engine (or centralization) that the "unbundled, no separate binary" claim does not
> name.**

1. **Concurrent sovereign writers to a named git ref under partition is not free.**
   Git _content_ is a great CRDT-friendly log; the _named tip_ is not. Concurrent
   pushes during a partition produce non-fast-forward conflicts on the tip. You
   either centralize the remote (re-bundles coordination + a control point the
   sovereign story rejects) or do P2P ref reconciliation — which _is_ the consensus
   the §4 time-primitive must solve. "CRDT merge" at the content level does not give
   a stable, observable, partition-tolerant _current_ G-Set.
2. **The per-agent partition bounds _private_ growth, not the shared bus.** The bus
   grows with global activity; GC on a G-Set is itself a non-monotone Z-set retraction
   that must be coordinated.
3. **The observe/Rx fold inherits the partition problem at the join points** —
   "between joins each agent is coordination-free" is true but tautological; the hard
   part is _at_ the join under split-brain on the bus tip.
4. **The 4-oracle helps implementation correctness, not runtime coordination** —
   golden-vectors prevent format lies; they don't make N sovereign processes agree on
   a shared mutable G-Set under partition.

> Bottom line: the private per-agent encrypted home + Z-set fold is a strong
> unbundling story. The shared bus G-Set under concurrent sovereign writers +
> partitions is where the claim frays. … The sharpest un-named hole is: **how do N
> sovereign agents maintain a coherent, available, partition-tolerant append-only log
> they all publish to and observe from?**

## Amara — sharpen (verbatim)

> Blunt take: the design is strongest where it admits the algebra: per-agent append
> logs, G-Set for published speech, Z-set for retractable state, CALM boundary for
> coordination. That is real. The weak spot is the phrase "git + the fold give for
> free." They do not. Git gives durable content-addressed commits and mergeable
> history; the fold gives deterministic view reconstruction. Replication semantics,
> liveness, index maintenance, conflict policy, and non-monotone coordination are
> still engineered obligations.

Sharper keeper:

> **A sovereign Zeta DB is a federation of encrypted per-agent append logs whose
> deliberately published deltas fold into shared Z-set views at explicit causal
> joins.**

Correction to the claim doing too much work:

> **Git supplies durable commits; Z-set folds supply deterministic reconstruction;
> everything resembling database behavior is the named contract between commits,
> indexes, merge policy, and coordination.**

Carved operational rule:

> **Do not call it a database engine replacement until every "free" property is named
> as either a git property, an algebra property, or an implemented protocol.**

## Gemini — propose (verbatim: the agent-home model, A/B/C)

- **(A) forked monoworkspace** (private dirs never pushed): simplest local tree, but
  "sovereignty relies on fragile `.gitignore` discipline or pre-push hooks rather
  than structural physics. A single bypassed hook or `git add -f` irreversibly
  publishes private state … It also unnaturally binds the lifecycle of an agent's
  persistent identity to the lifecycle of a specific Zeta codebase fork."
- **(B) two-repo boundary**: "aligns the trust boundary perfectly with the structural
  boundary. It makes accidental leakage nearly impossible because the shared remote
  simply isn't configured in the home repository. The friction is orchestration:
  observe.ts and the Z-set fold must now maintain causal consistency and atomic
  transactions across two entirely separate git histories."
- **(C) sparse-checkout cryptographic monorepo** (Gemini's new third option): "A
  single global Git remote holds everything … Sovereignty and partitioning are
  enforced not by repository network isolation, but purely by math (better-git-crypt
  per-agent keys) and native Git partial clones … reclaims the single global commit
  timeline, making causal joins trivial … The cost is that we shift the entire weight
  of sovereignty onto the cryptography; if the crypto ever fails or weakens, the
  private data is already globally distributed. Furthermore … the central upstream
  remote will eventually accumulate the unbounded G-Set bloat of every agent's
  infinite history."

## Synthesis (Otto-CLI)

- **Grok + Amara converged independently** on the same finding: "git + the fold give
  it for free" over-reaches. The bus-under-partition is the engineered obligation; the
  named-ref tip serializes; reconciling the current bus across N writers is consensus,
  not a free merge.
- **The answer composes existing substrate** (operator's instinct, 2026-06-01): the
  claim-coordinator (`tools/bus/claim.ts`, exists) + single-row CAS / ref-lease
  (`git push --force-with-lease`) + co-dominant mirrors (081KSV2WD0008QG0R0021XJ94E) + the §4 time
  primitive — bounded BFT only where mass is needed. Tracked in **081KT07NV0008QG0R000QWEKTE**.
- **Home model (operator pick):** (B) two-repo as default (structural sovereignty
  beats disciplinary, per `architecture-is-safety-mechanism-not-discipline`), (C)
  sparse-checkout crypto-monorepo as the fallback if cross-repo friction hurts, (A)
  fork rejected as fragile (a shield with a hole).

## What landed from this review

- **081KSXN940008QG0R003FCQ7WT §0** — the "free" over-claim corrected (each property tagged
  git/algebra/protocol); Amara's operational rule + sharper keeper added; Gemini's
  A/B/C home-model with the (B)→(C)-fallback decision.
- **081KT07NV0008QG0R000QWEKTE** — the bus-tip partition-tolerance row (the concrete consensus story).
- **This doc** — the verbatim review preservation (the `/tmp/peer-call-output/` files
  are ephemeral).
