---
id: 081M0QBQ2YZ087G0R001S8XJ7S
type: bug
state: backlog
priority: P1
slug: main-is-red-lint-ts-fails-on-src-apps-twitch-ai-src-swarm-wo
title: "main is red: lint (TS) fails on src/apps/twitch-ai/src/swarm.worker.ts since the post-revert restore"
created: 2026-08-23T13:07:18.111Z
depends_on: []
composes_with: []
---

# main is red: lint (TS) fails on src/apps/twitch-ai/src/swarm.worker.ts since the post-revert restore

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QBQ2YZ087G0R001S8XJ7S-*.md` glob. -->

## Not mine, but it blocks everyone

`gate (required)` is failing on `main`, so **no PR can auto-merge** until it is repaired.
Found while shipping the zetadb port-conformance work (#14166); recorded rather than
fixed, because repairing it is a content decision inside an app this observer has no
context for, and burying it in an unrelated fix PR would make that diff dishonest.

## The failure

```
src/apps/twitch-ai/src/swarm.worker.ts(40,24): error TS2345:
  Argument of type '{ apiKey: any; baseUrl: any; model: string; }'
  is not assignable to parameter of type 'number'.
✗ TypeScript type check: tsc: exited with code 2
```

Reproduced locally with `node node_modules/typescript/bin/tsc --noEmit` — a single error,
nothing else in the tree.

The call site:

```ts
await swarm.init({
  apiKey: payload.apiKey,
  baseUrl: payload.baseUrl || "https://api.openai.com",
  model: "gpt-4o-mini"
});
```

`SwarmController.init` takes a `number`. Either the call site or the signature is from a
different generation of the code.

## Provenance

Introduced by `3d40e4589` — *"feat: restore twitch-ai and mutual-sim after revert (#14159)"*
— which restored content that had been removed by `07e9530c4`, the revert of the
mutual-simulation PR that deleted 1,063,105 lines. A restore-after-revert is exactly where
a call site and its signature drift apart, because the two halves can come back from
different points in history.

## Checked, not inferred

- `main` head run `32639819848` (`ba965f863`): `lint (TS)` FAILURE, same file, same line,
  same message.
- PR #14166 run `32640301000`, **before** it merged `main`: the same failure, from the
  merge commit.
- The file does not exist at `518499177`, so this postdates that commit entirely.

Also failing on `main` head, same runs, and likewise unrelated to this item: ten tests
under *"the measurement over `db/mutation-findings/`"* and *"the series is the same
statistic as `measure()`"*. PR #14173 ("fix(society): keep the sampling frame honest")
looks like it is aimed at those.

## Suggested fix

Reconcile `SwarmController.init`'s signature with its one caller. Whoever owns twitch-ai
should say which of the two is the intended generation — guessing here is how a restore
becomes a rewrite.
