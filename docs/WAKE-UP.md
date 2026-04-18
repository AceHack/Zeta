# Wake-Up Protocol

Fast-start index for any agent (persona) picking up a session
mid-round or after compaction. **Read-in-order, not read-in-full.**
The point is to re-orient in the minimum number of file reads.

The compaction-driven memory gap is the single biggest friction
in this repo's agent experience. Every pointer that costs a file
read when it could have been a sentence costs every persona, every
session. This file is the canonical cold-start index; treat a
stale pointer here as a P0 DEBT.md entry tagged `wake-up-drift`.

**Maintained by the architect (Kenji) in collaboration with the
agent-experience researcher (Daya).**

---

## Tier 0 — any persona, cold start

Everyone reads these. Measured cost: ~12k tokens total cold (GLOSSARY.md dominates at ~4.5k; EXPERT-REGISTRY.md ~2k; the rest ~5.5k).

1. `CLAUDE.md` — already the first file Claude Code reads;
   contains ground rules (agents-not-bots, never-fetch-elder-
   plinius, docs-read-as-current-state).
2. `AGENTS.md` — the numbered rules. §10 (round-table, no head),
   §11 (architect-gate), §12 (bugs-before-features ratio), §13
   (reviewer-count inverse to backlog), §14 (standing off-time
   budget).
3. `docs/GLOSSARY.md` — shared vocabulary. Resolves overloaded
   terms: "skill"/"hat", "spec" (behavioural vs formal),
   "expert", "frontmatter", "AX"/"UX"/"DX".
4. `docs/EXPERT-REGISTRY.md` — the 23-person roster. Skim the
   names; every dispatch uses them.
5. `docs/CURRENT-ROUND.md` — live mid-round state (when it
   exists). The **right-now** slice; updated per architect
   turn.

## Tier 1 — your own persona

Each persona adds these on top of Tier 0. ~5-10k tokens.

6. `.claude/agents/<your-name>.md` — the persona file. Frontmatter
   wins on disagreement with notebook (BP-08).
7. `.claude/skills/<each-skill-in-frontmatter>/SKILL.md` — the
   procedures you wear (one per entry in the `skills:` list).
8. `memory/persona/<your-notebook>.md` — your cross-session
   memory, when one exists. 3000-word cap (BP-07); ASCII only
   (BP-09).

## Tier 2 — the work in front of you

Only when you have a specific task.

9. `docs/BUGS.md` — P0 only if just orienting; full read if you
   are in the bug-fix lane.
10. `docs/DEBT.md` — P0 only for orientation; full for knockdown
    rounds.
11. `docs/BACKLOG.md` — top 3 rows for orientation.
12. `docs/WINS.md` — last round's entries only, for recent
    context.
13. The specific file(s) in scope for your task.

## Tier 3 — on demand

Only when the task explicitly requires:

- `docs/ROUND-HISTORY.md` — narrative past-tense log; heavy
  tokens. Read when a decision's history matters.
- `docs/DECISIONS/*.md` — ADRs. When a closed decision is being
  revisited.
- `docs/research/*.md` — writeups. When your task is research-
  adjacent.
- `docs/PROJECT-EMPATHY.md` — conflict protocol. Only when a
  conflict needs resolving; the protocol is IFS-flavoured.
- `openspec/specs/*/spec.md` — behavioural specs. When you are
  implementing or reviewing a capability.

## Per-persona overrides (optional)

A persona may add a `wake-up:` stanza to its agent-file
frontmatter listing additional Tier 1-2 files in preferred read-
order. If absent, Tier 0 + the persona's skills + notebook are
the default. Example (proposed; not yet landed):

```yaml
wake-up:
  - docs/research/proof-tool-coverage.md  # Soraya only
  - docs/TECH-RADAR.md
```

## What NOT to read on wake-up

These look useful but pay poorly for orientation:

- Old `docs/research/*.md` not relevant to the current task —
  heavy tokens, low current-state signal.
- Full `docs/ROUND-HISTORY.md` — narrative; slow to parse for
  "where we are now".
- Every `.claude/skills/*/SKILL.md` — unless you are Aarav doing
  a tune-up pass, skip the ones you do not wear.
- `references/**`, `docs/category-theory/ctfp-*` — reference
  material, not orientation material.

## Maintenance

- **Kenji** updates Tier 0 when `AGENTS.md` rules or
  `docs/GLOSSARY.md` canon entries change.
- **Daya** (agent-experience-researcher) measures cold-start
  token cost per persona every 5 rounds and proposes edits to
  this file.
- **Anyone** noticing a stale pointer files a DEBT.md entry with
  the `wake-up-drift` tag.

## Open questions

- Should CLAUDE.md point at this file explicitly as the single
  cold-start entry point, replacing its current in-file "Read
  these, in this order" list? Cost: small duplication becomes
  single-source-of-truth; benefit: no drift between the two
  lists. Pending agent-experience audit.
- Should every persona notebook include a `## Last-known-good
  state` top-section that Kenji updates on round-close, giving
  the persona a one-paragraph "what you were doing last" on
  wake-up?
- Is there a cheaper way to get Tier 0 into context than reading
  five files? Candidate: a single `docs/FACTORY.md` that inlines
  the 60-second essentials.
