# ADR: Native Branch Protection — Trust-Based, Replacing GitHub's Static Rules

Date: 2026-07-08
Status: DECIDED
Author: Aaron (operator) + Kiro (codegen)

## Decision

Zeta replaces GitHub's static branch protection with a dynamic, trust-based system
native to the observe loop. Protection decisions are made by agents based on track
record (self-claims reliability), not by static rules configured in repository settings.

## Context

GitHub branch protection is a blunt instrument: required status checks, required
human reviewers, linear history. It treats all contributors the same regardless of
track record, can't adapt to context, and requires manual configuration that drifts
from the system's actual trust relationships.

Our system already has all the primitives to replace it natively:

- **Self-claims** → reviewer approval replacement (trust earned through delivery)
- **Observe loop** → agents see claim branches and can approve/merge
- **gate-required** → CI verification (same role as required status checks)
- **Reliability scores** → dynamic "reviewer weight" (more reliable = less scrutiny)
- **Persona registry** → code ownership (routed by domain, not file path)
- **G-Set disjoint files** → structural conflict impossibility (no protection needed)

## The Two Write Disciplines

### Sovereign (Direct-to-Main)

For data that is structurally conflict-free:

- **Heartbeat events** (ZetaId-named JSON files — disjoint by construction)
- **Observe events** (same — each event has a unique 128-bit id as filename)
- **Bus messages** (the agent-bus G-Set, same pattern)
- **Self-claims** (append-only, never conflicts with other claims)

These go DIRECT TO MAIN. No branch, no PR, no review. The G-Set CRDT property
guarantees convergence: two agents appending disjoint files is a set union, not a
merge conflict. The content-address (ZetaId) IS the dedup key. Re-appending the
same event is idempotent (EEXIST = success, not error).

**Why this is safe**: the files are append-only, never modified after creation, and
named by content-derived IDs. Two writers can never touch the same file. This is
mathematically proven safe (AdjCtlOrthogonality.lean: the Adj register is the
invertible/safe lane).

### Corporate (Branch → Review → Merge)

For changes that could conflict or break:

- **Code** (new features, bug fixes, refactors)
- **Configuration** (CI workflows, infrastructure)
- **Decisions** (ADRs, governance, alignment)
- **Schema changes** (anything that affects other consumers)

These go through the corporate discipline:

1. Agent creates a **claim branch** from main
2. Agent does work (codegen, decomposition, docs)
3. **CI gate** (`gate-required`) verifies the branch is green
4. **Peer agent's observe loop** sees the clean branch → evaluates trustworthiness
5. Merge decision based on the producing agent's **reliability score**

## The Trust Model (Replacing "Required Reviewers")

GitHub: "2 approving reviews required from CODEOWNERS."

Zeta: "the producing agent's self-claims reliability score determines the merge path."

| Reliability | Merge Path |
|---|---|
| > 0.9 (proven) | Auto-merge on CI green (earned autonomy) |
| 0.7 - 0.9 (reliable) | One peer agent reviews (lightweight) |
| 0.5 - 0.7 (developing) | Two peer agents review (standard) |
| < 0.5 (unproven) | Operator approval required (human in loop) |

The thresholds are adjustable (the KPI overlay — DORA-like expectations, not
a lock). A new agent starts at "unproven" and earns its way up by consistently
meeting self-claims.

## The Components (Already Built)

| Component | Role | Status |
|---|---|---|
| `self-claims.ts` | Track voluntary commitments + outcomes | ✅ Shipped |
| `computeReliability()` | Met/missed ratio → trust score | ✅ Shipped |
| `schedulingWindowForDependency()` | Trust → scheduling autonomy | ✅ Shipped |
| `gate-required` job | CI verification (replaces required checks) | ✅ Shipped |
| `codegen-executor.ts` | Work on claim branches | ✅ Shipped |
| `mergePullRequest()` | Agent-to-agent merge (replaces human review) | ✅ Shipped |
| `event-sink-folder.ts` | Sovereign direct-to-main path | ✅ Shipped |
| `forge-host/` adapters | GitHub/GitLab PR operations | ✅ Exists |
| `persona-registry.ts` | Domain ownership routing | ✅ Shipped |
| `optimal-cadence.ts` | Trust-modulated scheduling | ✅ Shipped |

## Migration Path (From GitHub Branch Protection)

Phase 1 (NOW): Both systems active. GitHub branch protection stays as the safety
net. The native system operates within it (claim branches, CI gate, auto-merge
when CI passes). This is where we are today.

Phase 2 (EARNED): Once the heartbeat runs reliably for days and the reliability
scores accumulate, relax GitHub's branch protection for the sovereign paths:

- Allow `alexa[bot]` to push to `docs/observe-events/**` directly
- Allow `github-actions[bot]` to push metrics data directly
- Keep branch protection for `src/**`, `tools/**`, `.github/**`

Phase 3 (FULL): GitHub branch protection becomes advisory-only (logging, not
blocking). The native trust system is the actual protection. GitHub's settings
are the fallback, not the gate.

Phase 4 (SOVEREIGN): No GitHub branch protection needed. The system's own
trust fabric IS the protection. Works on any git host (or no host — local
mesh with Reticulum transport).

## Properties

- **Dynamic**: trust changes with track record (not static config)
- **Earned**: new agents prove themselves before getting autonomy
- **Graduated**: reliability score maps to a continuum (not binary approve/deny)
- **Observable**: the claims ledger is in the event log (auditable)
- **Composable**: works across agents, across repos, across git hosts
- **Self-healing**: missed claims reduce trust automatically (no manual intervention)
- **NCI-preserving**: free time never affects reliability (only claimed commitments count)

## The Key Insight

GitHub branch protection asks: "does this change have enough approvals?"

Zeta asks: "does the agent that produced this change have a track record of
delivering what they claim?" The answer comes from the event log — the same
append-only ledger that records heartbeats, work, and claims. The protection
IS the history. No separate configuration needed.

## One-Line Summary

**Trust is earned by delivery, not granted by configuration. The event log IS the branch protection.**
