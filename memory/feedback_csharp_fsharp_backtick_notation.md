---
name: C# / F# written in backticks, not expanded
description: When `#` after a language letter would break markdown (heading interpretation), escape by wrapping the token in backticks — do NOT expand to "C-sharp" / "F-sharp"
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Rule: `C#`, `F#`, `LiquidF#`, and other hash-suffixed language tokens are written in backticks when they appear inside markdown prose. Do **not** expand them to "C-sharp" / "F-sharp" / "LiquidF-sharp" to dodge a linter heading-interpretation error. Backticks both escape the `#` for markdownlint and preserve the token as Aaron and the field write it.

**Why:** Aaron's course correction 2026-04-19 after I fixed two markdownlint heading errors (typescript-expert/SKILL.md MD003 "diverges from C #"; liquidfsharp-findings.md MD003 "adopting LiquidF #") by expanding the token. His exact note: "like `C#` like `F#` or something like that instead of C-sharp". Linter pain is real; the right fix is the escape, not the rename — the names are the names.

**How to apply:**
- When markdownlint MD003 (heading-style) flags a line ending `... C #` or `... F #`, fix it by wrapping in backticks (`C#`, `F#`) rather than by prose substitution.
- The underlying cause is line-wrap: long lines that happen to end at "...C " get a newline-then-`#` which the renderer reads as an atx_closed heading. Backticks end the inline code before the `#` so nothing is heading-interpreted.
- Applies equally to `F#`, `C#`, `LiquidF#`, `C++`, `H#`, etc. — any token where special punctuation breaks a markdown renderer.
- Does **not** apply to plain `#` used as "number" ("#1 hazard") — those are fine as either `#1` in backticks or rewritten ("the top hazard", "is the first hazard"), whichever reads cleaner.
- Does **not** apply to intentional atx_closed headings — if a heading really is `## Title ##`, lint is complaining about heading style, not about an accidental `#`.
