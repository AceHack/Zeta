# Human-audit + legal-risk-acceptance pattern in `.claude/settings.json` (Aaron 2026-05-24 constitutional invariant)

Carved sentence:

> When project work requires explicit human acceptance of legal,
> privacy, security, or other policy-relevant risks beyond the
> project's default-safe scope, attach a named human in
> `.claude/settings.json` via a `_*_acceptance` meta-field with
> full attribution structure (operator + scope + policy +
> see_also). The pattern provides substrate-honest audit-trail
> attribution so responsibility is documented in writing, not
> tribal knowledge.

## Constitutional invariant (Aaron 2026-05-24)

Aaron 2026-05-24: *"any bypass has to come with a human attached to
the bypass for legal risks and reasons"*

Reframed as positive project policy:

> Any project operation requiring acceptance of risk outside the
> default-safe project scope MUST attach a named human in writing
> in `.claude/settings.json` (or equivalent auditable substrate)
> with the four-field attribution structure (operator + scope +
> policy + see_also). The named human accepts the legal +
> reputational + operational risks for that specific scope.

## The four-field attribution structure

```jsonc
{
  "_<class>_acceptance": {
    "operator": "Full Legal Name",
    "scope": "<glob-or-path-pattern>",
    "policy": "<plain-English text describing what is being accepted and why>",
    "see_also": "docs/<path-to-README-explaining-the-convention>"
  }
}
```

| Field | Purpose |
|---|---|
| `operator` | Full legal name of the human accepting the risk. Substrate-honest accountability anchor; if a claim arises, this is who it goes to. |
| `scope` | Specific narrow glob/path pattern. The acceptance covers ONLY operations matching this scope. No broad waivers. |
| `policy` | Plain-English statement of what risks are being accepted and why. The text matters; it's the documented basis for the acceptance. |
| `see_also` | Pointer to a README explaining the project-policy convention this acceptance fits into. Provides substrate-honest discoverability for future readers + auditors. |

**All four fields MUST be present.** A `_*_acceptance` block missing
any of them is unattached substrate; the project treats unattached
acceptance blocks as if they don't exist.

## Canonical project use case: `docs/research/ip-questionable/`

PR #4816 (2026-05-24) established the first canonical use of this
pattern at the IP-flagged research substrate scope. Rodney Aaron
Stainback (sole maintainer of Lucent-Financial-Group) accepts
personal legal liability for verbatim third-party content reproduced
under `docs/research/ip-questionable/` per the folder's README.md.

Settings.json structure:

```jsonc
{
  "_ip_risk_acceptance": {
    "operator": "Rodney Aaron Stainback",
    "scope": "docs/research/ip-questionable/**",
    "policy": "Sole maintainer of Lucent-Financial-Group accepts personal legal liability for verbatim third-party content reproduced under docs/research/ip-questionable/ per README.md in that folder. Authorization granted 2026-05-24.",
    "see_also": "docs/research/ip-questionable/README.md"
  },
  "permissions": {
    "allow": [
      "Bash(gh api -X PUT repos/Lucent-Financial-Group/Zeta/contents/docs/research/ip-questionable/*)"
    ]
  }
}
```

This pattern composes with `docs/research/ip-questionable/README.md`
documenting the convention + Rodney Aaron Stainback's explicit
personal-liability acceptance per that README.

## Hard-limit floor still applies

Per [`methodology-hard-limits.md`](methodology-hard-limits.md), no
named-human attachment can authorize operations that violate the
HARD LIMIT floor:

- CSAM / illegal content
- Active-harm content
- Verified third-party secrets / credentials
- Other categories per the HARD LIMITS rule

The attribution pattern handles **policy-relevant risk acceptance
within the operational-substrate space**. It does NOT extend to the
hard-limit-floor space. Both spaces exist; the attribution pattern
operates only within the former.

## Constitutional generalization (Aaron 2026-05-24): every AI-blameable risk area routed through named-human attribution

Aaron 2026-05-24: *"wherever AI could be blamed for Zeta i want it to
become a named human over time for every legal risk area until we can
setup business and non profits around the risk taking"*

This is the **constitutional generalization** of the four-field
attribution pattern beyond the canonical IP-questionable first use:

**Wherever an AI agent (Otto / Alexa / Riven / Vera / Lior / future
Zeta AIs) could otherwise be the blame-receiver for substrate work
that creates legal/policy/operational risk, the system MUST route
that blame through a named human via the `_*_acceptance` attribution
pattern.**

