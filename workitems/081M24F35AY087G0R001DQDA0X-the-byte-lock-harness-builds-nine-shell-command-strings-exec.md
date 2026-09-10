---
id: 081M24F35AY087G0R001DQDA0X
type: bug
state: backlog
priority: P2
slug: the-byte-lock-harness-builds-nine-shell-command-strings-exec
title: "the byte-lock harness builds nine shell command strings; execFileSync removes the shell and the misdiagnosis it caused"
created: 2026-09-10T01:32:08.926Z
depends_on: []
composes_with: []
---

# the byte-lock harness builds nine shell command strings; execFileSync removes the shell and the misdiagnosis it caused

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M24F35AY087G0R001DQDA0X-*.md` glob. -->

## What was open

Alert 288, `js/shell-command-injection-from-environment` (medium), at
`tests/cross-verification/_harness/cross-verify-ir.ts:276`:

```ts
const venvPython = join(process.cwd(), "src/Core.Python/.venv/bin/python3");
const stdout = execSync(`${venvPython} ${file}`, { ... });
```

CodeQL flagged one line. The construct is used NINE times in that file -- every
oracle lane builds a shell command string. 276 is the only one CodeQL can prove
is environment-derived, because `tmpDir` is a hardcoded `/tmp` join while
`venvPython` comes from `process.cwd()`. So the alert is precise and its scope
is narrower than the defect.

## Demonstrated, both halves

Same interpreter, same script, only the containing directory differs.

**A space in the path -- the realistic instance:**

```
OLD (execSync, shell):        FAILED -- python3: cannot open .../cv-XXXX/my
NEW (execFileSync, no shell): "42"
```

The shell split the path at the space and tried to open the first half.

**A semicolon in the path -- the injection CodeQL names:**

```
dir = "x; touch INJECTED; echo"
OLD (execSync, shell)        -> marker created: true
NEW (execFileSync, no shell) -> marker created: false
```

The payload was a marker file and nothing else.

## Reachability, stated honestly

In CI the cwd is `/home/runner/work/Zeta/Zeta` -- no space, no metacharacter --
so this is NOT a live exploit path today. The realistic failure is the space: a
clone under `~/My Projects/` or a worktree path with a space silently loses the
Q# lane. The injection is a property of the construct, demonstrated above, not
an attack anyone is currently able to mount here.

Which is why the interesting half is the diagnosis, not the exploit.

## The defect the alert text did not name: a false cause on the byte-lock

Every lane reports its failure as "<toolchain> not available", and
`expectEveryLaneExecuted` in the test quotes that string as the CAUSE an oracle
did not run:

```
oracle lane "qsharp" executed 0 cases -- the byte-lock claims 7 independent
implementations agree, and this one did not run. Cause: qdk not available: ...
```

So a path with a space, a crash inside the generated program, or any other
failure arrives wearing a missing-toolchain label -- a WRONG DIAGNOSIS attached
to the N in "N independent implementations agree". The count itself is already
guarded (that assertion is real and it fires), so nothing silently claimed 7
while running 6. What was wrong was the reason it gave for the shortfall.

Measured before and after on this machine, where the Q# venv genuinely is absent:

```
BEFORE: qdk not available: Command failed: /Users/.../sr
AFTER:  qdk not available: ENOENT: no such file or directory, posix_spawn
                          .../src/Core.Python/.venv/bin/python3
```

The before line is truncated mid-path at 100 characters and names no cause. The
after line names the exact missing file. Two changes produce that: `stderr` is
no longer discarded (removing the shell separated the streams, so `e.message`
alone degrades to "Command failed: <argv>"), and the truncation moves 100 -> 400.

## Why all nine and not just line 276

A falsifier that makes the class impossible beats a fix for the one instance a
scanner could prove. With no shell anywhere in the file, no future edit can
reintroduce the defect by interpolating a new variable into a command string.
The rust lane loses its `2>&1` in the process, which is exactly what
`describeExecFailure` gives back.

## Verification

The harness test was run before and after on the same machine:

- Identical result, 1 pass / 4 fail both times, and the failing set is
  `diff`-identical: the qsharp lane only, because this machine has no
  `src/Core.Python/.venv`. The six lanes that CAN run still byte-agree -- no
  mismatch line appears in either log.
- `bunx tsc --noEmit -p tsconfig.json` rc=0.
- `lint-check-then-use-file-races` over `src/Core.TypeScript` rc=0.
- eslint on this file: 84 pre-existing errors before, 64 after. The file is not
  on the `lint:eslint` roster, so neither number is gated; the change does not
  add any. Prettier was already dirty on this file before the change and is
  left that way rather than folding a whole-file reformat into a security diff.

### All seven lanes, proved locally

The first draft of this note recorded "the Q# lane can only be proved by CI" as
a limit. It was a missing venv, not a limit. The venv was built
(`uv venv` + `qsharp==1.29.1` into `src/Core.Python/.venv`) and the suite run
twice on the same machine:

```
CONTROL (origin/main harness, venv present)   5 pass / 0 fail
SUBJECT (execFileSync harness, venv present)  5 pass / 0 fail
```

Seven oracles byte-agreeing, before and after. That is also the
`ZETA_FLOOR_VECTORS_ACK` acknowledgement the pre-push floor guard asks for: it
refuses a push touching a cross-oracle contract until the oracles have been run
locally, and it was right to -- running them is what turned a stated limit into
a measurement.

## Adjacent, not fixed here

`tmpDir` is `join("/tmp", ...)` rather than `os.tmpdir()`. Harmless on the
Linux runner this job uses; it would be wrong on Windows. Left alone -- a
portability change does not belong in a security diff.
