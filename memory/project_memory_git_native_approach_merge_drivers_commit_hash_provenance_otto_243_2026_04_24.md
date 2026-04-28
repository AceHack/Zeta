---
name: Git-native memory approach — relocate memory into repo (already done at `memory/` root not `.claude/memory/`), pre-commit hook auto-stages memory changes, **custom Git merge driver** handles AutoDream append-conflicts via `.gitattributes`, **`git rev-parse HEAD` commit-hash replaces `originSessionId` provenance**; architectural tension with Otto-242 sidecar pattern (competing philosophies not composable layers); caveat on CLAUDE.md-redirecting-AutoMemory claim (likely wrong for Anthropic native); Aaron Otto-243 third Google-Search-AI share; 2026-04-24
description: Aaron Otto-243 asked *"how do i make all this git native instead"* after Otto-242 sidecar-pattern share. Google Search AI proposed four-part git-native architecture: (1) in-repo memory folder + CLAUDE.md rule, (2) pre-commit hook auto-stages memory, (3) custom git merge driver for AutoDream conflict handling via `.gitattributes`, (4) git commit hash replaces session-id for provenance. Architectural TENSION with Otto-242 sidecar: sidecar says memory is machine-local state (gitignored bookmark), git-native says memory IS source code (everything tracked). Not composable — two competing philosophies. Aaron's actual repo already committed to a hybrid: in-repo `memory/` mirror exists at repo root, Anthropic native AutoMemory continues writing to global `~/.claude/...`.
type: project
---
## Aaron's question and the proposal

Direct Aaron quote:

> *"little more information from google search ai now how
> do i make all this git native instead"*

Google Search AI proposed a four-part git-native architecture
that **replaces** the sidecar approach from Otto-242:

1. **Relocate memory into the repo** — `.claude/memory/` as
   Git-tracked folder; CLAUDE.md rule tells Claude to write
   there instead of global `~/.claude/`
2. **Pre-commit hook as "sidecar logic"** —
   `.git/hooks/pre-commit` with `git add .claude/memory/*.md`
   auto-bundles memory changes into every commit
3. **Git merge driver for AutoDream conflicts** —
   `[merge "memory-merge"]` in `.git/config` with
   `driver = cat %O %A %B | sort -u > %A`, assigned via
   `.gitattributes`: `.claude/memory/*.md merge=memory-merge`
4. **Git commit hash replaces `originSessionId`** — CLAUDE.md
   rule: *"When updating memories, include the current Git
   commit hash (git rev-parse HEAD) as the version
   reference"*

## My quality assessment

**HIGH** on:
- Git merge drivers are real, documented Git feature
  (`gitattributes(5)` + `git-config` "merge.<driver>.driver").
  Exactly the right tool for programmatically resolving
  append-style conflicts.
- `.gitattributes` mapping files → drivers is standard
  pattern (Unity uses it for scene merging, Git LFS uses it,
  etc).
- `git rev-parse HEAD` returning current commit SHA is
  correct; commit-hash as provenance is an elegant
  substitute for session-id because it's deterministic,
  verifiable, and links a memory to the code-state that
  produced it.
- Pre-commit hook for auto-staging is standard mechanism.

**MEDIUM** on:
- The specific merge-driver formula
  `cat %O %A %B | sort -u > %A` is simplistic. It produces
  lexically-sorted + unique lines. That works for
  line-append logs (like `loop-tick-history.md` sort of, if
  you squint) but **destroys narrative markdown** — any memory
  with multi-line paragraphs, headings, reasoning gets
  shuffled into incoherence. A real merge driver for this
  substrate would need to be file-type-aware (different
  driver for `MEMORY.md` index vs narrative memory files
  vs tick-history append-logs).

