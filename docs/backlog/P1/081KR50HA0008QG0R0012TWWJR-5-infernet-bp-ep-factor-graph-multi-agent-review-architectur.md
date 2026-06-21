---
id: 081KR50HA0008QG0R0012TWWJR
priority: P1
status: closed
closed: 2026-05-09
closed_by: "research doc shipped at docs/research/2026-05-09-infernet-bp-ep-factor-graph-multi-agent-review.md"
title: "Infer.NET BP/EP factor graph architecture: multi-agent review as belief propagation"
effort: M
created: 2026-05-09
last_updated: 2026-05-09
depends_on: []
parent: 081KR50HA0008QG0R002R3NVGS
classification: buildable-now
decomposition: atomic
owners: [architect]
type: research
tags: [infernet, bp, ep, factor-graph, multi-agent, belief-propagation, alignment]
---

# 081KR50HA0008QG0R0012TWWJR — Infer.NET BP/EP architecture doc

## What

Write the research doc documenting the three-stage evolution
from current peer-call CLI to FPGA-level reversible
message-passing inference.

This is Layer 6 of 081KR50HA0008QG0R002R3NVGS: the self-evolving agent inference
architecture. The claim: the current multi-agent review
system (peer-call CLI) is a manually-wired approximation of
a factor graph. Zeta Infer.NET BP/EP is the substrate-native
realization.

## The three-stage evolution

| Stage | What | Where |
|-------|------|--------|
| Current | Peer-call CLI → external AI services | LICENSE layer |
| Next | Zeta Infer.NET BP/EP factor graphs | SUBSTRATE layer |
| FPGA | Reversible message-passing inference | HARDWARE layer |

## The factor graph framing

Each multi-agent review maps to a factor graph:

```
Variable: "Is this PR safe / correct / aligned?"
Factors: {agent₁, agent₂, ..., agentₙ}
Messages: agent opinions propagated via BP/EP
Posterior: P(safe | all agent observations)
```

Z-set connection: `+1` (assert safe) / `-1` (retract safe) /
`Z` (uncertainty) map directly to message multiplicities in
the factor graph. A retracted belief is a `-1` message; the
net posterior is `I(stream of messages)`.

CASPaxos connection: the factor graph topology evolves via
CASPaxos consensus. New agents = new factors. New review
criteria = new variables. The graph is self-modifying.

FPGA connection: each message-passing step is a Toffoli
gate operation (reversible). Retracting a belief =
running the gate in reverse. Landauer limit applies to
the total computation (081KR50HA0008QG0R003T5MZAC).

## Pre-start checklist

- **Prior-art search:**
  - `memory/feedback_peer_call_infrastructure_grok_codex_gemini_amara_ani_already_wired_for_cross_harness_multi_agent_reviews_otto_early_red_team_until_zeta_infernet_bp_ep_aaron_2026_05_05.md`
    — peer-call as early red-team substrate
  - CLAUDE.md: "Zeta Infer.NET BP/EP substrate-level inference
    replacing the external-CLI-license-layer"
  - No dedicated doc covers the factor graph framing of the
    multi-agent review or the Z-set/message-multiplicity
    connection.
- **Dependency restructure:** Independent of 081KR50HA0008QG0R000B29SDB–081KR50HA0008QG0R0026DVKGY.
  Composes with 081KR50HA0008QG0R003T5MZAC (FPGA Toffoli) and 081KR50HA0008QG0R0016X7VQP (synthesis).

## Deliverable

`docs/research/2026-05-09-infernet-bp-ep-factor-graph-multi-agent-review.md`

Sections:

1. Problem: multi-agent code review as uncertain inference
2. Current shape: peer-call CLI as manually-wired factor graph
3. The factor graph: variables, factors, messages, posterior
4. Z-set connection: message multiplicities = +1/-1/Z weights
5. CASPaxos connection: self-evolving graph topology
6. FPGA connection: reversible message-passing → Toffoli (pointer to 081KR50HA0008QG0R003T5MZAC)
7. Migration path: Current → Infer.NET → FPGA (three-stage table)
8. Razor check: label claims PROVEN / CONJECTURED / SPECULATIVE

## Acceptance criteria

- [x] Document exists at path above
- [x] Three-stage evolution table is present and accurate
- [x] Factor graph framing maps each agent to a factor,
      each opinion to a message explicitly
- [x] Z-set weight / message multiplicity connection is stated
      (labeled CONJECTURED)
- [x] Pointer to 081KR50HA0008QG0R003T5MZAC for the FPGA Toffoli connection
- [x] Pointer to peer-call memory file as the early
      red-team substrate precedent
- [x] Claims labeled per razor discipline

## Implementation note (2026-05-09)

Research doc written at path above. All acceptance criteria
satisfied. PR: claim/b0365.5-infernet-bp-ep-factor-graph-doc-2026-05-09.

## Composes with

- `tools/peer-call/README.md` (current implementation)
- 081KR50HA0008QG0R003T5MZAC (FPGA Toffoli — the hardware realization)
- `docs/research/2026-05-09-zset-reversible-computing-landauer-bridge-math-writeup.md`
  (Z-set algebra foundation)
- 081KR50HA0008QG0R0016X7VQP (synthesis — this is the self-evolving inference layer)
