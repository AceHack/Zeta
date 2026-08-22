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
`agent-heartbeat.yml`):

```
"attestor": "alexa"   141
"attestor": "otto"    127
"attestor": "soraya"  103
"attestor": "/tmp/attest-0rHTQr"  3
"attestor": "/tmp/attest-4EC3oi"  2
"attestor": "/tmp/attest-hqFnhO"  1
```

### Correction to the "Adjacent" note above (measured 2026-08-19)

The sentence "`self-claims.ts` folds `distinctAttestors` from that field" was
wrong when written, and the corrected text above no longer says it.

```
git grep -c "attestation" origin/main -- src/Core.TypeScript/observe/self-claims.ts
=> (no match, exit 1)
git grep -n "attestor\|Attestation" origin/main -- src/Core.TypeScript/observe/self-claims.ts
=> (no output)
```

`self-claims.ts` does not reference attestations at all. `distinctAttestors`
appears only in `attestation-event.ts` and its test, and that file's own
"HONEST SCOPE" note says exactly this. The temp-path attestors are real and
worth cleaning up, but the blast radius is a polluted event log, not a bypassed
gate — nothing folds these records today.

## Resolution

Answered first, then acted on.

### Is anything else already doing this job?

Three separable jobs; two were already covered, and the gap was the third.

| job | who does it today | state |
|---|---|---|
| EMIT peer attestations | `src/Core.TypeScript/observe/emit-attestation.ts`, invoked every tick by `agent-heartbeat.yml` | live, 380 records on `main` |
| VERIFY an attestation record | `src/Core.TypeScript/observe/attestation-record.ts` + `src/Core.TypeScript/observe/verify-attestation-events.ts` (#12256) | complete and tested, **called by no workflow** |
| GATE on the result | nothing | `summarizeAttestations` is referenced only by its own test |
| filename shape in `docs/observe-events/` | `src/Core.TypeScript/hygiene/audit-observe-event-filenames.ts`, inside `gate (required)` | live |

So the emit half did not need this workflow, and the filename check it performed
was a redundant second opinion. The genuine gap: **nothing ran the verifier.**

### What shipped

`agent-reviewer.yml` is armed against the branch form the fleet actually
produces (`heartbeat/<agent>-flush-<sha>`), and the auto-approver is REMOVED
rather than armed. The job now runs `src/Core.TypeScript/observe/verify-flush-batch.ts`, which
performs the two checks nothing else performs — the producer/`by` binding and
`verifyAttestationRecord` over the records the batch adds — and holds
`contents: read` / `pull-requests: read` and nothing more.

Why the approver came out rather than being armed is recorded in the workflow
header with the four measurements behind it. The short form: `main` requires no
approving review (only `gate (required)`, ruleset 16134995), so the approval
unlocked nothing; the receipt push would have deadlocked the flush lane, because
a GITHUB_TOKEN-authored push starts no `synchronize` run and so leaves the new
head with no `gate (required)`; and the receipt itself was a record
`verifyAttestationRecord` refuses twice over.

Item 3 of "Decide, in this order" is unchanged and stays open: **the
independence gap is still open.** There is one identity behind this workflow. It
is closed by a signature over the bytes from a key the producer does not hold,
and `verify-attestation-events.ts message` already emits exactly those bytes.
