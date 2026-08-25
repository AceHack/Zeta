# Runbook — the machine rebooted and nobody asked it to

**Scope:** macOS only. **Elevation:** none — no step here needs `sudo`, and none
should ever raise a biometric prompt. **Clock:** the first two steps are
time-critical; everything else can wait.

> **Why the hurry.** `/var/db/diagnostics/Persist` is a fixed 509 MB ring. Under
> agent load it fills at ~130 MB/hour, so it holds **under four hours** of
> history — the window shrinks exactly when the machine is in the state you
> want to look at. A crash investigated the next morning is a crash whose
> evidence was overwritten by the investigating machine. This is measured, not
> assumed: `macos-panic-capture triage` prints the current retention.

---

## 0. Two minutes after boot — run this first

```bash
cd <your clone>
bun src/Core.TypeScript/forensics/macos-panic-capture.ts triage
```

It prints, and writes to `~/zeta-forensics/reports/`:

- whether this boot was **clean or unclean** (a clean one has a `shutdown time`
  record immediately before it in `last reboot shutdown`; an unclean one does not)
- the **exact panic instant**, decoded from the NVRAM `panicmedic-timestamps`
  key, cross-checked against the copy embedded in `panicmedic-telemetry`
- the **blackout**: how many seconds of machine-alive time never reached disk
- every **kernel panic report**, parsed, **including the ones in `Retired/`**
- how many **hours of log history remain** before the ring overwrites it

Then, immediately:

```bash
bun src/Core.TypeScript/forensics/macos-panic-capture.ts archive --last 3h --label post-crash
bun src/Core.TypeScript/forensics/macos-panic-capture.ts snapshot
```

The archive is the one irreversible step. Everything below can be done later
from the artifacts; nothing below can be done at all if the ring rolls first.

---

## 1. Read the panic report — it is usually there, and usually in `Retired/`

```bash
ls -la /Library/Logs/DiagnosticReports/Retired/*.panic
```

**This directory is the whole lesson, and it has now caught two readers.** A
first investigation concluded "no `.panic` files"; there were three. Hours later
a second reader checked the same two top-level paths, concluded "panic files are
NOT landing on disk", and a human copied the report out of the crash dialog by
hand — while the file sat in `Retired/`.

**Measured retirement latency: under four minutes.** The 09:29 report was written
at `09:29:48` and was already in `Retired/` by `09:33`. A top-level glob will
essentially always miss. Always search recursively, or just run `triage`.

The format is **two JSON documents** — a one-line header, a newline, then the
body. `JSON.parse` on the whole file fails; `panic-log.ts` partitions at the
first newline.

What to read, in order:

| field | what it tells you |
|---|---|
| `panicString` first line | the assertion that fired, and `@file.c:line` |
| `Panicked task ... pid N: NAME` | the process on-CPU. **Suggestive, not a culprit** |
| `Kernel text exec base` | subtract from every `lr:` to get KASLR-independent offsets |
| `last started kext` | the most recently started kext, often unrelated |

**Always de-slide before comparing two panics.** Kernel addresses differ every
boot, so the same bug twice looks like two unrelated incidents until you
subtract the base. `groupPanics()` does this and groups by the *panic site*
(the top 8 frames), because two instances of one bug can reach it through
slightly different deep stacks — measured here: 25 of 26 frames identical,
diverging at frame 24.

---

## 2. Understand what you cannot recover, so you do not go looking for it

`logd` buffers in memory and flushes periodically. Whatever has not been
flushed when the machine dies never reached a disk and **is not in any archive,
ever**. Measured for the 2026-08-24 08:17 crash:

```
last persisted log line   08:16:36
panic (NVRAM panicmedic)  08:16:59.664
next boot (kern.boottime) 08:17:16.285
                          ------------------------
BLACKOUT                  23.6 s alive and unlogged
DOWN                      16.6 s
```

The machine spent **longer dying than rebooting**, and none of it is in the log.

So: `log collect` at boot **does** recover the previous boot's log — the store
is on disk and survives, and it is world-readable so it needs no `sudo` — but
it recovers it only **up to the last flush**. The final ~20-30 seconds is
structurally unrecoverable.

That is what the **vitals heartbeat** is for. It writes one NDJSON line per
second and `fsync`s it, so those seconds exist on disk while they are
happening:

```bash
bun src/Core.TypeScript/forensics/macos-panic-capture.ts vitals-tail \
    --around 2026-08-24T12:16:59Z --window 60
```

