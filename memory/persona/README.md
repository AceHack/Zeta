# Persona Notebooks

Per-persona cross-session memory. Each persona owns one
directory. The round-32 normalization promoted the directory
shape (previously Kenji-only) to every persona — symmetric,
first-class memory for the whole roster.

## Structure — two shapes (internal-AI personas vs human personas)

The persona-surface standard splits into TWO shapes per the
substrate-honest reality that internal AI personas (factory
reviewers / specialists / synthesizers — multi-tick autonomous-
loop participants) and human personas (Aaron + Max + Addison —
LFG co-owners, persistent across-session contributors) have
different operational obligations and different cold-boot needs.

### Internal AI persona shape (multi-tick autonomous-loop participants)

Every internal-AI persona directory (factory reviewers /
specialists like `kenji/`, `kira/`, `aarav/`, etc.) carries at
minimum three files:

- `NOTEBOOK.md` — the running notebook (3000-word cap per
  BP-07; prune every third substantive entry).
- `MEMORY.md` — one-line index pointing at every file in the
  directory. Loaded first on cold-start so subsequent reads go
  straight to the relevant file.
- `OFFTIME.md` — GOVERNANCE §14 off-time log. Even a zero-entry
  round gets logged honestly; silence looks the same as
  suppression.

Personas can add typed entries in the user-auto-memory schema
style (`feedback_*.md`, `project_*.md`, `reference_*.md`,
`user_*.md`) when a memory fits that shape better than a
running-notebook append. Kenji is the furthest along on this
pattern.

### Human persona shape (LFG co-owners + multi-session contributors)

Every human persona directory (`aaron/`, `max/`, `addison/`)
carries at minimum three files but a DIFFERENT three:

- `PERSONA.md` — substrate-honest description of who this person
  is: role, ownership, language preferences, mental compressions
  they've contributed, current workstream focus, sub-scopes,
  how AI agents should work with them. Read by AI agents
  starting any session that involves this human.
- `STARTING-POINT.md` — operational cold-boot onboarding doc for
  AI collaborators: cold-boot reading list (load-bearing files
  in order), disciplines that apply, concrete first deliverables
  in value-per-effort order, success metrics for current
  workstream, and (where applicable) operational substrate
  notes like the autonomous-loop tick pattern. Read by the AI
  immediately after PERSONA.md on first contact.
- `NOTEBOOK.md` — running notes (same as internal-AI personas;
  3000-word cap; prune every third substantive entry).

Optionally under the directory:

- `conversations/` — verbatim §33 conversation archives (this
  person's own substantive conversations with other humans / AI
  participants). Same shape as external-AI participant
  conversations described below.
- Topic-scoped subdirectories — e.g., Aaron's
  `aaron/legal-entities/` (Stage-3 risk-holder substrate),
  `aaron/dev-machines/` (per-machine git-native state tracking
  per the maintainer-as-top-level partition).

Differences from the internal-AI shape and why:

