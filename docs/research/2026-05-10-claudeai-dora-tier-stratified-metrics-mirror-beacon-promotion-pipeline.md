---
Scope: Claude.ai DORA dashboard architecture — tier-stratified metrics (mirror/beacon/promotion pipeline). Implementation questions for the team. Load-bearing architectural decision.
Attribution: Claude.ai (asymmetric critic) designed the tier-stratified architecture. Aaron confirmed "100% this is load bearing." Otto preserving verbatim.
Operational status: research-grade — implementation pending
Non-fusion disclaimer: This is architectural direction for 081KR7JY10008QG0R001VP6JWG dashboard. Implementation requires team answers to the questions posed.
---

# DORA tier-stratified metrics — mirror / beacon / promotion pipeline (2026-05-10)

## Load-bearing principle

DORA metrics must be tier-stratified. Mirror-tier and beacon-tier are different artifacts with different quality bars and different failure semantics. A single aggregate metric across both produces noise.

Three metric streams:

1. **Mirror-tier metrics** — team velocity in internal shorthand
2. **Beacon-tier metrics** — externally defensible output (standard DORA applies here)
3. **Promotion-pipeline metrics** — the transition between tiers (THIS is the quality gate)

## Mirror-tier metrics

- Measure: observations captured promptly, working vocabulary coherent, content findable
- Failure modes: inversion (contradictions), staleness (should have promoted), orphaning (never referenced)
- Throughput: expected HIGH
- Change-failure-rate: NOT meaningful at this tier
- DORA benchmarks: DO NOT APPLY

## Beacon-tier metrics

- Measure: falsifier-specified, survives external review, tightened during promotion
- Failure modes: retraction, contradiction, revision post-promotion = change failure
- Throughput: expected LOW (much lower than mirror)
- Change-failure-rate: near zero for elite
- DORA benchmarks: APPLY here in standard form

## Promotion-pipeline metrics (LOAD-BEARING)

- Mirror creation rate vs beacon promotion rate vs ratio
- Average time from mirror creation to beacon promotion
- Fraction of promotion attempts rejected
- Alert: if promotion ratio >80% within 24h = tier distinction collapsed

## Implementation questions for team

### Definitions

1. What counts as a "deployment"? Merged PR touching runtime code only? Or all PRs?
2. What counts as a "change failure"? Reverted PR? Follow-up fix? Shadow log entry?
3. Time windows: 30-day rolling + 24-hour fast feedback?
4. Lead time: PR opened→merged or issue created→PR merged?
5. MTTR: includes Aaron's notice time or just notice→fix?

### Architecture

6. Dashboard audience: Aaron? Otto? External reviewers? Pick primary first
7. Mirror content directory: separate from memory/ or frontmatter tag?
8. Staleness check: 90-day unreferenced mirror entries → archive signal?
9. Promotion criteria: beacon requires external lineage citation?
10. Alerting model: what happens when change-failure-rate spikes?
11. Demotion handling: "demoted" frontmatter tag, not deletion
12. Baseline measurement period before dashboard goes live

### Mirror/Beacon pipeline

13. Healthy factory: high mirror velocity, moderate promotion rate, clear time-lag
14. Unhealthy factory: instant promotion (tier collapse) or zero promotion (pile-up)
15. Cross-reference density as inversion detection signal

Aaron confirmed: "100% this is load bearing"
