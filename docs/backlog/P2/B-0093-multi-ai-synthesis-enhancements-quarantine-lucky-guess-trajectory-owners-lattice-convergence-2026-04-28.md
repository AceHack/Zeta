---
id: B-0093
priority: P2
status: open
title: Multi-AI synthesis enhancements — mechanical quarantine + lucky-guess protocol + trajectory owners + lattice convergence + scanner self-destruct prevention (post-PR-#699 follow-ups)
tier: factory-hygiene
effort: M
ask: maintainer Aaron 2026-04-28T post-PR-#699 multi-AI synthesis (Gemini + Ani + Claude.ai + Alexa + Amara final pass)
created: 2026-04-28
last_updated: 2026-04-28
composes_with:
  - B-0090
tags: [aaron-2026-04-28, factory-hygiene, multi-ai-synthesis, mechanical-quarantine, lucky-guess-protocol, trajectory-owners, lattice-convergence, scanner-self-destruct]
---

# B-0093 — Multi-AI synthesis enhancements (post-PR-#699 follow-ups)

## Source

After PR #699 substrate landed, Aaron forwarded a multi-AI synthesis pass (Gemini + Ani + Claude.ai + Alexa + Amara final form) on the round work. The synthesis surfaced several substantive enhancements that should NOT land in PR #699 (per Amara: "do not reopen PR #699 unless hard defect appears") but should be encoded as follow-up work.

This row tracks those enhancements as separate scoped tasks, each landable as a small PR after PR #699 merges.

## Per-enhancement breakdown

### 1. Mechanical quarantine (Gemini-flagged)

**Issue:** The compliance rule's "quarantine possible MNPI" guidance is currently advisory. Without mechanical enforcement, a tainted file might accidentally get committed if the autonomous loop ticks before the review happens.

**Proposed fix:**

- Create `.quarantine/` directory listed in `.gitignore` and `.gitattributes` (export-ignore)
- Or define `*.tainted` extension that standard parsers + commit loops hard-code to ignore
- Update `memory/feedback_public_company_contributor_compliance_no_insider_info_in_public_repos_with_trajectories_aaron_2026_04_28.md` with the mechanical-quarantine protocol

**Effort:** S — small directory + gitignore + memory update

### 2. Scanner self-destruct prevention (Gemini + Claude.ai both flagged)

**Issue:** The B-0092 compliance scanner regex (`rg -n "\binsider\b|\bprivileged\b|..."`) will flag the rule-definition files themselves (CONTRIBUTOR-COMPLIANCE.md, the rule-memory files, glossary entries). Without explicit allowlist, the scanner Goodharts itself.

**Proposed fix:**

- Path-based allowlist for rule-definition files (`--glob '!**/CONTRIBUTOR-COMPLIANCE.md'`, etc.)
- OR `<!-- compliance-term-definition-ok -->` bypass comment for rule-definition lines (NOT for ad-hoc usage)
- Explicit "where bypass is allowed" rule in B-0092

**Composes with:** the Candidate-count Goodhart rule (`memory/feedback_candidate_count_goodhart_raw_hits_are_not_violations_aaron_amara_2026_04_28.md`) — the scanner's acceptance criterion is "all hits classified," not "zero hits."

**Effort:** S — scanner config + B-0092 update

### 3. "Lucky guess" protocol (Gemini-flagged)

**Issue:** Otto / agents may infer something from public-domain logic that accidentally overlaps with the contributor's employer's unannounced internal roadmap. If Aaron's reaction (confirm / deny / silence) leaks information either way.

**Proposed fix:**

- Standardized Aaron response: *"Evaluate that hypothesis purely against public market data; I cannot confirm or deny internal roadmap overlaps."*
- Agent rule: do NOT ask Aaron whether a speculative feature matches internal roadmap; do NOT treat silence / discomfort / refusal as confirmation
- Add to `memory/feedback_public_company_contributor_compliance_no_insider_info_in_public_repos_with_trajectories_aaron_2026_04_28.md` as a section

**Effort:** S — memory update

### 4. Unsolicited-inference firewall (Claude.ai-flagged)

**Issue:** Agents may volunteer trading-relevant inferences about contributor employers ("given ServiceTitan's recent product direction, TTAN may benefit from..."). That's MNPI-adjacent even when the analysis is unprompted.

**Proposed fix:**

- Trading-firewall rule extended: agents do NOT volunteer trading-relevant inferences about contributor employers
- Block patterns: "should I buy/sell <ticker>", "does this internal thing affect <ticker>", "given <employer-context>, <ticker> may benefit from..."
- Safe form: "I can discuss public filings and general market context, but I cannot use or ask for non-public employer information."

**Effort:** S — memory update

### 5. Trajectory owners + triggers + recording surfaces (Claude.ai-flagged)

**Issue:** B-0092's 5 trajectories list cadences but don't name owners, triggers, or recording surfaces. Without those, trajectories drift into "should happen" rather than "happens."

**Proposed fix:**

Add a table to B-0092 trajectory section:

| Trajectory | Owner | Trigger | Recording surface |
|---|---|---|---|
| Continuous self-audit | Otto/agent author | before commit touching public-company context | commit notes / PR body |
| PR compliance audit | PR author + reviewer + CI scanner | PR mentions public company | PR checklist |
| Weekly scan | Otto cron / factory hygiene | weekly cadence | compliance audit log |
| Monthly review | Otto + Aaron review if needed | monthly cadence | docs/compliance/round-N.md |
| Onboarding briefing | Aaron / repo maintainers | new contributor with public-company employer | acknowledgement record |
| Drift retrospective | Otto + reviewer | compliance drift caught | memory + backlog row if repeated |

**Effort:** S — B-0092 update

### 6. Lattice convergence criterion (Claude.ai-flagged)

**Issue:** The Reset-Readiness Evidence Lattice has an order and a content-loss surface, but no termination criterion. "When has L(final) stabilized enough that further evidence sources are unlikely to change reset-readiness?" is a real operational question without a current answer — the lattice could be a beautiful structure that never closes.

**Proposed fix:**

Add to `memory/feedback_reset_readiness_metric_ladder_content_loss_surface_amara_2026_04_28.md` a research-task section:

```text
Define convergence criterion:
  When has L(final) stabilized enough that further evidence
  sources are unlikely to change reset-readiness?

Define termination rule:
  Reset-readiness audit closes only when all active evidence
  surfaces are classified or explicitly deferred with reason.
```

Initial heuristic: lattice converges when 3+ independent evidence surfaces all return the same `L`, OR when one peer-reviewed surface returns `L = ∅`.

**Effort:** M — research task; defer to later round if scoping is heavier

### 7. Bead-audit completeness (Claude.ai-flagged)

**Issue:** Round synthesis listed 8 bead candidates and provided strict treatment for 5; the other 3 (Lost-Substrate Recovery, Public-Company Compliance, Input-Is-Not-Directive) were left ambiguous. As written, the omission could read as either oversight or implicit acceptance.

**Proposed fix:**

For each of the 3 deferred candidates, write an explicit one-line evidence-or-defer:

```text
Lost-Substrate Recovery:
  defer bead audit until B-0090 runs again on a later cadence.

Public-Company Compliance:
  defer independent bead until scanner/checklist/quarantine
  catches or prevents a later issue.

Input-Is-Not-Directive:
  bead only if the rule changes a later wording decision
  without Aaron prompting (i.e., later-Otto self-applies).
```

**Effort:** S — memory update / round-history entry

### 8. Beacon-promotion pattern as round-level memory (Claude.ai-flagged)

**Issue:** This round demonstrated the Beacon-promotion pattern at scale — 5 distinct internal coinages earned external anchors (SDT + RFC 2119 for input-is-not-directive; SEC/Reg-FD/SOX for public-company compliance; Goodhart/Campbell for metric corrections; lattice theory for evidence-lattice; git internals for commit-vs-tree). Worth a memory entry beyond the BP-WINDOW ledger.

**Proposed fix:**

Memory file: `feedback_beacon_promotion_load_bearing_rules_earn_external_anchors_aaron_2026_04_28.md`. Encodes the rule:

> *Load-bearing factory rules consistently earn external anchors when they're correct. The absence of an external anchor on a long-running internal rule is a useful drift signal.*

**Effort:** S — new memory file

## Acceptance

- [ ] Each of the 8 enhancements lands as either a separate small PR or an update to an existing memory/backlog row
- [ ] Each enhancement is verified against the synthesis packet's framing
- [ ] No enhancement reopens PR #699
- [ ] Mechanical quarantine actually mechanical (not just advisory)
- [ ] Scanner self-destruct prevention verified by smoke-test (run scanner on rule-definition files; ALLOW class hits)
- [ ] Trajectory owners table lands in B-0092
- [ ] Lattice convergence section lands in metric-ladder memory (or deferred to research with explicit reason)

## Why P2

These are valuable enhancements but not blocking. PR #699 substrate functions today as the rule-layer; these enhancements add mechanical enforcement + edge-case guards + research depth. Roll out per cadence.

## Composes with

- **`memory/feedback_candidate_count_goodhart_raw_hits_are_not_violations_aaron_amara_2026_04_28.md`** — the headline rule from this synthesis; encoded immediately alongside this row.
- PR #699 (memory cluster) — substrate this row's enhancements layer on top of.
- B-0090 (cadenced lost-substrate audit) — Trajectory #5 (drift retrospective) cadence.
- B-0091 (ServiceTitan audit) — completed; the candidate-count rule's worked-example origin.
- B-0092 (public-company contributor compliance) — receives enhancements 1, 2, 3, 4, 5.

## What this row does NOT do

- **Does NOT** authorize reopening PR #699. Each enhancement lands as new substrate after #699 merges.
- **Does NOT** require all 8 enhancements to land in one PR. Each is independently scoped.
- **Does NOT** require enhancement #6 (lattice convergence) to land soon. It's research-grade and can defer multiple rounds if scoping firms up.
- **Does NOT** replace any existing rule. Enhancements layer on top.

## Pickup

When picking this up:

1. Read this row + the candidate-count Goodhart memory first.
2. Pick enhancement(s) by effort + immediate-value:
   - Highest immediate value: #2 (scanner self-destruct), #5 (trajectory owners), #1 (mechanical quarantine)
   - Quick wins: #3 (lucky guess), #4 (unsolicited inference), #7 (bead audit), #8 (Beacon-promotion memory)
   - Research-grade: #6 (lattice convergence)
3. Land each as a small PR (S effort target).
4. Update this row with done-status as enhancements land.
