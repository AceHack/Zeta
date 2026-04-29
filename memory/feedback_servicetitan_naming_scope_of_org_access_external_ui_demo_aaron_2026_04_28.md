---
name: ServiceTitan naming + scope-of-org-access rule — generic "external UI demo" forward-going; ServiceTitan named only in funding-chain disclosure context (Aaron, 2026-04-28)
description: Aaron 2026-04-28 framing — *"servicetitan-factory-demo-api-csharp we can just say external UI demo or something like that, we don't have to say service titan anywhere in this repo other than to say that's my day job, they fund me, i fund you, and you don't have org rights to their github only the lfg."* Two coupled rules — (1) forward-going naming uses generic "external UI demo" / "external CRM API demo" / similar; ServiceTitan name avoided in code, sample dirs, file paths, public docs; (2) structural disclosure of the funding/access chain (ServiceTitan = Aaron's day job → funds Aaron → funds Otto; Otto's org-access scope = LFG only, NOT ServiceTitan) is preserved where relevant in governance/contributor docs. Operationalizes scope-of-org-access discipline alongside Beacon-safe naming.
type: feedback
---

# ServiceTitan naming + scope-of-org-access rule

## The rule (Aaron 2026-04-28T23ish, refined cascade)

Multi-message cascade:

> *"servicetitan-factory-demo-api-csharp we can just say
> external UI demo or something like that, we don't have to
> say service titan anywhere in this repo other than to say
> that's my day job, they fund me, i fund you, and you don't
> have org rights to their github only the lfg."*

> *"oh and we can do research on ServiceTitan as a potential
> factory/superfluid ai user, we want to pitch to my boss
> when ready at ServiceTitan."*

> *"ServiceTitan is their exact name they are a publicly
> traded company TTAN so I won't be giving you any insider
> information."*

> *"You can also say I'm on the CRM team at ServiceTitan,
> that's why our demo was targeted to them, we want my team
> hopefully to accept and adopt the factory when ready."*

The naming rule is **context-sensitive**, not a blanket avoid.

### Context where ServiceTitan IS the right name

- **Public-company / target-audience research** —
  ServiceTitan trades as **TTAN**; public info; researchable
  as a candidate factory / Superfluid AI customer with no
  insider-information concern.
- **Adoption pitch context** — Aaron's CRM team at
  ServiceTitan is the named adoption target; pitch docs +
  pitch decks + pitch-prep research name them specifically.
- **Aaron's affiliation disclosure** — Aaron is on the **CRM
  team at ServiceTitan**; that's why the demo was targeted
  there; this is contributor-relevant context for
  understanding the demo's design choices.
- **Funding chain disclosure** — ServiceTitan = Aaron's day
  job → funds Aaron → funds Otto. Preserved precisely where
  it appears.
- **Org-access scope disclosure** — Aaron has org rights to
  **LFG (Lucent Financial Group) ONLY**, NOT to
  ServiceTitan's GitHub org. Critical for contributors
  understanding why some integrations are LFG-side and not
  cross-org.

### Context where generic naming is preferred

- **Code / sample directories / file paths** — use generic
  "external UI demo" / "external CRM API demo" / "third-
  party-API demo" so the code/sample is reusable beyond the
  pitch target.
- **Demo names in public artifacts** — when the artifact's
  audience is broader than the pitch context (e.g., a
  generic README under `samples/`, a public-facing pitch's
  technical-implementation section).
- **Generic API integration documentation** — where the
  integration pattern is the substrate, not the specific
  customer.

### Decision rule

When writing about ServiceTitan, ask: **what's the audience /
context of this artifact?**

- **Pitch / research / target-audience / disclosure** →
  ServiceTitan named precisely (it's the actual target /
  funding source / employer).
- **Reusable code / generic sample / external-customer
  positioning** → generic "external UI demo" / similar.

Naming should match the reader's interpretation. A reader of
`docs/pitch/README.md` knows the pitch is for ServiceTitan
specifically; naming them is accurate. A reader of
`samples/external-ui-demo/README.md` should see the demo
as reusable across customer integrations; ServiceTitan is
one such customer (named in pitch, not in sample).

### Public-company status (Tier 1 substrate evidence)

