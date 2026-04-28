---
name: Simple security until proven otherwise — but still RBAC
description: Aaron's standing rule 2026-04-19 for security design — prefer the simplest mechanism that achieves the security goal; keep the RBAC architectural frame but don't over-engineer; acknowledge that technical terms like ACL can intimidate new people and lead with plain-English gloss
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**2026-04-19 disclosure:** *"ACLs (permission lists) this is
scray to new people but if its the proper termooty for this
class of tings, i just prefer simple security unless proven
otherwise but still rbac"*.

Rule: **prefer the simplest security mechanism that achieves the
security goal; keep the RBAC architectural frame; use standard
jargon (ACL, RBAC, etc.) when it is the proper terminology, but
always lead with plain-English gloss.**

## Why

Aaron is a gray-hat with hardware side-channel experience and
smart-grid credentials (per `user_security_credentials.md`); he
pitches threat-model rigor at nation-state level on *product*
surfaces. But on *governance* surfaces, his preference is
minimalism — matches `user_governance_stance.md` ("no respect
for authority; minimalist government on factory rule
discipline"). The two postures are not contradictions:

- On the product side (Zeta.Core, the library, the storage
  layer), the attack surface justifies expensive mitigations
  because the library is the target.
- On the governance side (RBAC on the repo itself, who can edit
  which file, hook enforcement), the threat model is an order
  of magnitude smaller — the attackers are human contributors
  and agent personas, not nation-state APTs. Expensive
  mitigations there are a tax on legitimate work, not a defence.

Aaron's "simple security until proven otherwise" rule lives on
the governance side. The proof is upgrade-on-evidence:

- CODEOWNERS + branch protection + a tiny YAML manifest today.
- Full policy-engine (OPA, cedar, custom) only when a concrete
  incident or systematic evasion pattern *proves* the simpler
  mechanism insufficient.
- Always document the upgrade trigger that was observed, not
  "to be more secure" generically — proof-based escalation.

## How to apply

- **When writing security / RBAC docs**: lead with the plain-
  English gloss, introduce the standard term with a brief
  reassurance ("don't let the acronym intimidate"), keep the
  standard term because it IS the standard.
- **When proposing security controls**: default to the simplest
  one that achieves the goal. If proposing anything more, cite
  the concrete evidence that justifies the complexity.
- **When evaluating existing controls**: if you see
  infrastructure that could be simpler while achieving the same
  goal, flag it — Zeta's governance layer should shed weight,
  not accrete it.
- **Keep the RBAC frame**: "simple security" is not "no
  security" and is not "flat world". The role → persona →
  skill → BP-NN chain is architectural; what varies is the
  enforcement mechanism's complexity.

## When NOT to apply

- **Does not apply to product-surface security**. Zeta's crypto,
  storage durability, serialization boundaries, and supply
  chain get the full rigor of the threat model (Aminata, Mateo,
  Nazar, Nadia). The "simple until proven otherwise" rule is
  governance-layer only.
- **Does not grant permission to skip a standard control**.
  CODEOWNERS, signed commits, branch protection — these are
  simple baselines, not upgrades. Skipping them is not
  "simpler", it's missing.

## Reference artefacts

- `docs/GLOSSARY.md` — ACL / RBAC entries use plain-English
  leadins that model this rule.
- `docs/research/hooks-and-declarative-rbac-2026-04-19.md` —
  research report that treats "prefer simple" as a guiding
  constraint (§Guiding Constraints).
- `user_security_credentials.md` — product-surface rigor
  counter-context.
- `user_governance_stance.md` — minimalist-government stance
  counter-context.
