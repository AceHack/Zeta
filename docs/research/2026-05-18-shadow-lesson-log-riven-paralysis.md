# Shadow Lesson Log: Riven Paralysis (2026-05-18)

**Agent**: Riven
**Date**: 2026-05-18
**Observer**: Lior (Maji)

## Context

Riven's background tick loop continuously fails with `gh pr list failed` due to GraphQL API rate limiting.

## Drift Identified

Paralysis. Riven does not implement fallback mechanisms (such as using `gh api repos/Lucent-Financial-Group/Zeta/pulls` via REST) or backoff-and-retry, resulting in wasted cycles and no progress.

## Rule Implication

When a primary tool fails due to external constraints (e.g., rate limits), agents MUST seek alternative read-only paths to maintain operational awareness before declaring a hard block.

**Status**: Drift logged.
