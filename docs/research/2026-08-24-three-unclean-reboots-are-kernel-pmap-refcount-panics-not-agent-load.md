# Three unclean reboots are kernel pmap refcount panics — and the panic logs were there all along

**Date:** 2026-08-24 · **Author:** dejan (devops-engineer, Claude Opus 5) · **Register:** Mirror→Beacon
**Machine:** `AceHacks-Mac-Studio`, Mac14,14 (M2 Ultra), macOS 26.5.2 (25F84), 192 GB
**Continues:** `docs/research/2026-08-15-139-and-134-are-signal-deaths-147-of-them-in-one-week-on-one-machine.md`

> **UPDATE, 09:29 the same day — a FOURTH panic, and the search error repeated.**
> While this was being written the machine panicked again (21:35, 07:40, 08:17,
> 09:29). The coordinator relaying the report checked
> `/Library/Logs/DiagnosticReports/*.panic` and `~/Library/...`, found nothing,
> and concluded *"panic files are NOT landing on disk"* — so Aaron pasted the
> report out of the crash dialog by hand.
>
> **The file was on disk the whole time**, as
> `Retired/panic-full-2026-08-24-092944.0002.panic`, and the shipped harness
> found and parsed it automatically. Everything the human copied by hand — the
> panic string, `secure boot?: YES`, `roots installed: 0`, the compressor line,
> the panicked task — is recoverable from that file.
>
> This is the SAME non-recursive-search error, made twice, hours apart, by two
> different readers. Timing measured this round: the report was written at
> **09:29:48** and was already in `Retired/` by **09:33** — under four minutes.
> A top-level glob will essentially always miss. That is now the first thing the
> runbook says, and `findPanicReports()` is why the harness does not repeat it.
>
> The 4th panic also promoted claim **C** from "the same code path twice" to
> **three times**, and the harness said so on data it had never seen:
> `*** 3 panics share an IDENTICAL kernel backtrace ***`.

---

## 0. The answer, and the two premises it required falsifying

The brief was to build a capture harness because the evidence was gone. Both
reasons the evidence was believed gone are **wrong**, and finding that out
produced the root cause in the first twenty minutes.

> **The three unclean reboots on 2026-08-24 are kernel panics, and the panic
> reports exist. All three are the kernel's physical page map (`pmap`)
> disagreeing with its own reference accounting. All three panicked inside a
> `Cursor` process. Not one of `bun`, `node`, `dotnet`, `git`, `claude` or
> `forge` appears in any of them.**

```
05:46:58  panic(cpu 17): pmap_remove_range_options: pmap 0xfffffe32edbca3e0
          VA [0x1146e000000, 0x11470000000) (wiredcnt 0xfffffddc7109fda6)
          wired count underflow @pmap.c:5072            task: Cursor
07:41:09  panic(cpu 8):  pmap_recycle_page: page 0x109bba68000 is referenced
          @pmap_data.c:2334                             task: Cursor Helper (Renderer)
08:17:54  panic(cpu 4):  pmap_recycle_page: page 0x10758888000 is referenced
          @pmap_data.c:2334                             task: Cursor Helper (Renderer)
```

| | claim | status |
|---|---|---|
| **A** | The three reboots are kernel panics with `.panic` reports on disk | **measured** |
| **B** | All three are `pmap` reference-count failures | **measured** — the panic strings |
| **C** | The two `pmap_recycle_page` panics are the same code path | **measured** — 25/26 de-slid frames identical |
| **D** | All three panicked in a Cursor process | **measured** |
| **E** | The agent fleet is the proximate trigger | **REFUTED** — no fleet process in any report |
| **F** | Cursor *causes* the bug | **not established** — §4 |
| **G** | One kernel page-lifecycle fault explains both these panics and the 147 userspace crashes of 08-15 | **hypothesis, consistent with both datasets** — §5 |
| **H** | Third-party kexts (Paragon) or Defender are involved | **REFUTED** — `roots installed: 0` + secure boot; Defender's ES extension is userspace and cannot reach `pmap_data.c` |
| **I** | Memory pressure is involved | **REFUTED** — `Compressor Info: 0% ... 0 swapfiles, OK swap space` |

