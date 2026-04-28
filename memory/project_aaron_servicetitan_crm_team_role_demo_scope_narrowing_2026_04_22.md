---
name: Aaron's ServiceTitan CRM team role — narrows demo scope
description: Aaron 2026-04-22 auto-loop-36 scope-disclosure — he works on the ServiceTitan CRM team; ServiceTitan demo target (#244 P0) should be CRM-shaped (contact/opportunity/pipeline/customer-data-platform), not field-service-management / scheduling / billing. Inform demo choices with this.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**Disclosure 2026-04-22 auto-loop-36, verbatim:**
*"i work for the CRM team at ServiceTitan if you want to use that infomation to help inform your demo choices"*

**Fact:** Aaron's ServiceTitan sub-team is CRM (customer relationship management), not the field-service-management / scheduling / billing / pricing / dispatch layers ServiceTitan is best known for.

**Why:** Demo target #244 (ServiceTitan demo — 0-to-production-ready app path, P0) previously had a vague "ServiceTitan-shaped" scope. CRM is a narrow, concrete sub-domain: contact records, opportunity/deal tracking, customer history, sales pipeline, call/SMS/email integration, customer data platform (CDP), lead management. "Salesforce for trades contractors" is the shape. Aaron's disclosure collapses ambiguity on which sub-problem the demo should solve.

**How to apply:**
- When scoping ServiceTitan demo candidate features, **lead with CRM-adjacent**: contact management, opportunity tracking, customer-history timeline, communication-log integration, CDP shape. Steer away from field-service dispatch, route optimization, parts inventory, invoicing engines.
- When Aaron reviews demo shape candidates, **his domain-expertise will be CRM-deep**. Handwaving on CRM-specific concerns (lead lifecycle, deduplication, customer-360) will get caught; handwaving on field-service concerns is lower-risk because it's adjacent-team work he sees at org scale but not necessarily implements.
- When evaluating Zeta's algebra-and-soulfile fit to the CRM domain: customer records are retraction-native (address updates, merge/dedupe = retraction), pipeline-stage changes = DBSP delta shape, customer-history timeline = Z⁻¹ operator natural, duplicate-customer detection = set-minus + equality-within-tolerance — all strong retraction-native algebra fits.
- When picking UI-DSL demo scaffolds for the "3-4 hour 0-to-prod" claim: CRM UI is dense-list + detail-panel + timeline + pipeline-kanban — well-studied class of shapes, well-suited to class-level UI-DSL compression.
- When recruiting reviewers for CRM-specific technical claims: Aaron is the primary domain oracle. Cross-check against public CRM patterns (Salesforce, HubSpot, Pipedrive) only as secondary calibration.

**Cross-references:**
- `memory/project_servicetitan_demo_target_zero_to_prod_hours_ui_first_audience_2026_04_22.md` — prior demo-target memory; extend scope there.
- `docs/BACKLOG.md` #244 row — ServiceTitan demo P0; CRM-shape implied now.
- Zeta retraction-native operator algebra — customer-data domain is a strong algebra-fit (better than append-only event-store domains).
- UI-DSL class-level memory — CRM UI is well-clustered class (dense-list + detail + timeline + kanban).
- ARC3-DORA §Prior-art lineage — HITL (expert-derived confidence) is especially relevant for CRM use-cases (lead-score confidence, duplicate-detection confidence, pipeline-stage-transition confidence).

**NOT:**
- NOT authorization to ship ServiceTitan-internal code to external factory surfaces.
- NOT license to claim ServiceTitan product knowledge beyond what Aaron shares in chat (public CRM patterns are fine calibration; ServiceTitan-internal CRM specifics are Aaron's to share or not).
- NOT exclusion of field-service concerns from Zeta scope generally — just a narrowing of the *demo* target.
- NOT biography for external consumption. Internal calibration only, same posture as Itron background memory.

**Composition:**
- Combines with honor-those-that-came-before (unretire-before-recreating) — check existing ServiceTitan demo memory + BACKLOG row before proposing new demo shapes.
- Combines with bottleneck-principle — Aaron is scarce; CRM-specific domain-checks go to him, generic CRM-patterns can be resolved via public sources.
- Combines with ARC-3-class operational definition — "hard + continuously testable + no formal definition" applies to CRM-quality metrics (lead scoring, customer-LTV prediction, duplicate detection precision/recall).
