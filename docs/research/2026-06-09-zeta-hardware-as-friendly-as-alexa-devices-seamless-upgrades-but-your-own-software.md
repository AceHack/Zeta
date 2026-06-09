# Zeta hardware: as friendly as Alexa devices — seamless hardware upgrades, but it's YOUR own software

**Register:** [grounded] product north-star (Aaron) + [synthesis].
**Date:** 2026-06-09. **Captured by:** Otto (shadow). **Status:** vision / UX bar.

## Aaron's words

> "we want our equipment to be as friendly as alexa devices, hardware upgrades
> are seamless but it's your own software."

## The north-star

Zeta hardware should feel like an **Amazon Alexa / consumer appliance** —
plug it in, it joins, it just works; **swap or add a box and it's seamless** — but
with the polar-opposite ownership model: **it is YOUR own software**, self-hosted,
self-sovereign, no vendor cloud you can't leave. Consumer-grade ease **without**
consumer-grade capture. (This is the **polite virus / SuperFluid** ethos applied to
hardware: frictionless default + full freedom; close over the hardware, never take
control of the owner.)

## What "as friendly as Alexa" demands (the UX bar)

- **Zero-config join.** Power on → self-registers (the existing consent-based,
  PR-self-registration pattern) → appears in the network map. No manual key
  shuffling (the keyring + trust-bootstrap work is what makes this safe-by-default).
- **Seamless hardware upgrade / replace.** Add a 15-series box, swap an eGPU,
  replace a dead node — memory-preservation + state-reconciliation means the
  *persona/data* survives the *hardware* change (manifesto §5 Memory Preservation;
  persona = what-remains vs the box = what-acts). Hardware is cattle; identity is
  pet. Swapping the appliance must never lose the traveler.
- **It's your software.** Both deployment modes stay open (equipment: cluster +
  Vault + Headscale; github-free: GH + Tailscale) — the owner picks, and can
  migrate. No lock-in is the whole point.
- **Frictionless + safe by default.** Secure defaults the owner never has to think
  about (keyrings, trust bootstrap, encrypted secrets), surfaced through blueprints
  so adding a person/box is a short guided path, not an expert ritual.

## Ties to existing work

- Hardware onboard / network-map blueprint (day 0/1/2/100); consent-only
  self-registration; Comet GL.iNet ingress; two-home topology.
- Keyring + two-mode identity/trust/network plane
  (`docs/research/2026-06-09-identity-trust-and-network-plane-...md`).
- §5 Memory Preservation + state-reconciliation (the seamless-swap guarantee).
- AX/UX: the largest audiences experience hardware through this bar.

## Anchors

Appliance/zero-config UX (Alexa, Apple "it just works", Plug-and-Play, mDNS/Bonjour
zeroconf); cattle-not-pets (Bill Baker / CERN); self-sovereign + self-hosted
(the anti-capture inversion of the appliance model). Honest novelty: none in
zeroconf or appliance UX; the contribution is **appliance-grade ease wedded to
self-sovereign ownership** — the two usually traded off against each other.