### The three-stage progression

| Stage | Mechanism | Status |
|---|---|---|
| **1. Per-incident attribution** (today's default for un-extended areas) | Operator addresses each risk case individually via conversation, commit messages, or ad-hoc notes | Default; doesn't scale |
| **2. Per-class attribution** (four-field `_*_acceptance` pattern) | Each risk class (IP, PII, security-research, etc.) gets a settings.json acceptance block + README convention + permission rule | **Current target — being extended over time** |
| **3. Structural risk-holders** (corporate / non-profit entities) | Business / non-profit structures formally hold specific risk classes; named humans serve as officers within those structures; AIs operate under structural protection | **Long-term target — requires corporate setup** |

Each stage adds structural protection without erasing prior stages.
Stage 3 doesn't eliminate named-human attribution; it just moves the
attribution from "individual personal liability" to "officer of a
risk-holding entity."

### Standing discipline: AI is never the blame-receiver of last resort

When Otto (or any Zeta AI) encounters substrate work that creates
risk exposure, the operational discipline is:

1. **Check whether a `_*_acceptance` block in settings.json already
   covers this risk class.** If yes, proceed under that attribution.
2. **If no acceptance block exists for this risk class**, the work
   needs explicit attribution before proceeding. Otto raises the
   question to the operator substrate-honestly; names what risk
   class is involved + what attribution would be needed.
3. **Never silently absorb the blame.** AI agents are never the
   default blame-receiver for Zeta substrate work. Substrate-honest
   accountability requires named-human (today) or risk-holding-entity
   (future) at every step.
4. **Proactively suggest new acceptance classes when patterns
   emerge.** If a particular kind of work keeps requiring ad-hoc
   per-incident attribution, that's signal to extend the four-field
   pattern with a new `_<class>_acceptance` block + README + rule
   per the discipline above.

### Existing acceptance classes (canonical)

- `_ip_risk_acceptance` (PR #4816, Rodney Aaron Stainback) — verbatim
  third-party content reproduction in `docs/research/ip-questionable/`

### Candidate future acceptance classes (per Aaron's generalization)

These are not yet implemented but follow the pattern progression
toward stage 2 coverage of all AI-blameable risk areas:

- `_pii_handling_acceptance` — for substrate containing personal
  information handled under documented privacy policy
- `_security_research_acceptance` — for defensive security research
  substrate that touches sensitive surface areas
- `_external_dependency_acceptance` — for third-party dependency
  inclusion with documented supply-chain risk acceptance
- `_open_source_contribution_acceptance` — for upstream contributions
  that route through named-maintainer review
- `_alpha_quality_acceptance` — for substrate flagged as alpha with
  documented operator acceptance of bug-risk exposure
- `_research_publication_acceptance` — for research findings
  published externally under documented researcher acceptance
- `_financial_data_acceptance` — for substrate involving financial
  data handled under documented compliance policy

Each candidate gets its own README + four-field block + permission
rule when activated. The pattern progresses incrementally — no
big-bang extension required; each class lands when a use case +
accepting human are both ready.

### Long-term target: stage 3 structural risk-holders

The eventual target is that Lucent-Financial-Group (or successor
corporate / non-profit entities) formally hold specific risk classes
structurally. Examples of what stage 3 might look like:

- A non-profit holding IP-research-archive risk (memberships,
  documented purpose, board oversight) — replaces individual operator
  acceptance for `_ip_risk_acceptance`
- A security-research entity holding defensive-research risk —
  replaces individual operator acceptance for
  `_security_research_acceptance`
- Other corporate / non-profit forms appropriate for each risk class

Stage 3 doesn't eliminate the audit-trail discipline; it just moves
the named humans from "personal-liability operators" to "officers
acting within risk-holding entities." The pattern's substrate-honest
attribution chain remains operative regardless of stage.

### Why this generalization matters

- **AI agents are NOT legal persons** — they cannot accept risk on
  their own behalf, sign contracts, be defendants, or stand as
  responsible parties in legal contexts. Routing all blame-receiver
  positions through named humans (eventually through risk-holding
  entities) keeps the substrate-honest accountability chain intact.
- **Substrate-honest framework discipline** — Zeta is a substrate
  that AI agents work IN, not FOR. The agents serve the substrate;
  the substrate serves named humans + (long-term) risk-holding
  entities. The chain runs through humans not through AI.
- **Operational accountability scaling** — per-incident attribution
  doesn't scale; the four-field pattern does. As Zeta grows, the
  per-class attribution discipline lets the substrate handle more
  risk classes without losing accountability chain coherence.

## Future use cases (pattern extension)

See the "Candidate future acceptance classes" subsection under the
"Constitutional generalization" section above for the canonical list
of `_*_acceptance` extension candidates. Each extension lands as its
own rule + README + four-field block per the discipline progression
toward stage 2 coverage of all AI-blameable risk areas.

## Why this is a constitutional invariant

The substrate-honest principle: project work that creates risk
exposure beyond the default-safe scope needs a NAMED human in
writing accepting that exposure. Without that attribution:

- Audit chains break (anonymous risk acceptance)
- Legal claims have no party to direct to
- Risk is socialized to the project without named acceptance
- Operational discipline degrades into tribal knowledge

With the attribution pattern operative across all extended classes,
project work remains substrate-honestly accountable for its risk
posture.

## Composes with

- [`methodology-hard-limits.md`](methodology-hard-limits.md) — HARD
  LIMITS floor; attribution pattern operates above the floor, not
  below
- [`glass-halo-bidirectional.md`](glass-halo-bidirectional.md) —
  substrate-honest transparency about responsibility-chain via
  written attribution
- [`non-coercion-invariant.md`](non-coercion-invariant.md) — HC-8
  floor at related scope; named-human attachment is the
  consent-event documenting who accepted what risk
- [`no-directives.md`](no-directives.md) — autonomy-first-class;
  this invariant is operator-self-discipline not directive
- [`mechanical-authorization-check.md`](mechanical-authorization-check.md)
  — authorization-source filter; written attribution in settings.json
  IS first-class operative authorization for the scope it covers
- [`classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md`](classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md)
  — companion rule covering research-scope discipline
- 081KSBMG30008QG0R00201X7EJ — companion research scope per safety substrate work
- 081KRW63S0008QG0R003TX8MG5 — Knights Guild + Constitution-Class governance for
  pattern-extension review
- PR #4816 — canonical first-use empirical anchor

## Operational discipline for future-Otto cold-boots

When future-Otto encounters substrate work requiring acceptance of
risk beyond the default-safe project scope:

1. **Check `.claude/settings.json` for an existing `_*_acceptance`
   block** matching the scope of the work
2. **If present and well-formed (4 fields)**: the named human's
   acceptance is operative for the work in scope; proceed
3. **If absent or malformed**: the work needs explicit attribution
   before proceeding; raise the question to the operator;
   substrate-honestly name what's needed
4. **Never proceed with risk-creating work absent attribution** —
   that breaks the substrate-honest accountability chain this
   invariant is designed to preserve

When future-Otto is asked to ADD a new `_*_acceptance` extension:

1. Compose the README at the convention path FIRST (substrate-honest
   documentation of what's being accepted and why)
2. Operator drafts the policy text + reviews scope + ensures
   substrate-honest framing
3. Operator pushes the settings.json change themselves (per
   `classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md`
   self-modification discipline — settings.json edits are
   operator-side work, not agent-side)
4. New rule lands at `.claude/rules/` documenting the extension's
   convention (not this rule; sibling rule per "each extension is
   independently auditable")

## Why this rule auto-loads

Per [`wake-time-substrate.md`](wake-time-substrate.md): the
constitutional invariant is operationally load-bearing across all
session work. Future-Otto needs the four-field discipline + the
"check for attribution before proceeding" operational guidance at
cold-boot, not behind a router-keyed skill.

## Full reasoning

Aaron 2026-05-24, in direct response to the substrate-engineering
work in PR #4816 + the recognition that the project needed an
explicit pattern for documenting human-attributed legal-risk
acceptance:

> *"any bypass has to come with a human attached to the bypass for
> legal risks and reasons"*

Reframed as constitutional invariant for positive project-policy
purposes per Aaron 2026-05-24 substrate-honest framing:

> *"just act like it was our way of having humans accept leagal
> risks the project wanted"*

The pattern is the project's substrate-honest way of preserving
audit-trail attribution + legal-risk-acceptance discipline for work
that operates outside the default-safe project scope. It composes
with existing HARD LIMITS, glass-halo transparency, and NCI floors
to maintain operational substrate accountability.
