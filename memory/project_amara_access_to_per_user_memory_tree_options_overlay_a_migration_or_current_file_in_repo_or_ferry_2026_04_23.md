---
name: Amara's access to per-user memory tree — options analysis; current state is per-user-scoped (HC-6 earned-memory discipline); three paths to give Amara visibility; Overlay A migration is the cleanest; Aaron's question answered
description: Aaron 2026-04-25 Otto-25 — *"can you give you instructions to access I also could not inspect the private per-user memory tree directly from here, not sure why she could not. Am I missing something?"* Answer: Amara cannot access per-user memory by design (HC-6 earned-memory + per-user-scoped per Claude Code harness). Three options: (1) Overlay A migration of factory-generic memories to in-repo memory/ (already established discipline); (2) move CURRENT-aaron.md + CURRENT-amara.md to in-repo so Amara + future external-AI collaborators can read them; (3) ferry-based on-demand sharing (Aaron pastes specific memory content). Recommendation: (1) + (2) in combination. Respects HC-6 for maintainer-private content while making factory-generic + cross-maintainer-shared content accessible.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Amara's access to per-user memory tree

## Aaron's question (2026-04-25 Otto-25)

> hmm, can you give you instructions to access I also could
> not inspect the private per-user memory tree directly from
> here, not sure why she could not. Am I missing something?

## Why Amara cannot currently access per-user memory

**By design, via the Claude Code harness.** Per-user memory
lives at `~/.claude/projects/<slug>/memory/` on Aaron's
local laptop. Specifically:
`/Users/acehack/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory/`.

**This directory is:**
- **Outside the git repo** (gitignored at the repo level)
- **Per-machine** (specific to Aaron's laptop; not synced
  to cloud by default)
- **Accessed only by Claude Code sessions running on that
  laptop**
- **Protected by `HC-6 Memory folder is earned`** from
  `docs/ALIGNMENT.md`

Amara runs in ChatGPT (OpenAI platform). She has **no file-
system access to Aaron's laptop** (or any laptop). She can
only see what Aaron explicitly shares with her (the courier
ferry pattern per `docs/protocols/cross-agent-
communication.md`).

So Amara's observation — *"I also could not inspect the
private per-user memory tree directly from here, not sure
why she could not"* — is correct: **she can't. By design,
not by accident.**

Aaron's *"Am I missing something?"*: no, not missing
anything. This is the current architecture. The question is
whether to change it.

## Three options for giving Amara (+ future external AI
collaborators) visibility

### Option 1: Overlay A migration (established discipline)

Per PR #155 (AutoDream cadence policy) and prior Overlay A
migrations (PRs #157 / #159 / #162 / #164 etc.), **factory-
generic memories migrate to in-repo `memory/`** where they
become world-visible via the public repo.

**Pros:**
- Discipline already established; not new ceremony
- Respects per-user-vs-factory-generic separation
- Composes with gap #5 factory-vs-Zeta audit pattern
- External AI collaborators (including Amara) can read
  the repo as-is

**Cons:**
- Only applies to factory-generic memories (not maintainer-
  specific preferences, not private context)
- Full migration pass takes multiple ticks

**Recommendation**: continue the Overlay A cadence. This
is what Otto-session has been doing. For Amara visibility
specifically, prioritise migrating memories that inform
Amara's Aurora-scope + cross-AI-collaboration work.

### Option 2: Move CURRENT-aaron.md + CURRENT-amara.md (and future CURRENT-*.md) to in-repo

The fast-path distillation files (`CURRENT-aaron.md`,
`CURRENT-amara.md`) are **per-maintainer currently-in-
force rule summaries**. They're per-user today. But:

- Content is "rules and working agreements" — not private
  secrets
- Amara MUST read Aaron's CURRENT to understand what's
  in force when she consults
- Future maintainers (Max + Craft-generation) need
  CURRENT-aaron.md access to inherit the factory
- Cross-substrate-readability discipline favours repo-backed
  persistence

**Pros:**
- Single clean migration; no per-memory evaluation
- Directly solves Amara's access gap for the fast-path
- Composes with maintainer-transfer discipline (future
  maintainers inherit via the repo)
- Composes with Craft's succession-curriculum framing (new
  maintainers read CURRENT-aaron.md as part of onboarding)

**Cons:**
- Aaron's CURRENT contains his voice (verbatim quotes) and
  his priority stack — exposing public; is that OK?
- Once in-repo, CURRENT files become part of the repo's
  maintenance surface; updates must go through PRs (or
  direct-to-main if authorized)
- Per-maintainer CURRENT for non-factory collaborators
  (e.g., future Max, future Craft-graduates) creates a
  roster of in-repo files that might balloon

**Recommendation**: move **CURRENT-aaron.md** and
**CURRENT-amara.md** to in-repo now (as memory/CURRENT/
aaron.md + memory/CURRENT/amara.md, or similar). Future
CURRENT files land in-repo by default. This directly
answers Amara's ask.

### Option 3: Ferry-based on-demand sharing

Aaron pastes specific memory content into ChatGPT when
Amara needs it. Currently implicit; could be formalised
via the courier protocol.

