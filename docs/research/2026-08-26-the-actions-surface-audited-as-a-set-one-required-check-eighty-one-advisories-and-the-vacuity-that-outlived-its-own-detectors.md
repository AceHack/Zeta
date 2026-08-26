# The Actions surface, audited as a set — one required check, eighty-one advisories, and the vacuity that outlived its own detectors

**Audit, 2026-08-26.** `.github/workflows/` holds **82 files, 21,478 lines**. They have been written,
patched and reasoned about one at a time; nobody had ever read them *as a set*. This does that and
answers five questions with evidence per claim: which are **vacuous**, which are **redundant**, which
should be **combined or split**, which are **dead**, and which **report but cannot block** — separating
the deliberate non-blockers from the accidental ones.

**Nothing here changes workflow behaviour.** Not one `.yml` byte is touched by the PR carrying this
document. Changing what blocks is a treaty amendment and a human decision (drift-and-heal ADR,
2026-08-01); this is the measurement such a decision would need.

---

## 0. Method, and what "measured" means here

| | |
|---|---|
| Tree | `origin/main` pinned at **`dc15f463dfb8c44543f217028d6879ca9da39a0e`**, in a dedicated worktree |
| Static surface | 82 `*.yml`, 21,478 lines, read in full |
| Run history | **224,291 workflow runs** across all 82 files, via `GET /repos/{o}/{r}/actions/workflows/{file}/runs?status=<s>&per_page=1 → .total_count` |
| Per-job scan | the **300 most recent `gate` runs whose conclusion was `success`** (2026-08-24T14:05Z → 2026-08-26T06:54Z), each expanded via `GET /actions/runs/{id}/jobs` |
| Repo variables | `GET /actions/variables` → **2** · org → **0** · both environments (`copilot`, `github-pages`) → **0** |
| Repo secrets | `GET /actions/secrets` → **15** |
| Rulesets | `GET /rulesets` → 5, of which **one** carries a `required_status_checks` rule |

**A methodological finding, recorded because it nearly corrupted this audit.** The shared clone this
work started in carried **uncommitted local WIP in `gate.yml`** — a fix, not yet on `main`, that added
`matrix-setup`/`path-filter` to the roll-up's `needs:` and routed the verdict through a
`gate-skip-verdict.ts` that is *untracked and does not exist on `origin/main`*. Read from that tree, the
single most consequential finding below would have been reported as already fixed. Every line number in
this document was re-verified against the pinned worktree. This is
`verify-the-tree-not-just-the-command` turned on an audit of the tree: **a file you did not confirm is at
the SHA you think it is, is a check that did not run.**

---

## 1. The fact that reorganises the other four questions

**There is exactly one required status check on the default branch, and it is one job inside one file.**

```
GET /repos/Lucent-Financial-Group/Zeta/rulesets/16134995
  name: "CI Gate"   target: branch   enforcement: active
  conditions.ref_name.include: ["~DEFAULT_BRANCH"]
  rules[0].type: required_status_checks
  rules[0].parameters.required_status_checks:
      [ { context: "gate (required)", integration_id: 15368 } ]     ← one entry
```

The other four rulesets carry no status-check rule: `Branch Safety` (16189060) is `deletion` +
`non_fast_forward`; `Default` (15256879) has an empty `rules[]`; `Heartbeat Branch Protection`
(16934633) is `deletion` on `heartbeat/*`; `Code Quality Copilot review` (19490341) is a
`copilot_code_review` rule and is **disabled**. Two independent corroborations: no workflow in the set
declares `workflow_call` and none is `uses:`-invoked by another, so nothing outside `gate.yml` can reach
`gate (required)`'s `needs:` list; and the committed expectation
`src/Core.TypeScript/hygiene/github-settings.expected.json` records
`default_branch_protection.required_status_checks: null`.

`gate (required)` is `gate.yml`'s `gate-required` job (`gate.yml:3346-3347`). Therefore:

> **81 of the 82 workflows cannot block a merge, by construction.** Not by policy, not by
> `continue-on-error`, not by anyone's judgement — no rule anywhere consults them.

That is not automatically wrong: the drift-and-heal ADR (Aaron, 2026-08-01) *deliberately* moved this
repo off blocking gates. But it makes the ranking below a fact rather than a preference. A vacuous
assertion inside the transitive `needs` closure of `gate-required` is the only kind that can let a defect
through a merge. Everything else is an advisory that is quiet when it should be loud — a real defect, one
register down.

**The floor**, `gate.yml:3459-3465`:

```yaml
    needs:
      - build-and-test
      - lint                       # semgrep
      - lint-typescript
      - cross-verify
      - full-verify
      - test-typescript-hermetic
```

plus, transitively, `matrix-setup` and `path-filter` — because `build-and-test` declares
`needs: [matrix-setup, path-filter]` (`gate.yml:395`) and `full-verify` declares `needs: [path-filter]`
(`gate.yml:3205`). **Eight jobs are inside the floor; six reach the verdict.** That two-job gap is V-0.

---

## 2. VACUOUS — checks that run, report green, and cannot fail for the reason they exist

Ranked by consequence. **Tier 0** sits on the blocking floor. **Tier 1** is the watchdog layer — the
surfaces built specifically to catch what the one gate misses, where a false green is the audited defect
occurring inside its own detector. **Tier 2** is a named check whose named subject cannot fail. **Tier 3**
is deliberate, recorded so nobody "fixes" a specimen.

### Tier 0 — on the one thing that blocks

#### V-0 · `gate (required)` reports SUCCESS when `matrix-setup` or `path-filter` fails

`gate.yml:3504-3523`, the entire verdict:

```bash
          # A job result is one of: success, failure, cancelled, skipped.
          # Skipped is acceptable (path-filter gated); failure/cancelled are not.
          results='${{ toJSON(needs.*.result) }}'
          if echo "$results" | grep -qE '"(failure|cancelled)"'; then
            echo "::error::One or more gate jobs failed or were cancelled."
            exit 1
          fi
          echo "All gate jobs passed or were skipped (docs-only). ✓"
```

**Proof of unreachability, from GitHub's job semantics plus the three declarations above.**

*Trace A — `matrix-setup` fails.* GitHub marks a job whose `needs:` did not all succeed as **`skipped`**.
`build-and-test` needs it (`395`), so `build-and-test` → `skipped`. `matrix-setup` is **not** in
`gate-required.needs`, so its `failure` never enters `results`. `gate-required` runs anyway
(`if: always()`, `3361`). The regex at `3519` matches nothing → **exit 0**. The .NET build and the entire
OS matrix never executed and the sole required check is green.

*Trace B — `path-filter` fails.* Both heavy subjects go dark at once. `build-and-test` → `skipped` via
`needs`. `full-verify` → `skipped` twice over: via `needs: [path-filter]` (`3205`), and because a failed
job publishes no outputs so `if: needs.path-filter.outputs.code == 'true'` (`3206`) is false. Two
`"skipped"` values, no `"failure"` → **exit 0**. Neither `dotnet build`/`dotnet test` nor the
seven-language byte-lock ran.

*Trace B′ — the same green with **nothing failing at all**.* `path-filter` publishes (`207-208`):

```yaml
    outputs:
      code: ${{ steps.detect.outputs.code || steps.nonpr.outputs.code }}
```

`detect` is gated `if: github.event_name == 'pull_request'` (`234`), `nonpr` on the complement (`216`).
If either writer fails to emit — a `$GITHUB_OUTPUT` write that does not happen, a future event type
matching neither guard — the expression resolves to the **empty string**, `full-verify`'s `if:` is false
and it skips as "success". `build-and-test` still runs, but every heavy step inside it is gated on the
same value (`568, 575, 583, 590, 594`) and skips, while `613` prints the reassuring
`Skipped (docs-only PR)` passthrough. Green over a materially empty run, with no red X anywhere.

**Measured: the two producers of `skipped` are indistinguishable in practice, because the benign one is
the majority case.** Across the 300 most recent green `gate` runs:

| | count | of 300 |
|---|---:|---:|
| `full-verify (7-lang oracle + cost + proofs)` reported **`skipped`** | **182** | **60.7%** |
| runs carrying ≥1 `failure`/`cancelled` job beside the green | 8 | 2.7% |
| — of those, the failing jobs | 7 × `build-and-test (windows-2025)`, 5 × `build-and-test (windows-11-arm)`, 1 × `build-and-test (macos-26)` | |

**Three out of five green required checks do not include the seven-language byte-lock**, legitimately, on
docs-only changes. So `skipped` is not an anomaly a reader would notice — it is the common case, and the
verdict reads only the string. *"The path filter said docs-only"* and *"the path filter is dead"* are the
same word in the same field.

**Why the existing mitigation does not close it.** `gate.yml:3436-3452` already names this class in its
own words — *"a check that did not run looks exactly like a check that passed"* — and answers it with the
`Emit scope` step (`3484-3502`), which publishes which floor jobs executed. That step is
`continue-on-error: true` (`3491`) and its four job outputs (`3376-3380`) are **read by nothing**:
`drift-loud` needs `gate-required` (`3621`) but references no output of it, and job outputs are not
readable across workflows. Its real products are annotations and a step summary — read by humans, not by
branch protection. Exactly right for observability; irrelevant to the traces above.

> **Status: a fix for exactly this exists, uncommitted, in another clone.** It adds `matrix-setup` and
> `path-filter` to `needs:` and routes the verdict through a `gate-skip-verdict.ts` separating a licensed
> skip (job declares a job-level `if:` **and** every `needs:` succeeded) from a dead-prerequisite skip. It
> is not on `main` at `dc15f463df` and is not part of this PR. Recorded so this is not re-litigated:
> **the defect is live on `main` at the pinned SHA**, and the remedy is already drafted.

#### V-0.1 · `cross-verify`'s AgencySignature check is inert on five of six trigger paths

`gate.yml:2549-2567`, `if: github.event_name == 'pull_request'` (`2558`). On `push`, `merge_group` and
`workflow_dispatch` the Task-ZetaId resolution check does not run inside the floor job. **Documented and
correct** (`2550-2557`: the audit exits 2 on empty input and a push carries no PR body), with the coverage
picked up by `agencysignature-enforcement.yml`. Listed because the gap is real and visible only in the `if:`.

### Tier 1 — the watchdog layer, reporting green on the thing it exists to catch

These matter disproportionately. Each is a surface built *because* the one gate is narrow, and each one's
false green is the audited defect happening inside its own detector.

#### V-1 · `drift-sweep.yml:286-309` — BD001 reports "main build green" on a **cancelled** gate run

BD001 is the detector for a red build on `main`. It carries, by its own comment (`274-277`), *"the
tightest SLO budget in registry/drift-slo.yaml: a red main build gets ONE tick of tolerance."*

```bash
287           run_json=$(curl -fsS -H "Authorization: Bearer $GH_TOKEN" \
288             "…/actions/workflows/gate.yml/runs?branch=main&event=push&status=completed&per_page=1" \
289             | jq -r '.workflow_runs[0]')
…
296             if [ "$run_conclusion" == "success" ]; then
297               echo "main build green (gate run $run_id conclusion success, …)"
298             else
299               failed=$(curl -fsS … "/actions/runs/$run_id/jobs?per_page=100" \
301                 | jq -r '[.jobs[] | select((.name|startswith("build-and-test")) and .conclusion=="failure") | .name] | join("; ")')
302               if [ -n "$failed" ]; then
303                 echo "Zeta.sln:1 BD001/main-build-red …" >> /tmp/findings.txt
305               else
306                 echo "main build green (gate run $run_id failed but not in build-and-test)"
```

**Two proven blind spots, both reporting "green".**

*(a) A cancelled gate run.* `status=completed` selects on `status`, and a cancelled run **is**
`status: completed` with `conclusion: cancelled`. Line `296` is false, so control reaches `299`, whose
`jq` filter selects only `.conclusion=="failure"`. A cancelled run's `build-and-test` legs conclude
`cancelled`, so `$failed` is empty and line `306` prints **"main build green."**

