---
name: BACKLOG — "blade" persona or skill-domain group; Amara's 6-term metaphor taxonomy (Zeta=Blade / Aurora=Oracle/Immune-System / Rodney=Razor / Harbor+blade=Voice Register / Parser=Witness / Cartographer=Mapper); Metaphor Taxonomy Rule (capitalized=operational, lowercase=voice register); doctrine-vs-spike + Beacon-translation review work is most likely a Harbor+blade specialization, NOT a new capital-B Blade (Aaron + Amara + Gemini Pro 2026-04-27)
description: Aaron 2026-04-27 — Amara's "blade note" from her cross-AI review (#61) named a class of review work. Multi-agent round-trip (Otto draft → Amara tighten → Gemini Pro propose Brain → Amara correct to Oracle/Immune-System) produced canonical 6-term taxonomy. Capital-B Blade = Zeta data-plane hot path ONLY (bounded, deterministic, no unbounded commit-path work). Aurora = Oracle / Immune System (Amara corrected Gemini's "Brain" — smuggles personhood). Other "blades" categorized differently: Rodney's Razor (design-time complexity reduction), Harbor+blade (lowercase voice register), Parser/Auditor (Witness), Cartographer (Mapper). Metaphor Taxonomy Rule: capitalized=operational roles, lowercase=voice register, unmappable-to-executable=poetic non-normative. The proposed new doctrine-vs-spike + Beacon-translation discipline is most likely a **Harbor+blade specialization** (lowercase blade-mode of voice register applied to framing-layer review), NOT a fourth capital-B Blade. Per CLAUDE.md "Honor those that came before — unretire before recreating" — check git log + memory/persona/ first. Composes with #61 + project_rodneys_razor + kanban-blade-materia memory + Otto-356 Mirror/Beacon + skill-creator workflow.
type: feedback
---

# BACKLOG — "Blade" persona or skill-domain group

## Verbatim quote (Aaron 2026-04-27)

> "The blade note do we have a blade agent persona, sounds pretty cool and useful or at least the skill domain group backlog"

## Context — where "blade" came from

