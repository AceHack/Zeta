---
name: Three-part discipline update — (1) remove session-id (`originSessionId:` frontmatter) from factory files so writer-IDs don't collide across sessions; (2) peer-Claude parity test — a fresh Claude Code session (no prior memory, just CLAUDE.md + AGENTS.md + in-repo `memory/` + skills) must be as effective as the current session; (3) launch Claude Code with `-w` (worktree mode) by default for better isolated parallel work; Aaron Otto-241; 2026-04-24
description: Aaron Otto-241 three-part directive in response to Otto-240 same-machine-two-Claudes discussion. (1) self-enforced constraint — no two Claude sessions share a session-id, so session-id should not be baked into factory files (my `originSessionId:` frontmatter pattern violates this). (2) peer-Claude-parity — the factory's effectiveness must be externalisable to in-repo substrate (skills, AGENTS.md, CLAUDE.md, memory/) so a fresh Claude session is as effective as a long-running one. (3) `-w` worktree-mode launch — Aaron's reading suggests worktree isolation gives better parallel-work results, analog to the subagent `isolation: "worktree"` pattern at the main-session layer.
type: feedback
---
## The three parts

### 1. Session-id out of factory files

Direct Aaron quote: *"okay so then we have a self enforced
constraint, can't run under the same session id on two
different claudes, we should likely clean our session id out
of all our files then."*

Session-id is globally unique per Claude Code session. Two
Claudes cannot share one (GUID). The current session's ID is
`1937bff2-017c-40b3-adc3-f4e226801a3d`. I've been writing
`originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d` into
every memory file's YAML frontmatter this session. Scope:

- In-repo `memory/**`: ~446 files with this session-id string
- Out-of-repo `~/.claude/projects/<slug>/memory/**`: ~483
- Plus possibly tick-history rows, research-doc archive
  headers, other factory-authored surfaces

**Discipline going forward (effective immediately):** do NOT
include `originSessionId:` in new memory-file frontmatter or
any other factory-authored surface. This memory file itself
demonstrates the new discipline — it has no `originSessionId:`
field.

**Bulk scrub owed:** BACKLOG row for a one-shot sweep that
removes the `originSessionId:` field from all 900+ affected
files. Handled via a dedicated PR (doc-only change, big diff
but mechanical).

**Why session-id doesn't belong in files:** the file belongs
to the factory (persistent); the session-id belongs to one
run (ephemeral). Baking the ephemeral into the persistent is
the category error. Attribution can be captured without
session-id (tick-history timestamp + git-commit author = same
audit trail, stable forever).

