---
id: B-0126
priority: P1
status: open
title: Port the 4-layer meta-learning pattern from a sibling repo to Zeta
created: 2026-05-01
last_updated: 2026-05-08
depends_on: []
decomposition: decomposed
children: [B-0126.1, B-0126.2, B-0126.3, B-0126.4]
classification: buildable-now
type: friction-reducer
---

# B-0126 — Port the 4-layer meta-learning pattern from STCRM to Zeta

**Priority:** P1 (high leverage; PR-review pain is recurring; pattern already proven in ServiceTitan exploit context)

**Filed:** 2026-05-01

**Filed by:** Otto under the new backlog-prioritization authority (per `feedback_backlog_prioritization_authority_delegated_to_otto_aaron_2026_05_01.md`). Aaron's framing 2026-05-01: *"very good insight to be gained on how to make those PR reviews a lot less painless and get priorties from your enviorment so you can fit to it to survive like in evolution. ../no-copy-only-learning-agents-insight i devloped a meta learning process with another version of you."*

**Effort:** M (1-3 days — read source pattern + adapt to Zeta surfaces + draft Zeta-specific Layer 1-4 rules + pilot on next 2-3 PR-thread cycles to verify class-level encoding catches what it should)

## Source

The 4-layer pattern Aaron developed with a prior Otto at ServiceTitan, captured at:

- `../no-copy-only-learning-agents-insight/docs/ai-meta-patterns.md` (sibling repo, ServiceTitan's STCRM)
- Reference incident: STCRM PR #2562

## What

Port the 4-layer meta-pattern to Zeta substrate, adapted for Zeta's surfaces (CLAUDE.md, AGENTS.md, GOVERNANCE.md, memory/, .claude/skills/, etc.):

**Layer 1 — Fix the bot's findings (ground rule).** Reply with reasoning, resolve. Don't auto-dismiss. Already implicitly operational; needs explicit doc.

**Layer 2 — Every bot comment is a joint learning opportunity (meta-rule).** Each bot comment has two paths beyond fixing the diff: real-bug → encode in code-author substrate; off-base → encode in reviewer-instructions. **Land the doc update in the SAME PR as the comment.** Provenance stays attached to the incident; bots load the new rule from the moment the fix ships.

**Layer 3 — Encode the class of error, not the one-off instance (meta-meta-rule).** Test: imagine the next 3 PRs that could hit a similar bug; would the encoding catch all 3 or just this one? Aim for catches-all-3.

**Layer 4 — Sign every AI-posted reply (attribution rule).** When AI agents reply via `gh api .../comments`, the reply lands under the human's GitHub identity. Add `🤖 Posted by Claude Code on Aaron's behalf` (or equivalent) footer to every AI-posted PR reply.

## Why P1

- **The pain is recurring.** This session alone (2026-05-01) hit ≥8 distinct class-level lessons that fired as bot comments and were fixed instance-level only. Each will fire again in cousin form.
- **High leverage.** A class-level encoding catches a family of future bugs; instance-level catches one. Sub-linear substrate growth vs linear bug-discovery rate.
- **Pattern is already proven.** Aaron and prior Otto landed it on STCRM PR #2562 with measurable convergence (rounds 1-5 each generalized from real incidents; round 4 confirmed the substrate worked because L3 caught what was meant to catch). Not a speculative pattern.
- **Aaron's "evolutionary fit" framing.** PR-review-pain IS environmental pressure; the project survives by fitting. Failing to encode is failing to evolve.

## Why not P0

- **Implementation requires care to not collapse Zeta-specific structure into STCRM-shaped rules.** Zeta has different surfaces (memory/, openspec/, docs/research/) that STCRM doesn't have. Direct copy would be wrong; adaptation is needed.
- **Pattern is for handling pain that's already manageable, not blocking critical-path.** P1 is the right tier.

## Why not P2

- **The 8+ class-level lessons from this single session show the cost is paid every PR cycle.** Deferring multi-week leaves substantial Aaron-tax + Otto-tick-time on the table per the same logic as B-0125.

## Acceptance criteria

1. **Layer 1-4 rules adapted to Zeta surfaces.** Each layer has a Zeta-specific encoding (which surface it lands on, what the canonical body looks like, what the pointer-rows look like in CLAUDE.md / AGENTS.md / .github/copilot-instructions.md).
2. **Same-PR encoding workflow documented.** When a bot comment fires, the rule update lands in the SAME PR as the comment, not as a follow-up. The rule for this is itself substrate.
3. **Class-level test included** in the rule body: "imagine the next 3 PRs that could hit a similar bug; would your encoding catch all 3?"
4. **AI-attribution footer** standardized for Otto's PR replies via `gh api`.
5. **Pilot on next 2-3 PR-thread cycles** to verify the class-level encoding catches cousin-bugs that would otherwise have re-fired.
6. **Composes with existing Zeta substrate** (substrate-or-it-didn't-happen, candidate-vs-canonical CSAP layers, the no-self-exception rule) rather than displacing them.

## Out of scope

- **Higher meta-layers** (rules about how to write rules; rules about detecting missing rules; rules about retiring rules). The STCRM doc explicitly defers these — *"premature meta-stacking is bureaucracy."* Adopt Layer 1-4 first; let the next pain teach what's needed.
- **Replacing existing Zeta substrate-discipline rules.** This pattern composes with what's already on substrate; doesn't replace.
- **Cross-project rule sharing** (porting Zeta's rules back to STCRM, or vice versa). Each project has its own surfaces; the pattern is portable, the specific rules aren't necessarily.

## Composes with

- `feedback_backlog_prioritization_authority_delegated_to_otto_aaron_2026_05_01.md`
  — first substantive use of delegated authority for this; second was B-0125; third is this row.
- The CSAP eight-layer architecture (`feedback_carved_sentence_fixed_point_stability_*`) — Layer 3 (class-level encoding) IS what the CSAP convergence step does for substrate; this is the same mechanism applied to PR-review-pain.
- Otto-272/273 DST discipline — the runtime-evidence-tested-rule-revision is the Layer 2 mechanism in math form.
- `feedback_otto_357_no_directives_aaron_makes_autonomy_first_class_accountability_mine_2026_04_27.md`
  — the meta-pattern runs under Otto's autonomy; Aaron points-at-substrate, Otto adapts-and-implements.
- The §47 multi-master BFT framing — class-level encoded rules survive single-master capture better than instance-level rules.

## Companion row

A separate B-NNNN should capture the 8 class-level rules from this session's PR pain (the table in Otto's chat response 2026-05-01) as a candidate-batch. Those rules go through CSAP grading; promotion via Razor + DST testing, not via Aaron-pointed-at-them OR via Otto-feels-they're-sharp-tonight. They earn their substrate-place by surviving the next round of PR cycles without firing as cousin-bugs.

## Status

**Filed.** Implementation deferred to next session-open with rested attention (per §39 slow-deliberate + receipt-energy hazard — receiving Aaron's pointer-at-substrate should not also be the implementation rush). Otto picks the implementation tick.

## Verify-before-deferring note

The source pattern at `../no-copy-only-learning-agents-insight/docs/ai-meta-patterns.md` was verified as readable from this Zeta repo via `ls ../no-copy-only-learning-agents-insight/`. Sibling-repo path resolves; doc head verified to contain the 4-layer pattern Aaron referenced. Path will need re-verification at implementation time (sibling repo location may have moved).