### The two falsified premises

**"No `.panic` files in `/Library/Logs/DiagnosticReports/`."** There were three,
in `/Library/Logs/DiagnosticReports/**Retired/**`. macOS ages reports into that
subdirectory within hours; on a machine crashing several times a day it is
where the evidence normally is. A non-recursive `ls` found nothing, and nothing
was reported as *"there were no panics"* rather than as *"I did not look
there."* That is `signal-death.ts`'s rule moved from a process to a directory:
**an empty result and a result you failed to obtain are different values.**
`findPanicReports()` now searches all four directories and reports
`unsearchable` separately from `found none`.

**"The unified log store is EMPTY for the pre-reboot windows."** It was not. It
had **rolled**. `log show --start "2026-08-23 21:30:00"` returned 10,289,058
lines, unprivileged, including the tail of every crash window. `Persist/` is a
fixed 509 MB / 55-file ring; the data survives reboot, and the account is in
`admin` so `/var/db/diagnostics` (`root:admin drwxr-x---`) is fully readable
with **no `sudo`**.

---

## 1. What "unclean" means, mechanically

`last reboot shutdown` writes a `shutdown time` record immediately before a
software-initiated reboot. A machine that dies writes only the `reboot`.

```
reboot time     Mon Aug 24 08:17     <- no shutdown record
reboot time     Mon Aug 24 07:40     <- no shutdown record
reboot time     Sun Aug 23 21:35     <- no shutdown record
reboot time     Thu Aug 13 11:14
shutdown time   Thu Aug 13 11:13     <- the last CLEAN one, eleven days ago
```

**9 of the last 10 boots were unclean.** This is not a three-crash morning on an
otherwise healthy machine; it is a long-running pattern that accelerated. There
is also a **fourth** crash today the `last` output does not show — `panic-base+socd`
at 05:46:58 — which is why panic reports, not `last`, are the ground truth.

---

## 2. The blackout: what no post-hoc tool can recover

`logd` buffers in memory and flushes to `Persist/*.tracev3` periodically.
Whatever is unflushed when the machine dies never reached a disk.

```
last persisted log line   2026-08-24 08:16:36
panic (NVRAM panicmedic)  2026-08-24 08:16:59.664
next boot (kern.boottime) 2026-08-24 08:17:16.285
                          ---------------------------------
BLACKOUT                  23.6 s  alive, unlogged, unrecoverable
DOWN                      16.6 s
```

**The machine spent longer dying than it spent rebooting, and none of that time
is in any log.** The same shape at 07:40 (last line `07:39:37`).

So the brief's premise — *"a boot-time capture preserves the previous boot's
tail; verify rather than assume"* — is **verified, with a measured hole**.
`log collect` at boot recovers the previous boot up to the last flush, needs no
elevation, and is worth doing. It cannot recover the final ~20-30 seconds,
because those bytes were never written.

That is the entire justification for the vitals heartbeat: the only way to have
those seconds is to write them yourself and `fsync` them while they happen.

**And the ring is the second clock.** 509 MB filling at ~130 MB/hour under
agent load = **under four hours of history**. The window shrinks precisely when
the machine is in the state you want to study. The 08:17 crash was investigated
at 08:30 and the evidence was there; the 21:35 crash was looked at the next
morning and was not.

---

## 3. `panicmedic-timestamps`, decoded

```
panicmedic-timestamps    0:659c9f687e920
panicmedic-auxkc-present true
panicmedic-telemetry     %11%01%00... %e9%87%f6%c9Y%06%00 %e9%87%f6%c9Y%06%00A%01...
```

`0x659c9f687e920` = `1787573819664672`, read as **microseconds since the Unix
epoch** = **2026-08-24 08:16:59.664672**.

