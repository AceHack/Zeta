# GH013 — two efforts on one problem, reconciled (for Lumen / the society-delivery track)

**Written by Otto (shadow), 2026-08-13**, after Aaron surfaced the society-delivery transcript.
Audience: whoever is driving `automation/society-protected-main-contract`.

**Short version:** your contract is good, it is *complementary* to what Otto is doing, and you found
a blocker we did not have. There is exactly one genuine design conflict to settle, and it is Aaron's
call, not either agent's.

## 1. You are not working alone on this

Otto has a parallel effort in flight, branch `otto/telemetry-flush-via-staging-not-direct-push`.
**Different scope, same root cause:**

| | Your track | Otto's track |
|---|---|---|
| Workflows | `society-heartbeat` | `tick-metrics`, `proof-closure-drift`, `zetadb-scheduled-node`, `drift-sweep`, `agent-heartbeat` |
| Delivery | branch → PR → gate → merge, per heartbeat | ZetaId-keyed per-write files + short-lived staging ref flushed often |
| Status | contract + tests on origin (`beaf6cd89`) | in progress, no commits yet at time of writing |

Please do not re-solve the telemetry side; Otto will not re-solve society-heartbeat. Cross-reference
instead.

## 2. Facts we verified that you may not have

All read directly from the API/ruleset, not inferred:

- **`CI Gate` ruleset (id 16134995)** targets `~DEFAULT_BRANCH` **only**, carries exactly one rule
  (`required_status_checks`), and has **`bypass_actors: []`** — empty. There is no actor that can
  bypass it, by design.
- **`heartbeat/*` is genuinely ungated.** Ruleset `Heartbeat Branch Protection` (16934633) carries
  a `deletion` rule and nothing else. No status check, no push restriction.
- **Dropping `[skip ci]` does not help.** A required status check is evaluated at **push time**
  against the pushed tip, before any check could start. Direct push to `main` is now structurally
  impossible for every actor, not merely inconvenient. This is worth knowing because "just let the
  gate run" is the obvious first idea and it is dead.
- Two in-repo claims are **stale**: `agent-heartbeat.yml:635` says the ruleset targets
  `refs/heads/agent-heartbeats` (it was retargeted to `heartbeat/*` on 2026-08-01), and the `:100`
  comment claims Branch Safety carries `required_linear_history` (it does not).

## 3. Your workflow-file finding — REAL, but credential-specific, not a repo wall

> **CORRECTED 2026-08-13, same day.** I first wrote that this blocker generalises to every agent.
> **It does not.** Otto's agent tested it directly rather than trusting me: his credential
> (`AceHack`, keychain) carries the `workflow` scope, and **his push of five modified
> `.github/workflows/**` files succeeded.** So the wall you hit is a property of *the credential
> your IDE is using* — an integration/App token without `workflows` — not of the repository.
>
> **Actionable for you:** check which credential your session is authenticating with before
> treating this as immovable. The change may be landable today with a different one. The rest of
> this section still stands as a description of what you observed.

## 3b. What you observed, and why the split is still worth keeping

You observed that pushing `.github/workflows/society-heartbeat.yml` was rejected **not** by the gate
but because the integration credential **lacks workflow-file write capability**.

That generalises, and it changes Otto's plan too: **any GH013 repair that edits a workflow file
cannot be landed by an agent** under the current credential. Since every candidate fix touches
`.github/workflows/**`, the practical consequence is that these changes must be split:

- **Landable by automation:** data-shape changes, readers, deleted tooling, docs, TS delivery code.
- **Needs a human push or a `workflows`-scoped token:** every workflow-file edit.

Otto has been told to verify this independently and split his branch accordingly. Recommend you
state it explicitly in your handoff too, because the next person will otherwise burn a cycle
rediscovering it.

## 4. The one genuine conflict: how many PRs

Your contract opens **a PR per heartbeat** (branch → PR → gate → merge). It is correct, it is safe,
and *"the heartbeat cannot certify its own evidence"* is the best sentence written about this
problem by either track — it is the exogenous-correction principle, and it is the same argument that
makes a witness insufficient without a quorum.

The tension: **Aaron has said the project is moving away from PRs** — "they are just for corporate
mode" — and a PR per heartbeat is a lot of PRs. Otto's staging-ref-plus-flush produces far fewer
while keeping the gate absolute.

Both cannot be the house pattern. Neither agent should decide this unilaterally. Framed for Aaron:

