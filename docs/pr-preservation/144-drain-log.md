# PR #144 drain log — Aurora transfer absorb + CRM-UI shared scope

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/144>
Branch: `feat/aurora-transfer-absorb-and-crm-ui-plan`
Drain session: 2026-04-24 (Otto)
Thread count at drain start: 9 unresolved

Per Aaron's 2026-04-24 PR-comment-preservation directive:
full per-thread record with verbatim reviewer text, outcome,
verbatim reply, and resolution commit.

---

## Thread 1 — `tools/audit/live-lock-audit.sh:24` — WINDOW validation

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59djzQ`
- Severity: P1

### Original comment (verbatim)

> P1: `WINDOW` is used directly in `git log origin/main -"$WINDOW"`.
> If the caller passes a non-integer (or `0`/negative), `git log`
> will error or behave unexpectedly under `set -e`. Consider
> validating that `WINDOW` is a positive integer before running
> git commands and emitting a clear usage error otherwise.

### Outcome

FIX — positive-integer regex validation added before any git
operation; non-integer / zero / negative input exits 2 with a
clear usage error.

### Reply (verbatim)

> Fixed. Added a `[[ "$WINDOW" =~ ^[1-9][0-9]*$ ]]` gate that
> exits 2 with a usage error if WINDOW is not a positive
> integer, before any git command runs. Paired with thread 7 /
> 9 fix (treating unresolved `origin/main` as an audit error)
> so the script never silently reports healthy on bad input.
> Resolved.

---

## Thread 2 — `docs/AUTONOMOUS-LOOP.md:206` — Aaron name attribution

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59djzm`
- Severity: style / convention

### Original comment (verbatim)

