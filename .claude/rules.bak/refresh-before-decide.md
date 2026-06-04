# Refresh-before-decide is the fundamental invariant

Carved sentence:

> Every other discipline assumes a current worldview.
> Refresh fast/cheap so the invariant holds — if refresh
> were slow, the temptation to skip would win.

## Operational content

Mandatory refresh before: tick selection, any merge or claim
release, session start, challenge from the maintainer.

**Two-layer print DX**: print raw structured output (e.g.,
`poll-pr-gate-batch.ts` JSON) BEFORE the interpretation; label
the interpretation layer distinctly. Mismatch between layers IS
the bug class this discipline is designed to catch.

"I just refreshed earlier" is not an exemption — the temptation
to skip is constant and is the most violated invariant in agent
loops generally.

## `git fetch` updates refs but NOT working-tree files (post-fetch read trap)

`git fetch origin main` (the canonical Step-1 refresh action) updates
`refs/remotes/origin/main` but does NOT promote local HEAD or update
the working-tree files. Any subsequent `Read` / `cat` / `grep` against
working-tree paths reads files at the LOCAL HEAD's state — stale
against `origin/main` if local hasn't been ff-promoted.

The failure mode: agent runs `git fetch`, sees `* branch main ->
FETCH_HEAD` success, reads `tools/foo.ts` via the working tree, and
authors substrate against state that may already be resolved on
`origin/main` N commits ahead. The substrate landing is a phantom
"drift" finding that requires retraction.

**Three mitigation patterns** (pick by context):

1. **Isolated worktree off `origin/main`** (default for agent ticks):
   `git worktree add --detach <path> origin/main` per
   [`refresh-world-model-poll-pr-gate.md`](refresh-world-model-poll-pr-gate.md)
   "Prefer `origin/main` over `FETCH_HEAD`" subsection. Gets the fresh
   state without touching the operator's primary checkout. Composes
   with [`agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md`](agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md)
   `--detach` discipline (never hold `main` branch ref in agent
   worktrees).
2. **`git show origin/main:<path>`** for ad-hoc single-file inspection
   without checkout — reads the file content directly from the
   remote-tracking ref's tree, bypassing working-tree state entirely.
   Cheapest option; ideal for sub-substrate inventory passes.
3. **ff-promote local HEAD** only when the checkout is the agent's
   own (NOT the operator's primary) — `git merge --ff-only origin/main`.
   Touching the operator's primary checkout is forbidden by the
   agent-worktree-hygiene rule above.

**Empirical anchor 2026-05-26T10:08Z**: Otto-CLI autonomous-loop tick
ran `git fetch origin main` (success), then read
`tools/alignment/filter_gate_log.ts` + `filter_gate_log.test.ts` via
working-tree paths in the operator's primary checkout. Both files
appeared unfixed despite [PR #5128](https://github.com/Lucent-Financial-Group/Zeta/pull/5128)
having landed the fix 1h 46min earlier at 08:22Z. The local primary
checkout was 11 commits behind `origin/main` (local `2774fef5a` vs
origin `1641da6d2`). The initial reading was generating a candidate
"PR #5128 substrate-drifted" finding that would have been a phantom
catch had the agent committed it; this rule extension catches that
class before the false-positive lands. The shard at
[`docs/hygiene-history/ticks/2026/05/26/1008Z.md`](../../docs/hygiene-history/ticks/2026/05/26/1008Z.md)
carries the full empirical trace.

**Existing partial coverage** at narrower scope already lives at
[`otto-channels-reference-card.md`](otto-channels-reference-card.md)
ID-allocation section: "do NOT use `find docs/backlog -name B-*.md`
on the local worktree. The local working tree may be on a stale
HEAD." That precedent is scoped to ID-allocation queries (find on
the backlog tree); this extension generalizes the same principle to
*any* working-tree file read post-fetch, and lands it on the
`refresh-before-decide` surface where it auto-loads at every cold-boot.
Substrate inventory performed per
[`verify-existing-substrate-before-authoring.md`](verify-existing-substrate-before-authoring.md):
searched `git fetch` + `FETCH_HEAD` + `local HEAD stale` + `ff-only` +
`fast-forward` + `git show origin/main` + `stale local` across
`.claude/rules/` + `memory/` before authoring this extension.

## Composes with

- [`agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md`](agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md) — operator primary checkout MUST NOT be ff'd by agents; use isolated worktree off `origin/main`
- [`refresh-world-model-poll-pr-gate.md`](refresh-world-model-poll-pr-gate.md) — "Prefer `origin/main` over `FETCH_HEAD`" empirical anchor at 2026-05-20T16:14Z, plus saturation-tier discipline
- [`otto-channels-reference-card.md`](otto-channels-reference-card.md) — ID-allocation narrow-scope precedent (this extension generalizes)
- [`verify-existing-substrate-before-authoring.md`](verify-existing-substrate-before-authoring.md) — substrate-inventory discipline used to compose this extension rather than mint parallel
- [`dep-pin-search-first-authority.md`](dep-pin-search-first-authority.md) — sibling rule at version-pin scope; same "Otto-defaults-to-plausible-but-unverified" root cause class

## Full reasoning

`memory/feedback_refresh_before_decide_invariant_two_layer_print_dx_claudeai_2026_05_01.md`

Verbatim packet:
`memory/persona/riven/conversations/2026-05-01-claudeai-backlog-driven-dual-pm-loop-with-refresh-discipline.md`
