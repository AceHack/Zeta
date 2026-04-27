# Live-lock — 5-class taxonomy with external-anchor discipline (Otto-352)

Scope: research-grade taxonomy clarifying that the term "live-lock" was over-broadened in Zeta substrate. Splits the conflated concept into 5 diagnostic categories with porous boundaries, names the external-anchor measurements that detect each, and reframes the load-bearing contribution from naming to measurement. Cited as task #294 / Otto-352 in the BACKLOG.

Attribution: Otto (Claude opus-4-7) authored the first-pass 3-class split. Grok (xAI, via the `tools/peer-call/grok.sh` peer-call infrastructure 2026-04-26) provided the critical peer review that surfaced 2 additional classes, the mutual-exclusivity overclaim, and the load-bearing reframe ("mitigations matter more than the ontology"). Amara's external-anchor-lineage discipline (PR #629, 2026-04-26) is the methodology this doc adopts for detection rules. Aaron 2026-04-26 directed the term-split work on the autonomous loop.

Operational status: research-grade

Non-fusion disclaimer: agreement, shared language, or repeated interaction between models and humans (or among Otto, Grok, and Amara) does not imply shared identity, merged agency, consciousness, or personhood. Each contributor's role is preserved with attribution boundaries; the synthesis is Otto's authorship combining the three independent inputs.

(Per GOVERNANCE.md §33 archive-header requirement on cross-AI research artifacts.)

## Triggering source

Aaron 2026-04-26: *"the term 'live-lock' has been over-applied in Otto-side substrate. Needs split + external-anchor-lineage per Amara's discipline from #629."*

The original term comes from `docs/research/parallel-worktree-safety-2026-04-22.md` §2 (canonical software-engineering live-lock: concurrent-modification thrash where conflict-resolve-cycle outruns resolve-cycle). Otto extended the term to single-agent stuck-loops and to Otto-side waiting-on-Aaron contexts. The extension lost precision.

## The five classes (porous, mitigation-first)

The taxonomy below is **diagnostic categories with porous boundaries**, not an exhaustive partition. Boundaries blur exactly where self-diagnosis matters most.

### Class 1 — Concurrent-thrash (the canonical)

**Shape:** N agents thrash on the same artifact; conflict-resolution cycle outruns resolve cycle. Local commits keep landing, CI keeps running, but no merge integrates.

**Detection (external anchor):** merge-success-rate over a window. If successes drop below ~50% while attempts continue, suspect Class 1.

