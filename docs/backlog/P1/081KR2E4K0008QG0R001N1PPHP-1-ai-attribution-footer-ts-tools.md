---
id: 081KR2E4K0008QG0R001N1PPHP
priority: P1
status: closed
title: "Layer 4: AI attribution footer for TS comment-posting tools"
created: 2026-05-08
last_updated: 2026-05-08
depends_on: []
parent: 081KQGDBJ0008QG0R001JC9HCJ
classification: buildable-now
type: friction-reducer
---

# 081KR2E4K0008QG0R001N1PPHP — Layer 4: AI attribution footer for TS comment-posting tools

**Slice of:** [081KQGDBJ0008QG0R001JC9HCJ](081KQGDBJ0008QG0R001JC9HCJ-port-meta-learning-4-layer-pattern-from-stcrm-aaron-2026-05-01.md)

## What

Create a shared `tools/github/ai-attribution.ts` utility that appends a
machine-readable attribution footer to any AI-posted GitHub comment body.
Integrate into `tools/git/batch-resolve-pr-threads.ts` (the only TS tool
that currently posts PR thread replies).

Footer format: `🤖 *Posted by <agent-name> on behalf of @<username>*`

## Why

When an AI agent posts PR comments via `gh api` using a human's PAT, the
comment appears under the human's GitHub identity. Readers cannot
distinguish human-written from agent-written responses. The footer makes
authorship transparent — glass halo applied to PR interactions.

## Acceptance criteria

1. `tools/github/ai-attribution.ts` exports `appendAttribution(body, opts)`.
2. `tools/github/ai-attribution.test.ts` covers agent-only and on-behalf-of cases.
3. `batch-resolve-pr-threads.ts` uses `appendAttribution` for every reply it posts.
4. `bun test tools/github/ai-attribution.test.ts` passes.
5. `dotnet build -c Release` still passes (no .NET changes, but gate must hold).

## Out of scope

- GitHub Actions workflow attribution (YAML/bash — separate child 081KR2E4K0008QG0R0005GS263).
- Layers 1-3 documentation (081KR2E4K0008QG0R002MG5Q5Z).
- Pilot validation (081KR2E4K0008QG0R000G0DAY4).
