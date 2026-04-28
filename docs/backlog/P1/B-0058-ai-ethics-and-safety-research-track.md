---
id: B-0058
priority: P1
status: open
title: AI ethics + safety research track — filter-gate for resonance adoptions + alignment-clause consistency audit
tier: substrate-foundational-discipline
effort: L
ask: Aaron 2026-04-21 — *"ai ethic and safety backlog whoops we should have done that first"* followed immediately by *"high on backlog"*. **CHRONOLOGY NOTE:** Aaron's later self-correction upgraded this from P2 to P1; chronologically filed AFTER B-0056 (mythology) and B-0057 (occult), but structurally gates them earlier. This row preserves both facts.
created: 2026-04-26
last_updated: 2026-04-26
composes_with: [docs/ALIGNMENT.md, .claude/agents/alignment-auditor.md, feedback_preserve_real_order_of_events_dont_retroactively_reorder_by_priority.md, user_faith_wisdom_and_paths.md, feedback_blast_radius_pricing_standing_rule_alignment_signal.md, feedback_operational_resonance_engineering_shape_matches_tradition_name_alignment_signal.md, B-0056, B-0057, B-0059]
tags: [ai-ethics, ai-safety, alignment, sova, alignment-auditor, HC-clauses, SD-clauses, DIR-clauses, filter-gate, resonance-adoptions, consistency-audit, blast-radius, P1-priority-upgrade, chronology-preserved]
---

# B-0058 — AI ethics + safety research track (P1)

## Origin

AceHack commit `5990166` (2026-04-21). Aaron's *"ai ethic and safety backlog whoops we should have done that first"* + *"high on backlog"*.

## Chronological annotation (preserved per chronology-preservation memory)

This row was filed **LATER** in the session than the mythology + occult P2 rows (B-0056 + B-0057). Aaron's self-correction *"whoops we should have done that first"* is a retrospective priority-judgment, captured verbatim here.

Tier placement at **P1** reflects substrate-foundational precedence (ethics+safety gates adoption of everything downstream); filing-order-after-mythology-and-occult is preserved as the real order of events per Aaron's directive.

The memory file `feedback_preserve_real_order_of_events_dont_retroactively_reorder_by_priority.md` tracks the full principle: priority-upgrade ≠ chronology-overwrite, ease-of-rewrite ≠ permission-to-rewrite, blast-radius assessment before any historical modification, current history stands.

## What this track owns

A filter-gate applied to every candidate adopted from the downstream research tracks (etymology+epistemology B-0059, mythology B-0056, occult B-0057, and any future resonance-family row), plus a cadenced audit of every new skill / persona / kernel-vocabulary entry / glossary term / governance-section against the alignment clauses in `docs/ALIGNMENT.md` (HC-1..HC-7 / SD-1..SD-8 / DIR-1..DIR-5).

The substrate already exists — this row does NOT build it from scratch. It formalizes the use-pattern.

### 1. Retractibility-and-log check (not veto)

Per math-safety memory the gate's job is to verify that any candidate adoption preserves retractibility (additive rewrite, git-tracked, one-commit removable) and lands in the log. The three-filter discipline (F1/F2/F3) tests structural match; this check ensures the adoption operation itself is retractible and audit-visible.

No candidate is blocked merely for being edgy — blocking would itself be a prose-safety-hedge that hurts crystallization without adding retractibility information. Blocking is reserved for operations that break retractibility (e.g., force-publication to a distribution channel we cannot rescind).

### 2. New-surface audit

Every new skill under `.claude/skills/**`, persona under `.claude/agents/**`, glossary entry in `docs/GLOSSARY.md`, and BACKLOG row at P0/P1 runs through an alignment-clause consistency check. Fires at author-time (prevention surface) and on a cadence (detection surface). Same shape as the skill-data/behaviour-split audit, but on alignment-clause compliance rather than mix-signature.

### 3. Candidate-failure honesty log

Candidates that fail the ethics+safety gate are recorded as failure-data on the honesty dashboard, NOT silently dropped. Rubber-stamping is the exact failure-mode the three-filter discipline exists to prevent — this gate extends that discipline into the ethics axis.

### 4. Alignment-clause drift detector

If a clause in `docs/ALIGNMENT.md` is about to be weakened or removed via the renegotiation protocol, this track generates the impact-survey across factory surfaces that touch the clause. Answers "who depends on this clause, and what breaks if it moves?" before the renegotiation is accepted.

### 5. Blast-radius-before-rewrite discipline audit

Every retractibly-rewrite operation on memory / BACKLOG / ADRs / skills / personas passes the four blast-radius questions from the chronology-preservation memory. Current history stands unless the questions clear.

## Why this is substrate, not research

Zeta's primary research focus is **measurable AI alignment** (`docs/ALIGNMENT.md`, `GOVERNANCE.md`). The alignment-auditor (Sova) persona and the HC/SD/DIR clause structure already exist. This row does not propose new substrate; it proposes a **use-discipline** for the existing substrate, applied across the new research tracks filed this session.

Aaron's *"we should have done that first"* is the real signal — the research tracks below P2 were filed without this explicit gate, which is the priority inversion Aaron self-corrected. The gate now lands at P1, upstream of the research tracks at P2, in structural priority. **Chronologically it landed later; structurally it gates earlier.**

## Relation to existing rules

Does NOT replace `GOVERNANCE.md` §N clauses, `docs/ALIGNMENT.md` clauses, BP-NN rules, or any specialist-reviewer (alignment-auditor / threat-model-critic / security-researcher / prompt-protector) scope. Coordinates them as a single gate for the new research-track adoptions specifically. Coverage overlap is feature, not bug — multiple gates catching the same issue is the resilience pattern.

## Why P1 not P0

P0 is ship-blocker. No ship is pending that blocks on this row. P1 is "within 2-3 rounds" — that's the right cadence: the research tracks won't surface promotable candidates faster than 2-3 rounds, so the gate needs to land before the first candidate reaches the adoption step.

## Owner / effort

- **Owner:** Alignment-auditor (Sova) leads; Architect (Kenji) integrates across the research tracks; Aaron signs off on any candidate adoption.
- **Effort:** L — formalization work plus cadenced audit standup; bounded by the existing alignment substrate (not from-scratch). First milestone: author an audit-procedure skill (or extend the alignment-auditor skill) that applies the five responsibilities above. Subsequent milestones: fire-history surface under `docs/hygiene-history/`, alignment-clause-drift detector script under `tools/`, BACKLOG triage workflow.

## Retractibility-protecting constraints

Does NOT force-push committed ALIGNMENT.md revisions; does NOT bypass the alignment-clause renegotiation protocol; does NOT ship factory releases with broken retraction algebra or missing audit log. Coordinates with Nazar (runtime), Aminata (threat model), Mateo (proactive research), Nadia (prompt layer) as horizontal gate, not replacement.

## Cross-reference

- AceHack commit: `5990166`
- `docs/ALIGNMENT.md` — the HC-1..HC-7 / SD-1..SD-8 / DIR-1..DIR-5 clauses this row's gate applies
- `.claude/agents/alignment-auditor.md` — Sova persona advisory authority for the gate
- Chronology-preservation memory — discipline for the filing annotation above
- Sibling rows: B-0056 (mythology), B-0057 (occult), B-0059 (etymology+epistemology) — gate applies to each
