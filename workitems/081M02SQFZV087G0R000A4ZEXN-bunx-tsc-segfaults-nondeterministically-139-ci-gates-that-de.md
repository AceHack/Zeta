---
id: 081M02SQFZV087G0R000A4ZEXN
type: bug
state: backlog
priority: P2
slug: bunx-tsc-segfaults-nondeterministically-139-ci-gates-that-de
title: "bunx tsc segfaults nondeterministically (139); CI gates that decide by grep read a crash as a pass"
created: 2026-08-15T13:28:08.443Z
depends_on: []
composes_with: []
---

# bunx tsc segfaults nondeterministically (139); CI gates that decide by grep read a crash as a pass

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M02SQFZV087G0R000A4ZEXN-*.md` glob. -->

## What remains open — and it is a HARDWARE question, not a toolchain one

`AceHacks-Mac-Studio` recorded **147 process crash reports between 2026-08-08 and 2026-08-15**
(`~/Library/Logs/DiagnosticReports/` + `Retired/`):

```
77  SIGSEGV        47  SIGABRT       19  SIGTRAP
 2  SIGBUS          2  SIGKILL (Code Signature Invalid)
```

Across `dotnet` 49 · `node` 16 · `bun` 14 · `git` 5 · `lean` 5 · `csc` 4 · `Tests.FSharp` 4 · `java` 3
· `python3.14` 3 · `rustc` · `cargo` · `gpg` · `golangci-lint` · `llama-server` — **and** Chrome,
Claude, Manus, ExpressVPN helpers, `xpcproxy`, `mediaanalysisd`, and three of Apple's own
`XProtectRemediator*` binaries, which run none of our code.

**38 of the 147 fault inside a garbage collector** walking the heap (CoreCLR `gc_heap::*`, V8
`MarkingVisitorBase` / `ConcurrentMarking` / `Scavenger`). Two are code-signature-invalid kills — the
kernel finding that pages did not read back the bytes they were signed with.

Unrelated memory managers do not all start faulting in their heap-walkers in the same week. **Strong
evidence of a memory-integrity fault beneath every runtime on that machine.** Not proven to be RAM;
§2c of the research doc names the alternatives (OS/system-extension defect; sustained load — the load
average was 29) and how to discriminate them.

### The next step needs a human at the machine

1. **Run Apple Diagnostics** (hold `D` at boot). Nothing else in this item matters until that is done.
2. Cheap controls meanwhile: drop fleet concurrency and re-measure the crash-report rate; consider
   removing the ExpressVPN system extension and re-measuring.
3. **Treat locally-produced byte-locks and golden vectors from 08-08 onward as suspect.** CI is clean
   (836 runs swept, zero signal deaths), so prefer CI as the oracle until the machine is cleared.

### The reproducible surface

| command                                                         | signal                                                       | rate measured              |
| --------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------- |
| `bunx tsc --noEmit`                                             | **139** = SIGSEGV, **zero bytes of output**                  | 1 in 10, busy machine      |
| `bun node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | **133** = SIGTRAP                                            | 2 in 48, 16-way concurrent |
| `dotnet build -c Release` (first attempt of this PR)            | **134** via `MSB6006`, CLR fail-fast on a hardware exception | 1, then 3 clean re-runs    |
| either tsc path, idle machine, serial                           | none                                                         | 0 in 11 + 11               |

## What is already closed (PR for `081M02SQFZV087G0R000A4ZEXN`)

The consequence, not the cause. A signal death emits nothing, which is byte-identical to a clean run,
so any check deciding PASS by the **absence** of a string reads a crash as a pass:

- `signal-death.ts` — classify the exit **disposition** before anyone reads the output.
- `run-checked.ts` — run, assert completion, _then_ apply `--deny`/`--require`. Exit 2 = "did not
  run" is a distinct value from exit 1 = "ran, found something".
- `lint-no-decide-by-grep.ts` — refuses the shape in any workflow (deny polarity only; `if ! … | grep
-q` is fail-closed and is deliberately not flagged).
- `lean-proof.yml` — 20 proof gates rewritten. On `main`, replaying that step with a `lake` that
  SIGSEGVs on every call exits **0** and prints "axiom audit clean (no sorryAx)".

## Next moves for whoever picks this up

1. **Get a rate on a quiet machine.** The idle control is n=11; that is a direction, not a rate.
2. **Capture a crash report.** macOS writes one to `~/Library/Logs/DiagnosticReports/` — the bun
   stack there is what turns "unknown mechanism" into a filable upstream issue.
3. **Check bun's issue tracker** for tsc-under-concurrency panics on arm64 before filing.
4. **Do not add a retry loop as the answer.** A retry bounds duration, not correctness. The one retry
   that exists (`lint-typescript.ts`) now announces the crash on its success path precisely so the
   rate stays visible.
5. **The stronger lean guard, named not taken:** `--require 'depends on axioms|does not depend on any
axioms'` would prove each audit actually printed an axiom set. It needs someone with a Lean
   toolchain to confirm both output wordings before it ships.

## Pointers

- `docs/research/2026-08-15-139-and-134-are-signal-deaths-147-of-them-in-one-week-on-one-machine.md`
- `src/Core.TypeScript/hygiene/signal-death.ts` · `run-checked.ts` · `lint-no-decide-by-grep.ts`
- `.claude/rules/dv2-data-split-discipline-activated.md` — §4 DST, §7 noninterference
- PR #10759 — the `dotnet fsi` SIGSEGV + `MSB4166`, recorded honestly in a PR body
