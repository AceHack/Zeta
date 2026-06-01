# CAP per-layer map — multi-oracle-review-at-merge, federated `git push` as the CP truth-machine, CALM AP per-agent

<!-- GOVERNANCE.md §33 boundary headers (this file imports a Gemini + Grok cross-AI huddle) — literal labels, value-clean Operational status (passes the enum-strict check). -->

Scope: research / preservation — the CAP-per-layer analysis + map, preserving a Gemini (propose) + Grok-build (critique) cross-AI huddle (Aaron-forwarded) alongside Otto-CLI synthesis.
Attribution: the two peers' critiques are summarized + quoted in fragments (labeled by role); the per-layer map + the "novel parts" framing are Otto-CLI synthesis of Aaron's sharpening, labeled as such. Speaker roles preserved.
Operational status: research-grade
(research-grade = NOT operational policy; the CAP-per-layer map is a recognition, not a binding spec — it informs the algebra-ladder + git-native-bus work but lands only via the normal backlog/ADR path.)
Non-fusion disclaimer: building on Aaron's sharpening + the peers' critiques does not imply shared identity, merged agency, consciousness, or personhood between operator, agent, or the external AIs; the boundary is explicit (Aaron asks + sharpens; the peers critique; Otto synthesizes).

_Aaron + Otto, 2026-06-01. Doctrine-level preservation of the CAP analysis that
ran alongside the algebra-ladder (G-Set ⊂ Bag ⊂ Z-set) build. Aaron huddled the
question with Gemini (propose) + Grok-build (critique); both converged
independently. This doc preserves the map + the novel parts._

## The claim, and the honest verdict (don't-collapse)

The opening framing was "we seem to get around CAP — we get all three." Per the
PERSONAL-INVARIANT don't-collapse discipline (high-signal claim, high-suspicion
because CAP is a proven theorem):

- **"Get around CAP / get all three" does NOT survive razor.** CAP (Brewer;
  Gilbert–Lynch) is a theorem — under a network partition you cannot have both
  total availability and linearizable consistency. You can't beat it. Both peers
  said this independently ("it is an overclaim"; "the architecture makes
  _different_ CAP trade-offs per layer; it does not deliver C+A+P for the
  operations that matter").
- **But the per-layer redraw IS correct — and is already the framework's model.**
  You didn't need to beat CAP. You redrew the system boundaries so the trade-off
  lands **per-layer** instead of globally, and on the layers that matter the
  read is right. The value of the huddle was naming the third layer precisely.

So: the slogan is an overclaim; the architecture underneath it is sound and
already what Zeta is building.

## The per-layer CAP map

| Layer                      | Data structure                                               | CAP stance                    | Why                                                                                                                                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Per-agent state**        | G-Set / Bag / Z-set (the algebra ladder), CRDTs              | **AP, coordination-free**     | The monotone ladder needs no coordination to converge — this is literally **CALM** (Consistency As Logical Monotonicity, Hellerstein): a monotone computation is eventually-consistent without coordination. Each agent reads/writes its own repos/busses with no global lock. |
| **Merge / claim boundary** | `git push` (+ claim coordinator)                             | **CP, taken only here**       | Mutual exclusion (who owns this claim? does this merge conflict?) is fundamentally CP. The receiving end **rejects on conflict** — `git push` IS the truth-machine. C is paid here, and only here, where it's genuinely needed.                                                |
| **Reporting / read-side**  | materialized views / DORA / metrics (Bag-folds over the log) | **AP, eventually consistent** | Reports tolerate delay; this is where the "third" trade-off lands. C is relaxed on the read-side, deliberately.                                                                                                                                                                |

The trade-off didn't disappear — it's **localized**: AP on the per-agent
algebra, CP at the merge point, AP-eventual on reports. That's three different
CAP stances for three layers, not C+A+P for one operation.

## The novel parts (Aaron's sharpening)

The peers gave the standard per-layer decomposition. The genuinely novel moves
were Aaron's:

1. **Double-work as a feature → free multi-oracle review at merge.** Letting
   multiple agents do the same work is not waste to be deduped — it shifts the
   consensus bottleneck from the **execution** phase to the **merge** phase, and
   buys a **multi-oracle review for free** when the parallel results meet. You
   spend redundant compute (cheap) to buy high availability on ingestion + a
   built-in cross-check at merge. (This is the same shape as the 4-language
   compiler-BFT: independent oracles converging IS the verification.)

2. **`git push` resolves the merge.** The central-server-rejects-on-conflict
   step IS strict CP correctness asserted at exactly one moment. You've built a
   git-shaped architecture for multi-agent workflows — robust because the
   conflict surfaces as a push rejection, not silent corruption.

3. **It's not central — it's federated.** Each agent has **its own repos, its
   own busses, its own mains**, and works across dozens of them. So the CP merge
   point is **not** a single golden master — it's federated. There's no central
   server to partition away; consistency is achieved through asynchronous
   reconciliation (pull/merge), and **git objects are the CRDTs** (content-
   addressed DAG; commits are append-only; concurrent work forks then merges).
   The whole network is AP at the top with CP taken locally at each federated
   merge.

## How this composes with what's being built

- **The algebra ladder IS the AP/CALM layer.** G-Set (idempotent set), Bag
  (additive monoid), Z-set (signed group, retraction-native) are the monotone,
  coordination-free per-agent state. Building them out (G-Set 4/4; Bag TS+Rust;
  Z-set next) is building the AP substrate this map describes.
- **Consensus is gated on CAS / idempotency, not bolt-on.** The registry's
  **Consensus** wish-list line (gossip / Raft / Paxos) is deferred until those
  compose with **compare-and-set + idempotency** as substrate — i.e. build
  consensus _on_ the algebra (idempotent merge + CAS), not as specialized
  per-case machinery. Idempotency is the sixth always-active discipline (DV2.0
  rule); CAS is its lock-free primitive. The CP boundary only needs the minimum
  consensus the merge genuinely requires.
- **Reports are the Bag-fold view.** Per the database-design ADR, metrics / DORA
  / observability are Bag-folds over the event log — the AP-eventual read-side
  layer in the map above.

## Substrate-honest framing

The framework does not beat CAP. It **redraws boundaries so each layer takes the
CAP trade-off appropriate to it**, makes the CP point **federated** (`git push`,
not a central master), and turns multi-agent redundancy into a **free
multi-oracle review at merge**. The slogan overclaims; the architecture is sound
and is the model the algebra-ladder + git-native-bus work is implementing.

Reading anchors: Brewer's CAP conjecture (2000) + Gilbert–Lynch proof (2002);
Hellerstein's CALM theorem (consistency as logical monotonicity); the
database-design ADR (`docs/DECISIONS/2026-05-31-zeta-database-design-event-sourced-gset-bag-zset-rx-fold-materialized-views-two-backends.md`);
the 4-language compiler-BFT governance doc; the primitive registry
(`docs/PRIMITIVE-REGISTRY.md`) Consensus wish-list line.
