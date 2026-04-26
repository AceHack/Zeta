---
name: Hard veto — NO SYMLINKS. Aaron has tried symlinks before, they're unreliable. Applies broadly: cross-harness skill placement (Claude Code + Codex + Gemini canonical skill homes), per-agent memory folders, any "shared content across multiple homes" scenario. Rule: keep own copies. "Own version" per harness. Composes with Otto-227 behaviour/data split (SKILL.md bodies per harness, shared data in `docs/`); extends to per-named-agent memory under `.claude/agents/<name>/`. Aaron Otto-244 after Google Search AI fourth share proposed symlink hybrid; 2026-04-24
description: Aaron Otto-244 gave a hard durable veto on symlinks as a cross-reference mechanism — "i don't like the symlink option, it's not reliable we already tried it, this is another one where claude just needs to keep it's own version." Scope: any scenario where same content needs to appear in multiple places (cross-harness skill placement, per-agent memory cross-refs, cross-tree mirrors). Rule: copy, don't symlink. "Own version" per consumer. Composes with Otto-227 behaviour/data split.
type: feedback
---
## The rule

**No symlinks as a cross-reference / cross-placement mechanism in this repo.** Ever. Keep own copies.

Direct Aaron quote:

> *"i don't like the symlink option, it's not reliable we
> already tried it, this is another one where claude just
> needs to keep it's own version."*

**Why:** symlinks break in practice across Aaron's environment:

- Git treats symlinks specially (depending on `core.symlinks` config)
- Windows vs macOS/Linux handle symlinks very differently (Git Bash / WSL / PowerShell each have their own symlink dramas)
- CI runners may clone without symlink support
- Cross-worktree subagents can end up with dangling links
- File-indexing tools (grep, ripgrep, IDE indexers) either follow-and-double-count or skip-and-miss — either fails for different tasks
- Aaron has tried them in the past; empirical burn

**Empirical authority:** Aaron has tried this; the "unreliable" is experience-based, not theoretical. Treat as durable fact.

## Scope — where "no symlinks" applies

### 1. Cross-harness skill placement (reinforces Otto-227)

Otto-227 established: `.claude/skills/` (Claude Code) and
`.agents/skills/` (Codex + Gemini) each carry their own
SKILL.md body. Shared data source lives in `docs/` tree.
Two bodies, one data source. **Not** symlinked.

Otto-244 extends this rule: if Codex and Gemini ever get
their own canonical skill homes (hypothetical
`.codex/skills/`, `.gemini/skills/`), same rule applies —
copy, don't symlink. Each harness owns its canonical copy.
Shared prose, rule tables, worked examples live in `docs/`
and get text-referenced by each SKILL.md body.

Aaron's exact phrasing: *"Also this might be the case for
splitting codex and genimi into their connonical skills
to."* — so Aaron is naming the implication explicitly.

### 2. Per-named-agent memory folders

The Google Search AI fourth share (Otto-245 project memory
has the full research) proposed a "hybrid" structure with
`.claude/agents/` as primary and a symlinked `agents/` at
root. **Aaron rejects the symlink.** If both paths are
wanted (unlikely), duplicate content with sync scripts,
don't symlink.

### 3. Memory cross-tree (CLAUDE.md's out-of-repo → in-repo mirror)

The global Anthropic AutoMemory at
`~/.claude/projects/<slug>/memory/` and the in-repo
`memory/` mirror — the mirror is a COPY (manually synced),
not a symlink. The symlink would make the in-repo memory
tree depend on per-machine filesystem layout; that breaks
the "works on any checkout" invariant.

### 4. Anywhere else "shared content, multiple homes" comes up

Default answer: copy, don't symlink. Each consumer owns
its version. Sync mechanism separate concern (scripts,
merge drivers, manual curation — but not filesystem
indirection).

## What this memory does NOT say

- Does NOT forbid symlinks for **infrastructure / runtime**
  purposes where symlinks are the standard tool: e.g.
  `node_modules/.bin/<cli> → ../actual-binary.js` (npm's
  pattern, unavoidable), or deployment symlinks for
  atomic version switches (`/app/current -> /app/v1.2.3`).
  The rule targets content cross-referencing, not runtime
  linking.
- Does NOT forbid git-submodules or sparse-checkout
  patterns (those are different mechanisms with their own
  tradeoffs; evaluate separately).
- Does NOT forbid symlinks inside worktree directories
  when the tool creates them automatically (e.g.
  `git worktree`'s internal pointers — those are git's
  own substrate).
- Does NOT require removing any existing symlinks
  immediately as a cleanup pass; no symlinks currently in
  the repo that I've seen. Rule is forward-looking
  prevention of new symlinks.

## How to honour this rule in practice

When tempted to add a symlink:

1. **Ask: why do I want the same content in two places?**
   Often the answer is "because two tools need to see it."
   Solution: which tool is primary? That tool owns the
   canonical copy; the other gets its own copy via a sync
   script (one-shot or periodic).
2. **For skill placement**: follow Otto-227 — canonical
   home per harness, duplicate SKILL.md body, shared
   `docs/` data source.
3. **For memory**: follow Otto-240 — per-writer files
   write to their own scoped path; read-side roll-up
   aggregates. No cross-symlinks between writer files.
4. **For cross-tree mirrors**: copy via sync script.
   Accept the eventual-consistency cost.

## Composition with prior memory

- **Otto-227 cross-harness skill canonical home** — this
  memory REINFORCES the "two bodies, one data source"
  rule. Otto-227 was about placement; Otto-244 is about
  the cross-reference mechanism. Both end at the same
  place: copy, don't symlink; separate behaviour per
  consumer, shared data via text reference.
- **Otto-240 per-writer tick-history files** — similar
  philosophy: each writer owns its own file; read-side
  roll-up avoids cross-references between files.
- **Otto-245 per-named-agent memory research** —
  companion memory. That one explores the architecture;
  this one captures the cross-placement rule the
  architecture must respect.
- **Otto-114 ongoing memory-sync mechanism** (BACKLOG)
  — must use sync script / git operations, not
  symlinks, to bridge the global AutoMemory and in-repo
  mirror.

## Direct Aaron quote to preserve

> *"i don't like the symlink option, it's not reliable we
> already tried it, this is another one where claude just
> needs to keep it's own version. Also this might be the
> case for splitting codex and genimi into their
> connonical skills to."*

Future Otto: when a research share or design proposal
suggests a symlink for cross-placement, reject it by
default. Ask for the duplication + sync pattern instead.
Aaron has burned on this before; respect the empirical
authority.
