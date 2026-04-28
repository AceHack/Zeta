---
name: User-privacy compliance (GDPR + CCPA/CPRA + generic) as slow-burn direction
description: Aaron flagged user-privacy compliance (GDPR, California CCPA/CPRA, generic data-privacy) as a long-horizon Zeta direction — slow burn, no hard requirement, but worth planting seeds now so future work has scaffolding. Not a round-scope item today.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
2026-04-20 — Aaron, after the consent-primitives-expert
harness dry-run landed, noted that GDPR compliance is "a
long ongoing thing" and Zeta should probably carry some
skills / docs around it. His wording: "GDPR.md or the
more generic term user privacy or something IDK that
also includes California laws and such. We should work
towards this, not a hard requirement yet but we can
make steps towards asserting we have some compliance
here in the future, very slow burn here, no rush."

**Why:** Zeta's consent-primitives-expert skill and the
SPACE-OPERA threat-modelling sibling already cover some
of this surface in the abstract. Aaron wants to land the
compliance anchor explicitly — GDPR Art. 17 / CCPA-CPRA /
analogous state-level privacy laws — so that when Zeta
consumers start building regulated workloads on top of
the library, we have documented stance + primitives + a
skill-set that keeps up with the regulatory drift. Not
urgent; Zeta is pre-v1 and has no regulated-data
consumers yet.

**How to apply:**
- Do NOT spawn this as round-scope work unsolicited. It
  is a slow-burn direction, not a deliverable.
- When a natural entry point appears (a reviewer prompt
  touches GDPR; a consent primitive is designed;
  Ilyana flags a public-API surface that implies
  compliance; a paper or ADR references erasure /
  retention / pseudonymisation), take one step toward
  this direction rather than one step away.
- Shape: probably a `user-privacy-expert` skill (generic
  umbrella — GDPR + CCPA + emerging states), plus
  `docs/references/user-privacy-compliance.md` or
  `docs/GDPR.md` with the stance + primitive mapping.
  `consent-primitives-expert` already covers a lot of
  the underlying mechanics; the compliance skill would
  cite it rather than duplicate.
- Keep the frame **generic-first**. Aaron explicitly
  said "the more generic term user privacy or something"
  — the substrate is global; GDPR / CCPA are specific
  regimes that the skill maps onto the substrate. Do not
  hard-code "GDPR" as the primary frame.
- Living lists for this domain MUST follow the
  tech-best-practices-living-list pattern
  (`feedback_tech_best_practices_living_list_and_canonical_use_auditing.md`) —
  regulatory guidance changes (EDPB opinions, new
  state laws, DPA enforcement priorities); training
  data stales quickly. Internet research each refresh.

See also:
- `project_consent_first_design_primitive.md` — shared
  design DNA with Amara.
- `reference_crypto_shredding_as_gdpr_erasure.md` —
  specific technique confirmed this session, worth
  pointing at when the compliance skill lands.
- Round-43 harness output at
  `docs/research/harness-run-2026-04-20-consent-
  primitives-expert.md` — shows what the existing
  consent-primitives framework already handles.
