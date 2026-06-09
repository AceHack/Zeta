# grams/ — terms organized by token count n (canonical vocabulary home)

Folder structure for unique organization (Aaron, 2026-06-09): a term of **n tokens**
lives in `grams/<n>/<term>.md`, one carved sentence each. **`grams/1` is the canonical
home for single words; `words/` is a label (symlink) on `grams/1`.** Bigrams →
`grams/2/`, trigrams → `grams/3/`, … . Single-token = camelCase/acronym/one word
(`zetaid`, `llmtv`, `ZetaDateTime`); multi-token = hyphenated/spaced (`self-throttler`).
A core, date-agnostic vocabulary folder (a DV2.0 hub), distinct from the dated
`docs/research/*` satellites.