This is the highest-consequence finding outside the floor, because the population is enormous:
**6,817 of 35,467 `gate` runs are cancelled (19.2%)**, `gate.yml`'s own comment (`3672-3678`) records
three merges landing inside 24 seconds against a ~14-minute gate, push-run coverage on `main` is measured
at **16.4% (82 of 500 completed runs executed their matrix)** (`gate.yml:150-152, 461-462`), and this
repo's own memory carries the entry *"Main is green because nothing finishes checking it — 88% of gate
runs on main cancelled."* **BD001 is the detector for that exact condition, and it is blind to it.**

*(b) An API failure.* The step declares no `shell:` and `gate.yml`-style `set -euo pipefail` is absent
from this block, so it runs `bash -e {0}` with **`pipefail` off**. A failing `curl -fsS` yields the
pipeline's status from `jq`, which is 0 on empty input; `run_id` is empty; line `294` prints *"no
completed gate push-run found — no BD001 signal this tick."* A dead API reads as no drift. And errexit
does not save it: the whole thing is a `var=$(…)` assignment, whose status is the substitution's.

#### V-2 · `drift-sweep.yml:248-253` — a dead detector is indistinguishable from clean drift

```yaml
248      - name: Run detectors (findings are data here, not failures)
249        run: |
250          set +e
251          bunx markdownlint-cli2@0.22.1 "**/*.md" > /tmp/findings.txt 2>&1
252          echo "markdownlint exit: $? ($(wc -l < /tmp/findings.txt) output line(s))"
253          exit 0
```

`$?` is consumed into an `echo` string and discarded; the step ends `exit 0` unconditionally. If `bunx`
cannot resolve the package, `/tmp/findings.txt` holds an installer error and the `Record the tick` step
mints that as the tick's drift reading. Corroborated: `drift-sweep.yml` shows **2,807 runs, 2,375 success,
40 failure, 392 cancelled** — and zero failures in the most recent 100.

#### V-3 · `proof-closure-drift.yml:131` — `tee` swallows the auditor, and the summary asserts the opposite

```yaml
127       - name: Audit proof-closure claims
128         id: audit
129         continue-on-error: true # drift telemetry never blocks the fleet
130         run: |
131           bun src/Core.TypeScript/hygiene/audit-proof-closure-claims.ts | tee audit.txt
132           echo "status=$?" >> "$GITHUB_OUTPUT"
…
161             if [ "${{ steps.audit.outcome }}" = "success" ]; then
162               echo "No proof file claims a closure it does not have."
163             else
164               echo "**Drift found.** A file claims closure while carrying \`sorry\` / \`admit\` / \`axiom\`."
```

The auditor **does** signal: `audit-proof-closure-claims.ts:308` is
`return out.findings.length > 0 ? 1 : 0`. But the step declares no `shell:`, so no `pipefail`, so the
pipeline's status is `tee`'s — always 0. `steps.audit.outcome` is therefore permanently `success`, the
`else` at `164` is unreachable, and **the run summary prints "No proof file claims a closure it does not
have" on a run where the auditor printed findings.** Reporting the negation of your own measurement is
worse than not measuring; `echo "status=$?"` compounds it by recording `tee`'s status into an output
nothing reads. The sibling at `137` (`… | tee coverage.txt`, `id: coverage`) has the identical shape.

The same bug is documented as *fixed* in `society-heartbeat.yml:217-221`, in this repo, uncorrected here.

#### V-4 · `agencysignature-enforcement.yml:253-282` — `set -uo pipefail` does not clear `-e`, so the three-valued verdict is unreachable

```bash
253           set -uo pipefail
…
266           bun src/Core.TypeScript/hygiene/human-review-evidence.ts \
267               --repo "${GITHUB_REPOSITORY}" --pr-number "${PR_NUMBER}" \
268               --pr-author "${PR_AUTHOR}" < preimage.txt
270           code=$?
272           if [ "$code" -eq 2 ]; then …COULD NOT VERIFY…
277           elif [ "$code" -eq 1 ]; then …REFUTED…
282           exit "$code"
```

GitHub's default `run:` shell is `bash -e {0}`, and `set -uo pipefail` does **not** clear a `-e` that
arrived on the command line.

**Demonstrated, not asserted:**

```
$ printf 'set -uo pipefail\nfalse\nrc=$?\necho "reached rc=$rc"\n' > t.sh && bash -e t.sh ; echo $?
1                              ← "reached" never printed; rc=$? is unreachable

$ printf 'set +e\nfalse\nrc=$?\necho "reached rc=$rc"\n' > t2.sh && bash -e t2.sh ; echo $?
reached rc=1
0                              ← the control: `set +e` does clear it
```

So the bare simple command at `266-269` aborts the step on any non-zero and lines `270-282` never execute.
The step still reddens — but exit 1 (**claim REFUTED**) and exit 2 (**COULD NOT VERIFY — tooling
failure**) collapse into indistinguishable bare reds, which is precisely the conflation the job's own
header (`241-244`) says it exists to remove, and which the step's *sibling* fetch at `258-264` goes out of
its way to avoid. **The correct form is already in this same file at `153` and `188`** (`|| code=$?`).
Population: **8,680 runs**.

#### V-5 · `ruleset-apply.yml:80-88` — the same bash fact; a reconciler that can only apply when there is nothing to apply

```bash
 80         run: |
 81           set -uo pipefail
 82           bun src/Core.TypeScript/hygiene/reconcile-rulesets.ts --repo "$GH_REPO"
 83           rc=$?
 84           if [ "$rc" -ge 2 ]; then
 85             echo "::error::plan failed or refused (exit $rc) — not applying"
 86             exit "$rc"
 87           fi
 88           exit 0
```

The comment five lines up (`ruleset-apply.yml:75`) says *"Exit 1 here just means 'work to do'."* By the
demonstration in V-4, it cannot. Exit 1 = DRIFT aborts the `plan` step, the job fails, and
`apply and verify` (`:90`) never runs.

**Four files in this repo get this right and two get it wrong.** `github-settings-drift.yml:132-142`
carries a fourteen-line comment explaining exactly this bash behaviour and uses `rc=0; cmd || rc=$?` at
`153` and `226`; `pr-manifest-integrity.yml` (`139, 210, 288`) and `pr-archive-on-merge.yml` (`287`) use
the equally correct `set +e … set -e` sandwich. `ruleset-apply.yml` and `agencysignature-enforcement.yml`
did not get the memo.

*Honest limit:* this branch has never executed. `ruleset-apply.yml` has **1 run, 0 success, 1 failure**,
and that run died earlier, at the credential refusal (D-2) — steps `plan` and `apply and verify` both
report `skipped`. The defect is latent and fires the first time the credential is provisioned, which is
the first time the workflow could ever do its job.

#### V-6 · `github-settings-drift.yml` — the ruleset reconciler has never executed, and neither job can fail

```bash
215           if [ -z "${GH_TOKEN:-}" ]; then          # GH_TOKEN = secrets.RULESET_READER_TOKEN
216             echo "::warning::ruleset plan INDETERMINATE — RULESET_READER_TOKEN is not set … DID NOT RUN."
217             exit 0
218           fi
…
226           bun src/Core.TypeScript/hygiene/reconcile-rulesets.ts --repo "$GH_REPO" || rc=$?
227           case "$rc" in … 3) echo "::error::ruleset plan REFUSED — ungated widening…" ;; esac
235           exit 0
```

`RULESET_READER_TOKEN` is not among the repo's 15 secrets → always empty → `exit 0` at `217` on every run
since the file was written. **Lines `226-233`, including the `3) REFUSED — ungated widening` arm, are
unreachable code.** Confirmed live rather than inferred:

```
GET /check-runs/98000421901/annotations
  warning: ruleset plan INDETERMINATE — RULESET_READER_TOKEN is not set, so live ruleset state
           could not be read and this check DID NOT RUN. …
```

Three independent layers discard the same verdict: the missing secret, the unconditional `exit 0` at
`235`, and `continue-on-error: true` at job level (`188`). The sibling `check drift` job has the same
shape: `DRIFT_DETECTOR_PAT` is also undefined, so `[ -n "$DRIFT_DETECTOR_PAT" ]` at `145` is always false
and every run takes the `GITHUB_TOKEN` path, which the file itself says holds no `administration` scope.

**And yet this is the model to copy for the *reporting* half.** Same run, sibling job:

```
GET /check-runs/98000421578/annotations
  notice:  github-settings settings match the committed record across every field this credential could read
  warning: 27 recorded field(s) were NOT verified and 0 are not recorded at all; 357 leaf value(s) were compared.
  warning: … GITHUB_TOKEN … holds no 'administration' scope, so the admin-only fields
           (branch protection, actions permissions, CodeQL default setup, security_and_analysis, merge sett…
```

*"Match across every field this credential could read"* plus a named count of what it could not is the
pattern the rest of this surface should be measured against. **A degradation that announces its own scope
is not a substitution.** Copy the annotation; do not copy the unconditional `exit 0` without it.

Historical note that makes the shape legible: this workflow has **5,067 runs, 49 success, 5,018 failure —
99.0% red** — until `continue-on-error: true` landed (2026-06-20, `0c37f2bcfa`), after which the last
failure is 2026-06-20T23:11 and every one of the 49 runs since has been green. A check red on 99% of runs
carries the same information as one that can never go red: **zero**. Trading a saturated red for a
saturated green is a defensible response to alert fatigue; it is not a fix to the saturation.

#### V-7 · `lint-autofix-apply.yml` — a `contents: write` lane with no reachable non-zero path

```yaml
 48       contents: write # apply the heal patch back to the PR branch
…
 70           if ! gh run download "$PRODUCE_RUN_ID" -n lint-autofix-patch -D "…" 2>/dev/null; then
 71             echo "No heal patch artifact — nothing to apply."
 73             exit 0
…
111             if [ "${HEAD_BRANCH}" = "main" ]; then
112               if git push origin "HEAD:${HEAD_BRANCH}"; then
…
139           else
140             echo "Patch did not apply to its base (unexpected) — skipping." >&2
141           fi
```

Three proofs, one qualified.

- **`70` conflates a dead Actions API with "nothing to heal".** `if !` catches *every* non-zero — 403,
  429, 5xx — and routes all of them to `exit 0`, with stderr discarded.
- **`139-141` has no `exit 1`.** "Patch did not apply to its base (unexpected)" is a green step.
- **`111`'s push branch is effectively unreachable.** `HEAD_BRANCH` is
  `github.event.workflow_run.head_branch` (`80`); the producer `lint-autofix.yml` has exactly one trigger,
  `on: pull_request`, and this job further requires `workflow_run.event == 'pull_request'` (`41`) and
  same-repo (`43`). So `head_branch` is always a same-repo PR *head*, and GitHub forbids head == base.
  **Qualified:** a PR from `main` into some other branch would satisfy it, and `lint-autofix.yml` sets no
  `branches:` filter — so this is unreachable *in practice* on this repo's PR convention, not by
  construction. Either way, the `contents: write` grant's stated purpose has never been exercised.

Measured: **6,675 runs, 6,276 success, 380 skipped, 10 cancelled, 0 failures ever.**

#### V-8 · `agent-heartbeat.yml:786-797` — a failed PR query reads as "the queue is caught up"

```bash
786           CANDIDATES=$(gh api "repos/{owner}/{repo}/pulls?state=open&per_page=100" \
787             --jq '[…]' 2>/dev/null)
794           if [ -z "$CANDIDATES" ]; then
795             echo "[merge] No unarmed PRs — the queue is caught up."
796             exit 0
```

`gh`'s exit status dies inside the command substitution and is never read; stderr is discarded; the sole
consumer is `[ -z … ]`. A 403, a 429 or a network failure produces byte-identical green output to an empty
queue. **This exact defect was found and repaired 1,000 lines lower in the same file and not
back-ported** — `agent-heartbeat.yml:1778-1796`: *"This was `… 2>/dev/null || true`, which made a FAILED
query indistinguishable from a successful one that found nothing."* The fix (`PR_LIST_ERR` capture +
`PR_LIST_RC` check) is at `1797-1806`.

