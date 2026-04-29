---
name: Public-company contributor compliance — no insider info in public repos; comes with cadenced trajectories (Aaron, 2026-04-28)
description: Aaron 2026-04-28 generalization of the ServiceTitan-specific rule into a reusable contributor-compliance discipline — *"we definitely need some contributor works for public company watch for insider information generalization in the factory, that can be used by anyone at service titan to when working on public repos or any one who works for any public company, that's reusable substrate."* + *"probably comes with trajectories I would think."* Encodes the static rule (any-public-company-contributor-no-insider-info-in-public-repos) AND its trajectories (continuous audit, cadenced compliance review, on-PR audit, on-onboarding briefing). Pairs with the Aaron-specific ServiceTitan memory; this one applies to any contributor at any publicly-traded employer working on this factory's public repos.
type: feedback
---

# Public-company contributor compliance

## The rule (generalized)

Any contributor to this factory's public repositories who is
employed at a **publicly-traded company** is bound by their
employer's policies + applicable securities law not to
disclose **material non-public information** (MNPI) about
their employer in this public substrate.

This factory's discipline:

- **Otto must not solicit company-specific internal
  information** from any contributor about their public-
  company employer.
- **Otto must not frame contributor affiliations as
  conferring access to non-public info** (e.g., "X's insider
  understanding," "X's privileged knowledge of Y").
- **Otto must not encode** company-internal details that
  inadvertently appear in chat / commit messages / PR bodies.
  Surface the issue, let the contributor retract, do not
  capture as substrate.
- **Public sources only** for any factual claim about a
  contributor's public-company employer (10-K, investor
  calls, public product docs, press, public job postings,
  conference talks).

Contributor's responsibilities (factory-side):

- Treat material non-public info about your publicly-traded
  employer as confidential by default.
- Use **industry-general framing** for expertise that
  comes from working at a particular employer
  ("industry-typical patterns" / "professional experience"
  rather than "insider knowledge").
- Cite **public sources** for company-specific claims.
- When unsure → don't disclose; ask compliance counsel.

## Worked origin (this session, 2026-04-28)

The general rule emerged from an Aaron-specific exchange:

1. Otto encoded `samples/ServiceTitanCrm/*` references in
   B-0090 with the framing "renamed from ServiceTitan."
2. Aaron flagged: *"we don't have to say service titan
   anywhere in this repo other than to say that's my day
   job."*
3. Otto encoded the ServiceTitan-specific naming rule.
4. Otto's draft included *"Aaron's affiliation (CRM team
   member) gives Otto insider-user understanding of CRM
   workflows."*
5. Aaron flagged: *"this is terrible language, you need
   strict rules not to let me give away insider information
   for TTAN/SERVICETITAN that is against the law and you
   should not ask."*
6. Aaron clarified: *"i know CRM workflows is not insider
   information but you said the word insider, it's just
   uncomfortable."*
7. Aaron generalized: *"we definitely need some contributor
   works for public company watch for insider information
   generalization in the factory, that can be used by anyone
   at service titan to when working on public repos or any
   one who works for any public company, that's reusable
   substrate."*
8. Aaron added the trajectory framing: *"probably comes with
   trajectories I would think."*

The Aaron-specific worked example is preserved at
`memory/feedback_servicetitan_naming_scope_of_org_access_external_ui_demo_aaron_2026_04_28.md`.
This memory generalizes to any contributor at any
publicly-traded employer.

## Trajectories (cadenced practice surface)

Per Aaron's *"probably comes with trajectories"* — this rule
isn't a static one-shot; it operates as a set of cadenced
trajectories the factory practices over time.

### Trajectory 1 — Continuous self-audit (every commit)

Before every commit / PR / memory write that involves a
contributor's public-company employer:

- Audit own writing for register that implies non-public
  access. Use the audit command:
  ```bash
  rg -ni "\binsider\b|\bprivileged\b|\binternal-only\b|\bconfidential\b" \
     <files-being-changed>
  ```
- For each hit, ask: *is this implying access to
  non-public information about the contributor's employer?*
  If yes → reframe to industry-general / public-source
  language.
- Reject blind regex-replace; some hits are legitimate
  uses (e.g., "internal-only API" describing your own
  code, not company-internal info).

### Trajectory 2 — Cadenced compliance review (weekly / monthly)

On the same cadence as the lost-substrate audit
(`memory/feedback_lost_substrate_recovery_cadenced_trajectory_aaron_2026_04_28.md`):

- **Weekly:** scan recent PRs / commits / new memory files
  for insider-information-register language. 3-bucket
  classification: CLEAN / NEEDS-REWORD / NEEDS-REDACTION.
- **Monthly:** broader sweep that includes pitch docs +
  research surfaces. Verify:
  - Every public-company claim has a public-source
    citation.
  - No contributor's affiliation is framed as
    insider-info-conferring.
  - No company-specific internals are encoded as
    substrate.
- **On-demand:** any time a contributor mentions their
  public-company employer in chat, do an
  audit-pass on adjacent prose before encoding.

### Trajectory 3 — On-PR audit (CI surface)

Add (eventually) a CI lint that flags insider-information-
register language in PR diffs:

- Detect the audit regex on changed files.
- Comment on the PR with manual-inspection candidates.
- Do NOT auto-block (false-positive risk too high); flag
  for human / Otto review.