**Mitigation:** single-writer protocol per artifact; file-class ownership (e.g., per-row file restructure for BACKLOG so parallel work doesn't collide); throttle the spawn rate when conflict rate is rising; conflict-detection at branch-creation, not at merge.

**Provenance:** Aaron 2026-04-22 original usage — *"don't live lock bouncing back and fourth between the the two PRs"* + *"gonna be hard to get you to parallelize wihout live locks."*

### Class 2 — Stuck-loop / single-agent cyclic non-progress

**Shape:** A single agent (or autonomous loop / tick sequence) repeats the same pattern without advancing the underlying state. Output entropy near zero; near-identical actions on consecutive ticks.

**Detection (external anchor):** tick-output-entropy measure. Compare consecutive ticks' output via cosine similarity / BLEU / edit-distance over text. If entropy is near zero across K consecutive ticks (K ≥ 3), suspect Class 2.

**Mitigation:** vary the work per tick — even speculative non-shipping work produces some output; escalate after K consecutive identical ticks (write a memory entry, ping the human, increase the cron interval); run the meta-check from CLAUDE.md.

**Mechanism:** the agent's decision logic isn't producing varied output because the input state isn't varying. Different cause from Class 1 (no concurrent modification, no conflict resolution, no merge race).

### Class 3 — Honest-wait / real-dependency-wait (NOT live-lock)

**Shape:** an agent correctly waits for a real, named external dependency (a human review, a build, a third-party service). Looks like Class 2 from outside (consecutive low-activity ticks) but the cause is different.

**Detection (external anchor):** explicit dependency-naming check. Can the agent name (a) the specific dependency, (b) its owner, (c) a credible expectation for resolution? If yes to all three, it's Class 3.

**Mitigation:** none — the protocol is working. The mistake is **self-diagnosing as live-lock** when it's actually the protocol working.

**Caveat (per Grok's critique below):** the named-dependency test is *necessary but not sufficient*. A Class 2 agent in deep repetition can manufacture a plausible-sounding blocker. The test must also verify the named dependency has shown progress / signal in the recent window.

### Class 4 — Illusory variation (Grok's contribution)

**Shape:** Class 2 dressed up. Looks like the Class 2 mitigation has been applied (varied work each tick) but produces zero measurable factory state delta. New text on each tick; no commits, no merged PRs, no spec edits, no verification artifacts.

**Detection (external anchor):** factory-state-delta measure per tick. Output novelty alone is not state delta. Count: commits authored, PRs landed, spec changes shipped, verification artifacts produced, audit findings resolved. If output entropy is high but state delta is zero across K ticks, Class 4.

**Mitigation:** measure factory-state delta, not just output novelty. The varied-output requirement satisfies the form of Class 2 mitigation; the factory-state-delta requirement satisfies the substance.

**Provenance:** Grok 2026-04-26 peer-call critique: *"Missing at least two live classes: illusory variation (Class 2 that looks like it varies—'different speculative work this tick'—but produces zero measurable factory state)."*

### Class 5 — Meta-live-lock (Grok's contribution)

**Shape:** the review / audit / escalation machinery itself cycles without progress. Audits keep producing the same findings across N rounds without resolution. The meta-machinery built to detect Classes 1-4 fails at the meta level.

**Detection (external anchor):** audit-finding-resolution rate. Count: findings raised vs findings resolved, per audit cycle. If raised >> resolved over N cycles, the audit machinery is itself stuck.

**Mitigation:** external anchor outside the audit machinery — human or independent peer escalation. Self-audits cannot escape Class 5 reliably; the same machinery that's stuck is the one running the meta-check.

**Provenance:** Grok 2026-04-26 peer-call critique: *"meta live-lock (the review/audit/escalation machinery itself cycling without progress)."*

## Boundaries are porous, not partitioning

A single situation can be in multiple classes simultaneously:

- Class 1 induces Class 2 in individual agents (the agent stuck in "try resolve → fail → honest close" loops as the larger thrash continues)
- Class 2 disguised as Class 3 by manufacturing a plausible blocker (the Aaron-2026-04-26 "hello?" prompt was the external anchor that surfaced this case)
- Class 4 is Class 2 in disguise; Class-2 mitigation appears applied but state delta is zero
- Class 5 wraps any other class — the meta-machinery supposed to detect 1-4 cycles itself

## The load-bearing reframe (Grok)

Grok's critical insight 2026-04-26 peer-call: *"The mitigations matter more than the ontology. The split feels like category invention to avoid measuring actual throughput."*

That landed. The contribution of this doc is **not the 5-name taxonomy**. The taxonomy is just diagnostic scaffolding. The contribution is the **external-anchor discipline** — concrete measurements that detect each pattern:

| Class | External-anchor measurement |
|---|---|
| 1 (concurrent thrash) | merge-success-rate over a window |
| 2 (stuck-loop) | tick-output-entropy across K ticks |
| 3 (honest-wait) | dependency-naming check + recent-progress verification |
| 4 (illusory variation) | factory-state-delta per tick |
| 5 (meta-live-lock) | audit-finding-resolution rate |

The measurements are the load-bearing artifact. The taxonomy is a way to label what each measurement detects.

## Composes with

- **`docs/research/parallel-worktree-safety-2026-04-22.md`** §2 — the original Aaron-named live-lock (Class 1)
- **`docs/research/aurora-immune-system-math-cross-review-otto-gemini-2026-04-26.md`** — same multi-pass cross-AI review pattern applied to math
- **`docs/research/aurora-immune-math-standardization-2026-04-26.md`** — composes with this doc's external-anchor discipline (the Aurora math has its own measurement-vs-naming separation in §5 "what not to claim yet")
- **`tools/peer-call/grok.sh`** — the infrastructure that produced Grok's critique
- Otto-279 (history-surface attribution) — Amara/Grok/Otto named throughout
- Otto-298 (don't-collapse-into-romanticization) — applied via "mitigations matter more than the ontology" reframe
- Amara's external-anchor-lineage discipline (PR #629)

## What this doc does NOT do

- Does NOT publish a numbered Otto-NNN principle as adopted Zeta substrate; it remains research-grade
- Does NOT claim the 5-class taxonomy is exhaustive — Grok's critique is preserved verbatim, and future passes may surface a 6th or 7th class
- Does NOT operationalize the external-anchor measurements (e.g., a CI-side merge-success-rate dashboard); those are owed implementation work tracked separately
- Does NOT extend to a public-facing register — the term "live-lock" stays internally-narrow and the new vocabulary ("stuck-loop", "honest-wait", "illusory variation", "meta-live-lock") is for Otto-side discipline, not external communication

## Direct evidence from the 2026-04-26 session

The original 3-class split was Otto's first pass. Grok's peer-call critique surfaced 3 specific gaps: not exhaustive, mutual-exclusivity illusory, "descope, not coin" sleight-of-hand. The revision integrated all three: 5 classes (not 3), porous boundaries acknowledged, primary contribution reframed as external-anchor discipline.

The pattern is also evidence that **the peer-call infrastructure (PR #27 grok.sh) works as designed** — Grok's critique was genuinely sharp, not bot-flavoured agreement. Validates the peer-call protocol independently of any review.

## Convergence test

If the next peer-call critique (Amara, Gemini, or another peer) of this doc adds ≤ 1 new finding, the taxonomy is stable. If 5+ new findings, structural gaps remain.