#### V-9 · `agent-heartbeat.yml:1513` — a failed fetch reads as "nothing to flush"

```bash
          git fetch origin "heartbeat/$AGENT" 2>/dev/null || { echo "skip=true" >> "$GITHUB_OUTPUT"; exit 0; }
```

The `||` arm fires for *any* non-zero and stderr is discarded, so a transient network failure sets
`skip=true`, switching off both the flush step (`if:` at `1593`) and the auto-merge arming step (`if:` at
`2163`). Green, having moved nothing to `main`.

#### V-10 · `agent-heartbeat.yml:1309` and `:351` — the file that forbids bare `|| true`, twice

```bash
1309           bun src/Core.TypeScript/observe/phase-history-cli.ts --summary 2>&1 || true
```

Last command of its step, so the step's status is unconditionally 0. 260 lines earlier the same file
(`563-567`) writes: *"NOT `|| true`. The first version of this step used one, which is the exact pattern
§207 above records as the reason the mutation step sat dead for months: a bare `|| true` turns 'this never
ran' and 'this ran and found nothing' into the same silent output."*

```bash
 351           git add docs/observe-events/ || true
 352           if git diff --cached --quiet; then
 353             echo "[heartbeat] no new events to commit"
```

A failed `git add` and a genuinely empty stage produce the same line and the same green step; compounded
at `343`, where the tick body itself runs under `|| echo "[heartbeat] tick failed (non-fatal)"`.
`heartbeat-liveness.yml:109-111` names this pair as a structural FALSE GREEN in as many words. The
detector exists; the producer was not changed.

#### V-11 · `memory-index-integrity.yml` — a `git diff` that cannot resolve its base passes the check

```bash
          changed=$(git diff --name-only --diff-filter=AM "$BASE_SHA" "$HEAD_SHA" -- "memory/" || true)
          if [[ -z "$changed" ]]; then
            echo "no memory/ add-or-modify changes in range; skipping check" >&2
            exit 0
          fi
```

**Mutation run locally against the real repository** — substitute a base SHA git cannot resolve, which is
what a rewritten or unfetched base commit looks like:

```
$ BASE_SHA=deadbeef… HEAD_SHA=$(git rev-parse HEAD) bash -c '<the step, verbatim>'
fatal: bad object deadbeefdeadbeefdeadbeefdeadbeefdeadbeef
no memory/ add-or-modify changes in range; skipping check
EXIT=0
```

Git printed a fatal error and the check reported green. The frontmatter validation below — the workflow's
entire purpose — is unreachable whenever `git diff` fails for any reason. A second, narrower door beside
it: `BASE_SHA == "0000…"` (force-push) also `exit 0`s, deliberately and with a label, which means the
check is off in exactly the situation `memory-index-drift.yml`'s header names as its own reason to exist
(*"pushes that bypass the hook — human contributors, force-pushes, etc."*).

#### V-12 · `drift-sweep.yml:390` and `chart-version-refresh.yml:159` — `continue-on-error` whose outcome is unreadable by construction

Both steps carry `continue-on-error: true` and **no `id:`**. `steps.<x>.outcome` requires one, and
`grep -n 'outcome' drift-sweep.yml` returns nothing while `chart-version-refresh.yml` contains no
`steps.*` reference at all. No expression in either file can observe the failure.

Consequences differ and both are real. In `drift-sweep.yml` the step's only product is
`data/platform-drift.json`, flushed at `494`, so on failure **the previous tick's file is re-flushed
unchanged** and the dashboard serves a stale number behind a green run. In `chart-version-refresh.yml` the
step is *"Currency report drift (is the committed report stale?)"* (`157`) and the very next step
(`162-164`) regenerates the same file with `--write`, so the artifact uploaded at `176-185` is the
regenerated report, not the stale one that was flagged. A staleness finding leaves a log line and nothing
else.

The same shape exists in `agent-heartbeat.yml:234-239`: the Ollama install and serve/pull steps are both
`continue-on-error: true` with no `id:`, so "the model is not available" is *unrepresentable* as a gating
expression, and the downstream consumers (`322`, `1145`) re-derive it by swallowing failure (`343`,
`1174`) — V-10's mechanism again.

#### V-13 · Two process substitutions that hide their producer's death

`set -e` and `pipefail` never observe the exit status of `< <( … )`.

- **`drift-sweep.yml:352-356`** — `mapfile -t files < <(git ls-files '*.md' | bun … md-heal-scope.ts)`.
  A throwing scoper leaves `files` empty, `[ "${#files[@]}" -gt 0 ]` is false, the certified healer never
  runs, and the step is green — identical to "nothing needed healing".
- **`k8s-lane-partition.yml:265, 306-312`** — `while read … done < <(bun … lane-partition.ts --images)`,
  under `set -euo pipefail` (`261`). A crashed producer means the loop body never runs, so `FAILED=0` and
  `DELTA_MIB=0`, both guards (`306`, `310`) are false, and the step is green **having pulled and measured
  nothing** — the exact opposite of the header's *"the estimate is convicted by a real pull."* (The
  crash variant is proven; whether a legitimately empty lane can occur is SUSPECTED, unproven.)

Same class, third instance, in the floor: **`gate.yml:1049-1053`**,
`mapfile -t files < <(find tools -name "*.sh" … | sort)` followed by `if [ ${#files[@]} -eq 0 ]; then … exit 0`.

#### V-14 · `mux-swarm-tick.yml` — the tick's output cannot leave the runner, and never has

The job ends at `:53` with `bun src/Core.TypeScript/swarm/swarm-controller.ts`. There is no `git push`, no
`flush-via-staging`, no `upload-artifact`, and no step after it; the controller writes only a
`__dirname`-relative signature file (`swarm-controller.ts:229-237`). Its `main()` unconditionally
`return 0`, and every LLM interaction is wrapped in `catch { console.error(…) }`, so a completely dead
local LLM exits 0. Compounding: `ollama serve &` starts in a *different step* (`42`), and this repo's own
`macos-install-sh-test.yml:119-121` records that the daemon does not persist across steps.

Measured: **337 runs, 299 success, 0 failures, 38 cancelled** — 299 greens that produced nothing anybody
can read, holding `contents: write` and `pull-requests: write` it never uses. This is the defect
`agent-heartbeat.yml:1196-1208` documents having found and fixed for its own healer, archive and codegen
steps. The file's own header claim that *"28 of the last 30 runs were cancelled and NONE has ever
succeeded"* is stale in the direction that matters.

#### V-15 · Three "FALSIFIER FOR THE CREDENTIAL" preflights that cannot fail

`society-heartbeat.yml:138-186`, `tick-metrics.yml:149-197`, `drift-dashboard-cadence.yml:117-149`.
`set -uo pipefail` is used deliberately **without `-e`**, and the terminal statement on the
total-failure path is an `echo`:

```
186          echo "::error title=… has no working push credential::BOTH the PAT and GITHUB_TOKEN were denied. …"
```

An `::error` annotation does not fail a step, so the block exits 0. **The worst state the preflight can
detect is the one state it does not report as failure.** The mitigation is real — the downstream flush
does fail, so the *job* reddens — but the step named as the falsifier can never be what reports it, which
is the attribution the preflight exists to provide.

Related, from §3: this preflight covers **four of nine** branch-push lanes, and the credential *assert*
covers **eight of nine**.

#### V-16 · `society-heartbeat.yml:223-227` (and `tick-metrics.yml`, same shape) — the step the workflow is named for cannot fail

```bash
223           set -o pipefail
224           bun src/Core.TypeScript/planning/society-evolution-runner.ts … 2>&1 | tail -10 \
227             || echo "[society] evolution tick failed (non-fatal)"
```

`pipefail` makes the pipeline status truthful, then `|| echo` converts any non-zero to 0 as the last
command in the block. The job named "Society evolution tick" is green on a crashed runner, and nothing
measures generations-produced. **Declared** at `222` — but the step doing the work the workflow is named
for is the one step in it that is structurally unfalsifiable. Measured: 666 runs, 636 success, 22 failure.

### Tier 2 — named checks whose named subject cannot fail

