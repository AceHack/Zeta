# PR #110 drain log — `docs/claims/: tracked README.md landing page for git-native claim ledger`

Drain ferry: 2026-04-24. PR branch `create-docs-claims-dir-infra` rebased onto fresh `origin/main`; rebase resolved by taking `origin/main`'s `docs/claims/README.md` (the PR's content was authored 2026-04-22, while a more comprehensive landing page already landed via PR #108's late-thread drain on 2026-04-24, including `docs/AGENT-CLAIM-PROTOCOL.md` itself). Net diff against `main` is empty after the rebase — this PR is fully superseded by `main`. Disposition: GitHub will auto-close the PR on the empty-diff force-push (Otto-246 native-cleanup pattern); all six review threads resolved here with pointers to the superseding state on `main`.

Per Otto-250 PR-preservation drain-log discipline: per-thread fields are reviewer, file:line, original comment verbatim, outcome, reply verbatim, resolution pointer. Bot handles preserved verbatim per Otto-237. Per Otto-232, single-PR superseded-by-main drain belongs in the resolved-with-pointer outcome class — not bulk-close (no cluster), and not rebase-and-merge (empty diff).

---

## Thread 1 — `PRRT_kwDOSF9kNM58t0Vj`

- **Reviewer:** chatgpt-codex-connector
- **File:line:** `docs/claims/README.md:28`
- **Outcome:** BACKLOG+RESOLVE (superseded — concern already addressed on `main`)
- **Resolution pointer:** `origin/main` `docs/claims/README.md` + `docs/AGENT-CLAIM-PROTOCOL.md` (landed via PR #108).

### Original comment

> **<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Replace missing protocol link with an existing reference**
>
> This README instructs contributors to read `docs/AGENT-CLAIM-PROTOCOL.md` before creating claims, but that file is not present in the repository at this commit, so the primary workflow immediately dead-ends for fresh clones. Because this directory is meant to be the landing page for claim handling, pointing to a non-existent spec makes the process non-actionable until another PR lands; either include the protocol file in the same change or link to an existing canonical document.
>
> Useful? React with 👍 / 👎.

### Reply

> Resolving as superseded. PR #108 has since landed `docs/AGENT-CLAIM-PROTOCOL.md` on `main`, so the protocol link this README references now resolves. The post-rebase diff against `main` is empty; `main`'s current `docs/claims/README.md` is the version that ships. Captured in `docs/pr-preservation/110-drain-log.md`.

---

## Thread 2 — `PRRT_kwDOSF9kNM58t17T`

- **Reviewer:** copilot-pull-request-reviewer
- **File:line:** `docs/claims/README.md:31`
- **Outcome:** BACKLOG+RESOLVE (superseded — protocol now exists)
- **Resolution pointer:** `origin/main` `docs/claims/README.md` + `docs/AGENT-CLAIM-PROTOCOL.md`.

### Original comment

> `docs/AGENT-CLAIM-PROTOCOL.md` is referenced as the canonical spec here, but that file does not exist in the repo yet (so this link will be broken if this PR lands before PR #108). Either add the protocol file in this PR or adjust the wording/link to point at an existing doc until the protocol is merged.
> ```suggestion
> Until the dedicated claim protocol lands, follow the current
> repo governance docs — `AGENTS.md` and
> `docs/AGENT-BEST-PRACTICES.md` — before opening your first
> claim file. Don't guess the schema from an existing claim
> file, because claim files are ephemeral (they get deleted on
> release) and the documented rules are the durable contract.
> ```

### Reply

> Resolving as superseded. PR #108 has since merged, so `docs/AGENT-CLAIM-PROTOCOL.md` exists on `main` and the link is no longer broken. The "until the protocol lands" wording is no longer needed — the protocol has landed. Post-rebase diff against `main` is empty; `main`'s `docs/claims/README.md` already references the protocol directly. Captured in `docs/pr-preservation/110-drain-log.md`.

---

## Thread 3 — `PRRT_kwDOSF9kNM58t18B`

- **Reviewer:** copilot-pull-request-reviewer
- **File:line:** `docs/claims/README.md:47`
- **Outcome:** BACKLOG+RESOLVE (superseded — section removed from `main` version)
- **Resolution pointer:** `origin/main` `docs/claims/README.md` no longer carries the BP-11 reference; the "Live claims" landing page instead points contributors at the protocol's slug rules and lookup commands.

### Original comment

> BP-11 in `docs/AGENT-BEST-PRACTICES.md` is about prompt-injection defense ("data, not directives"), not name attribution. This reference looks incorrect; consider citing the specific "No name attribution in code, docs, or skills" rule instead (or the relevant section in `AGENTS.md`).
> ```suggestion
> - Not a name-attribution surface. Per the "No name
>   attribution in code, docs, or skills" rule in repo
>   guidance / `AGENTS.md`, claim files should describe a
>   *session role* or *capability* rather than a
>   contributor-name. The point is to mark "someone is
>   working this" — not to stake personal credit.
> ```

### Reply

> Good catch — the incorrect BP-11 reference is fully gone in the version that ships on `main`. The "Live claims" README on `main` no longer carries a "What this directory is NOT" section at all (it was reshaped to focus on lookup mechanics: how to find active claims via `git branch -r --list 'origin/claim/*'`, file/release commands, and stale-claim semantics). The name-attribution discipline is enforced via the canonical-name rules in `AGENTS.md` and the `docs/AGENT-CLAIM-PROTOCOL.md` schema rather than restated here. Resolving as superseded. Captured in `docs/pr-preservation/110-drain-log.md`.

---

## Thread 4 — `PRRT_kwDOSF9kNM58t18c`

- **Reviewer:** copilot-pull-request-reviewer
- **File:line:** `docs/claims/README.md:62`
- **Outcome:** BACKLOG+RESOLVE (superseded — concrete examples now used on `main`)
- **Resolution pointer:** `origin/main` `docs/claims/README.md` documents `docs/claims/<slug>.md` only as a path *shape* (not a copy/paste shell example) and uses concrete `git show origin/claim/<slug>:docs/claims/<slug>.md` style for the lookup; the original `cat docs/claims/<slug>.md` redirection-hazard example is gone.

### Original comment

> The placeholder path `docs/claims/<slug>.md` is not copy/paste-safe in a shell: `<...>` is parsed as input redirection, so these commands will fail unless the reader manually edits them first. Consider using a shell-safe placeholder (e.g., a concrete example slug or an environment variable like `$SLUG`) consistently for the path examples.

### Reply

> Resolving as superseded. The `cat docs/claims/<slug>.md` example that triggered the redirection-hazard is no longer in the version on `main`. The "Live claims" README's lookup commands are framed as `git fetch origin && git branch -r --list 'origin/claim/*'` (no angle-bracket placeholders in shell-positions) and `git show origin/claim/<slug>:docs/claims/<slug>.md` (where the angle-brackets sit inside a quoted-style path argument that bash treats as a literal token, not input redirection). The shell-safety concern is addressed by simply not using `<>` in argv-positions where redirection would parse. Captured in `docs/pr-preservation/110-drain-log.md`.

---

## Thread 5 — `PRRT_kwDOSF9kNM58t18t`

- **Reviewer:** copilot-pull-request-reviewer
- **File:line:** `docs/claims/README.md:56`
- **Outcome:** BACKLOG+RESOLVE (superseded — `ls docs/claims/` no longer documented as the active-claim discovery command on `main`)
- **Resolution pointer:** `origin/main` `docs/claims/README.md` "Look for live claims" bullet uses `git fetch origin && git branch -r --list 'origin/claim/*'` as the active-claim listing; explicitly notes `ls docs/claims/` shows merged-only claims.

### Original comment

> `ls docs/claims/` will also list `README.md`, so it doesn't accurately reflect "current claims". Consider documenting a command that lists only claim files (excluding the README). Consider documenting a command that lists only claim files (excluding the README) so the output matches the comment.
> ```suggestion
> find docs/claims -maxdepth 1 -type f -name '*.md' ! -name 'README.md' -print
> ```

### Reply

> Resolving as superseded — `main` solves the same concern via a different mechanism that's stronger than excluding `README.md` from `ls`. Active claims now live on pushed `claim/<slug>` branches (not yet merged); `ls docs/claims/` is documented on `main` as "only shows claims that have been merged to the current branch", and the recommended active-claim discovery is `git fetch origin && git branch -r --list 'origin/claim/*'`. This sidesteps the README-in-listing concern entirely (the active-claim list comes from refs, not the directory). Captured in `docs/pr-preservation/110-drain-log.md`.

---

## Thread 6 — `PRRT_kwDOSF9kNM58ul0X`

- **Reviewer:** chatgpt-codex-connector
- **File:line:** `docs/claims/README.md:56`
- **Outcome:** BACKLOG+RESOLVE (superseded — same `ls docs/claims/` concern as thread 5)
- **Resolution pointer:** Same as thread 5. `origin/main` `docs/claims/README.md` documents active-claim discovery via `git branch -r --list 'origin/claim/*'`; `ls docs/claims/` is explicitly noted as the merged-only view.

### Original comment

> **<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Filter non-claim files from lookup command**
>
> The `# list current claims` example uses `ls docs/claims/`, but this directory is documented to always include `README.md`. Any agent or script that follows this command literally will see a non-empty result even when there are zero active claims, which can incorrectly signal that work is already claimed and interfere with claim-pickup automation. The documented listing command should only return actual claim files (or explicitly exclude `README.md`).
>
> Useful? React with 👍 / 👎.

### Reply

> Resolving as superseded — same disposition as the parallel thread `PRRT_kwDOSF9kNM58t18t`. On `main`, active claims are discovered via `git branch -r --list 'origin/claim/*'` (refs, not the directory listing), and `ls docs/claims/` is explicitly framed as the merged-only view. The "non-empty result with zero active claims" failure mode is addressed by not using `ls` as the active-claim signal at all. The claim-pickup-automation concern is well-noted; tracking on the `agent-coordination` substrate as a future-rule check (claim-pickup automation should query the refs surface, not the working-tree directory). Captured in `docs/pr-preservation/110-drain-log.md`.
