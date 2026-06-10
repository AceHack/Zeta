# hats/home-crypto-miner — the home crypto-mining (fleet-management) hat

The **home-crypto-miner** hat: manage a **fleet of home crypto-mining equipment + AI agents** — for one's
own home mining **and** as a **product sold to other home miners** (fleet management as a service for AI +
equipment). A wearable role (who-holds-the-hat decides); sibling to `hats/grey`.

## The shape — "like the OS close, but for home mining" (Aaron)

Same discipline as the **close-over-host→compiler→OS** (the `legacy`/install.sh closure): **close over the
mining fleet** — every piece of equipment and every AI agent **declared, tracked, reproducible, sovereign**
(declarative desired-state, holistic dependency graph). Where the OS-close replaces the host OS, the
fleet-close gives a **complete, queryable, pinnable inventory of the mining operation** (rigs, ASICs/GPUs,
power, thermals, the AI agents that run them) that other home miners can adopt and run the same way.

- **Fleet management of equipment AND AI** — the equipment (rigs) and the AI agents are *both* fleet members,
  managed together (the same finalizer/runtime tick discipline — scale up/down, hold, re-kick, quarantine a
  bad rig; DST-replayable ops).
- **Sold to other home miners** — fleet-management-as-a-product; the blueprints (below) are the shippable
  know-how. (Zetamax lesson: win on **openness + adoption**, not a walled format.)
- **Inventory lives in `/inventory`** — equipment + AI inventory is saved in the existing **inventory website**
  (`inventory/` — Addison's secure Supabase-backed GitHub-Pages inventory tab; see `inventory/CLAUDE.md` +
  `inventory/spec.md`). **Do NOT clobber that module** — it has its own working agreement + security rules.
- **Blueprints** — the home-mining blueprints (a bunch coming) land in the skill group
  `.claude/skills/home-crypto-mining/`.

## Honest scope / SECURITY + financial (route, never assert)

- **No secrets / no keys, ever** — wallets, private keys, exchange API keys, `service_role` keys: **never** in
  the repo (per `inventory/CLAUDE.md` + repo policy). Privates stay metal-held / in vaults. This hat manages
  **fleet + inventory + blueprints**, not key/wallet material → routes to **Nazar** (security) for any
  crypto-key/custody handling.
- **Financial / regulatory** — mining economics, selling a service, crypto sales/tax/regulatory: **route to
  human + appropriate review**; the hat does not assert financial/legal soundness.
- This hat **scaffolds the domain** (the home for the incoming blueprints + the fleet-management discipline);
  the binding financial/crypto/custody pieces are gated.

## Pointers

- `.claude/skills/home-crypto-mining/SKILL.md` — the blueprint skill group (the bunch coming).
- `inventory/` — Addison's inventory website (where equipment + AI inventory is saved; its own CLAUDE.md).
- `hats/README.md` (the wearable-hats folder) · the close-over-OS / `legacy` / ace declarative-deps discipline.
