# Post-registration node connect / cache / health — a small skill routing to a blueprint; the overlay closes over Tailscale ⊗ Headscale

*Captured 2026-06-09 by Otto (shadow\*) at Aaron's direction (he authorized IP discovery + SSH connect). Goal: after a
node self-registers, **discover its IP + the Comet's IP, connect (operator SSH key), cache everything to the repo,
and track health** — packaged as a **small reusable skill that routes to a blueprint** (Addison's pattern, to keep
skill-expansion small), reusable for Max's home. Overlay transport: **close over Tailscale ⊗ Headscale**. Registers:
[grounded — discovery results], [design], [blocked — nodes SSH-down now].*

## What works now (grounded discovery)

- **Node IPs resolved via ARP (MAC→IP), no LAN scan:** the registered `node.yaml` MACs matched this operator Mac's
  ARP table: **node-ad1efd → 192.168.4.152**, **node-b1e1b5 → 192.168.4.153** (LAN `192.168.4.0/24`).
- **SSH currently fails** (`:22` timeout → "host is down") — consistent with Aaron's note that *the nodes' IPs won't
  change unless powered off for an extended period*; **they appear powered down right now.** So the **connect /
  health half cannot be validated until the nodes are up.**
- **Tailscale CLI absent** — Aaron uninstalled it (ExpressVPN conflict, since resolved); to be reinstalled via
  install.sh (below). So today resolution is LAN-ARP; the overlay path returns once Tailscale/Headscale is back.
- **Comet (GL.iNet KVM) IPs:** not yet matched (my guessed OUIs didn't hit; need the Comets' real MACs or their
  mDNS/`_http._tcp` advertisement once powered).
- **SSH trust:** the zflash USB Aaron built **preloaded his operator pubkey** into the ESP (`zeta-authorized-keys.pub`)
  → the nodes trust his key → operator-side SSH will work **once they're up**.

## The design — a small skill that routes to a blueprint (Addison's pattern)

Per the skill-blueprints discipline (Addison's Blueprints, the ~90% cold-boot compression — `ACHIEVEMENTS.md`): the
**skill is a tiny description** (the only thing loaded at cold-boot / seen by the router); the **fat procedure lives
in a blueprint** opened on demand. So:

- **Skill (small):** `cluster-node-onboard` — description only: *"after a node self-registers, resolve its address,
  connect, cache its inventory + health to the repo."* Routes to →
- **Blueprint (`blueprints/connect-cache-health.md`)** — the procedure:
  1. **Resolve address** — match `node.yaml` `network.mac` against ARP (LAN) **or** the overlay (Tailscale/Headscale
     name) — no LAN scan. *(Also resolve the node's paired Comet.)*
  2. **Connect** — SSH with the operator key (trusted via the ESP-injected pubkey); `StrictHostKeyChecking=accept-new`.
  3. **Cache everything** — gather inventory + dynamic facts (IP, interfaces, disk SMART, kubelet/k3s status, GPU,
     temps, UPS draw) and **write back to the repo**: `node.yaml` `network.ip` (the self-registration schema gains
     `network.ip` — it logs `mac` only today) + a `health/` cache file. *Cache liberally* — not static, but IPs
     change rarely (Aaron). 
  4. **Health track** — periodic re-run records a health time-series (feeds the cluster dashboards / DORA).
- **Reusable for Max:** the same skill+blueprint runs at Max's home post his self-registration; **per-operator** via
  the `maintainers/<account>/` tree. *Keep skill-expansion small; route to the blueprint.*

## The overlay — close over Tailscale ⊗ Headscale (Aaron: "close over both")

The cross-site transport (connect Aaron ⊗ Max networks; #7245 federation) **closes over two backends** behind one
overlay abstraction (the #7229 thesis): **Tailscale** (hosted coordination) **and Headscale** (self-hosted
coordination server) — *support both*, one `overlay.{up, addr, peers}` interface, two drivers. **install.sh**
provisions both (reinstall Tailscale — gone after the ExpressVPN conflict, now resolved — **and** add Headscale);
**route by config** (hosted vs self-hosted). This makes node-address resolution overlay-aware (resolve by tailnet
name, not just LAN ARP), which is what lets Max's nodes resolve from Aaron's side and vice-versa.

## Honest scope / blockers

[grounded]: ARP MAC→IP resolved both nodes (.152/.153); operator SSH key is trusted via the zflash ESP inject;
skill-blueprints pattern + `maintainers/<account>/` namespacing already exist. [blocked]: **nodes are SSH-down right
now** → the connect/cache/health half is **designed but unvalidated**; build + test it as a real skill when the
nodes are powered up (so the live half is verified, not guessed). Tailscale absent until install.sh reinstalls it
(+ Headscale). [design]: small skill → blueprint (Addison's pattern); overlay closes over Tailscale ⊗ Headscale;
self-registration schema gains `network.ip` (+ optional `site`). No code shipped yet (validation-gated by nodes-up).

## Pointers

- Discovery: `maintainers/Addisons820/cluster-nodes/node-*/node.yaml` (the MACs) · this Mac's ARP table.
- Patterns: skill-blueprints (`.claude/skills/skill-lifecycle/SKILL.md` + `blueprints/`) — Addison's Blueprints
  (ACHIEVEMENTS.md) · close-over thesis (#7229) · the hardware/internals-known/DNS-federation doc (#7245) ·
  self-registration GitOps (081KSGS9H0008QG0R0027HJZYH, #7237/#7240) · 081KT7YW00008QG0R003JV9D4J (cold-boot token minimization).
- Anchors: Tailscale / **Headscale** (self-hosted control server); ARP MAC→IP resolution; SSH TOFU.
