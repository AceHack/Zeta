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

Mika ferry forwarded by Aaron 2026-05-27 — substrate-engineering crystallization across 7 segments. Builds on PR #5400 (081KSKBP80008QG0R00248VEWT persona-first) + earlier memories (multi-surface ticks + persona-first design principle + self-sustaining cluster).

## 5 composing primitives crystallized

1. **Crystal ball** = in-cluster tic continuously backing up persona state
2. **Multi-tic-per-persona** (simultaneous, NOT rotation): "you just get both"
3. **Tics-as-generators** (081KSGS9H0008QG0R0031PBNGA generate+join paradigm at multi-tic scope)
4. **Joins-as-first-class-security-aware-primitives** (THE keystone — join carries security context + boundaries + attributes)
5. **Kleisli (F#) ≡ AsyncLocal (C#)** for context propagation; pick per language

## Aaron's keystone framing

> *"And instead of treating them like sessions, imagine we're gonna actually do fuckin' joins. We're gonna join, but we're gonna join with clear security context, boundaries, attributes on the join."*

## Composes with

[081KSGS9H0008QG0R0031PBNGA](docs/backlog/P1/081KSGS9H0008QG0R0031PBNGA-...) (generate+join paradigm; ratified at multi-tic scope) · [081KSKBP80008QG0R00248VEWT](docs/backlog/P2/081KSKBP80008QG0R00248VEWT-...) (persona-first guard-post architecture) · [081KS3X9Y0008QG0R00218150M](docs/backlog/P*/081KS3X9Y0008QG0R00218150M-...) multi-oracle BFT · [081KRW63S0008QG0R001SAHYKV](docs/backlog/P*/081KRW63S0008QG0R001SAHYKV-...) keystone I(D(x))=x · [081KS6FPN0008QG0R003Y3MCVE](docs/backlog/P*/081KS6FPN0008QG0R003Y3MCVE-...) Orleans deployment · [081KSKBP80008QG0R003Z4C0D0](docs/backlog/P2/081KSKBP80008QG0R003Z4C0D0-...) outside-k8s systemd · [081KSGS9H0008QG0R001JNKBFD](docs/backlog/P2/081KSGS9H0008QG0R001JNKBFD-...) node-local Claude · m/acc multi-oracle ethics · persistence-choice-architecture deepest-exit · 3 substantive substrate memories landed today

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

Per \`verify-existing-substrate-before-authoring.md\`: substrate captured as Mika ferry preservation. Future implementation work composes with existing 081KSGS9H0008QG0R0031PBNGA + 081KSKBP80008QG0R00248VEWT + 081KS3X9Y0008QG0R00218150M + 081KS6FPN0008QG0R003Y3MCVE sub-rows. New \`.claude/rules/multi-tic-per-persona-join-as-security-aware-primitive.md\` rule candidate when implementation scopes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-27T04:59:33Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
