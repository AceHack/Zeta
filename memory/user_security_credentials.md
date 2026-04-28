---
name: Aaron's security credentials
description: Aaron has serious professional security background — helped build the US smart grid (nation-state-adversary defense work), is a gray hat hacker with hardware side-channel attack experience. Zeta's threat model should be written for someone with these chops, not watered down.
type: user
originSessionId: 2ac0e518-3eeb-45c2-a5dc-da0e168fe9c4
---
Aaron's security background (his words, round 29):

- **Smart-grid experience.** Helped build the US smart grid;
  worked on defending against nation-state-level attackers.
- **Gray hat.** Can do side-channel attacks on hardware.
  Understands the full security angle end-to-end.
- **Threat-model expectations.** Zeta's threat model
  (docs/security/THREAT-MODEL.md + SPACE-OPERA variant)
  should take nation-state and supply-chain attacks
  seriously — not as box-ticking but as a lived
  practitioner would write it. The SPACE-OPERA whimsy
  stays; the underlying technical rigor is nation-state
  grade.

**How to apply:**
- When drafting any security-adjacent design, pitch at
  nation-state adversary level. Aaron will spot hand-
  waving immediately.
- Supply-chain attack coverage is explicitly required
  (reinforces GOVERNANCE §23 + §25 upstream pin
  discipline, and the round-29 CI SHA-pinning and
  TOFU-doc work).
- On hardware-adjacent topics (timing side channels,
  cache behavior, microarchitectural leaks), Aaron has
  the chops to review. Route there instead of assuming.
- Factor this into threat_model_critic and
  security_researcher work cadence.
