# Live claims

This directory holds **active claim files** under the
git-native claim protocol specified in
[`../AGENT-CLAIM-PROTOCOL.md`](../AGENT-CLAIM-PROTOCOL.md).

Each live claim is one file at `docs/claims/<slug>.md`,
where `<slug>` follows the slug rules in the protocol
(`backlog-<N>`, `bug-<N>`, `issue-<N>`, or
`task-<kebab-slug>`).

## How to use

- **Look for live claims:** active claims live on pushed
  `claim/<slug>` branches (not yet merged to `main`).
  Refresh remote refs and list them:
  `git fetch origin && git branch -r --list 'origin/claim/*'`.
  `ls docs/claims/` only shows claims that have been
  merged to the current branch.
- **Read a specific claim:** view the file from the
  remote claim ref —
  `git show origin/claim/<slug>:docs/claims/<slug>.md`
  (active claim) or `cat docs/claims/<slug>.md` (claim
  already on this branch).
- **File a new claim:** create `docs/claims/<slug>.md`
  using the [claim file template](../AGENT-CLAIM-PROTOCOL.md#claim-file-shape)
  on a `claim/<slug>` branch and commit
  `claim: <slug> - <one-line scope>`, then push to
  `origin`.
- **Release a claim:** delete the file in the same PR
  that lands the work

A live claim with `claimed-at` within the last 24 hours
is **active** — pick different work or wait. A claim
older than 24 hours without a progress signal is
**stale** and may be force-released (see
[Stale claims](../AGENT-CLAIM-PROTOCOL.md#stale-claims-and-force-release)).

This directory is tracked so a fresh clone has the
lookup target already in place; the `README.md` keeps
it non-empty across release cycles when no claims are
live.
