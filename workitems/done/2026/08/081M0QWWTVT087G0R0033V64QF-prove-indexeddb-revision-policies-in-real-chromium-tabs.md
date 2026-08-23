---
id: 081M0QWWTVT087G0R0033V64QF
type: task
state: done
priority: P2
slug: prove-indexeddb-revision-policies-in-real-chromium-tabs
title: "Prove IndexedDB revision policies in real Chromium tabs"
created: 2026-08-23T18:07:32.218Z
completed: 2026-08-23T18:47:14.000Z
depends_on: []
composes_with: []
---

# Prove IndexedDB revision policies in real Chromium tabs

## Context

The native IndexedDB checkpoint adapter currently embeds monotone
last-writer-wins revision handling, while the in-memory adapter uses strict
compare-and-swap. Both behaviors are intentional, but the native adapter does
not expose the choice through its hexagonal boundary and the policy difference
is not exercised against real browser transactions.

## Acceptance

- `NativeIndexedDbCheckpointOptions` accepts an injected `RevisionPolicyPort`.
- Omitting the policy preserves monotone last-writer-wins behavior.
- One deterministic transcript runs the same history in two real Chromium tabs
  against compare-and-swap and monotone last-writer-wins.
- Both policies serialize a concurrent same-revision fork to one accepted write
  and one typed revision conflict.
- The transcript demonstrates the intentional difference for revision gaps and
  recreation after deletion.
- Failures are returned as typed feedback and the transcript validator rejects
  a missing policy or a falsified compare-and-swap result.

## Verification

- `bun test src/Core.TypeScript/browser-node/browser-revision-policy-smoke.test.ts src/Core.TypeScript/browser-node/browser-indexeddb-checkpoint.test.ts src/Core.TypeScript/browser-node/browser-checkpoint-port.test.ts` — 16 passed.
- `bun run test:browser-revision-policy` — both real two-tab policy histories passed; 10 consecutive runs also passed.
- `bunx tsc --noEmit --pretty false` — passed.
- `bun run lint:typescript` — passed.
- `bun run preflight` — release build, full .NET tests, and every language lint passed. Its sole initial failure was the pre-existing stale OP token shell reference repaired on main by PR #14366; after rebasing, `auto-vivify --check` reports zero dangling references.
- `bun run preflight:quick` after rebasing onto PR #14366 — all 13 checks passed.

## Resolution

`NativeIndexedDbCheckpointOptions` now accepts the owned `RevisionPolicyPort`.
The omitted option still selects monotone last-writer-wins. The browser fixture
runs an explicit compare-and-swap port and the default port through the same
IndexedDB transaction history in two Chromium tabs, including a concurrent
same-revision fork, idempotence, stale writes, a revision gap, deletion, and
recreation. Typed transcript validation captures the shared laws and the two
intentional policy differences without relying on the in-memory adapter.