> This introduces direct name attribution ("flag to Aaron") in
> documentation. Repo convention is to use role references
> (e.g., "human maintainer") and keep direct names out of
> docs/code/skills (see
> `docs/AGENT-BEST-PRACTICES.md` §"No name attribution in code,
> docs, or skills"). Please reword accordingly.

### Outcome

FIX — reworded to "the human maintainer" and replaced the
named memory-file pointer with "the drop-zone protocol memory
entry" phrasing.

### Reply (verbatim)

> Fixed. Reworded "flag to Aaron" → "flag to the human
> maintainer" and replaced the explicit memory-file path with
> "the drop-zone protocol memory entry". Matches the
> `docs/AGENT-BEST-PRACTICES.md` no-name-attribution
> convention. Resolved.

---

## Thread 3 — `docs/plans/servicetitan-crm-ui-scope.md:44` — ServiceTitan-specific doc

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59dj0E`
- Severity: convention

### Original comment (verbatim, abridged)

> This doc (and its filename) is ServiceTitan-specific, but
> the repo has an explicit convention to keep demos/docs
> generic (no `samples/ServiceTitan*/`, minimize
> "ServiceTitan" in repo history) per
> `memory/feedback_open_source_repo_demos_stay_generic_not_company_specific_2026_04_23.md`
> (see especially lines 59–66 and 86–95). Please rename this
> plan and adjust wording to be company-neutral (e.g., "CRM
> demo with UI" / "factory demo").

### Outcome

NARROW+BACKLOG DEFER — acknowledged; the rename is a
cross-PR campaign that cannot land cleanly inside #144.

### Rationale

The generic-demo directive is correct and load-bearing
(memory cited above). But executing the rename inside this
PR would cascade into:

- `samples/ServiceTitanCrm/` → `samples/FactoryDemo.Crm/`
  (directory rename; touches currently-open PR #141 which
  added `samples/ServiceTitanCrm/Program.fs`).
- `tests/Tests.FSharp/Operators/CrmScenarios.Tests.fs`
  comment reference (touches currently-open PR #143 which
  added the scenario tests).
- `Zeta.sln` solution-folder + GUID registration for the
  sample project.
- `docs/BACKLOG.md` — multiple rows reference
  `samples/ServiceTitanCrm` and "ServiceTitan demo" as
  landmarks.
- Module / namespace renames (`Zeta.Samples.ServiceTitanCrm`
  → `Zeta.Samples.FactoryDemo.Crm`) in the .fs file that
  PR #141 is actively reviewing.

Per the Otto-232 hot-file-cascade pattern, racing a multi-PR
rename through four open PRs would be negative-throughput.
The clean path is: let #141 and #143 land, then a dedicated
rename-campaign PR does the whole sweep at once with a
green-field audit.

### Reply (verbatim)

> Acknowledged — the generic-demo directive is correct (cited
> memory `feedback_open_source_repo_demos_stay_generic_not_company_specific_2026_04_23.md`
> is load-bearing). Executing the rename inside #144 would
> cascade-conflict with currently-open PRs #141
> (`samples/ServiceTitanCrm/Program.fs`) and #143
> (`tests/Tests.FSharp/Operators/CrmScenarios.Tests.fs`), plus
> `Zeta.sln` GUID registration and several `docs/BACKLOG.md`
> rows that reference the path as a landmark. Per the Otto-232
> hot-file-cascade pattern, racing a multi-PR rename through
> four open PRs is negative-throughput. Deferring the rename
> to a dedicated campaign PR once #141 and #143 land. The
> memory above is the canonical reference for that campaign.
> Resolving here.

---

## Thread 4 — `samples/ServiceTitanCrm/ServiceTitanCrm.fsproj:4` — sample project rename

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59dj0U`
- Severity: convention

### Original comment (verbatim, abridged)

> The repo has an explicit convention that demos/samples must
> stay generic and avoid company-specific names (no
> `samples/ServiceTitan*/`, no `ServiceTitanCrm` namespaces),
> per
> `memory/feedback_open_source_repo_demos_stay_generic_not_company_specific_2026_04_23.md`
> (lines 59–66). Please rename this sample project/directory
> and its RootNamespace to a company-neutral name.

### Outcome

NARROW+BACKLOG DEFER — same cascade argument as thread 3.

### Reply (verbatim)

> Same rationale as thread on
> `docs/plans/servicetitan-crm-ui-scope.md:44`: directory-,
> project-, namespace-, solution- and test-comment renames
> land as one campaign PR after the currently-open sibling
> PRs #141 and #143 merge. Memory
> `feedback_open_source_repo_demos_stay_generic_not_company_specific_2026_04_23.md`
> is the canonical reference for the rename target naming.
> Resolving here.

---

## Thread 5 — `Zeta.sln:1` — UTF-8 BOM (P0)

- Reviewer: `copilot-pull-request-reviewer`
- Thread ID: `PRRT_kwDOSF9kNM59dj0Z`
- Severity: P0

### Original comment (verbatim)

> P0: This file now begins with a UTF-8 BOM / invisible
> character on line 1. The repo has an "invisible Unicode"
> hygiene rule and lints for these characters; leaving this
> BOM in can break tooling diffs/lints. Please remove the BOM
> so the first line starts with
> `Microsoft Visual Studio Solution File...`.

### Outcome

FIX — BOM (`EF BB BF`) stripped; solution file now begins
with the expected ASCII content.

### Reply (verbatim)

> Fixed. Stripped the `EF BB BF` BOM prefix from `Zeta.sln`;
> file now starts with `\n` followed by
> `Microsoft Visual Studio Solution File...` as expected.
> Build still passes 0W/0E. Resolved.

---

## Thread 6 — `src/Core/SignalQuality.fs:249` — grounding filter `Weight > 0L`

- Reviewer: `chatgpt-codex-connector`
- Thread ID: `PRRT_kwDOSF9kNM59d-2T`
- Severity: P1

### Original comment (verbatim)

> Ignore negative residuals in grounding ratios
>
> `groundingWith` treats every non-zero weight as an active
> claim (`Weight <> 0L`), which means over-retracted entries
> (`Weight < 0`) are counted in the grounding/falsifiability
> denominator even though they are retractions, not asserted
> claims. In streams with a small number of negative
> residuals, this inflates suspicion and can misclassify
> otherwise-grounded content, while the same anomaly is
> already captured by `consistencyMeasure`. This should filter
> to `Weight > 0L` (and the same fix is needed in
> `falsifiabilityWith`) so these dimensions only score
> currently asserted claims.

### Outcome

FIX — `groundingWith` gate changed from `Weight <> 0L` to
`Weight > 0L`; XML-doc expanded to explain the asymmetry
(negative weights are the consistency measure's domain, not
grounding's).

### Reply (verbatim)

> Fixed. `groundingWith` now filters on `Weight > 0L` so
> over-retracted entries no longer inflate the denominator.
> Expanded the XML-doc to make the invariant explicit: only
> currently-asserted claims count; `Weight < 0L` is
> consistency's domain, not grounding's. Paired fix for
> `falsifiabilityWith` landed for thread 8. Resolved.

---

## Thread 7 — `tools/audit/live-lock-audit.sh:58` — unresolved commit window

- Reviewer: `chatgpt-codex-connector`
- Thread ID: `PRRT_kwDOSF9kNM59d-2X`
- Severity: P2

### Original comment (verbatim)

> Fail audit when commit window cannot be resolved
>
> When `git log origin/main` cannot resolve the ref (e.g.,
> shallow clone, missing remote, or fetch failure), the loop
> processes zero commits and this branch exits `0` as "No
> commits found." That reports a healthy audit even though no
> data was analyzed, so the live-lock gate can silently stop
> protecting CI. The script should treat an unresolved commit
> window as an error path rather than a passing result.

### Outcome

FIX — `git rev-parse --verify --quiet origin/main` gate
added before the log loop; unresolved ref now exits 2 with
an explicit error. The "no commits found" branch also
flipped to exit 2 as a defensive belt-and-braces backstop.

### Reply (verbatim)

> Fixed. Added a `git rev-parse --verify --quiet origin/main`
> gate that exits 2 with an explicit error if the ref can't
> resolve (shallow clone, missing remote, failed fetch). The
> original "no commits found" branch is now also an exit 2
> (unreachable under normal operation, but explicit so a
> silently-broken audit can't slip through). CI live-lock gate
> is no longer bypassable by ref-resolution failure.
> Resolved.

---

## Thread 8 — `src/Core/SignalQuality.fs:247` — grounding filter (duplicate)

- Reviewer: `chatgpt-codex-connector`
- Thread ID: `PRRT_kwDOSF9kNM59eI1h`
- Severity: P1

### Original comment (verbatim)

> Count only asserted claims in grounding/falsifiability
>
> Using `Weight <> 0L` here makes over-retracted entries
> (`Weight < 0`) count as active claims in the denominator,
> so a stream with a few negative residuals is penalized
> twice: once by `consistencyMeasure` and again by inflated
> grounding/falsifiability suspicion. In practice this can
> push otherwise-grounded content toward fail/quarantine when
> retractions are present; these dimensions should only score
> currently asserted claims (`Weight > 0L`).

### Outcome

FIX — same `Weight > 0L` filter landed for both
`groundingWith` (thread 6) and `falsifiabilityWith` (this
thread + thread 8's falsifiability companion).

### Reply (verbatim)

> Fixed in the same change as thread 6. Both `groundingWith`
> and `falsifiabilityWith` now gate on `Weight > 0L`;
> over-retracted entries are ignored (consistency's domain).
> Double-penalisation closed. Resolved.

---

## Thread 9 — `tools/audit/live-lock-audit.sh:58` — unresolved window (duplicate)

- Reviewer: `chatgpt-codex-connector`
- Thread ID: `PRRT_kwDOSF9kNM59eI1k`
- Severity: P2

### Original comment (verbatim)

> Treat unresolved commit windows as audit failures
>
> When `origin/main` cannot be resolved (e.g., shallow clone,
> missing remote, failed fetch), the `git log` in the process
> substitution yields no SHAs and this branch exits `0` with
> "No commits found in window.", which reports a healthy
> audit despite analyzing nothing. This can silently disable
> the live-lock guard in CI; an empty window caused by
> ref-resolution failure should return non-zero.

### Outcome

FIX — same change as thread 7.

### Reply (verbatim)

> Fixed in the same change as thread 7 — `git rev-parse
> --verify --quiet origin/main` gate added pre-log; zero-commit
> branch flipped from exit 0 to exit 2. Ref-resolution
> failure no longer silently passes. Resolved.

---

## Resolution commit

See the `fix: PR #144 drain` commit on this branch for the
landed changes. Threads 1 / 6 / 7 / 8 / 9 all resolve via
code fixes; thread 2 via a doc prose edit; threads 3 / 4 /
5 by a mix (BOM fix for 5; cascade-deferral for 3 / 4).

Build after all fixes: `dotnet build -c Release` ends
`0 Warning(s), 0 Error(s)`.
