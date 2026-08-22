---
id: 081M036ZVSP087G0R001RQD2TH
type: task
state: backlog
priority: P2
slug: resolution-register-for-markdown-names-a-backticked-filename
title: "Resolution register for markdown names: a backticked filename in prose is a MENTION, a link is a POINTER, and evidence about a deleted file is a CITATION — auto-vivify treats all three alike and mis-roots 11 of 12 unmarked mentions under db/; mark the register syntactically instead of inferring it"
created: 2026-08-15T17:19:57.049Z
depends_on: []
composes_with:
  - 081M036ZP2G087G0R000N01N9Z
---

# Resolution register: mention vs pointer vs citation

## The measurement

`bun src/Core.TypeScript/backlog/auto-vivify.ts --check` on `origin/main` at
`9b21dbd6` exits 1 with 12 dangling references. Reading each one at its source
line rather than at the report line, they sort into three registers:

| register | what the author meant | count | example source text |
|---|---|---|---|
| **mention** | naming a thing in prose; no navigation intended | 10 | "`new-item.ts` mints the ZetaId and scaffolds the file" |
| **citation** | evidence about a file that is *supposed* to be absent | 1 | plists name a wrapper script "deleted by PR #8088" |
| **pointer** | go read this | 1 | a relative path the author expected to resolve |

Every one of the 10 mentions is a bare filename or partial path inside a code
span. `resolvePointer` rule 4 falls back to rooting unresolvable names under
db/, so the mention "inventory/new-item.ts" — which actually lives at
`src/Core.TypeScript/inventory/new-item.ts` — is reported as broken at
db/inventory/new-item.ts, a path that was never written by anyone.

(That paragraph is itself the bug in miniature: written with the code spans
its own subject matter suggests, it would have added two more entries to the
very report it describes.)

## Why inference cannot fix this

The three registers are *indistinguishable from the text*. A code span around
a filename means "I am naming this" in every one of the 12 cases and "go here"
in none of them. Any heuristic that vivifies mentions manufactures files; any
heuristic that suppresses them silently drops real pointers. The citation case
is the sharpest: vivifying a stub for a file whose absence is the finding
*destroys the finding*.

Anchor (Beacon): this is the **use–mention distinction** (Quine, *Mathematical
Logic*, 1940 — a name used vs a name talked about). Natural languages mark it
with quotation; markdown's code span is doing double duty as both quotation
and identifier-formatting, which is exactly why it cannot carry the
distinction alone.

## The proposal

Mark the register in the syntax; never infer it.

- **Pointer** — an actual markdown link or wikilink. Resolves. May vivify.
- **Mention** — a code span. Never resolves, never vivifies, never reported.
- **Citation** — an explicit marker for "this path is expected to be absent,
  and its absence is the claim". Never vivifies; a *citation whose target
  starts existing again* is the thing worth reporting, which inverts the
  check for that class.

The load-bearing consequence for the playbooks direction (see the assessment
doc for 2026-08-15) is that the future/action grammar needs exactly this
column and does not have it: an unresolved name that is *supposed* to resolve
later is a **fourth** register — a **promise** — and it is distinguished from
a citation only by which way the check runs. A promise that never resolves is
a defect; a citation that resolves is a defect. Same mechanism, opposite
polarity, and neither is inferable from the prose.

Related discipline: `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`
— the detector reports the neutral fact (this name does not resolve); the
register decides what that fact means. auto-vivify currently hardcodes one
reading.

## Acceptance

- [ ] The register is written down with worked examples of all four classes.
- [ ] auto-vivify honours it; the 10 mentions stop being reported.
- [ ] The 1 citation is marked and is checked in the inverted direction.
- [ ] The 1 genuine pointer is fixed (it is a real broken path).
- [ ] `--check` exits 0 on `main` with no suppression flag.

## Toy / metered

The register taxonomy is **unmetered** until the check above runs green
without an allow-list. An allow-list would make it a toy: a check that passes
because the failures were enumerated is not a falsifier.
