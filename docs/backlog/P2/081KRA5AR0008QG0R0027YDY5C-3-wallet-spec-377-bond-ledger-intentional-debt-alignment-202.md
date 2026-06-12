---
id: B-0074.3
zetaid: 081KRA5AR0008QG0R0027YDY5C
priority: P2
status: open
title: wallet-experiment-v0 §377 / §8.1 bond-ledger schema vs INTENTIONAL-DEBT.md alignment (B-0074 child 3, re-decomp)
effort: S
ask: verify field names + semantics align between wallet spec and INTENTIONAL-DEBT contract
created: 2026-05-11
last_updated: 2026-05-11
depends_on: []
tags: [wallet-spec, bond-ledger, intentional-debt, cross-doc, pr-72]
type: friction-reducer
---

# B-0074.3 — wallet-v0 bond-ledger vs INTENTIONAL-DEBT.md alignment

## Why (atomic child of B-0074, re-decomp per "assume mistakes")

B-0074 remaining open item 6: wallet-experiment-v0 spec L377 P2 requires bond-ledger schema to match the `docs/INTENTIONAL-DEBT.md` contract. Verify field names + semantics; reconcile or document divergence. Smallest atomic doc-alignment task. TS-preferring: schema can be codified in TS types or validated by future TS tool (aligns with Rule 0 TS preference over prose-only).

Independent of .2 (parallel); both unblock full B-0074 close.

## What (smallest atomic bounded scope)

- Locate wallet-experiment-v0 spec section §377 / §8.1 bond-ledger definition
- Read docs/INTENTIONAL-DEBT.md bond-ledger contract
- Compare field names, types, semantics, provenance rules
- If mismatch, either update wallet spec or add divergence note + rationale in INTENTIONAL-DEBT
- Commit with explicit audit trail
- Focused check: dotnet build -c Release passes 0 Warning(s) 0 Error(s)
- Non-scope: no EAT changes (that's .2), no code impl, no full wallet build-out

## Acceptance

- [ ] bond-ledger schema fields + semantics verified or divergence explicitly documented
- [ ] Edit includes reference to B-0074 / original codex cid SIvLus5-BMMb

## Composes with

- B-0074 (parent)
- B-0062 / wallet-v0 work
- INTENTIONAL-DEBT.md (the contract being aligned to)
