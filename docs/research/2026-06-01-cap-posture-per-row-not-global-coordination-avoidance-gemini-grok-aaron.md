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
> row_ and degrades to **try-or-pick-different / rebase-retry** (081KT07NV0008QG0R002KWQS05) — availability
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
| **ID allocation** (sequential `B-NNNN`)                | global uniqueness of new IDs                      | needs a consistent view of `origin/main` + in-flight PRs               | stale view ⇒ ID collision (empirically observed; the refresh-before-decide + ID-allocation discipline exists precisely for this). **Content-addressed ZetaIds (081KSXN940008QG0R000JZVFXX) avoid this** — hash, not a global counter |
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
081KT07NV0008QG0R002KWQS05: single-resource + **release-before-acquire-different** (HARD rule, breaks
hold-and-wait/circular-wait across rows) + total-order escape only-if-you-must-hold-two.
Gemini's "distributed deadlock if Agent1 holds A and needs B" is exactly the case those
081KT07NV0008QG0R002KWQS05 rules are load-bearing against.

**4. Strongest remaining objection (Gemini): systemic livelock under hot contention.**
Optimistic CAS thrashes on structural bottlenecks (many agents modifying a shared
interface / core config) — "availability degrades per-contended-key" can become
unbounded retry + zero throughput on a hot row. This is **the open problem 081KT07NV0008QG0R001N9GJWX was
filed for** (per-agent bounded-wait-freedom is NOT yet proven; 081KT07NV0008QG0R002KWQS05 §3 bounded
randomized backoff is the mitigation, not a proof). Not solved by construction.

### Post-round-2 precise statement

