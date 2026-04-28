---
id: B-0062
priority: P0
status: open
title: Wallet v0 build-out — concrete spec-logic punch list aggregating PR #72 deferred review concerns (Aaron 2026-04-28 honest-tracking catch)
tier: wallet-experiment-v0
effort: L
ask: maintainer Aaron 2026-04-28 ("bulk-resolve what is buld resolve does it actually answer the questions? or does it just close them? have they been answered?") — surfaced that ~15 PR #72 wallet-spec review threads were resolved with "deferred to v0 build-out" replies but no concrete tracking. This row IS the concrete tracking.
created: 2026-04-28
last_updated: 2026-04-28
composes_with: [B-0060, B-0061]
tags: [wallet-experiment-v0, eat, spec-logic, pr-72-deferrals, honest-tracking, build-out, no-papering-over]
---

# Wallet v0 build-out spec-logic punch list — PR #72 deferrals

The EAT packet + wallet v0 operational spec PR (#72) absorbed
the research-grade docs but had ~15 review threads that
flagged real spec-logic gaps. Those threads were resolved
with "acknowledged + filed under v0 build-out phase" replies.
The honest tracking is THIS row, so the deferred concerns
don't get lost in closed-thread comments.

## Context

PR #72 framing: research-grade absorb of the EAT canonical
packet + wallet v0 operational specification. Not canonical
doctrine. Not a build-out commitment. The deferred concerns
are appropriate for the implementation phase when state-
machine shapes will be surfaced by real code, not for the
research-grade absorb scope the PR represents.

Aaron 2026-04-28 honest-tracking catch:

> *"bulk-resolve what is buld resolve does it actually answer
> the questions? or does it just close them? have they been
> answered?"*

Translation: deferral is fine, but it must be tracked. A
"deferred to v0 build-out" reply on a closed thread is not
tracking; it's papering. This row converts the deferred
threads into a concrete actionable punch list.

## Punch list (resolve before v0 acceptance, not before this PR merge)

Each item references the PR #72 review thread that surfaced
it (closed-thread links survive in the PR's review history).

### Spec-logic — preflight retraction state machine

1. **Add a terminal path for preflight-retracted proposals**
   (cid 3151220960 P1). The tick state machine currently
   enforces `signed → broadcast → settled`; a preflight-
   retracted proposal has no terminal state. The wallet
   spec needs an explicit `preflight-retracted` terminal
   state with the receipt-schema fields the monitor will
   write.
2. **Drop the impossible pre-broadcast classification freeze
   trigger** (cid 3150897609 P1). §6.1 currently freezes
   when the pre-flight retraction monitor disagrees with
   the agent's classification, but the spec also says
   classification happens post-broadcast. The two
   statements can't both be true. Decision needed: does
   classification happen pre- or post-broadcast?
3. **Add a pre-broadcast freeze terminal state** (cid
   3151408384 P1). §9.1 allows the monitor to trigger
   `freeze-on-dissent` before broadcast — the spec needs
   the matching terminal state in the tick state machine.
4. **Make tx-receipt fields optional for preflight retractions**
   (cid 3151233788 P1). Receipt schema currently requires
   on-chain transaction fields (`hash`, `block_number`,
   etc.); a preflight-retracted proposal has no on-chain
   transaction. Schema needs `Optional<>` markers for the
   on-chain-only fields.

### Spec-logic — agent self-revocation

5. **Define a revocation auth path the agent can actually use**
   (cid 3151301493 P1). §9.1 requires the agent to self-
   revoke via a call authenticated by the active session
   key, but §3.3/§3.4 say the agent doesn't hold keys.
   Reconcile: either the agent has a session-key signed
   mandate (separate from tx-signing), or the revocation
   goes through a different auth channel (oracle, monitor-
   signed message, etc.).
6. **Clarify §9.1 revocation mechanism vs §3.3/§3.4 no-keys**
   (cid 3151222680 P1). Same root cause as #5; fix needed
   in both sections to remove the contradiction.

### Spec-logic — monitor placement + lifecycle

7. **§12.5 sibling-repo vs in-repo monitor reconciliation**
   (cids 3151300145, 3151300160 P1). §12.5 RESOLVED the
   monitor implementation to a sibling repository; the
   acceptance criteria + Phase 1 roadmap still permit the
   in-repo `tools/wallet-monitor/` form factor. Pick one.
8. **Topology section alignment with §12.1 framework choice**
   (cid 3151260676 P2). Topology section still labels the
   smart-account framework as "open question" but §12.1
   RESOLVED it to ZeroDev-on-7702. Update topology to
   match.
9. **Phase 1 roadmap sibling-repo monitor requirement**
   (cid 3151260677 P2). Phase 1 still lists "stub
   tools/wallet-monitor/ directory or sibling-repo
   bootstrap"; §12.5 RESOLVED removes the "or in-repo"
   option. Update roadmap.

### Spec-logic — monitor-stall freeze + classification

10. **Enforce monitor-stall freeze before broadcast**
    (cid 3151321309 P1). The spec requires the monitor
    pipeline to complete within 60s; needs an explicit
    `freeze-on-monitor-stall` rule + the terminal state
    that the freeze creates.
11. **Define an on-chain classification signal for Tx N+1
    gating** (cid 3151333578 P1). §7.1 requires the
    smart-account contract to reject Tx N+1 if Tx N's
    classification is unresolved. The spec doesn't define
    where the contract reads the classification signal
    from (oracle? monitor-signed message? bond escrow?).
    Pick one.

### Spec-logic — drawdown oracle + glass-halo logging

12. **Define a deterministic oracle for drawdown freeze
    checks** (cid 3151362883 P1). §5.5 requires the
    smart-account to freeze when bond drawdown crosses a
    threshold. The on-chain check needs a deterministic
    oracle (Chainlink? own pricing oracle? off-chain
    monitor-signed update?). Spec needs the choice.
13. **Move glass-halo logging gate out of smart-contract
    enforcement** (cid 3151362886 P1). The spec currently
    makes "logging failure ⇒ tx fails" an on-chain
    enforcement rule. Logging is off-chain infrastructure;
    making it a contract-level gate is a separation-of-
    concerns mistake. Move to off-chain monitor.

### Acceptance-criteria + auth + metric alignment

14. **Require auth for retraction-queue cancellation** (cid
    3150816618 P1). The spec currently says a pending
    transaction can be self-revoked without auth; needs
    the auth path matching #5.
15. **Material-spend criteria for second-agent review** (cid
    3151321306 P2). Receipt schema makes `second_agent_
    review.required` a boolean; spec needs the predicate
    that decides when it's required (spend > $X? new
    counterparty? new venue?).
16. **Align retraction metric with updated Base reorg
    policy** (cid 3150816620 P2). Retraction metric still
    requires "reorg-window monitored after" the §12.2
    Base-reorg policy. Update to current policy.
17. **Unify the unfreeze quorum across sections** (cid
    3151220963 P2). Test text requires "Aaron-plus-monitor"
    for unfreeze; §6.2 defines a different quorum. Pick
    one + propagate.
18. **§15 send-readiness statement reconciliation** (cid
    3150897613 P2). §15 says only two maintainer-only
    questions remain; current state is §12.1-§12.6
    Otto-resolved + §12.7-§12.8 Aaron-resolved. Refresh
    statement.
19. **EAT retraction-coverage metric alignment with wallet
    spec** (cid 3151233791 P2). Companion-spec drift
    between EAT doc and wallet v0; align metric.
20. **EAT Task B in-repo monitor option removal** (cid
    3151301494 P2). EAT Task B still permits in-repo
    monitor form factor; align with §12.5 sibling-repo
    resolution.

### Schema migration

21. **INTENTIONAL-DEBT.md YAML schema vs current prose
    format** (cid 3151337321 P1). Spec proposes recording
    bond entries in a YAML schema; INTENTIONAL-DEBT.md is
    currently a prose/bulleted ledger. Either land the
    YAML schema migration (separate ADR + tooling), or
    define bond entries in the existing prose format
    until the schema lands.

## Done-criteria

Each punch-list item resolved with either:

- (a) A spec edit landing the chosen mechanism + its
  rationale, OR
- (b) An ADR documenting "we considered this; here's why
  we're going with X over Y," OR
- (c) An explicit "out of scope for v0; defer to v0+1"
  with a follow-up backlog row.

When all 21 items have one of these three resolutions,
this row closes.

## Why this row exists

Aaron 2026-04-28: *"bulk-resolve what is buld resolve does
it actually answer the questions? or does it just close
them? have they been answered?"* — caught the failure mode
where I closed threads with deferral notes but didn't track
the deferrals anywhere actionable. Honest tracking IS the
fix. The thread closures stay (PR #72 mergeable as research-
grade absorb), but the substantive concerns now have a
concrete punch list, not just scattered closed-thread
comments.

## Composes with

- **B-0060** — human-lineage / external-anchor backfill (the
  spec mechanisms picked here should cite their external
  prior art per the same rule).
- **B-0061** — backlog migration (this row IS in per-row
  format; B-0061 is the meta-task tracking the rest).
- The closed PR #72 review threads survive in the PR's
  history; this row references them by `cid=NNNNNNNNNN` so
  the original reviewer's framing is recoverable.
