---
id: 081KZZ1RK6A087G0R003C773WC
type: bug
state: done
priority: P2
slug: two-tracked-claude-hooks-test-files-are-undiscoverable-by-bu
title: "two tracked .claude/hooks test files are undiscoverable by bun test and execute nowhere"
created: 2026-08-14T02:31:35.370Z
completed: 2026-08-14T11:48:56.444Z
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

## Resolution — option 2 (move the tests), plus teeth on the checker

**Option 2 taken.** The two tests moved to `src/Core.TypeScript/claude-hooks/` and import back
across the boundary into `.claude/hooks/`. All measurements below are CHECKED on bun 1.3.14.

**Is `.claude/hooks/` a required path?** **No — verified, not assumed.** `.claude/settings.json`
resolves every hook by an explicit `"bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/<file>.ts"`
command string, one per hook. The harness resolves by *configured path*, not by directory
convention, so option 3 was possible rather than impossible. It was rejected on cost: 51 tracked
files reference `.claude/hooks`, and a user-scope `~/.claude/settings.json` in any other clone
would break silently. The subject stays; the test moves.

**Why not option 1** (an explicit `./`-path invocation in the gate). It needs the checker's
`executes` model extended with a dot-slash special case — a positional filter is a *substring*
of the path, and `./.claude/hooks/x.test.ts` is not a substring of `.claude/hooks/x.test.ts`,
so the model does not degrade to it. Worse, it is a filter list, and `gate.yml`'s own header
argues that every filter list is a fresh copy of the defect: `forge-host/` fell outside the
previous globs precisely because someone had to remember to add it. A moved file is reached by
the bare `bun test` forever, with no list to maintain.

**Do they pass?** Yes — 13 pass, 0 fail, 21 `expect()` calls, on the first run, before any
edit. Nothing had rotted; the guards were merely unwatched.

**Second finding, not looked for: the same blindness in `tsc` and `eslint`.** `.claude/hooks/*.ts`
was in the tsc program **0 times** before this change and **2** after (`harness.ts`,
`stop-detect-response-rut.ts`) — TypeScript's wildcard `include` skips dot-prefixed segments, so
the hooks were never type-checked either. They typecheck clean (26 errors before, the same 26
after, all pre-existing missing-devDep `TS2307`s in unrelated files). eslint skips dot
directories the same way, which is why `sonarjs/publicly-writable-directories` fired on
`harness.test.ts` for the first time on arrival; both sites are assertion targets, not write
paths, and carry a written disable. Linting `.claude/hooks/*.ts` itself is PROPOSED, not done.

**The count was a mute.** `hidden-from-bun` was *printed* and the checker *passed*. So
`unexecuted-test-files.ts` now folds hidden files into `unexecuted` — allow-listed with a
reason, or red. Mutation-checked: moving the two files back makes the checker exit 1 naming
both. Before the teeth, that same mutation stayed green, which means the move alone would
have been an unverifiable fix.

## Acceptance — met

- The two files execute in the PR lane: the bare `bun test` of `test (TS suite)` reaches them
  by ordinary discovery (a positional filter `bun test claude-hooks` now runs them; under
  `.claude/` bun answered *"the following filters did not match any test files"*).
- `hidden-from-bun` = **0**, down from 2. Nothing remains to explain, and a future hidden file
  is a finding rather than a number.
