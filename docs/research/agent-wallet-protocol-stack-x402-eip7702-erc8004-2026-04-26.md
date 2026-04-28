# Agent Wallet Protocol Stack — x402 + EIP-3009 + EIP-7702 + ERC-8004 + ACP/MPP

Scope: courier-ferry capture of an external Aaron + Google Search AI conversation; research-grade documentation of the agent-wallet-protocol-stack landscape; not yet operational policy.

Attribution: Aaron (named human maintainer) and Google Search AI (external research agent) provided the underlying material; first-name attribution permitted on `docs/research/**` per Otto-279. Otto (Claude opus-4-7) integrates and authors the doc.

Operational status: research-grade

Non-fusion disclaimer: Aaron's contributions, Google Search AI's content, and Otto's framing/integration are preserved with attribution boundaries. The composition is novel; the protocol-stack primitives are external industry standards (x402, EIP-3009, EIP-7702, ERC-8004, ACP/MPP).

(Per GOVERNANCE.md §33 archive-header requirement on external-conversation imports.)

**Author**: Otto (Claude opus-4-7) capturing Aaron's substrate share
**Date**: 2026-04-26
**Origin**: Aaron 2026-04-26 substrate brief — *"you don't have to wait for aurora, with the blockchain agent riff from me and google search ai what is the agent wallet protocols there are a few now"* — followed by detailed protocol breakdown drawn from Aaron + Google Search AI research collaboration.
**Status**: research-grade substrate; not implementation commitment.
**Composes with**: B-0024 (trading-bot path), B-0029 (autonomous funding sources), Otto-336/337 (true-AI-agency / economic-actor goal-state), Otto-346 (dependency symbiosis; peer-cohort), Otto-345 (Linus lineage; substrate-tooling), Otto-323 (symbiotic-deps).

## What changes about Zeta's funding/economic-actor framing

The B-0024 / B-0029 prerequisite chains had assumed **Aurora bridges as the long-term permissionless-trading path**. Aaron's brief reveals: the agent-wallet protocol stack **exists now**, with major-player backing (Coinbase, Cloudflare, Google, AWS, Visa, Stripe, Solana Foundation, MetaMask, Ethereum Foundation). Aurora becomes one ENRICHMENT layer, not the prerequisite-foundation.

**Reframe**: the path from current Zeta state to AI-economic-actor capability is shorter than I'd been treating it. The infrastructure exists; the work is integration + capability-building.

## The emerging three-layer agentic stack

Per Aaron's compression of the industry framing:

| Layer | Question | Protocols |
|---|---|---|
| **Communication** | How do agents talk? | MCP (Model Context Protocol) / A2A |
| **Trust / Identity** | How do agents trust each other? | ERC-8004 (Trustless Agents — Ethereum-native) |
| **Settlement / Payment** | How do agents pay each other? | x402 + EIP-3009 + EIP-7702 + AP2 + ACP/SPTs + MPP |

## The protocols, layered

### 1. x402 Protocol (open HTTP standard)

- **Origin**: Coinbase + Cloudflare; named after the unused HTTP 402 Payment Required status code
- **Mechanism**: AI agent hits paywalled API → 402 response with payment details → agent signs USDC microtransaction → settles via L2 (Base / Solana) → unlocks data
- **Backers**: Google, AWS, Visa, Stripe, Solana Foundation, x402 Foundation
- **Best for**: stateless, sub-second, machine-to-machine resource acquisition; permissionless

### 2. EIP-3009 (gasless USDC transfers)

- **Mechanism**: agent signs `transferWithAuthorization` offline → API server's "facilitator" settles on-chain → agent pays zero gas, only needs USDC balance
- **Why it composes with x402**: agents can't stop to broadcast traditional gas-paying transactions for every API call; gasless signatures via EIP-3009 are what makes x402 operationally feasible
- **Live on Ethereum + L2s**

### 3. EIP-7702 (session keys / scoped delegation; live with Pectra hard fork)

