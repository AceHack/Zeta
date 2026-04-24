# `drop/` — the maintainer-to-agent inbox

The maintainer deposits files here for the autonomous
loop to absorb. This folder is the canonical "dropbox" — the
one place the maintainer can park a research report, a
transcript, a screenshot, a PDF, a zip, without any
discussion beforehand.
The agent audits this folder at **every tick-open** and
absorbs anything new.

This file is the protocol. `drop/` tracks exactly two
sentinel files: `README.md` (this doc) and `.gitignore`
(the "ignore everything except these two" ruleset).
Everything else gets gitignored so deposits never enter
history.

## Design rationale — two tracked sentinels, everything else ignored

Maintainer, 2026-04-22 auto-loop-43:

> *"if i put a binary in there we should have specific rules
> for hadling the bindaries we know but they never get
> checked in this folder could be untracket with a single
> tracked file to make sure it get created"*

The shape that satisfies the directive:

- `drop/` **exists** on every clone (the folder is present
  because the tracked sentinel keeps it present).
- Everything the maintainer drops is **gitignored** — PDFs,
  transcripts, zips, images, audio files, video files,
  binary executables, text notes, proprietary docs. None
  of it enters history.
- The agent's job is to **absorb** (read, extract
  signal-preserving summary to a tracked artifact under
  `docs/research/` or similar) and then **delete** the
  original from `drop/`. The tracked artifact is the
  permanent record. The dropped file is ephemeral.
- The drop folder is therefore always either empty (agent
  caught up) or holding unabsorbed deposits (agent's
  queue).

## The tick-open audit

Every tick, the agent runs at `docs/AUTONOMOUS-LOOP.md` step
2 (priority ladder):

```
ls -la drop/
```

- If only `README.md`, `.gitignore`, and hidden system files
  (`.DS_Store`) are present — no-op, continue with the rest
  of the tick.
- If any other file is present — **absorb it this tick**.
  Absorption beats other speculative work because the
  maintainer's deposit is the closest signal to *directed* work the
  factory gets; ignoring it stacks drop-folder debt.

## Absorption protocol

For every file `drop/<name>`:

1. **Identify the kind** — text document, transcript, PDF,
   image, audio, video, archive, binary.
2. **Extract signal** using the kind-specific handler (see
   "Known binary-type registry" below).
3. **Write a tracked absorption note** under `docs/research/`
   (typical naming: `docs/research/<source>-<topic>-<YYYY-MM-DD>.md`).
   The absorption note preserves the signal
   (per `memory/feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`):
   intent, anchors, key claims, open questions, verbatim
   quotes where load-bearing.
4. **Delete the original from `drop/`.** The tracked
   absorption note is now the permanent record; git history
   of the absorption note is the provenance trail; the drop
   file is gone.
5. **Cross-reference** the absorption note from any relevant
   `docs/BACKLOG.md` rows, memory entries, or round-history
   summaries.
6. **Commit** the absorption note as a normal tracked file.
   The deletion of `drop/<name>` is a no-op in git because
   the file was never tracked.

## Known binary-type registry

When the maintainer drops a binary, the agent handles it
per the registry below. **Unknown binary types flag to the
maintainer** —
they don't get absorbed silently. This is a closed
enumeration by design; new kinds require a registry update.

| Kind         | Extensions                     | Handler                                                    |
|--------------|-------------------------------- |------------------------------------------------------------|
| Text         | `.md`, `.txt`, `.json`, `.yaml`, `.toml`, `.csv`, `.xml` | `Read` directly.                                           |
| Source code  | `.fs`, `.cs`, `.ts`, `.py`, `.sh`, `.fsx`, `.lean`      | `Read` directly; absorption note summarises the pattern.  |
| PDF          | `.pdf`                          | `Read` with `pages` param (1-20 pages); chunk if larger.    |
| Image        | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`                | `Read` — harness renders visually for description/OCR.     |
| Audio        | `.mp3`, `.wav`, `.m4a`, `.ogg`, `.flac`                 | Ask the maintainer — substrate-access-grant may apply (Gemini-Ultra transcript path per `memory/project_aaron_ai_substrate_access_grant_gemini_ultra_all_ais_again_cli_tomorrow_2026_04_22.md`). |
| Video        | `.mp4`, `.mov`, `.webm`, `.mkv`                         | Ask the maintainer — substrate-access-grant path (Gemini-Ultra / frame-extraction). |
| Archive      | `.zip`, `.tar.gz`, `.tar`, `.7z`                        | `unzip -l` / `tar -tzf` first, then extract under `drop/_expand-<name>/` (also gitignored), then recurse over contents. Clean up `_expand-<name>/` after absorption. |
| Binary exec  | `.exe`, `.dll`, `.so`, `.dylib`                         | Flag to the maintainer. Do not run. Describe metadata only (file size, header bytes) via `file` command. |
| Office       | `.docx`, `.xlsx`, `.pptx`                               | Flag to the maintainer. These need parsing tools (python-docx, openpyxl) — if substrate allows, otherwise ask the maintainer for a markdown/text export. |
| Unknown      | anything else                                           | Flag to the maintainer: *"drop/`<name>` is kind `<ext>`; no handler registered — please advise or export to a supported kind."* |

The registry is authoritative. Do **not** improvise a
handler for an unknown kind. Ask.

## What `drop/` is not

- **Not a long-term archive.** Files here are ephemeral. The
  absorption note under `docs/research/` is the durable
  artifact.
- **Not a staging area for committed files.** If the maintainer wants
  to commit something wholesale (a doc he wrote, a test
  dataset, a fixture), he commits it directly to its
  destination — not via `drop/`.
- **Not a build output sink.** Build artifacts go under
  `bin/`, `obj/`, `coverage/`, etc. per the top-level
  `.gitignore`.
- **Not a secrets drop.** The maintainer does not put secrets here
  and the agent does not expect any — the folder is
  local-only but the absorption note is public. If the maintainer
  accidentally drops a secret, the agent flags immediately
  and does not copy the secret into the absorption note.

## Cross-references

- `docs/AUTONOMOUS-LOOP.md` — tick-open checklist includes
  `ls drop/` audit at step 2.
- `memory/project_aaron_drop_zone_protocol_2026_04_22.md`
  — the maintainer directive this protocol implements.
- `memory/feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`
  — absorption must preserve signal.
- `docs/research/oss-deep-research-zeta-aurora-2026-04-22.md`
  — the inaugural absorption; template for future ones.
