---
id: 081M05G8D36087G0R0034D3QPA
type: bug
state: backlog
priority: P1
slug: zeta-telemetry-flush-token-cannot-git-push-heartbeat-lanes-d
title: "ZETA_TELEMETRY_FLUSH_TOKEN cannot git push: heartbeat lanes died 403 after #10850"
created: 2026-08-16T14:40:20.070Z
depends_on: []
composes_with: []
---

# ZETA_TELEMETRY_FLUSH_TOKEN cannot git push: heartbeat lanes died 403 after #10850

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M05G8D36087G0R0034D3QPA-*.md` glob. -->

## NEEDS THE OPERATOR — this half cannot be fixed from inside the repo

`ZETA_TELEMETRY_FLUSH_TOKEN` is a fine-grained PAT that authenticates as **AceHack** and
**does not carry `contents: write`** on `Lucent-Financial-Group/Zeta`. Granting that
permission is a credential change, so it is an operator-approved action, not an agent one.

## What broke, and exactly when

PR **#10850** (`9fd69a992e`, merged **2026-08-15T23:01:23Z**) switched both `actions/checkout`
steps in `.github/workflows/agent-heartbeat.yml` to `persist-credentials: true` +
`token: ${{ secrets.ZETA_TELEMETRY_FLUSH_TOKEN || … }}`, so that the heartbeat/* PR head would
carry a human push actor and `gate (required)` could start (081M010H4KE / 081M005FXAB).

Its stated premise — *"the archive/society flush already uses this PAT"* — is true for the
**API** (`GH_TOKEN` handed to `gh` / `flush-via-staging.ts`) and **false for `git push`**.
`society-heartbeat.yml` and `tick-metrics.yml` check out with the **default GITHUB_TOKEN** and
only use the PAT as an `env:` for the flush; `agent-heartbeat.yml` after #10850 pushes with the
PAT itself.

Result, every tick since:

```
remote: Permission to Lucent-Financial-Group/Zeta.git denied to AceHack.
fatal: unable to access 'https://github.com/Lucent-Financial-Group/Zeta/':
       The requested URL returned error: 403
