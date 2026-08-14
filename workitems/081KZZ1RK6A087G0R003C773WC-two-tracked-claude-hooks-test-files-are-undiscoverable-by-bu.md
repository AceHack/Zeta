---
id: 081KZZ1RK6A087G0R003C773WC
type: bug
state: backlog
priority: P2
slug: two-tracked-claude-hooks-test-files-are-undiscoverable-by-bu
title: "two tracked .claude/hooks test files are undiscoverable by bun test and execute nowhere"
created: 2026-08-14T02:31:35.370Z
depends_on: []
composes_with: []
---

# two tracked .claude/hooks test files are undiscoverable by bun test and execute nowhere

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZZ1RK6A087G0R003C773WC-*.md` glob. -->

## The finding

Found while fixing 081KZYXRYR8087G0R003E6JZA4 (the `dist/` walk), not looked for. Moving
`src/Core.TypeScript/hygiene/unexecuted-test-files.ts` from a working-tree walk to the
tracked set made two
tracked test files visible that the old walk's dot-directory prune had hidden:

- `.claude/hooks/harness.test.ts`
- `.claude/hooks/stop-detect-response-rut.test.ts`

**No workflow runs either one.** They are the checker's own defect class — a `*.test.ts`
that executes nowhere, whose filename promises a check ran.

## Why the checker cannot report them today

**MEASURED, bun 1.3.14.** A test file under a dot-prefixed directory is not discoverable by
`bun test`:

Fixture: a throwaway directory holding one visible test file and one inside a
dot-prefixed subdirectory.

- a bare `bun test` ran **1 file**, not 2 — the one in the dot-prefixed directory was
  never discovered;
- a positional filter naming that directory answers *"the following filters did not match
  any test files"*;
- only an explicit, dot-slash-prefixed path argument reaches it — bun says so itself in
  the note it prints.

So the gate's bare `bun test` cannot reach them, and the checker's `executes` model —
"no positional filters means every discoverable file" — would **credit them as executed**
if they were simply added to the denominator. That would be invented coverage, which is
the exact lie the checker exists to prevent. They are therefore excluded from the
denominator by `isHiddenPath` and **counted out loud** in the summary line
(`hidden-from-bun`), so the exclusion is visible on every run rather than silent.

## Options (not yet chosen)

1. **Run them.** Add an explicit `bun test ./.claude/hooks/*.test.ts` step to the PR lane
   and teach `executes` that an explicit `./`-prefixed path argument reaches a hidden file.
   Closes the gap for real; costs a model extension.
2. **Move them** out of `.claude/` to a discoverable location. Cheapest, but `.claude/` is
   where the harness expects the hooks to live, so the tests would move away from the code.
3. **Declare them** in `registry/unexecuted-test-files.json` with a reason. Honest, but a
   mute — and the reason would be "nothing runs them", which is not a justification.

Option 1 is the only one that makes the assertions real. Whoever takes this should first
check whether the two files still pass.

## Acceptance

- Either the two files execute in the PR lane, or they carry a written reason.
- The `hidden-from-bun` count in the checker's summary is explained by whatever remains.