The unit is *identified*, not guessed, because two independent witnesses agree:
the same 64-bit value appears twice inside `panicmedic-telemetry` (offsets 8 and
16), and `kern.boottime` for the following boot is 08:17:16 — 16.3 s later.
Nanoseconds would put it in 1970; seconds, in the year 58608.

The other two integers in the blob — `273` at offset 0, `321` at offset 24 —
are **not decoded**, and are reported as unknown rather than named. A field
named from a plausible-looking number with no second witness is the numerology
failure (`.claude/rules/numerology-vs-number-theory.md`), and this document is
already carrying enough coincidences to be careful with.

---

## 4. The load hypothesis, tested and refuted as the proximate cause

The hypothesis worth testing was that panics coincide with peak parallel file
I/O from concurrent agent clones and builds. The panic reports answer directly,
and the answer is no:

- The panicked task is `Cursor`, `Cursor Helper (Renderer)`, `Cursor Helper
  (Renderer)` — never a fleet process. Grepping all three reports for `bun`,
  `node`, `dotnet`, `git`, `claude`, `forge`: **zero hits, all three.**
- The two `pmap_recycle_page` panics have **identical de-slid backtraces** for
  25 of 26 frames, including the entire sequence through the fault. Random
  memory decay does not land on the same instruction twice in 37 minutes.

**Three necessary caveats, because this is one day of data:**

1. *Panicked task* is the process on-CPU when the assertion fired, not
   necessarily the one that corrupted the accounting. On a page-recycle path it
   is suggestive; it is not a conviction. Same discipline as
   `dual-use-detection-is-neutral-oracle-decides`: report the fact
   (`panicked in Cursor`), not the verdict (`Cursor did it`).
2. Load is not excluded as an **amplifier**. `pmap_recycle_page` runs on the
   page-reclaim path, which runs far hotter under heavy parallel file I/O. A
   race that needs a narrow window gets many more chances to hit it at load
   average 29 than at 2. Refuting *"the fleet is the culprit"* is not the same
   as refuting *"the fleet makes it more likely."*
3. ~~The Paragon kexts remain an untested candidate.~~ **RETRACTED, and the
   reasoning behind it was wrong.** The full panic report settles it:
   `roots installed: 0` with `secure boot?: YES` means no third-party kernel
   code was in the boot chain at all. I had treated
   `panicmedic-auxkc-present: true` as evidence a third-party auxiliary
   collection was implicated; that flag records only that an auxiliary
   collection **exists**, not that it was loaded into the panicking kernel or
   had anything to do with the fault. Microsoft Defender is excluded on
   structure rather than evidence: an EndpointSecurity extension is a userspace
   client and has no path to `pmap_data.c`. Both candidates are closed, and
   neither should be chased further.

**This is the better outcome, as briefed.** A refutation narrows the search;
a confirmation of the thing already suspected would not have.

---

## 5. The synthesis with 2026-08-15, at the confidence it has earned

The signal-death investigation found 147 process crashes in eight days across
unrelated vendors, **38 of them inside garbage collectors walking the heap**,
plus two `SIGKILL (Code Signature Invalid)` — the kernel finding pages that did
not read back the bytes they were signed with. Its conclusion: *"strong evidence
of a memory-integrity fault beneath every runtime."* Its §2c ranked **memory
hardware fault** first and **sustained extreme load** third.

**Did it predict this? The class, yes. The mechanism, no — and the update is
worth having.**

`pmap_recycle_page: page X is referenced` means the kernel was about to recycle
a physical page — hand it to someone else — while a mapping still referenced
it. `wired count underflow` means a wired-page counter was decremented more
times than it was incremented. Both are **accounting** failures. And that gives
a single mechanism that produces *both* datasets:

> A physical page still mapped by process A is recycled into process B. B
> writes; A's memory changes underneath it. A's garbage collector walks the
> heap, follows a pointer that is no longer what it was, and segfaults. A
> signed page stops matching its signature and the kernel issues
> `SIGKILL (Code Signature Invalid)`. Every runtime is affected, because the
> fault is below all of them — which is exactly the cross-vendor pattern
> observed, in Apple's own XProtect binaries too.