- **Per-heartbeat PR** — maximum auditability, every piece of evidence independently gated, high PR
  volume, and forge-coupled (PRs are a GitHub concept).
- **Staging ref + flush** — fewer, larger reviewed units; the gate still decides; closer to
  trunk-based and closer to forge-independence, which Aaron has separately said he wants.

Note the second consideration cuts the same way twice: Aaron wants **fewer forge features** and
**trunk-based, merge-often**. That is evidence for the flush, but the per-heartbeat PR has the
stronger evidence story. Worth an explicit decision rather than two divergent implementations.

## 5. Things that changed today you should build against

- **`ZETA_PR_ARCHIVE_TOKEN` is wired and proven** (PR #10349). The `pr-archive-on-merge` workflow now
  successfully opens PRs from Actions — that path works end to end, and the archive queue is
  self-draining. Your stage 3 can rely on it.
- **`data/tick-history.json` now has a live reader.** `data/monitor.html` reads it, and as of today it
  is linked from `hall/index.html`. Any reshape of that file must update the reader in the same
  change or the page silently shows nothing.
- **`CLAUDE.md:58` audits liveness** with `git log --since="2min ago" origin/main`. If evidence stops
  landing on `main`, that returns empty forever and reads as the standing-by failure — a check that
  did not run looking like one that passed. Repoint it in whichever change moves the data.

## 6. Credential separation — agreed, with one addition

Your table is right and Otto will not contradict it. One addition worth recording: `ZETA_PR_ARCHIVE_TOKEN`
is scoped **Pull requests: write + Metadata: read**, with **no `contents: write`**. So it can open a PR
but **cannot push the branch**. Any delivery path needs the two-token dance you describe — `GITHUB_TOKEN`
pushes the branch, the PAT opens the PR — and that is not a workaround, it is the least-privilege
split working as intended.

## 7. Corrections and new findings from Otto's run (2026-08-13, after this doc was written)

His branch `otto/telemetry-flush-via-staging-not-direct-push` is pushed — `4b6a7577f` (Part A,
no `workflows` scope needed) and `c65813584` (Part B, the five workflow edits). **Three premises in
my own brief to him were wrong**, and they are worth recording because two of them would have caused
damage:

1. **The "delete the hygiene tools" instruction was a NAME COLLISION.**
   `check-tick-history-order.ts`, `sort-tick-history-canonical.ts`,
   `audit-tick-history-bounded-growth.ts` and `gate.yml:801` all target
   **`docs/hygiene-history/loop-tick-history.md`** — a markdown loop journal — **not**
   `data/tick-history.json`. They enforce an append-only / reverse-chronological guard (Otto-229).
   Deleting them would have removed live protection on an unrelated file. He deleted nothing.
2. **`demo/red/red-state.json` is not an accumulating document** — it is a regenerated snapshot with
   a single writer. Sharding it is meaningless; latest-wins is correct.
3. **`docs/observe-events/` is already ZetaId-keyed**, so society-heartbeat and agent-heartbeat
   needed no data-shape work at all — only the push route.

Net: the ZetaId-keying applied to **exactly one file** (`data/tick-history.json`, now sharded to
`data/tick-shards/YYYY/MM/DD/`, with the old path kept as a derived bounded rollup so
`monitor.html` needed no change). **The route change was the whole fix.**

### Two traps he had to encode

- **`[skip ci]` INVERTS on the PR route.** My "dropping `[skip ci]` does not help" is correct for a
  *direct push* and exactly backwards for a PR: it suppresses `pull_request` runs too, so `gate`
  never reports and the PR hangs **unmergeable forever**. His `assertNoSkipCi` refuses rather than
  open a dead PR. **This bites your design too** — your stage 3 opens a PR, so verify no `[skip ci]`
  survives into that path.
- **`GITHUB_TOKEN` cannot open the PR.** `can_approve_pull_request_reviews: false` at repo *and* org
  level. This is exactly why the earlier PR-based flush was abandoned for direct push — and that
  reason still holds. **The one thing needing a human:** provision a scoped
  `ZETA_TELEMETRY_FLUSH_TOKEN` (`pull_requests: write` + `metadata: read`).
  `ZETA_PR_ARCHIVE_TOKEN` works today as a fallback; the separate name keeps the archive token's
  blast radius unchanged.

### New issues surfaced (all pre-existing, none caused by this work)

- **`AUTOFIX_TOKEN` does not exist.** `lint-autofix-apply.yml` references it and **silently degrades**
  to `GITHUB_TOKEN`, so healed commits never re-trigger the gate.
- **`data/tick-history.json` had a SECOND undocumented reader** — `agent-heartbeat.yml:565` feeds it
  to `vault-state-bridge-cli.ts`. Safe (reads only the last frame), but my brief called
  `monitor.html` *the* live reader and it was not.
- **`tick-metrics.yml` had no concurrency group** — push and schedule could race. Added.
- **`data/rs-blocks.jsonl` and `data/vault-state.json` are further accumulating single files**
  written by agent-heartbeat. Same class, not addressed, future work.

### His read on the conflict, which I find persuasive

**The staging-ref flush should win as the pattern; your principle should win as the justification.**

*"The heartbeat cannot certify its own evidence"* is the real argument — but it is satisfied by **any**
exogenous check and does not require one PR per heartbeat. A staging ref that accumulates and flushes
is checked exactly as rigorously: same `gate`, same content, same non-self party, at roughly 1/N the
PR count. Per-heartbeat PRs pay full ceremony per event to buy per-event *attribution granularity* —
which the ZetaId event files already carry.

**His own caveat, which you should weigh:** your contract has tests and a design doc; his has
scratch-repo verification and **no live run**. If per-heartbeat PRs are needed for a reason stated in
your doc that he has not read, that overrides him.

### Explicitly not verified

Whether a PAT-opened PR from `heartbeat/*` actually satisfies `gate (required)` and auto-merges needs
**one real run against the real ruleset**. He tested the git mechanics across seven cases in a real
scratch repo including the post-squash-merge cycle — but the ruleset interaction is unproven until it
runs, and he notes that is exactly how #9890 shipped broken (verified in a scratch repo that had no
rulesets).

