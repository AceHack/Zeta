---
id: 081M0AH404R087G0R002YRV4KA
type: task
state: backlog
priority: P2
slug: first-session-actions-have-no-durable-effect-journal-the-str
title: "first-session actions have no durable effect: journal the stranger's choices so the loop does what it claims"
created: 2026-08-18T13:31:36.472Z
depends_on: []
composes_with: []
---

# first-session actions have no durable effect: journal the stranger's choices so the loop does what it claims

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0AH404R087G0R002YRV4KA-*.md` glob. -->

## The gap

`simulateFirstSession` is pure, and five of the six action kinds had no durable
effect anywhere in the loop: `skip_credential`, `skip_optional_credentials`,
`offer_cloud_helpers`, `use_local_llm_only`, `complete_first_session` were state
transitions over a record discarded at process exit. The single durable artifact
was `writeMarker` — an ISO timestamp recording *that* first login finished and
nothing about *what happened in it*. A person who deliberately skipped GitHub and
a person who never reached the question left byte-identical evidence.

## What landed

- `first-session-journal.ts` — append-only JSONL fact log beside the marker.
  Every applied action is one durable, readable-back line. `replayFirstSession`
  folds it; `reconcileSessionRecord` combines it with a fresh probe.
- The conductor journals the **applied** action, never the chosen one, so a
  vendor-refused or downgraded setup cannot be recorded as a success.
- Fixed a fabrication the previous author had pinned as a KNOWN GAP: the
  already-complete short-circuit returned `defaultNodeSession()`, asserting
  all-credentials-missing on a machine nobody had looked at.

## Left stubbed, deliberately

- Credential acquisition stays delegated to external vendor CLIs.
- The journal is local, unsigned, unreplicated. Promoting a recorded choice to a
  claim peers should trust is an identity/attestation surface (ADR 2026-07-08).

Evidence: `first-session-journal.test.ts` (19 tests, all asserting artifacts on
disk); 9 mutants injected, 9 killed — one of which survived the first suite and
forced an extra test (the provider-downgrade path).
