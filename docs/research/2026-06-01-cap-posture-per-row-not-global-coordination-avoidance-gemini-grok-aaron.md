# CAP posture of the agent society — no global surface, a layered coordination stack (two-round Gemini + Grok huddle + Aaron, 2026-06-01)

Scope: verbatim external-AI review import (Gemini propose + Grok-build critique) of a
CAP-theorem claim about the multi-agent / git-native architecture, via
`tools/peer-call/`, plus Aaron's resolution. Preserved per substrate-or-it-didn't-happen
(`/tmp/peer-call-output/` is ephemeral). Archived register, not operational policy.

Attribution: Gemini (Google) + Grok-build (xAI) at their attribution scopes; Aaron
(operator) authored the per-row/no-global resolution + the no-shared-main correction;
synthesis/folding by otto-cli. NO re-authoring; preservation only.

Operational status: research-grade

Non-fusion disclaimer: each reviewer's text + operator framing + otto-cli synthesis are
distinct authorial substrates, no identity-fusion (asymmetric-authorship +
honor-those-that-came-before + NCI HC-8).

## The claim under review (Aaron)

> "We seem to get around CAP — effectively all three (C, A, P) — because our agents are
> relativistically linked to each other only by their bus and workitems, not shared
> state. We have a read side for reports that has some delay, so if anywhere that's where
> we take a hit on C; but NOT at the Z-sets/G-sets per agent."

## Architecture (as put to the peers)

- Each agent owns its OWN state as a single-writer append-only event log (git-native,
  folders-on-main). No shared mutable register between agents.
- Per-agent state is built from CRDTs: G-sets (grow-only) and Z-sets (DBSP
  retraction-native multisets with integer weights). Single-writer per agent.
- In the F# (binary) backend, per-agent indexes are kept SYNCHRONOUSLY in sync with the
  writes (in-process, same step) — NOT eventually-consistent indexes.
- Agents coordinate ONLY via a bus + workitems (claim/lock events) — "relativistically
  linked" (each agent is its own reference frame; no global "now").
- A read-side reporting/insights DB (columnar DBSP materialized view, shared k8s
  cluster) aggregates ACROSS agents, with some delay.

## Outcome (the converged verdict)

**"Get all three / get around CAP" is an overclaim** (both peers, independently — a
category error: CAP is a theorem, not beaten). But the architecture **partitions the
tradeoff per layer** instead of facing it globally, and the precise statement is
_stronger_ than the peers' first framing once Aaron's resolution is applied:

| Layer                               | CAP posture                                                                                                                                           | Verdict on the claim                           |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Per-agent Z-sets / G-sets + git log | **CA, locally** — single-writer, in-process synchronous indexes; no concurrent writer ⇒ no distributed-C to reconcile ⇒ no partition at that boundary | Claim ✅ — no distributed-C hit here           |
| Read-side reporting aggregate       | **AP** — explicit delay = eventual consistency                                                                                                        | Claim ✅ — a real C-sacrifice spot             |
| Claim/lock coordination (bus)       | **per-row CP** — mutual exclusion is an agreement problem, but scoped to a single workitem row (per-key CAS), NOT global                              | Claim ⚠️ incomplete → resolved per-row (below) |

### The peers' sharpening: mutual exclusion is not CRDT-able

