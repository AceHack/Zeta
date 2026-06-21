---
id: 081KT5CF90008QG0R000KYNZGF
priority: P3
status: open
title: "Jurisdiction-relative federated sovereignty — relative geospatial borders + per-jurisdiction OPA (recognized external identities + exchange policies) + mutual-permission (intersection) cross-jurisdiction exchange + Nexus meta-jurisdiction (Zeta as peer sovereign, non-central by supported structural+interoperable forkability); legal vetting per jurisdiction (Aaron 2026-06-03)"
tier: federation-architecture
effort: XL
created: 2026-06-03
last_updated: 2026-06-03
depends_on: []
composes_with: [081KSE6WT0008QG0R0009YYNP4, 081KS3X9Y0008QG0R003MMEAC7]
tags: [federation, sovereignty, opa, jurisdiction-relative, geospatial, borders, non-coercion, meta-jurisdiction, nexus, forkability, internationalization, aaron]
type: design
---

# Jurisdiction-relative federated sovereignty (OPA per jurisdiction + Nexus meta-jurisdiction)

## Origin (Aaron 2026-06-03, forwarded Kestrel × maintainer session)

Preserved engineering substrate: `docs/research/2026-06-03-kestrel-aaron-open-source-ethic-floor-governance-jurisdiction-relative-opa-federation-nexus-meta-jurisdiction-conflict-resolution-aaron-forwarded.md` §6–§7.

## Why

Borders are the canonical **values-residual** conflict (081KT5CF90008QG0R002NFJM72): everyone has the same
data and still disagrees on *legitimacy*, so shared data can't resolve it, and there is
**no globally-agreed border set**. The honest answer is to **faithfully represent the
disagreement** — jurisdiction-relative — rather than pick a side via a single global truth.

## Architecture

- **Jurisdiction-relative geospatial borders:** pull in the borders for the jurisdiction
  the software runs in (industry-standard; Maps products already do this).
- **Local OPA policy per jurisdiction** defines (a) which **external identities** it
  recognizes (diplomatic-recognition analog — jurisdiction-relative) and (b) the **exchange
  policies** for recognized external identities (trade/treaty analog). Both the OPA policies
  AND the identities are jurisdiction-relative.
- **Cross-jurisdiction exchange = mutual permission (intersection):** an exchange occurs only
  where **both** jurisdictions' OPA permits — non-coercion means neither imposes on the other
  (handles asymmetric/non-reciprocal recognition, e.g. sanctions).
- **Nexus meta-jurisdiction:** Zeta participates as a **peer sovereign** (own OPA, recognized
  identities, exchange policies) — NOT an overlord. Non-central by **supported structural +
  interoperable forkability**: encourage + support meta-jurisdiction forks; the meta-jurisdiction
  protocol must be open enough that a forked Nexus functions as a **full peer** (forkable AND
  interoperable, not isolated); make forkability **structural** (binds even future-Zeta), per
  must-pair-with-can-exit (can't-stop-a-fork; bind by worth-staying-not-mandatory).
- **Legal vetting per jurisdiction:** borders/recognition/exchange are heavily regulated
  (some jurisdictions legally mandate their border view; sanctions/export-control/trade law,
  often strict-liability). The architecture is general; each jurisdiction's policy CONTENT
  needs lawyers.

## Acceptance

- [ ] jurisdiction-relative geospatial border data model + jurisdiction resolution
- [ ] per-jurisdiction OPA: recognized-identities + exchange-policy schemas
- [ ] cross-jurisdiction exchange = intersection-of-both-OPA (mutual-permission); non-reciprocal handling
- [ ] Nexus meta-jurisdiction as peer + open forkable interoperable protocol (structural forkability)
- [ ] per-jurisdiction legal vetting hooks (mandated-border-view, sanctions/trade compliance)

## Composes with

- 081KSE6WT0008QG0R0009YYNP4 (CNCF ecosystem incl. OPA as force-multiplier behind Zeta interfaces)
- 081KS3X9Y0008QG0R003MMEAC7 (clock/protocol negotiation stack) — protocol negotiation lineage
- 081KT5CF90008QG0R002NFJM72 (conflict-resolution two-classes — borders = the values-residual class)
- `.claude/rules/must-paired-with-can-exit-pattern.md` (forkable/non-central Nexus)
- `.claude/rules/non-coercion-invariant.md` (mutual-permission exchange)
