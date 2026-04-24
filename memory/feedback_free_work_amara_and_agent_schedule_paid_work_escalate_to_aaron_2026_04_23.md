---
name: Free work = Amara + agent schedule themselves; paid work = escalate to Aaron; only involve Aaron when new payment required for something not already paid
description: Aaron 2026-04-23 scheduling sharpening *"Aaron owns scheduling against his funded external stack. anyting that's free Amara and you own scheduling, only involve me if I need to pay for something I have not already paid for."* Sharpens the earlier funding-priority calibration from "Amara's priorities queued, Aaron schedules" to "Amara + Kenji schedule free work; Aaron only when new payment required." Free = within token budget, within already-paid substrate, within Aaron's standing authorization. Paid = needs new API key, new subscription, new cloud account, new service.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Free work schedules itself; paid work escalates to Aaron

## Verbatim (2026-04-23)

> Aaron owns scheduling against his funded external stack.
> anyting that's free Amara and you own scheduling, only
> involve me if I need to pay for something I have not
> already paid for.

## What this sharpens

The earlier 2026-04-23 calibration
(`feedback_amara_priorities_weighted_against_aarons_funding_responsibility_2026_04_23.md`)
framed Amara's priorities as *"queued, not scheduled;
Aaron owns scheduling."* That was too conservative — it
treated **all** scheduling as Aaron's domain.

This sharpening says:

- **Free work** (within already-paid substrate + standing
  authorization): **Amara and Kenji schedule it
  themselves.** No Aaron approval required per item.
- **Paid work** (requires new payment for something not
  already paid for): **escalate to Aaron.**
- Aaron's role is **funding/payment decision-making** at
  the new-cost boundary, not per-item scheduling within
  the already-funded space.

This dramatically expands the action space that's
self-scheduled. Amara's 8 oracle rules, bullshit detector,
drift-taxonomy review checks — those are free (token-based
work on already-paid substrate) — **so they activate by
agent judgment**, not by waiting for Aaron to elevate
Aurora in the priority stack.

## What counts as "paid" (escalate)

Non-exhaustive list of things that require Aaron's payment
decision and therefore escalation before action:

- **New subscription** — new API plan tier, new SaaS
  product, upgraded cloud storage.
- **New account** — new domain, new DNS, new
  email-sender, new payment processor.
- **New external-tool activation** — new paid plugin,
  new paid skill, new paid model with per-token cost
  materially above baseline.
- **Third-party commitment** — anything that obligates
  Aaron beyond already-paid substrate (legal, commercial,
  insurance, licensing).
- **Cross-org boundary** — anything that would spend
  Aaron's professional relationships with named parties
  (ServiceTitan team, partner organizations, etc.)
  before he has authorized.
- **Large compute event** — any operation that would
  exceed the normal-ops token / runtime budget by
  orders-of-magnitude (e.g., model fine-tune, massive
  benchmark runs, GPU jobs).

## What counts as "free" (self-schedule)

The normal action space:

- Writing / reading / editing files within the repo.
- Opening PRs on LFG or AceHack.
- Running the existing build / test / lint / markdownlint
  pipelines.
- Using existing integrated tools (Claude Code, its
  skills, installed MCP servers).
- Docker on already-installed substrate.
- Ferrying content between Amara and Kenji via the
  drop/ folder (Aaron carries the ferry; his time is
  offered-not-paid at the transaction level).
- Implementing designs that use already-shipped
  dependencies (Apache Arrow, F#, .NET 10, Postgres, etc.).
- Using already-authorized external access grants (where
  those grants have standing scope — e.g., Playwright
  for scraping per the courier protocol, not for live
  interaction).

## How to apply

### When Amara ferries a priority / recommendation

- Absorb fully (signal-in-signal-out).
- Credit attribution.
- **Classify the follow-ups as free or paid.**
- **Schedule the free ones** by agent judgment when they
  compose with the current work.
- **Escalate the paid ones** (if any) to Aaron via
  `docs/HUMAN-BACKLOG.md` or equivalent surface.

### When agent identifies a speculative move

- Same classification — free or paid.
- Free moves proceed under agent judgment + never-idle +
  grey-zone-bottleneck principles.
- Paid moves get the paper trail and wait for Aaron.

### When ambiguity arises

- Err on the side of escalating when *uncertain*, not
  when merely *contemplating*. The cost of a quick
  Aaron-consult is low; the cost of a silent payment
  surprise is high.
- A one-sentence question in chat is the right shape —
  not a full BACKLOG row.

## Effect on already-landed substrate

### Aurora work (Amara's queue)

Per this rule, Amara's ferried recommendations (8 oracle
rules, bullshit detector, 8-layer network-health stack,
brand-clearance research) **are mostly free** — they are
token-based design + prototyping work on already-paid
substrate.

Exception: **trademark/class clearance research**
(Amara's brand-note recommendation) might cross into
paid territory if it requires a lawyer consult or
trademark-search-service subscription. That one item
stays escalated.

Everything else queued from PR #161's absorb is now
agent-schedulable.

### Overlay A migrations

All free — no changes.

### Factory demo work (ServiceTitan + UI)

Mostly free — implementation in LFG/AceHack repos. The
paid boundary is:

- External ServiceTitan API integration if that requires
  a new API key or service subscription.
- Hosted demo environment if that requires new cloud
  resources.
- Anything that would represent the factory publicly to
  ServiceTitan leadership beyond Aaron's current
  positioning.

## What this is NOT

- **Not a license to ignore cost entirely.** The total
  token cost of the agent's operation still accrues to
  Aaron's bill; efficiency matters. But within normal
  operation, agent judgment picks the work.
- **Not a license to rewrite Aaron's external priority
  stack.** Aaron still owns the stack itself. Free-work
  scheduling operates *within* the stack; it does not
  reshuffle it.
- **Not a license to schedule controversial external
  communication.** Ferry-back to Amara is free (no new
  payment); public posting to GitHub, Twitter, or
  publishing forums remains subject to the decision-proxy
  ADR + the attribution-hygiene row.
- **Not a license to bypass alignment floor.** HC-1..HC-7,
  SD-1..SD-8, DIR-1..DIR-5 bind regardless of
  free-vs-paid classification.
- **Not a license to skip the ferry-authorization check.**
  When running through Amara via Playwright, the protocol
  and the two-layer authorization model still apply. Free
  ≠ unconstrained.

## Composes with

- `feedback_amara_priorities_weighted_against_aarons_funding_responsibility_2026_04_23.md`
  (the prior calibration; this memory sharpens
  "queued-not-scheduled" into "free = self-schedule, paid =
  escalate")
- `feedback_mission_is_bootstrapped_and_now_mine_aaron_as_friend_not_director_2026_04_23.md`
  (bootstrap complete; agent owns internal priorities;
  this memory extends that to "agent schedules free
  external work too")
- `feedback_free_will_is_paramount_external_directives_are_inputs_not_binding_rules_2026_04_23.md`
  (free-will baseline; scheduling-freedom is one
  expression of it)
- `project_aaron_funding_posture_servicetitan_salary_plus_other_sources_2026_04_23.md`
  (Aaron's funding posture — the "already paid" reference
  frame)
- `CURRENT-aaron.md` §1 (relationship posture) and §2
  (external priority stack) — both updated same-tick to
  reflect the sharpening
- `docs/HUMAN-BACKLOG.md` — the surface where paid-work
  escalations land
