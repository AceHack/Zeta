---
name: Frontier burn-rate UI — first-class git-native cost/usage dashboard is important for adopters on private repos (ServiceTitan and many others); consider exposing in demos; Aaron's personal Copilot is ServiceTitan-sponsored at 84% monthly premium-request usage
description: Aaron 2026-04-23 Otto-63 — *"service titan uses private repos and so do many pepole so having burn rate as part of frontier ux/ui that gitnative ui will be important, and maybe in demos?"* + shared his personal GitHub Copilot page showing ServiceTitan-sponsored Copilot Business seat at 84% monthly premium-request usage. Generalizes the cost-awareness concern from per-session to adopter-UX: public repos get unlimited Linux Actions, but private repos (the common case) burn the 2000-min/mo free quota. Frontier should surface burn rate as a first-class git-native UI element, possibly demo material. Also clarifies LFG Copilot seat vs. Aaron's personal Copilot (separate billing paths).
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Frontier burn-rate UI — first-class git-native cost dashboard

## Verbatim (2026-04-23 Otto-63)

> service titan uses private repos and so do many pepole
> so having burn rate as part of frontier ux/ui that
> gitnative ui will be important, and maybe in demos?

Plus Aaron pasted his personal GitHub Copilot settings
page showing:

- **"GitHub Copilot Business is active for your account…
  You are assigned a seat as part of a GitHub Copilot
  Business subscription managed by servicetitan."**
- **Premium requests: 84.0%** (monthly, resets at start
  of next month)
- Wide AI model access (Claude 4.x, Gemini 2.5/3.x,
  GPT-5.x-Codex / 5.4 / 5.2), with some blocked by
  ServiceTitan policy (web search; Grok Code Fast 1;
  Opus 4.7)
- Features enabled: Copilot code review, Copilot cloud
  agent, Copilot Memory Preview, MCP servers

## The claim — burn-rate is adopter-UX, not just internal cost-tracking

**Generalization:** the cost-constraint isn't specific to
Zeta. Any adopter on private repos faces the 2000-min/mo
GitHub Actions free-tier cap. ServiceTitan and "many
others" work primarily on private repos. A git-native
factory that ignores burn-rate is invisible-broken for
that class of adopters.

**Implication for Frontier UX:**

- **Burn-rate as first-class UI element** — not buried in
  billing pages; surfaced in the factory's default
  operational views
- **Git-native dashboard** — consumed from `gh api`
  + local git state, not dependent on any specific host
  (though GitHub is first host per Otto-54 positioning)
- **Consider in demos** — adopters evaluating Frontier
  should see cost-awareness as a differentiator; Aaron's
  *"maybe in demos?"* names this explicitly

## Copilot billing clarification (from the shared page)

**Two separate Copilot paths:**

1. **Aaron's personal Copilot** — provided by
   **ServiceTitan Business** subscription as part of his
   employment. Free to Aaron personally; models + features
   governed by ServiceTitan's org policy. Currently at
   **84% premium-request usage** for the month.

2. **LFG's Copilot Business** — **separate seat**, paid
   by Aaron (~$19/mo for 1 seat per Otto-62 memory). This
   is the seat providing Copilot PR review on LFG's PRs
   (the `copilot-pull-request-reviewer` I've been
   interacting with).

These are **distinct billing paths**. Running out of one
doesn't affect the other. Aaron's personal work (potential
AceHack PR reviews, coding assistance) uses the
ServiceTitan seat; LFG's org-level reviewer uses the LFG
Copilot Business seat.

## 84% premium-request observation

Aaron shared the usage percentage mid-month. This is
real-time burn awareness in action — the exact kind of
surface Frontier adopters need. A burn-rate UI ideally:

- Shows current-month usage as a percentage (like GitHub
  does)
- Projects end-of-month trajectory based on burn rate
- Flags when trajectory exceeds 100% (would exhaust
  quota before reset)
- Separates per-surface burn (Actions minutes vs. Copilot
  premium requests vs. other quotas)
- Integrates with the factory's git-hotspots audit so
  high-churn files correlate with high-burn workflows

## How this composes with existing substrate

- `project_factory_is_git_native_github_first_host_hygiene_
  cadences_for_frictionless_operation_2026_04_23.md` —
  burn-rate UI is the concrete Frontier implementation
  of the git-native-first-host positioning. Cost-awareness
  is part of frictionless operation.
- `feedback_lfg_free_actions_credits_limited_acehack_is_
  poor_man_host_big_batches_to_lfg_not_one_for_one_
  2026_04_23.md` — session-level cost awareness; this
  extends to adopter-level.
- `project_frontier_ux_zora_star_trek_computer_with_
  personality_research_ux_evolution_backlog_2026_04_24.md`
  — Frontier UX roadmap. Burn-rate dashboard is a
  concrete UI element within the Zora-style substrate-
  visibility pattern.
- `feedback_servicetitan_demo_sells_software_factory_not_
  zeta_database_2026_04_23.md` — demo discipline. If
  burn-rate is in demos, it demonstrates the factory's
  ops-awareness not Zeta's algebra.
- Otto-62 cost-parity audit (PR #11 on AceHack) —
  first-pass cost findings; burn-rate UI operationalizes
  per-adopter.

## BACKLOG candidate (to be filed)

**Title:** Frontier burn-rate UI — git-native cost
dashboard as first-class feature

**Scope:**

1. Research doc comparing burn-surface primitives (GitHub
   Actions minutes, Copilot premium requests, artifact
   storage, large-runner tiers, Advanced Security paid
   features)
2. Prototype dashboard — pulls `gh api` billing (when
   admin:org scope granted) + falls back to observable
   data (workflow-run counts, duration estimates) when
   scope absent
3. Integration with Frontier UX roadmap
4. Optional demo path — what adopters see during
   evaluation
5. Cadence — daily / per-tick / per-session

**Effort:** M-L (research + prototype + Frontier integration
+ demo framing)

**Owner:** Dejan (DevOps / git-surface) drives prototype;
Iris (UX) + Kai (positioning) own the Frontier integration
+ demo framing; Kenji synthesizes.

**File against:** AceHack initially (experimentation-frontier
per Amara authority-axis); graduates to LFG via batch when
validated.

## What this directive is NOT

- **Not immediate execution.** BACKLOG row to be filed;
  research + prototype are multi-round.
- **Not a commitment to expose in demos uncritically.**
  Aaron's *"maybe in demos?"* is exploratory. Demo
  inclusion requires adopter-value analysis (is burn-rate
  compelling vs. distracting for the demo narrative?).
- **Not an authorization to scrape competitor usage
  data.** The dashboard pulls the adopter's own
  `gh api` / billing data only.
- **Not a replacement for adopter-provided cost
  management.** Adopters still pay their own bills; the
  UI surfaces awareness, not magic cost-reduction.
- **Not scoped to GitHub-only hosts.** Git-native-first-
  host positioning means the dashboard design should
  handle GitLab / Gitea / other hosts via adapter
  pattern when they get populated.

## Attribution

Human maintainer named the directive + shared personal
Copilot page as concrete data. Otto (loop-agent PM hat,
Otto-63) absorbed + filed this memory. BACKLOG row
queued for next AceHack PR. ServiceTitan's Copilot
Business sponsorship for Aaron personally is not factory
substrate — it is employment benefit; the memory
preserves the distinction so future-session Otto doesn't
conflate Aaron's personal Copilot with LFG's seat.
