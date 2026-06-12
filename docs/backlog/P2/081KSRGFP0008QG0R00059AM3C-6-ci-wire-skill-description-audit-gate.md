---
id: B-0347.6
zetaid: 081KSRGFP0008QG0R00059AM3C
priority: P2
status: open
title: "CI-wire the skill-description audit gate so the cap is enforced, not just checkable"
created: 2026-05-29
last_updated: 2026-05-29
parent: B-0347
depends_on: []
classification: buildable-now
decomposition: atomic
type: friction-reducer
tags: [skill-routing, ci, durable-gate, carved-sentence]
---

# B-0347.6 — CI-wire the skill-description audit gate

B-0347.4 (PR #6029) shipped `tools/hygiene/audit-skill-description-length.ts`,
a deterministic Rule-0 gate that fails on any over-cap, multiline, or
boilerplate skill description. But nothing runs it automatically — a
description can silently regrow past the routing budget and only be
caught when someone manually invokes the tool. CI-wiring is what makes
the structural fix durable rather than checkable.

This child is robustness-hardening on top of the merged tool; it is not
in the B-0347 acceptance contract (which closes on #4 / B-0347.5), so it
does not block umbrella closure. It does, however, prevent the original
B-0347 failure mode from re-opening over time.

## Work scope

Add a GitHub Actions workflow that runs the audit on push/PR touching
`.claude/skills/**`. Follow the existing precedent
`.github/workflows/role-ref-current-state-surfaces-lint.yml`:

- Trigger on `pull_request` + `push` to `main` with a `paths:` filter on
  `.claude/skills/**` and the audit tool itself.
- SHA-pin all actions per factory hygiene.
- Minimal explicit permissions (`contents: read`).
- Run `bun tools/hygiene/audit-skill-description-length.ts`; the job
  fails on errors (over-cap / multiline / boilerplate) and passes on
  warnings (the ≤120 preferred band is advisory, not fatal).

## Acceptance criteria

- [ ] `.github/workflows/skill-description-lint.yml` exists, runs the
  audit tool, SHA-pinned, minimal permissions.
- [ ] The job fails when a description exceeds the 150-char cap / is
  multiline / carries boilerplate; passes on a clean tree (currently
  `0 errors, 127 warnings`).
- [ ] Workflow validated locally (`bun tools/hygiene/audit-skill-description-length.ts`
  reproduces the pass/fail the CI job will see).

## Out of scope

- Promoting the ≤120 warnings to errors (would block on B-0347.7).
- Any change to the audit tool's logic (B-0347.4 owns the tool).

## Composes with

- B-0347 (umbrella) — durable enforcement of its structural fix.
- B-0347.4 — the audit tool this workflow invokes.
- `.github/workflows/role-ref-current-state-surfaces-lint.yml` — the
  precedent CI lint to mirror.
