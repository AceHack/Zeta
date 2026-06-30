---
id: B-0572
priority: P2
status: open
title: "LFG GitHub tier decision — Team confirmed; evaluate Enterprise trial for 3× rate-limit + verify included-credit preservation"
tier: factory-infrastructure
effort: S
created: 2026-05-16
last_updated: 2026-05-16
depends_on: []
composes_with: [B-0570, B-0571]
tags: [github, billing, rate-limit, scarcity-mitigation, factory-infrastructure, decision]
type: decision
---

# LFG GitHub tier decision

## Origin

Falls out of B-0570 (scarcity tracker) mitigation-axes analysis. The 2026-05-16 session demonstrated GraphQL saturation at the 5000/hr per-user limit. GitHub Enterprise Cloud raises this to **15000/hr per user acting in the organization** (3× headroom).

**Audit RESOLVED 2026-05-16**: Aaron's billing-dashboard screenshot confirmed LFG is currently on **GitHub Team** tier ($96/year, 2 licenses @ $48/user/year). The dashboard also revealed a critical finding for the upgrade decision: **$2,863.18/mo in included-usage discounts** against $2,872.98 metered usage = net ~$9.81/mo (Copilot). The vast majority of LFG's GitHub usage is currently being underwritten by tier-included credits (Models tokens, Actions minutes, Spark beta credits — visible in the dashboard's Usage-by-products tabs).

This re-shapes the row from "audit the tier" (XS, complete) to "decide whether to upgrade given the included-credit situation" (S, open).

## Decision: TRY ENTERPRISE (2026-05-16)

Aaron 2026-05-16: *"we will just try it, it says we can downgrade anytime"*

The downgrade-anytime escape valve removes the cost-of-decision risk: if Enterprise's included-credit table differs unfavorably from Team's (eliminating the $2,863/mo discounts), or if features don't justify the per-user premium, just downgrade. Worst case = one billing cycle of higher cost; verification happens with real data instead of pre-commit speculation.

This row pivots from "decide whether to upgrade" to "monitor post-upgrade and trigger downgrade if discounts don't persist or features don't justify."

### What's at stake

| Path | Cost | Rate-limit | Risk |
|---|---|---|---|
| **Stay on Team** | $96/yr | 5000/hr GraphQL per user (saturated today) | Recurring multi-agent saturation |
| **Upgrade to Enterprise Cloud** | $504/yr ($21/user/mo × 2) — but Aaron has promotional free trial | 15000/hr per user (3×) AND typically more included credits | **None confirmed yet** — needs verification that the $2,863/mo discounts persist or grow at Enterprise tier |

### Why the verification matters

The dashboard's $2,863.18 in included-usage discounts is the load-bearing number. If those discounts evaporate at Enterprise tier, the upgrade trades $96/yr → $504/yr + $2,863/mo new exposure = **catastrophic** cost increase. If discounts persist or grow (the expected case for tier upgrades), the only real cost is the $408/yr Enterprise premium.

**The "More details" link on "Current included usage" in the dashboard** breaks down which services the $2,863 covers. That breakdown is the verification step.

## Acceptance criteria

- [x] Confirm current tier (DONE 2026-05-16: GitHub Team via Aaron's dashboard screenshot)
- [ ] Click "More details" on Current included usage in dashboard — capture per-service breakdown (Actions / Models / Codespaces / Spark / etc.)
- [ ] Verify Enterprise's per-service included-credit table at <https://docs.github.com/en/enterprise-cloud@latest/billing/concepts/product-billing> — confirm each line item is equal-or-more at Enterprise tier
- [ ] If verification passes: start promotional Enterprise trial; observe for at least one billing cycle to confirm discounts persisted
- [ ] If verification reveals at-risk line items: document which ones and decide case-by-case
- [ ] Document tier + verification findings in a new `docs/SCARCITY.md` (neither `docs/AUTH.md` nor `docs/SCARCITY.md` exists today — this acceptance item creates the canonical file)
- [ ] Update B-0570 scarcity tracker to report 15000/hr limit if upgraded (currently assumes 5000/hr)

## Composes with

- B-0570 (scarcity tracker — visibility layer; tier-context informs the bucket size)
- B-0571 (GitHub App — separate-pool alternative; **these compose**, not alternatives. App for automation; Enterprise for org-features + larger user-pool baseline)
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` (rate-limit-wait is the underlying failure mode)

## Substrate-honest caveats

- The $2,863/mo discount level on $96/yr subscription suggests GitHub is heavily underwriting current usage (promotional / beta credits for Models / Spark). Some of this is likely to change as products GA.
- Enterprise Cloud pricing is $21/user/month at standard — promo offer mitigates short-term cost but standard pricing returns after promo ends; long-term cost-benefit depends on whether the included credits justify the per-user premium.
- The "free 3× rate-limit" framing is real but the saturation today happened at 5000/hr in ~50 min with 3-4 concurrent agents. At 15,000/hr, same load = ~2.5 hours — helpful but not unbounded. GitHub App (B-0571) still wins long-term because **separate pool > bigger same-pool**.
- This row is a **decision**, not a build. Once Aaron makes the call (and ideally verifies discount-preservation during trial), the row closes.

## Open questions

1. **Per-service discount breakdown**: which line items (Models / Actions / Codespaces / Spark) account for the $2,863 — needed before upgrade decision
2. **Trial duration**: how many promotional months? Determines verification window
3. **Verification timeline**: when does the next billing cycle start? Want one full cycle observed before committing
4. **Org-owner action**: only Aaron (org owner) can initiate the trial; this row will sit waiting for his action

## Pre-start checklist

- [x] Prior-art search: B-0570 mitigation-axes table already references tier audit as one of three orthogonal mitigations
- [x] Dependency proof: no blockers; this is a decision-research row
- [x] Audit step (originally XS): completed 2026-05-16 via Aaron's billing-dashboard screenshot
