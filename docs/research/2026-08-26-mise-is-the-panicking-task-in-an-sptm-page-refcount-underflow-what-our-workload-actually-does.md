# `mise` is the panicking task in an SPTM page-refcount underflow — what our workload actually does

**Date:** 2026-08-26
**Register:** findings. Read-only investigation. **No toolchain change is proposed or made here** —
naming the mechanism is the deliverable, and a toolchain change made autonomously off a crash log is
the wrong call. Aaron decides what, if anything, changes.

---

## 0. The one-paragraph answer

Aaron's machine hard-panicked twice; the second panic names `mise` as the faulting task inside Apple's
**SPTM** (Secure Page Table Monitor) with a per-page mapping refcount decremented below zero. **The
defect is Apple's** — no userspace process may panic the kernel, and nothing `mise` can do makes that
untrue. What this document establishes is the *workload* that reaches it, and the answer is a single
measured number: this repository's shell integration **executes an 80.7 MB-of-`__TEXT` binary on every
shell prompt, in every one of 69 live worktrees, across 24 concurrent agent processes.** Each such exec
maps and unmaps **4,925 shared, file-backed executable pages** — the *same* physical pages every time,
because there is only one `mise` binary on disk. A refcount on those shared pages is therefore being
incremented and decremented at very high frequency, concurrently, from many cores. That is the map/unmap
traffic the panicking counter counts.

The causal link between that traffic and this specific panic is **`consistent with`, not `metered`.**
It is not proven here and could not be proven without a kernel the panic reproduces under.

---

## 1. The panic

```
panic(cpu 16 caller 0xfffffe003905c010): cpt_mapcnt_dec: refcnt underflow: rc ... old_value 0 value 65535
Panicked task 0xfffffe2e90468e88: 2296 pages, 1 threads: pid 37148: mise
Kernel Extensions in backtrace: com.apple.sptm(25.5)
Darwin Kernel Version 25.5.0 / RELEASE_ARM64_T6020
```

Read literally, and only literally:

| field | reading | register |
|---|---|---|
| `cpt_mapcnt_dec` | a **decrement** of a mapping count | `metered` (it is the symbol name) |
| `old_value 0 value 65535` | the counter was **already 0** and went to `0xFFFF` — an unsigned **16-bit** field wrapping on decrement-at-zero | `metered` (0xFFFF = 65535, arithmetic) |
| `pid 37148: mise` | `mise` was the task **executing when the check fired** | `metered` |
| `2296 pages, 1 threads` | 2296 × 16 KB = **37.6 MB** resident, single-threaded — a *small, ordinary* process | `metered` |
| `com.apple.sptm(25.5)` | Apple's Secure Page Table Monitor, the component above the kernel that owns page tables | `metered` |
| `T6020` | Apple **M2 Pro** | `metered` |

**The most important row is the fourth**, and it corrects the obvious first guess. `mise` was *not* a
memory hog at the moment of the panic — 37.6 MB, one thread. So the hypothesis "mise allocated too much
and overflowed something" is **excluded by the panic's own numbers**. Whatever accumulated did not
accumulate *inside* this process.

A second point that follows from the symbol alone: **an underflow is not an exhaustion.** A counter
overflowing means "too many of a thing." A counter decrementing *below zero* means the decrements did
not match the increments — a **double-free / accounting race**, not a capacity limit. Volume does not
by itself produce an underflow; volume produces the *opportunity* for a race to be lost.

`Panicked task` also means only "the task on-CPU when the assertion fired." On a shared page counter,
the task that trips the assertion **need not be the task that unbalanced it**. `mise` may be the victim
of a decrement mismatch, the cause of it, or simply the process that happened to touch the page next.
Nothing in the log distinguishes these, and this document does not pretend to.

---

## 2. What actually invokes `mise` — measured

### 2.1 The shell hook is the dominant caller, and it runs per prompt

`mise activate` is live in the environment agents inherit (`MISE_SHELL=zsh`, `MISE_ENV=full`,
`__MISE_SESSION` set). Its two hooks are registered in `precmd_functions` / `chpwd_functions`, and their
bodies are unambiguous:

