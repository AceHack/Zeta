---
id: B-0074.2
zetaid: 081KRA5AR0008QG0R002504RM1
priority: P2
status: open
title: EAT §504 / §21.e wallet-acceptance prose audit (B-0074 child 2, re-decomp)
effort: S
ask: targeted doc-audit pass on EAT spec for wallet-acceptance drift
created: 2026-05-11
last_updated: 2026-05-11
depends_on: []
tags: [eat-spec, wallet, prose-audit, cross-doc, pr-72]
type: friction-reducer
---

# B-0074.2 — EAT §504 wallet-acceptance prose audit

## Why (atomic child of B-0074, re-decomp per "assume mistakes")

B-0074 remaining open item 5: EAT spec L504 P1 flags that wallet-acceptance should not appear in the resolved-gate prose for EAT §21.e (which defers wallet acceptance to real-money phase). This is a small, bounded, atomic doc consistency sweep. No code change; pure prose audit + trim if needed. TS-preferring: future can be enforced by a TS linter or spec-validator tool (see B-0051 style).

This is the first child; independent of .3.

## What (smallest atomic bounded scope)

- Read EAT spec (docs/research/eat-*.md or wherever §21.e and L504 live)
- Audit surrounding text of §504 / §21.e for "wallet-acceptance" mention in resolved-gate context
- If drift confirmed, trim or rephrase with explicit note referencing real-money phase deferral
- Land change with commit message citing cid from original PR#72 thread
- No implementation, no new files beyond edit; focused check: dotnet build -c Release (0w 0e)
- Non-scope: no wallet spec changes, no INTENTIONAL-DEBT work (that's .3), no broad sweep

## Acceptance

- [ ] EAT §21.e resolved-gate prose audited and consistent (wallet-acceptance removed or justified)
- [ ] Change includes audit trail referencing B-0074 / PR#72 cids

## Composes with

- B-0074 (parent punch-list / drift sweep)
- B-0062 (related wallet/EAT work)
