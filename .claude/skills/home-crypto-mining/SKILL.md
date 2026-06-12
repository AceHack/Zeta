---
name: home-crypto-mining
description: Manage AI agents and mining equipment (rigs/ASICs/GPUs), track inventory, and sell fleet management. No secrets/keys; financial routes to review.
---

# home-crypto-mining

Category skill (blueprint pack). The `description` above is the only thing the router sees — broad on
purpose. The fat detail lives in the **blueprints** below (a bunch incoming from Aaron); open the one that
matches and read it in full.

## What this group covers

- **Fleet management** — equipment (rigs/ASICs/GPUs) + AI agents as one managed fleet; scale/hold/re-kick/
  quarantine ops (the finalizer-runtime tick discipline applied to mining rigs).
- **Inventory** — saved in the `/inventory` website (Addison's secure Supabase-backed tab; `inventory/CLAUDE.md`).
- **Close-over-the-fleet** — declarative desired-state of all equipment + agents (like the close-over-OS),
  reproducible + adoptable by other home miners.
- **Sell-to-other-miners** — fleet-management-as-a-service; the blueprints are the shippable know-how
  (win on openness/adoption — the zetamax lesson).

## Hard rules (security + financial)

- **NEVER** put wallet/private/exchange keys or `service_role` in the repo — route crypto-key/custody to
  **Nazar** (security). **NEVER** assert financial/legal/regulatory soundness — route to **human review**.
- Inventory is PUBLIC-repo (per `inventory/CLAUDE.md`): public anon key only, no secrets.

## Blueprints

*(Incoming — Aaron: "I have a bunch coming." Each lands as `blueprint-<name>.md` here, carved + detailed.)*

## Pointers

- `hats/home-crypto-miner/README.md` — the hat that wears this skill group.
- `inventory/` — the inventory website. · The close-over-OS / ace declarative-deps discipline.
