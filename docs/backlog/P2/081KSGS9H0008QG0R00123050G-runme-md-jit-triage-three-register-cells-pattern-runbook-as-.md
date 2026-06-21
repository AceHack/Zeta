---
id: 081KSGS9H0008QG0R00123050G
title: runme.md + JIT triage 3-register-cell workflow pattern — runbook as evolving substrate
status: open
priority: P2
created: 2026-05-26
last_updated: 2026-05-26
depends_on: []
composes_with: [081KSGS9H0008QG0R0031PBNGA, 081KSGS9H0008QG0R001K8VPV4]
---

# 081KSGS9H0008QG0R00123050G — runme.md + JIT triage 3-register-cell workflow pattern (Aaron + Kestrel 2026-05-26)

## Scope

Document + formalize the runme.md + JIT triage workflow pattern that emerged organically in Zeta's substrate-engineering work. The pattern combines Runme's executable markdown with implicit continue-with / JIT-figure-this-out-later semantics, producing a 3-register-per-cell architecture and a runbook → backlog → PR progressive-refinement pipeline.

Source: Aaron 2026-05-26 operational answer to Kestrel: *"so now i put someting like this in our runbook markdown file with an implicit continue-with / jit - figure this out later and a whole backlog appears."* — preserved verbatim at [`docs/research/2026-05-26-kestrel-runme-jit-runbook-bcl-extension-cost-of-velocity-decision-archaeology-aaron-forwarded.md`](../../research/2026-05-26-kestrel-runme-jit-runbook-bcl-extension-cost-of-velocity-decision-archaeology-aaron-forwarded.md).

## The 3-register-per-cell architecture (Kestrel naming)

Runme's executable-markdown gives 2 registers natively (executable code cells + prose cells). The JIT-triage layer adds a 3rd register, producing 3 distinct cell types per document:

