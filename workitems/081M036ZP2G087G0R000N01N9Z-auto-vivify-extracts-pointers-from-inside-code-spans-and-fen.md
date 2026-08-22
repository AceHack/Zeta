---
id: 081M036ZP2G087G0R000N01N9Z
type: bug
state: backlog
priority: P2
slug: auto-vivify-extracts-pointers-from-inside-code-spans-and-fen
title: "auto-vivify extracts pointers from inside code spans and fenced code blocks: a bash double-bracket file test in workitems/081M00VMS1E087G0R0001SCSAH parses as a wikilink and resolves to db/-f, which is fabricated shell syntax, not a pointer"
created: 2026-08-15T17:19:48.304Z
depends_on: []
composes_with: []
---

# auto-vivify parses pointers inside code spans and fenced code blocks

## The defect

`src/Core.TypeScript/backlog/auto-vivify.ts` `extractPointers` walks the file
line by line over raw text. It never tracks fenced code blocks and never
excludes inline code spans. Every regex — wikilink, markdown link, backtick
path — therefore fires on shell, YAML, and sample-markdown content as readily
as on prose.

Reproduced on `origin/main` at `9b21dbd6`:

```
bun src/Core.TypeScript/backlog/auto-vivify.ts --check   # exit 1, 12 dangling
  broken -> db/-f (referenced by: workitems/081M00VMS1E087G0R0001SCSAH-...md)
```

The source is a prose sentence in that work-item describing a shell guard: a
bash double-bracket file test, written inside a code span. The wikilink regex
`\[\[([^\]]+)\]\]` matches the double brackets, yields the target `-f`, and
rule 4 of `resolvePointer` roots it under `db/`. Without `--check`, the
vivifier would create a stub file named after a shell flag.

## Why it is worth fixing before the executable-markdown work, not after

The whole point of the playbooks direction is to put *more* executable code
into markdown. Every additional fenced block is additional surface for this
bug. A vivifier that cannot tell shell syntax from a link will manufacture a
growing tail of junk files exactly as the corpus of executable markdown grows.

## Fix sketch

1. Strip fenced blocks (``` and ~~~, with the closing fence matched at the
   same or greater length) before extraction, tracking line numbers so
   reporting stays accurate.
2. Strip inline code spans (backtick runs, CommonMark rule: a span is closed
   by a backtick run of equal length).
3. Rule 3 of `extractPointers` — the backtick-path rule — becomes dead under
   (2) by construction. That is the correct outcome and is the subject of
   081M036ZVSP087G0R001RQD2TH; land the register decision there, not here.

Anchor: CommonMark 0.31.2 §6.1 code spans, §4.5 fenced code blocks. Nothing
here is novel; the parser simply is not a markdown parser.

## Falsifier

A regression test with a fixture containing a bash double-bracket test inside
a fenced block and inside a code span. The test fails on the current
implementation and passes after the fix. Mutation check: deleting the fence
stripping must make the test go red.

## Scope guard

This item fixes ONE of the 12 dangling references. The other 11 are the
mention-vs-pointer register problem and belong to
081M036ZVSP087G0R001RQD2TH. Do not conflate them: this one is mechanical and
has a single right answer; that one needs a grammar decision from Aaron.
