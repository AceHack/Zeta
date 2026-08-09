# Blueprint: Translating "You, Born at the Hinge"

## Overview

This blueprint provides the instructions for translating or updating the book "You, Born at the Hinge" across all supported foreign languages when the English source (`index.en.html`) is updated.

## Script Location

`docs/books/you-born-at-the-hinge/scripts/translate_book.ts`

## Prerequisites

- The `agy` CLI must be installed and authenticated to use `gemini-3.1-pro` under the hood.
- `bun` must be installed to run the TypeScript script.

## Execution

Whenever the English version (`docs/books/you-born-at-the-hinge/site/index.en.html`) is modified and requires translation propagation, run the following command from the `scripts` directory:

```bash
bun run translate_book.ts
```

To translate specific languages only, append their language codes:

```bash
bun run translate_book.ts ar ru
```

## How It Works (Strict Enforcement)

The script automates the translation while adhering strictly to the author's **Consent Gates**:

1. **HTML Preservation:** Every HTML tag is preserved identically to the English version.
2. **Mother's eating disorder:** Strictly oblique references only (no clinical terms).
3. **CSAM / immutable-ledger:** Strictly policy-point-only, zero operational detail.
4. **Anonymity:** No names are introduced if they were kept anonymous in English.
5. **Directness:** The translation captures the native speaker's natural flow without softening the original tone.

## Agent Instructions

If the user asks to "translate", "update translations", or "push updates for the book":

1. Navigate to `docs/books/you-born-at-the-hinge/scripts/`.
2. Execute `bun run translate_book.ts`.
3. Wait for the process to complete (it uses the AI CLI for each language's article blocks).
4. Review the generated `.html` files in the `site/` folder if requested.
5. Commit and push the changes.
