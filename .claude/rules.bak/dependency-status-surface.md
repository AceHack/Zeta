# Dependency-status surface — check before arming auto-merge

Carved sentence:

> `docs/dependency-status.md` answers cold-start health in 30 seconds.
> Degraded GitHub Pull Requests component can return wrong-state thread
> counts — verify precondition before classifying a "wait."

## Operational content

`docs/dependency-status.md` is a first-class factory surface (B-0109).
Answers three cold-start questions in under 30 seconds:

1. What does the factory depend on?
2. Are any deps currently flagged or degraded?
3. Is there a known issue affecting our merge / CI / review pipeline?

It includes an answer-now `curl | jq` snippet that returns GitHub
component status without auth.

**Composes with BLOCKED-with-green-CI rule**: the
`blocked-green-ci-investigate-threads.md` rule presupposes that the
GitHub API is reporting truth. The dependency-status surface verifies
that precondition. Consult before arming auto-merge or classifying
a "wait" — a degraded GitHub Pull Requests component can return
wrong-state thread counts.

## Full reasoning

`docs/backlog/P0/B-0109-dependency-status-tracking-surface-2026-04-30.md`