```zsh
_mise_hook_precmd () {
    if [[ "${__MISE_ZSH_CHPWD_RAN:-0}" == "1" ]]; then
        export __MISE_ZSH_CHPWD_RAN=0
        return
    fi
    eval "$(/opt/homebrew/bin/mise hook-env -s zsh --reason precmd)"
}
_mise_hook_chpwd () {
    export __MISE_ZSH_CHPWD_RAN=1
    eval "$(/opt/homebrew/bin/mise hook-env -s zsh --reason chpwd)"
}
```

This is **read from the live shell**, not inferred: `mise hook-env` is a **fresh process exec on every
prompt** and on every directory change. The `__MISE_ZSH_CHPWD_RAN` flag de-duplicates the *pair* (a `cd`
does not exec twice) — it does not reduce the steady-state rate below one exec per prompt.

Note also that the hook calls `/opt/homebrew/bin/mise` by **absolute path**, so `PATH` manipulation
cannot intercept, redirect, or shim it.

Consequence for this fleet specifically: the agent harness initialises a shell from the user's profile
per tool call. **Every agent Bash call is therefore at least one `mise` exec.**

Measured cost per exec: **62 ms** (10 sequential `mise hook-env` runs, 0.62 s total). `metered`.

### 2.2 The binary is enormous, and that is the load-bearing number

```
/opt/homebrew/bin/mise -> ../Cellar/mise/2026.6.14/bin/mise      101,589,968 bytes on disk
Segment __TEXT: 80,691,200          Section __text: 51,798,972
macOS ARM64 page size: 16,384
```

**80,691,200 / 16,384 = 4,925 executable pages**, file-backed and **shared**, mapped on every single
exec and unmapped on every exit. `metered`.

This is the crux. Those 4,925 pages are *the same physical pages* for every invocation — one file, one
page cache. So the per-page mapping refcount for that specific set of pages is not merely busy, it is
the single hottest map/unmap target on the machine, driven from many cores at once.

### 2.3 The multiplier: worktrees and concurrency

| quantity | value | how obtained |
|---|---|---|
| live git worktrees | **69** | `git worktree list` |
| worktrees carrying `.mise.toml` + `.mise.full.toml` | **69 (all)** | both files are tracked, so every worktree gets both |
| trusted / untrusted (2026-08-26) | **61 / 8** | `mise trust --show` per worktree |
| `~/.local/state/mise/trusted-configs` records | **338** | `ls | wc -l` |
| concurrent agent processes at sample time | **24** | `ps ax` |
| workflow files mentioning mise | **37** | `grep -rlE '\bmise\b' .github/workflows/` |

All `metered`.

**The 8 untrusted worktrees are a red herring for the panic, and saying so is the point.** An untrusted
config makes `mise` *print an error and exit non-zero* — it does **not** skip the exec. The process still
starts, still maps its 4,925 `__TEXT` pages, still unmaps them. The error is loud and annoying (it
appears on every command in a fresh worktree — including on every command of the session that wrote this
document) but it is **noise, not mechanism**. Correcting my own earlier count here: a first pass reported
*0 of 69* trusted, which was a bad measurement — `mise trust --show` abbreviates `$HOME` to `~`, so a
grep for absolute paths matched nothing. The corrected figure is 61/8.

### 2.4 Worktree churn — and a date that lines up

Every new worktree is a **new path**, and mise's trust is keyed by path, so each one is a fresh trust
record. `src/Core.TypeScript/lanes/lane-allocator.ts` runs `mise trust --all --yes` on every worktree it
creates (one more exec per allocation) and documents the problem in its own comments:

> `mise` refuses to read a config it has not been trusted at THAT PATH, and a worktree is a new path
> every time. […] **Measured 2026-08-25: 34 of 56 live worktrees were untrusted.**

Birth-times of the 338 trust records give a churn history:

```
2026-08-13     2        2026-08-21    15
2026-08-14    10        2026-08-22    12
2026-08-15    24        2026-08-23    10
2026-08-16    11        2026-08-24     7
2026-08-20    12        2026-08-25    74   <-- day before the panic
                        2026-08-26     4
```

