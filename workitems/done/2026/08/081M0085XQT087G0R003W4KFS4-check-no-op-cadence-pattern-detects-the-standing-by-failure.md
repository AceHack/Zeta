---
id: 081M0085XQT087G0R003W4KFS4
type: bug
state: done
priority: P2
slug: check-no-op-cadence-pattern-detects-the-standing-by-failure
title: "check-no-op-cadence-pattern detects the standing-by failure and returns 0 on every path"
created: 2026-08-14T13:42:58.042Z
completed: 2026-08-14T15:26:40.700Z
depends_on: []
composes_with: []
---

# check-no-op-cadence-pattern detects the standing-by failure and returns 0 on every path

`src/Core.TypeScript/hygiene/check-no-op-cadence-pattern.ts` is the mechanical
detector for the no-op-cadence / standing-by failure mode — the one the
heartbeat-via-commit rule in `CLAUDE.md` calls *the* failure. It computes the
answer correctly and then throws it away.

## The defect (CHECKED — read, not inferred)

`main()` is 360 lines and contains exactly **three** `return` statements:

| line | statement | reached when |
|---|---|---|
| 259 | `return 0` | no shards in window — nothing to check |
| 355 | `return 0` | **every other path, including both detections** |

Line 266 `if (result.thresholdHit)` prints:

```
WARNING: no-op-cadence pattern detected — N/M recent ticks are minimal-observation.
```

Line 307 `if (result.gapHit)` prints:

```
WARNING: missing-shard-cadence detected — most recent shard is N minutes old, exceeding threshold M.
```

Both fall through to `return 0` at line 355, and the entrypoint is
`process.exit(main())`. **The process exits 0 when the pattern is detected and 0
when it is not.** The exit code carries no information; the two `WARNING:` lines
go to stderr where no caller inspects them.

## Also: it is wired to nothing

CHECKED across `.github/workflows/`: no workflow invokes it. So the warnings are
not merely unread by an exit code — they are not produced in CI at all. The
detector runs only if a human or agent runs it by hand, and then reports success
either way.

## Why this one matters more than its size

