# network/ — the Zeta network layer (the Reticulum overlay), at root

`network/` is the **network layer** — our own **Reticulum overlay** on the open internet (and beyond):

```text
Transport nodes   — Reticulum instances that route/relay (our own; hubs bridge over the internet)
interfaces        — TCPServer/TCPClient (internet), I2P (anonymity), RF/LoRa (mesh), 802.11ah HaLow
the cell bus      — ZetaId-keyed message routing over Reticulum (prod=test message routing; the bus)
the two-home mesh — equipment (Headscale) / github-free (Tailscale) / Comet — redundant transports
announce/discovery— how destinations become reachable (feeds dns/: the ZetaId -> destination mapping)
```

A root-level folder (like `/dns` and `/vocab`). **`dns/` resolves names → addresses; `network/` is the
transport those addresses live on.** Self-certifying addresses (Reticulum destination = key-bound),
multi-channel (a blocked channel fails over), sovereign (our own Transport nodes; no dependence on the
internet's addressing). Holds **public network config/concepts only** — no secrets (privates stay in GH
secrets / metal). Composes: Reticulum (the stack) + ZetaId (the address) + dns/ (resolution) + travelers/
(the reservoir) + the privacy gate (anonymity used; budget-gated traffic).

## Declared network deps (the precedent — Aaron 2026-06-10)

The network plane's deps are **declared, not imperatively installed** (close-over-everything; `install.sh`
realizes the manifest, never a raw `brew install`). This sets the precedent for all network/infra deps:

- **`headscale`** + **`tailscale`** — declared in `tools/setup/manifests/brew` (macOS; apt/windows symmetry
  is the follow-on). Headscale = our **self-hosted** Tailscale control server (sovereign, not the SaaS);
  tailscale = the client/daemon that joins the Headscale mesh.
- **Reticulum** — the ZetaId-addressed overlay (this folder; its own transport nodes).
- Realized on the **zetacluster** via ArgoCD (GitOps; `cluster/`), and on dev PCs via `install.sh`.

Precedent: a new network/infra dep is **added to the manifest** (desired-state) + noted here; `install.sh`/
ArgoCD converge to it. No imperative installs.