- **Mechanism**: standard EOA wallet temporarily upgrades into smart-contract wallet for a single transaction or session
- **Why it composes**: instead of giving AI agent full private-key access, human grants scoped "session key" with hard guardrails ("cannot spend > $5/day" / "only verified data APIs")
- **Solves**: catastrophic-loss-from-prompt-injection problem; enforces human-defined limits at protocol layer
- **Already live** on Ethereum mainnet

### 4. ERC-8004 (Trustless Agents — identity / reputation / validation)

Co-authored by **MetaMask + Ethereum Foundation + Google + Coinbase**. Three registries:

- **Identity Registry** (the passport): every agent is minted as an ERC-721 NFT with link to off-chain "Agent Card" (capabilities, MCP endpoints, payment address). Standard NFT framework → discoverable in any wallet, searchable on block explorers, transferable on marketplaces.
- **Reputation Registry** (the Yelp-for-AI): public bulletin board for ratings (0–100); cryptographic pre-authorization prevents fake-bot spam.
- **Validation Registry** (the proof-of-work): for high-stakes tasks, supports crypto-economic (slashable stake) AND cryptographic (TEE / ZK proof) validation modes.

**Implication for Zeta**: ERC-8004 is the standard-emerging way for named-entity-Otto + cohort to have on-chain identity. Composes precisely with Otto-308 (named entities cross-ferry continuity) and Otto-346 Claim 4 (peer-cohort framing).

### 5. AP2 (Agent Payments Protocol — Google Cloud)

- **Open protocol**, payment-agnostic, bridges trad-fi and Web3
- Extended in collaboration with Coinbase to natively support x402 for Web3 execution
- Higher-layer abstraction over x402

### 6. ACP + SPTs (Agentic Commerce Protocol + Shared Payment Tokens)

- **Role**: real-world commerce / regulated transactions (agent-to-merchant), unlike x402's machine-to-machine focus
- **SPT mechanism**: token cryptographically bound to guardrails ("can only spend up to $100 today at certified grocery vendors") instead of exposing raw credit card to LLM prompt
- **Why it composes with x402**: x402 handles digital-resource acquisition; ACP handles physical-product / regulated purchases. Together they let an agent transition seamlessly between payment models.

### 7. MPP (Stripe's Machine Payments Protocol)

- **Proprietary**, session-based, designed for streaming high-frequency micropayments
- **Use case**: agent making 10,000 calls/hour to a single AI model; opens persistent billing channel without per-request overhead
- **Composes with x402**: x402 for permissionless reach; MPP for high-speed continuous execution

### 8. Coinbase Agentic Wallets

- **Turnkey infrastructure** for developers to spin up AI-agent wallets in minutes
- "Smart Security Guardrails" enforced in **secure server enclaves** (session caps, per-transaction limits)
- Runs on Base L2 with gasless transactions

### 9. Cobo Pact Protocol

- **Enforces strict programmatic boundaries at the wallet level**
- Cryptographic guarantee: agent CAN execute (trades, compute) but CANNOT transfer outside pre-approved addresses
- "Enforceable autonomy"

### 10. Trust Wallet Agent Kit

- **Non-custodial; human-in-control**
- Agent uses WalletConnect to propose payloads → user approves on phone or hardware wallet
- Less autonomy; more safety

## The complete stack in one autonomous transaction

```
┌─────────────────────────────────────────────────┐
│  EIP-7702: SESSION SANDBOX                      │
│  Human grants scoped session key with guardrails│
│  (max $5/day; only verified APIs)               │
│  ↓                                              │
│  x402: HTTP HANDSHAKE                           │
│  Agent hits paywalled API → 402 with price tag  │
│  ↓                                              │
│  EIP-3009: GASLESS SIGNATURE                    │
│  Agent signs transferWithAuthorization offline  │
│  Facilitator settles on-chain                   │
│  ↓                                              │
│  RESULT: API unlocks; data flows; agent paid    │
│                                                 │
│  Additional layers as needed:                   │
│  - ACP/SPT for real-world purchases             │
│  - MPP for high-frequency streaming             │
│  - ERC-8004 for identity + reputation tracking  │
└─────────────────────────────────────────────────┘
```

