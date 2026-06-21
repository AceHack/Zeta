---
name: fenced-shell-transcript-hygiene
description: Operational rule for distinguishing tool output from derived summary inside fenced shell-transcript blocks; addresses Copilot finding pattern caught on PR #3856 thread (line 32 of 1017Z shard).
type: feedback
created: 2026-05-16
---

# Fenced shell transcripts must distinguish command output from derived summary

Carved sentence:

> Inside a fenced shell block, lines starting with `$ ` are commands the
> reader can copy-paste; lines that follow are EXPECTED to be the literal
> output of that command. A derived summary line (manual calculation, prose
> framing, aggregation) inside the same fence breaks copy-paste reproducibility
> because the line is not what the tool would actually emit.

## Operational rule

When authoring a shell transcript inside a fenced block in a tick shard,
memory file, or doc:

1. **Lines beginning with `$ `** are commands the reader can copy-paste
2. **Lines immediately following** must be the literal output of that
   command (what you would see if you ran it fresh)
3. **Derived summaries** (manual calculations, aggregations, prose framing)
   MUST be ONE of:
   - A `#` comment prefix line INSIDE the fence
     (e.g., `# total = 0 corrected-tag annotations`)
   - Prose OUTSIDE the fence
     ("The `grep -c` returns 0 for both files, totaling 0.")
   - A separately-labeled fenced block

Mixing the two inside the same fence produces a transcript that LOOKS
reproducible but isn't — running the commands fresh produces different
output than what is pasted, and the reader cannot tell which lines came
from the tool vs the author.

## Empirical anchor

Copilot review of [PR #3856](https://github.com/Lucent-Financial-Group/Zeta/pull/3856)
flagged this pattern in `docs/hygiene-history/ticks/2026/05/16/1017Z.md`
line 32:

```
$ grep -c "corrected 2026-05-05" tools/lean4/Lean4/DbspChainRule.lean docs/research/chain-rule-proof-log.md
0 + 0 = 0 corrected-tag annotations
```

The line `0 + 0 = 0 corrected-tag annotations` is a manual summary.
The actual `grep -c` output (verified by re-running the command form) is:

```
tools/lean4/Lean4/DbspChainRule.lean:0
docs/research/chain-rule-proof-log.md:0
```

Substrate-honest authoring (comment-prefix form):

```
$ grep -c "corrected 2026-05-05" tools/lean4/Lean4/DbspChainRule.lean docs/research/chain-rule-proof-log.md
tools/lean4/Lean4/DbspChainRule.lean:0
docs/research/chain-rule-proof-log.md:0
# total = 0 corrected-tag annotations
```

Or (prose-outside-fence form):

```
$ grep -c "corrected 2026-05-05" tools/lean4/Lean4/DbspChainRule.lean docs/research/chain-rule-proof-log.md
tools/lean4/Lean4/DbspChainRule.lean:0
docs/research/chain-rule-proof-log.md:0
```

**Total: 0 corrected-tag annotations** across both files.

## Why not auto-loaded as `.claude/rules/`

Single finding on a single PR so far. Per the suspect-by-default Copilot
finding-classes threshold in `.claude/rules/blocked-green-ci-investigate-threads.md`
("two-or-more across distinct PRs is the threshold for 'suspect-by-default'"),
this is below the rule-promotion threshold. Lands as memory file substrate;
future-Otto cold-boot can find it via skill-router search on "transcript",
"fenced", or "shell-transcript" keywords. If a second occurrence accumulates,
promote to `.claude/rules/`.

## Composes with

- `.claude/rules/refresh-before-decide.md` — two-layer print DX is the
  same shape at one-up scope (raw structured output BEFORE the
  interpretation layer; mixing the two layers IS the bug class)
- `.claude/rules/blocked-green-ci-investigate-threads.md` — suspect-by-default
  Copilot finding-classes; this finding is NOT in the FP class
  (the table double-pipe FP); this is a real correctness finding worth
  acting on
- `docs/hygiene-history/ticks/README.md` — tick-shard authoring conventions

## Origin context

PR #3856 carried the 2026-05-16T10:17Z 081KQTPYE0008QG0R003DK06PA #2-Ready audit shard.
Copilot surfaced two threads after merge; this memory file documents the
forward-substrate signal from thread #2. Thread #1 (ordinal drift across
two-stream Otto-CLI sessions) was resolved with reference to multi-Otto
contamination per `.claude/rules/claim-acquire-before-worktree-work.md`.

Authored via borrow-on-existing pattern (`git switch -c <new> origin/main`)
to avoid contention with peer Otto-CLI's primary-worktree branch
`shard/tick-1029z-postclose-otto-cli-2026-05-16`. Counter-with-escalation
brief-ack #6 forced this decomposition at 2026-05-16T10:44Z per
`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`.
