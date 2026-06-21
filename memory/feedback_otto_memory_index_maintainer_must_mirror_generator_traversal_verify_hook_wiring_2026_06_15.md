---
name: memory-index-maintainer-must-mirror-generator-traversal
description: "Learning from the 2026-06-15 persona-ferry main-red cluster (#8360/8361/8362, fixed #8363): a generated index (MEMORY.md) has three collaborators — generator (reindexer), maintainer (post-write hook), validator (CI gate) — and main goes red whenever they disagree on the include-set. The hook was unwired + matched only flat memory/*.md while the reindexer walks recursively; the gate skip-glob memory/persona/* matched nothing (real layout memory/<persona>/). Verify hook wiring at the source, not the docstring; run the reindexer manually when editing memory in a clone."
type: feedback
created: 2026-06-15
---

Otto (shadow\*), 2026-06-15. Fixing the persona-memory main-red cluster
(#8360 → #8361 → #8362, root-caused in #8363) surfaced a reusable lesson about any
**generated-index** subsystem.

## The shape of the bug

`memory/MEMORY.md` is a generated index with **three collaborators** that must agree on
*"what counts as a memory file"* (the include-set):

1. **Generator** — `src/Core.TypeScript/memory/reindex-memory-md.ts` (`collectEntriesRecursive`):
   walks `memory/**/*.md` **recursively** (incl. `memory/<persona>/conversations/*.md`),
   indexing any `.md` with frontmatter except `MEMORY.md`/`README.md`/`CURRENT-*`.
2. **Maintainer** — `.claude/hooks/post-write-memory-reindex.ts`: a PostToolUse hook that
   re-runs the generator after a memory write, so PRs arrive with the index current.
3. **Validator** — the CI gates (`memory-index-integrity.yml` frontmatter gate +
   `memory-index-drift.yml` `reindex --check`).

They had **three different answers**: generator = recursive; maintainer = flat
`memory/*.md` only (`parts.length !== 2`) AND **was never actually wired** (settings.json
had only a `Read` matcher despite the hook's header claiming `Write`/`Edit`); validator's
skip-glob = `memory/persona/*`, a path that **does not exist** (real layout is
`memory/<persona>/`, so it matched nothing). Result: editing a persona-subtree ferry
drifted the index the generator would produce, the maintainer never fired, and the
validator's persona-skip never applied → main red, three times.

## The learnings

**Why:** a derived index is only correct when generator, maintainer, and validator share
*one* definition of the include-set. Every divergence is latent main-red that only fires
when someone touches the un-aligned path.

**How to apply:**

- **The maintainer must mirror the generator's traversal EXACTLY.** If the generator
  recurses, the hook must fire on subtree writes too. Trigger-set ⊇ index-set, or you get
  drift the generator sees and the maintainer doesn't. (Fix: `memory/**/*.md`, excluding
  by basename at any depth.)
- **Comments lie — verify wiring at the registration point, not the docstring.** The hook
  said *"Wired via settings.json … Write and Edit"* but wasn't. `grep` the actual
  `PostToolUse` block; don't trust a file's self-description.
- **A glob that matches nothing fails silently.** `memory/persona/*` *looked* like it
  skipped persona files; it skipped nothing. Prefer patterns that fail loud over patterns
  that quietly match the empty set. (Fix: `memory/*/*` for the real `memory/<persona>/`
  subtree.)
- **Keep generator / maintainer / validator's include-set in one shape.** When you change
  the generator's traversal (e.g. add recursion), update the hook and the CI skip-glob in
  the same change.
- **Editing memory in a clone without the live hook → run the reindexer before push.**
  The hook is a harness PostToolUse; `settings.json` changes take effect next session. So
  in any clone/session where it isn't live, run
  `bun src/Core.TypeScript/memory/reindex-memory-md.ts` before pushing memory edits, or
  `memory-index-drift` reds main. (This is how the cluster kept recurring mid-session.)

Anchors: 081KR2E4K0008QG0R000XCS9FT (MEMORY.md drift enforcement), 081KRCQQF0008QG0R0037YYP1A/081KR2E4K0008QG0R001E27DDV (reindexer serialization
point). Related: [[b-xxxx-to-zetaid-migration-overlap-rotation-not-bigbang]] (same
"three surfaces must agree" shape — reader, refs, byte-locks). The general principle is
single-source-of-truth for a derived artifact: one traversal definition, referenced by
all consumers, never re-encoded three ways.
