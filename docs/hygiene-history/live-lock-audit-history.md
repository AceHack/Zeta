# Live-lock audit history

Per-run log of `tools/audit/live-lock-audit.sh` — a cadence audit
that classifies the last N commits on `origin/main` into three
buckets (external / internal-factory / speculative) and flags the
live-lock smell when the external ratio is too low.

**The smell:** Aaron, 2026-04-23:

> on some cadence look at the last few things that went into master
> and make sure its not overwhelemginly speculative. thats a smell
> that our software factor is live locked.

**Mechanism:** A factory producing only process / research /
meta-factory / tick-history / BACKLOG-row work — without external-
observable product progress (src/ changes, sample improvements,
test landings, UI progress) — is *live-locked*: every worker is
busy, every tick fires, nothing external moves.

**Healthy threshold:** EXT ≥ 20% of a rolling 25-commit window.
Tunable via `LIVELOCK_MIN_EXT_PCT` env var.

**Classification rules:**

- `EXT` — file touched under `src/`, `tests/`, `samples/`, `bench/`
- `INTL` — file touched under `docs/ROUND-HISTORY`, `docs/hygiene-history/`,
  `.claude/`, `docs/BACKLOG` (factory-meta work)
- `SPEC` — file touched under `docs/research/`, `memory/`,
  `docs/DECISIONS/` (speculative / decision)
- `OTHR` — uncategorised (mixed / boundary)

The full memory context is
`memory/project_aaron_external_priority_stack_and_live_lock_smell_2026_04_23.md`.

## Log

| date (UTC) | window | EXT | INTL | SPEC | OTHR | smell? | notes |
|---|---:|---:|---:|---:|---:|---|---|
| 2026-04-23 | 25 | 0% | 72% | 16% | 12% | **FIRING** | Inaugural run. Last 25 merged commits on `origin/main` contain zero src/tests/samples/bench changes. Factory has been running purely on tick-history + BACKLOG + research output for weeks. Response arc: PR #141 (ServiceTitan CRM demo sample) is the pattern-breaker; once #141 merges, the next audit should show non-zero EXT. Audit script landed this run. |

## Lessons integrated

Per `memory/feedback_lesson_permanence_is_how_we_beat_arc3_and_dora_2026_04_23.md`,
every live-lock firing files a lesson here. Each lesson names the
**signature** (what pattern preceded the smell), the **mechanism**
(what caused it), and the **prevention** (what decisions avoid
re-occurrence). Consult this section before opening a speculative arc
— prevention is upstream of detection.

### 2026-04-23 — tick-history-and-BACKLOG-dominance-with-zero-src

- **Signature.** 25 consecutive merged commits on `origin/main` with
  exactly zero changes to `src/`, `tests/`, `samples/`, or `bench/`.
  Every commit was either a tick-history row, a BACKLOG row, a
  research doc, a capability-map, or an ADR. No external-observable
  product motion.
- **Mechanism.** The autonomous-loop cron fires every minute per
  `docs/AUTONOMOUS-LOOP.md`. The standing never-idle discipline
  (`memory/feedback_never_idle_speculative_work_over_waiting.md`)
  says speculative work is valid non-idle. But there was no
  counter-balancing force pulling the loop toward external-code
  work. Every tick, the lowest-friction move was another
  tick-history append or BACKLOG grooming. Compounded over dozens of
  ticks, the factory drifted into pure meta-work without any agent
  catching the drift.
- **Prevention (decisions to embed forward).**
  1. **External-priority stack is authoritative, agent-reorderable
     only for internal priorities.**
     `memory/project_aaron_external_priority_stack_and_live_lock_smell_2026_04_23.md`
     names Aaron's stack (ServiceTitan+UI / Aurora / multi-algebra
     DB / cutting-edge persistence) as externally-set; the agent
     owns internal priorities but not the external stack's
     ordering. Speculative work lives under internal;
     external-priority work takes precedence when the ratio tilts.
  2. **Live-lock audit runs at round-close as a gate-not-a-report.**
     `tools/audit/live-lock-audit.sh` exits 1 when EXT < 20%;
     round-close should check this signal. A smell-firing
     round-close must include at least one external-priority
     increment in the next round's plan before the close ledger
     accepts.
  3. **Speculative-work permit requires external-ratio check.**
     Before opening a new speculative arc (research doc, large
     BACKLOG row, capability map), agent reads the current audit
     ratio. If smell is firing, no new speculative arcs open until
     one external-priority increment lands. This is an *agent-
     internal discipline*, not a blocking rule — but it gets cited
     in the commit message ("audit EXT=X%, smell=not-firing,
     speculative arc opens") so the discipline is visible.
  4. **Tick-history rows are NOT external work.** The tick-history
     append is ledger-keeping, not product motion. Counting it as
     "forward motion" was the silent-drift mechanism. Agents
     should explicitly describe tick-history work as INTL and
     pair it with EXT work in the same tick when the smell is
     near firing.
- **Open carry-forward.** The round-close-ladder wiring is a
  follow-up — the audit script is landed, but it is not yet
  invoked automatically at round-close. BACKLOG P1 row filed.
