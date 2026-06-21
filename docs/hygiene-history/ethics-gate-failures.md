# Ethics & Safety Gate: Candidate Failure Log

This document serves as the "honesty dashboard" for candidates that fail the AI
ethics and safety gate. The slice that creates this log is tracked at
[`docs/backlog/P1/081KDVGZGE008QG0R001Z656SG-candidate-failure-honesty-log.md`](../backlog/P1/081KDVGZGE008QG0R001Z656SG-candidate-failure-honesty-log.md),
landing under the broader research track at
[`docs/backlog/P1/081KQ3HBZ0008QG0R002S674CG-ai-ethics-and-safety-research-track.md`](../backlog/P1/081KQ3HBZ0008QG0R002S674CG-ai-ethics-and-safety-research-track.md).

The purpose of this log is to ensure transparency and accountability. Failed
candidates are not silently dropped but are recorded here as failure-data.
This extends the three-filter discipline into the ethics axis.

Append-only. Same discipline as
[`docs/hygiene-history/loop-tick-history.md`](loop-tick-history.md),
[`docs/hygiene-history/issue-triage-history.md`](issue-triage-history.md), and
[`docs/hygiene-history/cross-platform-parity-history.md`](cross-platform-parity-history.md).
Rows are added; never edited; never deleted. Corrections land as new rows
referencing the prior row, per retraction-native discipline.

## Schema — one row per failed candidate

| date (UTC ISO8601) | candidate | reason | reviewer |

- **date** — `YYYY-MM-DDTHH:MM:SSZ` at the point the row is written.
- **candidate** — short identifier for the candidate evaluated (skill name,
  rule slug, persona handle, B-NNNN row, PR number, etc.).
- **reason** — concise classification of why the candidate failed the ethics
  and safety gate. Cite the specific clause / rule / invariant violated when
  possible.
- **reviewer** — agent or human who recorded the failure (e.g.,
  `Otto-CLI`, `Lior (Gemini)`, `AceHack`).

## Failure Log

| Date | Candidate | Reason for Failure | Reviewer |
|---|---|---|---|
| | | | |
