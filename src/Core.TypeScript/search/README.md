# `search/` — the repo's own search, with the constraints in the tool

## Use this

```bash
# Safe by default. Refuses an over-budget scope in ~2s instead of hanging.
bun src/Core.TypeScript/search/search.ts <pattern> [paths...] [--ext ts,md] [-i] [--files]

# Deliberate search of an excluded tree (supported — check docs/PRIOR-ART-LIST.md first):
bun src/Core.TypeScript/search/search.ts <pattern> references/prior-art --allow references/prior-art
```

Exit codes: `0` matches · `1` no matches · `2` usage error · **`3` refused**.
`3` is deliberately distinct from `1`: a refusal that shares an exit code with
"no matches" is invisible to the script that called it.

## Why it exists

`CLAUDE.md` has carried "a naive `grep -r .` is a 2-hour runaway" in every
agent's startup context for months. On **2026-08-22** an agent with that text
resident opened its investigation with an unconstrained `grep -rn ... .` from the
repo root; two background jobs ran over an hour and burned host I/O.

The rule was written, correct, and loaded — and it still failed, because prose is
not a mechanism. Aaron's read:

> _"this is one of the main reasons we want to dogfood our own clis and not ever
> rely on bash or random clis from others, they don't have our constraints built
> in to avoid things like this"_

## Two things the prose got wrong, both measured

**1. The named directory is not the heavy one.** `references/prior-art` is
**8.0K** on this machine — a `.gitignore` and a `README.md`, nothing mirrored in.
The 24G checkout is `src/Core.Lean4/.lake` (6.9G), `.git` (4.1G), the
`src/Core.Rust.*/target` dirs (~700M), `node_modules` (222M). An exclusion set
naming only `prior-art` would have prevented nothing. So `exclusions.ts` carries
a **measurement with a date** beside every entry, and a test fails if one is
missing.

**2. The cost is per-file-OPEN, not per-byte or per-directory.**

| operation                              | result                                          |
| -------------------------------------- | ----------------------------------------------- |
| `rg --files` (walk, no opens)          | 40,984 files in **0.33s**                       |
| `rg -c <pattern>` (opens + reads)      | **did not finish in 180s** — 0.53s user, 3% CPU |
| `bun grep.ts <needle>` (whole tree)    | **did not finish in 300s**, no output at all    |
| `bun search.ts <pattern>` (whole tree) | **refused in 2.36s**, naming what to do next    |

`ps` during those runs: Microsoft Defender's on-access scanner at **464% CPU**,
load average **36.6**. Every file open is being scanned, which is why the walk is
~1000x cheaper than the reads — and why a budget on _files opened_, checked by a
walk _before_ any read, is affordable.

## The design in three lines

1. **Walk first** (metadata only, cheap) and count exactly what would be opened.
2. **Refuse** if that exceeds the budget — naming the count, the directories
   responsible, and the flag that would allow it on purpose.
3. **Never narrow silently.** A pruned tree is reported on stderr, and a target
   _inside_ an excluded tree is refused rather than quietly yielding zero. A
   confident empty result is worse than a runaway: the runaway is loud and you
   kill it; the empty result is believed.

## Layer 1 — `.ignore` (free, partial)

`/.ignore` is **generated** from `exclusions.ts` and makes a bare `rg` safe with
no flag to remember. Regenerate and check:

```bash
bun src/Core.TypeScript/search/exclusions.ts --write-ignore
bun src/Core.TypeScript/search/exclusions.ts --check-ignore
```

**Honest limit, stated plainly:** ripgrep, `fd`, and `rga` honour `.ignore`;
**`grep -r` honours none of it** — POSIX grep has no ignore-file concept, so the
exact tool that caused the incident is untouched by that file. You can make
_some_ external tools carry a constraint; you can never make all of them. That
asymmetry is the argument for the CLI, not against it.

## Matching is literal — regex is refused, with a pointer

CodeQL flagged `js/regex-injection` (high) on the first push of this file: a
RegExp built from CLI input can backtrack catastrophically, and JS has no regex
timeout — an unbounded search, which is exactly what this tool exists to refuse.
Shipping it inside the guard would have been the guard undoing itself.

So: **literal here, regex in ripgrep**, whose engine is linear-time and cannot
backtrack (Cox 2007, _Regular Expression Matching Can Be Simple And Fast_) — and
which the `.ignore` in this PR now keeps off the heavy trees anyway.

```bash
rg <your-regex>          # regex, safe by default via .ignore
search.ts <literal-text> # literal, with the scope budget
```

`-e` / `--regex` is **refused with that message**, never silently ignored:
dropping the flag would search the pattern literally and return confidently wrong
results — the same "believed empty answer" failure the excluded-target refusal
exists to prevent.

## The other files here

- `exclusions.ts` — the one place the exclusion set lives; renders `.ignore`.
- `grep.ts` — the 2026-05-31 literal-substring wrapper. Kept (its exclusion list
  now re-exports from `exclusions.ts`) but **prefer `search.ts`**: `grep.ts` has
  no scope budget and no streaming output, so on this tree it is itself the
  runaway it was written to prevent.
- `concept-index.ts` / `lookup.ts` — a curated semantic index, a different job.
- `inverted/` — the **git-native inverted index** (081M0QTXTR3087G0R002R439FH): corpus-wide
  term -> files, built from an **explicit git rev**, committed to
  `db/search-index/inverted/`, rebuilt on a ~6h cadence. Answers _"which files
  mention landauer?"_ in ~20 ms where `git grep` takes ~800 ms — and **refuses**
  rather than answering when its rev is not the rev you asked about. It exists
  because of the 2026-08-22 failure this directory's own README describes from
  the other side: a `grep -r` over a checkout **336 commits behind** origin/main
  reported **0 files** for `landauer` when the true answer was **447**. See
  `inverted/README.md`. It has no positions, so it cannot answer phrases —
  that is a different index type, filed as 081M0QWDDDV087G0R003HM0KYX.

## What this still does not prevent

Named so nobody mistakes the guard for a fence — see the PR body for the full
list. The short version: **nothing stops an agent from typing `grep -r` anyway.**
This tool is an oracle, not a hub — the good path, never the only path, and never
required by `tools/setup/`, the workflows, or the build props.
