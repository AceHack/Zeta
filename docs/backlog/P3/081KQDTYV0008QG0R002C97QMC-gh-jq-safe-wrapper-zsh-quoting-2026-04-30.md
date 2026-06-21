---
id: 081KQDTYV0008QG0R002C97QMC
priority: P3
status: open
title: tools/gh-jq-safe.sh — wrap gh-jq calls to handle zsh quoting (Deepseek 2026-04-30 finding)
tier: factory-hygiene
effort: S
ask: Recurring zsh-quoting failures on `gh pr view --jq '...'` invocations cause command failures with "unexpected token \\". Otto's workaround is fall-back to `python3 -c`, which works but adds friction. A small wrapper script handles the quoting consistently.
created: 2026-04-30
last_updated: 2026-05-02
depends_on: []
composes_with:
  - tools/github/poll-pr-gate.ts
  - feedback_kernel_pipe_vs_js_space_stream_ordering_ts_bun_port_pattern_2026_04_30.md
tags: [deepseek-2026-04-30, zsh, gh-cli, jq, friction-reduction, peer-review-finding]
type: friction-reducer
---

# 081KQDTYV0008QG0R002C97QMC — tools/gh-jq-safe.sh wrapper (zsh quoting friction)

## Source

Deepseek peer review 2026-04-30 (Review 10 in
`docs/research/2026-04-30-session-end-peer-ai-reviews-verbatim.md`):

> *"`jq` quoting issues in zsh are still causing command
> failures. Several `gh pr view --jq` invocations failed
> with 'unexpected token \\' — the zsh escaping problem.
> Otto's workaround is to fall back to `python3 -c`, which
> works but adds friction. A tiny helper script
> (`tools/gh-jq-safe.sh`) that handles the quoting
> automatically would eliminate this recurring error class."*

## What

Author `tools/gh-jq-safe.sh` (or `.ts` per the TS-default
discipline) — a thin wrapper around `gh ... --jq` that
handles zsh-quoting edge cases. The wrapper passes the jq
expression through a more robust quoting path (e.g., heredoc
or temp-file) instead of inline shell-quoted argv.

Sketch:

```bash
#!/usr/bin/env bash
# tools/gh-jq-safe.sh
#
# Usage: gh-jq-safe.sh <gh-args...> --jq-from-stdin
#                     <<<'<jq-expression>'
#
# Or:    gh-jq-safe.sh <gh-args...> --jq-file <file>

# Implementation reads the jq expression from stdin or file,
# bypassing zsh argv-quoting entirely.
```

A TS-port equivalent for `bun run` would also work.

## Why P3

- The workaround (python3 fallback) is functional.
- Per-occurrence friction is small (one or two extra commands).
- The fix is narrow scope (one helper script).

## Acceptance criteria

- [ ] Wrapper script handles common gh + jq invocation
  patterns without zsh-quoting failures
- [ ] Works on macOS zsh + Linux Ubuntu bash per
  Otto-235 four-shell target
- [ ] Unit test or fixture-test demonstrates the
  failure-then-fix on a known zsh-tripping jq pattern
- [ ] Documented in `tools/github/README.md` (when that
  file exists) or inline in the wrapper

## Trigger condition for promotion to P2

If the friction blocks substantive workflow ≥1 time per
session for 3 consecutive sessions, promote to P2.

## Composes with

- `tools/github/poll-pr-gate.ts` (sibling tool; same surface)
- TS+Bun discipline (081KQDTYV0008QG0R000XFYDTT, the TS-port pattern)
- Bash-compatibility target (Otto-235)
