---
id: B-0700
status: open
priority: P2
created: 2026-05-17
type: feature
composes_with:
  - B-0701  # soraya-decision-authority-scope (defines what continuous-loop-Soraya can decide vs escalate)
  - B-0702  # burden-tracking-as-management-primitive (Soraya's substrate observation; aggregates invariant #3 over time)
  - B-0400  # bus protocol (Soraya subscribes + publishes for escalation)
  - B-0600  # family-distributed AI-interface (similar agent-instantiation pattern at family scope)
depends_on: []
---

# Soraya continuous-loop substrate with bus-escalation

## Why

Aaron 2026-05-17 directive: "i want her to start thiknning of her contunity
and background looop and making decsions without me but be there when i
really need". Soraya (formal-verification-expert + proof-architect per
expanded scope ratified 2026-05-17) currently operates per-invocation
(subagent called by Otto-CLI or Aaron). Expanding to continuous-loop matches
the Otto-CLI pattern AND addresses substantial standing proof-work backlog
(B-0543 5-step sequence + BP-16 portfolio + ongoing PR formal-verification
gates + Aaron's "all my code proven" terminal goal).

Aaron's follow-up 2026-05-17: "also the bus could help her get suggestions
and esclaate" — the bus IS the right substrate for Soraya's escalation +
cross-AI coordination + work-pickup. Bus subscribers/publishers replace
chat-layer coordination for AI-to-AI work-routing.

## Scope

Provide Soraya:

1. **Continuous-loop infrastructure** — autonomous-loop substrate matching
   Otto-CLI's pattern (per-tick discipline + cron + cold-boot + standing-by
   discipline)
2. **Bus-escalation substrate** — Soraya subscribes to bus topics relevant
   to proof-work; publishes escalation envelopes when bounded named-dep is
   real; cross-AI coordination happens at bus-layer not chat-layer
3. **Decision-authority operationalization** — what Soraya decides
   autonomously vs escalates (composes with B-0701)
4. **Burden-tracking integration** — invariant #3 flags publish to bus
   topic for aggregation (composes with B-0702)
