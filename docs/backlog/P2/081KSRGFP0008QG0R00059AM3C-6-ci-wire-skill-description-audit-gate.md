---
id: 081KSRGFP0008QG0R00059AM3C
priority: P2
status: open
title: "CI-wire the skill-description audit gate so the cap is enforced, not just checkable"
created: 2026-05-29
last_updated: 2026-05-29
parent: 081KR50HA0008QG0R002ZNFQBZ
depends_on: []
classification: buildable-now
decomposition: atomic
type: friction-reducer
tags: [skill-routing, ci, durable-gate, carved-sentence]
---

# 081KSRGFP0008QG0R00059AM3C — CI-wire the skill-description audit gate

081KR50HA0008QG0R002ZNFQBZ.4 (PR #6029) shipped `tools/hygiene/audit-skill-description-length.ts`,
a deterministic Rule-0 gate that fails on any over-cap, multiline, or
boilerplate skill description. But nothing runs it automatically — a
description can silently regrow past the routing budget and only be
caught when someone manually invokes the tool. CI-wiring is what makes
the structural fix durable rather than checkable.

This child is robustness-hardening on top of the merged tool; it is not
in the 081KR50HA0008QG0R002ZNFQBZ acceptance contract (which closes on #4 / 081KSRGFP0008QG0R0037CJXA8), so it
does not block umbrella closure. It does, however, prevent the original
081KR50HA0008QG0R002ZNFQBZ failure mode from re-opening over time.

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

- Promoting the ≤120 warnings to errors (would block on 081KSRGFP0008QG0R002SV9GGY).
- Any change to the audit tool's logic (081KR50HA0008QG0R002ZNFQBZ.4 owns the tool).

## Composes with

- 081KR50HA0008QG0R002ZNFQBZ (umbrella) — durable enforcement of its structural fix.
- 081KR50HA0008QG0R002ZNFQBZ.4 — the audit tool this workflow invokes.
- `.github/workflows/role-ref-current-state-surfaces-lint.yml` — the
  precedent CI lint to mirror.