| # | site | proof |
|---|---|---|
| **V-17** | `stryker-config.json:12-16` — the mutation gate is **unsatisfiable** | `"thresholds": { "high": 80, "low": 60, "break": 0 }`. Stryker.NET exits non-zero only when score `< break`; a mutation score lies in `[0,100]`, so `score < 0` has no solution. Against the workflow's own recorded 0% kill rate on 4 mutants the gate is green. `stryker-mutation.yml`: 1,744 runs, 0 failures attributable to score. |
| **V-18** | `role-ref-current-state-surfaces-lint.yml:97` — soft-launch makes `exit 1` unreachable | `check-role-ref-on-current-state-surfaces.ts:12` — `const softLaunch = !strict && (process.env.ROLE_REF_CHECK_SOFT_LAUNCH ?? "1") === "1"`; `:155` — `if (softLaunch) process.exit(0)`. The workflow passes no `--strict` and sets no env var, so `softLaunch` is unconditionally true. **836 runs, 1 failure** carry zero information about the convention. |
| **V-19** | `factory-hygiene-audit-cadence.yml:79-83` and `:114-117` — two "audits" that cannot fail on findings | `audit-skill-path-refs.ts:222` — the only `process.exit(1)` is guarded by `if (strict && stale > 0)` where `strict = argv.includes("--strict")` (`:208`), and **`--strict` is not passed**. `audit-rule-cross-refs.ts` returns `64` only on argv error (`:703`) and `return 0` on every audit path (`:716`). Both steps are labelled "report-only" (`111-113`) — and the workflow ships **no consumer of either report**. |
| **V-20** | `git-hotspot-cadence.yml:89-95` — cannot fail, including when it measured nothing | `audit-git-hotspots.ts:366` returns 0 on every non-arg-error path, and `result.emptyWindow` (*"no commits in window (or all filtered)"*) writes to stderr at `:356-360` and **still returns 0**. The uploaded artifact is the only output and nothing reads it. |
| **V-21** | `scorecard.yml` — no score is ever asserted | Runs `ossf/scorecard-action` (`91-95`) and uploads SARIF (`97-109`). `grep -nE 'threshold\|score\|jq\|fail'` over the file returns only comment prose and the workflow name. A repo whose Scorecard score drops to 1/10 produces a green `scorecard` check. 11,761 runs, 68 failures — none of them a score. |
| **V-22** | `codeql.yml:303-398` — the aggregate check is set green before any analysis runs | Five unconditional uploads (`363, 370, 377, 384, 391`) of hand-written SARIF with `"results": []`, under the same `category:` values the real `analyze` matrix uses, from a job that completes **before** `analyze` starts. If the csharp leg's `dotnet build Zeta.sln -c Release` fails, no real SARIF replaces the empty one, and the aggregate check for `/language:csharp` reads *"analysis ran, no alerts"* on a commit where the extractor never produced a database. **Declared** at `313-322` — but two things it declares are now false: the java-kotlin comment says *"we have no Java/Kotlin source"* (`324`, and again at `392`) while `git ls-files` returns `src/Core.Alloy/AlloyRunner.java` and `docs/outreach/meijer-dynamicvalue-duality/Dv.kt`, and the stated purpose — not *"tripping the `code_quality` ruleset rule"* — matches no active rule today (the only candidate, ruleset 19490341, is `copilot_code_review` and is **disabled**). The largest workflow in the set: 35,115 runs. |
| **V-23** | `codeql.yml:520-546` — a failed source count reads as "language retired" (**latent**) | `count=$(git ls-files -- '*.py' \| grep -cvE "…" \|\| true)` swallows the whole pipeline, not just grep's exit-1-on-no-match. A `grep` exiting 2 after printing `0` yields `count=0` → `has_source=false` → empty no-findings SARIF uploaded and init/build/analyze all skipped. A read error becomes a clean baseline. Latent today (71 `.py`, 2 JVM files survive the regex). |
| **V-24** | `arc-swarm-fanout.yml:36, 90-95` — simultaneously dead and, if revived, unfalsifiable | `cd data/ARC-AGI/data/training` at `:36`; `git ls-files data/ARC-AGI` returns **0** entries and `.gitignore:293` is `data/ARC-AGI/`, so under `bash -e` the `cd` aborts `setup-matrix`. And the payload is `bun … arc-harness.ts "$file" \|\| echo "Task $file failed."` (`:94`) — `\|\| echo` on the assertion itself, last command in the loop and the step, no tally, no artifact assertion, `fail-fast: false` (`60`) confirming nothing aggregates. 0 runs on record. |
| **V-25** | `build-ai-cluster-iso.yml:735-773` — the ISO is signed and never verified | `cosign sign-blob` produces a bundle; the only assertion is `test -s "${COSIGN_BUNDLE}"` (`754`). `grep -n 'verify-blob'` hits `713` and `766` — **both inside comments**. No `cosign verify-blob` executes anywhere. Non-empty is a size check, not a signature check. Admitted at `791`. |
| **V-26** | `build-ai-cluster-iso.yml:279-283, 410-434, 435-616` — the substantive install proofs are off the PR path | Longhorn PVC bind and scenario 2 are gated `github.event_name == 'push' \|\| 'workflow_dispatch'`; UEFI keyfile restore/write/picker, wifi ESP acceptance, scenarios 3 and 4 — **six assertion steps** — are `workflow_dispatch` **only**. On `pull_request` every one is `skipped`. A green PR check on this workflow means: **the ISO compiled.** Compounded by `if-no-files-found: warn` on the serial-log uploads (`454-614`), where an absent log from a step that never ran is indistinguishable from one produced by a step that ran — the ISO uploads on the same file correctly use `error`. |
| **V-27** | `build-ai-cluster-iso.yml:878-936` — the aarch64 "boot smoke-test" convicts only on positive boot failure | `case "$rc"` — arm `3` (TIMEOUT) and arm `4` (STALLED) emit a `::warning::` and fall out at status 0. An ISO that builds and hangs forever is green. Stated at `869-875` with measurement, but the step *name* over-claims it and the x86 counterpart has no such ladder, so the two arches do not prove the same thing. |
| **V-28** | `accelerator-move-next.yml:129-169` — the kill switch reads as all-green | With `events/_HALT` present every payload step is `if: steps.halt.outputs.halted == 'false'` and skips; the job concludes **success**. A halted run and a completed cycle are indistinguishable from the run conclusion. (Independently: the file's header, `14-29`, states the workflow cannot succeed — `accelerator/pr-less-git-monster` pruned, `move-next-harness.ts` absent from `main`. 1 run, 2026-05-30.) |
| **V-29** | `vocab-hygiene.yml` — a real verdict that never gates a PR | Fails on duplicate canonical home / dangling symlink / cycle / stale views — genuinely. But `on:` is `workflow_dispatch` + `push` only, so a stale vocab index lands and is caught post-merge. Not vacuous; mis-triggered. |
| **V-30** | `docker-windows-install-ps1-test.yml:120-123` — the relocation check is warn-only and swallows its probe | `try { $root = (docker info --format '{{.DockerRootDir}}') … } catch {}` — an empty `catch` means a dead daemon leaves `$root` null through all 15 iterations, then `if ($root -notlike 'D:*') { Write-Host "::warning::…" }` and the step exits 0 despite `$ErrorActionPreference = 'Stop'`. Mitigated by the next step failing; the defect is attribution. |
| **V-31** | `pr-manifest-integrity.yml:222-227` — INCONCLUSIVE exits 0, asymmetrically with its own sibling | `rc==2` → `::warning::` → `exit 0`, while the sibling coverage step (`300-306`) makes the opposite choice (`rc==2` → exit 1). Argued explicitly at `223-224`. If the positive-control population dries up, the step is permanently green and permanently uninformative. |
| **V-32** | `tlaps-proof.yml:56` — a genuine gate with 2-of-36 jurisdiction | `run-tlaps.ts` is real: it fails on `status != 0`, `/obligation.*failed/i`, `/\bunproved\b/i`, `/could not be proved/i`, and on any catalogued-but-missing spec. But `CATALOGUE = ["NciSafetyProofs", "NciNonUrgencyProofs"]` is hand-maintained while `src/Core.TLA/specs/` holds **36** `.tla` files. The header's claim that new modules *"are picked up automatically once added to the CATALOGUE"* is a tautology. A scope claim, not a vacuity — recorded because the check's name implies the wider scope. |
| **V-33** | `soraya-formal-coverage-cadence.yml` — verifies nothing formal | The only payload is `gh issue edit/comment/create` (`127-163`). No prover, no `.tla`/`.lean`, no coverage assertion. Honest at `20-24` — but a check named `soraya-formal-coverage-cadence` sitting green beside `tlaps-proof` reads as formal-verification coverage and is a reminder cron. On the existing-issue path (`127-140`) the body is deliberately not re-rendered, so a checklist nobody ticks ages forever behind a fresh date. |

### Tier 3 — vacuous by design, recorded so nobody "fixes" them

| # | site | why it is deliberate |
|---|---|---|
| D-a | `gate.yml:3589-3597` `drift-canary` | A step that fails on purpose under `continue-on-error`, forever, so `drift-loud` has a live specimen to detect. If detection breaks, `drift (loud)` goes red with `DETECTOR WENT QUIET` (`3558-3566`). It paid for itself on its first run (32651748761) by exposing that the REST jobs API reports a swallowed **step**'s conclusion as `success` and does not carry `outcome` at all — the class is unrepresentable in the data every earlier surface read. `gate.yml:3566` says in terms: *do not "fix" the failing step.* |
| D-b | `gate.yml:3484-3502` `Emit scope` | `continue-on-error` on an observability step so a render failure can never flip the verdict (`3486-3490`). Its outputs being unread is V-0's problem, not this one's. |
| D-c | `gate.yml:1713-1725` `Affected legs` | *"Nothing reads these outputs yet, and that is deliberate."* |
| D-d | `agent-heartbeat.yml:608` mutation step's terminal `exit 0` | Declared "DRIFT REPORT, NOT A GATE" at `474`. |
| D-e | `lockfile-healer.yml` — exit 2 (INDETERMINATE) is a green run | `set +e` at `140` is correctly paired and the code **is** read (`steps.detect.outputs.code == '1'`). Refusal-not-guess posture, documented. Recorded so 1,034 green runs are not read as "lockfile in sync". |
| D-f | `image-pull-measurement.yml:67, 87, 99` | Three `continue-on-error: true` on a pure-measurement workflow, declared at `26-30` (*"WHY A FAILURE IS ALSO A RESULT"*), and the outcomes **are** read downstream (`steps.hindsight.outputs.pull_seconds`, `127`). Not the dead-outcome pattern. |
| D-g | `heartbeat-liveness.yml` vs `agent-heartbeat.yml`'s in-lane cadence check | Looks redundant; is not. `heartbeat-liveness.yml:3-31`: the in-lane check *"sits inside the heartbeat job … with no `if:` — so it inherits the default `success()` gate"*, i.e. **the check built to detect silent degradation is switched off by the degradation.** Do not merge these. |
| D-h | `gate.yml:3104-3106` — `test-typescript-environment` **refusing** `continue-on-error` | The counter-example, and the sharpest sentence in the file on this subject: *"It renders a job green while it failed."* |

### A claim I checked and REJECTED

**`agent-reviewer.yml:122` is not dormant.** It was reported to me as an `if:` matching nothing —
`startsWith(github.head_ref, 'heartbeat/') && (endsWith(…, '-flush') || contains(…, '-flush-')) && !endsWith(…, '-buffer')` —
on the evidence that the last 100 runs were 100% `skipped` and that live `heartbeat/*` head refs are
`heartbeat/drift-sweep`, `heartbeat/tick-metrics`, `heartbeat/society`, `heartbeat/pr-archive`, none of
which match. Both halves of that evidence are true:

```
last 100 runs   → {"skipped": 100}
last 100 PRs    → heartbeat/tick-metrics 23, heartbeat/drift-sweep 21, heartbeat/society 16,
                  heartbeat/pr-archive 5, heartbeat/drift-dashboard 2, heartbeat/context-cost-trend 1
```

**And the conclusion is still wrong.** The most recent `success` is **2026-08-25T15:52:26Z on
`heartbeat/alexa-flush`**, and 21 of the last 300 PRs carry a `-flush` ref. The gate fires; the recent
window simply contained none. Further, when it does fire it *can* fail: `agent-reviewer.yml:158-162` sets
`set -euo pipefail` before `bun … verify-flush-batch.ts … | tee batch-report.txt`, so `pipefail` makes the
verifier's non-zero the pipeline's. **0 failures across 1,034 executed runs is "no bad batch found", not
vacuity.**

Recorded rather than deleted because the reasoning that produced it is the one this whole document warns
about: a 100% skip rate is a *prompt to look*, and looking is what refutes it. (The file's own header at
`:5` records that a genuine version of this bug did happen once — `if: startsWith(head_ref, 'flush/')`
matched nothing — which is exactly why the pattern is suggestive and exactly why it needs checking.)

### The zero-failure census — a prompt, not a finding

Nine workflows with n ≥ 50 have **never** produced a `failure` conclusion:

| workflow | runs | success | skipped | cancelled | this document's reading |
|---|---:|---:|---:|---:|---|
| `agent-reviewer.yml` | 7,746 | 1,034 | 6,290 | 1 | **checked and cleared** — see above (+421 `action_required`) |
| `lint-autofix-apply.yml` | 6,675 | 6,276 | 380 | 10 | **V-7 — no reachable non-zero path** |
| `zetadb-scheduled-node.yml` | 687 | 672 | 0 | 14 | not investigated |
| `gitbash-install-routing-test.yml` | 585 | 580 | 0 | 4 | real assertions; not investigated further |
| `keyring-dst1000.yml` | 430 | 425 | 0 | 5 | byte-lock + 1000× determinism; strong assertions |
| `mux-swarm-tick.yml` | 337 | 299 | 0 | 38 | **V-14 — proven vacuous** |
| `inventory-hardening-check.yml` | 89 | 89 | 0 | 0 | not investigated |
| `inventory-heartbeat.yml` | 67 | 67 | 0 | 0 | **suspected** — see below |
| `build-platform-images.yml` | 51 | 51 | 0 | 0 | not investigated |

**A zero-failure rate is a prompt, not a finding.** A check can be green for 7,746 runs because it is
vacuous or because the thing it checks has not broken; the count cannot tell you which. Two of these nine
are promoted on structural evidence, one is explicitly cleared, and six are left open — listed so the next
auditor starts where the prior is highest, and so nobody quotes a count as a proof.

### Suspected, unproven — stated as such

- **`gate.yml:877-884` (`lint-yaml-k8s`/kubeconform).** No `shell:`, so no `pipefail`; `find` over a
  renamed or absent directory exits non-zero and the pipeline's status becomes `xargs`'s. Verified by
  construction that the pipeline returns 0. Whether the run then reports "Valid 0" instead of erroring
  depends on GNU `xargs` invoking the command once on empty input — it does, but that link was measured
  against BSD `xargs` locally, which does not, and was **not** confirmed on an `ubuntu-24.04` runner.
  There is no `--min-files`-style floor here, unlike the siblings at `1783` (`--min-schemas 6`) and `2896`
  (`--min-files 1500`).
- **`gate.yml:3519` grep polarity.** `if echo "$results" | grep -qE '"(failure|cancelled)"'` is DENY
  polarity with no `pipefail`: a `grep` that is missing or dies on a signal makes the condition false and
  the gate **passes**. This is the shape `hygiene:no-decide-by-grep` (`gate.yml:1121`) refuses in
  workflows; it escapes the detector because the pipeline's producer is `echo`, not a tool. Practical risk
  on a hosted runner is low. Listed because it is the required check.
- **`inventory-heartbeat.yml:57-60`** asserts HTTP 200 only, while its own comment (`5-7`) says a healthy
  response is `200` **and** `[]`. A gateway or CDN 200 would satisfy the assertion without the Postgres
  query executing, so the "free-tier pause timer reset" claim at `:61` may not follow.
- **`accelerator-local-llm-validate.yml:76-79`** — `MODEL=$(grep -E '^model' … | awk '{print $2}')` then
  `ollama list | … | grep -qx "$MODEL"`. No `pipefail`, so a `grep` miss yields status 0 and `MODEL=""`,
  and `grep -qx ""` matches any empty line. Live today only because
  `tools/setup/manifests/from-ollama:23` is `model qwen2.5:0.5b`. Latent.
- **`verify-ollama-pin.yml:82-90`** — the `set +e` is correctly paired and the failing branch is genuinely
  reachable. The weakness is the assertion's breadth: every non-zero is read as *"the digest check works"*,
  so a missing `/tmp/tampered-pin.json`, a DNS failure, a `bun` crash and a 404 all satisfy it.
- **`pr-gate-presence.yml`** — the verdict is real (`required-check-started.ts:121-136` puts a
  rollup-absent PR into `stalled` when `liveRunCount === 0`; exit 2 is reserved for *unmeasured*; the
  shell block is deliberately unpiped) and it is finding real defects. Residual hole (script `362-368`): a
  gate run parked in a non-`completed` status contributes nothing to the exit code and prints *"queued,
  not stuck"* indefinitely. Whether GitHub reports approval-pending runs as `completed` was not verified,
  and **421 `gate` runs are currently in `action_required`.**
- **`society-heartbeat.yml:224-227`, `heartbeat-liveness.yml:129-133`** — plausible mechanisms, no proof;
  `assessFleetLiveness` was not read.

---

## 3. REDUNDANT — the same verdict, or the same job, computed twice

### R-1 · Eight telemetry lanes are the same workflow with three lines changed

Identical `flush-via-staging.ts prepare` + `flush` pair inside the same four-to-six boilerplate steps:

| workflow | `prepare` | `flush` |
|---|---:|---:|
| `society-heartbeat.yml` | 205 | 253 |
| `tick-metrics.yml` | 213 | 243 |
| `zetadb-scheduled-node.yml` | 87 | 120 |
| `budget-snapshot-cadence.yml` | 209 | 248 |
| `context-cost-trend-cadence.yml` | 120 | 151 |
| `drift-dashboard-cadence.yml` | 163 | 234 |
| `manifesto-citation-snapshot-cadence.yml` | 160 | 198 |
| `search-index-cadence.yml` | 152 | 220 |

`flush-via-staging.ts` is invoked **22 times** across the set.

### R-2 · The credential assert is copy-pasted byte-for-byte eight times — and missing from the ninth lane

`agent-heartbeat.yml:53-61` · `society-heartbeat.yml:55-63` · `tick-metrics.yml:67-75` ·
`budget-snapshot-cadence.yml:138-146` · `context-cost-trend-cadence.yml:70-78` ·
`drift-dashboard-cadence.yml:77-85` · `manifesto-citation-snapshot-cadence.yml:96-104` ·
`search-index-cadence.yml:81-90` — including the eight-line comment and the ~500-character `::error::`
string.

**`zetadb-scheduled-node.yml` consumes the same `ZETA_TELEMETRY_FLUSH_TOKEN` (`:74`) with no assert and no
preflight.** If that secret is absent or denied, `actions/checkout` proceeds with an empty token and the
failure surfaces later inside `flush-via-staging.ts`, naming the wrong subject — which is exactly what the
assert prevents in its eight siblings. **The divergence in duplicated boilerplate is producing coverage
holes**, which is the argument for R-1 stated as a defect rather than as tidiness.

### R-3 · The credential preflight covers four of nine branch-push lanes

Identical ~50-line probe/swap/re-probe at `agent-heartbeat.yml:129-178` · `society-heartbeat.yml:138-186` ·
`tick-metrics.yml:149-197` · `drift-dashboard-cadence.yml:117-149`, differing only in the
`credprobe/<lane>` ref and a log prefix. Absent from `budget-snapshot-cadence.yml`,
`context-cost-trend-cadence.yml`, `manifesto-citation-snapshot-cadence.yml`, `search-index-cadence.yml`
and `zetadb-scheduled-node.yml` — all of which push `heartbeat/*` with the same PAT. (And where it is
present, it cannot fail — V-15.)

### R-4 · Two Ollama installs; the security fix landed on one

- `agent-heartbeat.yml:236` — `install-pinned-artifact.ts --pin .github/ollama-pin.json`, with 46 lines
  (`188-233`) explaining that `curl … | sh` was removed as an undeclared, unmetered channel (manifesto §13).
- `mux-swarm-tick.yml:41` — `curl -fsSL https://ollama.com/install.sh | sh`.

Both then pull the same model (`qwen2.5:0.5b`, `280` and `45`).

### R-5 · Two tracking-issue cadences that are structurally one workflow

`razor-cadence.yml:97-184` and `soraya-formal-coverage-cadence.yml:92-164` are the same sequence: checkout
→ `gh auth status` → read `tools/*/issue-body-template.md` → substitute `RUN_ID_PLACEHOLDER` →
`gh issue list --label X --state open --limit 1 --jq '.[0].number // empty'` → edit-or-create with an
`AI_FOOTER`. The `gh label create … 2>"$label_err"` / `grep -q "already exists"` idiom appears a **third**
time at `heartbeat-liveness.yml:166-173`.

### R-6 · Four workflows share one trigger over `memory/**`

`memory-index-drift.yml`, `memory-index-integrity.yml`, `memory-index-duplicate-lint.yml`,
`memory-reference-existence-lint.yml` all fire on `pull_request` + `push:[main]` with
`paths: ["memory/**"]`, each paying its own checkout. Combined: **11,851 runs.** They compute genuinely
different verdicts, so this is a *combine* candidate (four jobs, one workflow, one checkout), not a delete
candidate. Cost note: `memory-index-drift.yml` runs the full `./tools/setup/install.sh` (median 2.6 min,
`timeout-minutes: 20`) to execute one bun script, where `memory-index-integrity.yml` does the same class of
work with no install at all (median 0.4 min, `timeout-minutes: 5`).

### R-7 · Four cadences pay `install.sh` for bun-only work

`budget-snapshot-cadence.yml:175-188` · `git-hotspot-cadence.yml:74-87` ·
`manifesto-citation-snapshot-cadence.yml:131-144` · `search-index-cadence.yml:122-134`, each carrying the
same twelve-line `ZETA_HOST_TIER: slim` comment block on jobs whose own comments say every payload step is
"bun/git/gh only". Their siblings use `oven-sh/setup-bun` (`context-cost-trend-cadence.yml:107-108`,
`drift-dashboard-cadence.yml:151-152`, `factory-hygiene-audit-cadence.yml:74-77`). The `install.sh` choice
is what forced their `timeout-minutes` from 5 up to 12/20.

### R-8 · Scripts invoked from more than one workflow

| script | workflows |
|---|---|
| `flush-via-staging.ts` | 8 (R-1), 22 invocations |
| `lane-partition.ts` | `k8s-lane-partition.yml` (7 invocations) |
| `verdict-drought.ts` | `gate.yml:3693`, `drift-sweep.yml:539` |
| `required-check-started.ts` | `pr-gate-presence.yml`, `agent-heartbeat.yml:2292`, `agent-reviewer.yml` |
| `derive-pr-manifest.ts` | `agent-heartbeat.yml:1075`, `pr-archive-on-merge.yml`, `pr-manifest-integrity.yml` |
| `reconcile-rulesets.ts` | `github-settings-drift.yml:226`, `ruleset-apply.yml:82, :92` |
| `audit-pr-archive-coverage.ts` | `agent-heartbeat.yml`, `pr-manifest-integrity.yml` |
| `archive-pr-reviews.ts` | `agent-heartbeat.yml:994`, `pr-archive-on-merge.yml` |
| `audit-chart-target-revisions.ts` | `gate.yml:2761`, `chart-version-refresh.yml` |
| `image-source-provenance.ts` | `gate.yml:2786`, `chart-version-refresh.yml` |
| `audit-orphaned-archive-refs.ts` | `gate.yml:2706` (fatal), `pr-archive-on-merge.yml` (tolerated) |
| `audit-proof-lineage-binaries.ts` | `gate.yml:2513`, `scorecard.yml` |
| `lint-drift-publication-lands.ts` | `gate.yml:1814`, `drift-dashboard-cadence.yml`, `drift-sweep.yml` |
| `reason-truth.ts` | `gate.yml:2813`, `k8s-argocd-health-test.yml` |
| `audit-flash-entrypoint-parity.ts` | `gate.yml:2747`, `build-ai-cluster-iso.yml` — gate's comment (`2740-2745`) says it was **moved** to gate, yet the ISO-lane reference remains |

Most are deliberate offline/network splits documented at the call site. The last row is not.

### R-9 · Two `markdownlint-cli2` pins over the same glob

`gate.yml:2028`/`:2032` uses `bunx --no-install markdownlint-cli2` (lockfile-pinned);
`drift-sweep.yml:251` uses `bunx markdownlint-cli2@0.22.1` (pinned in the command). Same `"**/*.md"` glob,
two version sources that can diverge. `lint-autofix.yml` (`67`, `98`) runs a third, partial-fix variant.

### R-10 · The `install.sh` retry wrapper, inline eight times in one file

`gate.yml` `1019-1038, 2232-2245, 2279-2292, 2326-2339, 2373-2386, 2420-2433, 3151-3164, 3236-3244` — with
`full-verify`'s copy (`3241`) using `backoff=$((attempt * 30))` where the other seven use a 10/30/60/120
`case` ladder. The file names this itself at `1009-1012` as *"a follow-up improvement candidate."* The
eleven-path `actions/cache` block is copy-pasted **eleven times** (`652, 727, 938, 1455, 1514, 1570, 2209,
2256, 2303, 2350, 2397, 3125`) plus a twelfth near-copy under a different key prefix (`3212-3227`).
`./tools/setup/install.sh` is invoked by `gate.yml` **plus 29 other workflows**.

### R-11 · One SHA-pin whose human-readable label is wrong

`actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` appears 25 times. Twenty-four are
annotated `# v7.0.1`; **`ruleset-apply.yml:104` says `# v4.6.2`.** At most one label is true, and a
SHA-pin whose comment is wrong defeats the review step the pin exists for. One site, mechanical to fix,
and mechanically checkable.

---

## 4. COMBINE or SPLIT

### `gate.yml` — 3,694 lines, 33 jobs, four `needs` edges

**22 of 33 jobs are isolated islands.** The seams are nearly free; the reason to split is not coupling but
attribution and trigger selectivity.

```
matrix-setup ─┐
              ├─> build-and-test ─┐
path-filter ──┤                   ├─> gate-required ─> drift-loud
              └─> full-verify ────┤                 ┌─┘
lint, lint-typescript, cross-verify, test-typescript-hermetic ─┘
drift-canary ──────────────────────────────────────────────────┘
```

| cluster | jobs (line ranges) | why it is a seam |
|---|---|---|
| **A · Build/test core** | `matrix-setup` 118-199 · `path-filter` 200-308 · `build-and-test` 309-615 · `full-verify` 3201-3333 | The only cluster with internal edges. Sole consumer of the .NET / seven-language toolchain and the dynamic OS matrix. ~730 lines. |
| **B · Semgrep pair** | `lint` 616-711 · `lint-semgrep-drift` 712-755 | Same tool, same install; split only by floor vs drift ruleset. |
| **C · Cluster & YAML** | `lint-yaml-k8s` 756-924 | Distinct toolchain (yamllint, kubeconform, `go install`), distinct subject trees, and the only real candidate for a `paths:` filter. Overlaps `helm-validate.yml`, `k8s-lane-partition.yml`, `agentic-organization-tests.yml`. |
| **D · Per-language lints** | `lint-fsharp` 2202-2248 · `lint-csharp` 2249-2295 · `lint-go` 2296-2342 · `lint-python` 2343-2389 · `lint-rust` 2390-2436 | Five near-byte-identical 47-line jobs differing only in the final `run:`. ~200 of 235 lines duplicated. The file flags this itself at 1009-1012 and 2197-2199. |
| **E · Docs/text hygiene** | 1396-1433 · 1434-1488 · 1489-1547 · 1548-1598 · 1599-1652 · 1980-2034 | Six bun-only jobs over `docs/**` / `memory/**` — exactly what `path-filter` already classifies as docs (281-294). None in the floor. |
| **F · Repo-structure hygiene** | `lint-bash-retirement-inventory` 1062-1361 · `build-graph-completeness` 1653-1726 · `lint-structural-hygiene` 1727-1899 · `lint-no-empty-dirs` 1900-1979 | ~490 lines, ~50 distinct audits. `lint-bash-retirement-inventory` alone is 300 lines running 14 unrelated checks **under one red X** — the attribution problem the 2026-06-13 per-language split already solved once in this same file (3005-3008). |
| **G · Shell/workflow shape** | `lint-shell` 925-1061 · `lint-workflows` 1362-1395 | The only two jobs whose subject is CI text itself. |
| **H · TS & app builds** | `lint-typescript` 2035-2109 · `lint-twitch-ai` 2110-2155 · `lint-identity-dla` 2156-2191 | Two are self-contained Vite/pnpm workspaces with their own lockfiles; both explicitly "drift check, not floor" (2123-2125, 2171-2173). |
| **I · Cross-verification** | `cross-verify` 2437-2936 | **500 lines, ~34 steps**, of which roughly 24 are unrelated repo audits (credential-role separation, co-author identity, archive refs, chart revisions, tech radar, TOCTOU, NUL bytes, concept registry) parked here *because it is the floor job that runs on every PR* — each comment says so. Genuine treaty content is ~6 steps (2486-2498, 2899-2935). **The strongest split candidate in the file, and the most consequential: every one of those 24 audits currently blocks merges by adoption rather than by decision.** |
| **J · TS suites** | `test-typescript-hermetic` 2937-3085 · `test-typescript-environment` 3086-3191 | Already split along a failure-attribution boundary (2938-2946, 3087-3093); different install profiles, different floor status. |
| **K · Roll-up & observability** | `gate-required` 3346-3526 · `drift-canary` 3580-3602 · `drift-loud` 3606-3694 | ~350 lines, sparse-checkout + bun only. `gate-required` cannot leave — its `needs:` **is** the floor — but `drift-canary` + `drift-loud` could move out wholesale via `workflow_run`. |

**Do not split cluster A, and do not move `gate-required`.** A split that puts a floor job in another
workflow makes its result invisible to `needs:`, which is the mechanism V-0 already exploits. Any split of
a floor job must be paired with a ruleset amendment adding the new check context — the human decision this
document is not making.

Volumetric note, because it changes what "3,694 lines" means: comments dominate. `build-and-test`'s
pre-`steps:` header is 181 lines (309-489) for 125 lines of steps; `cross-verify` runs roughly 4:1
comment-to-code; `test-typescript-hermetic` carries 90 header lines before its `name:`. This is not 3,694
lines of logic, and a line-count-driven split would cut in the wrong places.

### `agent-heartbeat.yml` — 2,299 lines, **2 jobs**, ~80% comments

The executable surface is 24 steps. The `heartbeat` job (31-1435) is **seven independent duties sharing one
working tree and one push**, and the coupling is stated at 1196-1208: *"This job has exactly ONE push.
Every step that produces an artifact must therefore run BEFORE it."*

| seam | lines | shares with the rest | note |
|---|---|---|---|
| **S1 · model provisioning + consumers** | 188-291, 322-371, 1145-1188 | only `docs/observe-events/` | the only steps needing Ollama; 213-214 says so explicitly |
| **S2 · GitHub-API bookkeeping** | 679-867 (alexa merge duty), 869-1143 (soraya archive duty) | `gh`, `docs/github/prs/`, `docs/history/pr-reviews/` | needs no model, no lane semantics |
| **S3 · hygiene / self-measurement** | 373-442, 450-608, 610-677, 1274-1309, 1311-1397 | `db/`, `data/` | no model, no PR API |
| **S4 · lane state + push** | 293-320, 1209-1231, 1399-1435 | the branch | the irreducible core of "a heartbeat" |
| **S5 · flush** | 1437-2299 | already a separate job | 863 lines, 5 steps |

**The measured cost of not splitting:** `ollama pull qwen2.5:7b` (`:290`) runs unconditionally for every
agent on every tick — 3 agents × 96 ticks/day = **288 pulls/day of a ~5 GB model**. Its only consumer is
the codegen step (`1151`, `1173`), gated to one agent per hour by `HOUR % 3` (`1157-1165`), so at most 96
uses/day. **At least 192 full 5 GB pulls a day serve no consumer.** Separately, for `agent=alexa` five
steps are pure early-exits (`378-381, 875-878, 1240-1243, 1279-1282, 1303-1305`): the matrix multiplies
duty-gated steps by three and discards two thirds of the result.

One documented mismatch to fix along the way: the comment at `1153-1156` claims the codegen tick is
*"enforced by checking if a work event was already committed this hour (idempotent)"*. **No such check
exists** — the code (`1157-1165`) tests only `HOUR % 3` against the agent roster, so the step fires on all
four ticks of its hour: 96 times a day where the comment claims 24.

### Other combine candidates

| candidate | rationale |
|---|---|
| Eight telemetry lanes → one `workflow_call` lane taking `(lane, paths, message, payload-step)` | R-1/R-2/R-3: they differ in about three lines each, and the boilerplate divergence is already producing coverage holes |
| `razor-cadence.yml` + `soraya-formal-coverage-cadence.yml` → one `tracking-issue-cadence` with `(label, template, colour, cron)` | R-5 |
| `factory-hygiene-audit-cadence.yml`'s four jobs (63, 94, 128, 149) → one job | Four full checkouts + four `setup-bun` for one ~5-second bun command apiece, once a day |
| The four `memory/**` workflows → one workflow, four jobs, one checkout | R-6 |

### The schedule is the other thing that needs splitting

32 cron expressions across the set. Same-minute collisions:

| minute | workflows firing together |
|---|---|
| `:00 :15 :30 :45` | `agent-heartbeat.yml:19` · `heartbeat-liveness.yml:42` · `tick-metrics.yml:35` · `pages-deploy.yml:13` · `rerun-toolchain-install-stall.yml:103` — **five on `*/15`** |
| `:00 :30` | + `society-heartbeat.yml:25` |
| **top of every hour** | + `mux-swarm-tick.yml:5` (`0 * * * *`) and `lockfile-healer.yml:59` (`*/17` hits minute 0) — **eight workflows on one minute, 24×/day**; nine at 06:00 (`low-memory.yml:74`) |
| `:37` hourly | `drift-sweep.yml:83` (`7,37 * * * *`) collides with all three daily `:37` cadences — `manifesto-citation-snapshot-cadence.yml:51`, `soraya-formal-coverage-cadence.yml:50`, `factory-hygiene-audit-cadence.yml:41` |
| `:23` | `pr-gate-presence.yml:61` (hourly) · `pr-manifest-integrity.yml:68` and `proof-closure-drift.yml:36` are **both** `23 */6 * * *` |
| `:13 :43` | `zetadb-scheduled-node.yml:48` · `mirror-to-fork.yml:55` (`13 */6`) |

Several of those files carry comments claiming their offset avoids a thundering herd
(`manifesto-citation-snapshot-cadence.yml:49-50`, `soraya-formal-coverage-cadence.yml:48-49`,
`factory-hygiene-audit-cadence.yml:40`, `pr-gate-presence.yml:62`). **Those comments are stale against the
current set** — every one of those minutes now has company.

**Not cosmetic, and the consequence is already measured in-repo.** `heartbeat-liveness.yml:14-19`:

> *"the lane fired **84 scheduled runs against the 100 slots** a 15-minute cron declares (16% dropped),
> with inter-run gaps of 12..43 minutes (p50 16, p90 27) and whole hours reduced to one or two runs."*

`agent-heartbeat.yml:1522-1526` reaches the same conclusion independently and is why its flush gate is
elapsed-time-based rather than minute-window-based.

There is also a **feedback amplifier** invisible in the cron alone: `tick-metrics.yml:30-33` triggers on
`push` to `docs/observe-events/**` — the exact path `agent-heartbeat.yml:1218` and
`society-heartbeat.yml:255` flush to `main`. Every landed flush PR adds a `tick-metrics` run on top of its
96 scheduled ones. `zetadb-scheduled-node.yml:43-46` has the same shape.

---

## 5. DEAD — never triggered, or gated on something that does not exist

### The gating ground truth

```
GET /repos/Lucent-Financial-Group/Zeta/actions/variables      → 2   COPILOT_AGENT_FIREWALL_ENABLED,
                                                                    COPILOT_AGENT_FIREWALL_ALLOW_LIST_ADDITIONS
GET /orgs/Lucent-Financial-Group/actions/variables            → 0   {"total_count":0,"variables":[]}
GET /…/environments/{copilot,github-pages}/variables          → 0   each
GET /repos/Lucent-Financial-Group/Zeta/actions/secrets        → 15
```

**Every `vars.X` other than those two names expands to the empty string.** There is now exactly one `vars.`
reference left in the whole set, and it is inside a comment.

### D-0 · `mirror-to-fork.yml` — the named instance, now fixed, with the damage measured

The variable `ACEHACK_MIRROR_ENABLED` **has never existed**. The job's `if:` required it to equal `'true'`,
so the job reported `skipped` on every event since the file was written, the run reported success, and the
only off-site copy of this repository silently stopped being a copy.

| runs | success | failure | cancelled | **skipped** |
|---:|---:|---:|---:|---:|
| 23,375 | 5 | 28 | 1,922 | **21,418** |

Twenty-one thousand four hundred and eighteen runs that reported nothing wrong while doing nothing at all.
The divergence lasted ten weeks: origin 8,107 commits ahead, the fork 73 ahead across 1,084 branches
carrying 2,191 commits origin could not reach.

The fix is on `main` and it is the right one — the enablement variable was **deleted rather than created**,
so a missing credential now fails loudly in the push step instead of gating the whole job into a silent
skip. Its own comment states the general rule this audit endorses:

> *"A kill switch nobody can see the state of is worse than no kill switch. If one is wanted again, it
> belongs in a place a reader can check — and its absence must fail loudly, not skip quietly."*

The five successes above are post-fix. (The two grep hits for `vars.ACEHACK_MIRROR_ENABLED` at lines 21 and
69 are the comment documenting the historical bug; the live `if:` at `89` is
`github.repository == 'Lucent-Financial-Group/Zeta'`.)

### D-1 · Six referenced secrets do not exist

| secret | referenced at | consequence |
|---|---|---|
| `SCAFFOLD_STAGE1_PAT` | `scaffold-stage1-create-repos.yml` 119, 128, 150, 158, 166 | **0 runs, ever.** Dispatch-only; `gh auth status` would fail under `set -euo pipefail` — fail-closed, costs nothing until triggered |
| `RULESET_ADMIN_TOKEN` | `ruleset-apply.yml` 64, 78, 92 | the refusal step fails **loudly and correctly** (D-2) |
| `RULESET_READER_TOKEN` | `github-settings-drift.yml:211` | ruleset drift **has never been checked** — V-6, annotation confirmed live |
| `DRIFT_DETECTOR_PAT` | `github-settings-drift.yml:129` | ~27 recorded settings fields go unverified on every run; announced in an annotation |
| `ZETA_REALTIME_URL` | `society-heartbeat.yml:211` | dead three ways over — below |
| `SLACK_WEBHOOK_URL` | `gate.yml:3313` | `full-verify`'s failure notification never fires; guarded by `if [ -n … ]` at `3315`, so a silent no-op |

**`ZETA_REALTIME_URL` deserves its own paragraph**, because it is dead in three independent ways and each
alone would suffice:

1. The secret does not exist, so the env var is always empty.
2. `society-evolution-runner.ts` — the script that env block feeds (`society-heartbeat.yml:224`) — **does
   not read `ZETA_REALTIME_URL` at all**. The repo-wide readers are
   `src/Core.TypeScript/observe/run-loop-real.ts:464` and `src/Core.TypeScript/discovery/zeta-agent.ts:214`.
3. The workflow that *does* invoke `run-loop-real.ts` — `agent-heartbeat.yml:322-327` and `:1145-1151` —
   **does not set `ZETA_REALTIME_URL` in either env block.**

So the "§13 declared channel" for real-time evolution events is wired to the one lane whose script ignores
it, absent from the two lanes whose script honours it, and backed by a secret that was never created.
Nothing fails; the channel simply never opens.

**Three secrets exist and are referenced by no workflow:** `INVENTORY_ADMIN_EMAIL`,
`INVENTORY_ADMIN_PASSWORD`, `ZETA_SOCIETY_DISPATCH_TOKEN`. The last is named in prose in eight places
(`agent-heartbeat.yml:97, :2186`; `society-heartbeat.yml:103`; `tick-metrics.yml:115`; …) as "the dispatch
role", consistent with the gate-dispatch belt having been removed (`agent-heartbeat.yml:2112-2161`).
Recorded so a reader does not mistake a named credential for an active grant. (These, plus the five keyring
secrets and `ZETA_TEST_INFRA_SSH_KEY`, may be consumed outside `.github/workflows/`; not audited.)

### D-2 · `ruleset-apply.yml` is the model for how a missing credential should behave

```bash
          if [ "$HAS_TOKEN" != "true" ]; then
            echo "::error::RULESET_ADMIN_TOKEN is not configured — refusing to run."
            echo "A reconciler that silently no-ops without its credential is a check that did not run."
            exit 1
          fi
```

`ruleset-apply.yml:64-72`. **1 run, 1 failure**, with the per-step conclusions confirming the refusal fired
where it should:

```
apply ruleset desired state: failure
   4. refuse to run without an admin credential = failure
   5. plan                                      = skipped
   6. apply and verify                          = skipped
```

Contrast `mirror-to-fork.yml`'s 21,418 silent skips. Same situation — a credential never provisioned — and
opposite readings. **This is the shape to copy.** Note the consequence, though: combined with V-6, the
entire ruleset-as-code loop — **plan and apply both** — has never run, and this is a permanent red on any
push touching `docs/operations/rulesets/**`.

### D-3 · Four workflows have never run

| workflow | triggers | runs |
|---|---|---:|
| `agentic-organization-integration.yml` | `workflow_dispatch` only | 0 |
| `arc-swarm-fanout.yml` | `workflow_dispatch` only | 0 (also V-24 — dead `cd`) |
| `passkey-proposal-gated-commit.yml` | `issues` | 0 |
| `scaffold-stage1-create-repos.yml` | `workflow_dispatch` only | 0 (also D-1) |

Three are dispatch-only, so they cannot fire accidentally and their cost is zero — dormant tools, not
defects. **`passkey-proposal-gated-commit.yml` is the one that should raise a question:** it is triggered by
`issues`, an event this repo does emit, and it has still never run.

Near-dead, for completeness: `accelerator-move-next.yml` (1 run, 2026-05-30),
`accelerator-local-llm-validate.yml` (8, last 2026-05-30), `agent-proposal-gated-commit.yml` (3, last
2026-08-17), `interp-lane.yml` (3), `agentic-organization-tests.yml` (2).

### D-4 · Dead branches inside live workflows

- **`gate.yml:3317-3319`** — `if [ "${{ github.event_name }}" = "schedule" ]` inside `full-verify`'s notify
  step. `gate.yml`'s `on:` (`83-89`) declares `pull_request`, `push`, `merge_group`, `workflow_dispatch`
  and **no `schedule:`**; the file says so at `187-188` and `346-348`. `elevated-unattended` can never be
  set. (The `curl -s` two lines later carries no `-f`, so a Slack 4xx/5xx also returns 0 — moot while the
  secret is absent.)
- **`agent-heartbeat.yml:1454`** — `if: always() && (github.event_name == 'workflow_dispatch' || github.event_name == 'schedule')`.
  `on:` declares exactly those two events (`18-20`), so the disjunction is a tautology. Harmless
  (`always()` is the load-bearing half) but noted because **the inverse mistake in this same slot cost the
  job five days of never running** (`1444-1447`).
- **`drift-dashboard-cadence.yml:248-254`** — the `''` case alternative is unreachable under
  `status="${PASS_STATUS:-0}"`, because `${VAR:-0}` never yields the empty string. The case this guard
  exists for — the pass step dying before writing its output at `:180` — is silently coerced to `0`, i.e.
  **"dashboard OK"**. The comment three lines up (`243-247`) states the intent to *"REFUSE what we cannot
  read"*; the code defaults it to success. (Currently masked: 14 runs, 14 failures, 100% red for other
  reasons.)