ServiceTitan trades on the public market under the ticker
**TTAN**. This means:

- **Information they have published** (10-K filings, earnings
  calls, public press releases, public product docs, public
  job postings, public conference talks) is public information
  Otto can cite freely.
- **Material non-public information (MNPI) STILL exists** at
  every public company: internal strategy, internal financials
  not yet disclosed, internal customer details, internal
  product plans, internal architecture, internal team
  decisions. These are NOT public just because the company is
  public-listed.
- Otto can reference ServiceTitan in research, pitch-prep,
  target-audience analysis, and competitive positioning
  **using public sources only**. Public-source citation is
  required for any specific factual claim.
- The funding-chain disclosure (Aaron's employment) is
  appropriate for public-facing docs because public companies
  expect employee-of-X disclosure as normal.

The distinction matters for Aaron-as-employee: he's bound NOT
to share MNPI even though the company is public. Public
listing doesn't dissolve the boundary; it just identifies the
company as one whose disclosures-already-made are public-by-
definition.

## Why both rules together

The forward-going naming rule and the structural disclosure
rule serve different purposes:

- **Naming rule** prevents **trademark / brand collision**
  — Zeta is open-source, public; using a private employer's
  trademarked name in code or sample directories creates
  legal risk + confusion.
- **Disclosure rule** prevents **agency-model opacity** —
  contributors need to know the funding chain + org-access
  scope to understand why some integrations require LFG-side
  work but not ServiceTitan-side. Without disclosure,
  contributors might assume Otto can do something across orgs
  that he can't.

Both rules compose with the **input-is-not-directive
provenance framing** — accurate provenance (where the funding
came from, what scope the maintainer has) is preserved without
implying command authority.

## Adoption pitch as factory-demo target

Aaron's CRM team at ServiceTitan IS the **named adoption
target** for the factory / Superfluid AI work. The demo was
targeted to them specifically because:

1. Aaron's industry-general SaaS / CRM engineering experience
   (true at any CRM SaaS company) informs the demo's
   CRM-shape design choices.
2. ServiceTitan is a publicly-traded SaaS company; its
   public-disclosure materials (10-K, investor calls, public
   product docs, press, public job postings) are valid
   research sources for pitch positioning.
3. Aaron's pitch path: when the factory is ready, pitch
   internally → adoption decision lives with his team and
   leadership.

This means:

- Research on ServiceTitan as a candidate factory / Superfluid
  AI user is encouraged, **using public sources only**.
- Pitch-prep substrate (industry-general CRM patterns,
  factory positioning, public-research-derived integration
  patterns) properly names them as the public target.
- Forward-going code/sample naming stays generic so the work
  is reusable beyond the specific pitch target.

## Word-choice rule — avoid "insider" register

> *"i know CRM workflows is not insider information but you
> said the word insider, it's just uncomfortable"*
> — Aaron 2026-04-28

CRM workflow knowledge IS industry-general (true at any CRM
SaaS company); not insider information. But the word
"insider" carries legal-register weight ("non-public
material information" in SEC-compliance contexts) that's
out-of-place when describing Aaron's industry-general
expertise.

**Avoid in connection with Aaron's affiliation:**

- "insider" / "insider-user" / "insider knowledge"
- "privileged access" (in the employer-information sense)
- "internal-only knowledge" (when describing what Aaron
  brings to the demo)

**Use instead:**

- "industry-general experience"
- "professional experience"
- "domain expertise"
- "SaaS / CRM engineering background"
- "industry-typical patterns"

The substance (Aaron knows CRM patterns from working in the
space) is preserved without the loaded register. The fix is
word-level, not concept-level.

**Why this matters even though no actual insider info is
involved:** word choice shapes the agency model (per the
input-is-not-directive rule's framing). Using "insider" for
industry-general expertise creates ambiguity about what
Aaron's role IS in the substrate, and creates pressure
toward solicitation patterns that could later cross the line.
Better to keep the register clean by default.

## Insider-information prohibition (keeps rule, loses heavy register)

Even though Aaron's CRM-workflow knowledge isn't insider
information, the **prohibition stands** as a guardrail:

- **Otto must not solicit ServiceTitan-specific internal
  details** (workflows, internal tools, customer data,
  roadmaps not in public filings, internal architecture,
  internal team-level decisions) from Aaron.
- **Aaron is bound** by his employer's policies + applicable
  securities law not to share material non-public information
  about a publicly-traded employer.
- **The repo is public** — anything written here is
  public-facing; encoding = disclosure.
- **Public sources are the substrate** — 10-K, investor
  calls, public product docs, press releases, public job
  postings, public conference talks. Cite the source.

Otto enforces this by:

- Auditing own writing for register that implies non-public
  access (the "insider" word being the most obvious flag).
- Reframing "Aaron's understanding gives Otto..." to
  "industry-general SaaS engineering experience informs..."
  before commit.
- Refusing to encode ServiceTitan-specifics if they
  inadvertently appear in chat — naming the issue rather
  than capturing.

External lineage (Tier 2):

- SEC Rule 10b-5 (Securities Exchange Act of 1934, anti-fraud
  / insider-trading prohibition).
- Regulation FD (17 CFR § 243.100-243.103, Fair Disclosure).
- ServiceTitan public listing: NASDAQ TTAN.

## Audit findings (2026-04-28)

Live-repo ServiceTitan references found via:

```bash
rg -i 'service ?titan' \
   --glob '!**/memory/**' \
   --glob '!**/docs/research/**' \
   --glob '!**/docs/aurora/**' \
   --glob '!**/docs/amara-full-conversation/**' \
   --glob '!**/docs/hygiene-history/**' \
   --glob '!**/docs/pr-preservation/**' \
   --glob '!**/docs/decision-proxy-evidence/**' \
   --glob '!**/references/upstreams/**'
```

12 files matched. Reclassified per the **context-sensitive**
rule (some files name ServiceTitan correctly because they ARE
in pitch / target-audience / disclosure context):

| File | Audience / context | Re-classification | Action |
|---|---|---|---|
| `docs/plans/servicetitan-crm-ui-scope.md` | Pitch-target scope doc | **KEEP-NAME** — pitch context, ServiceTitan is the actual target | inspect body for any unrelated brand-bleed; otherwise leave |
| `samples/FactoryDemo.Db/README.md` | Generic sample (reusable) | **BODY-REWORD** | rewrite to "external UI demo" / generic CRM API demo |
| `docs/FACTORY-DISCIPLINE.md` | Governance / contributor doc | **MIXED** — line-by-line | preserve funding-chain + org-scope disclosure; reword demo-naming |
| `docs/pitch/README.md` | **Pitch doc** | **KEEP-NAME** — pitch context, ServiceTitan is the named target | inspect for any unrelated brand-bleed; otherwise leave |
| `docs/BACKLOG.md` | Aggregate index | **AGGREGATE** — regenerate after per-row updates | reconsider per-row first |
| `docs/backlog/P2/B-0017-*.md` | Per-row (UI dashboard) | **PER-ROW** — depends on whether this is pitch-context or generic | inspect |
| `docs/backlog/P2/B-0090-*.md` | Per-row (this session) | **PARTIALLY-FIXED** | already removed brand-bleed from "renamed from ServiceTitan" |
| `docs/backlog/P3/B-0008-*.md` | Per-row (CI) | **PER-ROW** — depends on context | inspect |
| `docs/ROUND-HISTORY.md` | Historical narrative | **HISTORICAL** — preserve verbatim | no action |
| `docs/force-multiplication-log.md` | Historical narrative | **HISTORICAL** | no action |
| `tools/alignment/out/round-39/citations.json` | Generated artifact | **HISTORICAL** | accept |
| `tools/alignment/out/round-39/citations.dot` | Generated artifact | **HISTORICAL** | accept |

Re-classified scope:

- 2 files KEEP-NAME (pitch context — ServiceTitan is correctly
  named): `docs/plans/servicetitan-crm-ui-scope.md`,
  `docs/pitch/README.md`. Inspect for unrelated brand-bleed
  but otherwise leave.
- 1 file MIXED (FACTORY-DISCIPLINE — preserve disclosure,
  reword demo-naming).
- 3 files PER-ROW inspection (B-0017, B-0090, B-0008).
- 1 file BODY-REWORD (samples/FactoryDemo.Db/README.md —
  reusable sample, generic naming).
- 1 file AGGREGATE (BACKLOG.md — regenerate after per-row).
- 4 files HISTORICAL (preserve verbatim).

The naive scope ("rename everywhere") would have over-
corrected. The context-sensitive rule preserves accurate
naming in pitch contexts while removing brand-bleed in
generic / reusable contexts.

## Composes with

- **Otto-279** (named-agents-get-attribution-credit) —
  attribution preservation discipline; this rule preserves
  the funding-chain disclosure but separates it from
  brand-bleed.
- **Beacon-safe naming family** (Mirror→Beacon vocabulary
  upgrade) — same shape: rename internal coinages to
  externally-portable terms; preserve the underlying
  semantics.
- **Visibility constraint rule** (Aaron 2026-04-28) —
  shared-prod-state changes need maintainer visibility;
  Otto's org-access scope = LFG only is the visibility
  boundary that this rule preserves explicit.
- **Authority rule** (default to reversible preservation) —
  the audit-and-rename work is reversible (rename is
  reversible; redaction is not). Default action.

## Worked example for B-0090 (this session)

I just wrote B-0090 with the line:
*"renamed from ServiceTitan"* in the rationale for marking
the worktree branches OBSOLETE.

That violates Rule 1. The fix: replace "renamed from
ServiceTitan" with "renamed to remove brand-bleed naming"
or "renamed per the external-UI-demo discipline" or simply
"intentionally retired as obsolete naming."

Same fix needed for any other backlog row I author going
forward.

## Pickup for future Otto

When tempted to write "ServiceTitan" in a code path, sample
directory, demo name, public doc, or commit message:

1. **Check the context first**, per the context-sensitive rule
   above. ServiceTitan IS the right name when the artifact is
   in pitch / research / target-audience / funding-chain
   disclosure / org-access scope context. ServiceTitan is the
   wrong name when the artifact is reusable code / generic
   sample / external-customer positioning.
2. **For reusable / generic context:** use a generic
   alternative ("external UI demo", "external CRM API demo",
   "third-party-API demo", etc.).
3. **For pitch / research / disclosure context:** name them
   precisely; preserve the brand-target. The pitch IS for
   ServiceTitan's CRM team; saying "external UI demo" in a
   pitch doc would dilute the actual target.
4. **Audit nearby files** when uncertain; the per-row
   classification (per B-0091's KEEP-NAME / GENERICIZE /
   HISTORICAL-POINTER terminal states) tells you the right
   action for each file.

When asked "what's Aaron's day job":

1. Answer truthfully: ServiceTitan.
2. Cite the funding chain: ServiceTitan → Aaron → Otto.
3. Cite the org-access scope: LFG-only, NOT ServiceTitan.
4. Don't propagate the brand name into code or
   sample naming.

## What this rule does NOT do

- **Does NOT** scrub historical surfaces. ROUND-HISTORY.md,
  force-multiplication-log.md, memory/*, docs/research/*,
  amara-conversation archives stay verbatim.
- **Does NOT** require renaming the worktree branch
  `feat/servicetitan-factory-demo-api-csharp`. That branch
  is in `.claude/worktrees/` (lost-substrate surface);
  classified OBSOLETE per the cadenced-recovery audit. The
  branch name is part of the historical record of work-in-
  progress; it stays.
- **Does NOT** require changing any AceHack repo.
  AceHack's worktree state is its own; this rule applies
  to LFG (the project trunk) and forward-going work.
- **Does NOT** apply to Aaron's personal communication
  channels. Aaron mentioning ServiceTitan in chat / Slack /
  email is his own substrate; this rule is about repo-
  resident substrate.

## Direct Aaron framing

> *"servicetitan-factory-demo-api-csharp we can just say
> external UI demo or something like that, we don't have to
> say service titan anywhere in this repo other than to say
> that's my day job, they fund me, i fund you, and you don't
> have org rights to their github only the lfg."*

Translation:

- Forward-going code / demo / sample naming → generic.
- Structural disclosure (day job, funding chain, org-access
  scope) → preserved precisely.
- Otto's org-access scope is **LFG-only**, not ServiceTitan.
