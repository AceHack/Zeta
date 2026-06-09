# words/ — canonical home for lexical terms (the TYPE home, real files)

Canonical home for **words** (lexical terms — single or multi-token), one carved
sentence per file (+ optional frontmatter, + a `→` pointer). This is a **type home**
(real files); the canonical address is `words/<term>.md`. **`grams/` is NOT a home —
it is the MEASURE/DIMENSION view** (generated symlinks slicing every term by token
count: `grams/<n>/<term>` → its canonical type home). Other type homes: `letters/`,
`shapes/`, `colors/`, `temperatures/`. Multi-sense terms (>1 carved sentence) require a
discriminator (frontmatter `context-policy`/`senses`).