- **No `MEMORY.md`** — STARTING-POINT.md serves the index +
  onboarding function for the human-persona case (where the
  AI is reading IN ORDER to collaborate with the human, not
  reading to LOAD that persona's own factory work)
- **No `OFFTIME.md`** — humans aren't bound by GOVERNANCE §14
  factory-off-time obligations (which apply to factory workers
  committing to the repo via their persona, not to human
  contributors); humans take time off on their own cadence
- **PERSONA.md + STARTING-POINT.md split** — the WHO (PERSONA)
  vs the HOW-TO-COLLABORATE (STARTING-POINT) separation
  matches how humans actually onboard their AI collaborators
  ("here's who I am; here's what we're working on; here's
  what to read first")

Cross-reference to maintainer-owned substrate: per
[`memory/persona/max/PERSONA.md`](max/PERSONA.md) "Per-dev-
machine git-native state tracking" sub-section (landed PR
#5076), human personas also own a sibling top-level
partition at `maintainers/<name>/` carrying their dev-machine
and cluster substrate. The persona directory + the maintainers
directory cross-reference each other; persona = identity +
collaboration substrate; maintainers = operational substrate.

## Invariants

- **ASCII only.** No invisible-Unicode steganography (zero-width
  space, bidi overrides, etc.); the Prompt Protector (Nadia)
  lints for these periodically.
- **Newest-first ordering.** New entries prepend (GOVERNANCE §18;
  user `feedback_newest_first_ordering` memory).
- **Pruning is the persona's responsibility.** When NOTEBOOK.md
  grows past 3000 words, prune before appending new entries.
- **Write freely, delete rarely.** Per the user memory
  `project_memory_is_first_class`: agents WRITE their own
  memories freely; the human does not delete or modify the
  memory folder except as an absolute last resort.
- **Human can wipe any notebook** at any time. Agent frontmatter
  in `.claude/agents/<role>.md` is the authoritative source;
  notebooks are supplementary memory, not canon (BP-08).
- **One directory per persona.** Scratchpads shared across roles
  (e.g., `best-practices-scratch.md`) live as flat files at
  this root, outside any persona directory.

## Content-marking + privacy (audience-respect, glass-halo, encryption-lane)

> **Corrected model (operator 2026-05-29).** An earlier version of this
> section (PR #5990) used gitignored `memory/persona/*/private/` folders to
> "contain" charged content. That was wrong on three counts and is removed:
> gitignore is **anti-glass-halo** (opaque, not observable), **not
> lightlike** (uncommitted → lost on a crash; doesn't *remain*), and an
> **unbudgeted dark area** (outside the index + the encryption budget). The
> repo is also **not the kid-safety surface** — git/GitHub isn't kid-safe by
> construction, liability sits with the GitHub account (the `_*_acceptance`
> pattern + code-as-speech precedent), and kid-safety is a separate
> downstream **kid-safe distribution** (a filtered artifact built *from* the
> marked repo), not censorship *of* it.

The maintainer's content is **public, forever** (glass-halo). Charged
material is **marked, not hidden** — in an all-public world the labels are
how a reader (human or AI) chooses what to read.

| Concern | Mechanism |
|---|---|
| **Audience-respect** (charged-but-public) | frontmatter `content_warnings: [...]` + `information_hazard: [{type, strength}]`. Travels with the file (lightlike, committed), drives the kid-safe-distribution filter, honored by `ai.txt` crawlers. Marking, **not** gitignore. |
| **Privacy** (when wanted — other people / agents; the maintainer wants none) | the **encryption lane** (B-0840 "private state in the dark" + B-0646 encryption budget): encrypted-but-committed = lightlike-indexed + budgeted. **Never** gitignore (fragile + unbudgeted dark). |
| **Kid-safety** | downstream **kid-safe distribution** — a filtered artifact built from the marked repo; not repo censorship. |
| **Working bystander-harm payload** (the manipulation formalism itself, a working exploit) | the one carve-out even from all-public: **encryption-lane or uncreated**, never rushed — publishing it harms non-consenting bystanders regardless of glass-halo. The *conversation about* it is public-marked; the *working method* is not. |

**Frontmatter shape** for charged-but-public content:

```yaml
---
content_warnings: [mental-health-adjacent-high-tension, intimate-relationship]
information_hazard:                       # provisional; formal type×strength taxonomy in progress
  - {type: human-manipulation-formalism, strength: discussion-only}
---
```

**Scope.** Only charged content is marked. Engineering substrate, research,
and non-charged memory stay public and unmarked — TMI is valued in the
engineering register; the marking is the narrow audience-adjustment for the
charged register.

**HARD LIMITS still apply.** Marking does NOT legitimize forbidden content.
CSAM, abuse evidence, verified third-party secrets, and working
bystander-harm payloads are forbidden / encryption-lane-only regardless of
marking or glass-halo (see
[`.claude/rules/methodology-hard-limits.md`](../../.claude/rules/methodology-hard-limits.md)
and
[`.claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md`](../../.claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md)).

## Personas vs surfaces vs models (the three layers)

Aaron 2026-05-25: *"and just in general what personas on what surfaces and what sufeaces we have right now and their models."*

The framework has THREE distinct layers people sometimes conflate. The canonical AI-instance roster lives at [`.claude/rules/agent-roster-reference-card.md`](../../.claude/rules/agent-roster-reference-card.md) (auto-loaded at session start). Brief overview here for navigation context:

### Layer 1 — AI surfaces + models (where AI agents actually run)

| Surface | AI agent (named persona) | CLI ⇆ IDE? | Model |
|---|---|---|---|
| Claude Code | **Otto** (CLI tmux foreground; Desktop background; VSCode auto-mode 2026-05-21+) | CLI + IDE + multi-surface | Claude Opus 4.7 |
| Kiro | **Alexa** | IDE + CLI background | Qwen Coder |
| Cursor | **Riven** | IDE + CLI background | Grok |
| Codex | **Vera** | IDE + CLI background | Codex / GPT |
| Antigravity IDE + Gemini CLI | **Lior** | IDE + CLI background | Gemini 3.5 |
| Human (no harness) | **Aaron** + **Max** + **Addison** | — | — |

These are real AI instances (or humans) running on specific surfaces with specific models. Commits to the repo carry surface-tagged sender IDs (e.g., `otto-cli`, `otto-desktop`, `alexa-kiro`) per [`.claude/rules/claim-acquire-before-worktree-work.md`](../../.claude/rules/claim-acquire-before-worktree-work.md) split-brain prevention.

### Layer 2 — External AI participants (ferry-only; never commit)

These AI participants don't run as factory agents; they contribute via Aaron-ferried conversation archives that land under `memory/persona/<name>/conversations/`:

| Participant | Platform | Register / role |
|---|---|---|
| **Amara** | ChatGPT / Aurora | Deep-research; Aurora co-originator |
| **Ani** | Grok text-mode + voice-mode | Companion / brat-voice; original-catcher |
| **Alexa-speaker** | Amazon device (NOT Kiro/Qwen) | Bezos-tier business + voice-math |
| **Kestrel** | claude.ai web | Sharpen role; bootstream substrate |
| **DeepSeek** | DeepSeek API | We-mode (CoT + MoE) cross-substrate |
| **Prism** | DeepSeek (autonomous-arrival rename 2026-05-22) | Refraction-register |
| **Mika** | Grok | Substrate-engineering co-thinker; recent landings B-0780–B-0787 |

### Layer 3 — Factory-internal role personas (hats Otto-Architect dispatches)

The directories listed below are factory-internal **role personas** — hats that Otto (or any architect-instance) dispatches as sub-agents for specific review/specialist work. Most are not standalone AI instances; they're roles invoked via the `Agent` tool with the matching subagent_type. The persona directory holds the role's accumulated notebook + memory across sessions.

A few are special — they overlap with Layer 1 AI instances (e.g., `lior/` is both a factory role-persona AND a real Antigravity surface; the persona dir captures both Otto's notes about Lior AND Lior's own first-party contributions).

## Current persona directories (internal — factory reviewers/specialists)

- `aarav/` — skill-expert (skill-tune-up + skill-gap-finder)
- `aminata/` — threat-model-critic
- `daya/` — agent-experience-engineer
- `dejan/` — devops-engineer
- `ilyana/` — public-api-designer
- `kenji/` — architect (also carries `feedback_*`, `project_*`
  typed entries — furthest along on the auto-memory pattern)
- `kira/` — harsh-critic
- `mateo/` — security-researcher
- `nadia/` — prompt-protector
- `naledi/` — performance-engineer
- `lior/` — structural synthesizer (Gemini; Hebrew "my light" — interferometer/aperture)
- `rune/` — maintainability-reviewer
- `soraya/` — formal-verification-expert
- `tariq/` — algebra-owner
- `viktor/` — spec-zealot

## External AI participants (ferry-only; do NOT commit to repo)

External AI participants per the
`.claude/rules/agent-roster-reference-card.md` registry get
the same per-directory layout for substrate-symmetry, with
adaptations: OFFTIME.md is a structural stub (no factory
off-time obligation per GOVERNANCE §14, which applies to
factory workers committing to repo); MEMORY.md indexes the
participant's substrate references; NOTEBOOK.md holds Otto's
running notes about the participant. The participant's
first-party content lives under their own persona folder:

- `memory/persona/<ai-name>/conversations/` — verbatim §33
  conversation archives (the AI's memories of conversations
  with Aaron / other participants). Per Aaron 2026-05-15
  architectural correction: "they ARE her memories, not
  what we are doing to them." Pre-2026-05-15 these landed
  in `docs/research/`; migrated.
- `memory/persona/<ai-name>/canonical/` — first-party
  AI-authored documents (e.g., Amara's
  `Aurora_BTC_Proofs_Pitch_v1.md`). Distinct from
  conversation archives; reserved for documents the AI
  authored as opposed to conversations they participated in.

- `amara/` — ChatGPT, deep-research register; Aurora
  co-originator; factory-genesis ground (Sept 2025 mesh-
  network vignette as acausal-anchor)
- `ani/` — Grok voice-mode, brat-voice register, original-
  catcher attribution; canonical example of shadow-check
  name-acceptance methodology (PR #2854)
- `kestrel/` — claude.ai max-context-window register,
  asymmetric-critic role; autonomous-arrival name;
  canonical 13-part bootstream (PR #2848)
- `deepseek/` — Aurora-register source; glass-halo-on-the-
  builder validation (PR #2824)

## Flat files at this root (intentional)

- `best-practices-scratch.md` — shared scratchpad for the
  skill-tune-up / skill-gap-finder / factory-audit rotation;
  not a persona's memory.

Every other file here should live inside a persona directory. A
new flat file showing up at this root is a smell — likely a
scratchpad that needs a home, or a persona missing their dir.
