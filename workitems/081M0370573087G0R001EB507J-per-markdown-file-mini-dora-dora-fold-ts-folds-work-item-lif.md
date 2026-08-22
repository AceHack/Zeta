---
id: 081M0370573087G0R001EB507J
type: task
state: backlog
priority: P2
slug: per-markdown-file-mini-dora-dora-fold-ts-folds-work-item-lif
title: "Per-markdown-file mini-DORA: the DORA fold keys on workItemId, so it cannot answer questions about one .md file — generalise the fold's subject key and add a per-file execution event log so lead time, throughput and failure rate are computable per markdown file"
created: 2026-08-15T17:20:15.303Z
depends_on: []
composes_with:
  - 081M0370143087G0R003H36RDE
---

# Per-markdown-file mini-DORA

## What exists, read rather than assumed

`src/Core.TypeScript/work-items/dora-fold.ts` folds an append-only G-Set of
work-item events into `openByType`, a lead-time sample set with an average,
and a weekly throughput table. `src/Core.TypeScript/backlog/dora-metrics.ts`
is a 25-line CLI over it. Events are read by
`src/Core.TypeScript/work-items/read-events.ts` from a date-partitioned JSON
tree under workitems/events/.

Two things follow, and they point in opposite directions:

**The machinery generalises.** Append-only G-Set, Bag fold, date-partitioned
JSON, idempotent by construction — this is the right substrate and it is
already load-bearing. Nothing here needs replacing.

**The fold does not.** Every function keys on `workItemId`, and the event
vocabulary is the work-item lifecycle: `created`, `state-changed`, `closed`.
`isWorkItemEvent` rejects anything else at read time. So the answer to "does
per-file DORA extend the existing fold or need a separate one" is: **the
substrate extends, the fold does not** — the subject key and the event
vocabulary both have to be parameters, and today both are hardcoded.

## What Aaron asked for

*"query ability to see real-time observability feedback around the markdown
file and its execution over time. Like mini DORA metrics per markdown file."*

Note this is **not** the same thing as
081KSGS9H0008QG0R001K8VPV4 Capability 1, which is "runbook cells can query the
existing OpenTelemetry / Prometheus / logging stack" — that is the markdown
file as a *window onto* system telemetry. This is telemetry *about the file
itself*. They compose; they are not the same row, and reading one as the other
would leave the thing Aaron actually named unbuilt.

## The four DORA metrics, honestly mapped

The canonical four (Forsgren, Humble & Kim, *Accelerate*, 2018) do not map
cleanly, and pretending they do would be numerology.

| DORA metric | per-file analogue | honest? |
|---|---|---|
| deployment frequency | executions of this file per week | direct |
| lead time for changes | edit-to-first-successful-execution | direct |
| change failure rate | fraction of executions that failed | direct |
| time to restore | edit-that-broke-it to edit-that-fixed-it | plausible, unvalidated |

The first three are genuine. The fourth needs a definition of "broken" for a
markdown file that does not yet exist. Ship three; label the fourth as an open
question rather than shipping a number nobody can falsify.

## Shape

- An execution event type carrying: subject (the file's stable identity),
  block identity, outcome, effect record, timestamp.
- The subject key must be **content-addressed or ZetaId-minted**, not the
  path — a renamed file must not read as a new file, and
  `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` records the
  live instance of exactly this mistake (a sameness *detector* pressed into
  service as an identity *provider*).
- The fold parameterised over subject key and event vocabulary, with the
  work-item fold rewritten as one instantiation so the generalisation is
  proven by use rather than asserted.

## Acceptance

- [ ] Fold is parameterised; the existing work-item metrics are byte-identical
      before and after (that is the falsifier for "generalisation, not
      rewrite").
- [ ] Execution events are appended by the port from
      081M0370143087G0R003H36RDE.
- [ ] Three metrics computable for a named markdown file.
- [ ] Time-to-restore is written down as an open question, not a number.

## Toy / metered

`unmetered` on arrival. It becomes `metered` when a file's reported failure
rate is checked against its actual execution log by an independent path.
