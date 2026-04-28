# AceHack vs LFG cost-parity audit

**Date:** 2026-04-23
**Status:** first-pass audit; `admin:org` scope elevation authorized but not yet applied via `gh auth refresh`. The Otto-65 addendum below uses billing-UI screenshots pasted by the human maintainer, NOT scope-elevated agent reads.
**Lives on:** AceHack (experimentation-frontier per Amara authority-axis split — Otto-61 memory)
**Companion memory (per-user, pending in-repo migration):**
`feedback_lfg_free_actions_credits_limited_acehack_is_poor_man_host_big_batches_to_lfg_not_one_for_one_2026_04_23.md`
**Triggering directive:** human-maintainer Otto-61 — *"we should parity
check for costs and see if there is really anyting AceHack gets us
for free that would limit us on LFG"*.

---

## TL;DR

- **Linux Actions**: both repos public → both unlimited-free. Parity.
- **macOS-14 runner**: corrected by Otto-65 addendum (see
  "Correction to Otto-61 claim: macOS multiplier cost"
  below). The original "matrix runs only on AceHack" claim
  was wrong — `gate.yml` matrix runs macOS on both forks,
  and LFG had macOS minutes on Apr 21 + 22. The
  cost-discipline rationale is latency + future-policy /
  fork-visibility-flip risk-headroom, not "matrix
  avoidance."
- **LFG monthly baseline cost** (confirmed by human-maintainer
  Otto-62, with follow-up Otto-62 correction *"i only used one user
  seat so only 19, maybe will update max later"*): Team plan
  (~$4/seat × 2 = $8/mo) + **Copilot Business** (~$19 × 1 seat
  active = $19/mo; may scale later) ≈ **~$27/mo flat** before any
  per-Actions spend.
- **AceHack as user account**: exact Copilot-Pro status requires
  human-maintainer billing page (not exposed to the agent read-only
  API). If the human maintainer holds Copilot Pro personally, AceHack inherits
  Copilot PR reviews + Chat. If not, AceHack has no Copilot.
- **Conclusion**: LFG is richer (Team plan + Copilot Business); AceHack
  is cheaper. Amara's authority-axis split (experiments → AceHack;
  decisions → LFG) stands. The cost delta is real but not a
  constraint against "go wild" on public-repo Actions minutes.

---

## Observable from agent read-only API

### Repo visibility + ownership

| Field | LFG | AceHack |
|---|---|---|
| `visibility` | public | public |
| `owner.type` | Organization | User |
| `fork` | false | **true** (fork of LFG) |
| default branch | main | main |

### Security + analysis features

| Feature | LFG | AceHack |
|---|---|---|
| `dependabot_security_updates` | enabled | disabled — could be enabled free on public repos |
| `secret_scanning` | enabled | enabled |
| `secret_scanning_push_protection` | enabled | enabled |
| `secret_scanning_ai_detection` | disabled (paid) | not exposed (disabled) |
| `secret_scanning_validity_checks` | disabled (paid) | disabled |
| `secret_scanning_delegated_alert_dismissal` | disabled (paid) | not exposed |
| `secret_scanning_delegated_bypass` | disabled (paid) | not exposed |
| `secret_scanning_non_provider_patterns` | disabled | disabled |

### Actions runner cost-awareness (`gate.yml`)

> **Errata 2026-04-28 (corrected by Otto-65 addendum
> below):** the snapshot below was authored from a stale
> read of `.github/workflows/gate.yml`. The current matrix
> runs macOS on **both** forks; the conditional below does
> NOT match what the file says today. The Otto-65 addendum
> ("Correction to Otto-61 claim: macOS multiplier cost")
> covers the corrected reality and the cost-discipline
> rationale.

```yaml
os: ${{ fromJSON(github.repository == 'Lucent-Financial-Group/Zeta'
        && '["ubuntu-22.04"]'
        || '["ubuntu-22.04","macos-14"]') }}
```

Original framing (now superseded): "deliberate cost split:
macOS-14 (10x multiplier even on public repos) runs on
AceHack only. LFG is Linux-only." Preserved verbatim for
audit-trail traceability; the Otto-65 addendum is the
canonical reference.

### Workflow run history (snapshot 2026-04-23)

- LFG: ~30 recent workflow runs (paginated API; actual total may be
  higher)
- AceHack: not queried this pass
- Artifact storage (LFG): 0 artifacts

---

## Unobservable without scope elevation

