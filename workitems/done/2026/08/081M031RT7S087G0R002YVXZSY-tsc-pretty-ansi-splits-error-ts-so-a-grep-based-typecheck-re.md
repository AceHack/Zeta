---
id: 081M031RT7S087G0R002YVXZSY
type: bug
state: done
priority: P2
slug: tsc-pretty-ansi-splits-error-ts-so-a-grep-based-typecheck-re
title: "tsc pretty ANSI splits error TS so a grep-based typecheck reads green while tsc exits non-zero"
created: 2026-08-15T15:48:40.313Z
completed: 2026-08-15T15:49:03.691Z
depends_on: []
composes_with: []
---

# tsc pretty ANSI splits error TS so a grep-based typecheck reads green while tsc exits non-zero

Found 2026-08-15 by Otto reviewing #10811. Default `tsc` is `--pretty` (ANSI).
A real diagnostic is emitted as `error` + reset + ` TS2322`, so `grep -c "error TS"`
returns 0 while `tsc` exits 2. A local grep-based check called #10811 clean.

The honest signal is the process exit code. `--pretty false` also keeps
`error TSNNNN` as one token so any remaining grep, and the TS2307
unprovisioned-environment guard (`/error TS2307/`), still match.

## Resolution

`package.json` `typecheck` and `lint-typescript.ts` pass `--pretty false`.
The compiler-command test pins it. The TS2307 guard is shown to miss an
ANSI-split diagnostic, which is why pretty is off rather than the regex
being "fixed" to parse color.