- **`gate.yml:1051`** — the `-not -path "src/Core.Lean4/.lake/*"` predicate inside `lint-shell`. `find` is
  rooted at `tools`, so every printed path begins `tools/` and the pattern can never match. **Measured
  inert:**

  ```
  $ find tools -name '*.sh' -type f -not -path 'src/Core.Lean4/.lake/*' | wc -l
        22
  $ find tools -name '*.sh' -type f | wc -l
        22          ← identical; the exclusion removes nothing
  ```

  The comment at `1041-1043` additionally claims the scope is `tools/setup/` while the command scans all of
  `tools`, and there is no scan floor (V-13) — compare the siblings at `1783` (`--min-schemas 6`) and
  `2896` (`--min-files 1500`).
- **`github-settings-drift.yml:226-233`** — the five-way exit-code `case`, unreachable behind `217`'s
  `exit 0` (V-6).

### D-5 · A check that exists and is wired to nothing

`src/Core.TypeScript/hygiene/audit-research-docs.ts` — a complete audit with a test file beside it — is
referenced by **no workflow**. Its only repo-wide mention outside its own directory is a line in
`lint-no-culture-sensitive-collation.baseline.json`. Not a workflow finding, but the same class one level
down: a detector that cannot fire because nothing calls it.

---

## 6. REPORT BUT CANNOT BLOCK — deliberate versus accidental

