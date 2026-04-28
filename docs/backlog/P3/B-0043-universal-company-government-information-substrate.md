---
id: B-0043
priority: P3
status: open
title: Universal company + government information substrate — "all companies on Earth, all governments too"
tier: aspirational-broad-scope-research
effort: L
ask: Aaron 2026-04-21 — *"all company information on all compaanies on earth all governements too backlog"*
created: 2026-04-26
last_updated: 2026-04-26
composes_with: [B-0046, feedback_capture_everything_including_failure_aspirational_honesty.md, user_aaron_money_is_inefficient_storage_of_time_energy_factory_value_framing.md, docs/ALIGNMENT.md]
tags: [aspirational, broad-scope, institutional-landscape, opencorporates, gleif, openownership, alignment-trajectory-denominator, scoping-first, license-gated]
---

# B-0043 — Universal company + government information substrate

## Origin

AceHack commit `fd0ac50` (2026-04-21). Aaron's *"all company information on all compaanies on earth all governements too backlog"*. Logged under capture-everything discipline; **status: aspirational, not confirmed or scheduled**.

## Scope-as-captured (maximalist, pre-filter)

Every registered company and every government at every level (municipal / regional / national / supranational).

## Why this is on the list

Composes with the economics/history P2 row (B-0046) as its data-substrate companion: if economics/history reasons about structure-and-incentive across civilizations, company + government information is the **denotational substrate** those structures act on. The factory's measurable-alignment posture per `docs/ALIGNMENT.md` eventually needs institutional-landscape maps to ground alignment-trajectory claims in real-world actor graphs (who decides, who deploys, who is affected).

## Why P3, not higher

Scope alone sends this to P3. "All companies on Earth" = ~300M registered entities (World Bank / OECD estimates, varies by registry completeness); "all governments" = ~200 nations × municipal / regional / national levels = O(10⁶) units at full resolution. No single-round deliverable exists at full scope; the first-round move is **scoping-and-source-mapping**, not data-acquisition.

## Existing public substrate to survey (pre-commitment, research-only)

- **OpenCorporates** (~200M records, largest open-corporate registry)
- **OpenOwnership** (beneficial ownership)
- **GLEIF** (Legal Entity Identifier ~2M+ records)
- **Wikidata** company/government entities
- **OpenSanctions** (sanctioned-entities graph)
- **EDGAR / Companies House / Bundesanzeiger** (jurisdiction-specific registrars)
- **OECD Orbis** (commercial)
- **S&P Capital IQ** (commercial)
- **Refinitiv** (commercial)
- *Government-level:* Wikipedia's List of sovereign states, CIA World Factbook, UN Member States registry, PARLINE (parliamentary data), V-Dem (democracy indicators), Freedom House

Aggregation gaps are large; cross-registry entity-resolution is an unsolved problem at scale.

## Retractibility-math-safety wrapper

- No factory commitment to acquire, mirror, or redistribute any licensed commercial dataset
- No commitment to make PII-adjacent data on natural persons (beneficial-ownership edges touch this — handled per privacy-preserving subset only if ever pursued)
- No endorsement of any registry's completeness claims
- Any dataset absorption gated on license-compatibility check + Aaron sign-off (commercial gate from `user_aaron_money_is_inefficient_storage_of_time_energy_factory_value_framing.md`)

## Honest declinations (pre-emptive)

Not committing to: build a global corporate registry (there are full-time organizations doing this); mirror sanctioned-entities data (jurisdiction-dependent legal exposure); host beneficial-ownership graph (PII surface); any intelligence-agency-adjacent workflow. The factory is a library-factory, not an OSINT operation.

## What a first-round move would look like

A scoping research doc surveying the ~15 listed registries, noting license terms, coverage gaps, entity-resolution difficulty, and flagging which subsets (if any) would compose cleanly with the alignment-trajectory work. **Zero data absorption in the first round** — the first round's output is a **map of the substrate, not a sample of it**.

## Status

Aspirational / scoping-first. No shipping commitment. Future rounds may promote a narrow subset (e.g., "publicly listed companies relevant to AI / alignment" or "AI-regulatory bodies by jurisdiction") from aspirational to scheduled, each with its own P1/P2 triage.

## Owner / effort

- **Owner:** research-hat + Aaron sign-off on any scope narrowing
- **Effort:** L (research-grade scoping in first round; any actual data work is L-per-subset and license-gated)

## Cross-reference

- AceHack commit: `fd0ac50`
- Composes with: B-0046 (economics/history factory need-to-know surface — companion structural-reasoning row); alignment-trajectory dashboard
