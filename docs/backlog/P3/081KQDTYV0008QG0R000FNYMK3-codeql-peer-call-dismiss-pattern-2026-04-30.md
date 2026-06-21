---
id: 081KQDTYV0008QG0R000FNYMK3
priority: P3
status: open
title: CodeQL `js/indirect-command-line-injection` dismissal pattern for peer-call siblings (gemini.ts, codex.ts)
tier: factory-hygiene
effort: S
ask: surfaced during slice-15 PR #896 review on 2026-04-30
created: 2026-04-30
last_updated: 2026-05-02
depends_on: []
composes_with: [081KQ8P5D0008QG0R003BFZPRC]
tags: [ci-codeql, peer-call, by-design-suppression, missing-mechanism]
type: friction-reducer
---

# CodeQL by-design dismissal pattern for peer-call siblings

When porting `tools/peer-call/grok.sh` to TS in slice 15 (PR #896),
CodeQL flagged `js/indirect-command-line-injection` (medium severity)
on the `runContextCmd` shell-out. This is **by-design** — the script
contract is "user explicitly supplies a shell command via
`--context-cmd`"; same trust boundary as the bash original's `eval`.

Resolution on PR #896: dismiss the alert via API with a 280-char
justification:

```bash
gh api repos/Lucent-Financial-Group/Zeta/code-scanning/alerts/<N> \
  -X PATCH \
  -f state=dismissed \
  -f "dismissed_reason=won't fix" \
  -f "dismissed_comment=<280-char justification>"
```

The two sibling ports — `tools/peer-call/gemini.sh` and
`tools/peer-call/codex.sh` — will hit the same alert when ported
(slices 16 + 17 candidates) since they have the same `runContextCmd`
pattern.

## Two options

**A — Per-PR dismissal (status quo)**

- Each sibling-port PR triggers the alert + needs the same
  dismissal API call.
- Cost: ~30 seconds per PR.
- Pro: explicit per-instance acknowledgment.
- Con: repeated boilerplate; reviewer fatigue; drift risk if a
  future sibling port subtly changes the shape.

**B — Structural exclusion in `.github/codeql/codeql-config.yml`**

- One-time exclusion of the rule for `tools/peer-call/*.ts`.
- Cost: ~1 PR (small YAML change).
- Pro: drift-resistant; no per-PR work; consistent across siblings.
- Con: blanket suppression — if a real injection bug landed in a
  future peer-call refactor, CodeQL wouldn't catch it.

## Recommendation

Option B with a tight path scope (`tools/peer-call/*.ts`) and a
comment in the YAML referencing this row. The `runContextCmd`
helper has a stable shape; if it ever changes form (e.g., to use
`shell-quote` per CodeQL's recommendation), the exclusion can be
removed in the same PR.

## Acceptance criteria

- `.github/codeql/codeql-config.yml` adds a CodeQL filter that
  scopes `js/indirect-command-line-injection` to exclude
  `tools/peer-call/*.ts`. The exact syntax should be verified
  during implementation: CodeQL supports `query-filters` (rule-
  scoped) and `paths-ignore` (path-scoped); per-rule + per-path
  scoping requires combining them or using a custom suite — see
  CodeQL docs at <https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning/customizing-your-advanced-setup-for-code-scanning>
  before committing the form.
- Comment in YAML cites this row + slice 15 + by-design justification.
- New PR for slice 16 (gemini port) does NOT raise the alert.

## Composes with

- **081KQ8P5D0008QG0R003BFZPRC** — TS+Bun migration trajectory.
- **PR #896** — slice 15 (peer-call/grok) where the dismissal pattern
  first surfaced.

## Effort

**S (small)** — ~10 lines of YAML + commit + verify on next sibling
PR.
