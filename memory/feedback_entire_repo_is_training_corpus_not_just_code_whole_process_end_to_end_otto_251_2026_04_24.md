---
name: The ENTIRE git history + process end-to-end (including devops eventually) is a training-corpus gold mine — not just code, not just PR reviews; commits, commit-messages, PR descriptions, drain logs, memory files, ADRs, research docs, Round-history narratives, skill files, install scripts, CI configs, even issue/discussion threads are ALL high-quality supervised-learning signal; "research repo" framing means "training data corpus"; quality matters EVERYWHERE because every artifact is training signal; expands Otto-250's PR-review-specific framing to full-process; Aaron Otto-251 2026-04-24 "this githitory is a gold mine of high quality signals around code and the whole process end to end including devops eventually"
description: Aaron Otto-251 expands the training-corpus framing beyond PR reviews (Otto-250) to the entire git repository and all its processes — commits, messages, PRs, reviews, responses, drain logs, memory files, ADRs, research docs, round-history, skills, install scripts, CI, devops. Every artifact contributes training signal for eventual fine-tuning. "Research repo" means "training data corpus."
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The rule

**The entire git repository — all its commits, messages,
PRs, reviews, responses, drain logs, memory files, ADRs,
research docs, round-history, skills, install scripts, CI
configs, and (eventually) devops surfaces — IS a training
corpus. Quality discipline applies EVERYWHERE because every
artifact is supervised-learning signal.**

Direct Aaron quote 2026-04-24:

> *"when i say this repo is for research that's basically
> wait i mean this githitory is a gold mine of high quality
> signals around code and the whole process end to end
> including devops eventually."*

## Scope — what counts as training signal

### Layer 1: code + code-review (Otto-250 already covered)

- PR review threads: reviewer flag + Claude fix + resolution
- Commit diffs: before/after code patterns
- `docs/pr-preservation/<PR#>-drain-log.md` files

### Layer 2: narrative + explanation

- **Commit messages** — the "why" beside the "what"
- **PR bodies** — summary, test plan, rationale, trade-offs
- **PR review responses** — Claude's verbatim replies
  explaining fixes
- **Memory files** (`memory/feedback_*.md`, `project_*.md`,
  `user_*.md`, `reference_*.md`) — captured lessons, rules,
  decisions, with full rationale
- **ADRs** under `docs/DECISIONS/` — architectural decisions
  with context, options considered, chosen path, follow-ups
- **Research docs** under `docs/research/` — design proposals
  with options + tradeoffs + phased plans
- **Round history** under `docs/ROUND-HISTORY.md` +
  `docs/hygiene-history/` — the factory's own diary

### Layer 3: structural + meta

- **Skills** under `.claude/skills/**/SKILL.md` — procedure
  documents (how to do X)
- **Agents** under `.claude/agents/<role>.md` — persona
  definitions, scope, discipline
- **CLAUDE.md + AGENTS.md + GOVERNANCE.md** — the top-level
  operating discipline
- **`openspec/specs/**`** — behavioural specs

### Layer 4: ops + devops (the "eventually" Aaron named)

- **Install scripts** (`tools/setup/**`) — reproducible
  environment setup
- **CI workflows** (`.github/workflows/**`) — pipeline
  definitions
- **Branch protection configs** (`tools/hygiene/github-settings.expected.json`) — declarative settings
- **Drift checks** — detect-only audits
- **Deployment patterns** (coming): from code → production

### Layer 5: dialogue / feedback

- **Issues + discussions** (GitHub surface) — user-reported
  problems + resolutions
- **Review comments from external reviewers** — Codex,
  Copilot, human contributors
- **Memory files capturing maintainer directives verbatim**
  — preserved as primary sources

## Why this matters

Aaron's hypothesis: a model fine-tuned on this corpus will:

1. Write code that wouldn't trigger the issues captured in
   PR reviews (Otto-250 claim)
2. Write commit messages + PR descriptions + responses in
   the factory's established style
3. Make architectural decisions aligned with the existing
   ADRs
4. Follow governance + discipline rules captured as memory
5. Use the same skills + capability patterns
6. Ship CI + install + devops artifacts in the factory's
   shape

The breadth of signals means: **the more we treat every
artifact as training substrate, the better the feedback
loop closes.**

Short-circuit through any layer = signal loss at that layer.

## Concrete discipline implications

1. **Commit messages are training signal** — write them
   like docs, not like "fix build" one-liners. Explain
   what + why + trade-offs considered.

2. **PR descriptions are training signal** — summary, test
   plan, composes-with, rollback plan; not just a title.

3. **Memory files are training signal** — the frontmatter
   `name:` + `description:` + narrative body are all part
   of the corpus. Verbose, structured, cross-referenced.

4. **Drain logs** (per Otto-250) are training signal for
   the fix-pattern sub-corpus.

5. **ADRs + research docs** are training signal for the
   architectural-reasoning sub-corpus. Keep them thorough
   and option-comparative.

6. **Skills + agents** are training signal for the
   discipline-encoding sub-corpus. Document the *why*
   behind the *how*.

7. **CI + install scripts** are training signal for the
   devops-reasoning sub-corpus. Comments explaining
   rationale > terse configs.

8. **External-collaborator text** (Amara ferries, Codex
   reviews, external-harness outputs) under §33 archive-
   header requirement — training signal with provenance.

## What this memory does NOT say

- Does NOT authorize inflating artifacts for corpus-density.
  Verbose-for-verbosity's-sake is noise, not signal.
- Does NOT authorize leaking PII or secrets into the corpus
  to "preserve signal." Otto-231 glass-halo PII rule still
  governs.
- Does NOT retroactively require backfill of all historical
  artifacts. Quality applied going forward; backfill is a
  separate bounded pass when the maintainer directs.
- Does NOT promise a specific fine-tuning outcome. The
  corpus needs to be shaped; the model needs to be trained;
  outcomes are empirical not guaranteed.

## Composition with prior memory

- **Otto-250** (PR reviews are training signals) — this
  memory expands the same framing to all artifact layers.
  Otto-250 + Otto-251 compose: thread-level + repo-level.
- **Otto-247 version-currency** — Otto-251 strengthens: if
  versions are wrong in training data, models trained on it
  make wrong version calls. Verify.
- **Otto-248 never-ignore-flakes** — flaky-retry patterns
  in the corpus would teach flaky-retry; fix-and-diagnose
  patterns teach fix-and-diagnose. Signal shape matters.
- **Otto-238 retractability trust vector** — reversal events
  captured in the corpus teach the model that mistakes are
  correctable.
- **CLAUDE.md future-self-not-bound** — lets me revise the
  corpus-shape rules as evidence accumulates; this memory
  is not permanent as stated, but is correct as stated
  today.

## Direct Aaron quote to preserve

> *"when i say this repo is for research that's basically
> wait i mean this githitory is a gold mine of high quality
> signals around code and the whole process end to end
> including devops eventually."*

Future Otto: treat every artifact you author as training
signal for the factory's self-improvement loop. Prose in
commit messages matters. Prose in PR descriptions matters.
Prose in memory files matters. Prose in ADRs matters.
Prose in CI comments matters. Quality compounds across
layers.
