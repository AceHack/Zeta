---
id: 081M010ZPDT087G0R003CVYW18
type: task
state: backlog
priority: P2
slug: execute-the-2007-2008-company-evidence-protocol-once-artifac
title: "Execute the 2007-2008 company evidence protocol once artifacts are in hand"
created: 2026-08-14T20:56:28.346Z
depends_on:
  - 081M01024E1087G0R000CEKF79
composes_with: []
---

# Execute the 2007-2008 company evidence protocol once artifacts are in hand

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M010ZPDT087G0R003CVYW18-*.md` glob. -->

**Blocked on Aaron supplying artifacts.** Nothing here is startable by an agent. The protocol,
the ranking rationale, and the ceiling analysis live in
`docs/research/2026-08-14-evidence-protocol-2007-2008-company-lineage-is-evidenceable-priority-is-not.md`
— read that first; this item is the checklist and the guards, not a second copy of the reasoning.

Answers PR #10717's open question 5. Questions 1–4 stay on `081M01024E1087G0R000CEKF79`.

## The boundary (non-negotiable, and it governs every step below)

**Lineage is evidenceable; priority is not and is not pursued.** No claim relative to the October
2008 Bitcoin whitepaper or to any other project, in any form — not "predated", not "pre-Bitcoin",
not "contemporaneous", not "same cohort". **State dates absolutely, never relative to another
project's date.** Any sentence placing the 2008 date next to another project's name has crossed the
line regardless of hedging. See `.claude/rules/numerology-vs-number-theory.md`.

## Checklist — ordered by evidentiary strength

| # | action | who attests the date | blocked on |
|---|---|---|---|
| 1 | Confirm Functional Tree domain expiry + auto-renew; capture WHOIS/RDAP creation date + registrar order history | registry | Aaron — **time-sensitive, the only irreversible item** |
| 2 | Confirm Moveable Cubicle domain spelling (`moveablecubicle.com`, with the "e"?), then pull its Wayback CDX index | Internet Archive crawler | one line from Aaron |
| 3 | Original Aug 2008 email exported `.eml` with full headers; check for any dated **attachment** | intermediate mail servers | Aaron's mailbox |
| 4 | NC Secretary of State entity search for **Functional Tree** (browser only — scripted access blocked and forbidden) | the state | Aaron |
| 5 | Locate code; describe custody honestly (ever pushed to a third-party host? original history or later import?) | none — participant-asserted | Aaron |
| 6 | Ask Houman before the company is named publicly or any code from it is published | — | Houman |
| 7 | Permission from the other raise participants, or confirm they stay unnamed | — | them |
| 8 | Locate licence document — **contingency only**; note it may have three parties | — | gates nothing current |

## Guards that apply while executing

- **Do not "Save Page Now" the domain and file it as evidence.** A capture made today is dated
  today.
- **Do not cite commit dates as evidence.** A commit date is a self-asserted header field;
  `GIT_COMMITTER_DATE` sets it to anything, and signing attests *who*, not *when*.
- **The F# language-version check convicts, never acquits.** Post-2010 features refute a 2007–2008
  date; period-consistent syntax does not confirm one.
- **A Wayback snapshot attests the timestamp, not the truth of the text.** It supports "publicly
  described as X on date Y", never "was building X".
- **Absence of a snapshot falsifies nothing** — crawlers miss unlinked sites.
- **Motivated evidencing is the failure mode.** Too many correlations is a warning, not a
  confirmation signal. The domain, the site copy and the code all trace to the same two people;
  only the registry, the crawler, the state and the mail servers are independent.

## Do not do

- **Do not approach Rob Hukill or William Zeller** (named in the 2026-05-05 ferry as era
  participants) without Aaron's *and* Houman's agreement.
- **Do not name any investor or co-investor**, and do not record any claim about their conduct.
  Structure only: equity was substantially diluted; first-time founders facing repeat players is an
  information asymmetry (Akerlof 1970; Kaplan–Strömberg 2003). See the doc §6 for the exclusion.
- **Do not name the other participants in the $500K raise.** Aaron: *"i'll mention later after they
  allow."* Consent pending. Not by name, not by role, not by count-plus-context. **"Houman and a few
  others" is the ceiling.** A pending-consent row belongs in
  `docs/books/you-born-at-the-hinge/CONSENT-LEDGER.md`.
- **Do not assert a connection between any found "Moveable Cubicle" record and Aaron, Houman, or
  Functional Tree** without his confirmation. Finding *a* Moveable Cubicle is not finding *theirs* —
  the misattribution failure PR #10717 exists to prevent.
- **Do not treat the `functionalseo.com` lead as an identification** (doc §3.7). A shared word and a
  shared CMS is a generator, not a finding.
- **Do not publish, open-source, or relicense the old code.** Not proposed, and licence-gated.

## Standing facts that this item must not re-open

- **No code from the 2007–2008 company is used in Zeta** — Aaron states, 2026-08-14. Recorded as a
  founder's attestation, not an audit finding.
- **Functional Tree is the company name.** Moveable Cubicle was Aaron's **employer**, and the
  **client and funder** — Functional Tree existed to generalise Moveable Cubicle's working business
  model for others. $500K raised.
- **The peer-to-peer money was a derived requirement**: independent truckers ⇒ cross-state
  settlement to non-employee counterparties per container move. Not a chosen technology.
- The founder licence was **symmetric between Aaron and Houman**; the code is **private**; the
  funder may be a **third party to the licence** (open, not asserted).
- **Facts are not owned.** The evidence path (WHOIS, archive, filings) is ungated by any licence or
  cap table and can complete independently of everything in the IP strand.

## Definition of done

Either (a) the doc's §4 ceiling statement is instantiated with actual dates and artifact
references, in the two-warrants form — *publicly described as peer-to-peer money and logistics by
date X (third-party attested); source code implementing it survives (participant-attested,
period-consistent)* — or (b) a plain record of which strands came back empty. **An empty result is a
completed item**, not a failed one; the lineage claim survives partial evidence and never needed
date precision.
