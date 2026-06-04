# Rule 0 — no more `.sh` files except install-graph

Carved sentence:

> TypeScript IS cross-platform DST — deterministic, reproducible,
> Bun-hosted. Bash (`.sh`) is for install-graph only: pre-bootstrap
> setup scripts that must run before TS is available (`tools/setup/`).

## Operational content

**Allowed `.sh` files**: only files in `tools/setup/` — pre-bootstrap
install scripts that must run before Bun/TS is available.

**Everything else is TS**: hygiene audits, lint scripts, peer-call
wrappers, harness hooks, factory cadences — all `.ts`, run via `bun`.

**Why**: TypeScript is cross-platform DST (deterministic simulation
testing applies; reproducibility from seed; Bun runtime hosts TS
factory tools). Bash is forgotten and non-deterministic.

**Legacy violations cleared 2026-05-13**: the three previously-tracked
`tools/hygiene/audit-*.sh` violations (`audit-lost-files.sh`,
`audit-trajectories.sh`, `audit-backlog-items.sh`) have all been ported
to `.ts`. The current `tools/hygiene/` directory is entirely
Rule-0-compliant.

**Remaining audit question (out of scope for Rule 0 itself)**: the Lior
agent's `.gemini/service/install-lior-service.sh` +
`.gemini/service/lior-loop.sh` live outside `tools/setup/`. They are
install-graph by intent (Lior's launchd-equivalent service bootstrap)
but the rule's "only `tools/setup/`" phrasing technically excludes
them. Resolution is a separate design question — either expand the
rule's allowed-path list to include agent-specific install-graph
locations or port / relocate them under `tools/setup/`. Either way,
NOT a "legacy violation" in the same sense as the cleared three.

**Rule 0** — named as the filter every authoring impulse must pass
BEFORE any other factory discipline. Composes with
`memory/feedback_dst_justifies_ts_quality_over_bash_and_harness_hooks_suffice_no_git_hooks_aaron_2026_05_03.md`
(the existing TS-over-bash + harness-hooks-suffice discipline).

This is NOT a directive per Otto-357; the human maintainer 2026-05-05
articulation surfaced the rule-name; the rule itself predates that tick.

## Full reasoning

`memory/feedback_dst_justifies_ts_quality_over_bash_and_harness_hooks_suffice_no_git_hooks_aaron_2026_05_03.md`
