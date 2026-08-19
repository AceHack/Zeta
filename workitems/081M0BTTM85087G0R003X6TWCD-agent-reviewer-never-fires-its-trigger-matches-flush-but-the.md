---
id: 081M0BTTM85087G0R003X6TWCD
type: bug
state: backlog
priority: P2
slug: agent-reviewer-never-fires-its-trigger-matches-flush-but-the
title: "agent-reviewer never fires: its trigger matches flush/ but the fleet produces heartbeat/<agent>-flush-<sha>"
created: 2026-08-19T01:40:29.573Z
depends_on: []
composes_with: []
---

# agent-reviewer never fires: its trigger matches flush/ but the fleet produces heartbeat/<agent>-flush-<sha>

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0BTTM85087G0R003X6TWCD-*.md` glob. -->
## The measurement

`agent-reviewer.yml` gates its only job on `if: startsWith(github.head_ref, 'flush/')`.
No branch the fleet produces starts with `flush/`. The live flush branches are minted
by `agent-heartbeat.yml` as `heartbeat/<agent>-flush-<source-sha>`.

Measured 2026-08-19 (not inferred from the source):

```
gh run list --workflow agent-reviewer.yml --limit 300 --json conclusion \
  --jq '[.[].conclusion] | group_by(.) | map({c: .[0], n: length})'
=> [{"c":"skipped","n":300}]

gh run list --workflow agent-reviewer.yml --limit 300 --json headBranch \
  --jq '[.[].headBranch | select(startswith("flush/"))] | unique'
=> []
```

Corroborating: no event in `docs/observe-events/` carries the attestor this
workflow writes, though 377 attestation events from the *other* (live) path exist.
The job has never executed on a real batch.

## Why it is filed rather than fixed

Re-pointing the trigger is not a one-line rename — it **arms an auto-approver**.
The moment the pattern matches, this workflow starts issuing `gh pr review --approve`
and pushing commits to flush branches on every heartbeat flush. That is a
consumer-visible change to the merge path and belongs to the architect + human
maintainer, not to a security fix landing inside the file.

The security fix that did land (producer/`by` binding, path validation, and the
removal of the false peer-attestation claim) deliberately did **not** touch the
trigger, so this item is what remains.

## Decide, in this order

1. **Should it be armed at all?** An approval from the repository's own
   `GITHUB_TOKEN` is not independent review. If the answer is no, delete the
   workflow rather than leaving a dormant auto-approver in the tree — a dormant
   approver is a loaded claim generator waiting for a branch rename.
2. **If yes**, re-point the trigger *and* the producer-extraction sed (which parses
   `flush/heartbeat-<agent>-...` and would emit `unknown` on the real names —
   now a hard failure rather than a silent "unknown produced these").
3. **Either way**, the independence gap stays open until a receipt is signed by a
   key the producer does not hold.

## Adjacent, found while measuring — worth its own look

Six live attestation events carry an `attestor` of `/tmp/attest-<random>` (a temp
path captured into an identity field by the `--attestor` call site in
`agent-heartbeat.yml`). `self-claims.ts` folds `distinctAttestors` from that field,
so filesystem paths are currently counted as distinct witnesses:

```
"attestor": "alexa"   141
"attestor": "otto"    127
"attestor": "soraya"  103
"attestor": "/tmp/attest-0rHTQr"  3
"attestor": "/tmp/attest-4EC3oi"  2
"attestor": "/tmp/attest-hqFnhO"  1
```
