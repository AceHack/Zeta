---
name: Budget amounts + dollar figures OK in source — research context; free-credit burn is the real cost signal
description: Aaron 2026-04-22 "FYI when you are checking our billing and stuff to make sure we don't run out of monay [free credits*] you can check any dollar amounts and budget amount into source we dont have to hid it for this project. they may have billing history but we still like to have things in the repo for research." Budget/dollar amounts are NOT sensitive for this project — they can be committed to source for research reproducibility. Concern is free-credit-exhaustion (LFG has $0 budgets as hard-stops; actual burn caps at free-credit runout), not dollar-figure disclosure. Billing history stays at provider but in-repo tracking is welcomed.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**Rule:** For Zeta (both `AceHack/Zeta` and
`Lucent-Financial-Group/Zeta`), **budget amounts and dollar
figures are NOT sensitive** and can be committed to source.
When auditing billing, quotas, credit-burn, or cost projections,
capture the specific numbers in-repo — don't round, redact, or
paraphrase them.

**Why:** Aaron 2026-04-22, verbatim (with silent correction per
typing-style memory):

> "FYI when you are checking our billing and stuff to make sure
> we don't run out of monay [money=free credits*] you can check
> any dollar amounts and budget amount into source we dont have
> to hid it for this project. they may have billing history but
> we still like to have things in the repo for research."

Two orthogonal claims in this message:

1. **The real cost signal is free-credit exhaustion, not
   dollar-burn.** LFG has $0 budgets set on Copilot + models as
   designed cost-stops (verified 2026-04-22 via
   `gh api /orgs/Lucent-Financial-Group/copilot/billing`).
   Actual dollar-burn caps at zero; the practical cap is
   free-credit runout before the $0 budget bites. "Don't run out
   of money" is shorthand for "don't run out of free credits"
   because once credits exhaust, the $0 budget silently stops
   new work (build will just stop working; "not an emergency"
   per fork-PR cost-model memory).

2. **Dollar figures are research artifacts, not secrets.**
   Zeta's primary research focus is measurable AI alignment, and
   the factory is itself the experiment. Cost-per-round,
   cost-per-skill, cost-per-agent-QOL-investment are
   **first-class measurements** — concrete dollar amounts are
   load-bearing evidence, not metadata to scrub. Aaron made this
   explicit: "we still like to have things in the repo for
   research."

**How to apply:**

1. **When auditing billing / credits / quotas, commit the
   numbers.** If `gh api /orgs/Lucent-Financial-Group/copilot/billing`
   returns `seat_breakdown.added_this_cycle=1`, the specific
   plan price ($19/user/month for Copilot Business), or a credit
   balance, write those verbatim into the report, ADR, or
   memory. No "~$20/mo ballpark" when the exact figure is known.

2. **Budget-as-hardstop is the intentional design.** The $0
   budget settings on Copilot + models is the control that
   protects against runaway; it is not a failure, a fragility,
   or something to work around. Document the $0 as deliberate
   when referenced ("$0 budget cap is the intentional
   hard-stop," not "$0 budget needs raising").

3. **Free-credit tracking is the real cost KPI.** Where
   possible, surface credit-burn rate / remaining-credits into
   research artifacts (round-close ledger, FACTORY-HYGIENE
   cadenced audit, ADR footers). "We burned $X of $Y free
   credits this round" is meaningful; "we stayed under budget"
   is tautological (budget is $0).

4. **Billing history stays at the provider.** Per-line itemized
   invoices, payment records, tax info, credit card details live
   at GitHub Billing / Anthropic Console / etc. Don't try to
   mirror transactional history into the repo. In-repo numbers
   are for **research** (plan prices, quota sizes, observed
   burn, projections), not for **accounting** (individual
   charges).

5. **Research over hygiene theatre.** Where a previous tick
   might have written "<COPILOT_PRICE>" or "~$X/user" as a
   redaction gesture, replace with the concrete number when
   revisited. The redaction was not what Aaron wanted.

**What this rule does NOT change:**

- **Personal info stays out.** The pre-existing settings-change
  permission from
  `memory/feedback_lfg_paid_copilot_teams_throttled_experiments_allowed.md`
  excluded "budget" + "personal information"; that exclusion
  was **on editing the budget setting itself**, not on writing
  dollar figures into source. Aaron's clarification here is
  specifically about **publishing amounts in-repo**, which was
  never covered by the earlier exclusion.
- **Credit-card numbers, auth tokens, API keys, session
  cookies** remain secret. The rule covers *plan pricing,
  budget caps, observed burn* — not payment credentials.
- **Other orgs / third-party** budget info stays private. This
  is a Zeta-repo-specific policy (Aaron owns both surfaces).

**Cross-reference:**

- `memory/feedback_lfg_paid_copilot_teams_throttled_experiments_allowed.md`
  — "budgets i set to 0 ... you can chany any lucent settings
  other than the budget and my personal information"; the
  exclusion was about editing the live setting, not about
  writing the number in a doc.
- `memory/project_lfg_org_cost_reality_copilot_models_paid_contributor_tradeoff.md`
  — "we don't have github copilot over here unless i pay and
  the models cost money over here too"; grounds why cost is
  load-bearing research, not peripheral admin.
- `memory/feedback_fork_pr_cost_model_prs_land_on_acehack_sync_to_lfg_in_bulk.md`
  — "build will just stop working when free credits run out";
  corroborates that the cost surface is credit-exhaustion, not
  dollar-overspend.
- `memory/user_typing_style_typos_expected_asterisk_correction.md`
  — "money=free credits*" asterisk-correction pattern applies
  to the initial message.

**Artifacts this rule authorizes:**

- Concrete plan-price figures in ADRs referencing Copilot plan
  choice ("$19/user/month Business tier").
- Observed credit-burn / remaining-credits entries in
  round-close ledger (`docs/ROUND-HISTORY.md`) and hygiene
  audits (`docs/hygiene-history/*`).
- Cost-projection rows in `docs/BACKLOG.md` and research docs
  under `docs/research/`.
- Any in-repo tracker of org-level billing surface settings
  (e.g. a `docs/BILLING-STATE.md` settings-as-code companion if
  one is ever added, parallel to `docs/GITHUB-SETTINGS.md`).

**Source:** Aaron direct message 2026-04-22 during round-44
speculative drain, mid-BACKLOG-ruleset-audit work, with silent
asterisk-correction on the first word.
