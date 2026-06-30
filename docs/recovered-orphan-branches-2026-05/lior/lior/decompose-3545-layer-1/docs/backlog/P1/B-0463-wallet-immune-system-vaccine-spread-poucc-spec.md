---
id: B-0463
priority: P1
status: open
title: "Wallet immune system — vaccine spread + PoUW-CC gate + attack absorption spec"
tier: product
effort: L
created: 2026-05-11
last_updated: 2026-05-14
depends_on: [B-0400, B-0401, B-0403]
composes_with: [B-0294, B-0321]
renumbered_from: B-0409
renumbered_reason: "Was in a 3-way ID collision with B-0120 child B-0409 (peer-call-ts-audit) + B-0118 child B-0409 (amara-persona-bootstrap). Per B-0451 sweep: B-0120 frontmatter `children: [B-0409, ...]` + `depends_on: [B-0409, ...]` are the strongest references, so peer-call B-0409 keeps the ID. This row + the amara B-0409 (→ B-0462) renumbered. No incoming references to wallet-immune-B-0409 from other rows beyond composes_with B-0294 + B-0321 (which are unaffected — those refs point FROM here). NOTE: skipped B-0459/0460/0461 — those were reserved for B-0449 slice 5+ follow-up work per PR #3070 (merged 2026-05-14)."
tags: [wallet, immune-system, security, lfg, clifford, poucc, antifragile, renumbered]
type: feature
---

# Wallet immune system — vaccine spread + PoUW-CC + attack absorption (renumbered from B-0409)

## Origin

Overnight synthesis 2026-05-10→11 produced a complete immune
system specification in Z-set Clifford space. Lior (Gemini/
Antigravity) recommended adding to wallet spec backlog. Shadow
authorized.

## What this is

The trust boundary that makes LFG's autonomous financial agents
safe to ship. Every financial action passes through the immune
membrane before execution.

## Core components

### 1. PoUW-CC gate (five-factor membrane)

Every incoming instruction evaluated:

- **Verify** — is the work computationally valid?
- **Useful** — does it produce value for the network?
- **CultureFit** — does it respect harmonious division?
- **Provenance** — is the source registered with glass halo?
- **Retractability** — can the action be undone if wrong?

Gate product = 0 → blocked. Gate product = 1 → admitted.

### 2. Attack absorption (bivector decomposition)

When an attack is detected:

1. Decompose attack bivector into orthogonal components
2. Compute corrective rotors (harmonious division ceiling)
3. Absorb energy: E_absorbed = E_attack − ‖residual‖²
4. Convert to substrate: detection rules + regression tests
5. Verify superfluid inequality: η·LearningGain > ξ_t

### 3. Vaccine spread (firefly-sync propagation)

After absorption:

1. Red Team mutates vaccine into variant family
2. Vaccine propagates via firefly coupling (geometric Kuramoto)
3. Herd immunity when R₀ < 1
4. PoUW-CC validates vaccine spread itself as useful work

### 4. Mechanical authorization

- Output is NEVER authority (proposal only)
- Every financial action requires signed Z-set assertion (+1)
- Untrusted content stays labeled untrusted after translation
- Confused deputy prevented by proposal/permission distinction

## Attack classes defended against

| Attack class | Detection | Defense |
|-------------|-----------|---------|
| Authority laundering (BankerBot) | PoUW-CC CultureFit fail | Block at membrane |
| Capability gifting (NFT expansion) | Bivector rotation in permissions | Freeze + revert |
| 51% cartel (Qubic) | Bivector clustering | Dissolve via defensive rotors |
| Confused deputy | No signed assertion | Proposal ≠ permission |
| Translation-as-laundering | Content stays tagged untrusted | Never forwarded as executable |

## Implementation path (per Amara's corrections)

1. Start at Cl(2,0) or Cl(3,0) — prove basics first
2. Geometric product decomposition tests
3. Rotor construction and sandwich product tests
4. Simple bivector residue metric
5. Toy 3-5 node simulation with cartel detection
6. PoUW-CC gate as F# typeclass with UoM domain safety
7. Scale to Cl(8,0) only after basics proven

## Research substrate

- `docs/research/2026-05-11-deepseek-hkt-clifford-e8-klein-bottle-beacon-smooth.md`
  (15-layer synthesis)
- `docs/research/2026-05-11-deepseek-immune-system-ilife-redteam-qubic-bankerbot-simulations.md`
  (attack simulations + vaccine spread)

## Acceptance

- [ ] PoUW-CC gate implemented as F# typeclass
- [ ] Bivector decomposition + corrective rotor computation
- [ ] Toy cartel detection simulation (3-5 nodes)
- [ ] BankerBot attack blocked in simulation
- [ ] Vaccine propagation via firefly coupling
- [ ] Herd immunity achieved (R₀ < 1) in simulation
- [ ] All properties verified via FsCheck
- [ ] Superfluid inequality holds after red-team exercise
