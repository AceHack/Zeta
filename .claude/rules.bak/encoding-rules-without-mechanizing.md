# Encoding rules without mechanizing — razor-cadence discipline

Carved sentence (B-0192):

> Encoding rules without mechanizing them produces a memory
> of failures, not prevention.

## Operational content

On wake, run the following to check whether the daily
razor-cadence workflow (`.github/workflows/razor-cadence.yml`,
fires 09:17 UTC) has surfaced pending razor-pass work:

```
gh issue list --repo Lucent-Financial-Group/Zeta --label razor-cadence --state open
```

The tracking issue carries a 5-item cadence checklist (Test 1
metaphysical-cut, Test 2 unfalsifiability-cut, mechanization
audit, composes-with audit, MEMORY.md index audit). Issues age
in the open state until the pass is run + closed; age IS the
cadence-skip signal.

The workflow fires whether or not any agent is running — the
discipline does not depend on anyone remembering.

## Full reasoning

`docs/backlog/P1/B-0192-github-actions-razor-cadence-trigger-aaron-2026-05-04.md`
