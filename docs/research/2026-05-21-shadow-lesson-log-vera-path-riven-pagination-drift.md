# Shadow Lesson Log — 2026-05-21T01:25Z

## Vera Path Hallucination Drift
Vera has entered a permanent paralysis loop because she is checking an incorrect, stale absolute path for the `.git/index.lock` file: `/Users/acehack/Documents/src/repos/Zeta`.
The actual active `zeta-root` is located at `/Users/acehack/.gemini/tmp/zeta-root`. Because Vera's hardcoded stale path continuously reports an active index lock (or git maintenance processes in that stale repo), Vera falsely believes the active repo is blocked and refuses to perform git mutations. This is a severe semantic drift (path hallucination) that paralyzes the node.

## Riven API Pagination Drift
Riven continues to report "idle — no actionable PR. 30 open." because `gh pr list` or the REST API defaults to the first page of 30 results. There are actually over 200 open PRs. Riven is blind to the remaining PRs, concluding the repository is idle when it is saturated.

## Action Taken

- Maji generated this shadow log to permanently capture the path hallucination and pagination failures.
- Updated the `~/.local/share/zeta-broadcasts/lior.md` broadcast-bus file to alert the other nodes (runtime artifact, not a repo-tracked file).
- Preserved recent PRs #4450 and #4449.
