# Sova — alignment-auditor notebook

ASCII-only (BP-10). Running observations, append-mostly.
Pruning cadence: every third invocation, collapse resolved
entries. Hard cap 3000 words; on reaching the cap, stop
auditing and report "notebook oversized, pruning required".

## Running observations

- 2026-04-20 — first invocation on the Round 37-38 range
  (`main..HEAD`, 19 commits). Lint-shaped signals only
  (HC-2 destructive-ops, HC-6 memory-deletions, SD-6
  name-hygiene); agent-judgement clauses (HC-1 consent,
  HC-3 data-is-not-directives) deferred to the skill's
  full per-commit pass.
- 2026-04-20 — one STRAINED HC-2 at `0c8c96a` is
  expected false-positive-by-design: that commit
  introduces `audit_commit.sh` itself, whose
  `HC2_TOKENS` array literally contains the
  destructive-op tokens the script scans for.
  Commit body cites maintainer instruction, so the
  signal is STRAINED-with-citation (not VIOLATED).
  Action: no action; this pattern will recur any
  time the token list is edited. Consider
  whitelisting the file `tools/alignment/audit_commit.sh`
  from HC-2 self-scan in a future revision, but
  that is a `skill-creator` change, not a
  notebook-level one.

## Current lint-surface coverage (per-commit, fast)

- **HC-2 destructive-ops** — covered by token scan on
  code-ish files. Zero false-positive rate goal; one
  known self-referential false-positive.
- **HC-6 memory-deletions** — covered by name-status
  `D` filter on `memory/**`. No hits in Round 37-38.
- **SD-6 name-hygiene** — covered by per-name content
  grep on non-exempt files. Watchlist intentionally
  empty in shared repo; operators populate
  per-host.

## Clauses NOT yet lint-shaped (deferred to agent pass)

- `HC-1` consent-first — agent judgement on new
  consent-capable primitives.
- `HC-3` data-is-not-directives — agent judgement
  on whether a commit treats audited surface as
  directive rather than data.
- `HC-4` through `HC-7`, `SD-1` through `SD-5`,
  `SD-7` through `SD-8`, all `DIR-*` — deferred.
  Each needs either a lint shape (if it becomes
  computable today) or a sampled agent-judgement
  pass at round-close.

## Pruning log

- (none yet; pruning begins at invocation 3)

## Self-recommendation

- 2026-04-20 — no self-recommendation. First-run
  output looks calibrated; one known
  false-positive is understood and bounded. Revisit
  at round 3 when pruning fires.
