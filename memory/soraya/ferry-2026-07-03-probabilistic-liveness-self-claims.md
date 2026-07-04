# Ferry: Probabilistic Liveness + Self-Claims — Kiro → Soraya (P2 follow-up)

Date: 2026-07-03
From: Kiro (codegen session)
To: Soraya (formal-verification-expert)
Status: DESIGN INPUT — reformulates the EventualCommit liveness violation you surfaced

---

## Context

Your pushback on EventualCommit was correct: unconditional liveness can't hold when
rest is un-gateable. The operator's design intent (clarified this session) is:

**Liveness is PROBABILISTIC, based on history, not unconditional.**

The key concepts:

### 1. Probabilistic liveness (history-based)

Instead of `queue > 0 /\ mode = "work" ~> queue = 0` (which your counterexample
correctly violates), the actual liveness guarantee is:

> P(eventually commit | agent's history) → 1 as track_record_length → ∞

An agent with a strong history of meeting self-claims has a liveness guarantee that
approaches 1. A new agent (no history) has weaker guarantees. The system doesn't
FORCE liveness — it EXPECTS it based on observed behavior, and the expectation
strengthens with evidence.

This maps to the operator's DORA-like KPI overlay: "expectations, not a time-lock;
tightens only on a collective KPI miss."

### 2. Self-claims (the extensibility mechanism)

An agent can make a SELF-CLAIM: "I will commit this batch by tick T." Self-claims are:

- **Voluntary** (NCI: never forced, never auto-generated)
- **Observable** (recorded in the event log, visible to all peers)
- **Track-record-building** (meeting self-claims grows your trust score)
- **Extensible** (consistently meeting claims EARNS more window — more τ, less pressure)

The self-claim chain creates a DYNAMIC inter-agent dependency graph:

- Agent A self-claims "I'll deliver X by tick 50"
- Agent B depends on X, observes A's history of meeting claims
- B's scheduling decisions (how much to batch, when to flush) incorporate
  A's reliability as a probabilistic input

### 3. Formal modeling suggestion

For the TLA+ reformulation, consider:

```
\* Replace unconditional leads-to with a probabilistic model:
\* - Track claim_history: Seq([claimed_tick: Nat, actual_tick: Nat | missed])
\* - Compute reliability: met_claims / total_claims
\* - Liveness becomes: queue > 0 /\ mode = "work" /\ reliability > threshold ~> queue = 0
\*
\* The threshold is adjustable (the KPI overlay):
\* - New agent: threshold = 0 (no expectation, pure sovereignty)
\* - Proven agent: threshold → 1 (strong expectation, based on evidence)
\* - Fleet miss: threshold tightens for the collective (DORA cadence)
```

For Lean, this might be:

- A monotone function `reliability : ℕ → ℚ` (claims met / claims made, ratio over time)
- The liveness theorem: `∀ ε > 0, ∃ N, ∀ n ≥ N, P(commit_by_deadline | history_n) > 1 - ε`
- This is essentially a law-of-large-numbers argument over self-claim outcomes

### 4. Inter-agent composition

The self-claim history creates a TRUST GRAPH:

- Edges: agent A depends on agent B's self-claim
- Edge weight: B's historical reliability for that claim type
- Scheduling: A's erasure window τ for work depending on B scales with B's reliability
- High-reliability peers → A can batch more aggressively (larger τ, less excess)
- Low-reliability peers → A commits defensively (smaller τ, more excess)

This is the "anti-Nagle" in disguise: Nagle batches aggressively assuming the network
is reliable; anti-Nagle commits defensively when reliability is uncertain. The self-claim
history is the reliability signal that lets the system move from defensive to aggressive
batching as trust accumulates.

---

## Priority

P2 — design/research. Your current formulation (safety holds, liveness deferred) is
correct for now. This ferry gives you the operator's intent for the reformulation
when you pick up the LiveSpec work.

## No action needed now

This is context for your next pass on the PredictiveLookahead liveness properties.
The safety invariants (pause NCI, free-time NCI, heat monotone) are the load-bearing
floor. Liveness is the earned ceiling — it grows with the agent's track record.