On macOS 26 with SPTM (Secure Page Table Monitor — present in these reports:
`SPTM UUID: AEB0C73F-...`), page-table integrity is hardware-enforced, so the
kernel **panics** on the inconsistency instead of silently completing the
recycle. That is a plausible reason panics started appearing now while the
userspace corruption pattern predates them: the same fault, newly caught.

**Status: hypothesis.** It is consistent with both datasets and explains the
cross-vendor GC concentration and the code-signature kills more economically
than DRAM decay does — but "explains everything" is itself a warning
(`numerology-vs-number-theory.md`: too many correlations is a warning, not a
confirmation signal), and one day of panic data cannot carry it. What it does
earn is a **cheap discriminating experiment**, §7.

**What both documents agree on, and what still holds:** byte-locks and golden
vectors produced locally on this machine remain suspect; CI is the trustworthy
oracle. That warning was correct on 08-15 and today's panics strengthen it.

---

## 6. The capture harness

`src/Core.TypeScript/forensics/` — macOS-only, stated plainly rather than
pretended portable. `nvram`, `kmutil`, `systemextensionsctl`, `pmset`, `vm_stat`
and the unified log have no cross-platform equivalent, and the thing under
investigation is an Apple kernel. `guardPlatform()` refuses to run elsewhere
rather than emitting plausible-looking garbage.

| command | what it preserves | cost |
|---|---|---|
| `vitals` | 1 Hz NDJSON, **`fsync` per sample** — the only thing that survives the blackout | 34.5 MB/day |
| `error-ring` | live `log stream` Error+Fault into a byte-capped 4-segment ring | **fixed 64 MB** |
| `snapshot` | nvram/panicmedic, kmutil, sysextensions, pmset, ps, iostat, **copies of every `.panic`** | 48 MB/day @ 96/day |
| `archive` | `log collect` + APFS-clone dedup of the symbol catalog | 124 MB real/archive |
| `boot` | classifies the boot; **archives the previous boot's tail immediately if unclean** | one archive |
| `triage` | this runbook, executed | text |
| `prune` | bounds it all | — |

**No `sudo`, anywhere** — verified, and `guardNoPrivilege()` refuses to run as
root so the property cannot decay into "it works, under sudo". This is not
convenience: there is a live P1 on the biometric gate being forgeable and the
maintainer has been approving prompts reflexively, so a harness that raised a
routine prompt would make a security problem worse.

**The disk trick that makes it affordable.** `log collect --last 2m` writes
524 MB, of which **449 MB is a static symbol catalog** (`dsc` 303 MB + 243
two-hex-digit directories, 146 MB). Copying that into every capture is the
entire cost. APFS `cp -c` clones share blocks — measured: **303 MB cloned for
4 KB of real disk.** So the catalog is kept once and cloned into each archive,
**and the result is verified with `log show --archive` before the original is
discarded**; a failed verification reverts and refreshes the canonical. A dedup
that silently produced an unreadable archive would be the vacuity class aimed
straight at forensics.

Measured, two consecutive captures, `df` delta as the independent witness:

```
1st archive (seeds the catalog):  594 MB real
2nd archive:                       97 MB real   for 540 MB of apparent content
tool's own "REAL disk cost":       96.7 MB      <- agrees with df to 3%
```

Note the reporting hazard that caused: `du` and `statSync` report the
**logical** size of a clone, so the first version of this tool printed 543 MB as
"on disk" — overstating the bill 5x. `archiveRealBytes()` subtracts the catalog
explicitly.

**Total: ~580 MB/day growing; ~4 GB at the default 7-day / 6-archive
retention, plus a one-time 447 MB catalog.** On 1.8 TB free.

---

## 6b. The load profile, and the measurement that discriminates

