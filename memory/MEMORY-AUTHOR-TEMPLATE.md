# Memory author template — absorb-time lint hygiene

Quick reference for authors (humans or agents) writing
memory files under `memory/` in this repo. Captures the
five markdownlint classes that have repeatedly bitten
absorb-time drafts during the 2026-04-23 Overlay A cadence
(PRs #157 / #158 / #159 / #162 / #164), so future
migrations and fresh-writes don't rediscover the same
cleanups.

CI runs `markdownlint-cli2 "**/*.md"` on every PR; lint
failures block merge. Applying the five patterns below at
author-time keeps the draft clean in one pass.

## The five absorb-time lint classes

### 1. MD003 — heading style (atx, not setext)

**Wrong:**

```markdown
Some conclusion text.
---
## Next section
```

The `---` immediately after a text line is parsed as a
setext H2 for that text. Blank line required between
them.

**Right:**

```markdown
Some conclusion text.

---

## Next section
```

### 2. MD018 — no space after hash

Lines beginning with `#NNN` where `NNN` is a number (e.g.
PR references like `#158`) get parsed as a heading with a
missing space.

**Wrong:**

```markdown
follows PRs #157, #158, #159,
#162, #164).
```

**Right (rephrase to avoid number-at-start-of-line):**

```markdown
follows the earlier four Overlay-A PRs.
```

Or put a non-numeric word in front of the `#` if the
numbers matter.

### 3. MD022 — blanks around headings

Headings need blank lines above **and** below. Multi-line
headings are also flagged because markdown treats only
the first line as heading.

**Wrong:**

```markdown
## What people typically know about AI in engineering (the
common priors)

- Bullet text
```

**Right (single-line heading):**

```markdown
## What people typically know about AI in engineering (the common priors)

- Bullet text
```

### 4. MD026 — no trailing punctuation in headings

Headings ending in `:` are flagged.

**Wrong:**

```markdown
## Why:

- First reason
```

**Right:**

```markdown
## Why

- First reason
```

Same applies to `## How to apply:` → `## How to apply`,
`## Rule:` → `## Rule`, etc.

### 5. MD032 — blanks around lists

Lists need blank lines above and below.

**Wrong:**

```markdown
**Why:**
- First reason
- Second reason
- Third reason
Next paragraph starts here.
```

**Right:**

```markdown
**Why:**

- First reason
- Second reason
- Third reason

Next paragraph starts here.
```

Same applies to ordered lists (`1.`, `2.`, ...).

## Self-check checklist

Before committing a new memory file:

1. Run `markdownlint-cli2 memory/<your-file>.md` locally
   if `markdownlint-cli2` is installed.
2. Or eyeball the file for the five patterns above.
3. If a lint error fires in CI despite this check, add
   the new class here so the next author doesn't
   rediscover it.

## Not covered here

This template covers the absorb-time lint classes only.
Content-level discipline lives in separate substrate:

- Memory frontmatter schema (`name`, `description`,
  `type`, `originSessionId`): see `CLAUDE.md`
  auto-memory section and the AutoMemory / AutoDream
  references.
- Signal-preservation (verbatim quotes, no paraphrase on
  ingest, supersede markers not deletion): see
  `memory/feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`.
- In-repo-preferred where possible: see the per-user
  feedback memory on that discipline (exists at
  `~/.claude/projects/<slug>/memory/` pending a future
  Overlay A migration).
- Newest-first ordering in `MEMORY.md` index: see
  `memory/feedback_newest_first_ordering.md`.

## When the five classes are out of date

This template should be updated whenever a new
absorb-time lint class is observed consistently across
multiple memory drafts. Add the class here with
wrong/right examples and a one-line rule.