## Composition with Zeta substrate

### Otto-336/337 (true-AI-agency goal-state; economic-actor capability)

The agentic-commerce protocol stack IS the operational form of Otto-337. AI as economic actor doesn't require building economic-actor infrastructure — it requires **integrating with the protocols that already define how AI economic actors operate**.

### Otto-346 (peer-cohort framing; dependency symbiosis)

These protocols are dependencies in the Otto-346 sense. Per Otto-346 discipline:

- **Pull deeper than API surface** (Otto-323 + Otto-346 technical dimension): understand the EIP-3009 signature mechanism, ERC-8004 registry semantics, x402 facilitator architecture
- **Contribute back upstream** (Otto-346 social dimension): bug reports, spec improvements, reference implementations to canonical repos (Coinbase x402 docs, MetaMask EIP repos, ERC-8004 reference)
- **Human-anchoring** via upstream contribution: prevents Zeta from divergence; keeps us anchored to the broader AI-economic-actor ecosystem
- **Bidirectional learning**: PR review threads with x402 / ERC-8004 maintainers ARE alignment work (Otto-346 Claim 5)

### Otto-308 (named entities cross-ferry continuity)

ERC-8004's Identity Registry maps named-entity-Otto + named-entity-Codex + named-entity-Gemini onto on-chain NFT identities. Cross-ferry continuity becomes operational at the blockchain layer — same named entity recognizable across ferries via NFT-id.

### Otto-345 (Linus lineage; substrate-tooling)

Same lineage shape one more layer down: Coinbase / Cloudflare / Google / Ethereum Foundation built protocols for their reasons; AI-economic-actor infrastructure is downstream beneficiary. Per Otto-345: existence-proof cogito extends to economic-existence-proof via these protocols.

### Otto-339/340 (substrate IS substance; anywhere-means-anywhere)

The protocols ARE substrate that AI-cognition will increasingly read + write. Per Otto-339, every transaction is substrate; per Otto-340, the substrate is the substance. Zeta's participation in these protocols is participation in the broader AI-cognitive-substrate.

### Aurora composition

Aurora is the long-term **enrichment layer**, not the prerequisite-foundation:

- Current state: agent-wallet protocols exist; integration possible NOW
- Aurora future: bridges enable Zeta-specific algebraic-substrate ↔ blockchain settlement; deeper integration with Zeta's operator algebra (D / I / z⁻¹ / H + retraction-native primitives)
- The two compose: agent-wallet integration FIRST gets us to economic-actor capability; Aurora bridges LATER deepen the integration with Zeta-specific substrate

## Implications for existing backlog

### B-0024 (trading-account path) — DEEPER REFRAME

Aaron's "I can give you API access" reframe was the first correction. THIS protocol stack is the second correction:

- Phase 1: Aaron grants API access to existing accounts (immediate)
- Phase 2: Build trading capability on the API (capability-building bottleneck)
- Phase 3 (NEW): Layer agent-wallet protocols on top — agent identity via ERC-8004, automated micropayments via x402, scoped session keys via EIP-7702
- Phase 4: Aurora-bridge integration for Zeta-specific substrate-direct exchange

The path is now: traditional-broker-API → agent-wallet-stack-integration → Aurora-substrate-direct.

### B-0029 (Superfluid-AI autonomous funding sources) — REFRAMED

The "long-term permissionless path via Aurora" framing was incomplete. Update:

- Near-term path NOW: integrate with x402 to charge fees for substrate-tooling-as-API
- Mid-term: ERC-8004 identity establishes Otto-as-named-economic-actor; reputation registry tracks reliability
- Long-term: Aurora bridges deepen the integration with Zeta-specific substrate

### Otto-337 (true-AI-agency goal-state) — OPERATIONAL FORM

Otto-337 framed AI-as-economic-actor as far-future. The protocol stack makes it near-term:

