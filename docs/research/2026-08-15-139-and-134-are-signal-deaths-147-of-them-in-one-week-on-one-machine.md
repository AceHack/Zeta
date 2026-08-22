# 139 and 134 are signal deaths — 147 of them, in one week, on one machine

**Date:** 2026-08-15 · **Author:** shadow (Claude Opus 5) · **Register:** Mirror→Beacon
**Work-item:** `081M02SQFZV087G0R000A4ZEXN`
**Origin observation (Aaron, 2026-08-15):** _"we've had a lot of these 139 and 134 we should like
dispatch someone to investigate and see if they can reproduce and/or fix, it might be some
non-determinism slipping in somewhere."_

---

## 0. The answer, and it is not the one the brief expected

**139 = 128 + 11 = SIGSEGV. 134 = 128 + 6 = SIGABRT.** The kernel killing a process, not a program
answering "no". I went looking for nondeterminism in our code or in one toolchain. The evidence says
something else:

> **`AceHacks-Mac-Studio` recorded 147 process crash reports between 2026-08-08 and 2026-08-15 —
> across .NET, Node, Bun, Rust, Go, Java, git, gpg, Chrome, Claude, ExpressVPN, and three of Apple's
> own XProtect malware-remediator binaries. 38 of them fault _inside a garbage collector_ walking the
> heap, two are `SIGBUS`, and two are `SIGKILL (Code Signature Invalid)`.**

That is not many independent upstream bugs. Memory managers from unrelated vendors do not all start
faulting in their heap-walkers in the same week by coincidence, and a code-signature-invalid kill is
not a crash at all — it is the kernel finding that pages did **not read back the bytes they were
signed with**.

**The load-bearing claim, at the confidence it has earned:** this is strong evidence of a
**memory-integrity fault beneath every runtime** on that machine. Not proof of failing RAM — that is
for Apple Diagnostics to say — but enough that **further toolchain-level investigation is the wrong
next move**, and enough that anything byte-integrity-critical produced on that machine in this window
is suspect.

The rest of this document is the evidence, a second finding that stands on its own (§3–§4), and the
things I got wrong on the way (§5).

|       | claim                                                                              | status                                           |
| ----- | ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| **A** | 147 crashes / 8 days / one machine, cross-vendor, including Apple's own binaries   | **measured**                                     |
| **B** | The crashes are **not** in CI — CI is clean                                        | **measured** — 836 runs swept, zero              |
| **C** | A crash reproduces on demand: `bunx tsc` → **139**, zero bytes of output           | **reproduced**                                   |
| **D** | `lean-proof.yml`'s 20 proof gates **pass** with a prover that segfaults every call | **reproduced verbatim on `main`**                |
| **E** | Root cause is a machine-level memory-integrity fault                               | **strongly supported, not proven** — §2c         |
| **F** | Root cause is failing RAM specifically                                             | **NOT established** — §2c names the alternatives |

---

## 1. Where the crashes are NOT: CI is clean

Before theorising, a count. GitHub Actions logs swept for every signal-death marker
(`Segmentation fault`, `SIGSEGV`, `SIGABRT`, `core dumped`, `MSB4166`, `child node exited
prematurely`, `Process completed with exit code N`, `Fatal error. Internal CLR error`, test-host
crash strings):

| sample                                  | window                     | runs    | signal-death markers |
| --------------------------------------- | -------------------------- | ------- | -------------------- |
| every **failed** run                    | 2026-08-08 → 2026-08-15    | **503** | **0**                |
| **successful** runs (contiguous sample) | 2026-08-15 09:41–13:03 UTC | **333** | **0**                |

Every step failure in the failed-run sample resolves to an ordinary exit status:

```
696  Process completed with exit code 1
 14  Process completed with exit code 3
  2  Process completed with exit code 127
  1  Process completed with exit code 2
```