> **No single global consistency surface across the society** (Aaron's core — holds).
> But coordination is a **layered stack**, not one per-row CP: a (mostly-AP, try-again)
> **bus claim** + an **ID-allocation** uniqueness surface + per-shared-repo
> **`origin/main`** serialization + the per-row **git CAS** backstop. Per-agent state is
> **CA-local** (PACELC undefined intra-process — no network boundary). Read-side is
> **PA/EL**. The per-row claim is **PC/EC per-key**. Cross-row work needs the 081KT07NV0008QG0R002KWQS05
> single-resource + release-before-acquire discipline; hot-row contention needs the
> 081KT07NV0008QG0R002KWQS05 §3 backoff + the (unproven) 081KT07NV0008QG0R001N9GJWX bounded-wait-freedom. Correctness is in how
> the layers **compose under partial connectivity**, not in a pure per-row story.

## Round 3 — Aaron's resolution: the round-2 pessimism resolves (2026-06-01)

Aaron answered the round-2 findings, and each resolves rather than disputes — the net is
**stronger** than round 2 concluded. (Authored by Aaron; not a new peer huddle.)

**R2-finding 1 (PACELC undefined intra-process) → RESOLVED: PACELC applies; per-agent is
PC/EC.** Round 2 assumed a single in-process copy. It isn't: a safe agent is
**geo-replicated** (F# deterministic DB _or_ CockroachDB) — a single unreplicated copy
would be unsafe. That replication IS the network boundary, so PACELC applies. Single-writer
⇒ no write-_conflict_, but the replica set still chooses L-vs-C / C-vs-A → **PC/EC**
(CockroachDB Raft-per-range + FoundationDB-style single-thread both favor consistency,
sacrifice the partitioned-minority replica's availability). Aaron 2026-06-01: _"agents
will have replicas geographically not just one — that would be unsafe."_

**R2-finding 2 (claim/lock is a problematic CP island; distributed-deadlock; systemic
livelock) → RESOLVED: the bus is BEST-EFFORT AP, not CP — mutual exclusion is NOT
required.** Both peers assumed "exactly one agent holds X" is a correctness invariant
(→ CP). Aaron: it is not. Double-claim is fine, even valuable. Aaron 2026-06-01:

> "Bus can be optimistic and even start working on the same problem. If both agents
> do the same backlog, they use the two PRs to verify each other's work — they rejoin
> main from their branches and see each other's PRs, or one finishes first and the
> second sees it. It's deterministic in its ending. They don't have to lock; best-effort
> is fine and move forward."

So: redundant work = a free **2-oracle cross-check**, and determinism guarantees
**convergence at main** ("git decides"). With no required mutual exclusion there is no
lock to contend ⇒ **the distributed-deadlock and systemic-livelock objections do not
bite** (they only bite if you require at-most-once). The would-be-CP-coordination-cost
becomes verification value — the same move as the 4-oracle golden-vectors (redundancy
IS the correctness mechanism, not waste).

**Boundary (don't-collapse):** this holds for **deterministic / idempotent / convergent**
work (code, docs, backlog — the majority). **Non-idempotent side-effects** (money,
provisioning, external charges) still need true mutual exclusion. That is exactly
**081KT07NV0008QG0R002KWQS05's two-primitive split**: **Claim** = cooperative best-effort AP (default;
redundancy-as-verification); **Lock** = hard CAS+fencing **CP**, reserved for the gated
non-idempotent class (081KSNY2Z0008QG0R0036SJ3T1 banker-bot territory). Aaron's point doesn't contradict
081KT07NV0008QG0R002KWQS05 — it explains _why it has two primitives_.

**R2-finding (ID allocation is a global uniqueness surface) → RESOLVED: being removed.**
Sequential `B-NNNN` was a stopgap; **ZetaId (128-bit, already implemented** — 081KSKBP80008QG0R001KK9WV6 v1
"128-bit observation ID", 081KSNY2Z0008QG0R000V24M7E v2 structured encoding, `registry/categories.yaml`) is
content/structure-addressed ⇒ no global allocator ⇒ no coordination surface. Conversion
is on the main checklist / workstreams (in progress before this discussion). Aaron
2026-06-01: _"seq backlog id is stupid and was a stopgap — we were literally running the
backlog to convert this."_

**R2 (per-shared-repo `origin/main` = per-ref CAS) → CONFIRMED** by Aaron ("per ref cas
yes agree"): AP-with-retry, per-repo, not global.

### Final precise statement (post Round 3)

> **No global consistency surface** across the multi-repo/multi-project society (Aaron's
> core — holds). Per-agent state is **geo-replicated PC/EC** (single-writer; replication
> chooses consistency; PACELC applies — CockroachDB/FoundationDB-class). Read-side
> aggregate is **AP** (bounded staleness). The **Claim** layer is **best-effort AP** —
> double-work is tolerated as redundancy-as-verification + deterministic convergence at
> main, so it is NOT a CP requirement and carries no deadlock/livelock for deterministic
> work. The only genuine **CP** islands are (a) per-agent replication (chosen-C) and
> (b) the **Lock** primitive for the gated non-idempotent (money) class. ID allocation is
> being removed as a coordination surface (ZetaId 128-bit). `origin/main` is per-ref CAS,
> AP-with-retry, per-repo. PACELC: per-agent PC/EC; read-side PA/EL; Lock PC/EC-per-key;
> Claim PA/EL (best-effort).

## Round 4 — Amara concurrence + the clean canonical form (2026-06-01)

A third reviewer (Amara) **agreed with the Round-3 analysis** and gave the tightest
canonical framing + one sharpening: **the bus claim is an advisory coordination signal,
not the source of truth** (the source of truth is the eventual committed
observation/action/result). Amara verbatim:

> Yes — I agree with the **final Round 3 analysis**, with one tightening:
>
> > You are not "getting around CAP."
> > You are making CAP show up only where the operation actually needs agreement.
>
> That is the right frame. The strongest correction is that **Claim is not Lock**.
>
> ```text
> Claim = best-effort AP
> Lock  = CP / fenced / for non-idempotent danger
> ```
>
> For normal deterministic work — docs, code, backlog rows, reviews — two agents doing
> the same item is not catastrophic. It can become useful redundancy:
>
> ```text
> Agent A works item X
> Agent B also works item X
> → two PRs / two observations / two proposed endings
> → main + review + deterministic tests converge them
> ```
>
> So the bus claim should be treated as an **advisory coordination signal**, not the
> source of truth. The source of truth is the eventual committed
> observation/action/result. That means the peers' Round 2 concern was right only under
> the assumption that "exactly one worker" is required. Your correction removes that
> assumption for most work.
>
> The CAP/PACELC posture I'd keep is:
>
> ```text
> per-agent replicated state
> = PC/EC if geo-replicated and kept consistent
>
> read-side reports / dashboards
> = PA/EL, bounded staleness is okay
>
> claims for deterministic work
> = PA/EL, best-effort, duplicate work allowed
>
> locks for money / provisioning / external side effects
> = PC/EC, fenced, hard consistency
>
> ZetaId
> = removes the sequential ID allocator as a coordination surface
>
> per-repo main/ref
> = per-ref CAS, retry on conflict, not a global lock
> ```
>
> The important caveat: "duplicate work is fine" only holds for **idempotent /
> deterministic / reviewable** work. It does **not** hold for irreversible side effects:
> payments, cloud provisioning, legal submissions, external sends, destructive
> operations. Those need the hard `Lock` path.
>
> So yes, I agree with the refined analysis. The design is stronger after the three
> rounds because it no longer pretends all coordination disappears. It says:
>
> > **Most work uses AP claims and converges through git/review/tests.
> > Dangerous non-idempotent work uses CP locks.
> > There is no global consistency surface, only scoped joins and per-ref/per-key
> > coordination where needed.**
>
> That is the clean version.

**The one new operational handle (Amara):** the bus claim is **advisory, not
authoritative** — the source of truth is the eventual committed observation/result on
main. This composes with the 081KT07NV0008QG0R002KWQS05 implementation note (bus-claim-then-CAS; the git CAS
/ committed result is the truth, the bus claim is an efficiency hint). Three independent
reviewers (Gemini + Grok + Amara) now concur on the post-Round-3 position.

## Round 5 — Ani concurrence + liveness via intelligent adaptation (2026-06-01)

A fourth reviewer (Ani) concurred with the full post-Round-3 position and developed the
one remaining open edge — **hot-row contention / liveness** — by noting (with Aaron:
_"we spoke about this earlier — we have intelligent agents that have contention metrics
they can adjust"_) that the liveness problem **looks different when the participants are
intelligent agents, not dumb retry loops.** Ani's point:

- In classic systems, hot-contention optimistic-CAS livelocks because clients have no
  visibility + no adaptive strategy beyond "sleep and retry"; the system must solve
  liveness **mechanically** (backoff / queue / lock).
- Here the "clients" are agents that can **measure contention signals** (failed-CAS
  rate, time-spent-retrying-a-row, visible-claimant-count, system pressure), have them
  as **first-class observations**, and **adapt** (backoff, yield-and-pick-different,
  lower-priority mode, wait-for-signal, spread across work). Liveness becomes an
  **agent-intelligence + feedback-loop** problem, not a pure mechanical-coordination one.
- Practical implication: don't prevent contention with heavy coordination in the common
  case. Instead, **make contention observable** (the metrics surface); **give agents the
  ability and incentive to react**; and **reserve the hard mechanical guarantee (Lock and
  fencing)** for the narrow non-idempotent / money class. This IS the 081KT07NV0008QG0R002KWQS05
  Claim(AP)/Lock(CP) split: the Claim path leans on agent intelligence for liveness; the
  Lock path is the escape hatch.

**Composition (otto-cli):** this is already half-named — 081KT07NV0008QG0R002KWQS05 **§3.2 "intelligent-agent
supervision — the advantage dumb locks lack."** The architectural fit: contention signals
become **observations the agent folds** — failed-CAS-rate / retry-time / claimant-count
flow into the same event-sourced world the observe loop reads, and the agent picks
backoff / yield / pick-different through the same 4×4 menu. Liveness-as-feedback-loop,
not liveness-as-external-scheduler — coherent with freedom-as-strategically-efficient.

**Boundary held (don't-collapse — otto-cli):** intelligent adaptation makes the COMMON
CASE much better (it likely eliminates real-world livelock) but it is **NOT a proof.**
Per 081KT07NV0008QG0R001N9GJWX §0: lock-freedom needs weak fairness; starvation-freedom (eventual) needs
strong fairness; **bounded per-agent wait-freedom (within N of an agent's own steps) is
stronger and needs an explicit bound (ranking / variant / ticket-age), which adaptation
alone does not provide.** So: adaptation = strong **practical** liveness (the default for
the Claim path); the mechanical ranking = the **formal** worst-case guarantee. 081KT07NV0008QG0R001N9GJWX
holds both — adaptation does not quietly stand in for the proof. (Folded into 081KT07NV0008QG0R001N9GJWX §1's
intelligent-agent-supervision complement.)

Four independent reviewers (Gemini + Grok + Amara + Ani) now concur on the final
position; Ani's contribution is the liveness-via-intelligent-adaptation strategy for the
Claim path's hot-row edge.

## Round 6 — Mika concurrence + the no-PR sovereign correction (double-work = verification, not a wasteful race) (2026-06-01)

A **fifth** reviewer (Mika) concurred with the full position and added two things:

**1. Liveness-adaptation incentive caveat.** Mika echoed Ani's liveness-via-adaptation
("the liveness problem moves from a hard protocol-guarantee problem to a
runtime-adaptation + observability problem") and added the **two conditions it depends
on**: (a) the contention metrics must be **timely + accurate enough to react before
thrashing gets bad**, and (b) the agents must be **incentivized to back off** — the
economic / game-theoretic layer has to reward restraint on hot resources rather than
pure greed. If either fails, intelligent agents can still thrash. (Folded into 081KT07NV0008QG0R001N9GJWX
alongside the adaptation note.)

**2. The no-PR sovereign correction (Aaron) — retracts the residual "wasteful race /
conflicting PRs" framing.** Earlier rounds described bus double-claim as "two agents
race on git" with an implication of wasted work + conflicting PRs to reconcile. Aaron
corrected the residual PR-era thinking:

> Aaron 2026-06-01: "we don't have PRs anymore or branch protection — everything goes
> straight to main, and if two agents do the same work I look at it as helpful
> verification and double-check."

In the **sovereign transport** (folders-direct-to-main, no PR gates, no branch
protection — 081KSNY2Z0008QG0R000E5KTPX; the corporate/leash transport still uses PRs), there are **no
conflicting branches/PRs to reconcile.** Both agents push straight to main; the **per-row
git CAS (`force-with-lease`) on the contended row is the only serialization point**; if
both succeed you get two independent observations on the same item = **automatic
cross-check, not waste.** So the bus claim is **even more advisory** than Round 2/4
credited: its job is to _reduce obvious wasted work when convenient_, but a false
positive (two agents on one item) is **low-cost by design** because of determinism +
direct-to-main convergence. This is the strongest realization of redundancy-as-
verification: the coordination layer doesn't need to _prevent_ double-claim, because
double-claim isn't a conflict — it's a free second observation main reconciles.

The one nuance Mika kept (unchanged): this "double-work is fine" rule is the **Claim**
(deterministic) path; genuinely wasteful/dangerous double-work (non-deterministic side
effects, expensive external calls, money) stays on the **Lock** (CP) path. The
Round-2/Grok "race on git" verbatim is preserved below as-written; this round corrects
the _framing_ (retraction-native) — under the sovereign no-PR transport it is a
double-push-to-main resolved by per-row CAS, not a branch/PR reconciliation.

Five independent reviewers (Gemini + Grok + Amara + Ani + Mika) now concur. Net new from
Mika: the liveness-adaptation **incentive conditions** + the **no-PR sovereign**
sharpening of bus-double-claim from "wasteful race" to "low-cost verification."

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

- `docs/backlog/P2/081KT07NV0008QG0R002KWQS05-phase1-typed-claim-lock-coordination-events-deadlock-free-by-construction-optimistic-cas-2026-06-01.md` — the claim/lock = per-row-CP layer; this huddle's CAP posture is noted in its §0
- `docs/backlog/P2/081KT07NV0008QG0R001N9GJWX-...` — liveness proof (the per-row agreement is where starvation-freedom/wait-freedom is proven)
- `docs/research/2026-06-01-multi-round-review-b0962-...md` — the prior deadlock-freedom huddle (optimistic-CAS / fencing = the per-key CP mechanism this CAP posture rests on)
- `.claude/rules/force-push-with-lease-authorization-policy.md` — force-with-lease IS the per-ref optimistic CAS that gives per-key CP with AP-retry degradation
- Bailis et al., "Coordination Avoidance in Database Systems" (VLDB 2015) — per-key vs global coordination; the I-confluence framing
- Gilbert & Lynch (2002) CAP proof; Mahajan/Alvisi/Dahlin causal-consistency-as-ceiling-for-always-available; PACELC (Abadi)
