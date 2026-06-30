---
id: B-0742
priority: P2
status: open
title: Local AI Path 1 - Forge CLI/harness integration
effort: M
ask: Lior 2026-05-23 decomposition of B-0068
created: 2026-05-23
last_updated: 2026-05-23
depends_on: [B-0068]
tags: [local-ai, multi-harness, ollama, forge]
type: feature
---

# B-0742 — Local AI Path 1: Forge CLI/harness integration

This is the first decomposed task from the [B-0068](B-0068-local-ai-trajectory-forge-ollama-direct-integration-aaron-2026-04-28.md) local AI trajectory umbrella.

## Why

This is the fastest path to leveraging local AI substrate, as the Forge CLI has native support for Ollama.

## What

- Add Forge to the agent / CLI roster.
- WebSearch the current Forge CLI version, supported model surface, and Ollama bridge before any commitment in code.
- Any Forge-routed work must name Forge as the harness in the PR / commit / tick-history at point of use.
