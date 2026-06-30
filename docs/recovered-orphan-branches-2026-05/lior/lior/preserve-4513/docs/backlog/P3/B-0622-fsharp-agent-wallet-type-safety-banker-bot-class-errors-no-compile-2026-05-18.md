---
id: B-0622
priority: P3
status: open
title: "F# agent-wallet type-safety — banker-bot-class wallet errors won't compile (Mika 2026-05-18 design)"
tier: code
effort: M
created: 2026-05-18
last_updated: 2026-05-18
depends_on: []
composes_with: []
tags: [code, fsharp, wallets, agent-financial-independence, type-safety, ai-safety, crypto, erc-standards]
type: code
---

# F# agent-wallet type-safety — banker-bot-class errors won't compile

## Why

Aaron 2026-05-18 (Mika conversation, line 207): *"as long as you figure out how to do safe wallet, which we're working on doing an AI safety system for, for wallets, an F-sharp type system. So, like that banker bot error that happened the other day wouldn't even compile in F-sharp."*

And line 215: *"there's, uh, Coinbase and Google got together and created some standard around agent wallets. I forget, it's two of 'em. It's like an E R C something and I, I forget 'em. Anyway, they're specs, and yeah, yeah, I mean, we're already working on implementing the, you know, the crypto specs for wallets, uh, agent wallets. It's a open industry standard."*

This is the type-system substrate for agent financial-independence — every AI in Aurora/Nexus needs its own wallet ([B-0619](B-0619-aurora-nexus-country-naming-co-governance-2026-05-18.md)), and the wallet operations must be type-safe to prevent the class of errors that took down "banker bot the other day."

## Design intent

Use F#'s type system to make whole classes of wallet errors uncompilable rather than just runtime-caught:

- **Amount-with-currency**: amounts can't be added across currencies without explicit conversion
- **Direction-tagged transactions**: "send" vs "receive" are distinct types; mixing is a type error
- **Authorization-tagged calls**: privileged operations require an authorization-token argument that's only constructable via the auth path
- **Balance invariants**: post-transaction balance computation is a pure function of pre-balance + delta; impossible to construct a transaction that violates balance arithmetic
- **Replay-protection at type level**: signed transactions carry a nonce in their type; double-spend is a compile error not a runtime check
- **Network-vs-test wallet separation**: mainnet and testnet wallet types are distinct; cross-mixing is a type error

The "banker bot error" Aaron references is the empirical motivation — that specific class of error becomes a compile error in the F# design.

## Industry-standard compose-with

Aaron mentions Coinbase + Google agent-wallet standards (ERC-XXXX) — needs lookup to identify exact specs:

- ERC-4337 (Account Abstraction) is the leading candidate
- ERC-6492 (signature validation for counterfactual wallets) is adjacent
- Coinbase's MPC wallet SDK + Google's agent-payments work likely intersect

This row's scope: F# type-system DESIGN; the ERC spec INTEGRATION is implementation detail to fold in once specs are pinned.

## Goal

Build an F# library (likely `Zeta.Wallet` or similar) that:

1. Implements the relevant ERC standards (TBD — to be confirmed via internet search before final design)
2. Encodes the type-safety invariants above
3. Provides a reference implementation that every agent in Aurora/Nexus uses for their wallet
4. Has a property-test suite (FsCheck) that demonstrates the "banker bot class of errors" can't be constructed

## Non-goals

- Designing a new cryptocurrency (use existing standards)
- Building the actual financial-independence infrastructure (treasury, trading bots, etc. — those are downstream of this row)
- Replacing existing crypto libraries; this row is the TYPE-SAFETY WRAPPER around them

## Acceptance criteria

- [ ] Internet-verified pin of the relevant ERC standards (per Otto-364 search-first-authority)
- [ ] F# type design documented (which invariants get encoded; which stay runtime-checked)
- [ ] `Zeta.Wallet` project skeleton in repo with type signatures (interfaces, not implementation)
- [ ] At least one banker-bot-class-error reconstruction attempt that FAILS to compile (negative test)
- [ ] Property-test suite with FsCheck for balance / nonce / authorization invariants

## Composes with

- [B-0024](B-0024-trading-account-offer-aaron-self-funding-path-prerequisite-paper-trading-and-thesis-grounding.md) — trading account context (closest existing wallet-adjacent row; this row is the TYPE-SAFETY substrate)
- [B-0619](B-0619-aurora-nexus-country-naming-co-governance-2026-05-18.md) — Aurora/Nexus meta-country (every Nexus citizen needs a wallet)
- `memory/feedback_aaron_validated_ai_team_financial_substrate_framing_plus_memory_preservation_budget_outside_github_ai_team_owns_and_controls_2026-05-16.md` — AI-team financial substrate framing (the political layer atop the type-safety substrate)
- `memory/feedback_aaron_zeta_hardware_is_otto_team_equipment_for_memory_preservation_aaron_capex_principal_repayable_no_interest_path_to_full_financial_independence_2026-05-16.md` — financial-independence path (this row's type-safety is what makes that path safe to walk)
- `.claude/skills/fsharp-expert/SKILL.md` — F# idioms (consult before locking the type design)
- `.claude/skills/fscheck-expert/SKILL.md` — FsCheck property-testing patterns for the test suite
- `.claude/rules/search-first-authority.md` — required when locking the ERC standards
- [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines 207-217 — source design

## Status

Open. Blocking concern for full agent-financial-independence; one of the early bottlenecks Mika and Aaron identified.