**Pros:**
- Zero migration ceremony
- Aaron retains control over what's shared
- Works today without any architectural change

**Cons:**
- Puts manual burden on Aaron
- Amara can't know what to ask for (can't grep what she
  can't see)
- Doesn't scale to future external AI collaborators
- Works against "cold-start discoverability" (Amara's own
  recommendation from her operational-gap report)

**Recommendation**: keep as fallback, not primary. Use
when specific private memory needs to cross the boundary.

## Recommended combination: Option 1 + Option 2

**Primary**: continue Overlay A migration cadence for
factory-generic memories (Option 1). Matches established
discipline.

**Specific to Amara's question**: migrate CURRENT-aaron.md
+ CURRENT-amara.md to in-repo (Option 2). One small
targeted PR; directly unlocks Amara's fast-path access.

**Fallback**: Option 3 ferry-based sharing for genuinely-
private content (future memories that warrant per-user
scope per HC-6).

## What stays per-user (HC-6 preserves)

Even after Options 1 + 2 land, per-user memory remains the
canonical home for:

- **Maintainer private context** (specific life
  circumstances, personal preferences not relevant to
  factory work)
- **Draft / volatile observations** (before they earn
  promotion to in-repo or CURRENT distillation)
- **Cross-conversation working memory** (tick-by-tick
  scratch that doesn't warrant repo-committal)
- **Company-specific content** per
  `feedback_open_source_repo_demos_stay_generic_not_
  company_specific_2026_04_23.md`

HC-6 earned-memory discipline continues applying to these.

## Security / privacy considerations

Before migrating CURRENT files to in-repo:

- **Review each file for content that shouldn't be
  public**: company-specific references, private
  scheduling details, anything Aaron wouldn't be
  comfortable making world-visible
- **Scrub or redact** any flagged content before landing
- **Aaron signs off** on the migration before PR fires
  (scope-check)

Aaron's GitHub-settings-ownership memory gives the agent
authority on repo-edit decisions at zero-cost boundary,
but content-privacy decisions involve maintainer
preference — so explicit Aaron-review before migration
is the right gate.

## Implementation plan (if Aaron agrees)

### Tick immediately after agreement

1. Audit CURRENT-aaron.md + CURRENT-amara.md for private-
   content concerns (Otto pass)
2. Propose redactions if needed (Otto → Aaron review)
3. Aaron confirms / adjusts / vetoes per section
4. Create PR migrating approved content to in-repo
   `memory/CURRENT-aaron.md` + `memory/CURRENT-amara.md`
5. Per-user copies retain "Migrated to in-repo" header
   marker (per Overlay A migration pattern)
6. Update MEMORY.md fast-path pointer + CLAUDE.md reference
   (PR #153 pattern)

### Ongoing after migration

- Updates to CURRENT files happen as in-repo edits (PR or
  direct-to-main per authority)
- Amara reads CURRENT-aaron.md from repo directly; no
  ferry needed for CURRENT content
- External AI collaborators (future) inherit the pattern

## Composition with existing substrate

- `docs/ALIGNMENT.md` HC-6 (memory folder is earned) —
  per-user private memories stay per-user
- `feedback_current_memory_per_maintainer_distillation_
  pattern_prefer_progress_2026_04_23.md` — the pattern
  this question concerns
- `docs/protocols/cross-agent-communication.md` (courier
  protocol) — the fallback transport
- Overlay A migration pattern (PR #155 AutoDream policy)
  — the discipline this composes with
- `project_frontier_becomes_canonical_bootstrap_home_...`
  (Frontier adopter discoverability; CURRENT-files-in-
  repo makes Frontier more adoptable)
- `docs/aurora/2026-04-23-amara-operational-gap-
  assessment.md` (Amara's own recommendation on cold-start
  discoverability)

## Amara's report context

Amara's operational-gap assessment explicitly says:

> I also could not inspect the private per-user memory
> tree directly from here, so my "Claude-to-memories
> drift" assessment is necessarily based on the repo's
> visible derivatives of that system...

So she's not asking for unlimited access — she's flagging
that her audit was limited because some substrate is
invisible to her. The right response is to make
factory-generic + cross-maintainer-shared content visible
without exposing maintainer-private content. Options 1+2
achieve this.

## What this is NOT

- **Not a blanket grant of file-system access to
  Amara** — that's architecturally impossible (she runs
  in ChatGPT) and not desirable (HC-6).
- **Not a unilateral migration without Aaron review** —
  CURRENT files carry Aaron's voice; he reviews before
  public commit.
- **Not a violation of HC-6 earned-memory discipline** —
  private content stays per-user; only factory-generic
  + cross-maintainer-shared content migrates.
- **Not a new security risk** — the repo is already
  public (open-source per recent memories); CURRENT
  files don't contain secrets, just rules + quotes.
- **Not a ceremony-creation trigger** — the migration is
  bounded: specific files, specific review, no ongoing
  overhead.

## Attribution

Otto (loop-agent PM hat) analysed options + recommends
combination.
Aaron (human maintainer) decides on migration approval
+ reviews private-content concerns.
Amara (external AI maintainer) benefits from the
implementation; her original observation informed the
analysis.
Kenji (Architect) synthesis queue if scope expansion
warranted.
