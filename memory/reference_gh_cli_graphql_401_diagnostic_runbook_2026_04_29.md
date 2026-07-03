---
name: gh CLI / CodeQL transient 401 — diagnostic runbook
description: When `gh auth status` reports authenticated but `gh api graphql` / `gh api user` returns 401 (and CodeQL SARIF uploads fail in the same window), the FIRST hypothesis is a transient upstream auth-service hiccup. Always rule out token-side issues (expired / revoked / SSO not authorized) before assuming transient. Captured 2026-04-29 during PR #846 review wave; corrected per Codex P2 on PR #847 (the prior `-X POST` "workaround" was a misdiagnosis — `gh api` already sends POST when `-f`/`-F` parameters are present, so the flag was a no-op and the success was just the glitch resolving on retry).
type: reference
---

# gh CLI / CodeQL transient 401 — Diagnostic Runbook

## When this triggers

`gh auth status` shows green ("Logged in to github.com"), keyring
token present, but multiple endpoints fail with `HTTP 401:
Requires authentication` for a short window (~30-90 seconds),
then recover on their own. Specifically observed:

- `gh api graphql -f query='...'`
- `gh api user`
- GitHub Actions: CodeQL Default-Setup SARIF upload step

While in the same window:

- `gh api repos/<owner>/<repo>/...` (REST repo-scoped) keeps
  working — gh CLI falls back to anonymous access on public
  repos when auth fails, masking the auth issue
- `gh api rate_limit` may still appear to work, but per GitHub
  REST docs `GET /rate_limit` succeeds anonymously when only
  public resources are queried — so a healthy-looking response
  here does NOT prove the token is valid (Codex P1 catch on
  PR #847; previously this runbook over-relied on it). Use
  `gh api user` instead — that endpoint requires authentication.
- A `gh api -X POST graphql ...` retry seconds later succeeds
  (NOT because of the `-X POST` flag — see "Common
  misdiagnosis" below — but because the upstream path
  recovered)

## What this actually is

A transient hiccup in GitHub's auth-service routing. Likely
classes:

- Auth-service node restart / draining
- Token-validation cache miss spilling to a slow path
- SSO-policy check delay on org-bound tokens
- Brief upstream rate-limit on the auth-service tier (separate
  from the API rate-limit we typically see)

It clears on its own. The right response is **bounded retry**,
not "switch to a different gh flag."

## Common misdiagnosis (corrected 2026-04-29)

**The `-X POST` claim is wrong.** A prior version of this
runbook claimed that `gh api graphql -f query='...'` defaults
to GET and that adding `-X POST` was a workaround. That's
incorrect:

- `gh api` defaults to **POST** when any `-f` or `-F`
  parameters are present (per `gh api --help`).
- So `gh api graphql -f query='...'` already sends POST.
- Adding `-X POST` is a no-op for that command shape.

Verify yourself:

```bash
GH_DEBUG=api gh api graphql -f query='query { viewer { login } }' 2>&1 \
  | grep -E '^> POST|^> GET'
# > POST /graphql HTTP/1.1   ← already POST without -X
```

The earlier "the -X flag fixed it" observation was actually the
upstream auth glitch resolving in the few seconds between
attempts. Misattributed.

## Triage in order

1. **Confirm the symptom is transient.** Wait 30-60 seconds and
   retry the failing command. If it succeeds on retry without
   any other change, this is the transient class. Do not
   investigate further; just bounded-retry. Log the timestamp
   for cross-reference with CodeQL run logs if that's failing
   too.

2. **Confirm `gh auth token` is intact**: `gh auth token | head -c 8`
   should print the first 8 chars. If empty, the keyring entry
   is genuinely missing → `gh auth login` is the answer (this
   is a different class from the transient 401).

3. **Confirm partial-failure pattern via an auth-required endpoint**:
   `gh api user --jq .login` requires authentication (no anonymous
   fallback) and is a reliable signal of token-side health.
   - If `gh api user` succeeds → token IS authenticating; failure
     elsewhere is upstream-transient.
   - If `gh api user` ALSO 401s → likely token-side (expired /
     revoked / SSO not authorized for the org).
   **Do NOT use `gh api rate_limit` as the auth-health signal**:
   `GET /rate_limit` succeeds anonymously when only public
   resources are queried (per GitHub REST docs), so a missing
   or revoked token can show as healthy on this check, causing
   false "transient" classification and delaying real token
   remediation. (Codex P1 catch on PR #847.)

4. **For local commands**: bounded retry with back-off
   (60s/180s; max 2-3 retries). If still failing after 5
   minutes, escalate as suspected-token-issue, not transient.

5. **For CI (CodeQL SARIF upload)**: the dynamic-default-setup
   workflow CANNOT be retried via `gh run rerun --failed`
   ("This workflow run cannot be retried"). Empty-commit
   retrigger to the PR head is the only path. Per task 319,
   the proper fix is bounded-retry-via-tooling, not unbounded
   manual retry.

## Sibling failure mode — CodeQL SARIF upload 401

Same upstream auth glitch breaks CodeQL Default-Setup SARIF
uploads in GHA:

```
##[warning]Requires authentication - https://docs.github.com/rest
##[error]Please check that your token is valid and has the required
permissions: contents: read, security-events: write
```

The Default-Setup CodeQL workflow run (event:`dynamic`) cannot
be retried directly. Empty-commit-retrigger to the PR head is
the workaround. Per task 319, this needs bounded-retry per DST
(empty-commit-retrigger is a workaround; the proper fix is
infrastructure that detects the auth-401 SARIF-upload signature
and retries with bound + back-off).

## What this is NOT

- NOT proof of token expiration (fresh keyring tokens see this).
- NOT proof of widespread API outage — repo-scoped REST keeps
  working, just the auth-validating path 401s briefly.
- NOT a gh CLI version-pin signal (no specific version known to
  cause this).
- NOT solved by `-X POST` (corrected; that flag is a no-op for
  graphql calls with `-f` parameters).
- NOT yet doctrine. Amara framing: *"diagnostic note, not
  doctrine yet."*

## Trigger memory

PR #846 review wave 2026-04-29T~14:50-15:01Z. Multiple endpoints
hit 401 in the same window — `gh api graphql -f query` locally
and CodeQL Default-Setup SARIF upload in GHA. Both recovered on
retry. Initial misdiagnosis attributed recovery to `-X POST`
flag; Codex P2 review on PR #847 caught the misattribution
(`gh api` already sends POST with `-f`; the success was the
glitch resolving). Lesson: claim-without-verify is the failure
mode that the Drain-Log Claim Verification Discipline (task
task 316) catches. The rule applies to runbook-authoring in real
time, not just retroactive drain-log audits.
