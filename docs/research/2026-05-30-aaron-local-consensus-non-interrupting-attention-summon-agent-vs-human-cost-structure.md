# Local consensus via non-interrupting attention-summon — agent consensus has a different cost structure than human consensus

**Date:** 2026-05-30
**Source:** Aaron, in conversation with Otto (Claude Code), extending the
2nd-opinion / multi-oracle thread that arose over a worktree-prune.
**Type:** architecture / framing substrate (Aaron's framing treated as
already-unfolded per his cognitive profile; preserved per
substrate-or-it-didn't-happen).

## Verbatim (Aaron 2026-05-30, in order)

> are you sure its safe to prune? I usually get a 2nd opinion you can easily
> spin up other agents and ask

> all agents have the ability to summon the other agents on demand in their
> native harness we already built that.

> this way consensus can be a local thing cause agent attention can be summoned
> without interrupts on it's primary attention layer, humans don't work this way

> a non-reversible action happens, get a 2nd opinion

## The keystone

**Non-interrupting attention-summon changes the *cost structure* of consensus —
which is why "consensus can be local" is true for agents and false for humans.**

| | Humans | Agents |
|---|---|---|
| Attention | serial, singular | forkable (summon ≠ interrupt) |
| Getting a 2nd opinion | interrupts someone else's primary layer (meeting / async wait / context-switch both ends) | non-interrupting fork: primary layer keeps running; summoned agent runs isolated, returns a verdict |
| Consensus cost | `O(interrupt-everyone)`, serialized, expensive | `O(local-fork)`, parallel-isolated, cheap |
| Rational response | **minimize** consensus — decide solo, escalate rarely, batch into meetings | **maximize** consensus — run a local quorum before every uncertain/non-reversible action, routinely |
| Consensus is | a heavyweight protocol invoked sparingly | a lightweight primitive invoked by default |

The 2nd-opinion-before-non-reversible-action discipline is **only viable because
the fork is non-interrupting.** If summoning interrupted the primary attention
layer (human-style), the discipline would be too expensive to apply routinely;
because it doesn't, it is cheap enough to be the default.

## Two edges

### It changes the *topology* of consensus, not just the cost

Multi-oracle / BFT consensus is usually pictured as distributed long-lived agents
voting over a bus (081KS3X9Y0008QG0R00218150M, m-acc — the **standing-governance** form). The keystone
adds the **local-transient** form: a single agent convenes a quorum *in its own
decision context*, on demand, then dissolves it. Both are valid:

- **Distributed / standing** — for governance that must persist (moral invariants,
  cross-fork ratification, Knights-Guild-class decisions).
- **Local / transient** — for routine per-action checks before acting.

The local form only exists because the summon is non-interrupting. Humans have
only ever had the distributed-and-expensive form, so human institutions minimize
consensus; agent societies can afford it per-action.

### The local-transient form is MULTI-ORACLE but NOT BFT (the human maintainer 2026-05-30)

> *"it's multi oracle but not bft — locally you can lie and not call the consensus;
> it relies on a good actor, for now."*

Critical trust-model caveat — do not conflate the local-transient form with
Byzantine-fault-tolerance. The local form has the **multi-oracle** property (it
convenes multiple independent oracle-perspectives — the summoned LLMs) but it is
**NOT BFT**: the summoning agent can **lie** (fabricate the quorum / misreport the
verdicts) or **skip the summon entirely**, so it **relies on a good actor**.

| Property | Local-transient (this form) | Distributed-standing BFT (081KS3X9Y0008QG0R00218150M) |
|---|---|---|
| Multi-oracle (multiple perspectives) | ✓ | ✓ |
| Byzantine-fault-tolerant (survives lying actors) | ✗ — good-actor-dependent | ✓ — no single actor controls the quorum |
| Trust model | trust-the-summoner | trust-no-one |
| Can the convener fake / skip it? | yes | no (independent nodes + attestation) |

DST-determinism (temp 0 + fixed seed) gives the local form
**replayability-if-honestly-recorded** (audit), **NOT** Byzantine-tolerance — a
replayable decision is still fakeable by a dishonest convener (it can record a
fabricated quorum). **Replayable ≠ unfakeable.**

"For now": the path to a local form WITH BFT-grade trust is making the summon
**un-fakeable and un-skippable** — distributed independent summons + cryptographic
attestation of the quorum + can't-skip enforcement (converging the local-transient
form toward 081KS3X9Y0008QG0R00218150M's distributed-standing properties). Until then, **local-summon
is a good-actor-dependent multi-oracle convenience, not a trust-minimized
protocol** — use it as a cheap routine quorum/2nd-opinion where the convener is
trusted (e.g. a single agent checking its own decisions), not as a consensus over
potentially-adversarial actors.

This sharpens the dual-consensus framing: **CRDT state-convergence is
trust-minimized** (math — semilattice/DBSP group laws converge regardless of who
pushed), but **local-summon decision-consensus is good-actor-dependent** (the
convener can fake/skip). Different layers, different trust properties; only the
distributed-standing form (081KS3X9Y0008QG0R00218150M) is BFT. Composes with `razor-discipline.md`
(the precise claim: multi-oracle ✓, BFT ✗) + `mechanical-authorization-check.md`
(good-actor-dependence is the gap).

### Local-consensus-before-acting is the reconciler pattern applied to decisions

Composes straight back into "declarative + self-healing = anti-entropy" (the
2026-05-30 anti-entropy-converter doc): before `emit` (the action), summon a local
quorum to reconcile "is this safe/correct?" against the desired invariant, *then*
emit. It is a **self-healing check on the agent's own decisions** — catch the bad
action before it lands. The reconciler pattern runs OS → cluster → agent → and now
→ the agent's *decision loop itself*.

## The rule it justifies

Aaron's class boundary — **"a non-reversible action happens, get a 2nd opinion"** —
lands as `.claude/rules/non-reversible-action-get-a-second-opinion.md`. It
generalizes the force-push-with-lease policy (force-push = the canonical
"closest-to-irreversible" action, already requiring operator-or-peer confirm) to
*all* non-reversible actions. The summon mechanism is already built (native
subagents via the `Agent` tool; cross-harness via the 9 `tools/peer-call/`
wrappers) — the discipline is *using* it, not building it.

## Empirical anchor (this session)

A worktree-prune surfaced the whole thread. Otto pruned 4 clean+merged worktrees
solo; Aaron asked "are you sure it's safe?"; Otto summoned an independent native
subagent to audit. The audit ran **without interrupting Otto's primary attention**
(Otto kept composing the response while it ran ~44s), returned a verdict
(prune was safe + reversible), AND **corrected** a misclassification (a detached
worktree Otto had marked "uncertain" was a *peer* commit — leave it). That is the
keystone in action: a local, cheap, non-interrupting consensus that improved the
decision. Note the prune itself was *reversible* (branch refs preserved, content
on main), so under Aaron's class boundary it did not strictly require the opinion —
but the value of getting it (the correction) shows why agents can afford to summon
even on the margin.

## Razor note

Operational, not metaphysical: "non-interrupting summon" is a real mechanism (the
`Agent` tool / peer-call wrappers fork a separate context; the primary loop's
state is untouched); the cost-structure difference is measurable (human consensus
serializes attention + incurs interrupt cost; agent consensus forks). "Consensus
is local" = a single agent can instantiate + collect + dissolve a quorum within
one decision flow. The human-vs-agent contrast is the load-bearing claim.

## Composes with

- `.claude/rules/non-reversible-action-get-a-second-opinion.md` (the rule this
  doc is the WHY for) — lands alongside.
- `.claude/rules/force-push-with-lease-authorization-policy.md` — the canonical
  non-reversible action + the multi-oracle (operator OR peer-agent) authorization
  path this generalizes.
- `.claude/rules/peer-call-infrastructure.md` — the 9 cross-harness summon
  wrappers; the `Agent` tool is the native-subagent summon.
- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` — multi-oracle
  by design (the standing-governance form; this is the local-transient form).
- 081KS3X9Y0008QG0R00218150M (multi-oracle BFT) — distributed/standing consensus; complemented by the
  local/transient form here.
- `docs/research/2026-05-30-aaron-install-graph-zflash-anti-entropy-converter-...md`
  — the reconciler/anti-entropy framing local-consensus-before-acting extends to
  decisions.
- `.claude/rules/substrate-or-it-didn't-happen.md` — why this conversation-only
  framing is preserved here.