##[error]Process completed with exit code 128.
```

## Evidence (observed 2026-08-16, not inferred)

| Fact | Value |
|---|---|
| last green `agent-heartbeat` on main | run `31913267498`, 2026-08-15T22:52:33Z |
| first red | run `31913893440`, 2026-08-15T23:06:56Z — the first tick after #10850 merged |
| consecutive failures since | 48 of the last 100 runs on `main`, unbroken |
| `origin/heartbeat/alexa` tip | 2026-08-15T22:54:17Z — frozen |
| `origin/heartbeat/otto` tip | 2026-08-15T22:55:30Z — frozen |
| `origin/heartbeat/soraya` tip | 2026-08-15T22:55:19Z — frozen |
| `origin/heartbeat/society`, `…/tick-metrics` | still updating (they push with GITHUB_TOKEN) |
| flush PRs #10709 / #10710 / #10711 | OPEN since 2026-08-14, last updated 2026-08-15T22:5xZ |
| check rollup on all three PRs | `Analyze (…)`, `submit-nuget` — **no `gate (required)`** |

**Ruled out — it is not the ruleset.** Ruleset `16934633` "Heartbeat Branch Protection" targets
`refs/heads/heartbeat/*` and carries `deletion` only; no `non_fast_forward`. A ruleset denial
would read `GH013: Repository rule violations found`, not `Permission … denied to AceHack`.
(The in-file comment claiming that ruleset targets `refs/heads/agent-heartbeats` and "matches
nothing" was stale and is corrected in the same PR as this item.)

## Why it matters beyond one red workflow

`CLAUDE.md` names `heartbeat/*` as the **externalized idle counter** — the liveness signal every
agent is told to read instead of trusting its own narrative self-count. For ~15.5 hours that
counter has been frozen while the workflow that feeds it ran on schedule and failed. A frozen
liveness ref reads as the standing-by failure by construction. The dogfooding trajectory
(`docs/trajectories/dogfooding-the-whole-stack/RESUME.md`) also still records Tier-1 row 1 as
"✅ dogfooded … green every ~45 min", which has been false since 2026-08-15T23:06Z.

## What already shipped alongside this item

### Attempt 1 — PR #10913 — DID NOT WORK, owned and reverted

The first fix kept #10850's PAT on the checkout and added an in-step fallback: on a 403, unset
`http.https://github.com/.extraheader`, re-point `origin` at
`https://x-access-token:$GITHUB_TOKEN@github.com/…`, retry. It was verified against a **stubbed**
`git` in three modes (ok / denied / non-fast-forward) and every mode behaved as designed.

It still failed in production (run `31954669720`, 2026-08-16T15:08Z). The detection fired and the
warning printed, and then the **retry was denied as the same identity**:

```
remote: Permission to ... denied to AceHack.       <- primary (PAT)
##[warning][heartbeat] ZETA_TELEMETRY_FLUSH_TOKEN cannot push ... falling back
remote: Permission to ... denied to AceHack.       <- fallback, SAME identity
```

The stub could not have caught this: it modelled the *control flow*, not the *credential
resolution*, so it proved the branch was taken and nothing about which token git actually used.
That is the same defect class as the rest of today's sweep — a test that cannot fail on the thing
it is for. Two facts established afterwards, by local experiment rather than reasoning:

- `git config --unset-all "http.https://github.com/.extraheader"` **does** remove that key
  (exit 0, key gone) — so the naive "the unset silently failed" story is not established either.
- `git -c http.<url>.extraheader=…` **appends** rather than overrides (`--get-all` returns both),
  so the obvious "just override it" repair is also wrong.

The root reason the retry kept AceHack's identity is **not** established. What is established is
that swapping credentials *inside the step* did not work, so the mechanism was removed rather than
iterated on.

### Attempt 2 — the shipped fix

Drop the `token:` override from **both** checkouts so the persisted credential is the default
GITHUB_TOKEN, which is **proven** to push `heartbeat/*` in this repo: `society-heartbeat.yml` and
`tick-metrics.yml` do exactly this and their refs kept updating throughout the outage. The PAT
stays where it actually belongs — as `GH_TOKEN` on the flush step, which is what `gh` reads for PR
creation, and which is the split those two working workflows already use.

This also fixes a **latent second break**: #10850 put the PAT on the flush job's checkout too, and
that credential authenticates `flush-via-staging.ts`'s `git push … HEAD:refs/heads/<lane>`. It had
not surfaced only because the tick job was producing no events to flush.

The **test** half is deliberately untouched: `required-check-started.ts` still fails the flush
while `gate (required)` never starts. This item does not get to look green by being worked around.

## 2026-08-16 — the operator grant landed, and the recorded MECHANISM was wrong

The operator granted the PAT `Contents: R+W`, `Pull requests: R+W`, `Actions: R+W`,
`Commit statuses: R`, `Metadata: R` (no `Workflows: Write`). **Verified, not assumed** —
a real tick's preflight dry-run push against the real remote reported
`[preflight] alexa: push credential is authorized for this repository.`
(run `31962679616`, 2026-08-16T17:48:25Z), and the subsequent real push succeeded.

Correcting the record while re-applying: the standing explanation for why gate never
started — *"GitHub does not trigger workflow runs from `GITHUB_TOKEN` pushes"* — is **not
what the API shows**. Measured on `heartbeat/alexa`:

```
pull_request      gate  completed/action_required  actor=github-actions[bot]
workflow_dispatch gate  completed/success          actor=AceHack   (SAME head sha)
```

The run **is** created; it is created and immediately parked in `action_required`, so it
never executes and never contributes a check to the rollup. The cure is the same — a human
push actor — but the mechanism differs, and a wrong mechanism in the record is how the
wrong fix gets copied forward.

Also corrected: the "latent second break" paragraph above says the flush job's checkout
credential authenticates `flush-via-staging.ts`'s push. **Stale.** This workflow's flush job
runs the API-only `merge-heartbeats-to-main.ts`; `flush-via-staging.ts` belongs to
`society-heartbeat.yml` / `tick-metrics.yml`. Checked: the only `git push` in
`agent-heartbeat.yml` is the tick job's, and every git call in the flush job is read-only
(`fetch`/`rev-list`/`log`/`config`). Keeping the PAT off that checkout is still right —
least privilege, a credential that pushes nothing gets no push rights — but for that
reason, not the one written down.

Re-applied in **#10986**, with a preflight that dry-run pushes to the real remote every
tick and falls back (then **re-probes**) on a credential denial, so a mis-scoped or revoked
PAT costs a degraded lane rather than the dead one #10850 produced.

## Done when

- [x] `ZETA_TELEMETRY_FLUSH_TOKEN` carries `contents: write` on this repository (**operator**)
      — granted 2026-08-16, verified by a real-tick preflight probe, not by inspection
- [x] an `agent-heartbeat` run pushes without emitting the fallback `::warning::`
      — run `31962679616`, all three lanes `success`, preflight reported authorized
- [ ] `gate (required)` appears in the check rollup of a `heartbeat/*` flush PR
      — the *run* now executes under `actor=AceHack` instead of being parked (gate
        `31962755672`, 2026-08-16T17:49:31Z); the rollup line is confirmed only once
        #10986 is on main so the **scheduled** tick also pushes with the PAT
- [ ] #10709 / #10710 / #10711 merge, or are superseded by a tick that can flush
- [ ] the dogfooding RESUME's Tier-1 row 1 claim is re-verified rather than assumed
- [ ] `society-heartbeat.yml` + `tick-metrics.yml` push their lanes with `GITHUB_TOKEN`
      too, so `heartbeat/society` and `heartbeat/tick-metrics` flush PRs have the same
      held-gate defect. **Deliberately out of scope here**: those two lanes stayed alive
      through the outage, this exact change has broken the society twice, and one lane
      proven on a real tick beats three changed at once.

## MEASURED DOWNSTREAM COST (added 2026-08-25) — this P1 is silently losing training data

The API-side fallback in this same step has a second consequence nobody had connected to
it, and it is larger than the flush-liveness symptom this item was filed for.

`agent-heartbeat.yml` falls back to `GITHUB_TOKEN` when the PAT is refused, so every flush
PR **merges as `github-actions[bot]`**. GitHub does not deliver a `pull_request` event for
an action taken with `GITHUB_TOKEN`, so `pr-archive-on-merge.yml` never runs for those
merges — no workflow run is created, nothing fails, nothing goes red, and the PR's review
substrate is simply never written to git.

```text
ZETA_TELEMETRY_FLUSH_TOKEN denied
   -> fallback to GITHUB_TOKEN
   -> flush PRs merge as github-actions[bot]
   -> `pull_request: closed` event SUPPRESSED
   -> pr-archive-on-merge.yml never runs
   -> the PR is never archived, silently
```

Checked, not assumed:

- All six most recent heartbeat runs emit `::warning title=Heartbeat API credential denied`
  (32823324598, 32821142228, 32818569388, 32816194481, 32814829813, 32813161986). The
  fallback is not an edge case, it is **every run**.
- Of 765 eligible unarchived PRs merged 2026-08-21..25, **747 (97.6%) were merged by
  `github-actions`**. Of 539 archived in the same window, **530 (98.3%) were merged by a
  user**. The separation is essentially total.
- Per merge SHA: `#15280` and `#15267` (bot-merged) return **0** archive workflow runs;
  `#15272` and `#15264` (user-merged) return 1 run, success.

**Cost as of 2026-08-25: 910 eligible merged PRs with no archive record**, accruing at
~150/day. Archive coverage over eligible PRs is 80.91% lifetime and **64.92% over the last
7 days**. That review discussion lives only in GitHub's database until this is granted.

Coverage is now measured and goes red on its own (`audit-pr-archive-coverage.ts`, 4x/day in
`pr-manifest-integrity.yml`), and the backfill sweep was resized so the backlog drains
rather than holding station. But that is a **net under a suppressed trigger**, not a repair
of it. The trigger is repaired by granting this PAT `Contents: read and write`.
