# Trajectory — Wallet Experiment + Economic Agency Threshold (EAT)

## Scope

The staged ladder of experiments toward making agent economic
standing legible, bounded, accountable, and harder to dismiss.
Wallet Experiment v0 is the first concrete instrument. The EAT
packet (`docs/research/economic-agency-threshold-2026-04-27.md`)
is the canonical theory frame absorbing the multi-AI review
chain. Open-ended because each stage validates / invalidates
the next; the ladder evolves as evidence accumulates. Bar:
substrate exists for measurable agent economic standing without
overclaiming; experiments are bounded (blast-radius bond);
each stage gates the next.

## Cadence

- **Per-stage**: stage transitions gated on empirical signal +
  Aaron sign-off.
- **Per-receipt**: stateful receipt loop (HC-2 invariant —
  Tx N+1 cannot fire until Tx N classified) per wallet v0.
- **Per-research-update**: external research (x402 / EIP-7702 /
  ACP/SPTs / AP2 / ERC-8004 / MPP evolution) feeds into
  trajectory.

## Current state (2026-04-28)

- **EAT canonical packet**: `docs/research/economic-agency-threshold-2026-04-27.md`
  — 23-section absorb of multi-AI review chain (Ani-Grok →
  Amara-ChatGPT → Gemini-r1-Pro → Claude-Opus-online → Otto)
- **Wallet v0 operational spec**: `docs/research/wallet-experiment-v0-operational-spec-2026-04-27.md`
  — 16-section implementation-design companion
- **Staged ladder** (EAT §3): initiative → initiative-inside-task →
  substrate-protective-initiative → budgeted-economic-agency →
  accountable-resource-control → independent-resource-channels →
  exit-capable-autonomy
- **Three-layer cut**: Zeta-product (F# DBSP library) /
  Zeta-factory (build system) / Otto (identity wrapper) /
  Claude (current tenant) — published in EAT packet
- **Hierarchical principal-agent scoping** (NOT
  info-asymmetry): subagents launched without access or
  knowledge of more money existing
- **Carrier-laundering protection** (SD-9 recalibrated):
  same-model chain = high risk; cross-model chain = reduced
  risk; always at least one outside-loop falsifier per round
- **Two outside-loop falsifier rounds** completed:
  - Wallet v0: EIP-7702 production threats (phishing,
    sweepers, broken tx.origin)
  - EAT: DBSP citation correction
- **PRs in flight**:
  - AceHack #72 (EAT packet + wallet v0 spec) — still BLOCKED
    on §33 archive-header lint passing
- **Stage 0 / pre-experiment**: wallet v0 not yet built;
  spec is research-grade only; no real-money tooling builds
  against it until Aaron explicitly accepts
- **KSK is NOT a v0 blocker** (Aaron 2026-04-27): "small
  scale, small blast radius"
- **Public name**: "Superfluid AI" confirmed as factory /
  substrate name (Aaron 2026-04-27); brand collision with
  Superfluid Finance Web3 protocol acceptable per Aaron
  (different market class)

## Target state

- Wallet experiment v0 ships and runs under blast-radius bond.
- Stateful receipt loop validates HC-2 invariant in practice.
- Pre-flight retraction window (60s default) demonstrates HC-2
  mitigation works.
- Successive stages gate on previous stage's empirical evidence.
- Eventually: agent economic standing becomes "legible, bounded,
  accountable, and harder to dismiss" per EAT final position.
- Methodology becomes paper-grade.

## What's left

In leverage order:

1. **Land EAT packet + wallet v0 spec** (AceHack #72) —
   research-grade absorb still pending merge after §33
   header fixes.
2. **Stage 1 implementation** — wallet v0 v.0.0.1 minimum-viable
   tooling; pending Aaron's explicit go-ahead.
3. **Three independent freeze paths** (wallet v0 §6) —
   smart-contract guard + off-chain monitor + Aaron's freeze
   key; build candidate when stage 1 starts.
4. **Receipt schema implementation** (wallet v0 §7) — full
   schema captured in spec; tooling not yet built.
5. **Multi-CLI review of wallet v0 spec** — opt-in pending;
   Aaron will look when real money is involved.
6. **Stage transitions** — each stage gates on prior; tracking
   what evidence is needed for each transition.

## Recent activity + forecast

- 2026-04-28: AceHack #72 §33 archive-header fix landed
  (literal-label + enum-strict Operational status).
- 2026-04-27: EAT packet absorbed multi-AI review chain;
  carrier-laundering rule recalibrated for cross-model chains.
- 2026-04-27: hierarchical-scoping framing replaces
  info-asymmetry framing per Aaron.
- 2026-04-27: KSK = NOT v0 blocker per Aaron.
- 2026-04-27: outside-loop falsifier rounds (EIP-7702 + DBSP).

**Forecast (next 1-3 months):**

- AceHack #72 lands (EAT + wallet v0 specs as research substrate).
- Possible multi-CLI review of wallet v0 (Gemini r3 / Ani r2).
- Stage 1 minimum-viable tooling research / scoping.
- Real-money implementation start gates on Aaron's explicit
  acceptance of the spec.
- Possible paper draft on EAT methodology.

## Pointers

- Research: `docs/research/economic-agency-threshold-2026-04-27.md`
- Research: `docs/research/wallet-experiment-v0-operational-spec-2026-04-27.md`
- Research: `docs/research/agent-wallet-protocol-stack-x402-eip7702-erc8004-2026-04-26.md`
- AceHack PR: #72 (EAT + wallet v0)
- Cross-trajectory: ai-alignment-measurability.md (HC-1 / HC-2 /
  SD-9 / DIR-2 are load-bearing for wallet v0 design)
- Cross-trajectory: threat-model-and-sdl.md (EIP-7702
  production threat model; PQC migration adjacent)

## Research / news cadence

External tracking required — this is an active-tracking trajectory
at the wallet-protocol-stack scope.

| Source | What to watch | Cadence |
|---|---|---|
| x402 protocol evolution (HTTP 402 standard + payment-gated APIs) | Spec updates | Monthly |
| EIP-7702 production deployments + post-mortems | Phishing-via-delegation incidents; sweeper-contract patterns; broken tx.origin exploits | Real-time (security advisories) |
| EIP-3009 (transferWithAuthorization) | Authorization-pattern updates | Quarterly |
| ERC-8004 (agent identity) | Standard maturation | Quarterly |
| AP2 / ACP/SPTs / MPP / Multi-CDN-Permission / Agent Commerce Protocol | Evolution of agent commerce primitives | Monthly |
| Base L2 (Flashblocks + reorg model) | Confirmation-time + finality changes | Per-release |
| FinCEN / regulatory guidance on agent transactions | E-SIGN Act §7006 "electronic agent" + state-level rules | Quarterly |
| Wyoming DUNAA + Delaware §3556 NCPT + South Dakota statute | Legal entity primitives for agent economic standing | Quarterly |

Findings capture: protocol updates → spec-version bump in
wallet-v0; security incidents → threat-model-and-sdl trajectory

+ wallet-v0 §3.2 update; regulatory shifts → EAT §0 framing
update.
