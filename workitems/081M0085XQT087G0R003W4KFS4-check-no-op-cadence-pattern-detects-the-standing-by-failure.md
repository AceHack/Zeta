---
id: 081M0085XQT087G0R003W4KFS4
type: bug
state: backlog
priority: P2
slug: check-no-op-cadence-pattern-detects-the-standing-by-failure
title: "check-no-op-cadence-pattern detects the standing-by failure and returns 0 on every path"
created: 2026-08-14T13:42:58.042Z
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

## Acceptance

- A planted tick history exhibiting the pattern makes the check report failure
  (whatever form (1)/(2)/(3) takes), and a healthy history does not. Mutation:
  the falsifier must go red when the detection branch is removed.
- The false-positive rate is measured against real `docs/agent-heartbeats/`
  shard history before any blocking mode is armed.
- If it stays advisory, it is invoked somewhere that reads it — an advisory
  nothing runs is the same defect in a quieter register.

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
