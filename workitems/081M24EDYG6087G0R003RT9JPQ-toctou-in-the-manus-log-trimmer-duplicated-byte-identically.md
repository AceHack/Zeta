---
id: 081M24EDYG6087G0R003RT9JPQ
type: bug
state: backlog
priority: P2
slug: toctou-in-the-manus-log-trimmer-duplicated-byte-identically
title: "TOCTOU in the Manus log-trimmer duplicated byte-identically across two vite configs"
created: 2026-09-10T01:20:33.798Z
depends_on: []
composes_with: []
---

# TOCTOU in the Manus log-trimmer duplicated byte-identically across two vite configs

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M24EDYG6087G0R003RT9JPQ-*.md` glob. -->

## What was open

Four `js/file-system-race` alerts (high), and they are two alerts twice:

| alert | file                                    | line | call            |
| ----- | --------------------------------------- | ---- | --------------- |
| 558   | `src/Renderers/website/vite.config.ts`  | 46   | `writeFileSync` |
| 557   | `src/Renderers/website/vite.config.ts`  | 33   | `readFileSync`  |
| 577   | `demo/identity-dla-site/vite.config.ts` | 46   | `writeFileSync` |
| 576   | `demo/identity-dla-site/vite.config.ts` | 33   | `readFileSync`  |

The two files were BYTE-IDENTICAL (`diff` was empty), so this is one defect with
two copies. `gate.yml` already records that the website copy is "a second, forked
copy of the identity-dla scaffold ... that NOTHING checked" -- and nothing keeps
the two in sync, so a fix applied to one and not the other is the natural
failure. Both are patched here, and they are still byte-identical afterwards.

## The exploit, demonstrated -- not asserted

CodeQL says "file system race". What that means concretely here is that
`trimLogFile` resolved `logPath` FOUR times -- `existsSync`, `statSync`,
`readFileSync`, `writeFileSync` -- and decided on the first two whether the
last one would truncate. So the write lands on whatever the NAME points at by
the time it runs, which need not be the file that was measured.

Run against a symlink, the old code truncates the target:

```
CONTROL (old code): victim 5890 -> 588
CONTROL truncated someone elses file: true

SUBJECT  (new code): warned: ELOOP
                     victim size before: 5890 after: 5890
                     victim UNTOUCHED: true
```

Same fixture both times: a 5890-byte file, and a `browserConsole.log` symlink
pointing at it. The old implementation followed the link and overwrote the
target with 588 bytes of trimmed log. The new one refuses to open it at all.

## The fix: one descriptor, opened once

- `openSync(logPath, O_RDWR | O_NOFOLLOW)` -- the path is resolved EXACTLY ONCE.
  Neither `O_CREAT` (this function must never bring a log into existence) nor
  `O_TRUNC` (it must never empty one before reading it).
- `fstatSync(fd)` rather than `statSync(path)`: the size that decides the trim is
  the size of the file this descriptor already holds open.
- `readSync(fd, ...)` then `ftruncateSync(fd, 0)` then `writeSync(fd, ...)` --
  every operation names the descriptor, so there is no window left to swap.
- `ensureLogDir` drops its `existsSync` guard: `mkdirSync(..., { recursive: true })`
  already succeeds when the directory exists, so the guard bought a second path
  lookup and no safety.

## Two defects the alert text did not name

**1. `catch {}` swallowed everything.** The old handler was
`catch { /* ignore trim errors */ }` -- a handler that cannot fail. A log that
had stopped trimming for any reason grew without limit and said nothing about
it. The new handler separates the one expected case (`ENOENT`: no log yet,
nothing to trim -- the do-then-interpret answer to "does it exist") from
everything else, which now warns with its errno.

**2. A short read would have appended uninitialised bytes.** `readSync` may
return fewer bytes than requested. Decoding the whole buffer regardless would
write the untouched tail of the allocation into the log it is trimming, so the
decode is bounded by `bytesRead`.

## Behaviour, checked case by case

```
1. missing file        -> ENOENT, returns quietly, and does NOT create the file
2. file under maxSize  -> untouched
3. file over maxSize   -> 4890 bytes -> 590; keeps line-499, drops line-0
4. symlinked path      -> ELOOP, target untouched (control above truncates it)
```

Case 1 matters twice: the old shape used `existsSync` to answer it, and the new
one must not silently substitute `O_CREAT` and start writing a log where there
was none.

Both sites still build: `pnpm run check` + `vite build` rc=0 for the website,
`identity-dla-pages-build.ts` (the entry the deploy itself runs) rc=0 for the
demo. `diff` between the two configs is still empty.

## Scope

Dev-server-only code -- the plugin runs under `configureServer`, so a production
`vite build` never reaches it. That lowers the severity and does not change the
disposition: the attack needs local write access to the project directory, which
is exactly what a developer machine running a dev server hands out.