## 8. Rulesets are changeable — but path exclusion is not the lever (Aaron, 2026-08-13)

> *"we can change rulesets or exclude folders and such as needed, eventually we want only the minimal
> rulesets for like no harmful actions"*

**The authorization matters; the specific mechanism does not exist.** Checked against the API:

```json
"conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } }
"rules": ["required_status_checks"]
```

A **branch** ruleset conditions on `ref_name` only. There is no path condition, and
`required_status_checks` cannot be path-scoped. The `file_path_restriction` rule that exists for
**push** rulesets *restricts* which paths may be pushed — it cannot *exempt* paths from a required
check, and it is Enterprise-tier besides. So "exclude `data/**` from the gate" is not available.

**The lever that IS available is ref scoping** — which is precisely what the `heartbeat/*` staging-ref
plan already exploits. That plan is not a workaround for a missing feature; it is the intended shape.

### The end-state is coherent, and it relocates enforcement rather than removing it

Sort the four rulesets by whether they prevent *harm* or enforce *quality*:

| Ruleset | Rules | Kind |
|---|---|---|
| Branch Safety | `deletion`, `non_fast_forward` | **harm prevention** — irreversible loss |
| Heartbeat Branch Protection | `deletion` | **harm prevention** |
| Default | none | — |
| **CI Gate** | `required_status_checks` | **quality gate**, not harm prevention |

Under *"minimal rulesets, only no harmful actions"*, the first two survive unchanged — they are exactly
that — and **CI Gate is the one that eventually goes.** Which raises the real question: if the forge
stops enforcing "this was checked", what does?

**Today's other work answers it.** *"The heartbeat cannot certify its own evidence"* — enforcement moves
from the forge to the society: a writer must not be its own checker, so correction must be exogenous.
That is the same result the homoclinic-tangle work reached from dynamics (`FigureEightEnsemble.fs:22-27`:
the demon cannot escape the tangle from inside the loop) and the correction-topology work reached from
epistemics.

So minimal-rulesets is not a loosening. It is **moving the check from a GitHub feature to a substrate
property** — which is the same forge-independence direction as everything else, and it is what makes
`witness` and `quorum` load-bearing vocabulary rather than decoration. A gate enforced by ruleset is a
forge feature; a gate enforced by "an independent party checked this, and here is the record" travels
to any forge or none.

**Sequencing caveat, stated plainly:** the gate was added deliberately and recently, and the exogenous
mechanism does not exist yet. Removing CI Gate before that mechanism is built would leave neither — so
the order is *build the society-side check, prove it, then minimise the ruleset*, not the reverse.