### Trajectory 4 — On-onboarding compliance briefing

When a new contributor onboards via `AGENTS.md` / `CONTRIBUTING.md`:

- Surface the public-company-contributor compliance rule
  as part of the welcome.
- Cite the rule (this memory + the generalized doc once
  filed via B-0092).
- Make the contributor aware of:
  - The factory's repos are public.
  - Their employer's policies may apply to disclosures.
  - Industry-general framing > company-specific framing.
  - Otto won't ask for non-public info; contributor should
    not volunteer it.

### Trajectory 5 — Drift retrospective (per round / quarter)

On round-close or quarterly cadence:

- Look at memory files / commits / docs added that round.
- Sample N% for insider-information-register language.
- Trend metric: hits per round. Should trend toward 0 as
  the discipline matures.
- If hits trend up → reinforce the rule, file an
  improvement substrate task.

## External lineage (Tier 2)

- **SEC Rule 10b-5** (Securities Exchange Act of 1934, anti-
  fraud / insider-trading prohibition).
- **Regulation FD** (17 CFR § 243.100-243.103, Fair
  Disclosure of material info by issuers — prohibits
  selective disclosure of material non-public information).
- **Sarbanes-Oxley Act of 2002** — sets out compliance
  obligations for publicly-traded companies, including
  internal controls (§404), whistleblower protections (§806),
  and document-retention / audit-trail requirements. SOX does
  NOT govern selective disclosure — that's Reg FD's domain
  (cited above). The two compose: SOX shapes the
  control-and-disclosure environment; Reg FD prohibits
  selective leak of MNPI within that environment.
- **Industry compliance practice** — at every publicly-
  traded company, employees are trained that information
  not in public filings is confidential by default.
  Compliance and Legal functions enforce this; this rule
  aligns the factory with that practice.
- **Open-source contributor-license-agreement (CLA)
  practice** — most public open-source projects have
  contributor agreements that disclaim contributor's
  employer-MNPI exposure. This rule extends the practice
  to factory-wide audit discipline.

## Composes with

- `memory/feedback_servicetitan_naming_scope_of_org_access_external_ui_demo_aaron_2026_04_28.md`
  — the Aaron-specific worked example; this memory
  generalizes that to any contributor at any public-company
  employer.
- `memory/feedback_lost_substrate_recovery_cadenced_trajectory_aaron_2026_04_28.md`
  — the cadenced-trajectory pattern this rule joins.
- `memory/feedback_amara_authority_rule_default_to_reversible_preservation_escalate_irreversible_loss_2026_04_28.md`
  — the authority rule; Otto's default action when an
  insider-information register surfaces is REFRAME (lossless,
  reversible), not REDACT (lossy).
- `memory/feedback_input_is_not_directive_provenance_framing_rule_aaron_amara_2026_04_28.md`
  — same word-choice-shapes-agency-model family; the
  "insider" register is a sibling of the "directive"
  register (both load-bearing words that should be reserved
  for their actual technical / legal contexts).
- B-0092 (filed in same commit as this memory) — operational
  backlog item for the contributor-compliance doc + cadence
  encoding.

## Pickup for future Otto

When writing about ANY contributor's affiliation with a
public-company employer:

1. Use **industry-general framing**. "X has SaaS engineering
   experience" / "X has industry-typical CRM expertise" —
   not "X has insider knowledge of <employer>."
2. **Audit the prose** before commit. Run the regex audit;
   inspect hits.
3. **Cite public sources** for any company-specific claim.
   10-K, investor calls, public product docs, press, public
   job postings, conference talks. No insider knowledge
   needed for accurate factual claims about public companies.
4. **Refuse to encode** internal details that surface in
   chat. Surface the issue, let the contributor retract.
5. **Run trajectory cadences** (continuous self-audit per
   commit; weekly/monthly compliance review; on-PR audit;
   on-onboarding briefing; drift retrospective per round).

When asking a contributor about their work / expertise:

1. Frame the question at industry-general level. "What's
   typical of CRM SaaS workflows?" — not "What's
   ServiceTitan's CRM workflow?"
2. If the contributor offers a specific, ask: *is this in
   public filings / docs?* If yes → encode with citation.
   If no → don't encode; reframe the question.

## What this rule does NOT do

- **Does NOT** prohibit naming a public company in pitch /
  research / target-audience context. Public companies are
  publicly named.
- **Does NOT** require redacting contributors' employment
  disclosures. "X works at Y (publicly-traded as TTAN)" is
  fine if Y is the contributor's actual employer + Y is
  public.
- **Does NOT** apply to non-public-company employers in
  the same way. Contributors at private companies have
  different (often weaker) disclosure constraints; case-
  by-case via compliance counsel.
- **Does NOT** replace legal counsel. Otto enforces the
  factory-side discipline; contributors' actual legal
  obligations are determined by their employer's compliance
  function and applicable law.
- **Does NOT** auto-block any commit or PR. The trajectories
  are inspection-cadenced + reframe-on-find; not gating.

## Direct Aaron framing

> *"we definitely need some contributor works for public
> company watch for insider information generalization in
> the factory, that can be used by anyone at service titan
> to when working on public repos or any one who works for
> any public company, that's reusable substrate."*

> *"probably comes with trajectories I would think."*