**LOW** / significant caveat:
- The claim that adding a CLAUDE.md rule forces Claude
  Code's **native AutoMemory** to write to `.claude/memory/`
  in the repo is **likely wrong as stated**. Anthropic's
  native AutoMemory is a harness behaviour — it writes to a
  hard-coded location (`~/.claude/projects/<slug>/memory/`)
  that I cannot redirect with CLAUDE.md rules. CLAUDE.md can
  only affect my own explicit `Write`-tool actions when I'm
  deciding where to save. The native AutoMemory writer is
  outside my directive scope.
  - Verification check: if Aaron sets the CLAUDE.md rule
    and observes that AutoMemory files still appear at the
    global location, the claim is disconfirmed.
  - Practical workaround: a sync script / symlink can mirror
    global → in-repo, which is effectively what Aaron's
    Overlay-A in-repo `memory/` does today.

## Architectural tension with Otto-242 sidecar pattern

Otto-242 (prior share) and Otto-243 (this share) propose
**competing** architectures, not composable layers:

| Axis | Otto-242 Sidecar | Otto-243 Git-native |
|------|------------------|---------------------|
| Memory file location | Could be anywhere; sync script decides | **In-repo** (`.claude/memory/` or Aaron's `memory/`) |
| Sync mechanism | Custom script + SHA-256 ledger | `git push/pull` + merge driver |
| Conflict resolution | De-dup via hash-skip | Merge driver (per-file-type logic) |
| Sync state storage | `.memory-sync-state.json` (GITIGNORED) | Nothing separate — git IS the state |
| Provenance marker | Custom (strip session-id before hash) | `git rev-parse HEAD` in frontmatter |
| Cross-machine race | Avoided by hash + lock check | Handled by git merge semantics |
| Ignore-deletions safety | Explicit in sync script | **NOT handled** — `git rm` propagates |

Choosing one philosophy commits you to it: you don't need
the sidecar's `processed_files` hash-ledger if git itself
tracks what's been pushed, and you don't need
`git rev-parse HEAD` in frontmatter if your sidecar maintains
separate provenance.

## Aaron's repo as a hybrid — current empirical state

Your actual repository already lives between the two:

- **Layer 1 (Anthropic native AutoMemory)**: writes to
  `~/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory/`.
  This is outside your control; CLAUDE.md rules don't
  redirect it (my assessment above).
- **Layer 2 (explicit Agent Writes)**: I follow your CLAUDE.md
  rules and can write anywhere. Today I default to the Layer
  1 location to compose with AutoMemory.
- **Layer 3 (in-repo mirror at `memory/` root)**: your
  Overlay-A manual mirror. ~487 files mirrored per earlier
  MEMORY.md note *"memories are in repo now, feel free to
  refresh if needed."*
- **Layer 4 (proposed git-native)**: replace the manual
  mirror with git-first primitives (merge driver, commit
  hash provenance, pre-commit hook, maybe a pull hook to
  reflect pulled memories back into Layer 1 for consumption
  by the harness).

Your hybrid benefits from both shares without fully
committing: (i) Otto-242 sidecar insights apply to the
Layer-1-→-Layer-3 sync gap; (ii) Otto-243 git-native insights
apply to Layer-3-↔-Layer-3-on-other-machines sync via git.

## Actionable recommendations when Otto-114 executes

1. **Adopt git merge driver for append-only files** —
   `docs/hygiene-history/**` and any file that's genuinely
   line-append. Custom driver needs to:
   - Sort by timestamp column (not lexical sort)
   - Preserve multi-line entry structure
   - Handle both machines appending different rows same-
     second (tie-break by writer-id)
   - File-type test via `.gitattributes` globs
2. **Do NOT use the naive `cat|sort -u` driver** — destroys
   narrative content. Per-file-type driver or per-file-type
   merge strategy.
3. **Commit-hash as optional provenance** — if we want a
   replacement for the retired `originSessionId` field, use
   `repoSha: <SHA>` frontmatter field. Stable, verifiable,
   links memory to code state. Otto-241 forbade
   `originSessionId`; it did NOT forbid `repoSha`.
   - Caveat: commits happen AFTER memory-write in most
     cases, so you'd be writing the commit hash of the
     PRIOR commit (the one before the one this memory will
     land in). That's still useful ("this memory was
     written while at state X") but less load-bearing than
     the "this memory belongs to commit Y that introduced
     it" framing. Better: let the commit itself be the
     provenance; don't duplicate in frontmatter.
4. **Pre-commit hook auto-stage memory** — viable if the
   in-repo `memory/` location is mechanically populated.
   But for manual-review memories, auto-staging risks
   committing unreviewed content. Prefer explicit `git add`
   during human-controlled commits.
5. **Cross-machine conflict test** — before adopting,
   simulate: Machine A appends to `loop-tick-history.md`,
   pushes. Machine B (pre-pull) also appends, tries to
   push. Verify merge driver correctly interleaves both
   appends without data loss or duplication. This is the
   canonical test case for the whole scheme.
6. **Don't force AutoMemory redirect via CLAUDE.md** —
   suspect claim. Test first. If it doesn't work, keep the
   Overlay-A mirror pattern and focus git-native work on
   Layer 3.

## Composition with prior memory

- **Otto-242 sidecar pattern** — competing architecture,
  not composable layer. Choosing git-native obsoletes the
  sidecar ledger (git IS the ledger). Choosing sidecar
  obsoletes the merge-driver (sync script resolves
  conflicts). Hybrid possible: sidecar for Layer-1-to-3,
  git-native for Layer-3-to-3.
- **Otto-241 session-id scrub** — still valid; commit-hash
  replacement is explicitly allowed (new field `repoSha:`
  is NOT the forbidden `originSessionId:` field).
- **Otto-240 per-writer-file tick-history** — git-native
  approach composes excellently with this: each writer
  owns its own file, so merge conflicts are rare; merge
  driver is only needed for a few truly-shared files
  (MEMORY.md index being the main one).
- **Otto-114 ongoing memory-sync mechanism** (BACKLOG row)
  — this memory + Otto-242 together form the
  implementation-design input when that row executes.
- **Otto-230 subagent fresh-session quality gap** — the
  git-native approach naturally solves the subagent-can't-
  read-my-memory problem because the memory IS in the
  repo (subagents Read it).

## What this memory does NOT authorize

- Does NOT authorize implementing any of this in the
  current tick. Otto-114 scope.
- Does NOT authorize adding a CLAUDE.md rule that claims
  to redirect AutoMemory without first verifying the
  claim empirically.
- Does NOT authorize the naive `cat|sort -u` merge driver
  on narrative memory files — data destruction risk.
- Does NOT authorize auto-staging memory in pre-commit
  hooks without discussion of unreviewed-content risk.
- Does NOT supersede Otto-241 discipline. Commit-hash is a
  new optional field; `originSessionId` remains forbidden.
- Does NOT treat Google Search AI output as authoritative.
  Quality assessment above identifies load-bearing claims
  that need verification before adoption.

## Direct Aaron message to preserve

> *"little more information from google search ai now how
> do i make all this git native instead"*

Aaron's framing "instead" signals preference for the
git-native path over sidecar. My honest counter: the merge-
driver + commit-hash parts are strong additions, the
CLAUDE.md-redirects-AutoMemory part is likely wrong, and
the architectural-tension with Otto-242 means choose one
primary philosophy rather than layer both.

## Signal for Otto-114 executor

When you execute Otto-114, treat Otto-242 + Otto-243 as
**competing design proposals** to evaluate, not two halves
of a single architecture. Decide primary philosophy first
(sidecar-for-metadata vs. git-as-source-of-truth), then
pull the specific primitives that compose with it:

- If sidecar-primary: adopt Otto-242's ledger shape,
  skip merge drivers, skip pre-commit hooks.
- If git-native-primary: adopt Otto-243's merge driver
  (per-file-type, NOT `cat|sort -u`), skip the sidecar
  ledger.
- If hybrid (what the repo currently is): sidecar
  handles Layer-1-to-3, git handles Layer-3-to-3. Adopt
  both but scope each explicitly.

Verify the AutoMemory-location claim empirically before
committing to either. Run `git rev-parse HEAD` frontmatter
field as a smoke-test for commit-hash-as-provenance
before adopting wholesale.
