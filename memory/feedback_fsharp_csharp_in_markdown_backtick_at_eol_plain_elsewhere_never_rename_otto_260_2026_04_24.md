---
name: F-SHARP / C-SHARP IN MARKDOWN — write `F#` and `C#` (plain, no backticks) inline mid-sentence; wrap in backticks `` `F#` `` / `` `C#` `` when at END-OF-LINE (markdownlint MD018 false-positive — `#` parses as ATX heading); NEVER rename to `F-Sharp` / `C-Sharp` / `F Sharp` / `C Sharp` to bypass the lint; Aaron dislikes the rename pattern and explicitly catches me doing it; the correct fix is backtick-wrap-at-EOL, not rename; Aaron Otto-260 2026-04-24 "in markdown I prefer `F#` `C#` over F-Sharp F Sharp like that" + "if it's at the end of a line you got to do that or else F# is fine wihtout them" + "it's some lint issue" + "i catch you often trying to do this rename" + "i don't like it"
description: Aaron Otto-260 discipline refinement. I've been (per Aaron) caught repeatedly renaming `F#` to `F-Sharp` when markdownlint's MD018 fires on wrapped-line `#`. The correct move is backtick-wrap at EOL — NOT rename. Save durable so future drain subagents know.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The rule

**In markdown:**

- **Mid-line / inline**: `F#` and `C#` as plain text. No
  backticks needed. Read naturally.
- **End-of-line (terminal position)**: wrap as
  `` `F#` `` / `` `C#` ``. Required to avoid
  markdownlint MD018 false-positive where `#` at
  start-of-wrapped-continuation looks like a
  malformed ATX heading.
- **NEVER** rename to `F-Sharp`, `C-Sharp`, `F Sharp`,
  `C Sharp`, `FSharp`, `CSharp`, or anything else
  that isn't the canonical `F#` / `C#`.

Direct Aaron quotes 2026-04-24:

> *"in markdown I prefer `F#` `C#` over F-Sharp F Sharp
> like that"*

> *"if it's at the end of a line you got to do that or
> else F# is fine wihtout them"*

> *"it's some lint issue"*

> *"i catch you often trying to do this rename"*

> *"i don't like it"*

## Why the rename is wrong

- **Canonical naming**: `F#` and `C#` are the LANGUAGE
  NAMES as officially spelled. `F-Sharp` is a
  workaround, not the name.
- **Readability**: technical readers parse `F#` as
  the language instantly; `F Sharp` reads like a note
  pitch, `F-Sharp` reads like a project code-name.
- **Lint isn't policy**: markdownlint firing on `#` is
  a tooling quirk, not a style signal. The correct
  response is to satisfy the tool (backticks) or fix
  the tool config, not to rewrite the language name.
- **Search / diff hygiene**: `grep -r 'F#'` finds
  every reference when consistent; `F-Sharp` scattered
  across docs breaks that.
- **Aaron dislikes it** — this is the load-bearing
  reason. He has caught this pattern repeatedly. It
  belongs to the "Aaron-correction drift" class
  (Otto-NN history of repeated-corrections-same-topic).

## The fix pattern (for markdownlint drain)

When markdownlint MD018 fires on a wrapped-line-start-with-`#`:

**Wrong** (what I've been doing):
```markdown
... the F
Sharp compiler produces ...
```
→ rewrite to `F-Sharp` or `F Sharp` to escape the lint

**Right option A** (preferred — reflow):
```markdown
... the F# compiler produces ...
```
→ join the lines so `#` sits mid-line, not at line start

**Right option B** (when reflow breaks readability):
```markdown
... the `F#`
compiler produces ...
```
→ backtick-wrap the offending token so markdownlint
treats it as a code-span, not a potential heading

**Right option C** (when line-wrapping is structural):
```markdown
... reference the
`F#` compiler ...
```
→ same backtick wrap, placed to avoid the `#` at
wrap-continuation start

**The point**: the text CONTENT stays `F#` / `C#`. Only
the markdown FORMATTING (backticks, reflow) changes.

## Scope

- `docs/**/*.md` — project docs
- `README.md` + `CLAUDE.md` + `AGENTS.md` + similar
- `memory/**/*.md` — memory files
- `docs/DECISIONS/**` — ADR bodies
- `docs/research/**` — research docs
- `docs/aurora/**` — aurora absorb docs
- `.github/copilot-instructions.md` — factory-managed
  reviewer instructions
- Any `.claude/skills/**/SKILL.md` body or
  `.claude/agents/**` persona body

Out of scope (language name can appear in any form
that's syntactically required):
- Code comments inside `.fs` / `.cs` — use whatever
  the language style demands
- XML doc comments (`/// <summary>`) — same
- Filenames — conventions vary; not this rule
- Git branch names / PR titles — plain text, no
  backticks but still `F#` not `F-Sharp`

## Applies to drain subagents

When dispatching a markdownlint-drain subagent that
might hit MD018 on `F#` / `C#` continuations, include
this constraint in the prompt:

> Do NOT rename `F#` to `F-Sharp` or `F Sharp` to
> satisfy markdownlint. If MD018 fires on a wrapped
> `#`, either reflow so `#` sits mid-line OR wrap the
> offending token in backticks. The canonical language
> names `F#` and `C#` are preserved regardless of
> markdown formatting.

## Composition with prior memory

- **Otto-258** auto-format CI — Otto-260 is a specific
  case where the "auto-format" action must preserve
  content over escape. When the auto-format CI lands,
  it must NOT do the rename automatically; it does
  reflow + backtick-wrap only.
- **Aaron-correction-drift memories** — this is a
  classic repeated-pattern that Aaron catches me on.
  Every correction-that-matches-prior-correction is
  its own signal that the rule isn't landing.
- **Preserve-original + every-transformation** — same
  principle at a different scope: the language name
  is part of the canonical content; transformations
  (backtick-wrap) are annotations on top, not
  replacements of content.

## What this memory does NOT say

- Does NOT license using `F#` in prose where
  ambiguity would confuse readers (e.g. in a music-
  theory context where `F#` means the note). Context
  still matters; but inside Zeta docs where F# is
  always the language, stay with `F#`.
- Does NOT apply to CHOICE of language name in freshly-
  written content describing an alternative tool.
  Other languages (Rust, Go, TypeScript) use their
  own canonical forms; F#/C# aren't special
  templates for those.
- Does NOT require retroactive rewrites of `F-Sharp`
  occurrences already on main unless they appear in
  a PR being reviewed. Roll forward: write `F#` in
  new content; don't mass-rename existing.

## Direct Aaron quotes to preserve

> *"in markdown I prefer `F#` `C#` over F-Sharp F Sharp
> like that"*

> *"if it's at the end of a line you got to do that or
> else F# is fine wihtout them"*

> *"it's some lint issue"*

> *"i catch you often trying to do this rename"*

> *"i don't like it"*

Future Otto: when tempted to rename `F#` to `F-Sharp`
or `F Sharp` to satisfy markdownlint, DON'T. Backtick-
wrap at EOL or reflow mid-line. The language name
stays canonical; lint compliance is a formatting-layer
concern.
