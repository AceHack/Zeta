# Canonical essence for content-addressing: bit-perfect serializers → AST-as-essence (YAML) with per-developer style views (Aaron, 2026-06-07)

The resolution of the formatting/canonicalization thread, riffing off the confluence proof
(`2026-06-07-content-addressing-is-a-confluence-lemma-...`). Faithful capture; Beacon-anchored.

## The chain (why)

Confluence + content-addressing **require a canonical, bit-perfect representation**: same logical content ⇒
same bytes ⇒ same hash ⇒ dedup / clean merge / confluence. Formatting noise breaks that. Aaron's chain:

1. **Bit-perfect serializers — even the text-based ones.** *"This is why we want all our serializers, even
   the text-based ones, to be bit-perfect."* JSON/XML/YAML must be **canonical/byte-exact**, not just CBOR —
   else the same `DynamicValue` serializes to different bytes → different hash → breaks dedup/confluence
   (ties B-0969 collation + the 4-oracle byte-lock golden vectors).
2. **The code/doc problem.** Source text carries whitespace/formatting/style noise, so the *same logical
   code or doc* hashes differently → spurious diffs, merge conflicts, no dedup.
3. **First answer — format/lint/auto-style on check-in** (*"docs… and code too"*): canonicalize the TEXT to
   one team style → stable bytes. Works, but **forces team style on everyone**.
4. **The better answer (Aaron's key move) — store the AST (essence), not the text.** *"custom file handlers
   for code and structured document types that save the AST in YAML instead of the C#, to remove all
   formatting/whitespace/style issues — they can all be generated from editorconfig almost if you have the
   essence; so each dev gets their own view of code, not just line endings but style per developer — you are
   not forced into team style."*

## The model: AST is the content, style is a per-developer LENS

- **The AST (in YAML) is the canonical essence** — content-addressed, **zero formatting noise**, so the
  confluence/merge proofs apply directly (two devs editing the same logic produce the **same AST node**).
- **Style is a per-developer view**, generated from the AST + the dev's style config (**editorconfig**,
  "almost"): braces, spacing, line length, naming *display*, line endings — **full style, per developer.**
- **No one is forced into team style.** Devs A and B with different styles edit the same AST; their *views*
  differ, the *essence* is one content-addressed node → **merges cleanly (no formatting conflicts ever),
  dedups, confluent.** Only genuine *semantic* conflicts surface (AST-level, not textual).

This is **lens-relativity applied to code** (the same theme as randomness-is-lens-relative / Mirror-Beacon):
the AST is the content; style is the lens; same essence, many views. It's also the **compression-as-
generators** idea — the AST is the essence, the rendered source is *generated* from it + a style program.

## Where it slots into Zeta

- **ZetaFS custom file handlers / per-file-type plugins** (roadmap: per-file-type open/closed plugins) — code
  + structured-doc types get an **AST handler** (text→AST on save, AST→styled-text on open).
- **Content-addressing / confluence** — AST nodes are the canonical content; merge is **semantic (AST-level),
  not textual** → no whitespace/style conflicts, only real conflicts; the confluence theorem (`081KTH8RSXS`)
  applies directly.
- **DynamicValue / behavior-as-data / Bonsai** — the AST *is* a `DynamicValue` tree (a Bonsai expr-tree for
  code); rendering = a generator over it.
- **editorconfig as the style-lens** — captures much of the per-dev style ("almost"); full rendering may need
  a richer style config beyond editorconfig.

## Honest scope (the hard parts)

- **Round-trip fidelity per language is the real challenge** — text→AST→text must preserve *semantics*, and
  crucially **comments / doc-comments / intentional formatting** (most naive ASTs drop comments; they must be
  preserved as AST trivia/annotations). A parser+printer per language is needed.
- **"almost from editorconfig"** — editorconfig doesn't capture all style; per-dev rendering needs more.
- This is a **per-file-type capability**, landed incrementally (one language handler at a time), not a
  big-bang. Backlogged.

## Beacon anchors

- **Unison** (Hickey-adjacent; Paul Chiusano & Rúnar Bjarnason) — **content-addressed code**: definitions are
  hashed by their AST, **names are metadata**, *no formatting in the hash* — the strongest prior art for
  exactly this. · **Projectional / structural editors** — JetBrains **MPS**, **Lamdu** (edit the AST, render
  views). · **tree-sitter / Roslyn** (faithful ASTs, incl. trivia/comments). · **gofmt / Prettier**
  (canonical-form precedent — but ONE style; this generalizes to *per-dev* style). · **editorconfig** (the
  style-lens). · **Smalltalk image** (code-as-data). Honest novelty: not content-addressed code (Unison did
  it) nor projectional editing (MPS/Lamdu) — but **AST-as-essence in the content-addressed ZetaFS with
  per-developer style views + semantic (AST-level) merge** unifying them with the confluence/dedup substrate.