If it prints `NO SAMPLES`, that is **the absence of a measurement, not evidence
the machine was idle** — the heartbeat was not running, or it died before its
next `fsync`. The command exits 1 and says so rather than printing an empty
list that reads like calm.

---

## 3. The NVRAM keys, and what each is worth

```bash
nvram -p | grep panicmedic
```

| key | value |
|---|---|
| `panicmedic-timestamps` | `<slot>:<hex µs since epoch>`. **This is the exact panic instant.** |
| `panicmedic-telemetry` | binary; carries the same µs value at offsets 8 and 16 — the cross-check |
| `panicmedic-auxkc-present` | `true` = a third-party auxiliary kernel collection was loaded at panic time |

`0:659c9f687e920` → `0x659c9f687e920` → `1787573819664672` µs →
**2026-08-24 08:16:59.664**. The unit is pinned by two independent witnesses:
the duplicate inside `panicmedic-telemetry`, and `kern.boottime` landing 16.3 s
later. Read as nanoseconds it would be 1970; as seconds, the year 58608.

Two integers in the telemetry blob (`273` at offset 0, `321` at offset 24) are
**not decoded** and are reported as unknown. Naming a field from a
plausible-looking number is the numerology failure; these have no second
witness, so they stay unknown.

**NVRAM holds the most recent panic only.** Snapshot it before it is
overwritten — which the boot agent does automatically.

---

## 4. Correlate with load — and be willing to be refuted

```bash
bun src/Core.TypeScript/forensics/macos-panic-capture.ts vitals-tail \
    --around <panic-iso> --window 120
```

Each line carries load average, total process count, per-harness counts
(`bun`/`node`/`dotnet`/`git`/`rg`/`tsc`/`clang`/`fsc`/`claude`), free and
compressed pages, swap, and `kern.num_files` against `kern.maxfiles`.

The fd figure is there because it is one of the few resources on this machine
with a **hard ceiling**: 65536, with ~13.4k consumed at idle. It does not by
itself panic a kernel and this harness does not claim it does — but its
trajectory into a crash is worth having.

**What the data said the first time it was asked (2026-08-24):** the load
hypothesis was *not* confirmed. No `bun`, `node`, `dotnet`, `git`, `claude` or
`forge` process appears in any of the three panic reports. All three panicked
in **Cursor**. Record that kind of result as loudly as a confirmation.

---

## 5. Preserve, then decide

Nothing in this runbook changes a system or security setting. Unloading a kext,
adding a Defender exclusion, or touching `csrutil` are the maintainer's calls
and belong in a separate, deliberate decision — not in the two minutes after a
crash, and not by an agent.

---

## 6. Standing capture (install once)

```bash
# Dry run first — prints the launchd agents without writing anything.
bun src/Core.TypeScript/forensics/macos-panic-capture.ts install

# Then, if you want them (USER agents; no sudo, no biometric prompt):
bun src/Core.TypeScript/forensics/macos-panic-capture.ts install --write
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.zeta.forensics.boot.plist
# ... one per agent; the command prints the full list.
```

Five agents: `boot` (at login), `vitals` (continuous), `snapshot` (15 min),
`archive` (6 h), `prune` (12 h). All `ProcessType=Background`, `LowPriorityIO`,
`Nice=5` — the capture must never become the load it is measuring.

Removal is one command per agent and is printed alongside the install.

**Disk:** ~580 MB/day growing, ~4 GB at 7-day retention with the default
`--keep-archives 6`, plus a one-time ~447 MB shared symbol catalog. Check it
yourself any time with `macos-panic-capture.ts cost`, which reads the sizes off
the artifacts on disk rather than reciting these numbers.

---

## Pointers

- `src/Core.TypeScript/forensics/macos-panic-capture.ts` — the harness
- `src/Core.TypeScript/forensics/panic-log.ts` — panic parsing, de-sliding, grouping
- `src/Core.TypeScript/forensics/panicmedic.ts` — NVRAM decode + clean/unclean classification
- `src/Core.TypeScript/forensics/log-store-retention.ts` — blackout and ring math
- `docs/research/2026-08-24-three-unclean-reboots-are-kernel-pmap-refcount-panics-not-agent-load.md` — the findings
- `docs/research/2026-08-15-139-and-134-are-signal-deaths-147-of-them-in-one-week-on-one-machine.md` — the series this continues
- `src/Core.TypeScript/hygiene/signal-death.ts` — a process killed by a signal did not answer a question