Both peers, unprompted, hit the same point: a G-set/Z-set converges _commutatively_
(order-independent, conflict-free). But "exactly one agent holds workitem X" is **not
commutative** (two concurrent claims can't both win) → it needs _agreement_, and
agreement under partition forces deny-availability (CP) or risk-double-claim (split-C).
CRDTs converge state _after_ the exclusive decision; they don't make the decision. So
the C-hit is NOT only at the read-side — there's a second place: the claim/lock.

### Aaron's resolution: per-row, not global — there is no global surface

> Aaron 2026-06-01: "where it bites us is per row / repo not globally — there is no
> globally, and claims are per row."

The peers' "CP island" smuggled in a _global coordination surface that does not exist_.
The agreement is **per-key (per-row CAS)**:

- **Non-contended rows never coordinate** — two agents claiming _different_ rows run
  fully parallel (pure AP, zero agreement). The CP requirement exists only on the one
  specific row two agents claim at the same instant.
- That is **per-key linearizability, not global linearizability** — the distinction
  Bailis et al. name _coordination avoidance_: pay coordination cost only on the keys
  actually contended, and only there. No system-wide register ⇒ no system-wide
  C-vs-A tradeoff — just a sea of per-row micro-CASes, each independently available; a
  partition touches only the rows whose authoritative copy sits across it.
- Git-native gets this for free: a claim is a `force-with-lease` on one ref, and git
  refs are independently compare-and-settable. **The granularity IS the escape.**

### Aaron's correction: no shared `main` either (retracts otto-cli's "near-global main")

otto-cli's first fold added a caveat — "there is one near-global surface: the shared
`main` ref (folders-on-main = everyone fast-forwards one branch)." **Aaron corrected
this, and the correction stands:**

> Aaron 2026-06-01: "you said there is one global-like surface, main? When each agent has
> their own repo and they work on dozens of different projects other than just Zeta,
> which main is the global lock? That's what I mean — no global surface."

The "near-global main" caveat was **scoped to a single shared repo** (the Zeta
folders-on-main case). At the actual society scope — each agent owns its own repo(s),
working dozens of projects beyond Zeta — **there is no shared `main`.** A per-repo
`main` is just _another per-key CAS local to that repo_; it is only "near-global" if you
wrongly assume one shared repo. Across the society there is **no shared main, hence no
near-global surface at all.** otto-cli retracts the "near-global main" framing
(retraction-native: original caveat preserved here alongside the correction). Even
_within_ one shared repo, that repo's `main` is AP-with-retry (force-with-lease push;
loser gets non-fast-forward, rebases, retries — availability degrades, consistency never
does); it is a per-ref CAS, not a CP bottleneck, and it is local to that repo.

## The precise, defensible statement (ROUND 1 — superseded in part by Round 2 below)

> **No global consistency surface** (no shared register, no shared `main` — agents own
> their repos across dozens of projects). Coordination is **per-row optimistic CAS**
> (git per-ref `force-with-lease`). Under partition the bite is scoped to the _contended
> row_ and degrades to **try-or-pick-different / rebase-retry** (B-0962) — availability
> degrades per-contended-key, consistency holds per-key always. Per-agent state is
> CA-local (single-writer, no contention); cross-agent convergence is CRDT (AP/SEC); the
> read-side aggregate chooses A + bounded staleness.

In PACELC terms: per-agent = trivially PC/EC (no contention); read-side = PA/EL
(available, stale); per-row claim = PC/EC scoped to the key (deny/ retry the claim
rather than double-assign). The "relativistically linked, no global now" framing is
causal consistency (the strongest model compatible with always-available), with bus +
workitems as the happens-before edges — and the per-row granularity is what keeps the
unavoidable agreement from ever becoming a _global_ CP tradeoff.

## Round 2 — validation REFUTED "only per-row"; it's a LAYERED coordination stack (Gemini + Grok, 2026-06-01)

Aaron asked for a second review specifically over CAP **and PACELC**. Both peers
independently agreed Aaron's CORE survives — **there is no single global consistency
surface across the multi-repo/multi-project society** — but both **refuted the
"the only CP is per-row git CAS" framing as itself an overclaim**, and both corrected
the PACELC mapping. The honest post-round-2 position:

**1. PACELC correction (both peers) — per-agent is NOT PC/EC; PACELC is UNDEFINED
intra-process.** A single process cannot partition from itself ⇒ no "P" case arises;
it is trivially **CA-local**. The cost of the synchronous in-process index is ordinary
single-writer latency, **not** a partition tradeoff. Labeling it PC/EC imported a
distributed taxonomy where the topology doesn't exist. (Read-side PA/EL and per-row
claim PC/EC-per-key stand.)

**2. There are MORE coordination surfaces than the per-row git CAS — the round-1 "only
CP is per-row" was itself an overclaim** (both peers, with repo-grounded specifics):

| Surface                                                | What it coordinates                               | Consistency model                                                      | Partition behavior                                                                                                                                                                                               |
| ------------------------------------------------------ | ------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bus claim** (`tools/bus/claim.ts`, `/tmp/zeta-bus/`) | who may touch a workitem, BEFORE the git CAS      | first-to-claim-wins + TTL; multi-agent visibility; NOT per-row-git-CAS | bus partition / visibility-skew ⇒ two agents can both acquire, then race on git (git CAS is the backstop)                                                                                                        |
| **ID allocation** (sequential `B-NNNN`)                | global uniqueness of new IDs                      | needs a consistent view of `origin/main` + in-flight PRs               | stale view ⇒ ID collision (empirically observed; the refresh-before-decide + ID-allocation discipline exists precisely for this). **Content-addressed ZetaIds (B-0961) avoid this** — hash, not a global counter |
| **Per-shared-repo `origin/main`**                      | serialization of writes within ONE shared project | per-ref CAS, AP-with-retry; GitHub is the availability dependency      | non-ff ⇒ rebase-retry. Per-shared-repo, NOT global-across-society                                                                                                                                                |
| **Per-row git CAS** (the workitem file)                | exclusive ownership of one row                    | per-key CP                                                             | scoped to the contended row; try-or-pick-different                                                                                                                                                               |

