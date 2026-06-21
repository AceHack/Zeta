---
name: pr-4059-two-ci-failure-lessons-backlog-regen-working-tree-leak-and-invisible-unicode-typography-leak
description: "Two substrate-honest CI-failure lessons from PR #4059 round-2: (1) BACKLOG_WRITE_FORCE=1 reads working tree, not HEAD — uncommitted row mods leak into BACKLOG.md via regen and create drift CI catches; (2) prior-tool typography U+200B leaks into prose when transcribed verbatim and triggers semgrep invisible-unicode-in-text (working as designed)."
type: feedback
created: 2026-05-17
---

## Context

PR [#4059](https://github.com/Lucent-Financial-Group/Zeta/pull/4059) was opened at 10:19Z shipping the Imaginary Stack Step-1 cluster (081KRQ1AB0008QG0R001YAF3TR + 2 research + Lean toy model). First CI sweep surfaced 3 mechanical failures (BACKLOG.md drift + tick-shard relative-paths + markdownlint MD047). I fixed all 3 in commit `b8d6947` at 10:34Z. Round-2 CI surfaced **2 new failures** that revealed structural lessons worth substrate-landing.

## Lesson 1 — `BACKLOG_WRITE_FORCE=1` regen reads working tree, not HEAD

### The failure mode

CI's `check docs/BACKLOG.md generated-index drift` ran `bun tools/backlog/generate-index.ts --check` against committed state and reported:

```
< - [ ] **[081KRHWGX0008QG0R000M9RFY2](...)** Axis-3 prior-art audit ...   ← generator output (on committed row)
> - [x] **[081KRHWGX0008QG0R000M9RFY2](...)** Axis-3 prior-art audit ...   ← committed BACKLOG.md
```

### Root cause

When the first round of fixes ran locally:

1. Working tree had `docs/backlog/P1/081KRHWGX0008QG0R000M9RFY2-...md` modified (status: `open` → `closed`), uncommitted.
2. `BACKLOG_WRITE_FORCE=1 bun tools/backlog/generate-index.ts` read the WORKING-TREE state of 081KRHWGX0008QG0R000M9RFY2 (status: closed) and produced BACKLOG.md with `[x]` for 081KRHWGX0008QG0R000M9RFY2.
3. I committed only `docs/BACKLOG.md`, leaving the 081KRHWGX0008QG0R000M9RFY2 row file uncommitted.
4. CI checked out the commit (HEAD's 081KRHWGX0008QG0R000M9RFY2 = `open`), regenerated, got `[ ]`, diffed against committed BACKLOG.md (`[x]`), reported drift.

The generator is doing exactly what it's supposed to do (read filesystem state). The discipline failure was committing one half of a paired mutation.

### Discipline

When regenerating BACKLOG.md via `BACKLOG_WRITE_FORCE=1`:

**Option A — commit all paired mutations together**

```bash
# All row mods that affect BACKLOG.md must land in the same commit:
git add docs/backlog/P*/B-NNNN-*.md docs/BACKLOG.md
git commit -m "..."
```

**Option B — stash uncommitted row mods, regen, commit BACKLOG.md, restore stash**

```bash
git stash push --keep-index docs/backlog/P*/B-XXXX-*.md   # the rows you DON'T want in this commit
BACKLOG_WRITE_FORCE=1 bun tools/backlog/generate-index.ts
git add docs/BACKLOG.md
git commit -m "..."
git stash pop
```

**Option C — verify locally via `--check` before commit, ALSO with mods stashed**

```bash
git stash push docs/backlog/P*/B-XXXX-*.md
bun tools/backlog/generate-index.ts --check    # exit 0 = matches generator output on COMMITTED state
git stash pop
```

`--check` exit 0 with the stash active is the same comparison CI does. This is the cheap pre-flight check.

### Composes with

- [`.claude/rules/backlog-item-start-gate.md`](../.claude/rules/backlog-item-start-gate.md) (substrate-drift step-0)
- [`.claude/rules/refresh-before-decide.md`](../.claude/rules/refresh-before-decide.md) (verify-before-commit invariant; this is its commit-time projection)

## Lesson 2 — Conversation-context typography leaks invisible Unicode into tick shards

### The failure mode

CI's `lint (semgrep)` `invisible-unicode-in-text` rule fired with 2 blocking findings on `docs/hygiene-history/ticks/2026/05/17/1034Z.md` line 41:

```
Invisible Unicode codepoint detected. Zero-width spaces, word-joiners,
bidi overrides, and isolates are classic steganographic carriers...
```

The codepoint was `U+200B` (zero-width space). Two findings at the same line because the line contained two such characters.

### Root cause

Earlier in the session, the audit script output displayed two path strings that differed by their depth-prefix length (five `..` segments vs six). Some prior tool or paste step inserted U+200B between the trailing `/` and the next path segment as a disambiguator — a typography trick where two strings that render character-for-character identically actually carry distinct codepoint sequences. The U+200B is invisible when rendered but is a real byte in the file.

When I transcribed that path-fix description into the 1034Z.md tick shard prose VERBATIM, I inherited the hidden character. The shard rendered identically to the reader but carried a steganographic payload.

The semgrep rule (under `.claude/skills/prompt-protector` lineage) caught this — **doing exactly what it was built to do** (detect zero-width-space / bidi / word-joiner steganography in skill files and prompt-bearing documents).

### Discipline

When transcribing tool output or prior conversation text into tick shards / memory files / prose:

1. **Prefer plain-prose rephrasing over verbatim transcription.** Describe the path-depth fix in words rather than pasting the literal mis-typographed string.
2. **If verbatim is required** (e.g., preserving an external AI packet per `.claude/rules/substrate-or-it-didnt-happen.md`'s verbatim-preservation discipline), the canonical preservation surface is `docs/research/` with §33 archive headers, AND the file must pass `invisible-unicode-in-text` semgrep scan first.
3. **Detection one-liner** for pre-commit verification:

```bash
python3 -c "
import sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    txt = f.read()
bad = [0x200B, 0x200C, 0x200D, 0xFEFF, 0x2060] + list(range(0x2066, 0x206A))
n = sum(1 for c in txt if ord(c) in bad)
print(f'invisible-unicode-count: {n}')" <path>
```

Should print `0` for any tick shard or skill file before commit.

### Composes with

- [`.claude/rules/pliny-corpus-restriction.md`](../.claude/rules/pliny-corpus-restriction.md) (steganographic carrier discipline at adversarial-corpus scope)
- [`.claude/rules/substrate-or-it-didnt-happen.md`](../.claude/rules/substrate-or-it-didnt-happen.md) (verbatim-preservation has dedicated surface)
- `.claude/skills/prompt-protector/SKILL.md` (the lineage of `invisible-unicode-in-text`)
- `.claude/skills/steganography-expert/SKILL.md` (detection theory)

## Meta-lesson — both failures share the same shape

**Working-tree state leaks into committed artifacts via implicit channels.** In Lesson 1, the channel is the generator reading the filesystem. In Lesson 2, the channel is conversation context riding into the editor. In both cases:

- The author's intent is correct
- The mechanism is invisible until CI catches it
- The fix is to either (a) commit all paired mutations together, or (b) verify the artifact in isolation before commit

This is one specific projection of the more general principle that **commit boundaries are the truth-surface**: the working tree is private; the committed state is what review/CI/peers see. Discrepancies between the two are the failure-mode root cause.

## Future-Otto cold-boot disposition

When shipping a CI-touched artifact (BACKLOG.md, tick shard, generated index):

1. Run the CI's exact verification command locally first (`--check` mode, lint scans).
2. If working tree has uncommitted mods that *might* affect the verification, stash them, re-run, restore.
3. For tick shards specifically: run `python3 -c "..."` invisible-Unicode scan on the new file before commit.
4. The semgrep rule is a friend, not an obstacle — `prompt-protector` lineage is load-bearing under the methodology-hard-limits rule.

## Origin

Authored 2026-05-17T11:38Z (Otto-CLI autonomous-loop tick 1138Z) on the PR #4059 branch under pure-git tier conditions (GraphQL exhausted post-CI investigation; reset 21 min). Composes with the 1019Z + 1034Z + 1129Z tick shards on the same branch.
