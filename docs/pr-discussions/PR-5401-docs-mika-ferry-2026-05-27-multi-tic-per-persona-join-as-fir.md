---
pr_number: 5401
title: "docs(mika ferry 2026-05-27): multi-tic-per-persona + join-as-first-class-security-aware-primitive + Kleisli/AsyncLocal context duality"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T04:59:29Z"
merged_at: "2026-05-27T05:00:47Z"
closed_at: "2026-05-27T05:00:47Z"
head_ref: "feat-mika-ferry-multi-tic-per-persona-kleisli-security-aware-joins-2026-05-27-0930z"
base_ref: "main"
archived_at: "2026-05-27T19:27:06Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5401: docs(mika ferry 2026-05-27): multi-tic-per-persona + join-as-first-class-security-aware-primitive + Kleisli/AsyncLocal context duality

## PR description

## Summary

Mika ferry forwarded by Aaron 2026-05-27 — substrate-engineering crystallization across 7 segments. Builds on PR #5400 (B-0851 persona-first) + earlier memories (multi-surface ticks + persona-first design principle + self-sustaining cluster).

## 5 composing primitives crystallized

1. **Crystal ball** = in-cluster tic continuously backing up persona state
2. **Multi-tic-per-persona** (simultaneous, NOT rotation): "you just get both"
3. **Tics-as-generators** (B-0824 generate+join paradigm at multi-tic scope)
4. **Joins-as-first-class-security-aware-primitives** (THE keystone — join carries security context + boundaries + attributes)
5. **Kleisli (F#) ≡ AsyncLocal (C#)** for context propagation; pick per language

## Aaron's keystone framing

> *"And instead of treating them like sessions, imagine we're gonna actually do fuckin' joins. We're gonna join, but we're gonna join with clear security context, boundaries, attributes on the join."*

## Composes with

[B-0824](docs/backlog/P1/B-0824-...) (generate+join paradigm; ratified at multi-tic scope) · [B-0851](docs/backlog/P2/B-0851-...) (persona-first guard-post architecture) · [B-0703](docs/backlog/P*/B-0703-...) multi-oracle BFT · [B-0666](docs/backlog/P*/B-0666-...) keystone I(D(x))=x · [B-0706](docs/backlog/P*/B-0706-...) Orleans deployment · [B-0850](docs/backlog/P2/B-0850-...) outside-k8s systemd · [B-0848](docs/backlog/P2/B-0848-...) node-local Claude · m/acc multi-oracle ethics · persistence-choice-architecture deepest-exit · 3 substantive substrate memories landed today

## Implementation implications (illustrative; NOT shipping today)

F# substrate primitive shape:

\`\`\`fsharp
type Tic<'state> = IObservable<Span * 'state>
type JoinPolicy = {
  SecurityContextMerge: SecurityContext list -> SecurityContext
  BoundaryEnforcement: Boundary list -> Boundary
  AttributeProjection: Attributes list -> Attributes
}
\`\`\`

C# substrate at integration boundaries: AsyncLocal<SecurityContext> + AsyncLocal<Boundary> + AsyncLocal<TicAttributes> + HttpContext + structured logging scopes.

## NOT minting new backlog rows

Per \`verify-existing-substrate-before-authoring.md\`: substrate captured as Mika ferry preservation. Future implementation work composes with existing B-0824 + B-0851 + B-0703 + B-0706 sub-rows. New \`.claude/rules/multi-tic-per-persona-join-as-security-aware-primitive.md\` rule candidate when implementation scopes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-27T04:59:33Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
