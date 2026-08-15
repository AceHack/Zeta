---
id: 081M02NQBY7087G0R0030AAHZ7
type: bug
state: backlog
priority: P2
slug: two-of-nine-byte-lock-substrates-had-never-verified-anything
title: "Two of nine byte-lock substrates had never verified anything: Go was never built, Zig's artefact was an ar archive"
created: 2026-08-15T12:18:09.991Z
depends_on: []
composes_with: []
---

# Two of nine byte-lock substrates had never verified anything: Go was never built, Zig's artefact was an ar archive

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M02NQBY7087G0R0030AAHZ7-*.md` glob. -->

## The number

The byte-lock's claim is that N independent implementations agree byte-for-byte. The
roster lists **nine** substrates. On the last CI run before this change
([31326468275](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/31326468275),
2026-08-09) it reported `Summary: 7 PASS, 1 FAIL, 1 TOOLING-ABSENT` and
`Byte-lock DIVERGED — 1 of 8 executed substrate(s) disagree`.

**Seven substrates were actually comparing vectors.** The stated denominator was 8, and
the roster said 9. Nothing said so.

## The two dark substrates

1. **Go had never executed in CI.** `run-go-wasm.mjs` needs `dla-canonical-go.wasm`, which
   was neither committed (`git ls-files` did not list it) nor built by `bytelock.yml`
   (which installed only `wabt` and `lua5.4`). Every run reported TOOLING-ABSENT while
   `executed >= 2` stayed satisfied by the others. Found and filed, not fixed, by #10744.

2. **`dla-canonical-zig.wasm` was not a WebAssembly module.** It was an `ar` archive —
   `!<arch>\n` = `21 3c 61 72 63 68 3e 0a` — the unlinked `zig build-lib` intermediate,
   whose name collided with the two-step build's real output. Worse than the Go case: it
   **counted as executed**, padding the denominator, and its load error arrived through the
   same channel as a byte divergence, which this runner deliberately does not fail on. So
   the job went green for two weeks while printing `expected magic word 00 61 73 6d, found
   21 3c 61 72` on every run.

## Two more of the same shape, found while verifying the first two

3. **Every script substrate could fail in complete silence.** The run-error classifier
   matched the literal string `"Command failed"`, which `execSync` prefixes onto *every*
   non-zero exit — so a substrate that launched, ran and crashed was reported as
   "toolchain absent — NOT a divergence". Reproduced: `dla-canonical-source.js` replaced
   with a script writing to stderr and exiting 7 produced `TOOL JS (V8) (toolchain absent)`
   and `exit 0`, with node plainly installed since node was running the runner.

4. **The negative controls had never run.** `test-fault-injection.mjs` — the suite that
   proves this byte-lock can detect a fault at all — was referenced by no workflow. A
   negative-control suite that never executes is the identical defect one level up.

## Resolution

Both substrates **restored**, not removed, because both toolchains are pinned in this
repo's own `.mise.toml` (`go = "1.26.4"`, `zig = "0.13.0"`) and both artefacts were
verified to agree with the reference at seeds 1, 42, 100, 999.

- Zig: rebuilt single-step with `zig build-exe -fno-entry` (the command `.mise.toml`
  already documents), 1,314 bytes, committed; the `build-lib` + `wasm-ld` route that
  produced the archive is removed from `build-substrates.mjs`.
- Go: **built in CI** rather than committed — the artefact is ~1.9 MB and
  `src/wasm-dla/bytelock/.gitignore` already states that compiled substrates are not stored
  in the repo. Building from the committed 3.8 KB `dla-canonical.go` keeps the reviewable
  input text.
- New failure class **MALFORMED (exit 3)**: a substrate binary without the WebAssembly
  header is refused at load, excluded from `executed`, and stops the run.
- `BYTELOCK_MIN_SUBSTRATES` raised 2 → 9, equal to the roster, making the aggregate floor
  per-route by exhaustion.

## Related

- #10744 (open) — the scan-floor audit that filed both findings. Its
  `BYTELOCK_REQUIRED_SUBSTRATES` list is complementary and does not conflict: it catches a
  substrate that does not execute, this catches one that executes nothing while appearing
  to. Note its list names `Zig`, which the archive would have satisfied.
- `.claude/rules/no-binary-in-proof-lineage.md` — golden vectors here are text
  (`testdata/*.json`) and remain so; the compiled substrates are the implementations under
  test, not the evidence, so they sit outside the rule as written. The rule's *reason*
  still landed on us: an unreadable committed artefact was wrong for two weeks and no diff
  could show it.
