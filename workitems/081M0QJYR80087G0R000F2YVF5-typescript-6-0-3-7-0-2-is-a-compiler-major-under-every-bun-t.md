---
id: 081M0QJYR80087G0R000F2YVF5
type: task
state: backlog
priority: P2
slug: typescript-6-0-3-7-0-2-is-a-compiler-major-under-every-bun-t
title: "typescript 6.0.3 -> 7.0.2 is a compiler major under every bun test, lint (TS) and the TypeScript byte-lock oracle"
created: 2026-08-23T15:13:49.312Z
depends_on: []
composes_with: []
---

# typescript 6.0.3 -> 7.0.2 is a compiler major under every bun test, lint (TS) and the TypeScript byte-lock oracle

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QJYR80087G0R000F2YVF5-*.md` glob. -->

## Why this has its own row

`.github/dependabot.yml` gained npm/bun coverage on 2026-08-23. The very first thing that
coverage will propose is `typescript` **6.0.3 -> 7.0.2**, and it must not ride in on a
weekly minor/patch group, so an `ignore:` for `typescript` majors landed with the coverage
in the same commit. **This item is the `LIFTS WHEN:` clause that entry points at** — without
it the ignore is a hold with no owner, which is how a documented constraint becomes a
permanent one.

## What it actually moves

TypeScript is not a leaf dependency here. It sits under:

- every `bun test` in the repo,
- the `lint (TS)` gate job and `bun run typecheck` (`tsc --noEmit`),
- **the TypeScript byte-lock oracle** — one of the four/six languages the golden vectors are
  compared across. A compiler major changing emit or inference is precisely the event the
  cross-language lock exists to catch, so "it type-checks" is not the finish line.

`typescript-eslint` is pinned at `8.59.0` and has its own supported-TypeScript range; a
compiler major usually needs it moved in the same change or the parser refuses the version.

## How it was found

`docs/research/2026-08-23-toolchain-currency-audit-and-tech-radar-ring-drift.md` §2.4. It had
gone a whole major behind because **no Dependabot ecosystem was pointed at any
`package.json`** — §2.5 is the control: every NuGet pin, where the bot WAS pointed, was at
latest on the same day.

## Done when

The compiler is moved deliberately, `bun run typecheck` and `lint (TS)` are green, the
four-oracle byte-lock vectors are re-verified rather than assumed, `typescript-eslint` is
moved with it if its range demands, and the `typescript` `ignore:` entry in
`.github/dependabot.yml` is removed in the same commit.

## Composes with

- `081M0Q9Y686087G0R000QK0H1R` — the Dependabot ecosystem-coverage item that made this visible.
- `081KZZ0K0XM087G0R003RNC0C7` — `demo/identity-dla-site` toolchain lags the root TS.
