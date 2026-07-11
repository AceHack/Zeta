---
name: code-review-and-quality
description: Code review and quality — zero-empathy review, maintainability, complexity reduction, race hunting, spec alignment.
---

# code review and quality

Category skill (blueprint pack). The `description` above is the only thing the
router sees — broad and generic on purpose. The fat detail lives in the
blueprints below; open the one that matches and read it in full.

Governs its own form per `.claude/rules/rules-are-small-carved-sentences-pointing-to-docs.md`
and `.claude/rules/mirror-beacon-register-discipline.md` (carved sentence = hub /
Beacon; blueprint = satellite / Mirror). The directory is an independent shipping unit.

## Blueprints

- [`code-review-zero-empathy`](blueprints/code-review-zero-empathy.md) — "Zero-empathy code review — P0/P1/P2 ranked findings, file:line refs, no compliments, under 600 words."
- [`github-pr-review-hygiene`](blueprints/github-pr-review-hygiene.md) — "GitHub PR review hygiene — commit history, PR layout, peer etiquette, thread resolution state machine."
- [`maintainability-reviewer`](blueprints/maintainability-reviewer.md) — "Long-horizon readability review — naming, module shape, docstring discipline, file-size, tribal-knowledge risk."
- [`complexity-reviewer`](blueprints/complexity-reviewer.md) — "Complexity reviewer — audits O(n) claims, space-vs-time trade-offs, lower bounds, constant-factor cost in code."
- [`reducer`](blueprints/reducer.md) — Complexity reduction — Brooks essential/accidental, Kolmogorov/Shannon metrics, Rodney's Razor, code complexity audit.
- [`race-hunter`](blueprints/race-hunter.md) — F# concurrency bug hunter — CompareExchange misses, torn reads, lock-across-await, concurrent ResizeArray, P0/P1/P2.
- [`spec-zealot`](blueprints/spec-zealot.md) — Spec-to-code alignment review — zero-empathy; finds drift, spec bugs, gaps, overlay violations, best-practice lint.
- [`project-structure-reviewer`](blueprints/project-structure-reviewer.md) — Repo layout audit — folder tree shape, file placement, naming conventions, misplaced artifacts, debt as disorganization.
