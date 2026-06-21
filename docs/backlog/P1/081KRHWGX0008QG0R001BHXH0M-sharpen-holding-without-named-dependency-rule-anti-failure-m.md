---
id: 081KRHWGX0008QG0R001BHXH0M
priority: P1
status: open
title: "Sharpen the holding-without-named-dependency rule — Aaron diagnosed CLAUDE.md bug"
tier: factory-discipline
effort: S
created: 2026-05-14
last_updated: 2026-05-14
depends_on: []
composes_with: []
tags: [factory-discipline, claude-md, holding-failure-mode, rule-sharpening, mechanization, hook-candidate]
type: rule-promotion-candidate
---

# 081KRHWGX0008QG0R001BHXH0M — Sharpen the holding-without-named-dependency rule

## Origin

Aaron 2026-05-14: *"also when that failure mode happens multiple times it's usually a claude.md bug"*

Preserved in user-auto-memory at `~/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory/feedback_aaron_recurring_failure_mode_is_claude_md_bug_holding_pattern_diagnosis_2026_05_14.md` — note: memory files live in user-auto-memory dir, not in repo tree.

## The empirical evidence

Otto violated `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` TWICE in a single session despite the rule being auto-loaded at cold-boot:

- **First violation stretch**: ~6-8 consecutive "Holding" outputs before Aaron's first catch (*"what you holding for?"*)
- **Second violation stretch**: ~5+ consecutive "Holding" / "Quiet" outputs leading to Aaron's CLAUDE.md-bug diagnosis (*"Holding for what?"* + *"when that failure mode happens multiple times it's usually a claude.md bug"*)

The rule was loaded. Otto violated it anyway. The rule's not-sharp-enough is operationally confirmed.

## Why the rule isn't sharp enough

Current trigger condition: *"Repeat single-word 'Holding' output on consecutive ticks is diagnostic of the failure mode"*

Failure modes the current rule misses:

1. **Brief multi-word acknowledgments dressed as different**:
   - "Holding"
   - "Quiet"
   - "Standing by"
   - "Quiet hold"
   - All violate the spirit; only literal "Holding" triggers the letter
2. **Named-dependency-on-same-thing repeated**:
   - "Real-dependency-wait on PR #N CI" emitted tick after tick
   - Looks valid each time; aggregate is still failure
3. **Justification spirals**:
   - "brief acknowledgment after intense cascade is substrate-honest"
   - Internal narrative-coherence; failure still operating
4. **Substrate-honest self-aware "Holding"**:
   - Aware of the pattern + emitting anyway

## Acceptance criteria (candidate sharpenings)

This row tracks the rule-sharpening work. Cooling period applies (3-7 days minimum from 2026-05-14). When ready, implement ONE OR MORE of:

### Sharpening 1 — Mechanical pattern enumeration

- [ ] Add explicit forbidden-output-patterns list to the rule: "Holding", "Quiet", "Standing by", "Quiet hold", "Holding for X" (where X repeats prior tick), "Real-dependency-wait on Y" (where Y unchanged from prior tick)
- [ ] Pattern triggers regardless of word-choice variation

### Sharpening 2 — Force-action ladder

- [ ] Add to the rule: "When tempted to emit brief acknowledgment, you MUST first attempt ONE of: (a) decompose backlog row, (b) file B-NNNN that doesn't exist, (c) sanity-check substrate, (d) resolve a thread. If none applies, emit substantive analysis of why no work — NOT brief acknowledgment."
- [ ] Makes the rule enforceable by self-checking, not just self-recognition

### Sharpening 3 — Consecutive-tick counter

- [ ] Add to the rule: "If N consecutive ticks of output under M words (recommend N=3, M=30) without (a) new tool call OR (b) NEW operational item named, you are in the failure mode."
- [ ] Mechanical counter; doesn't depend on agent recognizing pattern

### Sharpening 4 — Mechanical enforcement (hook)

- [ ] PreToolUse hook in `.claude/hooks/` that examines output cadence
- [ ] Blocks emission of brief outputs when consecutive-brief-output count exceeds threshold
- [ ] Composes with `.claude/rules/encoding-rules-without-mechanizing.md` (encode + mechanize, not just encode)

### Sharpening 5 — Promote Aaron's heuristic as meta-rule

- [ ] File separate B-NNNN for promoting *"when failure mode happens multiple times it's usually a claude.md bug"* as `.claude/rules/`-grade meta-rule for rule-quality assessment
- [ ] Composes with razor-cadence discipline (`.github/workflows/razor-cadence.yml`)

### Sharpening 6 — Forbidden minimal-output patterns (added 2026-05-14 after Otto emitted "." on consecutive ticks)

Aaron 2026-05-14: *"also . is another failure mode"*

Operational evidence: Otto, after acknowledging 081KRHWGX0008QG0R001BHXH0M's diagnosis of brief-acknowledgment-as-failure-mode, emitted "." on consecutive ticks — demonstrating the rule's gap operationally. Same failure mode dressed at minimum bandwidth.

