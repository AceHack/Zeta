---
name: gh CLI GraphQL/REST 401 — diagnostic runbook
description: When `gh auth status` reports authenticated but `gh api graphql` / `gh api user` returns 401, run this short triage before assuming token-expired. Captured 2026-04-29 during PR #846 review wave; Amara framing "diagnostic note, not doctrine yet."
type: reference
---

# gh CLI GraphQL/REST 401 — Diagnostic Runbook

## When this triggers

`gh auth status` shows green ("Logged in to github.com"), keyring
token present, but operations fail with `HTTP 401: Requires
authentication`. Specifically observed on these endpoints:
- `gh api graphql -f query='...'` (default GET behaviour)
- `gh api user`
- `gh api --hostname github.com graphql ...`

While these still work:
- `gh api repos/<owner>/<repo>/...` (REST repo-scoped, public repo
  endpoints — gh falls back to anonymous access)
- `gh api rate_limit` (succeeds even with the same auth glitch)
- `gh api -X POST graphql -f query='...'` (explicit POST flag)

## Triage in order

1. **Confirm `gh auth token` works**: `gh auth token | head -c 8`
   should print the first 8 chars. If empty, the keyring entry
   is genuinely missing → `gh auth login` is the answer.
2. **Test direct REST anon vs auth path**: `curl -s
   https://api.github.com/repos/Lucent-Financial-Group/Zeta/pulls/846`
   succeeds without auth (public repo); compare with the gh
   command. If gh fails but anon curl works, gh is reaching
   the auth path and failing there.
3. **Test `gh api -X POST graphql`** with an explicit POST flag:
   `gh api -X POST graphql -f query='query { viewer { login } }'`.
   If this succeeds when `gh api graphql` (no `-X`) fails, gh's
   default routing is at fault, not the token.
4. **Test `gh api rate_limit`**: succeeds = token IS authenticating
   on at least some endpoints. Indicates a partial-failure pattern,
   not a flat-out invalid token.

## Working workaround

Until upstream resolves, force POST on every graphql call:

```bash
# instead of:
gh api graphql -f query='query { ... }'
# use:
gh api -X POST graphql -f query='query { ... }'
```

Wrapper option for scripts:

```bash
gh_gql() {
  gh api -X POST graphql "$@"
}
```

## Sibling failure mode — CodeQL SARIF upload 401

The same auth-service hiccup that breaks local `gh api graphql`
can also break CodeQL's SARIF upload step in GitHub Actions:

```
##[warning]Requires authentication - https://docs.github.com/rest
##[error]Please check that your token is valid and has the required
permissions: contents: read, security-events: write
```

The CodeQL "Default Setup" workflow run (event:`dynamic`) cannot
be retried via `gh run rerun --failed` ("This workflow run cannot
be retried"). The explicit `pull_request` CodeQL run can be retried.

## What this is NOT

- NOT proof of token expiration (fresh keyring tokens see this).
- NOT proof of upstream API outage (most endpoints work).
- NOT a gh CLI version-pin signal (no specific version known to
  break this; observed on whatever `gh --version` resolves on the
  maintainer laptop 2026-04-29).
- NOT yet doctrine. Amara framing: *"I would not turn that into
  doctrine yet, but I would capture it as a diagnostic note: when
  gh claims authenticated but GraphQL/REST 401s, explicitly test
  gh auth token, REST unauthenticated curl, and gh api -X POST
  graphql. It may be token/session/cache weirdness, but it is
  worth a tiny runbook entry."*

## Trigger memory

PR #846 review wave 2026-04-29T~14:50-15:01Z. After resolving 4
review threads via `gh api graphql -X POST` mutations (which
worked), the next heartbeat poll's `gh api graphql -f query`
returned 401. The `-X POST` workaround restored function. Same
window saw CodeQL Default-Setup csharp + js-ts SARIF uploads fail
with the same error class.
