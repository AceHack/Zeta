---
id: 081M0QDHQQQ087G0R002JE1JMA
type: bug
state: backlog
priority: P1
slug: lint-ts-prints-typescript-prettier-and-style-checks-passed-w
title: "lint (TS) prints 'TypeScript, Prettier, and style checks passed' while running only tsc: eslint, prettier and stylelint are invoked by no CI lane"
created: 2026-08-23T13:39:19.927Z
depends_on: []
composes_with: []
---

# lint (TS) prints 'TypeScript, Prettier, and style checks passed' while running only tsc: eslint, prettier and stylelint are invoked by no CI lane

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QDHQQQ087G0R002JE1JMA-*.md` glob. -->

## The literal defect (measured 2026-08-23)

`src/Core.TypeScript/lint/lint-typescript.ts` — the entire body of the `lint (TS)` gate job:

```ts
const STEPS: readonly Step[] = [{ label: "TypeScript type check: tsc", cmd: TYPESCRIPT_COMPILER_COMMAND }];

function main(): number {
  for (const step of STEPS) {
    if (!run(step)) return 1;
  }
  console.log("✓ TypeScript, Prettier, and style checks passed successfully!");
  return 0;
}
```

**One step. Three checks claimed.** The file header says _"Post-install orchestration of
TypeScript tools (tsc, eslint, prettier, stylelint)"_ and only `tsc` is in the list.

Corroborated from the other side — nothing else runs them either:

| tool          | package.json script     | invoked by a workflow?                                                                  |
| ------------- | ----------------------- | --------------------------------------------------------------------------------------- |
| `tsc`         | `typecheck`             | **yes**, via this file                                                                  |
| **eslint**    | (via `lint:typescript`) | **no** — `gate.yml:1665` installs "the eslint stack" and never runs eslint              |
| **prettier**  | `format:check`          | **no** — `grep -rn "format:check\|prettier --check" .github/workflows/` returns nothing |
| **stylelint** | `lint:css`              | **no**                                                                                  |

Not a regression. `git log -S"STEPS: readonly Step[]"` returns exactly one commit — `4f3d20a25`
(2026-06-13), the file's first — and the success line has claimed Prettier and style checks since
that commit, with `STEPS` tsc-only from the start. **It was never true.**

## Measured consequence

`docs/TECH-RADAR.md` on `main` is **not** prettier-clean, and nothing has ever said so. That was
found while fixing radar drift: running `prettier --write` over it turned a 12-line content diff
into a 211-line one, which is what an unenforced formatter costs the first time someone runs it.

## Why this is the sharpest instance of the class the radar PR is about

A check that cannot fail is not a check — and this one is worse, because it **announces** three
passes for one run. It is the same shape as the TLA+ lane's `--check-toolchain` reporting success
for a `tlapm` that then exits 127, and the same shape as an Adopt ring over a dark lane. An
unenforced guarantee reads as a guarantee (the prior feedback summarized this as "vacuous claims
and unimplemented exceptions are the biggest obstacle to human-AI trust").

## Done when — in this order, and step 1 is the whole point

1. **The message stops lying, immediately and cheaply**: it says what actually ran. Truthful is
   available today; enforcement is not. Do NOT bundle this with step 2.
2. eslint / prettier / stylelint are each either **added to `STEPS`** (with a baseline or a
   cleanup pass, `src/Core.TypeScript/hygiene/AUDIT-LIFECYCLE.md` step 5 — a repo-wide
   `prettier --check` will be loud on
   first landing) or **explicitly removed** from the header and the message with a written reason.

Either resolution is honest. The current state is the only one that is not.