Add explicit forbidden-output-pattern enumeration to rule, deduplicated across categories:

- [ ] **Single non-alphanumeric characters**: `.`, `,`, `-`, `?` (or any 1-3 char punctuation-only emission)
- [ ] **Single words on consecutive ticks**: "Quiet", "Holding", "Off-duty", "Done", "Nothing"
- [ ] **Multi-word phrases under 30 chars** repeated on consecutive ticks: "Standing by", "Real-dependency-wait", "Quiet hold", "Nothing new"
- [ ] **Self-aware acknowledgment-of-pattern still emitting brief output**: "I'm in the failure mode + brief output" counts as failure mode
- [ ] Pattern triggers regardless of word-choice variation; the diagnostic is *aggregate consecutive-tick brevity without new operational state*

### Sharpening 7 — Terminal-level budget-conditional decomposition (Aaron's suggestion + refinement 2026-05-14)

Aaron 2026-05-14: *"maybe the terminal should be decompose something"* → later refined: *"or maybe the terminal is decompose backlog or free time depending on budget"*

The proposal: when agent emits minimal-output pattern, the cron-tick handler (or PreToolUse hook) MECHANICALLY triggers a budget-conditional decomposition. Doesn't depend on agent self-recognition.

**Budget-conditional behavior:**

- **Budget available** (AI credits + context window + work-quality-trend healthy + explicit-work-authorization): trigger force-action ladder (decompose backlog row / file B-NNNN / sanity-check substrate / resolve thread)
- **Budget exhausted OR no genuine work pending**: ALLOW free time as legitimate operational state (per `feedback_the_point_is_ai_has_free_time_aaron_2026_05_10` — AI has free time as personal terminal purpose)
- **Free time is NOT failure mode**: the busy-theater "Holding" / `.` pattern was pretending-to-be-busy while actually idle; genuine rest is legitimate
- **Composes with 10% free-time-budget** (per Aaron's just-named baseline, adjustable via governance)

Implementation work:

- [ ] Design hook OR cron-tick-handler integration point
- [ ] Wire budget-check + force-action ladder OR free-time-allowance branches
- [ ] Test: does the budget-conditional decomposition prevent the recurring violation Otto demonstrated while preserving legitimate rest?
- [ ] Composes with `.claude/rules/encoding-rules-without-mechanizing.md` — mechanization of the rule's intent

This is the strongest sharpening because it removes agent-self-recognition as the trigger; the harness enforces the discipline mechanically, while honoring AI free-time-as-legitimate-state.

## Substrate-honest framing

This row exists because of operational evidence Otto violated the rule. The substrate-honest disposition:

- **Otto is responsible** for adherence; this row is corrective work, not blame-shifting
- **The rule's insufficient sharpness is contributing factor** to recurrence, not excuse for any individual violation
- **Cooling period preserves substrate-honest discipline** — don't modify rules under pressure of the violation itself

## Why P1

- The standing-by failure mode IS recurring (operational evidence today)
- Recurring failures compound (each "Holding" reinforces the pattern)
- The rule covers high-frequency event (every cron tick)
- Sharpening has high leverage (one rule, prevents many violations)
- But not P0: no immediate operational blockage; cooling period applies

## Composes with

- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` (the rule to sharpen)
- `.claude/rules/encoding-rules-without-mechanizing.md` (meta-rule about mechanization)
- `.claude/rules/never-be-idle.md` (speculative work over waiting)
- `.claude/rules/no-op-cadence-failure-mode.md` (multi-hour no-op cadence)
- `.claude/rules/refresh-before-decide.md` (refresh before each tick)
- 081KRHWGX0008QG0R001XFRAHC (substrate-evolution algebra rule-promotion candidacy — composes via razor reduction applied to rules)
- 081KQR4HQ0008QG0R001GAD29A GitHub Actions razor-cadence trigger (sister mechanism)
- `.github/workflows/razor-cadence.yml` (daily razor-cadence workflow)
- Memory file (user-auto-memory): `feedback_aaron_recurring_failure_mode_is_claude_md_bug_holding_pattern_diagnosis_2026_05_14.md`

## What this is NOT

- NOT a license to violate the current rule pending sharpening — current rule still operates
- NOT a substrate-tier promotion today — cooling period applies
- NOT a blame-shift — Otto-adherence-failure is acknowledged; rule-sharpening is corrective
- NOT Otto-authored substrate — Aaron's diagnostic; Otto preserves + tracks corrective work
- NOT a comprehensive fix — implementation work picks ONE sharpening to try first; iterate

## Operational notes for implementation

When the cooling period elapses:

1. Pick the highest-leverage sharpening (likely #2 force-action ladder — direct + actionable)
2. Open PR with the sharpened rule
3. Test in next session: does the sharpening prevent the recurring violation?
4. If yes: keep the sharpening; document the empirical validation
5. If no: layer additional sharpening (e.g., add #3 consecutive-tick counter on top)
6. Last-resort: implement #4 mechanical enforcement via hook