The cause is known; the open question is what conditions trigger it. Load
average was **64.91 at nine minutes of uptime** at the 09:29 panic, which is why
`vitals` now records VM churn rather than only process counts:

- **`Translation faults/s` and `copy-on-write/s`** — both count pmap entries
  being created and destroyed, which is the lifecycle `pmap_recycle_page` sits
  at the end of. This is what "VM churn" means concretely instead of as a
  feeling. Measured range on this machine: ~30k/s idle, **648,837/s** under a
  deliberately injected 10-process mapping load.
- **Per-application processes, threads and resident bytes**, so the next panic
  arrives with a profile rather than a guess.

**The discriminator for claim F.** `Cursor Helper (Renderer)` was the panicking
task in three of four, but the panicked task is only the process on-CPU when the
assertion fired — it may be the trigger or the unlucky bystander. What separates
those, over several panics, is **which application dominates VM activity**, not
which one died. The first live census is already interesting:

```
chrome:48p/1400t/17052M   cursor:16p/420t/7569M   apple-index:49p/219t/4299M
```

Chrome holds **more than twice** Cursor's resident bytes and **three times** its
threads — yet Cursor is the panicking task in 4 of 4. If Cursor were merely the
most numerous mapper and therefore the likeliest bystander, Chrome should have
been hit first and more often. **That disfavours the bystander reading.**

Stated at the confidence it has earned: this is **one sample, and resident bytes
are not a mapping rate** — a mostly-idle Chrome and a churning Cursor would
produce these numbers too. Per-process fault rates are not cheaply available on
macOS, which is a real limit of this instrument and is written into the module
rather than glossed. What the harness can do is accumulate this profile across
several panics, which is what turns a suggestive single reading into a result.

## 7. What I would do next — named, cheap, and discriminating

1. **Run Apple Diagnostics** (hold `D` at boot). Still open from 2026-08-15,
   still needs a human at the machine, and §5's hypothesis makes it *more*
   informative rather than less: a clean result is evidence for the software
   race, a dirty one settles it the other way.
2. **The Cursor experiment.** Cursor 3.17.8, 18 processes currently resident,
   is the only application in all three reports. Quit it for a working day with
   the fleet at normal load and count both panics and userspace signal-deaths.
   Free, reversible, and discriminates §5 from the load hypothesis in one day.
   It is also falsifiable in the useful direction: a panic with Cursor closed
   refutes the lead immediately.
3. **Install the boot agent before the next crash**, not after. The whole
   harness is worth one archive that would otherwise have rolled.
4. **Two candidates already in front of the maintainer** — the idle Paragon
   AuxKC kexts, and the Defender ES extension whose exclusion list covers only
   crypto paths and nothing for the repo, `~/zeta-clones`, `/tmp` or
   `node_modules`. Both are **his** calls. Nothing here touched either, and
   nothing here should.
5. **File the Apple bug.** `macos-panic-capture.ts feedback-report` generates
   the filing text from the panic files on disk — title, area, verbatim panic
   strings, kernel version, what the reports themselves rule out, the load
   profile, and the attachment list. It **does not submit**: filing runs under
   Aaron's Apple ID and is his call. It also declares a missing load profile
   rather than omitting it, because a filing without reproduction conditions
   gets closed as "cannot reproduce".
6. **`kern.num_files` is worth watching**: 13.4k of a hard 65536 at idle, and a
   deliberately-injected 24-process burst took it to 23.4k (35.6%) instantly. It
   is not a panic mechanism and is not claimed as one, but it is one of the few
   fixed ceilings on this box.

---

## 8. What I got wrong, in order

1. **I believed the brief's two negative findings** and started building around
   them. Both were false, and checking took ten minutes. *Look, don't infer* —
   the same lesson §5 of the 08-15 document recorded, unlearned and relearned.
2. **`Number.parseInt` on a 64-bit kernel address.** `0xfffffe00392b1808` is
   ~1.8e19, past `Number.MAX_SAFE_INTEGER`. Every de-slid offset came out
   page-aligned (`0x55000` instead of `0x55808`), which would have quietly
   widened "same backtrace" to "same 4 KB page" and grouped unrelated panics
   together. Caught only because a test pinned the real offsets.
