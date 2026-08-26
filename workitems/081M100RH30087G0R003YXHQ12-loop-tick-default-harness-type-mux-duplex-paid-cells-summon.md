---
id: 081M100RH30087G0R003YXHQ12
type: task
state: backlog
priority: P1
slug: loop-tick-default-harness-type-mux-duplex-paid-cells-summon
title: "loop-tick default harness type mux-duplex: paid cells summon through our tool loop not vendor CLIs"
created: 2026-08-26T21:49:00.896Z
depends_on: ["081M100RB97087G0R0008EAAY7", "081M100RH29087G0R0031HHGJ0", "081M100RH3Q087G0R0018X4RSJ"]
composes_with: []
---

# loop-tick default harness type mux-duplex: paid cells summon through our tool loop not vendor CLIs

`persona-registry.ts` already has `harness.type?: "cli" | "local-llm" |
"openai-stream" | "mux-duplex"`. Production entries omit it, so
`loop-tick` spawnSyncs vendor CLIs (`claude`, `codex`, `kiro-cli`,
`agy`, `cursor-agent`).

## Must

- Default paid cells to `mux-duplex` (or `openai-stream` while only
  ChatGPT is wired) calling `summon` / `runToolLoop` over the closed
  tool surface and the stored account token.
- Vendor CLI spawn becomes the *degraded* path, named, not the default.
- Full-duplex four-corner is the live chat shape once a provider's
  wire can carry feedback; until then SSE/stream is the honest fill.

## Falsifier

`loop-tick --persona vera` (and one Claude cell, one Grok cell) completes
a tool-using turn with **no** `spawnSync` of `codex`/`claude`/`cursor-agent`.
The session is the token in `~/.config/zeta/auth/`.