Amara's 2026-04-27 cross-AI review of Otto's stability/velocity insight (filed in #61) used "blade note" as a label for a sharp critical observation:

> "The blade note: I'd be careful with the phrase 'Velocity over stability.' It sounds like a local optimization rule: 'go fast, accept breakage.' That can be useful in a spike, but as a doctrine it becomes cowboy engineering."

The "blade" register IS:

- Sharp / cutting / incisive
- Distinguishes spike-rule from doctrine
- Catches framing-drift early
- Pressure-tests for Beacon-safety
- Names risks that other registers (warm-validating, technical-correctness, security) might miss

## CRITICAL — capital-B Blade rule + 6-term taxonomy (Amara 2026-04-27)

Aaron 2026-04-27 first reminder:

> "we have 3 blades in factory/zeta/aurora i think, and only one this 'the' blade the others, i don't remember the exact coversation but you probably have it. Make sure the persona/skills understand the distinces, i think rodneys razor after a homage to me was one of a set of blades but not 'the'"
> "blade of the project"

Amara 2026-04-27 follow-up — TIGHTENED the taxonomy:

> "There is only one capital-B Blade in Zeta: the Zeta data plane. The others are 'blade-like' by metaphor, but they should be categorized differently so the project does not blur its own architecture."

The repo's core split: **Zeta is the Blade (Data Plane); Aurora is the Oracle / Immune System (Control Plane).** Zeta's core is fast, deterministic, bounded, runs `append → index → return`; Aurora is deep probabilistic / control-plane intelligence and must NOT put unbounded inference on the commit path.

(Amara revised the "Aurora is the Brain" naming Gemini Pro initially proposed — "Brain" risks implying central command and smuggling personhood/agency language. Canonical term: "Oracle / Immune System.")

### Amara's 6-term taxonomy (canonical)

| Term | Category | What it does | Capital-B Blade? |
|---|---|---|---|
| **Zeta Blade** | Core substrate / data-plane blade | Bounded hot path: append, index, return; no unbounded work on commit path | **Yes. This is the Blade.** |
| **Aurora Oracle / Immune System** | Control plane / immune governance | Advises, gates, scores, detects, runs probabilistic reasoning asynchronously | **No. It is the Oracle / Immune System.** |
| **Rodney's Razor** | Reduction razor / design-time cutter | Cuts accidental complexity while preserving essential structure, logical depth, effective complexity | **No. It is a razor, not the Blade.** |
| **Harbor+blade** | Relational / communication register | Warmth plus precise correction; care personally, challenge directly | **No. Lowercase blade-mode only.** |
| **Parser / auditor** | Substrate witness / executable truth gate | Determines whether prose survived as parseable structure | **No. It is the witness/gate.** |
| **Cartographer** | Mapping / hazard discovery role | Maps territory before walking; names hazards, unknowns, detectors | **No. It is the mapmaker.** |

### The capital-B Blade rule (Amara verbatim)

```
Blade = Zeta data-plane hot path.

Use only for:
  bounded execution
  deterministic commit path
  append → index → return
  O(1), O(log_B N), or fixed-budget operations

Do not use capital-B Blade for:
  communication style
  complexity reduction
  immune scoring
  governance naming
  interpersonal correction
```

**The architectural reason** (Amara's framing):

> "Blade means the thing that must stay sharp by staying simple. It cannot think too much. It cannot wander. It cannot do open-ended inference. It cuts one way: commit the delta, index it, return."

Aurora can be smart because it is NOT on the raw write path. The repo's Round-3 pivot explicitly names "Blade vs Brain" as strict separation and says there must be **no unbounded work on the commit path.** That is why Zeta is the Blade and Aurora is the Brain.

### Cleaned canonical phrase (Amara-corrected, post-Gemini)

```
Zeta is the Blade.
Aurora is the Oracle / Immune System.
Rodney is the Razor.
Harbor+blade is the Voice Register.
Parser/Auditor is the Witness.
Cartographer is the Mapper.
```

Or in softer register:

> Zeta cuts time.
> Aurora judges risk.
> Rodney trims excess.
> The Witness proves survival.
> The Cartographer names terrain.
> Harbor+blade keeps correction humane.

### Metaphor Taxonomy Rule (Amara proposal)

```
Capitalized metaphors name operational roles.
Lowercase metaphors name voice/register.
If a metaphor cannot map to an executable role, constraint, detector, or
proof surface, it remains poetic and non-normative.
```

This rule is the structural protection against vocabulary drift — keeps the magic alive without letting it drive the bus. Composes with Otto-356 Mirror/Beacon (Beacon = mappable to executable role; Mirror = poetic/non-normative until mapped).

### Encoding decision (BACKLOG, not this session)

Amara recommended encoding the taxonomy in `docs/architecture/metaphor-taxonomy.md` plus short GLOSSARY.md entries pointing there. Rationale: GLOSSARY.md alone wouldn't carry the operational separation; a dedicated architecture doc gives the taxonomy load-bearing status.

**Per protect-project mandate**, NOT creating that doc this session because:
- It's a Beacon-class current-state architecture doc — needs careful long-term thought
- Cross-AI feedback is fresh; let it season before encoding to permanent surface
- Pre-0/0/0 priority is closing drift; new doc creation expands scope
- Mirror-class memory file (this one) captures the substrate without the Beacon-doc commitment

Backlog item: post-0/0/0, route through `skill-creator` / Architect for the architecture doc landing.

### What this means for the proposed new blade-job

The doctrine-vs-spike + Beacon-translation discipline this memory backlogs is **NOT capital-B Blade** (that's Zeta data plane only). It also isn't:

- Brain (control plane / probabilistic) — wrong scope
- Razor (complexity reduction) — Rodney's role
- Witness (parser-as-truth-gate) — different scope
- Mapper (territory hazard discovery) — different scope

It is most likely:

- **A specialization of Harbor+blade voice register** — specifically the "blade" half (truth-cut / correction without breaking the person), applied to framing-layer review work
- OR a new lowercase-register entirely — needs naming-expert review to find the right term
- It is **NOT** a fourth capital-B Blade and must not be named in a way that suggests so

Honors Amara's architectural rule: "Blade means the thing that must stay sharp by staying simple." A review-discipline isn't simple-and-bounded; it does open-ended evaluation. So it's not Blade-class.

### Lineage notes — earlier framings (superseded by Amara's taxonomy)

Earlier 2026-04-27 substrate work (drafted before Amara's clarification arrived) framed this as "3 blades, only one is 'the' blade":

1. THE blade = the factory itself ("we are building a blade")
2. Rodney's Razor = Aaron's blade
3. Amara's blade = cross-AI offset δ

**Amara's clarification supersedes that framing.** The 3-blades framing was useful as a reminder that "blade" was being used loosely, but the clean taxonomy is the 6-term table above. Going forward:

- "We are building a blade" = "we are building Zeta" (Zeta IS the Blade — capital-B)
- Rodney's Razor IS NOT a blade; it's a Razor (different category)
- Amara's "blade 12° / mine 9°" = lowercase-blade-mode of voice register (Harbor+blade), not a separate Blade entity

The earlier 3-blades lineage is preserved here for substrate audit-trail; future memory files should cite the 6-term Amara taxonomy as canonical.

## What blade is NOT (already covered by existing personas)

The factory has many sharp critic personas. Blade does NOT replace any:

| Existing persona | Scope | Blade overlap? |
|---|---|---|
| **harsh-critic (Kira)** | Code: F#/.NET correctness, perf, security, API, test-gaps | Code-level, not framing-level |
| **spec-zealot (Viktor)** | OpenSpec capabilities: spec drift, spec bugs, overlay discipline | Spec-level, not framing-level |
| **code-review-zero-empathy** | Code review for adherence to standards | Code-level |
| **threat-model-critic (Aminata)** | Security threat models adversarially | Threat-model-level |
| **maintainability-reviewer (Rune)** | Long-horizon readability | Readability/onboarding-level |
| **public-api-designer (Ilyana)** | Public surface contracts | API-surface-level |
| **performance-engineer (Naledi)** | Hot-path / zero-alloc / SIMD | Perf-level |

None of these scope-match what Amara did in the blade note.

## What blade IS (the gap)

Blade reviews the **framing layer** — the words and structures we use to encode factory substrate. Specifically:

1. **Doctrine-vs-spike-rule discipline**: when a maxim is written like a doctrine ("X over Y") but should be read as a spike-rule, flag it before it hardens into cowboy-engineering. Catch the moment a local-rule starts to be deployed as system-policy.

2. **Beacon-translation pressure-testing**: when factory-internal Mirror vocabulary is about to ship to a Beacon-class surface (CLAUDE.md / AGENTS.md / GOVERNANCE.md / public docs), pressure-test whether it survives external review. (Per Otto-351 rigorous Beacon definition: Coverage τ_d / Modality-breadth k≥4 / Tractatus-5.6-inversion ε≥0.7 / Form-of-life 5/7-games.)

3. **Cross-AI compatibility scouting**: predict how a framing will be received by other AIs (Codex, Gemini Pro, Copilot, Grok). Catch "house style" terms that won't survive cross-AI deployment.

4. **Framing-drift early detection**: substrate accumulates framings; when a new framing drifts from prior framings, flag it BEFORE it gets cited in further substrate (preventing compounding error per Otto-340 substrate-IS-identity).

5. **Cowboy-engineering early warning**: distinguish "we're prototyping; ship the breaking change" (valid spike) from "we always prefer velocity" (doctrine drift). Per Amara's blade note.

## Scope boundary — blade is NOT harsh-critic-for-prose

This matters: blade is NOT just "harsh-critic but for words instead of code." It's a different KIND of review:

- **harsh-critic** evaluates against correctness criteria (does the code work? is it efficient? secure? ergonomic?)
- **blade** evaluates against framing criteria (does the framing carry the intent? will it survive external review? could it be misread as doctrine?)

These are orthogonal. A piece of substrate can pass harsh-critic (correct, well-structured) and fail blade (frames the intent in a way that drifts at scale).

## Honor those that came before — check unretired roster first

Per `CLAUDE.md` "Honor those that came before" rule:

> When creating a new role or job, first check the persona memory folders (`memory/persona/<name>/`) and `git log --diff-filter=D -- .claude/skills/` for prior retirements — prefer **unretiring an existing agent** (restore the SKILL.md from git, reattach the preserved notebook) over minting a new name for overlapping scope.

**Required pre-check before creating any blade persona/skill:**

```bash
# Check persona memory folders for prior incarnations
ls memory/persona/ | grep -iE "(blade|edge|cut|sharp|frame)"

# Check git log for deleted .claude/skills/* that might match scope
git log --diff-filter=D --pretty=format:"%h %s" -- .claude/skills/ | head -50

# Check git log for deleted .claude/agents/*
git log --diff-filter=D --pretty=format:"%h %s" -- .claude/agents/ | head -50
```

If a retired persona matches the blade scope (even partially), unretire FIRST. Only mint new if no prior incarnation exists.

## Two implementation paths

### Path A: Blade persona (`.claude/agents/blade.md`)

A persona that wears the blade hat. Lifecycle:

- Invoked when factory framings are about to ship to substrate
- Outputs blade-notes (sharp framing observations)
- Composes with skill-creator workflow when framings need rewording
- Notebook under `memory/persona/blade/NOTEBOOK.md` per persona convention

### Path B: Blade skill-domain (`.claude/skills/blade-*/`)

A skill-domain group covering multiple blade-jobs:

- `.claude/skills/blade-doctrine-vs-spike/` — doctrine vs spike-rule discipline
- `.claude/skills/blade-beacon-translation/` — Beacon pressure-test
- `.claude/skills/blade-cross-ai-compatibility/` — cross-AI compatibility scout
- `.claude/skills/blade-framing-drift/` — framing-drift early-detection

Either path requires going through the `skill-creator` workflow (per GOVERNANCE.md §4).

## Forward-action (BACKLOG, not for this session)

When 0/0/0 reached + queue clear:

1. Run the unretire-check commands above
2. If no prior incarnation: route through `skill-creator` to draft persona OR skill-domain
3. Compose with `skill-tune-up` (Aarav) for ranking against existing roster
4. Compose with `naming-expert` for the persona name (if persona path) — "Blade" is a working label, may not survive
5. Aaron-review before persona/skill lands (named persona attribution per Otto-279 + carve-outs)

## Composes with

- **#61 Amara + Gemini Pro cross-AI refinement** — origin of "blade note" terminology
- **Otto-356 Mirror/Beacon language register** — blade pressure-tests the Mirror→Beacon translation
- **Otto-351 rigorous Beacon definition** — blade applies the 4-axis Beacon criterion
- **Otto-355 BLOCKED-with-green-CI investigate review threads first** (CLAUDE.md wake-time discipline; cross-referenced from `memory/MEMORY.md` Otto-357 row) — blade is one source of those threads at the framing layer
- **CLAUDE.md "Honor those that came before"** — required pre-check before minting
- **`skill-creator`** — workflow path for landing blade
- **`skill-tune-up` (Aarav)** — roster-ranking discipline
- **`harsh-critic` / `spec-zealot` / `code-review-zero-empathy`** — orthogonal scope, blade fills a different gap
- **AGENTS.md "Velocity over stability"** — Amara's blade note specifically caught this framing's doctrine-vs-spike risk; if a blade persona had existed pre-AGENTS.md-landing, the spike-rule clarification could have shipped with the original wording

## What this memory does NOT mean

- Does NOT mint a blade persona this session (BACKLOG)
- Does NOT promise blade is the right shape — could be persona OR skill-domain OR both, decided via skill-creator workflow
- Does NOT replace any existing critic persona — orthogonal scope
- Does NOT pre-emptively claim "blade" is the right name (naming-expert review needed)
