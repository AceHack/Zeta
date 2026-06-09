# travelers/ — intake + index (real files start here, then home + symlink back)

Everything is a traveler, so this folder is the **intake and the index**:

1. **Start here (no symlink).** A new, not-yet-categorized traveler begins as a **real
   file** `travelers/<name>.md` (one carved sentence) — the inbox.
2. **Move to its most natural home.** Later it moves to a canonical category folder —
   `grams/<n>` (words = `grams/1`), `letters/<language>`, `shapes`, `colors`,
   `temperatures` — its **canonical home** (the path is the unique address).
3. **Symlink back from the home.** Once homed, `travelers/<name>.md` becomes a
   **symlink** → the canonical file (checked into git). So `travelers/` ends up a full
   index of all travelers: real files = still-in-intake; symlinks = homed.

**Uniqueness is enforced** (`tools/hygiene/vocab-uniqueness.ts`): a traveler is either a
real intake file in `travelers/` **or** a real file in exactly one category home with a
symlink in `travelers/` — never duplicated. The categorized folders (words/grams/letters/
shapes/colors/temperatures) are required; `travelers/` is the additive intake/index.
(Case-insensitive-FS note: flat `travelers/` indexes the unique lowercase `grams` terms;
glyph-colliding namespaces like `letters`/`shapes` are browsed in-folder or namespaced.)
