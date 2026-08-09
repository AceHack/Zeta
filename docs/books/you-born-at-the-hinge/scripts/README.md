# Translation Script

This directory contains `translate_book.ts`, a script used to automatically translate `index.en.html` into all supported languages (Chinese, Indonesian, Vietnamese, Korean, Thai, Russian, and Arabic).

## How to use

Whenever you update `index.en.html` and are ready to propagate the changes, run:

```bash
bun run translate_book.ts
```

You must have the `agy` CLI installed and authenticated (it uses `gemini-3.1-pro` under the hood).

The script works by:

1. Backing up and overwriting all target language HTML files with the fresh `index.en.html`.
2. Automatically fixing the language directionality (`dir="rtl"`) and the navigation bar for each specific target language.
3. Automatically parsing all `<article class="chap">`, `<header>`, and `<aside>` text blocks.
4. Sending those blocks to the `agy` CLI to translate them while preserving all HTML tags perfectly.
5. Strictly enforcing the consent and anonymity gates for all languages.

If you want to only update specific languages, you can pass them as arguments:

```bash
bun run translate_book.ts ar ko ru
```