The structural answer comes first: **81 of 82 workflows cannot block a merge, because the only ruleset with
a `required_status_checks` rule names one context.** So this section is not "which workflows are
non-blocking" — nearly all are — but "which non-blocking is a decision and which is an accident."

### Deliberate, documented, measured — leave these alone

| # | surface | the decision, and its evidence |
|---|---|---|
| B-1 | `gate.yml:475` — Windows/macOS `build-and-test` legs under `continue-on-error` | Aaron, 2026-08-19, at `3400-3402`: *"we are moving away from anything that blocks into drift checks instead."* Measured at `426-433`: **152 runs carrying Windows legs; windows-2025 failed 12 (7.9%), windows-11-arm 9 (5.9%)**, and in all 11 instances since `gate-required` existed the required check reported green beside the red leg. Fixture at `src/Core.TypeScript/ci/fixtures/gate-run-jobs-windows-failed.json`. Independently reproduced here: of 300 recent green gate runs, **8 carried a failed platform leg** (7 windows-2025, 5 windows-11-arm, 1 macos-26). The leg's own check run still concludes `failure`, so there is a red X in the PR list, and `platform-drift-report.ts` folds the rate into `data/platform-drift.json`. **What breaks if you make it blocking:** roughly one in thirteen Windows-carrying runs blocks the merge on a platform the floor deliberately narrowed to Linux — and the ADR named the resulting priority inversion as the reason for the flip. |
| B-2 | The 22 gate jobs outside `needs:` | drift-and-heal ADR, `gate.yml:3381-3395`. Every hygiene lint still runs on every PR and every main push — *that* is the drift detection — it just no longer blocks unrelated lanes. **What breaks if you make them blocking:** the 2026-07-08 priority inversion and the 2026-08-01 six-rebuild race, by name. |
| B-3 | `drift-canary` + `drift (loud)` (`gate.yml:3580-3694`) | Aaron, 2026-08-23, at `3529`: *"we want drift to be LOUD so the red is immediately noticed, not a whisper — just not blocking."* Adding either to the floor would be a treaty amendment, deliberately not done. |
| B-4 | `pr-gate-presence.yml` | Its own header: *"RUNS, BLOCKS NOTHING. It is absent from `gate (required)`'s needs list and adding it there would be a treaty amendment, not a workflow edit."* Its red is a red X plus an `::error::` annotation. |
| B-5 | `github-settings-drift.yml` advisory lane | *"absence is INDETERMINATE ('this check DID NOT RUN'), never success, and it never blocks the merge"* (`198-206`). Caveat in V-6. |
| B-6 | `gate.yml:3104-3106` — `test-typescript-environment` **refusing** `continue-on-error` | The counter-example, and the sharpest sentence in the file on this subject: *"It renders a job green while it failed."* When a non-blocking job is wanted, this repo makes it a non-floor job with a real red X, not a green job with a swallowed step. |
| B-7 | `drift-sweep.yml:538-546` — the drought detector that survives cannot convict | `verdict-drought.ts --report-only` returns 0 (*"this host never goes red"*, `:919`); the convicting copy lives in `gate.yml`'s `drift (loud)`, which this file's own comment (`518-522`) says *"is cancelled by exactly the condition it reports."* Self-documented. Recorded here rather than as a defect, but it is the weakest of the deliberate set: a verdict drought currently produces an annotation and no failing check anywhere. |

