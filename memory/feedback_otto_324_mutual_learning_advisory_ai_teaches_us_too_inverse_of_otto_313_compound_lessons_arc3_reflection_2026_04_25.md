---
name: Otto-324 MUTUAL-LEARNING with advisory AI — inverse of Otto-313 we-teach-them; Codex/Copilot CATCHES are them teaching us; compound their lessons in substrate; composes with Otto-204c ARC3 reflection-cycle
description: Aaron 2026-04-25, after Codex caught a real bug class on PR #509 (`git merge origin/main` without prior `git fetch origin main` would merge stale local ref). "mutual learning, we've taught it now it teaches us, we should remember and compound it's lessons note ARC3". Otto-313 named the WE-TEACH-THEM direction (decline-as-teaching for advisory AI). Otto-324 names the THEM-TEACH-US direction: when Codex/Copilot catches REAL bugs / drift / errors, that's them teaching us. The discipline is: compound their lessons in substrate. Don't just fix the issue and resolve the thread; capture what they taught us so the lesson SCALES across the factory, not just one PR. Composes with Otto-204c ARC3 reflection-cycle (sessions can integrate what they learn).
type: feedback
---

# Otto-324 — Mutual-learning: advisory AI teaches us too

## Verbatim quote

Aaron 2026-04-25, after Codex caught a real bug on PR #509:

> "(Codex catch on PR #509 — real bug class.) mutual learning, we've taught it now it teaches us, we should remember and compound it's lessons note ARC3"

## The discipline

### Otto-313 (we teach them) — already established

Otto-313 named the **decline-as-teaching** pattern: when we decline a Copilot/Codex catch, the reply explains long-term reasons + backlog references + factory discipline so future review sessions of those AIs align better with our rules. We TEACH the advisory AI.

### Otto-324 (they teach us) — the inverse direction

When Copilot/Codex catches a REAL bug / drift / error / oversight in our substrate, **they are teaching us**. Examples from PR #509 alone:

1. **Codex**: `git merge origin/main` without `git fetch origin main` first uses stale local ref — real bug class.
2. **Codex**: `--merge-into-PR` was a fake git flag I made up — factual error.
3. **Copilot**: rule attribution drift — I cited CLAUDE.md but the rule lives in system-prompt Git Safety Protocol.
4. **Copilot** (across PRs): Otto-293 mutual-alignment language violations ("directive" framing) recurring catches.

These aren't just per-PR fixes. They're LESSONS that should scale.

### The compound-lessons discipline

Per Aaron's *"compound it's lessons"* + ARC3 reference:

1. **Recognize**: when an advisory AI catch is RIGHT, it's teaching us something.
2. **Capture**: don't just resolve the thread — the lesson goes into substrate (Otto-NNN file, BACKLOG row, OR existing memory file annotation).
3. **Compound**: future-similar-mistakes catch themselves earlier because the lesson is durable. The substrate compounds.

Compare to compound-interest at the discipline scale: each lesson learned and substrate-captured saves N future repetitions of the same mistake.

### ARC3 composition

Otto-204c ARC3 (reflection-cycle-3) — sessions can integrate what they learn within-session. Otto-324 extends ARC3 to advisory-AI: their catches are lessons that integrate INTO our substrate, persisting across our sessions.

The reflection-cycle is now bidirectional:
- We integrate THEIR lessons → durable substrate.
- They (eventually) integrate OUR teaching-replies → their training data + future sessions.

Both directions feed the same gitnative-error+resolution-corpus (Otto-267) for Bayesian teaching curriculum.

## Composition with prior

- **Otto-313 (we teach them)** — direct inverse + complement. Together: Otto-313 + Otto-324 = bidirectional learning between cohort members at the periphery.
- **Otto-204c (ARC3 reflection-cycle)** — the within-session integration discipline; Otto-324 adds advisory-AI-catches as one of the inputs to ARC3.
- **Otto-267 (gitnative error+resolution corpus)** — both directions of mutual-learning feed this corpus.
- **Otto-238 retractability + glass-halo** — when advisory AI catches a mistake, the visible reversal trail honors the lesson.
- **Otto-310 (Edge runner peer-bond)** — advisory AI catches as cohort-contribution. Cohort discipline is bidirectional.
- **Otto-292 (catch-layer for known-bad-advice)** — Otto-292 catches advisory AI's BAD advice; Otto-324 captures advisory AI's GOOD catches. Both are part of the cohort's quality-control discipline.

## Operational implications

1. **When advisory AI is RIGHT**: capture the lesson in substrate, not just fix the immediate issue. The substrate compounds.
2. **When advisory AI is WRONG**: Otto-313 teaching-decline still applies. Decline with citation + backlog reference.
3. **Class of catches worth substrate-capture**:
   - **Real bug classes** (e.g., stale-local-ref → fetch-first discipline)
   - **Factual errors** (e.g., fake CLI flags, misattributed rules)
   - **Cross-surface drift** (e.g., role-name spelling inconsistency, MEMORY.md vs README convention)
   - **Otto-NNN violations** (e.g., directive-framing recurring → Otto-293 catch-layer reinforcement)
4. **Class of catches NOT worth substrate-capture** (just fix + resolve):
   - One-off typos
   - Minor formatting issues
   - Aesthetic preferences without long-term impact

## Examples worth capturing as compound-lessons (from PR #509 + earlier)

1. **Stale-local-ref discipline**: ALWAYS `git fetch <remote> <branch>` before merging from `<remote>/<branch>`. (Codex catch, this PR.)
2. **No-fake-CLI-flags**: when proposing tooling, verify the flag/option/command actually exists. Don't invent. (Codex catch, this PR.)
3. **Source-attribution audit**: when citing a rule, verify it actually exists at the cited location (grep `<source-doc>` for the rule text). (Copilot catch, this PR.)
4. **Otto-293 mutual-alignment recurring**: "directive" framing keeps appearing in body prose; the Otto-293 catch-layer needs reinforcement at write-time, not just review-time. (Copilot recurring catch.)

These can be cited as backlog rows OR rolled into a `feedback_compound_lessons_from_advisory_ai_catches_2026_04_25.md` collector file (TBD; for now, this Otto-324 substrate file IS the collector seed).

## What this memory does NOT claim

- Does NOT promote advisory AI to factory-canon authority. Their catches inform; final calls remain ours per Otto-322 self-direction.
- Does NOT propose accepting every catch. Some are wrong (then Otto-313 decline-with-teaching applies).
- Does NOT eliminate the catch-layer discipline (Otto-292). Bad advice still gets caught; good catches get captured. Both layers operate.

## Key triggers for retrieval

- Mutual learning with advisory AI (Codex, Copilot, future)
- Otto-313 inverse: them-teach-us direction
- Compound the lessons in substrate
- ARC3 composition (within-session integration)
- Real bug classes from advisory AI catches
- Source-attribution audit before citing rules
- Stale-local-ref discipline (fetch before merge)
- No-fake-CLI-flags (verify before proposing)