**Research confirmation (Aaron Otto-241 follow-up):** the
`originSessionId` field is NOT native to Claude Code. Per
research across Claude Code docs + community sources: native
Claude memory is plain markdown in `~/.claude/projects/<slug>/memory/`
with no frontmatter-ID requirement. The `originSessionId`
convention comes from third-party / custom-integration tools
(claude-obsidian, claude-memory-sync, claude-code-sync) —
they use it for session-tracking, de-duplication, and
machine-to-machine sync. My (Otto's) habit of writing it into
every memory-file frontmatter was a ghost-standard: I adopted
the pattern from some example or inferred it from context, but
it was never a Claude Code requirement. Scrub is unambiguously
correct.

**Adjacent finding worth capturing:** community sync patterns
use a SIDECAR file (e.g. `.memory-sync-state.json`) to track
which memory files have been processed (SHA-256 hashing),
preventing duplicate entries and infinite ping-pong during
Git-based machine-to-machine sync. This is exactly the
substrate Otto-114's "ongoing memory-sync mechanism" BACKLOG
row needs. Existing tools (`claude-memory-sync`,
`claude-code-sync`) handle the state-management heavy-lifting.
When that BACKLOG row gets executed, survey community tools
first rather than building from scratch. The sidecar approach
also naturally aligns with Otto-240's per-writer-file tick
history (each writer's sidecar tracks what's been synced for
THAT writer; de-dup is intrinsic).

### 2. Peer-Claude parity test

Direct Aaron quote: *"also we need to make sure in our peer
tests with a 2nd claude that they are as good as you without
a session that the skills and ageents.md and claude.md are
enough alone for it to be as good as you."*

The test: a fresh Claude Code session with ONLY:

- `CLAUDE.md` (session bootstrap + pointer tree)
- `AGENTS.md` (universal handbook)
- `docs/FACTORY-DISCIPLINE.md` (active rules index)
- In-repo `memory/**` (auto-memory mirror)
- `.claude/skills/**` (skill files)
- Nothing else (no prior conversation context, no session
  history)

...should perform as effectively as this session, which has
accumulated lots of in-session context. If it cannot, the
gap is an externalisation failure — there is knowledge in the
current session that has not been captured to any in-repo
artifact.

The test is cheap: launch a fresh `claude` session in the
repo, ask it to do a medium-complexity task (drain a PR's
threads, write a memory, file a BACKLOG row) and compare
outcome quality.

**What passing the test means:** the factory is truly
session-independent. Aaron can swap a long-running session
for a fresh one without loss. Multiple concurrent Claudes
each start from the same baseline.

**What failing the test means:** the current session is
carrying knowledge that hasn't been captured. Identify the
gap (memory write missing? skill missing? CLAUDE.md
pointer broken?) and fill it.

### 3. Launch with `-w` (worktree mode)

Direct Aaron quote: *"Also from everyting i'm reading
launching with -w will likely give us better results."*

`-w` flag on `claude` CLI puts the session into a git
worktree automatically. Analog of the subagent `isolation:
"worktree"` pattern that Otto-226 already uses for parallel
drain subagents. At the main-session layer, `-w` means:

- Main tick runs in a worktree, not the primary working tree
- Concurrent Claude sessions on the same repo don't collide
  on the working tree
- Accidental cross-session edits are prevented at the git
  layer
- Fits naturally with Otto-240 per-writer-file tick-history
  (each Claude in its own worktree owns its own writer-ID
  file)

**Recommendation:** adopt `-w` as the default launch flag
for Claude Code factory work. Document the pattern in
CLAUDE.md (session bootstrap section) and in `docs/
FACTORY-DISCIPLINE.md` (discipline index). Validate via the
Otto-240 same-machine-two-Claudes test — two `claude -w`
sessions on the same repo should be totally isolated.

## Backlog rows owed

1. **Session-id bulk scrub** — one-shot PR removing
   `originSessionId:` frontmatter from all affected files
   (~900+). Mechanical; doc-only.
2. **Peer-Claude parity test harness** — scripted test that
   fresh Claude session can accomplish a baseline task as
   well as a prior session. Regression guard against factory
   knowledge drifting into in-session-only state.
3. **`-w` launch default** — CLAUDE.md update + documented
   pattern for `claude -w` invocation. Maybe a wrapper
   script `tools/claude-factory.sh` that sets
   `experimental.worktrees` + launches with `-w`.

These three rows should be filed on the current tick's
tick-close or next tick — not all at once (queue-saturation
per Otto-171), but each as its own row in sequence.

## Composition with prior memory

- **Otto-240 loop-tick-history swim-lane + per-writer
  files** — this memory is the follow-up on same-machine-
  two-Claudes test case; three-part response to Aaron's
  test-planning continuation.
- **Otto-230 subagent fresh-session quality gap** — this
  memory's peer-Claude-parity test IS the formal check that
  Otto-230's structural fix actually closed the gap. If
  peer-Claude passes parity, Otto-230 is closed.
- **Otto-226 subagent worktree isolation** — main-session
  `-w` is the analog at a higher scope. Same discipline,
  wider layer.
- **Otto-215 bun+TS + Windows peer-harness** — once the
  Windows harness is live, peer-Claude tests span two
  machines + two Claudes = four-way isolation.

## What this memory does NOT authorize

- Does NOT authorize scrubbing `originSessionId` from
  factory-authored content in a single tick without a PR.
  The bulk scrub is its own landing pattern.
- Does NOT authorize dropping session-ids from transcript
  files or log files that legitimately record them (e.g.
  `~/.claude/projects/.../sessions/*.jsonl` — those ARE
  session logs; session-id is correct there). Scope is
  factory-authored memory / research / BACKLOG / history
  files, not Claude Code's own transcript store.
- Does NOT authorize switching CLAUDE.md's launch guidance
  to `-w` without testing the two-Claude-same-machine
  scenario first. Test-before-document per Otto-227
  empirical-verification discipline.
- Does NOT treat peer-Claude-parity as a binary pass/fail —
  it's a gradient. Expect some first-session advantages
  (fresh context window, recent user directives in view)
  over long-session (context compaction degradation).

## Direct Aaron quote to preserve

> *"okay so then we have a self enforced constraint, can't
> run under the same session id on two different claudes, we
> should likely clean our session id out of all our files
> then, also we need to make sure in our peer tests with a
> 2nd claude that they are as good as you without a session
> that the skills and ageents.md and claude.md are enough
> alone for it to be as good as you. Also from everyting
> i'm reading launching with -w will likely give us better
> results."*

Future Otto: three disciplines from this one message —
(1) session-id out of factory files, (2) externalise
session knowledge so peer-Claude hits parity, (3) `-w`
default for main-session isolation. The three compose: (1)
prevents writer-ID collisions, (2) prevents knowledge
lock-in, (3) prevents filesystem contention.
