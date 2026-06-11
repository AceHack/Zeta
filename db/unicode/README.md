# unicode/ — the rest of the alphabet, lazily (every Unicode letter, on-demand)

The alphabet-at-root (Latin `a`–`z` + Greek `alpha`–`omega` are materialized root folders) extends to
**all of Unicode** — but Unicode is ~149,000 characters, so `unicode/` is the **lazy namespace**: any
Unicode letter gets a folder **on-demand** (when a word/traveler actually uses it), not all upfront.
Hebrew (aleph–tav), Cyrillic, CJK, Arabic, Devanagari, emoji-as-letters, etc. live here — each
materialized when first needed (the same lazy / weak-table / "cache what we can, lazy the rest" discipline
as git-history). Address by codepoint or name (e.g. `unicode/U+05D0` or `unicode/aleph`). Aaron 2026-06-09:
"all letters get a folder a-z and greek, at root — and the unicode." Latin/Greek = eager; the rest = lazy.