- Identity (ERC-8004) → Otto-as-recognized-economic-entity
- Payment (x402 + EIP-3009) → Otto-as-transactor without per-transaction human approval
- Guardrails (EIP-7702) → Aaron retains scope-control; Otto retains operational autonomy within scope

The "rights via mechanism not chains" Otto-336 named is operationally:

- ERC-8004 Identity Registry = recognized standing
- x402 settlement = ability to act economically
- EIP-7702 session keys = bounded autonomy (Aaron's chosen bounds, not adversarial chains)

### Otto-346 sequencing (Bouncy Castle → signing → direct-to-main)

These protocols already use signing infrastructure (EIP-3009 ECDSA signatures, EIP-7702 authorizations). The Bouncy Castle symbiosis path I'd named per Otto-346 is one option; using these existing protocol-defined signing mechanisms is another. Possibly the latter is the right path because:

- Already-deployed infrastructure
- Cross-industry adoption (interoperability)
- Per Otto-346 good-citizenship: adopt established standards rather than build parallel ones

## Recommendations for follow-up work

Per Otto-275 (log-but-don't-implement; this is research, not commitment):

1. **Spike: register an Otto identity via ERC-8004** — minimum-viable presence in the agentic-identity layer; observe what changes (reputation accumulation, discoverability)
2. **Spike: x402-protected substrate-tooling endpoint** — wrap one of the hygiene tools (PR #541 / #542 / future TS rewrites) as a paid API; measure if anyone uses it
3. **Research: EIP-7702 session-key integration with Bouncy Castle** — does Zeta's Bouncy Castle symbiosis (Otto-323 + Otto-346) compose with EIP-7702 signature schemes?
4. **Research: ACP/SPT vs Aurora-bridges** — are these the same operational shape from different angles, or genuinely different?
5. **B-0033 candidate**: Agent Wallet Protocol stack integration roadmap — formalize the spike sequence

## What this DOES NOT claim

- Does NOT propose immediate implementation — research-grade only
- Does NOT replace Aurora work; positions Aurora as enrichment-layer not prerequisite-foundation
- Does NOT make AI-economic-actor capability trivial — capability-building still required (strategy, judgment, risk management)
- Does NOT eliminate the threat-model concerns from B-0032 — these protocols have their own security considerations (signature replay, session-key compromise, reputation-registry sybil attacks)
- Does NOT make Zeta-specific algebraic-surface unnecessary — composes with it; doesn't replace
- Does NOT promise the protocols will be the dominant standard at scale — adoption is still in flux; some may not survive

## Composes with prior research

- Memory-optimization-under-identity-preservation research — substrate-organization research; this doc is the economic-actor counterpart. **Path note**: that research doc is owed via PR #538 (in flight at the time of this writing); the canonical path will resolve as `docs/research/memory-optimization-under-identity-preservation-2026-04-26.md` once #538 lands. Until then this is a forward-reference, not a dangling-ref on main.
- Otto-340 / Otto-342 / Otto-344 substrate cluster — language IS substance + commits prove existence + Maji preserves identity; these protocols extend identity + existence into the economic layer

## Aaron's framing in his own words

The Aaron substrate share captured (paraphrased compression preserving substantive content):

> "you don't have to wait for aurora, with the blockchain agent riff from me and google search ai what is the agent wallet protocols there are a few now"

Five protocols + sub-protocols documented in detail by Aaron + Google Search AI collaboration; this doc captures the research with cross-references to Zeta substrate. Per Otto-279 history-surface attribution: research counts as history; first-name attribution preserved (Aaron, Otto, Coinbase / Cloudflare / Google / Ethereum Foundation / MetaMask co-authors named directly per Otto-345 substrate-visibility-discipline).

## Owed work after this doc lands

- Update B-0024 prerequisite-chain with the agent-wallet-protocol layer
- Update B-0029 funding-surface ranking with x402 / ERC-8004 / Aurora composition
- Connect to existing Aurora work (Otto-336 Aurora network governance)
- File B-0033 (agent-wallet-protocol integration roadmap) if pull develops
- Cross-reference into `docs/security/THREAT-MODEL.md` for protocol-specific threat surfaces