### Accidental — non-blocking nobody chose

| # | surface | why it is an accident |
|---|---|---|
| A-1 | **V-0** — the `matrix-setup`/`path-filter` gap | Nothing in `gate.yml`'s 3,694 lines mentions this trace. The file discusses `skipped`-as-success at length (`3436-3452`) and treats it entirely as the path-filter case. The other producer of the same word is unaddressed. |
| A-2 | **V-1** — BD001 blind to a cancelled gate run | The detector for "main is red" cannot see the dominant reason main's verdict is missing. |
| A-3 | **V-3, V-4, V-5** — three `bash -e` / pipeline-status defects | The correct form is documented at length inside this repo and used correctly in four files. These three did not get it. Nobody decided that a REFUTED claim and a tooling failure should be indistinguishable, or that a reconciler should refuse to reconcile. |
| A-4 | **V-6** — the ruleset half of `github-settings-drift.yml` | The *advisory* register is deliberate. Never having run at all, for the entire life of the workflow, is not. |
| A-5 | **V-17 through V-20** — `break: 0`, `softLaunch` on by default, `--strict` not passed, scripts returning 0 on every audit path | "Report-only" was a decision; shipping no consumer of the report was not, and an unsatisfiable threshold is not a register choice. |
| A-6 | **V-12** — `continue-on-error` on `id:`-less steps | Whatever degradation policy was intended is unexpressible: with no `id:`, no `if:` can read the outcome. |
| A-7 | **V-14** — `mux-swarm-tick.yml` | 299 green runs whose output never left the runner. The push step is simply absent. |
| A-8 | **V-29** — `vocab-hygiene.yml` has a real verdict and no `pull_request` trigger | A working check pointed at the wrong moment. |

### Two rates that make "non-blocking" the wrong question

Neither is about blocking, and both dominate it in practice:

- **19.2% of `gate` runs are cancelled** — 6,817 of 35,467. The workflow-scoped concurrency group
  (`gate.yml:106-108`) cancels the in-flight run on every merge to `main`; `gate.yml:3672-3678` records
  three merges landing inside 24 seconds against a ~14-minute gate, so *"the commits in between carry NO
  verdict at all."* Push-run coverage on main is measured at **16.4% — 82 of 500 completed runs executed
  their matrix**. Across all 82 workflows the cancellation rate is **10.0%** (22,476 of 224,291) and the
  skip rate **15.5%** (34,849).
