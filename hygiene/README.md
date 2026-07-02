# hygiene/ — substrate cleanliness, at root

`hygiene/` is the conceptual home of **substrate hygiene**: the standing discipline that keeps Zeta
clean — no drift, no rot, no silent debt. It is the **content/why** home; the **how** (the executable
audits and guards) lives in [`src/Core.TypeScript/hygiene/`](../../src/Core.TypeScript/hygiene/), which the `gate` workflow enforces
on every push.

## Hygiene = the always-running guards

Hygiene is not a one-time cleanup; it is a **continuously enforced floor**. The guards already live and
run in `gate`:

- **bash-retirement inventory** — every retained shell file is declared and categorized (no
  un-accounted shell creeps in).
- **tsc strict** — `noUncheckedIndexedAccess` / `exactOptionalPropertyTypes` across the tools surface.
- **markdownlint · actionlint · semgrep · no-empty-dirs · no-conflict-markers** — the
  lint family.
- **vocab / glossary drift · AgencySignature audit · backlog parent-child status** — the substrate-state
  guards.

A hygiene failure is a **red gate**: it blocks nobody's creativity but never lets rot land silently.

## The wordplay (Aaron 2026-06-10) — `hygiene = hy + gene`

The folder decomposes the word: **`hy/`** (symlinked here — the "hy" of hygiene) + **[`gene/`](../gene/)**
(the generative / lineage / seed half). Plus **[`hi/`](../hi/)** as the greeting homophone. Three root
folders fall out of one word — the substrate's habit of finding real structure in language (cf.
[`same/`](../same/), [`boards/`](../boards/)).

## Pointers

- [`src/Core.TypeScript/hygiene/`](../../src/Core.TypeScript/hygiene/) — the executable audits/guards (the *how*).
- `.github/workflows/gate.yml` — where hygiene is enforced (the *when*).
- [`gene/`](../gene/) · [`hi/`](../hi/) · `hy/` (→ `hygiene/`) — the wordplay siblings.