**74 new worktree paths on 2026-08-25**, against a 5–15/day baseline — a 5–10× spike, in the window
Aaron describes as "took ~24 hours." `metered` as a count; **`consistent with` as a cause, and no more
than that.** It is one correlation, on one day, with no control period — exactly the shape
[`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md) says to record as a
coincidence with its register attached and not to promote.

---

## 3. What the literature says — including what it does not

Searched: GitHub code/issue/PR search, Apple Developer Forums, Apple Community, HN, Reddit, X,
OpenRadar, and Apple's published XNU source.

### 3.1 No exact match exists

**`cpt_mapcnt_dec` — the underflow direction — returns nothing, anywhere.** And **no report of any
kernel panic attributed to `mise` exists**, from any source. Stated plainly, per the brief, rather than
padded into a theory.

Worth recording about where mise bugs even live: `jdx/mise` has **GitHub Issues disabled repo-wide**;
reports go to Discussions → "Troubleshooting and bug reports." That category was searched for `panic`,
`SPTM`, `Tahoe`, `cpt_mapcnt` — zero matches. One Tahoe-tagged discussion exists
([#8734](https://github.com/jdx/mise/discussions/8734), "Mise 2026.3.12+ fails to start on MacOS Tahoe")
and is a **different bug** — a hang/100 %-CPU issue fixed in 2026.3.14. Ruled out.

### 3.2 The mirror-image bug is real, documented, and not ours

The **`_inc` / overflow** direction of the same symbol has two independent public occurrences:

- **`boldright/Knit`** (a Swift macOS compression tool) — [PR #17](https://github.com/boldright/Knit/pull/17),
  [PR #76](https://github.com/boldright/Knit/pull/76), both merged 2026-05, plus a lower-severity
  variant in [PR #81](https://github.com/boldright/Knit/pull/81). Panic text:
  `panic(cpu 1 caller 0x...): cpt_mapcnt_inc: refcnt overflow: rc 0x... old_value 2048 value 2049`,
  on an M5 Max / 128 GB host running **Darwin 25.4.0** (macOS 26.4) — one point release below Aaron's
  25.5.0. Trigger: 80 GB archives through heavy `mmap`. Their fix was `madvise(MADV_DONTNEED)` after each
  batch, to stop per-page mapping references accumulating on a memory-rich host where the kernel does not
  evict aggressively.
- **antirez (Salvatore Sanfilippo)** independently reporting the same `cpt_mapcnt_inc: refcnt overflow`
  text on X — [status/2049900673001566320](https://x.com/antirez/status/2049900673001566320) — addressed
  to Apple kernel engineers. *Caveat: that URL returns HTTP 402 to automated fetch; this rests on the
  search snippet, and the thread was not read.*

Two unrelated applications, no shared code, same counter. That is real evidence the counter exists and
that **mmap-heavy workloads on memory-rich Apple Silicon trip it** — which is the strongest available
support for "our workload reaches a genuine kernel bug" and is **`consistent with`**, since every public
instance is the *opposite arithmetic direction* from ours.

**Two honest discrepancies, recorded rather than smoothed over:**

1. The Knit authors assert in their commit messages that `cpt_mapcnt` is "the VM compressor's per-task
   reference counter on a compressed page," an 11-bit field capped at 2048. That is **their inference,
   stated as fact, sourced to no Apple document.** It could not be corroborated — see §3.3.
2. Their overflow is at **2048 → 2049** (an ~11-bit range); ours wraps **0 → 65535** (a 16-bit range).
   Same symbol prefix, **different apparent field width.** Either these are different counters, or the
   11-bit reading is wrong, or the printed values are not the raw field. Unresolved, and it materially
   weakens any claim that the two reports are the same bug.

### 3.3 Apple's public source does not contain the symbol

Darwin 25.5.0 = macOS 26.5 (build 25F71) = XNU **12377.121.6**, a tag that exists in
[`apple-oss-distributions/xnu`](https://github.com/apple-oss-distributions/xnu). Searched at that exact
tag for `cpt_mapcnt`, bare `mapcnt`, and the `cpt_` prefix: **no occurrences**, including in
`osfmk/vm/vm_compressor*.c` and the public SPTM glue in `osfmk/arm64/sptm/*` (which *does* carry ~122
hits for `sptm`, so that component's kernel-side code genuinely is public).

**So the counter lives in the closed SPTM monitor binary, not in shipped source.** Two consequences,
both worth stating: nobody outside Apple can read the increment/decrement discipline to say what
unbalances it — and the Knit authors' "VM compressor" attribution is therefore **unverifiable by
construction**, which is why it is not repeated here as fact.

### 3.4 What SPTM is (Beacon)

- **Apple Platform Security guide** —
  [Operating system integrity](https://support.apple.com/guide/security/operating-system-integrity-sec8b776536b/web).
  SPTM ships on **A15-or-later and M2-or-later** (so T6020 qualifies) and **replaces the Page Protection
  Layer (PPL)**. It runs at a privilege level *above* the kernel, alongside the Trusted Execution Monitor
  (TXM), for one purpose: protecting page tables from modification **even by an attacker with kernel
  write**. Because it is above the kernel, its integrity assertions **cannot degrade to a process kill** —
  it cannot trust the kernel to handle the failure, so the only available response to a violated
  invariant is to halt the machine. **That is why a userspace-triggered accounting bug appears as a hard
  panic rather than a `SIGBUS`**, and it explains the severity without excusing it.
- **Independent reverse-engineering** — Proteas, 2023,
  [notes on SPTM](https://proteas.github.io/ios/2023/06/09/some-quick-and-discrete-notes-on-sptm.html).
  **Fetched and read directly for this document**, not taken on report. Strings extracted from the SPTM
  binary include four distinct per-page reference counters, their violation cases, and the update entry
  point:

  ```text
  VIOLATION_OVERFLOW_RO_REFCNT      VIOLATION_OVERFLOW_WX_REFCNT
  VIOLATION_OVERFLOW_NESTED_REFCNT  VIOLATION_OVERFLOW_USER_REFCNT
  refcounts_update_page_op
  "%s: Attempted to update refcnts on a non-cpu-page: %d"
  validate_managed_page             validate_pte
  ```

  This establishes three things that were otherwise assumption: **SPTM genuinely keeps per-page
  reference counts**; it keeps **several kinds** (read-only, write-execute, nested, user); and **a
  refcount violation is a named, panicking condition** in its design rather than an unlucky assert.
  `refcounts_update_page_op` is the update entry point — which is what a mapping change calls.

  **Three honest limits the same evidence imposes, recorded because it cuts both ways.** (i) **None of
  those four is named `mapcnt`**, so ours is either a fifth counter, a rename, or newer than 2023 —
  unresolved. (ii) Every violation string here is `OVERFLOW`; **no `UNDERFLOW` string appears**, and our
  panic is an underflow. (iii) These are strings from a 2023 iOS-era binary, three years before Darwin
  25.5. So this **corroborates the mechanism class, not our specific counter** — which is exactly the
  register it is used at in §4.
- **Not read, and so not relied on:** arXiv:2510.09272, "Modern iOS Security Features: A Deep Dive into
  SPTM, TXM, and Exclaves" (Steffin & Classen, Oct 2025). PDF text extraction failed; only title and
  authors are known. Named so the next reader can go get it, **not** cited as support.
- **Apple release notes:** no macOS 26.x security-content page examined names SPTM, page tables, or the
  VM compressor. 26.5's list was read in full; later ones only skimmed. **Absence of evidence only** —
  Apple does not document non-security kernel fixes there, so this neither supports nor excludes a fix.

### 3.5 mise does perform real mmap work

Verified directly from mise's `Cargo.lock` on `main` (fetched, not inferred): `memmap2 v0.9.11` arrives
transitively via **`blake3`** (mmaps files to checksum downloaded archives), the **`gix-*`** crates
(gitoxide — mmaps git pack/index files), and **`rattler*`** (conda backend — mmaps repodata).

Register discipline matters here. That mise *links* mmap-using crates is `metered`. That any of them ran
during a `hook-env` call is **not established** — `hook-env` resolves config and prints environment, and
the panicking process was 37.6 MB and single-threaded, which does not look like a process mid-`blake3`.
**The mapping traffic argued in §2 comes from `exec`/`exit` of a large binary, which is a different and
much better-supported path than these crates.** Recorded so the tempting-but-weaker explanation is
visibly rejected rather than silently reused.

---

## 4. The mechanism, stated at its real strength

**`consistent with` — the strongest register the evidence supports. Not `metered`.**

1. SPTM keeps a **per-physical-page mapping reference count** (§3.4, reverse-engineering; corroborated by
   the symbol name).
2. Executing a binary maps its `__TEXT` pages; exiting unmaps them. For `mise` that is **4,925 shared,
   file-backed pages per exec** (§2.2, `metered`).
3. This repository's shell integration executes it **once per shell prompt**, in **69 worktrees**, under
   **24 concurrent agent processes** (§2.1, §2.3, `metered`).
4. Every one of those execs touches **the same 4,925 physical pages** — one binary, one page cache — so
   the increments and decrements land on **one small, extremely hot set of counters**, concurrently, from
   many cores.
5. A counter decremented **while already at zero** is a **lost race or a double-decrement**, not an
   exhaustion (§1). High-frequency concurrent map/unmap of one shared page set is a textbook way to lose
   such a race — and it explains the *timing*, which volume alone cannot: a race is probabilistic per
   attempt, so raising the attempt rate turns "never" into "about once a day," matching both the ~24-hour
   figure and the earlier, faster crash.

**Where this stops.** Steps 1–4 are measurements. Step 5 is a **mechanism hypothesis with no direct
evidence** — the SPTM source is closed (§3.3), no public report matches this arithmetic direction (§3.1),
the one documented sibling has an incompatible field width (§3.2), and nothing here was reproduced. A
plausible chain that explains an observation is not the same as a demonstrated cause; the honest verdict
is *unproven*, and the falsifier below is what would change that.

**Cursor is correctly excluded**, and by evidence rather than by preference: it was not running for the
second panic, so it cannot be necessary. That is a real elimination. `mise` being the surviving common
factor across two crashes is **weaker** — surviving elimination is not the same as being demonstrated,
n = 2, and no third factor was systematically ruled out.

### The falsifier

**Disable the shell hook fleet-wide** (`mise activate` off; resolve tools via `mise` shims or explicit
PATH, which the environment already largely has — every toolchain resolves through
`~/.local/share/mise/installs/...` entries in `PATH` today). That removes the per-prompt exec while
changing nothing about which toolchains resolve.

- Panics **stop** over a comparable window ⇒ the §4 chain survives its first real test.
- Panics **continue** ⇒ §4 is wrong, and the exec rate was a bystander.

This is a **proposal for Aaron**, not a change made here, and it is stated as an experiment with a
declared outcome on both branches — pre-declared so the result cannot be read favourably after the fact.
It is also honestly weak as experiments go: **n = 2 crashes, one machine, no control**, and "no panic for
a week" is not a strong signal from a base rate of roughly one per day.

---

## 5. Mitigations — each with its register

**None of these is applied by this PR.** Ordered by evidential support, not by convenience.

| # | mitigation | what it would do | register |
|---|---|---|---|
| 1 | **Report to Apple** (Feedback Assistant) with the full panic log, `mise` version, and §2's exec-rate numbers | Addresses the **actual defect owner**. A userspace process must not be able to panic the kernel. | **`metered`** that this is the correct venue — the bug is Apple's by construction |
| 2 | **Turn off the per-prompt hook**; rely on shims / the already-populated `PATH` | Removes ~1 exec/prompt × 69 worktrees × 24 agents. Directly reduces the traffic in §4. | `consistent with` — the traffic is measured, the causal link is not |
| 3 | **Trust the 8 untrusted worktrees** | Removes the error spam. **Does not reduce exec count at all.** | `metered` that it fixes the *noise*; **`speculative` bordering on false** as a panic mitigation — listed to be explicitly dismissed |
| 4 | **Reduce live worktree count** (69, several months stale) | Fewer paths ⇒ fewer prompts in mise-configured directories. Good hygiene regardless. | `speculative` as a panic mitigation |
| 5 | **Update mise** (2026.6.14 → 2026.8.12 available) | Cannot fix a kernel bug. Might change binary size or `hook-env` cost, altering exposure. | `speculative` |
| 6 | **Update macOS** past 26.5 | The fix, if one exists, is Apple's. No release note confirms one (§3.4). | `speculative` |

**Explicitly not recommended:** changing how this repository declares or consumes toolchains. Nothing in
the evidence indicts `.mise.toml`, the pins, or `mise` as a version manager — the finding is about
**invocation frequency in the shell integration**, which is a host/profile setting, not a repo contract.
[`clone-at-tag-stays-sufficient`](../../.claude/rules/clone-at-tag-stays-sufficient.md) is untouched by
anything above.

---

## 6. No malice, no incompetence — the boundary is just hard

Per [`never-assume-malice-where-mistake-is-possible`](../../.claude/rules/never-assume-malice-where-mistake-is-possible.md),
and it is worth saying concretely rather than as a formality:

- **Apple** wrote a monitor above the kernel whose whole purpose is that a violated page-table invariant
  is never quietly tolerated. An assertion that halts the machine is that design **working as intended**;
  that the assertion is reachable from ordinary userspace is an ordinary refcount defect at an extremely
  hard boundary — concurrent, lock-sensitive, unobservable from outside.
- **`mise`** execs quickly and exits, which is exactly what a shell-hook tool is supposed to do. Nothing
  it does is abusive.
- **This repository** runs many agents in many worktrees, which is the entire point of the design.
- The panic is where those three reasonable things meet.

The one genuinely actionable observation is smaller and duller than a culprit: **an 80.7 MB binary
exec'd once per shell prompt is a lot of page-table work for the job of printing a few environment
variables** — true independently of any kernel bug, and true before this crash.

---

## 7. What was NOT verified

Stated so no reader mistakes this for a closed case:

- **The panic was not reproduced.** Nothing here is a controlled experiment; §4 is a hypothesis.
- **No direct evidence** that `mise`'s exec traffic is what unbalanced the counter. `Panicked task` names
  the task on-CPU, not the culprit (§1).
- **The counter's semantics are unknown** — closed source (§3.3). "Per-page mapping reference count" is
  reverse-engineering plus the symbol name. Sharpened by §3.4: the four SPTM refcounts recoverable from
  binary strings are `RO` / `WX` / `NESTED` / `USER` — **none of them `mapcnt`** — and every violation
  string found is `OVERFLOW`, with **no `UNDERFLOW` string at all**. Our panic is an underflow of a
  differently-named counter, so the corroboration is of the **mechanism class only**.
- **The 2048-vs-65535 field-width discrepancy is unresolved** (§3.2) and may mean the Knit reports are a
  different bug entirely.
- **The 2026-08-25 churn spike is a single correlation** with no control period (§2.4).
- **arXiv:2510.09272 was not read**; the antirez thread was not read (HTTP 402) (§3.4, §3.2).
- **No systematic elimination of other factors** beyond Cursor. n = 2 crashes.
- **Not checked:** whether other large binaries on this host are exec'd at comparable rates. If one is,
  the "mise is the common factor" reading weakens considerably — and **that is the cheapest next
  measurement anyone could take.**

---

## Pointers

- `src/Core.TypeScript/lanes/lane-allocator.ts` — worktree allocation + `mise trust`; carries its own
  2026-08-25 measurement (34/56 untrusted)
- `.mise.toml` · `.mise.full.toml` — the tracked configs every worktree inherits
- `tools/setup/common/mise.sh` — trusts the install clone once; lanes allocated later inherit nothing
- [`numerology-vs-number-theory.md`](../../.claude/rules/numerology-vs-number-theory.md) — why §2.4's
  date match is recorded as a coincidence with its register attached
- [`toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md) —
  the three-register discipline every claim above is tagged under
