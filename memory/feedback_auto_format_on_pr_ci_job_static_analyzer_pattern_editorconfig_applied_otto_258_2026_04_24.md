---
name: AUTO-FORMAT ON PR — every mostly-auto-fixable lint class (markdownlint-cli2 --fix, dotnet format, shfmt, prettier-for-json, etc.) belongs as either (a) a pre-commit hook on dev side, (b) a CI job that force-formats and commits back to the PR branch, or (c) both (preferred per GOVERNANCE §24 dev/build parity); prefer "super force format" static-analyzer pattern where CI commits the fixes back so everyone's code looks the same + editorconfig is applied consistently; replaces manual per-PR drain work that keeps re-surfacing (I drained markdownlint on ~9 PRs this tick; shouldn't have been manual); Aaron Otto-258 2026-04-24 "mostly auto-fixable with --fix why isn't this just part of the build, or have a job like ../SQLSharp to force format on the PR i really like this super force formant it's like static analysers that way eyeveryones code looks the same and our editorconfig is applied"
description: Aaron Otto-258 structural-fix directive after noticing I was manually running markdownlint --fix on 9 PRs in drain. Points at the meta-pattern: mostly-auto-fixable = belongs in CI, not in manual drain. Cites SQLSharp's "force format on PR" pattern as the target shape. Save durable.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The rule

**If a lint class is mostly auto-fixable with --fix (or
equivalent), it does NOT belong in the manual-drain
workflow. It belongs in CI / pre-commit.**

Direct Aaron quote 2026-04-24:

> *"mostly auto-fixable with --fix why isn't this just
> part of the build, or have a job like ../SQLSharp to
> force format on the PR i really like this super force
> formant it's like static analysers that way eyeveryones
> code looks the same and our editorconfig is applied"*

## The three-way implementation (GOVERNANCE §24 parity)

Per existing dev/build/devcontainer parity discipline,
any format-class tool must run the same three ways:

1. **Dev-side pre-commit hook** — catches before push,
   fastest signal; dev never has to think about it.
2. **CI-side format-check job** — catches anything dev
   hook missed (or dev skipped hooks); OPTIONAL:
   auto-commits fixes back to the PR branch (the "super
   force format" pattern Aaron names).
3. **Devcontainer / codespace init** — sets up the hooks
   on first entry so new contributors get the same
   defaults without manual setup.

The "super force format" variant: CI job DOES NOT just
check and fail — it RUNS the formatter, stages the diff,
commits with `style: auto-format` message (or similar),
pushes back to the PR branch. Next CI run passes because
the content now conforms. Result: everyone's code
looks the same regardless of individual dev habits.

## Editorconfig — start from proven defaults

Aaron 2026-04-24 addendum: *"i think both of those
project have kick ass editorconfigs there are also good
standard starting points too online"*

The `.editorconfig` Aaron references as authoritative
for this repo is the one he's already been using on his
existing projects (which I can't name by path per the
earlier "never cite external project paths in repo
docs" rule, but Aaron refers to them by name in
conversation). Action for the backlog row: don't write
`.editorconfig` from scratch — pull one of Aaron's
proven in-use configs as the starting point, or pull a
widely-used public seed (e.g. the `dotnet/runtime` root
`.editorconfig` for the C#/F# shape; widely-cited
community seeds for markdown / json / yaml / shell).
Seed + project-specific deltas, not write-from-scratch.

## Candidate tools to wire (non-exhaustive)

Tools the repo already uses or should use:

- **markdownlint-cli2 `--fix`** — MD022/MD026/MD032
  are all auto-fixable; current CI `lint (markdownlint)`
  only checks, doesn't fix. Convert.
- **`dotnet format`** — C#/F# whitespace + style (the
  `.editorconfig` arbiter Aaron specifically cites).
- **shfmt** — shell script formatting (Bodhi / Dejan
  territory). Auto-fixable.
- **prettier (JSON/YAML)** — `.github/workflows/*.yml`,
  `.vscode/*.json`, `openspec/**/*.json`. Auto-fixable.
- **actionlint** — NOT auto-fixable; stays check-only.
- **shellcheck** — NOT auto-fixable; stays check-only.
- **semgrep** — NOT auto-fixable; stays check-only.

The rule of thumb: "if the tool has a --fix or --write
flag, wire it. Otherwise, stays as a check-only gate."

## Why static-analyzer pattern wins

Aaron's framing ("it's like static analyzers that way
everyone's code looks the same"):

- Eliminates bike-shedding about style in PR review
- Makes diffs signal-dense (no whitespace noise)
- Reduces onboarding friction (new dev's IDE doesn't
  need to match house style; CI enforces)
- Eliminates the rework pattern we just hit: 9 PRs
  manually drained over 1 tick for the same
  auto-fixable issue class
- Training-signal-clean per Otto-251: the git history
  shows content changes, not style churn

## Composition with prior memory

- **GOVERNANCE §24** three-way dev/build parity —
  Otto-258 is a specific application: format tools
  run on dev + CI + codespace.
- **Otto-171** queue-saturation — Otto-258 is the
  structural fix that PREVENTS future saturation
  from this specific class. Each tick we spend
  manual-draining format issues is a tick we don't
  spend on substantive work.
- **Otto-250** PR reviews are training signals —
  Otto-258's git history is cleaner signal (no
  whitespace churn muddying the review corpus).
- **Otto-232** bulk-close-as-superseded — Otto-258
  prevents the same cascade pattern by removing the
  manual-drain path entirely.
- **Aaron's "never cite ../SQLSharp" rule** (from
  earlier this session, in PR #377) — Aaron EXPLICITLY
  cites the SQLSharp pattern here by name. He can
  cite external refs in conversation; *I* can't cite
  them in repo docs. When I land the BACKLOG row,
  the pattern description goes verbatim but the
  "../SQLSharp" reference stays out of the repo text.

## What to land (backlog-owed, not yet landed)

Per queue-saturation discipline I do NOT open a new PR
for this right now. When drain clears:

- **P1 BACKLOG row** — "Auto-format CI job (markdownlint
  + dotnet format + shfmt + prettier) on every PR;
  super-force-format pattern commits fixes back to the
  PR branch; three-way parity via pre-commit hook +
  CI + devcontainer per GOVERNANCE §24. Effort:
  M (markdownlint first — simplest), then L (full matrix
  rollout). Eliminates manual-drain cadence for
  auto-fixable lint classes."
- **Prototype order** — markdownlint first (already
  proven via manual --fix this tick); dotnet format
  second (largest repo surface; highest dev-velocity
  win); shfmt + prettier third (lower-volume but
  still worth).

## Direct Aaron quote to preserve

> *"mostly auto-fixable with --fix why isn't this just
> part of the build, or have a job like ../SQLSharp to
> force format on the PR i really like this super force
> formant it's like static analysers that way eyeveryones
> code looks the same and our editorconfig is applied"*

Future Otto: if you find yourself manually running a
--fix / --write / auto-repair command across 3+ PRs in
a single tick, STOP. That's a structural-fix signal.
File the BACKLOG row (or extend the Otto-258 row) to
push the fix into CI instead. Every tick of manual
drain for an auto-fixable class is a tick that should
have been spent on the structural fix.