The only "139"/"SIGSEGV" strings in eight days of CI logs are **prose in a PR body** — an agent
honestly reporting a local crash (PR #10759).

**Correction to the brief.** The brief's framing invites a hunt for CI nondeterminism. The Linux
runners are not producing these at all. Every one is a **local process on Aaron's Mac Studio**, which
is what made §2 findable.

---

## 2. The population: 147 crashes, and what they have in common

Source: `~/Library/Logs/DiagnosticReports/` and its `Retired/` archive, parsed as JSON.

### 2a. By day and by signal

| date                | reports |
| ------------------- | ------- |
| 08-08               | 7       |
| 08-09               | 6       |
| 08-10               | 4       |
| 08-12               | 5       |
| 08-13               | **42**  |
| 08-14               | **58**  |
| 08-15 (partial day) | **25**  |

```
77  SIGSEGV
47  SIGABRT
19  SIGTRAP
 2  SIGBUS
 2  SIGKILL (Code Signature Invalid)
```

**77 + 47 is precisely Aaron's "a lot of these 139 and 134."** The rate is also rising sharply, which
is the shape of a degrading component rather than a stable bug.

### 2b. Four independent lines of evidence

**(i) Unrelated vendors, same week.** `dotnet` 49 · `node` 16 · `bun` 14 · `git` 5 · `lean` 5 ·
`csc` 4 · `Tests.FSharp` 4 · `java` 3 · `python3.14` 3 · `rustc` · `cargo` · `gpg` · `golangci-lint` ·
`llama-server`.

**(ii) Processes with nothing to do with our workload.** `Google Chrome Helper (Renderer)` 3 ·
`Claude Helper (Renderer)` 4 · `Manus Helper (Renderer)` 2 · `expressvpn-browser-helper` 6 ·
`xpcproxy` 2 · `mediaanalysisd` · `systemextensionsctl` · and **`XProtectRemediatorFloppyFlipper`,
`XProtectRemediatorGenieo`, `XProtectRemediatorBundlore`** — Apple's own malware remediators. Nothing
this repo does touches those. This is the observation that most cleanly rules out "our workload has a
bug".

**(iii) The faults concentrate in garbage collectors — 38 of 147.**

```
libcoreclr.dylib!WKS::gc_heap::mark_object_simple1
libcoreclr.dylib!WKS::gc_heap::plan_phase
libcoreclr.dylib!WKS::gc_heap::background_mark_simple1
libcoreclr.dylib!WKS::gc_heap::relocate_survivor_helper
libcoreclr.dylib!WKS::gc_heap::make_unused_array
node!v8::internal::MarkingVisitorBase<…>
node!v8::internal::ConcurrentMarking::RunMajor
node!v8::internal::Scavenger::Process
node!v8::internal::BodyDescriptorBase::IteratePointers
```

A heap-walker chases every pointer in the heap. It is the single most memory-integrity-sensitive
routine any runtime has, so **one corrupted word surfaces there first** — and it surfaces in _both_
CoreCLR's GC and V8's GC, which share no code.

**(iv) Two `SIGKILL (Code Signature Invalid)`, and two `SIGBUS`.** A code-signature kill is _not_ a
crash: the kernel validated a page against the binary's signature and the bytes disagreed. One
`SIGBUS` is CoreCLR's `gc_heap::relocate_survivor_helper` — a bus error _during heap relocation_.
These are integrity failures reported by the OS, independent of any program's own logic.

### 2c. The alternatives, named rather than waved past

`.claude/rules/numerology-vs-number-theory.md` is explicit that **"too many correlations is a warning,
not a confirmation signal"** — the question at the moment it all clicks is whether these are separate
confirmations or one thing wearing several costumes. Asked, and answered: separate address spaces,
separate allocators, separate vendors, plus a non-crash integrity signal. They are genuinely
independent, which is what makes the density meaningful here rather than suspicious.

That still leaves more than one cause consistent with the data:

| hypothesis                                                                            | fits?                                                        | how to discriminate                      |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------- |
| **Memory hardware fault**                                                             | fits all four lines                                          | **Apple Diagnostics** (hold `D` at boot) |
| **OS / system-extension defect** (ExpressVPN installs one, and is among the crashers) | fits (i)–(iii); explains (iv) less well                      | remove the network extension, re-measure |
| **Sustained extreme load** — load average **29** across 24 cores, 1d22h uptime        | fits the rising rate and §3's load association               | drop fleet concurrency, re-measure       |
| **Our code**                                                                          | **excluded** — Apple's XProtect binaries do not run our code | —                                        |

I cannot run Apple Diagnostics, and guessing between the top three would be exactly the
over-correction the coincidence-index rule warns about. **What is established is that the cause is
below the toolchain.** Two of the three remedies are cheap and one is free.

### 2d. What this costs us, said plainly

If pages on that machine do not always read back what was written, then for this window:

- **Locally-verified byte-lock treaties and golden vectors produced there are suspect.** A single
  flipped byte in a generated vector is exactly the class of defect the four-oracle byte-lock exists
  to catch — and exactly the class a corrupted machine can _introduce_.
- **"I ran the gates locally and they were green" is weakened**, in both directions: a green may be a
  green, and a red may be a bit flip. CI (Linux, clean per §1) is the trustworthy oracle right now.
- **This is §7 DST failing at the substrate level.** Determinism cannot be a property of software
  running on hardware that does not reproduce its own memory.

---

## 3. Reproduced on demand: the shape that hides a crash

Ten sequential `bunx tsc --noEmit` runs, unchanged tree, one command:

```
run 1 exit=0   run 2 exit=0   run 3 exit=139   run 4..10 exit=0
```

Run 3's captured stdout+stderr: **0 bytes**. `grep -c 'error TS'`: **0**.

That is the whole problem in one line: **a typecheck that never ran, wearing the exact output
signature of a typecheck that passed.** The repo's own path
(`bun node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`) exited 0 with 0 bytes on the same
tree, so the tree is genuinely clean.

Three arms against the **same pristine worktree at `origin/main`**, changing only concurrency:

| arm                                  | conditions                          | `bunx tsc`       | `bun node_modules/typescript/bin/tsc` |
| ------------------------------------ | ----------------------------------- | ---------------- | ------------------------------------- |
| **A — idle control**                 | quiet machine, serial               | 0 / 11           | 0 / 11                                |
| **B — load**                         | 16 tsc processes at once, 6 rounds  | 0 / 48           | **2 × 133 (SIGTRAP)** / 48            |
| (opportunistic, before the controls) | machine busy with 8-way network I/O | **1 × 139** / 10 | —                                     |

And live, in this PR's own build gate, first attempt:

```
error MSB6006: "dotnet" exited with code 134.  [src/Core/Core.fsproj]
```

Three immediate re-runs: **exit 0, 0 warnings, 0 errors.** The crash report for that exact process
gives the mechanism: `FailFastIfCorruptingStateException` → `EEPolicy::HandleFatalError` →
`TerminateProcess` → `PROCAbort` → `abort()`, reached from `HandleHardwareException` on a
`.NET TP Worker`. **The CLR took a hardware memory fault, classified it as corrupting-state, and
fail-fasted.** So "134" is not a different family from "139" — it is a runtime's _report_ of one.

Note also that MSBuild renders it as `MSB6006 … exited with code 134`, never as `SIGABRT`. Anyone
grepping build logs for "SIGABRT" finds nothing.

### 3a-bis. Caught again while writing this, with bun's own diagnosis

Running the repo typecheck one more time before the final commit:

```
Args: "bun" "node_modules/typescript/bin/tsc" "--noEmit" "-p" "tsconfig.json"
RSS: 2.73GB | Peak: 2.73GB
panic: Segmentation fault at address 0x8801174532B8
oh no: Bun has crashed. This indicates a bug in Bun, not your code.
```

`exit 133`, **zero `error TS` lines**. Three immediate re-runs: **exit 0, 0 bytes, clean.** Note the
faulting address, `0x8801174532B8` — a wild pointer, not a null deref. Bun's banner says "a bug in
Bun, not your code", and on the strength of §2 I do not believe it: a wild pointer in bun, in
CoreCLR's GC, in V8's GC, and in `XProtectRemediatorGenieo` in the same week is one cause, not four.

---

### 3b. A second, independent trap in the same output

`bunx tsc` writes **SGR colour codes even when stdout is a file, not a tty**:

```
ESC[91merror ESC[0m ESC[90m TS2688: ESC[0m Cannot find type definition file for 'bun'.
```

so `grep -c 'error TS'` returns **0 on output that plainly contains a TypeScript error**. A _different_
mechanism producing the _same_ false clean — which means the brief's instance #1 ("139 with ZERO
`error TS` lines") has two sufficient explanations at once. `run-checked.ts --strip-ansi` handles it
and has a test that fails without it.

---

## 4. The sharp end: what a crash would have been believed as

`.github/workflows/lean-proof.yml` decided **20 proof-regression gates** like this:

```bash
if lake env lean /tmp/toymodel_axiom_audit.lean 2>&1 | grep -q 'sorryAx'; then
  echo "::error::ToyModel depends on sorryAx — a proof regressed to sorry/admit"
  exit 1
fi
```

A pipeline's exit status is the **last** command's (POSIX.1-2017 §2.9.2), so `lean`'s status is
discarded. The gate passes iff `sorryAx` is **absent** — and a prover that dies prints nothing.

**Measured, not argued.** The step was extracted verbatim from `origin/main` and replayed with a
`lake` on `PATH` that does nothing but `kill -SEGV $$`:

```
OLD step exit=0
Lean research-proof axiom audit clean (no sorryAx).
```

Twenty machine-checked-proof gates and one anti-vacuity guard reported **clean** while the prover
segfaulted on every invocation. The same step after this change, same fake `lake`:

```
step exit=2
::error::toymodel axiom audit: the check DID NOT RUN — KILLED BY SIGSEGV (shell code 139) — no verdict was produced
::error::A process that did not finish produces the same empty output as a clean pass. This is
         reported as 'no measurement', never as 'no findings'.
*** it emitted nothing at all, which is exactly the trap ***
```

and with a healthy (silent, exit-0) `lake`, exit **0**, all 20 audits `✓`. Kill it and the guard
catches it; restore it and it passes.

Note the lineage, and the irony. That file **already** carried an anti-vacuity guard added 2026-08-10,
whose comment reads _"A check that cannot fail is not a check."_ It caught the **name-resolution**
vacuity class. It could not catch the **process-death** class — because the guard itself was written
as `… | grep -q 'Unknown constant'`. **The guard had the defect it was guarding against.**

`lean` is in the crash population (5 reports). This was never hypothetical.

---

### 4b. And then it happened to this document

The first PR body for this change quoted `run-checked.ts`'s own output, which contained the line

```
--- it emitted nothing at all, which is exactly the trap ---
```

A line beginning `---` is a **patch boundary** to `git interpret-trailers`, which therefore stopped
parsing at that line and found **no AgencySignature trailers at all** in the body. Caught by running
`git interpret-trailers --parse` against the posted body rather than assuming it was fine.

Two fixes, both in `run-checked.ts`, both with a mutant proving the guard discriminates:

1. **Separators are `\***`, never `---`.\*\* Reverting them fails three tests; restoring passes 29.
2. **Diagnostics go to `process.stderr` directly, not through the console object.** Bun colourises
   console output _even when stderr is a pipe_, so every line arrived prefixed with an SGR sequence —
   and GitHub Actions only recognises a workflow command when the line **begins** with `::error::`.
   The guard's alarm would not have rendered as an annotation. Reverting to `console.error` fails the
   annotation test.

The second one is the sharper lesson, and it is the same lesson as §3b: **the colour prefix also made
the `---` test itself unable to fail.** A vacuous test, inside the change whose subject is vacuous
checks, caused by the very ANSI trap the change documents. Recorded in full because it is the most
useful thing in this section.

---

## 5. What I got wrong, in order

1. **"It's `bunx`, so stop using `bunx`."** Dead. Arm B crashed the repo's **own** path — the one
   `lint-typescript.ts` deliberately uses to avoid `bunx` — and did not crash `bunx` at all in 48
   tries.
2. **"The 133 was my own contamination."** I first saw a SIGTRAP while editing files under the runs and
   wrote it off as bun reading a file mid-rewrite. Arm B reproduced it twice on an unmodified
   worktree. Dismissing an inconvenient observation, and being wrong, is worth recording.
3. **"This is a toolchain bug."** Held it right up until I read the crash reports. Apple's own XProtect
   binaries crashing on the same machine in the same week is what ended it. **The most informative
   evidence was one directory away the entire time** — _look, don't infer_ would have got here two
   hours earlier.
4. **The framing itself.** I was scoping a fix to a compiler. The question was about a computer.

---

## 6. What was NOT found

- **No nondeterministic crash in our own code.** The `dotnet fsi` 139 in PR #10759 was an agent's
  throwaway script enumerating a 15M-element list — self-inflicted scale, deterministic given input,
  already rewritten.
- **No CI-side signal deaths at all** in 836 sampled runs.
- **No connection to the `Environment.CurrentDirectory` lead.** The brief flagged another agent's work
  on process-global CWD churn in `tests/Tests.FSharp/Storage/Durability.Tests.fs` as a candidate
  ambient-mutation explanation. It is a real hazard worth its own fix, but it cannot explain
  `XProtectRemediatorGenieo` or `expressvpn-browser-helper`. **No evidence links them.** That agent's
  files were not touched.
- **`MSB4166`** appears in agent PR bodies but **zero times in eight days of CI logs**. Same family (an
  MSBuild worker that dies surfaces as MSB4166, not as the signal); too little in evidence to diagnose
  separately, and §2 subsumes it.

---

## 7. The fix that stands on its own

The machine diagnosis needs hands on hardware. The hardening does not — and on a machine producing
signal deaths at this rate, "a crash reads as a pass" stops being a hazard and becomes a schedule.

**`src/Core.TypeScript/hygiene/signal-death.ts`** — classify a process's exit **disposition** before
anyone interprets its output. Three outcomes that must never be flattened: **completed** (output
meaningful) · **exited nonzero** (output meaningful) · **killed / never started** (output truncated at
an arbitrary point, meaningless).

**`src/Core.TypeScript/hygiene/run-checked.ts`** — run the tool as a child (no pipeline), assert it
completed, _then_ apply `--deny` / `--require`. Exit codes deliberately distinct: `0` ran and held ·
`1` ran and found something · **`2` did not run** — the absence of a measurement, which is not the
absence of findings and must never be reported as one.

**`src/Core.TypeScript/hygiene/lint-no-decide-by-grep.ts`** — refuses the shape in any workflow.

**Polarity is the whole rule**, and getting it wrong would have made the lint noisy in the one
direction that is already safe:

| form                                     | meaning              | under a crash                                           |
| ---------------------------------------- | -------------------- | ------------------------------------------------------- |
| `if CMD \| grep -q PAT; then fail; fi`   | pass iff **absent**  | prints nothing → **PASSES**. _The defect._              |
| `if ! CMD \| grep -q PAT; then fail; fi` | pass iff **present** | prints nothing → grep exits 1 → **FAILS**. Fail-closed. |

Two live sites are the second kind (`ollama list | awk | grep -qx "$MODEL"` in
`accelerator-local-llm-validate.yml:74` and `macos-install-sh-test.yml:130`). They are **correct as
written** and are deliberately not flagged.

**And the retry was made honest rather than removed.** `lint-typescript.ts` already retried once on a
child-process signal. A retry **bounds duration, not correctness** — it cannot bound a crash into a
verdict. The retry stays (bounded, against a genuinely nondeterministic environment) but can no longer
be _silent_: when the second attempt succeeds, the success path now says the first attempt died and on
what signal. Given §2, a crash nobody records is a data point lost from the one series that would have
found the machine sooner.

---

## 8. Why this is one of the seven disciplines, not a CI chore

- **§7 DST.** A run that replays to a different answer is not deterministic. A crash that _reads as a
  pass_ is worse: the replay looks identical and the divergence is invisible. §2 makes this literal —
  determinism cannot be a property of software on hardware that does not reproduce its own memory.
- **§13 Noninterference** (Goguen & Meseguer 1982). Influence may enter only through declared, metered
  channels. A bit flip is the least declared channel there is, and grepping the corpse is the unmetered
  crossing.
- **every-bug-has-economic-value.** The ΔU banked here is not the machine — that needs a technician. It
  is **20 proof gates that could not fail**, the whole class of future gates written the same way, and
  a week of crashes that were being individually retried instead of counted.

The generalisation worth carrying: **an empty result and a result you failed to obtain are different
values, and any code that types them the same will eventually report the second as the first.** Same
shape as the `markdownlint-cli2` that linted zero files and exited 0, the aggregate floor that absorbed
a dark oracle lane, and `gh pr merge --auto` exiting 0 without arming. This is the sharpest instance,
because the failure is _loud_ at the OS level and _silent_ at the check level.

---

## 9. Reproduce it yourself

```bash
# The crash population (the important one):
python3 - <<'EOF'
import json, glob, collections, os
rows = []
for d in ("~/Library/Logs/DiagnosticReports", "~/Library/Logs/DiagnosticReports/Retired"):
    for f in glob.glob(os.path.expanduser(d) + "/*.ips"):
        b = json.loads(open(f, errors="replace").read().partition("\n")[2])
        rows.append((b.get("captureTime", "")[:10], b.get("procName"),
                     (b.get("exception") or {}).get("signal")))
print(len(rows), collections.Counter(r[2] for r in rows).most_common())
print(collections.Counter(r[1] for r in rows).most_common(25))
EOF

# The false clean, verbatim (needs no repo state at all):
bash -c 'kill -SEGV $$' 2>&1 | grep -c 'error'      # -> 0, and $? is grep's, not the shell's

# The guard, discriminating:
bun src/Core.TypeScript/hygiene/run-checked.ts --label demo --deny 'sorryAx' -- bash -c 'kill -SEGV $$'
echo $?                                              # -> 2, "the check DID NOT RUN"
bun src/Core.TypeScript/hygiene/run-checked.ts --label demo --deny 'sorryAx' -- bash -c 'exit 0'
echo $?                                              # -> 0

bun test src/Core.TypeScript/hygiene/signal-death.test.ts
bun test src/Core.TypeScript/hygiene/lint-no-decide-by-grep.test.ts
```

---

## 10. Open, and named

1. **Run Apple Diagnostics on `AceHacks-Mac-Studio`** (hold `D` at boot). This is the investigation's
   next step and it needs a human at the machine.
2. **Cheap controls while waiting:** drop fleet concurrency (load average was 29) and re-measure the
   crash-report rate; consider removing the ExpressVPN system extension and re-measuring.
3. **Treat locally-produced byte-locks from 08-08 onward as suspect** until the machine is cleared;
   prefer CI as the oracle (§1 says CI is clean).
4. **The bun and CLR crashes are not "fixed"** and this PR does not claim they are. Filed as
   `081M02SQFZV087G0R000A4ZEXN`.
5. **A stronger lean guard, deliberately not taken:** `--require 'depends on axioms|does not depend on
any axioms'` would prove each audit actually printed an axiom set. I could not run Lean locally to
   confirm both output wordings, and a gate I cannot falsify before shipping is the thing this PR is
   against. Named for whoever has a toolchain.
6. **The lint is line-based** and does not see a pipeline split across a `\` continuation. A known
   limit, written into the source, rather than a silent one.

---

_Explicit unindexed rationale: this doc is a same-day investigation record whose durable surfaces are
the code (`signal-death.ts`, `run-checked.ts`, `lint-no-decide-by-grep.ts`) and the work-item
`081M02SQFZV087G0R000A4ZEXN`; the memory-substrate entry is deferred until §2's hardware question is
answered, because what belongs in memory is the verdict, not the suspicion._

## Pointers

- `src/Core.TypeScript/hygiene/signal-death.ts` · `run-checked.ts` · `lint-no-decide-by-grep.ts` (+ tests)
- `.github/workflows/lean-proof.yml` — the 20 rewritten gates · `.github/workflows/gate.yml` — the new lint step
- `src/Core.TypeScript/lint/lint-typescript.ts` — the retry, now recorded instead of silent
- `workitems/081M02SQFZV087G0R000A4ZEXN-*.md` — the open items, including the hardware check
- `.claude/rules/dv2-data-split-discipline-activated.md` — §4 DST, §7 noninterference
- `.claude/rules/every-bug-has-economic-value.md` — a bug is priced uncertainty; this one is priced at 20 gates and a week of retries
- `.claude/rules/numerology-vs-number-theory.md` — §2c is that rule applied to my own strongest result
- PR #10759 — the `dotnet fsi` SIGSEGV and `MSB4166` recorded honestly in a PR body, which is how this thread was findable at all
- POSIX.1-2017 §2.9.2 (pipeline exit status is the last command's) · §2.8.2 / `waitpid(2)` `WIFSIGNALED` (the 128+N convention)
- Goguen & Meseguer 1982, _Security Policies and Security Models_ — noninterference
- Schroeder, Pinheiro & Weber, _DRAM Errors in the Wild: A Large-Scale Field Study_ (SIGMETRICS 2009) — memory errors are far more common than assumed, and their first symptom is exactly this: unexplained crashes concentrated in memory-touching code