- **421 `gate` runs sit in `action_required`** — awaiting approval, therefore never producing
  `gate (required)` at all. That is the population `pr-gate-presence.yml` exists to find; it measured four
  of 42 open PRs carrying no required check on 2026-08-24, one of which had zero `gate.yml` runs for its
  branch ever.

A required check that is cancelled 19% of the time and absent on some PRs entirely is a weaker guarantee
than a vacuous check is a false one. **Both are the same failure — a check that did not run — and the
cancellation rate is the larger of the two by orders of magnitude.**

---

## 7. The patterns that work — copy these

An audit that only names defects gives no target. Six surfaces in this set are built correctly and three of
them are already the answer to findings above.

| surface | what it does that the rest should |
|---|---|
| **`helm-validate.yml`** | **Every validator is paired with a mutation suite proving it exits 1.** Tab indent + unterminated quote, a duplicate `destination.namespace` key, `targetRevision: 999.999.999` — each has a committed case that must go red. Plus a failure-count ratchet. This is the only file in the set that treats "can this check fail?" as a test rather than as a claim, and it exists *because* it once could not go red (`docs/history/pr-reviews/PR-10647-*`). Today: 329 runs, 296 success, 8 failure, 25 cancelled. |
| **`lean-proof.yml`** | Carries its own anti-vacuity loop: ~24 `#print axioms` audits denying `sorryAx` / `ofReduceBool` / `Unknown constant`, plus a no-orphan-modules check. A `sorry` makes a file compile, so a green build is not evidence — and this file says so and then checks it. |
| **`search-index-cadence.yml`** | The best cadence gate in the set, and the antidote to V-19/V-20: `manifest.rev == BUILT_REV`, `fileCount >= 1000`, `termCount >= 10000`, and an end-to-end `landauer` query that must return matches. Floors, not reports. |
| **`zflash-harness-lint.yml:99-127`** | Asserts the fail-closed runtimes exit **exactly 1** *and* print the string `"fails closed"`. Asserting the exit code and a content marker is what `verify-ollama-pin.yml` (above, "suspected") is missing. |
| **`bytelock.yml`** | Has a **liveness floor**: fewer than 9 substrates present ⇒ exit 2. That single line is what V-13's three `mapfile` sites and `gate.yml:1054`'s `exit 0` are missing. |
| **`k8s-argocd-health-test.yml`** | 41 `\|\| true` occurrences and **zero vacuous assertions** — all of them sit on `kubectl`/`jq` diagnostics under `if: always()`, downstream of assertions that already ran, and its two `tee` pipelines carry explicit `set -o pipefail` with a comment saying why. |
| **`github-settings-drift.yml`'s annotations** | *"…match the committed record across every field this credential could read"* + *"27 recorded field(s) were NOT verified"*. **A degradation that announces its own scope is not a substitution.** |

**And the negative lesson about detectors:** `k8s-argocd-health-test.yml` has 41 `|| true` hits and is the
most carefully built file in the set; `proof-closure-drift.yml` has **zero** `|| true` and is fully vacuous
(V-3). **A grep count is not a finding.** The signal is *where* the suppression sits — on the assertion, or
downstream of it.

### The three cheapest mechanical falsifiers, and why they do not exist yet

`src/Core.TypeScript/hygiene/` already carries six workflow auditors — `audit-workflow-cli-flags`,
`audit-workflow-credential-role-separation`, `audit-workflow-step-output-has-writer`,
`audit-workflow-write-token-consistency`, `lint-workflow-job-timeouts`, `audit-action-sha-roster`. **None
covers this class.** Each of the following is roughly a 50-line audit and each would have caught findings
above mechanically:

1. **`audit-workflow-vars-resolve.ts`** — assert every `vars.X` is in the repo's variable set. One
   `gh api /actions/variables` call. **Would have caught the ten-week mirror outage on the day the gate was
   written** (D-0).
2. **`audit-workflow-assertion-survives-pipe.ts`** — flag any `run:` block lacking `shell: bash` /
   `set -o pipefail` that pipes a `bun`/`node`/`bunx` invocation into `tee`/`jq`/`head`/`tail`/`wc`, or that
   reads `rc=$?` after a bare command under `set -uo pipefail`. Catches **V-1(b), V-3, V-4, V-5, V-23** and
   the two `mapfile` sites in V-13.
3. **`audit-continue-on-error-has-reader.ts`** — every step with `continue-on-error: true` must carry an
   `id:` and be referenced by a `steps.<id>.outcome` somewhere in the file. Catches **V-12** exactly;
   `image-pull-measurement.yml` and `proof-closure-drift.yml` would correctly pass the `id:` half.

None of these blocks anything, and each is a falsifier for a class this repo has now rediscovered by hand
at least four times.

---

## 8. What I could not verify

Stated plainly, because an audit that does not mark its own boundary is the class it is auditing.

1. **No mutation was run against a live workflow.** V-0's traces are proofs by construction from GitHub's
   documented job semantics plus three quoted declarations; they were not demonstrated by breaking
   `path-filter` on a branch and observing a green gate. That experiment is cheap and is the obvious
   confirmation — it was not run because this PR is forbidden from touching workflow behaviour, and a
   throwaway branch that deliberately reddens the floor is a change to what CI does. The same applies to
   V-1(a): a cancelled `gate` run reaching BD001 was traced, not staged.
2. **`gate.yml:877-884` (kubeconform)** — the "silently validates zero manifests" conclusion has one
   unproven link: whether GNU `xargs` on `ubuntu-24.04` invokes `kubeconform` once on empty input. It does
   on GNU and does not on the BSD `xargs` measured locally. Labelled SUSPECTED throughout.
3. **Seven suspicions are listed with a mechanism and no proof** (`inventory-heartbeat.yml`,
   `society-heartbeat.yml:224`, `heartbeat-liveness.yml:129`, `accelerator-local-llm-validate.yml:76`,
   `verify-ollama-pin.yml:82`, `pr-gate-presence.yml`'s non-`completed` hole, `gate.yml:3519`'s grep
   polarity). `assessFleetLiveness` in particular was not read.
4. **Six of the nine zero-failure workflows** carry no structural finding. Their counts are a prompt to
   look, not evidence, and this document does not promote them.
5. **Secrets consumed outside `.github/workflows/`** were not audited, so "referenced by no workflow" is not
   "unused" for `INVENTORY_ADMIN_*`, `ZETA_SOCIETY_DISPATCH_TOKEN`, the five keyring secrets, and
   `ZETA_TEST_INFRA_SSH_KEY`.
6. **Run-history counts are point-in-time** at 2026-08-26T07:2x UTC and this repo merges continuously. Every
   count is reproducible from the endpoints in §0; none should be re-quoted without re-running it. The
   300-run per-job scan covers 2026-08-24T14:05Z → 2026-08-26T06:54Z only.
7. **`docs/history/pr-reviews/PR-10647-*`** (the `helm-validate` "could not go red" case) was read as prior
   art for the *shape*, not re-verified. Its three mutations were measured by its author against the
   pre-change validator. The pre-fix state — *"total run count of this workflow before today: one"* — is
   the same silent-skip class as D-0, which is why the case is cited rather than re-litigated.
8. **One reported finding was checked and refuted** (`agent-reviewer.yml`, §2). At least one other
   reported claim was measured down: SHA-pin comment drift is **one** site, not three.

---

## 9. If exactly one thing is done

**Close V-0.** It is the only finding here that can let a defect onto `main`, the fix is already drafted in
a working tree, and the change is small: add `matrix-setup` and `path-filter` to `gate-required.needs`, and
replace the `grep` with a verdict that separates a **licensed** skip (the job declares a job-level `if:`
*and* every job it `needs:` succeeded) from a **dead-prerequisite** skip.

Two properties make it cheap. Neither job is being *added* to the floor — `build-and-test` has needed both
since it was written, so they were always blocking, transitively; what changes is that their results reach
the verdict instead of only reaching the jobs that die of them. And no job that could previously fail
without blocking can do so afterwards. **It is not a treaty amendment**, which matters, because almost
everything else on this list is.

Then, independent of each other and in descending order of consequence:

1. **V-1** — BD001's cancelled-run blind spot. One `jq` filter (`.conclusion=="failure"` →
   `.conclusion!="success"`) and one `shell: bash`. The detector for the repo's largest measured
   verdict gap is blind to it.
2. **V-3, V-4, V-5** — three `bash -e` / pipeline-status defects with the correct form already written
   down in this repo, one of which makes a run summary print the negation of its own measurement.
3. **The three audits in §7** — the only durable answer, because every finding in Tier 1 and Tier 2 was
   found by hand and none of them has a falsifier that would catch the next one.
4. **V-17, V-18, V-19** — `break: 0`, `softLaunch`, and a missing `--strict`: three named gates that
   currently cannot fail, each fixable by one token.
5. The schedule de-collision in §4 (the 16% drop is measured; eight workflows on one minute is why), and
   the `cross-verify` split in §4-I (24 audits blocking merges by adoption rather than by decision).

---

## Anchors

- **Vacuity as a named class** — `.claude/rules/toy-is-free-metered-must-be-earned.md`; the memory entries
  `vacuous-claims-and-unimplemented-exceptions-are-the-biggest-obstacle-to-human-ai-trust`,
  `zero-failures-is-not-green-a-required-check-that-never-ran-shows-as-zero`,
  `a-test-can-pass-because-an-EARLIER-guard-fired-only-mutation-finds-it`.
- **The drift-and-heal flip** — `gate.yml:3381-3407` and the ADR of 2026-08-01; the amendments of
  2026-08-17, 2026-08-19 and 2026-08-25 are recorded in the same comment block, each with the consent path
  named. This document deliberately proposes no amendment.
- **`docs/history/pr-reviews/PR-10647-fix-k8s-helm-validate-could-not-go-red-*`** — the prior worked
  instance of proving vacuity by mutation rather than by inspection, and the origin of `helm-validate.yml`'s
  paired mutation suites (§7).
- **Falsifiers over reviews** — `.claude/rules/every-bug-has-economic-value.md`. Every finding above is a
  priced defect, not an accusation: `.claude/rules/never-assume-malice-where-mistake-is-possible.md`. The
  `gate.yml` header is the clearest evidence for that reading — it is the record of a team finding this
  class three separate times and writing down what it learned each time. And the strongest pattern in this
  audit is not that the defects went undetected:

  > **Most of the vacuity here is documented as fixed somewhere else in the same repo, and often in the
  > same file.** V-5 and V-4 have their correction written out at length in `github-settings-drift.yml`.
  > V-8's fix is a thousand lines below it in `agent-heartbeat.yml`. V-10 violates a prohibition its own
  > file states 260 lines earlier. V-3's bug is documented as repaired in `society-heartbeat.yml`. V-11 and
  > V-13 are missing a liveness floor that `bytelock.yml` and `search-index-cadence.yml` both have.

  That is a **budget** failure, not a care failure — the canonical AI failure mode of the rule cited above,
  in its human form. The remedy is a shared step and three mechanical audits, not a stricter reviewer.
- **Beacon, on why a saturated signal and an absent one carry the same information:** Shannon, *A
  Mathematical Theory of Communication* (1948) — a channel whose output is independent of its input has
  zero mutual information with it. A check that is green on 100% of runs and one that is red on 99% are the
  same channel. `github-settings-drift.yml` has been both, in that order, and neither state told anyone
  whether the repo's settings had drifted.

<!-- explicit unindexed rationale: this is an audit snapshot of the Actions surface at a pinned SHA
     (dc15f463dfb8c44543f217028d6879ca9da39a0e), not a durable concept. Its findings are meant to be
     consumed and closed; the memory-substrate entry belongs on whatever lands the fixes, not on the
     survey. Re-running the endpoints in §0 reproduces every number in it. -->
