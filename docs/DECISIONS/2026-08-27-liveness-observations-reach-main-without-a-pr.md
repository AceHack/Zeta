# Liveness observations reach durable git without a PR — the ledger ref, and the bypass actor we did not grant

Date: 2026-08-27
Status: shipped (option 1); option 2 open, and it is the maintainer's call

## The observation that started it

Aaron, 2026-08-26:

> *"heartbeats themselves go through a PR today because we don't have our decentralized git setup
> yet and rely on GitHub centralized control. For observations about liveness on top of heartbeats
> — the liveness observations about heartbeats never ever need PRs to get to main. We need to make
> this happen."*

Two layers, and only the second changed here.

| layer | disposition |
|---|---|
| heartbeat **ticks** | land on `heartbeat/*`, consolidate to `main` via PR. A centralized-GitHub concession until decentralized git lands. **Unchanged.** |
| liveness **observations** about those ticks | were durable only as a check-run annotation. **Now a direct-pushed git ledger.** |

## Why it is not aesthetic

**The observer must not depend on the observed.** An observation routed through the PR pipeline
cannot report when the PR pipeline is broken. Three instances of that exact defect were measured on
this repository the same night: a retry loop probing over the transport it was saturating; a failure
reporter that ran `bun` when the failing step was the one installing `bun`; a watchdog that went
silent at the same second as its subject.

The annotation-only channel had a fourth, quieter version of the same problem. An annotation is
written *only when the verdict is bad* and *only inside the substrate under observation*. So the
channel could not distinguish **"healthy"** from **"not observing"** — both look like no annotation.
That is the vacuity class: it looks like coverage and constrains nothing.

## Ground truth (verified against the live API, 2026-08-27)

| ruleset | target | rules | bypass |
|---|---|---|---|
| `CI Gate` | `~DEFAULT_BRANCH` | `required_status_checks` | `RepositoryRole 5`, `bypass_mode: pull_request` |
| `Branch Safety` | `~DEFAULT_BRANCH` | `deletion`, `non_fast_forward` | none |
| `Default` | `~DEFAULT_BRANCH` | — | none |
| `Heartbeat Branch Protection` | `refs/heads/heartbeat/*` | `deletion` | none |

Two facts follow, and they frame every option below:

1. **Nothing pushes to `main` without a PR today** — not even an admin. The single bypass actor
   bypasses *via* pull request.
2. **`conditions` offers `ref_name` only.** There is no path dimension, so there is no such thing
   as a carve-out that lets one directory onto `main` and nothing else.
3. **Non-`main` refs are unguarded.** `heartbeat/otto` and `heartbeat/soraya` carry commits that
   landed directly, no PR and no CI.

## The three options, with costs

### 1. A dedicated `liveness/*` ref, direct push — **chosen**

Works today. No bypass actor, no ruleset change, no new credential, no new trust. It is the
mechanism `heartbeat/*` already uses, pointed at the observation layer.

**Cost, stated plainly:** the bytes are not literally on `main`. So the question has to be answered
rather than dodged — *what does being on `main` actually buy?*

Exactly one thing: **presence in the default fetch refspec**, hence discoverability without a reader
instruction. Everything else people mean by "on main" — durable, in git, no PR, readable from a
clone, diffable, mergeable, replayable, no provider API call — is a property of **being a git ref**,
not of being `main`.

And that one thing is recovered the way this repo already recovers it for `heartbeat/*`: a fetch
line in `CLAUDE.md`. The pattern exists, it is load-bearing today, and it extends.

### 2. A bypass actor scoped to a liveness identity

This is the only mechanism on GitHub that literally puts the bytes on `main` without a PR. If Aaron
means `main` literally, this is it and there is no third way.

**The cost, named plainly:** GitHub's bypass is **per-actor, never per-path**. Granting it produces
a credential that can push **anything** to `main` — any file, any content, at any time — and the
"it only writes `observations/`" discipline would then live **in the pusher's own source code**,
not in the guard. That inverts the trust model this repo runs on: the whole point of `gate` is that
the guard, not the guarded, decides.

It also creates a standing target. A credential that can write `main` unreviewed is the highest-value
secret in the repository, and it would sit in a workflow that by design runs unattended every 15
minutes.

**This is a real security decision and it is the maintainer's, not an agent's.** Nothing here grants
it. What is deliverable is the naming: *a fine-grained PAT or GitHub App installation added to the
`CI Gate` ruleset's `bypass_actors` with `bypass_mode: always`.* That is the exact change; it is not
made.