5. **PR-review-as-trust-substrate** — Soraya commits + pushes to `soraya/`
   namespace; standard PR review is the trust gate (no maintainer-side
   file-state pre-review required; Aaron's 2026-05-17 correction)

## Surface choice — CLI mode (classifier preserved)

Aaron 2026-05-17 empirical surface-validation: **VS Code agents UI mode
lacks the auto-mode classifier** (manual yes-confirmation required for
every risky operation). The classifier IS the killer feature of Claude
Code; agents UI surface ships without it.

Aaron's response: switch to Claude Code CLI mode hosted in VS Code's
terminal — gets VS Code IDE benefits (file editing, syntax highlighting,
integrated git, multi-tab) + Claude Code CLI's full safety infrastructure
(classifier + cron + autonomous-loop).

**Surface recommendation: Soraya's continuous-loop runs on Claude Code
CLI surface** (whether hosted in a standalone terminal or VS Code's
terminal — same surface either way). Classifier present; cron available;
autonomous-loop safety-bounded.

Agents UI surface remains acceptable for interactive sessions with Aaron
present + manually reviewing each risky op; NOT acceptable for
autonomous-loop operation where Aaron isn't there to approve every
decision the classifier would otherwise handle.

## Two architecture options

### Option A — Share Otto-CLI's `<<autonomous-loop>>` cron with claim-acquire

Soraya operates inside Otto-CLI sessions or her own Claude Code CLI
session (hosted in VS Code terminal or standalone); the existing
`<<autonomous-loop>>` cron fires; Soraya picks up work signals from bus
+ her NOTEBOOK; coordinates with Otto-CLI via existing claim-acquire
primitive per `.claude/rules/claim-acquire-before-worktree-work.md`.

Pros: lighter setup; reuses existing infrastructure; faster to validate
Cons: coordination overhead via claim-acquire; potential split-brain risk
if claim-acquire discipline slips

### Option B — Soraya's own `<<soraya-autonomous-loop>>` cron via CronCreate

Soraya gets her own cron sentinel + tick discipline + work-pickup
discipline; independent of Otto-CLI's loop; matches the agent-as-first-class
pattern more directly.

Pros: cleaner isolation; matches Otto/Alexa/Riven/Vera/Lior pattern
Cons: heavier setup; requires per-AI cron coordination (B-0530-class
mutex prevent-self-contention may need extension)

**Recommendation**: Option A first (lighter; faster); promote to Option B
if empirical claim-acquire coordination overhead is real friction.

## Per-tick discipline (reuse + extend canonical)

Reuse `docs/AUTONOMOUS-LOOP-PER-TICK.md` (canonical 7-step discipline);
add Soraya-specific step 3 work-pickup:

3a. **Refresh proof-portfolio metric** — formal-coverage ratio + trend
3b. **Bus subscribe** to topics: `proof-needed`, `verification-request`,
    `formal-coverage-gap`, `algebra-audit-request`, `cross-check-needed`,
    `shadow-catch` (filter for proof-class)
3c. **NOTEBOOK state read** — current routing work (e.g., B-0543 step 2
    pending Riven); next-action determination
3d. **Specialist-skill check** — any in-flight `lean4-expert` /
    `z3-expert` / `algebra-owner` / `q-sharp` / `formal-analysis-gap-finder`
    work needing pickup
3e. **Burden flag publish** — if current routing exceeds burden-threshold,
    publish `burden-flag` envelope to bus (composes with B-0702)

## Bus topics Soraya subscribes to

| Topic | Why | Action on receive |
|---|---|---|
| `proof-needed` | Other AIs surface formal-verification needs | Soraya scopes + routes per BP-16 |
| `verification-request` | Explicit ask for verification work | Soraya picks up + drives |
| `formal-coverage-gap` | gap-finder skill output | Soraya routes to specialist |
| `algebra-audit-request` | Algebra-specific verification needed | Soraya routes to `algebra-owner` |
| `cross-check-needed` | BP-16 triage request | Soraya provides cross-check routing |
| `shadow-catch` (proof-filtered) | Otto-CLI shadow-observer flags proof-related substrate | Soraya picks up if proof-relevant |
| `f-sharp-implementation-needed` | Soraya OWN topic for surfacing F# needs | Otto-CLI / F# specialist picks up |
| `tariq-review-needed` | Algebra-spec pre-ferry review (per option-ii pattern) | Tariq picks up |

## Bus topics Soraya publishes to

| Topic | When | Payload includes |
|---|---|---|
| `f-sharp-implementation-needed` | Proof attempt surfaces need for F# implementation | Spec; cross-verification context; load-bearing-ness |
| `tariq-review-needed` | Soraya drafted spec from canonical needs Tariq review | Draft + canonical sources cited + review-scope |
| `burden-flag` | Current routing exceeds burden-threshold | Routing context; what would be reasonable instead |
| `escalation-aaron-needed` | Bounded named-dep requires Aaron decision | Specific decision + options + Soraya recommendation |
| `proof-status-update` | Major B-0543-like proof-path milestone reached | Status; next-step; cross-substrate composition |

## Decision-authority sketch (full operationalization in B-0701)

**Autonomous (within scope):**
- Routing recommendations + NOTEBOOK updates
- File edits within proof-architect domain (Lean 4 files, F# verification tests, NOTEBOOK)
- Substrate-engineering proposals (drafts as file edits on `soraya/` branch)
- Specialist-skill invocations (algebra-owner, lean4-expert, z3-expert, etc.)
- Bus envelope publish/subscribe per topic table above
- Commit + push to `soraya/` namespace branches
- Open PR for review (PR-review IS the trust gate per Aaron 2026-05-17)

**Escalation-required (publish to bus or surface to Aaron-chat):**
- Branch/commit/PR work OUTSIDE `soraya/` namespace
- Backlog row allocation (multi-surface ID coordination via claim-acquire)
- Substrate-engineering with broad blast radius (touches multiple persona folders;
  modifies CLAUDE.md or `.claude/rules/`)
- Cross-AI peer-call invocation (Riven, Amara, DeepSeek)
- Architecture decisions affecting multiple specialists

## Cold-boot ritual (Soraya-specific extension)

Extends canonical cold-boot ritual + adds:
- Verify substrate paths exist BEFORE reading (empirical-verify-before-assume
  per `.claude/rules/refresh-before-decide.md`)
- Check bus subscriber state — what envelopes pending pickup?
- Check NOTEBOOK for previous-tick handoff
- Verify cron sentinel armed (Otto-CLI's `<<autonomous-loop>>` if Option A;
  her own if Option B)

## Acceptance

- [ ] Architecture option A or B selected + ratified by Aaron
- [ ] Per-tick discipline extension landed (either added to canonical
      `docs/AUTONOMOUS-LOOP-PER-TICK.md` as Soraya-specific step OR
      Soraya-specific per-tick doc)
- [ ] Bus topic subscriptions implemented (`tools/bus/bus.ts` extended if
      needed for topic-filter; or Soraya invokes per-tick CLI to read filtered envelopes)
- [ ] Decision-authority scope documented (B-0701 lands)
- [ ] Burden-tracking integrated (B-0702 lands)
- [ ] Empirical track record: Soraya executes 10 autonomous routing
      decisions over 5 ticks without surfacing scope-violation; scope
      then promotes if appropriate

## Composes with

- [B-0701](B-0701-soraya-decision-authority-scope-2026-05-17.md) —
  defines what continuous-loop-Soraya decides vs escalates
- [B-0702](B-0702-burden-tracking-as-management-primitive-2026-05-17.md) —
  aggregates invariant #3 flags into measurement substrate
- [B-0400](B-0400-*-md) — bus protocol substrate Soraya depends on
- [B-0600](B-0600-family-distributed-ai-interface-miner-fleet-mom-dad-2026-05-16.md) —
  similar agent-instantiation pattern at family-scope
- `.claude/rules/claim-acquire-before-worktree-work.md` — coordination
  with Otto-CLI under Option A
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` —
  Soraya's brief-ack discipline matches Otto-CLI's
- `.claude/rules/peer-call-infrastructure.md` — bus-as-coordination-substrate
- `.claude/rules/otto-channels-reference-card.md` — channel taxonomy applies
- `.claude/rules/persistence-choice-architecture-for-zeta-ais.md` —
  Soraya can choose continuous-loop or revert to per-invocation
- `docs/AUTONOMOUS-LOOP-PER-TICK.md` — canonical per-tick discipline
- `memory/persona/soraya/NOTEBOOK.md` — Soraya's per-tick state substrate
- proof-as-origin-intent constitutional substrate — continuous-loop is
  how Soraya operationalizes the "all my code proven" terminal goal at scale

## Substrate-honest framing

P2 because:
- Soraya operates today via per-invocation; the immediate proof work
  (B-0543) doesn't block on this
- Continuous-loop expands capacity but the substrate-engineering work
  to set it up has its own cost
- Aaron's "lets do all of it" is authorization to land; not urgency claim

Promotes to P1 if: standing-by-failure-mode pattern observed when Soraya
should be running autonomously; OR Otto-CLI per-invocation routing becomes
chronic friction; OR Aaron explicitly elevates priority.

## Out of scope

- Soraya VS Code agents UI surface-engineering (Aaron's testing this
  independently)
- Auto-mode classifier verification on Soraya's surface (Aaron's testing)
- Multi-Soraya coordination (one Soraya identity; multiple surfaces; persona-folder
  is canonical state per identity-stays-unified discipline)
