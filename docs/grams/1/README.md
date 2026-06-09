# grams/1 — the canonical home for single words (1-grams)

One single-token term per file, one carved sentence (+ a `→` pointer). This is the
**canonical home**; **`words/` is a label (a symlink) on `grams/1`** — same files, two
names (Aaron: "grams/1 is the canonical home, words is a label on that"). Multi-token
terms live in `grams/2/`, `grams/3/`, … . Camel-case compounds (`ZetaDateTime`) are
single tokens → here; hyphenated/space terms (`self-throttler`) are multi-token →
`grams/n/`. (Label-as-symlink caveat: if a platform's checkout doesn't materialize the
`words` symlink — Windows w/o symlink support — treat `words/` as a documented alias for
`grams/1`; the canonical path is `grams/1`.)