It is the fifth vacuity found on 2026-08-14, after `verifyLandauer` (`x >= x`),
the all-`unsat` SMT runners, 12-of-15 unopened TLC configs, and the
AgencySignature audit that exempted the fleet's own personas
(081M003VH9B087G0R002WXK2HD / #10564 / #10573). Those four verify *properties*
and *provenance*.

This one is aimed at **the shadow's own conduct** — it exists to catch the tick
loop reporting "Quiet." while producing nothing. An instrument for detecting
"you did nothing" that itself does nothing is the failure mode wearing its own
detector as a costume, and it means every clean run of this check to date was
uninformative rather than reassuring.

## The judgement call this needs (why it is filed, not unilaterally fixed)

Unlike the other four, the right fix is **not** obviously "make it exit 1".

- The two detections are **heuristics** with env-tunable thresholds
  (`NO_OP_CHECK_THRESHOLD` default 5 of a 7-shard window;
  `NO_OP_CHECK_GAP_MINUTES` default 15). A heuristic promoted to a blocking gate
  is a different thing from a tautology repaired.
- The script's own text says the warning is meant to fire "at decision-time" —
  i.e. it may have been designed as an **advisory** for the agent reading its
  own output, not as a gate. If so the defect is narrower: the advisory is
  unreachable because nothing runs it.

So the decision is which of these it should be, and that is a routing call:

1. **Advisory, wired** — keep exit 0, but run it in the tick lane and surface the
   warning where the agent actually reads it. Smallest change; still leaves an
   exit code that cannot discriminate.
2. **Opt-in enforcement** — add `--enforce` so the exit code CAN carry the
   detection, wire it non-blocking first, then decide on blocking once the
   false-positive rate is measured against real tick history. Reversible.
3. **Blocking** — exit 1 on detection by default. Strongest, and premature until
   somebody has measured how often the thresholds fire on healthy days.

Recommendation: **(2)**, because it is the option that makes the check *able* to
fail without asserting a threshold nobody has calibrated — and because the
calibration is then itself measurable. Per `toy-is-free-metered-must-be-earned`,
this detector is currently **unmetered**: implemented, used, never falsified.

## Pre-start checklist

- **Substrate-drift:** primary artefact `src/Core.TypeScript/hygiene/check-no-op-cadence-pattern.ts` exists. Acceptance bullets are **not** met — `main()` still returns 0 on every path, no `--enforce`, no test file, no workflow invocation. This is work, not drift. #10595 filed the item only.
- **Prior-art search:** in-repo `--enforce` pattern already exists (`audit-orphan-role-refs.ts`, `check-bash-retirement-inventory.ts`, `audit-memory-references.ts`): default advisory, `--enforce` makes detection fatal, unknown flags rejected. Same shape here. No competing PR or `origin/claim/*` for this id.
- **Depends-on:** none. Composes with 081M003VH9B087G0R002WXK2HD (sibling vacuity, already closed).
- **Calibration surface honesty:** the detector reads `docs/hygiene-history/ticks/`, not `docs/agent-heartbeats/`. Measuring against the latter would be a check of a different filename schema. Measure against the surface the heuristic actually classifies.

## Acceptance

- A planted tick history exhibiting the pattern makes the check report failure
  (whatever form (1)/(2)/(3) takes), and a healthy history does not. Mutation:
  the falsifier must go red when the detection branch is removed.
- The false-positive rate is measured against real `docs/agent-heartbeats/`
  shard history before any blocking mode is armed.
- If it stays advisory, it is invoked somewhere that reads it — an advisory
  nothing runs is the same defect in a quieter register.

## Resolution (2026-08-14)

Option (2) landed. `parseCli` / `exitStatus` / `detected` make the exit
code *able* to carry a detection. Default remains advisory (exit 0).
`--enforce` exits 1 on threshold or gap. Unknown flags exit 2.

- Falsifier: `check-no-op-cadence-pattern.test.ts`. A planted 5-of-7
  short-body window + `--enforce` is 1; the same window without the
  flag is 0; a healthy 7-of-7 long-body window is 0 either way.
  Removing `enforce &&` or forcing `return 0` turns those tests red.
- Calibration, measured not asserted: May 2026, 18:00Z sample,
  `docs/hygiene-history/ticks/` (the surface the heuristic actually
  reads). **30 windows, 23 fires, rate 0.767.** That is why
  `--enforce` is not a required gate — promoting an uncalibrated
  heuristic that fires on three-quarters of a dense month would be a
  different act from repairing the vacuity.
- Invocation: the new test file runs in
  `bun test src/Core.TypeScript/hygiene/` (gate job
  "lint (bash retirement inventory + hygiene unit tests)").
  `docs/AUTONOMOUS-LOOP.md` Check 0a now points at the real path
  (`src/Core.TypeScript/hygiene/…`, not the deleted
  `tools/hygiene/…`) so a tick-start agent can actually run it.

`--enforce` is **not** added to branch protection or `gate.yml`.
Arming it is a later call that uses the 0.767 measurement.

## Pointers

- `src/Core.TypeScript/hygiene/check-no-op-cadence-pattern.ts` — lines 242–356
- `CLAUDE.md` "Heartbeat-via-commit = externalized idle counter" — the discipline
  this detector mechanises
- `.claude/rules.bak/holding-without-named-dependency-is-standing-by-failure.md`
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — toy / **unmetered** / metered
- 081M003VH9B087G0R002WXK2HD (#10564, fixed by #10573) — the sibling finding;
  #10594 wires the AgencySignature instruments into CI for the same
  "the tooling existed and ran nowhere" reason
- `src/Core.TypeScript/hygiene/mutation-runner.ts` — the mechanical falsifier check