### 3. A non-git durable sink (issue, Deployment, commit status)

Partly already present: `heartbeat-liveness.yml` does hold `issues: write`, and the tracking-issue
step was verified working on run `33024353771`. (Worth noting because `drift-sweep.yml` was found the
same night to *lack* `issues: write`, so its issue path 403s — the scope must be checked per
workflow, never assumed.)

**Cost:** it fails all three of the requirements that mattered. An issue is written only on failure,
so it cannot distinguish healthy from not-observing. It is not in git, so no reader with a clone can
answer the question without calling the provider whose health is in doubt. And it is not diffable or
replayable.

Kept as the human-facing alarm, which is what it is good at. Not the record.

## What shipped

- `src/Core.TypeScript/agent-heartbeats/liveness-ledger.ts` — the channel. Records an observation,
  commits it, pushes it straight to `liveness/observations`.
- `.github/workflows/heartbeat-liveness.yml` — a step with `if: always()`, after the assessor,
  depending on no check, no PR, no `gate`, and not on `main`.
- `CLAUDE.md` — the reader instruction, in the same place and shape as the `heartbeat/*` one.

Four properties, each a requirement rather than a nicety:

**Every run records, including the healthy one.** This is what makes "is anyone still observing?"
answerable. `assessObserverContinuity` reads the ledger and returns the age of the newest record;
a gap in the stream *is* the finding, and it is a finding no annotation channel can produce.

**A blind observer records its blindness.** If the inputs cannot be read, the record says
`outcome: "blind"` with the reason. It never goes quiet, because going quiet is the failure being
fixed.

**Four outcomes, not two.** `alive` / `degraded` / `not-alive` / `blind`. `assessFleetLiveness`
returns `alive: true` the moment *one* source is fresh, which is right for the alarm but flattens a
fleet running on its last source into the same bit as a healthy one. The ledger keeps them apart so
a slow collapse is visible in the record.

**It fails loudly rather than succeeding quietly.** An empty stage is an error (the recorder just
wrote a fresh `observedAt`, so nothing staged means the write did not land — the false-green shape
this subsystem exists to stop believing). A denied credential is reported on the first attempt and
never retried into a slow silence. Only a lost race retries, and only after re-syncing onto the
winner's tip.

## The honest limit

The writer runs inside GitHub Actions. A run that dies before `Setup bun` writes nothing, and a
total Actions outage stops the writing along with the ticking. **Nothing hosted inside Actions can
fix that**, and this document is not going to claim otherwise.

What the ledger changes is that such a gap becomes **readable**: because the healthy case is written
too, a reader with a clone computes the age of the newest record and gets a straight answer, with no
call to the provider in question. The recursion Aaron objected to is gone either way — and it would
still be gone under option 2, which is the strongest reason to think the ref, not `main`, was the
actual requirement.

## Proof it works, and proof it can fail

Run live from a laptop, 2026-08-27, before the workflow change existed:

- **Real observation recorded and pushed.** `liveness/observations` created at
  `d489b6e351fe0af9e1998a2ae908b8221b9cf218`, `parents: []` (a genuine orphan), carrying a true
  finding: `NO TICK FROM ANY SOURCE IN 816 MINUTES`. `GET /commits/<sha>/check-runs` →
  `total_count: 0` — **no check ran, no PR existed.**
- **Append verified** at `f3f75bf8a21aba4d6ceae69ddb49eb35cd767dc9`; the day file holds an ordered
  stream, not one overwritten value.
- **Readable with no clone**: `GET /contents/latest.json?ref=liveness/observations`.
- **Refuses loudly when it cannot write**: unreachable remote → `::error::` + exit 1, one attempt,
  no retry. Empty stage → `::error::` + exit 1.
- **Records blindness rather than nothing** when its inputs are missing.
- 35 unit tests, whose negative branches are the point: empty ledger is an alarm not a pass, corrupt
  lines are preserved rather than dropped, a future-dated record is clamped so clock skew cannot
  silence the check forever, a denied push is not swallowed into the retry path, and a resync
  failure aborts instead of pushing over it.

## Follow-ups that are NOT this change

- **`Heartbeat Branch Protection` has no sibling for `liveness/*`.** The ledger ref is currently
  deletable. A `deletion` rule targeting `refs/heads/liveness/*`, mirroring the heartbeat one, is
  the obvious guard — a ruleset change, so it is named here and not made.
- **Option 2 remains open** if `main` was meant literally. The cost above is the whole of the
  argument against; the decision is Aaron's.
