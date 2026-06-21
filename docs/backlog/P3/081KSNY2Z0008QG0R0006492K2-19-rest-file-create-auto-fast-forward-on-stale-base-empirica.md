---
id: 081KSNY2Z0008QG0R0006492K2
priority: P3
status: open
title: REST file-create auto-fast-forward on stale base — empirical verification spike (operator hypothesis 2026-05-28)
effort: XS
ask: aaron 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSKBP80008QG0R000B3Y19A
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSNY2Z0008QG0R001K6HJ7Z
  - 081KSNY2Z0008QG0R003X1QWYG
tags:
  - github-rest-api-empirical-spike
  - put-repos-owner-repo-contents-path
  - auto-fast-forward-on-stale-base-hypothesis
  - composes-with-event-sourcing-no-pr
  - composes-with-github-actions-recursion
  - small-investigation-then-document
  - potential-extension-not-committed
---

## Operator hypothesis 2026-05-28

> *"it's like a rest push of one file i think it does fastforward in gh itslef"*

Operator's working hypothesis: GitHub's REST file-create API (`PUT /repos/{owner}/{repo}/contents/{path}`) may auto-fast-forward even when the local base is stale — the API takes (path, content, optional SHA-of-existing-file) and if SHA is omitted or matches, the create/update succeeds without requiring the caller to have fetched latest first.

If true, this sidesteps the stale-push problem entirely at write-time (no fetch-first needed) and composes with the ZetaID-named-files pattern (since each event has a unique filename, the file-create call always succeeds on first try because the path doesn't yet exist).

## What this row tracks

Empirical verification spike. Small investigation (1-2 hours):

1. Read [GitHub REST docs for `PUT /repos/{owner}/{repo}/contents/{path}`](https://docs.github.com/en/rest/repos/contents) carefully
2. Construct a test scenario: stale local clone + push new file via REST → verify behavior
3. Construct an adversarial scenario: stale local clone + concurrent write from second client → verify what wins
4. Document findings in a follow-up memo OR rule extension

## Acceptance criteria

- Memo at `docs/research/2026-05-28-rest-file-create-auto-fast-forward-empirical-finding.md` documenting:
  - The hypothesis
  - The test scenarios run
  - The observed behavior (with curl commands and response samples)
  - Composability with the event-sourcing pattern (081KSNY2Z0008QG0R001K6HJ7Z / 081KSNY2Z0008QG0R003X1QWYG)
  - Failure modes if any (rate limits; ref contention; concurrent-write resolution)
- If hypothesis holds: composes_with note added to 081KSNY2Z0008QG0R001K6HJ7Z + 081KSNY2Z0008QG0R003X1QWYG confirming REST-API path is preferred over git-push for event append
- If hypothesis fails: documentation of why, with workarounds

## Substrate-honest framing

POTENTIAL spike per operator standing direction. P3 because it's a small spike; outcome informs 081KSNY2Z0008QG0R001K6HJ7Z + 081KSNY2Z0008QG0R003X1QWYG implementation but doesn't block them.

## Full reasoning

`memory/kestrel/conversations/2026-05-28-kestrel-zetaid-128bit-structured-encoding-event-sourcing-without-pr-ceremony-otel-trace-composition-two-level-state-machine-aaron-forwarded.md` § "Operator's two end-clarifications" — clarification 2.
