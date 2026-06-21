---
id: 081KR50HA0008QG0R0019KYAAS
priority: P3
status: open
title: Conversation interface Path A — embed browser/local LLM (WebLLM or transformers.js) in dashboard for in-context review discussion
tier: engineering
effort: L
ask: decomposition of 081KQ0YZ80008QG0R0003GAYYN
created: 2026-05-09
last_updated: 2026-05-09
depends_on: [081KR50HA0008QG0R002NZENZJ]
composes_with: [081KQ0YZ80008QG0R0003GAYYN, 081KR50HA0008QG0R002DR44J1, 081KR50HA0008QG0R000TQKYGM, 081KR50HA0008QG0R00223YZP8, 081KR50HA0008QG0R0036HGEJ5, 081KR50HA0008QG0R003BM7FNK, 081KR50HA0008QG0R001DX165X, 081KR50HA0008QG0R002NZENZJ]
parent: 081KQ0YZ80008QG0R0003GAYYN
tags: [frontier, conversation-interface, local-llm, weblllm, transformers-js, dashboard, operational-resonance, path-a]
type: feature
---

# 081KR50HA0008QG0R0019KYAAS — Conversation interface Path A: browser/local LLM

## What

Embed a browser-hosted local LLM in the Operational Resonance
Dashboard so the maintainer can discuss architectural decisions
in-context without paying per-call API costs.

This implements the 2026-05-04 architectural extension in 081KQ0YZ80008QG0R0003GAYYN:

> *"The UI should have a conversation interface too."*
> *"Hopefully talking to a local/browser based AI so it won't
> cost us money lol."*

This is **Path A — bridge implementation** while Path B
(Zeta-native Bayesian inference seed executor) matures.

### Feature scope

**1. Chat widget in the dashboard**

A sidebar or bottom-panel chat interface that:

- Is scoped to the current dashboard context (maintainer is
  viewing a tier-2 batch of PRs; the LLM can see those PR
  summaries as context)
- Supports multi-turn conversation
- Persists conversation history for the session in localStorage
- Does NOT send data to external APIs (all inference is local)

**2. Local LLM runtime (Path A)**

Two options to evaluate; implementer picks after checking
current upstream state (Otto-364 search-first):

**Option A1 — WebLLM** (`web-llm` npm package):

- Runs LLMs in the browser via WebGPU (Chrome/Edge on capable hardware)
- Supports Llama, Phi, Mistral, Gemma families
- Good for capable hardware; degrades on weak hardware

**Option A2 — transformers.js** (`@huggingface/transformers`):

- Runs smaller models via WebAssembly + ONNX
- Works on more hardware (no WebGPU required)
- Lower capability ceiling than WebLLM

Implementer chooses after:

1. WebSearch current docs for both libraries (Otto-364)
2. Evaluating which model families work for "review discussion"
   (needs reasoning, not just text completion)
3. Considering hardware accessibility — can all target maintainers
   run the chosen runtime?

**3. Context injection**

The LLM chat is context-aware:

- When viewing the tier-grouped review surface, the current
  batch of PRs/items is injected as context
- Context injection is minimal: PR title + description +
  tier classification + current status (not full diff)
- Context size respects the local model's context window

**4. Path B readiness**

The conversation interface is designed so that Path A runtime
can be swapped for Path B (Zeta-native Bayesian inference seed
executor) without changing the chat UI surface. The LLM
adapter is behind a TypeScript interface:

```typescript
interface ConversationAdapter {
  send(message: string, context: DashboardContext): Promise<string>;
  isReady(): Promise<boolean>;
  modelInfo(): { name: string; runtime: "webllm" | "transformers-js" | "zeta-native" };
}
```

## Cost constraint

**Zero external API costs per review session.** This is not a
preference; it is a hard constraint from 081KQ0YZ80008QG0R0003GAYYN (Aaron 2026-05-04:
"hopefully talking to a local/browser based AI so it won't cost
us money lol"). Path A satisfies this via local inference.

## Why after 081KR50HA0008QG0R002NZENZJ

The conversation interface embeds in the MVP dashboard surface.
Without the MVP surface (081KR50HA0008QG0R002NZENZJ) providing the context that the
chat widget operates on (current tier-grouped items, status
signals), the chat has nothing to be contextually aware of.

## Output artifacts

- `frontend/operational-resonance/src/chat/` — chat widget
  TypeScript components
- `frontend/operational-resonance/src/chat/adapter.ts` — the
  `ConversationAdapter` interface + Path A implementation
- Design decision note in the PR body: which option (A1 or A2)
  was chosen and why (with WebSearch citations)

## Focused check

```bash
ls frontend/operational-resonance/src/chat/
grep "ConversationAdapter" frontend/operational-resonance/src/chat/adapter.ts
```

Expected: chat directory present, `ConversationAdapter` interface defined.

## Acceptance signal

- Chat widget renders in the dashboard
- Local LLM loads in the browser without external API calls
  (verify via network tab — no outbound API requests)
- Multi-turn conversation works with the dashboard context
- `ConversationAdapter` interface defined (Path B swap-ready)
- No TypeScript errors in build

## Pre-start checklist

- [x] Prior-art search: no existing conversation interface for this
  dashboard in `frontend/`. WebLLM and transformers.js prior art
  is in upstream libraries — check current docs via WebSearch
  (Otto-364) before choosing runtime.
- [x] Dependency-restructure: `depends_on: [081KR50HA0008QG0R002NZENZJ]` — needs MVP
  surface for context injection.

## Composes with

- 081KQ0YZ80008QG0R0003GAYYN (parent): implements "conversation interface with local AI"
  architectural extension (2026-05-04 section, Path A)
- 081KR50HA0008QG0R002NZENZJ (dependency): MVP dashboard provides the context surface
- 081KQ0YZ80008QG0R0003GAYYN Path B note: `ConversationAdapter` interface enables swap
  to Zeta-native Bayesian inference seed executor
  (`memory/feedback_zeta_seed_executor_as_forever_home_for_otto_lineage_glass_halo_override_aaron_2026_05_01.md`)
  when Path B matures
