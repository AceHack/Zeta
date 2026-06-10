# skill: home-crypto-mining (the real content)

The **home-crypto-mining** skill — managing a fleet of AI agents + mining equipment (rigs/ASICs/GPUs), as
one's own operation and as a service sold to other home miners. The **content** home (the `.claude/skills/
home-crypto-mining/` entry is just the *routing* to here; Aaron: ".claude skills are for routing").

Worn by the **home-crypto-miner hat** (`hats/home-crypto-miner/`).

## Know-how / blueprints

- **MyNode BTC nodes (td5, td6)** — see `.claude/skills/home-crypto-mining/blueprint-mynode-nodes.md`
  (inventory in the `/inventory` website; USB from MyNode "model two"; the Zeta update trigger).
- **Fleet management** — equipment + AI agents as one fleet (finalizer-runtime tick ops: scale/hold/
  re-kick/quarantine).
- **Close-over-the-fleet** — declarative desired-state of all equipment + agents (like close-over-OS).
- **Sell-to-other-miners** — fleet-management-as-a-service.

## Hard rules

- Security by **clarity** (our own PKI/keyring; keys-in-git sealed, the encrypted null) — not obscurity.
  Corporate side = keys-in-Vault (Max); research side = keys-in-git (us); meet in the middle.

## Pointers

- `hats/home-crypto-miner/` · `inventory/` · `updates/` + `triggers/` · `cluster/` + `full-ai-cluster/`.