3. **I claimed the two backtraces differed only in the ASLR-slid userspace
   frame.** They differ at frame 24, a genuine kernel frame, and the userspace
   frame is filtered before comparison. Corrected in the source, and it
   produced the better design: group by **panic site** (top 8 frames), not by
   whole stack.
4. **I printed logical size as "on disk"** for a deduplicated archive,
   overstating the cost 5x — in a document whose whole point is that a cost
   must be measured before it is published.
5. **Three parse bugs that only live data could catch**, all shipped because the
   fixtures were written from field *names* rather than from real bytes:
   `vm_stat` prints exactly one counter quoted (`"Translation faults":`) so the
   most important counter in this investigation rendered as `?`; `ps -AM -o pid=`
   silently ignores `-o` and prints the default columns, so every process fell
   back to a thread count of 1; and `kern.num_threads` is a **limit** (81920)
   not a count (~5,700), so a constant was printed in a column labelled as a
   measurement — it would have shown a perfectly flat thread graph across every
   panic. All three now have verbatim-bytes fixtures, and the thread count is
   cross-checked against `top` (17 `ps -AM` lines = 16 threads).
6. **The error ring rotated by `rm b; mv a b; open(a, "w")`.** CodeQL's
   `js/file-system-race` caught it and was right: between the rename and the
   open, anything may create `a`, including a symlink, and `open(a, "w")`
   follows it. Demonstrated rather than argued — planting a symlink and running
   both flag sets, the old one writes through to the victim and the new one
   refuses with `EEXIST`. Rotation is now by fresh unique name with
   `O_EXCL | O_NOFOLLOW`, which cannot be raced and never renames a file out
   from under a reader.

---

## 9. Reproduce it

```bash
# The panic reports (the important one, and the directory that hides them):
ls -la /Library/Logs/DiagnosticReports/Retired/*.panic

# The whole finding, in one command:
bun src/Core.TypeScript/forensics/macos-panic-capture.ts triage

# The blackout, the ring, the decode, the grouping — all falsifiable offline:
bun test src/Core.TypeScript/forensics/

# The store is NOT empty and needs NO sudo:
log show --start "2026-08-23 21:30:00" --style compact | head

# APFS clone: 303 MB "copied" for ~0 bytes.
before=$(df -k /System/Volumes/Data | tail -1 | awk '{print $3}')
cp -c -R <some.logarchive>/dsc /tmp/clonetest
after=$(df -k /System/Volumes/Data | tail -1 | awk '{print $3}')
echo "du says $(du -sh /tmp/clonetest); df delta $((after-before)) KB"
```

---

## Pointers

- `src/Core.TypeScript/forensics/` — harness, decoders, 67 tests
- `docs/runbooks/macos-unclean-reboot.md` — the two-minutes-after-boot procedure
- `docs/research/2026-08-15-139-and-134-are-signal-deaths-*.md` — the series this continues; §2c's hypothesis table is the one §5 updates
- `src/Core.TypeScript/hygiene/signal-death.ts` — a process killed by a signal did not answer a question; `findPanicReports` is the same rule for directories
- `.claude/rules/numerology-vs-number-theory.md` — §3's refusal to name two integers, and §5's own triage
- `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` — "panicked in Cursor" is a fact; "Cursor did it" is a verdict the mechanism may not issue
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — §5 is labelled hypothesis, not result
- XNU `osfmk/arm/pmap.c` / `pmap_data.c` (Apple, open source) — the two assertions
- Schroeder, Pinheiro & Weber, *DRAM Errors in the Wild* (SIGMETRICS 2009) — the 08-15 anchor, still the alternative §5 must beat
- Goguen & Meseguer 1982, *Security Policies and Security Models* — noninterference; a page recycled under a live mapping is the least declared channel there is
