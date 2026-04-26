---
name: Memory-sync sidecar pattern (`.memory-sync-state.json`) + AutoDream/AutoMemory Q1 2026 compatibility — SHA-256-hash ledger, machine-local (gitignored), community tools `perfectra1n/claude-code-sync` + `claude-memory-sync`, sync consolidated not raw, lock-check before push, ignore-deletions-by-default; upgrades Otto-114 memory-sync design from abstract to concrete implementation target; Aaron Otto-242 larger Google-Search-AI share; 2026-04-24
description: Aaron Otto-242 shared a substantial Google Search AI research packet on memory-sync patterns that materially upgrades the Otto-114 "ongoing memory-sync mechanism" BACKLOG row. Confirms `originSessionId` is third-party convention not native Claude Code (already in Otto-241 memory). Adds concrete sidecar-file shape (SHA-256 + last_sync + processed_files), community tool recommendations, AutoDream/AutoMemory Q1 2026 interaction notes, and implementation tips (lock-check, ignore-deletions, sync-consolidated-not-raw). This memory captures that research for when Otto-114 executes.
type: project
---
## The full substrate Aaron shared

Google Search AI summary across ~16 sources covering three
topics that all compose into a single memory-sync architecture:

1. `originSessionId` is NOT native — third-party / custom-
   integration convention (already in Otto-241; this memory
   doesn't re-derive)
2. Sidecar pattern (`.memory-sync-state.json`) as machine-local
   ledger for cross-device memory sync
3. AutoDream / AutoMemory Q1 2026 Anthropic features and how
   they interact with a custom sync layer

## Quality assessment (my read)

**HIGH** on:
- `originSessionId` not native — matches prior research + my
  own harness knowledge
- Sidecar pattern with SHA-256 hashing — standard engineering
  convention; matches patterns like `.DS_Store`, `node_modules/.package-lock.json`
- AutoDream being live — your MEMORY.md top-line literally
  says `[AutoDream last run: 2026-04-23]` so it IS running
- Community tools existing — `perfectra1n/claude-code-sync`
  is a real GitHub repo name I can verify; `claude-memory-sync`
  also cited across sources

**MEDIUM** on:
- `tengu_onyx_plover` as AutoDream internal codename —
  Reddit-sourced only; plausible (Anthropic has used cute
  three-word codenames before) but I cannot verify from
  Anthropic official docs. Treat as "possibly true; don't
  cite as fact in architectural docs"
- Specific AutoDream triggers ("every 24 hours or 5
  sessions") — plausible; exact cadence is an Anthropic
  implementation detail that could drift

**LOW** / treat-carefully on:
- Claim that AutoDream has "trouble with large directory
  refactors" — could be a Reddit anecdote; Otto-114 solver
  should test empirically before trusting

## Sidecar-file content shape (the concrete contribution)

```json
{
  "last_sync": "2026-04-24T10:00:00Z",
  "processed_files": {
    "memory_001.md": "sha256_hash_abc123...",
    "memory_002.md": "sha256_hash_def456..."
  },
  "machine_id": "aaron-laptop-m4",
  "autodream_lock_observed_at": "2026-04-24T09:55:00Z"
}
```

Purpose breakdown:

- **De-duplication**: SHA-256 of file content. Hash unchanged
  → skip the file (no bandwidth burn, no git-history noise).
- **Metadata filtering**: Strip session-specific noise (like
  `originSessionId`, timestamps) before hashing so content
  matches across sessions. Otto-241's scrub discipline is
  exactly this — removing session-noise at the WRITE layer
  means the SYNC layer doesn't have to strip.
- **Machine tracking**: Distinguish "I already pulled this
  from Git remote" vs "this is new local content." Critical
  when Machine A has pulled M1 from Machine B's push, and
  needs to not push M1 back as "new."

## AutoDream / AutoMemory interaction (Q1 2026)

### What Anthropic ships (factory-level)

- **AutoMemory**: automatic ingestion into append-only log
  files under `~/.claude/projects/.../memory/`
- **AutoDream**: background consolidator — merges duplicates,
  prunes stale refs, converts relative dates to absolute,
  rebuilds the 200-line `MEMORY.md` index

### Implication for the sync layer

1. **Sync consolidated, not raw.** The raw append-only logs
   conflict-churn across machines. The post-AutoDream
   consolidated topic files and MEMORY.md index are the
   stable substrate to sync.
2. **Lock-check before sync.** AutoDream may be running when
   sync fires. Writing while AutoDream consolidates risks
   corrupted or mid-transaction state. Sidecar should check
   for AutoDream lock file / running daemon before pushing.
3. **Sync AFTER `/dream` trigger completes.** User-invoked
   consolidation gives the cleanest snapshot; schedule sync
   to follow.
4. **Absolute-date safety.** Since AutoDream converts
   "yesterday" → "2026-03-28", syncing the consolidated
   output avoids cross-machine date-interpretation drift
   (each machine has its own "today").

## Implementation tips (verbatim from research + my read)

1. **Ignore deletions by default.** If user prunes a memory
   on laptop, desktop keeps its copy. Safety posture:
   deletions are risky in eventually-consistent sync; treat
   as manual-review. This matches the "retractability
   visible, not silent" principle (Otto-238 trust vector).
2. **Automate with hooks.** `PostToolUse` hook can trigger
   sync script every time Claude writes a memory file.
   Matches the cadence pattern already in my harness (hooks
   fire on tool use).
3. **Use existing community tools.** `claude-memory-sync`
   and `claude-code-sync` (perfectra1n/claude-code-sync)
   handle the state-management heavy-lifting. Build-on-
   existing is the Occam's Razor move over
   rebuild-from-scratch (rodney / reducer capability).
4. **Git-backed dotfiles pattern.** Common choice: private
   repo for `~/.claude` folder (or relevant subset). That's
   the "bookmark" storage for cross-machine provenance.

## The SKILL.md metaphor (Aaron's question)

Aaron asked: *"this would be a SKILL.md 2nd file in this
metaphor no? for claude code?"*

Yes — structurally. The three-layer composition:

- **CLAUDE.md** / **SKILL.md**: The brain. Committed to Git,
  read by every agent, defines behaviour.
- **MEMORY.md**: The curated projection. Committed,
  auto-updated by AutoDream, reflects current-state index.
- **.memory-sync-state.json**: The bookmark. **Gitignored**,
  machine-local, tracks what THIS machine has synced.
  Doesn't get committed — distinct machines have distinct
  bookmarks.

The composition: CLAUDE.md tells Claude WHAT to do; MEMORY.md
is WHAT-has-been-learned; sidecar is WHAT-has-been-synced.
Three orthogonal concerns, three file homes.

## How this composes with prior memory

- **Otto-114** (ongoing memory-sync mechanism BACKLOG row) —
  This memory is the implementation-design input for that
  row. When Otto-114 executes, start here:
  1. Survey `claude-memory-sync` + `claude-code-sync`
     community tools (don't build from scratch)
  2. Adopt sidecar-file shape with SHA-256 + last_sync +
     processed_files
  3. Gitignore the sidecar (machine-local; per-machine
     bookmark)
  4. Implement lock-check for AutoDream
  5. Ignore-deletions-by-default safety posture
- **Otto-241** (session-id out of factory files) — The
  metadata-filtering concern in the sync layer is reduced by
  the write-layer scrub. Doing both is belt-and-braces.
- **Otto-240** (per-writer-file tick-history) — Aligns. Each
  writer's sidecar naturally scopes to that writer's
  substrate; de-dup is intrinsic because writer-ID
  partitions the namespace.
- **Otto-238** (retractability as trust vector) — The
  "ignore deletions by default" posture is a retractability
  principle: silent cross-machine deletion is non-retractable
  from the destination machine's perspective; preserving the
  copy keeps reversal possible.
- **Otto-86** (peer-agent progression Stage c/d) — Peer
  agents (Codex, Gemini) plus Aaron's two-machine setup
  create a 4+ instance sync problem. Sidecar per machine
  per agent generalises naturally.
- **MEMORY.md top-line** — `[AutoDream last run: 2026-04-23]`
  confirms AutoDream is live in this environment. The
  sync-layer design MUST account for it, not treat it as
  hypothetical future.

## What this memory does NOT authorize

- Does NOT authorize implementing the sync layer this tick.
  This is Otto-114 scope; that row executes in its own tick
  with proper design cycle.
- Does NOT authorize committing `.memory-sync-state.json`
  to git. Machine-local only. Must be gitignored
  immediately if ever created.
- Does NOT authorize adopting `tengu_onyx_plover` as a
  documented codename in factory artifacts. Reddit-sourced
  only; treat as "probably true but unverified."
- Does NOT authorize trusting the specific AutoDream
  trigger cadence ("every 24 hours or 5 sessions") as
  canonical. Anthropic implementation detail that could
  drift between versions.
- Does NOT supersede glass-halo or retractability
  disciplines. Sidecar content must be reversible
  (preserve state transitions) and visible on inspection
  (human-readable JSON).
- Does NOT permit skipping the Otto-114 design-first
  principle. Survey community tools → evaluate → adopt or
  adapt → test → land. Not build-from-scratch-in-one-tick.

## Direct Aaron message to preserve (selective)

> *"larger update from google search ai, again only you know
> if it's good information. do i need originSessionId in
> frontmatter for claude memories"*

And the question that most shifts my implementation map:

> *"this would be a SKILL.md 2nd file in this metaphor no?
> for claude code?"*

Answer: structurally yes, but with the critical difference
that sidecar is **gitignored** (machine-local bookmark)
whereas SKILL.md is **committed** (public contract). Different
visibility classes even when sharing the "lives alongside"
pattern.

And Aaron's explicit AutoDream probe:

> *"Does this work okay with the Q1 feature AutoDream and
> AutoMemory from Anthropic in the claude code harness?"*

Answer: yes but the sync layer must (a) target consolidated
output not raw logs, (b) lock-check before writing, (c)
follow `/dream` completion, (d) handle absolute-date
normalisation that AutoDream produces. These four
constraints reshape the sync design.

## Summary signal for Otto-114 executor

When you (future Otto) execute Otto-114, start here:

1. Read this memory
2. Read Otto-241 (session-id scrub + sidecar reference)
3. `gh repo view perfectra1n/claude-code-sync` — start from
   working implementation
4. `gh search repos claude-memory-sync` — survey alternatives
5. Design doc → ADR → PR with detect-only dry-run phase →
   hook wiring → verify across two-machine test (Otto-215
   Windows harness enables this)
6. Gitignore `.memory-sync-state.json` as first commit, not
   last

The factory already has the conceptual substrate. This row
graduates it to running code.
