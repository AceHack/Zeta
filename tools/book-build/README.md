# book-build — assemble & package "You, Born at the Hinge"

Reproducible pipeline that assembles the shareable book draft and builds an **EPUB**
(iPhone Books / any e-reader). pandoc is declared in `tools/setup/manifests/{brew,apt}`
(all OS shields), so `tools/setup` installs it.

## Usage

```bash
bun tools/book-build/build-book.ts                       # English, chapters + outline → dist/book/*.epub
bun tools/book-build/build-book.ts --with-companions     # ⚠ also the companion essays (see CONSENT SCOPE)
bun tools/book-build/build-book.ts --src <dir> --lang zh-Hans   # build from a translated source dir
```

(TypeScript/Bun per the bash-retirement discipline — this is a build convenience, not a
bootstrap/installer shell surface.)

Outputs land in `dist/book/` (gitignored — never commit the EPUB or the assembled draft).

## Consent scope (the reason this is a curated pipeline, not `cat *.md`)

The book directory holds three kinds of file; the script ships only the safe ones:

- ✅ **Shareable (default):** `OUTLINE.md`, `ch-NN-*.md` — the book proper.
- ⚠ **Companions (`--with-companions` only):** ALL-CAPS-prefixed essays. They carry
  third-party material (Addison, parents, …). Sending them to an outside reader touches
  those people's **pre-read gates** — confirm against `CONSENT-LEDGER.md` first.
- ⛔ **Never shipped:** `RAW-*.md` (staging — CSAM allegation, self-disclosures, held
  sister material), `CONSENT-LEDGER.md`, `INTAKE-LOG.md`, `RESUME.md`, `READINESS.md`
  (internal ops). Hard-excluded in the script, always.

## Translation (Mandarin, etc.)

The script does **not** translate. Produce a translated copy of the shareable files into
a directory (same filenames), then build from it with `--src <dir> --lang zh-Hans`.

**Review before external sharing.** A machine translation of a memoir can quietly
misrepresent the author (meaning-drift is an attack surface). A translated draft going to
an outside proofreader should have the author's (or a trusted bilingual) eyes on it first.

## Note on state

As of 2026-08-06 the chapters are **scaffolds with `[SOCKET]` placeholders** — the author's
verbatim voice is not yet filled in. A proofread now reviews the scaffolding/structure, not
the final prose.