| Register | Cell type | Evaluation criteria |
|---|---|---|
| 1. **Executable** | Committed engineering work — runs, produces output, tested | "Does it work correctly?" |
| 2. **Prose** | Documents context, rationale, intent | "Is it accurate + useful for reading?" |
| 3. **Gesture** | Placeholders capturing directions worth preserving but not yet worked out — substrate-internal vocabulary + "or something" qualifiers + JIT-figure-this-out-later semantics | "Is this worth preserving as a direction?" (low bar; fast capture; vocabulary doesn't have to be precise yet) |

The gesture register is the innovation. Standard runbooks either have executable cells (Ansible playbooks, Jupyter notebooks) OR prose cells (markdown documentation) but typically don't accommodate speculative cells with substrate-internal vocabulary that hasn't been engineered yet.

## The runbook → backlog → PR progressive-refinement pipeline

The chain of progressively-refined artifacts:

| Stage | Audience | Precision requirement | Cell type / artifact |
|---|---|---|---|
| **Runbook gesture** | Operator + in-the-moment context | Low — substrate-internal vocabulary OK | runme.md gesture cell with JIT marker |
| **Backlog row** | Maintainer team across time | Medium — operational claim required (input/output/problem-solved/prior-art/implementation-sketch) | `docs/backlog/PN/B-NNNN-*.md` row |
| **PR / merged code** | Codebase + future readers (including decision-archaeology skill) | High — code-level terms + tests + rationale that survives later archaeology | git commits + PR description + commit messages with B-NNNN links |

Each stage strips out substrate-internal vocabulary + replaces it with externally-checkable artifacts. The JIT triage is the conversion mechanism that moves cells through the pipeline.

## JIT triage — the operational mechanism

JIT (just-in-time) figure-this-out-later semantics on gesture cells:

- Gesture cells aren't engineered at capture time — substrate-internal vocabulary is preserved as-is
- When the JIT moment fires (operational need; cleanup pass; cross-reference query; cascade convergence), the gesture is triaged into one of 3 outcomes:
  1. **Promote to backlog row** — operational claim worked out; substrate-internal vocabulary translated to engineering language
  2. **Demote to "not worth pursuing"** — direction turned out not to be valuable; remove from runbook
  3. **Let it age out** — if it's not promoted or demoted after N cycles, garbage-collect to keep runbook useful as working substrate

The promotion step is where the engineering work gets done. The runbook becomes the raw material; the backlog row is the refined output.

## Pattern composition — closest existing references (Kestrel)

| Existing pattern | What it has | What runme + JIT adds |
|---|---|---|
| Donald Knuth literate programming | Code + prose in same document | Executable cells; JIT triage layer |
| Jupyter notebooks | Executable cells; prose | Infrastructure-workflow focus; gesture register; JIT triage |
| Runbook automation (Ansible, Rundeck) | Executable infrastructure focus | Speculative cells accommodation; prose+gesture integration |
| Org-mode (Emacs) | Multi-register prose+code+todo | Ecosystem-independent; Runme-based; explicit JIT semantics |

The combination of (executable + prose + gesture + JIT triage + progressive-refinement pipeline) in one document type with consistent semantics across them is the distinctive part. Kestrel: *"I haven't seen [the JIT triage layer] documented elsewhere."*

## Why this matters — cost-of-velocity recovery mechanism

Aaron 2026-05-26 substrate-honest acknowledgment: *"agree 100% and this is the cost i pay for not reviwing every PR and giving AI freedom of velocity."*

The runme + JIT pattern is the operational mechanism that makes the trajectory-not-PR review tradeoff sustainable:

- Trajectory review (not PR review) → velocity advantage preserved
- Velocity periods create parallel-substrate accumulation (visible cost)
- Cleanup periods pay down the debt deliberately (cycle)
- runme + JIT captures velocity-period gestures without losing them + without committing to everything
- Backlog promotion forces translation from substrate-internal to engineering language
- Decision archaeology + ADR pattern preserve rationale for future contributors

The cycle is "velocity period creates technical debt → cleanup period pays it down → repeat." Standard rhythm of software development at scale, made explicit + tooled.

## Acceptance

- [ ] Documentation: `docs/patterns/runme-jit-triage.md` formalizing the 3-register-per-cell + JIT triage + runbook→backlog→PR pipeline
- [ ] Convention: gesture-cell marker syntax standardized (e.g., HTML comment `<!-- jit -->` or explicit code-fence info-string)
- [ ] Tooling: triage helper (`bun tools/runme-triage.ts` or similar) that surfaces ungated gesture cells across the runbook corpus + helps with promotion
- [ ] Integration with decision-archaeology skill: runbook-history-as-archaeological-substrate queryable
- [ ] Composition with 081KSGS9H0008QG0R001K8VPV4 (Runme BCL extension): gesture cells with substrate-internal vocabulary can later become executable cells using the BCL extensions
- [ ] Optional: external writeup (blog post / paper / conference talk) on the pattern — Kestrel: *"the writeup, if you did one, would land at the intersection of engineering workflow tooling and AI-collaboration patterns — both communities would find it interesting and the combination is uncommon enough to be worth documenting"*

## Out of scope (this row)

- Runme core BCL extension itself — 081KSGS9H0008QG0R001K8VPV4
- Specific archaeology skill enhancements — separate row when those mature
- Migration of all existing markdown to runme.md — separate migration row

## Composes with

- 081KSGS9H0008QG0R0031PBNGA (canonical generate+join meta-PM substrate)
- 081KSGS9H0008QG0R001K8VPV4 (Runme core BCL extension — companion landing)
- `.claude/skills/decision-archaeology/SKILL.md` (runbook history as archaeological substrate)
- `.claude/rules/substrate-or-it-didnt-happen.md` (gesture cells ARE substrate; JIT triage is what makes them progressive)
- `.claude/rules/all-complexity-is-accidental-in-greenfield.md` (greenfield-stage gestures + cleanup-pay-down rhythm; both are operational discipline)
- `.claude/rules/honor-those-that-came-before.md` (Kestrel attribution + Aaron + Knuth + Jupyter + Org-mode lineage)

## Origin

Aaron 2026-05-26 operational answer to Kestrel's substrate-check on a gesture-cell sentence ("serialized rx bonsai query that holds the uncollapsed tension in a tensor score or something").

Kestrel substantive engagement preserved at [`docs/research/2026-05-26-kestrel-runme-jit-runbook-bcl-extension-cost-of-velocity-decision-archaeology-aaron-forwarded.md`](../../research/2026-05-26-kestrel-runme-jit-runbook-bcl-extension-cost-of-velocity-decision-archaeology-aaron-forwarded.md).