Needs `admin:org` on Lucent-Financial-Group (human-maintainer
authorized 2026-04-23 Otto-62: *"you can have admin:org and whatever
you need"*):

- Actual Actions minute consumption + spend-to-date
- Copilot seat allocation (human-maintainer confirmed
  Otto-62: *"i pay for copilot business i think on LFG"*)
- Per-seat license state
- Billing invoices + projected monthly total

Needs human-maintainer's personal billing page:

- AceHack user account plan tier (Free / Pro / Pro+)
- Personal Copilot Pro subscription status
- Personal Actions minute quotas (private-repo only; public is free
  regardless)

**Operational path:** elevate `gh auth` scope interactively via
`gh auth refresh -h github.com -s admin:org` when the agent + human
are together in the same session. Second pass on this audit consumes
the elevated scope to fill the unobservable fields.

---

## Confirmed cost structure (from human-maintainer Otto-62)

### LFG (Organization, Team plan)

| Line | Monthly | Notes |
|---|---:|---|
| Team plan base | ~$8 | $4/seat × 2 seats filled |
| Copilot Business | ~$19 | $19 × 1 seat active (human-maintainer Otto-62 correction: only 1 seat in use, may scale later) |
| Advanced Security paid features | $0 | None currently enabled (ai_detection, validity, delegated_bypass all disabled) |
| Actions (Linux on public repos) | $0 | Free unlimited |
| Actions (macOS) | $0 | Avoided via gate.yml matrix |
| **LFG baseline** | **~$27/mo** | **flat before Actions usage** (= $8 Team + $19 Copilot × 1 seat) |

### AceHack (User account, fork of LFG)

| Line | Monthly | Notes |
|---|---:|---|
| User account base | $0 — needs human-maintainer confirmation if Copilot Pro held personally | public-repo hosting is free |
| Actions (Linux on public repos) | $0 | Free unlimited |
| Actions (macOS-14) | ?? | Multiplier applies; personal-account free-minute quota for public repos needs verification |
| Advanced features | $0 | None visible |
| **AceHack baseline** | **~$0-$10/mo** | **depending on human-maintainer's personal plan** |

---

## What AceHack gets free that LFG does NOT

**Short answer:** on current visible evidence, **nothing material**.

- Copilot PR reviews: if human-maintainer has Copilot Pro personally,
  AceHack gets them free; LFG has Copilot Business (confirmed paid).
  If AceHack is on personal Pro and LFG is on Business, they're
  **both** getting Copilot, just through different billing paths.
- Linux Actions: parity (both free).
- macOS Actions: AceHack accepts the cost (per gate.yml); LFG
  deliberately avoids. **LFG has better cost discipline here.**
- Dependabot security updates: LFG has it enabled; AceHack has it
  disabled (could be enabled free — suggested).
- Secret scanning + push protection: parity.

---

## What LFG gets that AceHack does NOT

- Dependabot security updates (LFG-only, by current config)
- Copilot Business reviewer (confirmed paid, $19/mo for 1 seat; may scale up later)
- Organizational governance (Team plan)
- Operationally-canonical authority (per Amara PR #219 absorb)

---

## Recommendations

### Short-term (this session)

1. **Don't pivot away from LFG for active per-PR work.** Public-repo
   Actions are free; the Copilot Business cost is a flat monthly
   fee, not per-PR. Extra PRs don't increase cost.
2. **Keep the `gate.yml` macOS split.** It works; it's the real
   cost-avoidance layer.
3. **Apply the Amara authority-axis split** (experiments → AceHack,
   decisions → LFG) as the semantic driver — not cost. This
   research doc lives on AceHack per that rule (it's experimental
   measurement tooling).

### Medium-term (BACKLOG candidates)

1. **Parity-audit tool** — shell + `gh api` pulls that emit a
   per-month audit doc like this one, tracking deltas over time.
   S effort. File against AceHack as experimentation.
2. **Elevate `gh auth` with `admin:org`** next time the agent +
   human are together in a synchronous session. Complete the
   billing-side of this audit.
3. **Enable dependabot_security_updates on AceHack** (free,
   increases parity). One-click through repo settings.
4. **Document the LFG baseline $27/mo** ($8 Team + $19 Copilot
   Business × 1 seat) in an ADR so future Otto sessions can
   cost-account with numbers, not speculation. Original draft
   said `$46/mo` based on a pre-correction estimate; Otto-62's
   correction *"i only used one user seat so only 19, maybe
   will update max later"* drops the Copilot Business line by
   ~$19, and the addendum's "Confirmed monthly baseline:
   ~$27/mo" is the canonical figure.

### Long-term (if cost becomes binding)

1. If LFG costs approach the human maintainer's budget ceiling, consider
   Copilot-only-on-AceHack mirror-PR workflow: author on AceHack
   (uses personal Copilot Pro if present), cherry-pick to LFG
   periodically. Preserves decision-canon on LFG while shifting
   review-cost to personal subscription.
2. If Copilot PR reviews stop being useful vs cost, drop Copilot
   Business and rely on Codex (external, chatgpt-codex-connector)
   for PR review. Codex is separate billing (Amara's ChatGPT-based
   subscription). Not comparable.

---

## Attribution

Human maintainer authorized admin:org scope elevation + confirmed
Copilot Business paid on LFG. Otto (loop-agent PM hat, Otto-62)
authored this doc. Amara's authority-axis split (PR #219 absorb)
drove the semantic framing. Otto-61 per-user memory seeded the
observations; this doc is the first in-repo Overlay-A mirror of
that memory's findings. Future-session Otto with admin:org scope
fills in the billing-side unobservables + lands a second-pass
audit as an updated row under `docs/research/`.

---

## Second-pass corrections — Otto-65 real billing data

Human maintainer 2026-04-23 Otto-65 pasted the actual GitHub
billing UI for both accounts (LFG org + AceHack personal).
This addendum supersedes the speculative figures above.

### LFG (Lucent-Financial-Group) — April 2026 actuals

**Subscription:** GitHub Team, $96/yr (= $8/mo) for 2
licenses filled.

**Metered usage:** $43.71 gross, $66.62 included-usage
discount → net $0 billed on Actions for the month. The
billed-flip claim ("gross exposure > discount → billed")
holds **conditional on current org budget settings**: per
"Org budgets" below, all products have `Stop usage: Yes`
at $0 budget except GHAS and Copilot. So in practice the
flip would NOT happen as written — gross-exceeding-
discount triggers the budget hard-stop, not a billed
amount. The text-as-written describes the underlying GitHub
billing semantic (what *would* happen without the budget
rail); the actual operational behaviour is hard-stop.

**Copilot Business:** 1 license × $0.633/day ≈ $19/mo
(billed, not discounted). Per-day reconciles exactly
with Otto-62's $19-for-1-seat figure.

**Top-5 repos this month:**

| Repo | Gross |
|---|---:|
| Zeta | $41.72 |
| lucent-infrastructure | $0.02 |
| lucent-frontend | $0.02 |
| lucent-user-service | $0.02 |
| lucent-api-gateway | $0.02 |

Zeta is the near-total consumer of LFG Actions gross.

**Per-day breakdown (sample):**

- Apr 21: 766 min Linux + 145 min macOS-3-core ($14.22 gross, $0.63 billed from Copilot only)
- Apr 22: 2,133 min Linux + 196 min macOS-3-core ($25.58 gross, $0.63 billed from Copilot only)
- Apr 23: 575 min Linux ($4.08 gross, $0.63 billed from Copilot only)

> **Errata 2026-04-28:** the three sample-day gross
> totals (`$14.22 + $25.58 + $4.08 = $43.88`) exceed the
> declared monthly Actions gross of `$43.71` above by
> `$0.17`. At least one of the per-day sample values is
> rounded against a slightly different daily snapshot
> than the monthly aggregate. The per-day breakdown
> above is preserved verbatim from the original audit
> snapshot for traceability; readers should treat the
> monthly `$43.71` as the canonical figure and the
> per-day samples as illustrative. Reconciling the
> exact per-day → monthly delta requires re-pulling raw
> billing data, which is logged as a follow-up task
> rather than blocking this research-grade absorb.

**Org budgets:** All products have `Stop usage: Yes`
at $0 budget except GHAS and Copilot (which allow
consumption). This is a hard safety rail — if discount
ever fails to cover, the budget stops spend cold.

**Confirmed monthly baseline:** **~$27/mo** =
$8 Team + $19 Copilot Business × 1 seat. Matches
Otto-62 estimate exactly.

### AceHack (personal) — April 2026 actuals

**Subscription:** GitHub Pro, $48/yr (= $4/mo), 3000
Actions min/mo included.

**Metered usage:** $50.45 gross, $51.21 discount → $0
billed for the month.

**Actions minutes used:** 1,773.7 / 3,000 included
(59%). Does NOT count discounted public-repo usage;
this is the AceHack personal quota.

**Top repos this month:**

| Repo | Gross |
|---|---:|
| Zeta | $36.44 |
| Zeta (separate) | $13.77 |
| devcontainer-codespace | varies |

Two "Zeta" entries: the human-maintainer noted *"i think
there was a little acehack before too, you can figure it
out"* — suggests a prior fork / namespace is still
generating billing rows. Archaeology pending.

**Per-day breakdown (sample):**

- Apr 19: 638 min Linux + 215 min macOS-3-core + Codespaces 4-core ($17.36 gross, $0 billed)
- Apr 20: 444 min Linux + 91 min macOS-3-core ($8.32 gross, $0 billed)
- Apr 21: 1,005 min Linux + 250 min macOS-3-core ($21.54 gross, $0 billed)

**AceHack monthly baseline:** **$4/mo Pro** (flat). Plus
whatever exceeds public-repo-discount-covered usage (so
far: $0 billed despite $50+ gross).

### Correction to Otto-61 claim: macOS multiplier cost

Otto-61 memory said macOS runs incur 10x multiplier cost
even on public repos. Actual April 2026 billing data
shows **macOS-3-core at $0.062/min gross**, entirely
covered by the public-repo discount.

**Correction (errata to original draft):** the original
draft of this section claimed `gate.yml` runs macOS only
on AceHack, not LFG. That's incorrect — the LFG per-day
breakdown above shows macOS-3-core minutes on Apr 21
(145 min) and Apr 22 (196 min), and the actual `gate.yml`
matrix runs macOS on both forks. The original
"matrix avoidance" framing was wrong. The cost-discipline
points still hold:

- macOS seats are slower in wall-clock (2-10x slowdown)
  even when cost-discounted — CI feedback latency is
  its own resource.
- Gross exposure stays absorbed by the public-repo
  discount as long as both forks remain public; should
  either fork flip to private OR upstream policy change
  the discount terms, the gross exposure becomes the
  billed cost.

But the stark *"macOS is 10x expensive"* framing was
too strong. Corrected: **macOS is 10x gross but
currently 0x billed on public repos within the
public-repo discount**. The reason to be careful with
macOS minute-counts is latency + future-policy
risk-headroom, not immediate cost.

**Note on "quota" terminology:** earlier draft phrasing
mixed "quota" between two different discount mechanisms
(GitHub's per-account included-minutes pool vs the
public-repo unlimited discount). For public repos the
relevant mechanism is the public-repo discount, not a
quota. Should the public-repo discount terms ever
change OR a fork flip to private, that's where the
billed-cost flip happens — not on a quota threshold per
se. Erratum logged here to avoid future readers being
misled.

### Human maintainer's personal Copilot

Confirmed via the human maintainer's Copilot settings
page: *"You are assigned a seat as part of a GitHub
Copilot Business subscription managed by servicetitan."*
Personal Copilot is ServiceTitan-sponsored (employment
benefit); **separate from LFG's Copilot Business seat**.

Current-month personal premium-request usage: **84%**
of monthly allotment. Approaching cap but not exceeded.
Resets start of next month. This is the number that
generalized to the "Frontier burn-rate UI" Otto-63
directive — adopters on ServiceTitan-sponsored (or
similarly-capped) subscriptions need the cap-awareness
surface.

### Answer to "does AceHack get anything free that would limit LFG?"

**No.** Confirmed empirically:

- AceHack's $50 gross Actions = fully discounted by
  public-repo free tier
- LFG's $43 gross Actions = fully discounted by
  public-repo free tier
- AceHack's Copilot = ServiceTitan-sponsored (free to
  human maintainer) — does NOT cover LFG
- LFG's Copilot Business = paid $19/mo — provides
  Copilot PR reviews on LFG's PRs, which are
  LFG-specific

The two hosts have **parallel, independently-covered
cost structures**. Neither subsidizes the other. Moving
work between them is a purpose decision (Amara
authority-axis) not a cost decision.

### Updated BACKLOG candidates

Retaining Otto-62 candidates + one new:

1. Parity-audit tool — now with real-numbers fidelity from
   the manually-pasted billing UI (Otto-65). The
   `admin:org` scope elevation is still authorized but not
   yet applied via `gh auth refresh`; once it is, the tool
   can pull the same numbers programmatically. The
   addendum's data is from the human maintainer's billing
   UI paste, not scope-elevated agent reads.
2. `admin:org`-scoped Actions-usage-history tool (depends on
   the not-yet-applied scope elevation).
3. Enable dependabot on AceHack (free, increases parity)
4. ADR documenting the confirmed baseline: **LFG $27/mo, AceHack $4/mo flat; both $0 billed beyond baseline under current usage**
5. **NEW: archaeology on the "separate Zeta" in AceHack billing** ($13.77 gross/mo suggests a prior fork still accumulating — could be moribund and should be archived, or could be intentional)

### Updated "Otto-61 claim retractions"

Otto-61 memory's *"AceHack is the poor-man host for per-
PR work"* framing is **refined**, not retracted:

- AceHack is cheaper in absolute terms ($4 vs $27/mo)
- Both currently-$0-billed on Actions via public-repo
  discount
- Work placement remains Amara authority-axis driven,
  not cost-driven
- Budget caps at $0 on both are the safety rail; if
  either tips to billed, the cap stops spend

The Otto-62 final rule **stands as written**:
> per-PR work on whichever substrate matches purpose
> (experiments→AceHack, decisions→LFG), not cost-driven.
