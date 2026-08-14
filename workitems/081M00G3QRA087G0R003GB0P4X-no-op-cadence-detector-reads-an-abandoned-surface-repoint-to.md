---
id: 081M00G3QRA087G0R003GB0P4X
type: bug
state: backlog
priority: P2
slug: no-op-cadence-detector-reads-an-abandoned-surface-repoint-to
title: "no-op-cadence detector reads an abandoned surface: repoint to data/tick-shards or retire"
created: 2026-08-14T16:01:34.986Z
depends_on: []
composes_with: []
---

# no-op-cadence detector reads an abandoned surface: repoint to data/tick-shards or retire

Successor to 081M0085XQT087G0R003W4KFS4 (#10595 filed it, #10616 landed
`--enforce`). That work made the exit code *able* to carry a detection. This
item carries what the calibration then found, and the one decision left.

## What was measured (CHECKED — computed, not inferred)

#10616 recorded "30 windows, 23 fires, rate 0.767" and correctly declined to
arm enforcement on it. That number is real, and it is **not** a fleet
behaviour — it is a parse mismatch.

`isMinimalObservation` classified a shard by
`firstLine.split("|")[4].length < 600` — the summary *cell* of a markdown
table row. Across the 1209 real shards in `docs/hygiene-history/ticks/`:

| class | n | share | classified |
|---|---|---|---|
| heading-format (`# Tick shard …`), no 5th pipe field → `body = ""` | 488 | 40.4% | **forced MINIMAL** |
| pipe row, summary cell < 600 chars (i.e. any normal table cell) | 395 | 32.7% | **MINIMAL** |
| pipe row, cell >= 600 chars → regex actually consulted | 326 | 27.0% | judged |

The forced-minimal class has a **median size of 3843 bytes** — larger than the
median of the class the code was willing to call non-minimal. The detector was
most confident about its largest shards.

**False-positive rate, two independent methods:**

1. **Commit ground truth** (CLAUDE.md's own externalized idle counter). Dated
   git history and tick shards overlap on only 2026-05-28/29 → 48 hourly
   windows. The detector fired on **48 of 48**, and **29 of those firings
   (60.4%)** coincided with substantive non-telemetry commits landing.
2. **Content.** Of the 890 shards called "minimal", **622 (69.9%)** were
   >=1500 bytes with no minimal-observation language anywhere in the file.

A first attempt at method 1 over all of May returned 8.5% and was **discarded
as vacuous**: git committer/author dates in this clone only reach back to
2026-05-28, so every earlier window scored "0 commits" from absent data rather
than from an idle fleet. Recording the discard because the broken version of
the measurement looks exactly like the working one.

## The repair (landed with this item)

Narrowed to the two signals the data supports: explicit minimal-observation
language, or a genuinely near-empty shard (content floor, any format). The
pipe-cell length proxy is gone. Flag rate 73.6% → 3.1%; the same May window
sample goes 0.767 → 0.000. Reverting the parse fix reproduces 0.767 exactly
and turns the regression guard red.

## The decision this item exists for

**`docs/hygiene-history/ticks/` has been dead since 2026-05-29** (77 days at
filing). A live run finds zero shards and judges nothing — and until this item
that exited 0, i.e. reported success because its input had vanished. That is
now `surfaceEmpty`, which `--enforce` treats as failure.

Live ticks land in **`data/tick-shards/**/*.json`** (586 shards, current) as
JSON telemetry: `t`, `last_agent`, `last_action`, `ticks_24h`, … **with no
prose body.** So the two halves do not port equally:

- **gap / shard-density** — portable. "Most recent shard is N minutes old"
  needs only a timestamp, and this is the half that actually mechanises the
  heartbeat-via-commit discipline.
- **minimal-observation** — **not** portable. There is no text on the live
  surface to classify. It would have to be reconstructed from the telemetry
  fields, or dropped.

Three honest options:

1. **Repoint the gap half at `data/tick-shards/`, drop the prose half.** The
   detector then claims less and can actually see the fleet.
2. **Retire the tool.** If `heartbeat/*` refs + `audit-agencysignature-main-tip`
   already cover liveness, this is a second instrument for one question.
3. **Revive the prose surface.** Only if something still writes it.

Not chosen here: picking one is a routing call about where tick liveness is
supposed to live, and that is not a call to make inside a bug fix.

## Why enforcement is still NOT armed

Sensitivity is unmeasured. There is no labelled set of known standing-by
windows, so the repair is demonstrated to cut false positives and is **not**
demonstrated to retain true ones — post-repair it fires on 0 of the 48
overlap windows, including the 19 with no commits, which may be under-detection.
Per `toy-is-free-metered-must-be-earned` this detector remains **unmetered**.
Arming `--enforce` against a dead surface would also be theater.

## Acceptance

- The routing decision above is made and recorded.
- If (1): the gap check runs against the live surface and a planted stale
  stream makes it report failure.
- If (2): the tool is removed and the liveness question is pointed at its
  real owner.
- Sensitivity measured against labelled standing-by windows before any
  blocking mode is armed.

## Pointers

- `src/Core.TypeScript/hygiene/check-no-op-cadence-pattern.ts` — MEASURED
  CALIBRATION header block + `isMinimalObservation`
- `src/Core.TypeScript/hygiene/check-no-op-cadence-pattern.test.ts` — 7 mutants
- `docs/AUTONOMOUS-LOOP.md` Check 0a — the tool's only live invocation path
- `data/tick-shards/`, `data/tick-history.json` — the live surface
- 081M0085XQT087G0R003W4KFS4 (#10595 / #10616) — predecessor
- `.claude/rules/toy-is-free-metered-must-be-earned.md`