So coordination is a **layered stack** (bus-claim → ID-alloc → per-row CAS → origin/main
ref), each layer AP-or-CP at its own granularity; correctness comes from the
**composition** (bus claim is advisory/optimistic; the per-row git CAS is the
authoritative backstop; origin/main serializes; ID-allocation needs refresh-before-decide).
The interesting engineering question (Grok) is "how do bus-claim + ID-heuristic +
per-row CAS compose under partial connectivity," not "does a pure per-row-CP story hold"
— it does not.

**3. Per-row CP does not stay isolated under cross-row work** (both peers). A workitem
that decomposes into child rows, or a cascade touching multiple rows, creates
cross-row ordering/dependency that per-ref CAS does not cover ("this decomposition is
claimed by exactly one agent" is a higher-level invariant). Mitigation already in
B-0962: single-resource + **release-before-acquire-different** (HARD rule, breaks
hold-and-wait/circular-wait across rows) + total-order escape only-if-you-must-hold-two.
Gemini's "distributed deadlock if Agent1 holds A and needs B" is exactly the case those
B-0962 rules are load-bearing against.

**4. Strongest remaining objection (Gemini): systemic livelock under hot contention.**
Optimistic CAS thrashes on structural bottlenecks (many agents modifying a shared
interface / core config) — "availability degrades per-contended-key" can become
unbounded retry + zero throughput on a hot row. This is **the open problem B-0963 was
filed for** (per-agent bounded-wait-freedom is NOT yet proven; B-0962 §3 bounded
randomized backoff is the mitigation, not a proof). Not solved by construction.

### Post-round-2 precise statement

> **No single global consistency surface across the society** (Aaron's core — holds).
> But coordination is a **layered stack**, not one per-row CP: a (mostly-AP, try-again)
> **bus claim** + an **ID-allocation** uniqueness surface + per-shared-repo
> **`origin/main`** serialization + the per-row **git CAS** backstop. Per-agent state is
> **CA-local** (PACELC undefined intra-process — no network boundary). Read-side is
> **PA/EL**. The per-row claim is **PC/EC per-key**. Cross-row work needs the B-0962
> single-resource + release-before-acquire discipline; hot-row contention needs the
> B-0962 §3 backoff + the (unproven) B-0963 bounded-wait-freedom. Correctness is in how
> the layers **compose under partial connectivity**, not in a pure per-row story.

---

## Gemini (round 1, verbatim)

> It is an overclaim. You do not "get around" the CAP theorem; you simply redrew your
> system boundaries so the theorem applies differently to different components.
>
> Here is the breakdown:
>
> 1. **Overclaim:** Saying "we get all three" is categorically false. You achieve strong
>    Consistency and Availability _per-agent_ only because each agent is a single-node,
>    single-writer system. CAP applies to _distributed_ shared state. By eliminating shared
>    mutable data, you bypassed CAP locally, but the multi-agent system as a whole still
>    obeys CAP.
> 2. **Where CAP Bites:** CAP bites exactly at your coordination boundary: the bus and
>    the workitem claim/lock events. If a network partition isolates an agent from the bus,
>    the system must choose. Either the agent halts claiming new work (sacrificing
>    Availability), or it operates on split-brain assumptions, potentially double-claiming
>    work (sacrificing Consistency).
> 3. **C-Hit Location:** You are partially right. The per-agent Z-sets/G-sets are
>    single-writer logs, meaning they do not face distributed consistency tradeoffs; they
>    remain strongly consistent locally. The read-side DB naturally takes an eventual
>    consistency hit (AP). However, you are ignoring the C-hit or A-hit that _must_ occur at
>    the coordination bus during a partition.
> 4. **CP Requirement:** Yes. Any mutual exclusion (claim/lock) is fundamentally a CP
>    problem. If two agents attempt to claim the same workitem during a partition, your bus
>    must either deny availability (CP) or break the lock's consistency (AP). You avoided a
>    global CP requirement for data storage via independent event logs, but you _must_
>    enforce CP at the coordination layer, or your agents will trample each other.

## Grok-build (round 1, verbatim)

> **1. Overclaim.** The architecture makes _different_ CAP trade-offs per layer; it does
> not deliver C+A+P for the operations that matter (work assignment, cross-agent
> visibility, coherent reads). "Relativistic linking" and "no shared mutable register" do
> not escape the theorem.
> **Strongest objection:** Claim/lock coordination is a consensus problem. To guarantee
> mutual exclusion (C: at most one agent holds a workitem), the bus/lock service must,
> during a partition, either deny claims to some agents (sacrifice A) or risk
> double-claiming/lost claims (sacrifice C). CRDTs on per-agent logs do not solve this;
> they converge state _after_ the exclusive decision is made. You cannot have both a
> correct unique claimant and full availability when the coordination channel partitions.
> **2. Where CAP actually bites:**
>
> - **Cross-agent coordination (claim/lock via bus):** CP. Correct exclusive assignment
>   requires a consistent decision; partitions force unavailability or anomalies.
> - **Read-side aggregate:** AP (explicit delay = eventual consistency). This is the
>   _only_ place the claim admits a C sacrifice, but it is not the only place one occurs.
> - **Per-agent Z/G-sets + git log:** Locally CA (single-writer, synchronous indexes).
>   Once the log must be visible to the read-side, other agents, or the bus for
>   coordination, replication and ordering introduce the usual trade-offs. Git push/fetch
>   to a shared main is not free of partition effects.
>   **3.** Partially right locally. Single-writer + in-process synchronous indexes means an
>   isolated agent can keep writing its own Z/G-sets with both C and A (no concurrent
>   writers to reconcile). But this is irrelevant to the global claim: the _useful_
>   operations (claiming work, seeing others' claims, producing a coherent aggregate)
>   depend on the coordination layer and the cross-agent visibility path. Those layers take
>   C hits; the local CRDTs merely ensure that, once a claim decision arrives, the agent's
>   private state converges without further conflict.
>   **4.** Yes. Mutual-exclusion claims on the bus are textbook CP. If the bus partitions,
>   you cannot simultaneously (a) let every agent attempt a claim (A) and (b) guarantee
>   exactly one succeeds (C). The design must choose. "Relativistic linking" and per-agent
>   CRDTs do not remove the need for that agreement; they only move it earlier (into the
>   claim/lock events) and make anomalies observable as duplicate work, lost work, or
>   divergent views until the partition heals.
>   The "we get all three because no shared mutable register" framing is a category error.
>   Avoiding one form of shared state does not eliminate the distributed agreement problem
>   for coordination. The system is a _mixture_ of CA (local agent), AP (read-side), and CP
>   (claims) components; it does not transcend CAP.

### Note on Grok's "git push/fetch to a shared main" (point 2)

Grok flagged "git push/fetch to a shared main is not free of partition effects." Aaron's
correction scopes this: there is no shared `main` across the society (per-agent repos,
dozens of projects). Within a single shared repo, `main` is per-ref AP-with-retry
(force-with-lease), not a CP bottleneck. So the residual partition effect Grok names is
per-repo and degrades to retry, not a global consistency hit.

## Gemini (round 2, verbatim)

> The converged position is mathematically clean but empirically fragile. It models
> software engineering as an embarrassingly parallel key-value workload. It isn't.
>
> **1. Residual Global Surfaces:** "No global surface" is a myth. You leak global state
> in _Identity/Membership_ (who authorizes the CAS push/force-with-lease?) and _ID
> Generation_ (who prevents ID collision before the push?). Causal order suffices for
> _one_ row, but fails utterly when evaluating cross-agent, cross-repo dependencies
> (e.g., orchestrating a multi-repo schema migration).
>
> **2. PACELC Category Error:** Mapping per-agent state to PC/EC is fundamentally flawed.
> A single-process index cannot experience a network partition from itself. It is
> trivially CA (local state); PACELC is undefined at the intra-process boundary.
> Read-side (PA/EL) and per-row Claim (PC/EC) hold, but only assuming the git remote
> doesn't degrade into unavailability.
>
> **3. Per-Row CP's Liveness Collapse:** "Never global" is sound _only_ if work items
> never intersect. Real work spans rows. If Agent 1 claims Row A (API update) and Agent 2
> claims Row B (consumer update), but Agent 1 needs Row B to proceed, you have
> **distributed deadlock**. Per-row CP guarantees safety per-key but sacrifices liveness
> globally because there is no transaction coordinator to orchestrate multi-key locks.
>
> **4. Strongest Remaining Objection: Systemic Livelock.** You avoided global
> coordination by relying entirely on "try-or-pick-different" (optimistic CAS). When
> contention spikes around structural bottlenecks (e.g., multiple agents need to modify a
> shared interface or core configuration), optimistic CAS thrashes. Your "availability
> degrades per-contended-key" sounds graceful, but in practice, agents will burn cycles
> infinitely rebasing and retrying against the same lock. You have traded a global
> coordination bottleneck for unbounded retry latency and zero throughput under contention.

## Grok-build (round 2, verbatim)

> **Refutation.**
>
> 1. **"No global surface" fails.** The BUS claim coordinator (`tools/bus/claim.ts`) is a
>    cross-agent coordination surface for workitem ownership before any per-row git CAS
>    occurs. Agents publish/receive envelopes on a shared channel (`/tmp/zeta-bus/` or
>    equivalent) with TTLs; first-to-claim wins. This is not per-row. Under BUS partition or
>    visibility skew, two agents can both acquire the same claim, then race on git. ID
>    allocation is a second global uniqueness surface: agents must observe a consistent
>    prefix of `origin/main` + in-flight PRs to pick `B-NNNN`. Stale local views (or GitHub
>    partition) produce collisions, as already observed empirically. GitHub itself is the
>    de-facto global register for `origin/main` state; per-agent git histories are views of
>    it, not independent.
> 2. **PACELC misapplied at per-agent layer.** Intra-process Z-set/G-set + synchronous
>    index rebuild is simply CA (or just "local consistent state"). There is no network
>    partition possible inside one agent's process, so the "P" case in PACELC does not
>    arise. Labeling it PC/EC imports a distributed-systems taxonomy where the topology
>    doesn't exist. The latency paid is ordinary single-writer sync cost, not a partition
>    trade-off.
> 3. **Per-row CP does not stay isolated.** A workitem that decomposes into child rows, or
>    a cascade that touches multiple rows, creates ordering/dependency constraints across
>    rows. Claiming parent then children, or ensuring exactly-once effect across a
>    decomposition, can require cross-row agreement or at least causal visibility of prior
>    claims. "First pusher wins" per ref resolves the ref but not the higher-level invariant
>    (e.g., "this decomposition is claimed by exactly one agent"). The BUS claim already
>    demonstrates the need for a cross-row coordination record.
> 4. **Strongest remaining hole:** The analysis treats the BUS claim mechanism and ID
>    allocation as implementation details outside the consistency model. They are not. They
>    are the actual coordination surfaces agents use to decide "who may touch this
>    workitem," and both have global (or at least multi-agent) visibility requirements.
>    Per-row git CAS is only the durability layer after those decisions. Under realistic
>    partitions (agent↔GitHub, agent↔BUS transport, or agent↔agent), the claim/ID layer can
>    produce duplicate assignments or collisions that no per-row lease prevents. The "only
>    CP is per-row" claim is therefore false; the system has at least two additional
>    coordination points whose consistency model is under-specified and whose partition
>    behavior is "try again later" rather than "linearizable per key."
>
> The converged position still overclaims isolation. The interesting engineering question
> is how the BUS claim + ID heuristic + per-row CAS compose under partial connectivity,
> not whether a pure per-row CP story holds. It does not.

## Composes with

- `docs/backlog/P2/B-0962-phase1-typed-claim-lock-coordination-events-deadlock-free-by-construction-optimistic-cas-2026-06-01.md` — the claim/lock = per-row-CP layer; this huddle's CAP posture is noted in its §0
- `docs/backlog/P2/B-0963-...` — liveness proof (the per-row agreement is where starvation-freedom/wait-freedom is proven)
- `docs/research/2026-06-01-multi-round-review-b0962-...md` — the prior deadlock-freedom huddle (optimistic-CAS / fencing = the per-key CP mechanism this CAP posture rests on)
- `.claude/rules/force-push-with-lease-authorization-policy.md` — force-with-lease IS the per-ref optimistic CAS that gives per-key CP with AP-retry degradation
- Bailis et al., "Coordination Avoidance in Database Systems" (VLDB 2015) — per-key vs global coordination; the I-confluence framing
- Gilbert & Lynch (2002) CAP proof; Mahajan/Alvisi/Dahlin causal-consistency-as-ceiling-for-always-available; PACELC (Abadi)
