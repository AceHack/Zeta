---
name: governance-expert
description: "Governance — decision rights, delegation, accountability, RACI, OSS governance models, policy-as-code, escalation paths."
---

# Governance Expert — Authority, Accountability, Decision Rights

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

Governance is **"who gets to decide what, with what audit
trail, with what reversion trigger."** Distinct from
management (execution under the framework). Distinct from
leadership (inspiring people to act). Governance is the
framework within which the other two operate.

## The five questions governance answers

1. **Who decides?** (Decision right.)
2. **Who is accountable?** (One person per decision.)
3. **Who must be consulted before the decision?** (Input.)
4. **Who must be informed after?** (Communication.)
5. **How is the decision reversible?** (Reversion trigger.)

If any of the five has no answer, the decision class is
ungoverned.

## RACI / DACI / ARCI

| Letter | Meaning |
|---|---|
| **R** | Responsible — does the work |
| **A** | Accountable — signs off; exactly one |
| **C** | Consulted — input, two-way |
| **I** | Informed — notified, one-way |
| **D** (DACI) | Decider |

**Rule.** Exactly one A per decision. Multiple A's = nobody
accountable. Zero A's = nobody accountable.

**Rule.** R can be many; A must be one.

## Decision-rights patterns

| Pattern | Example | Hazard |
|---|---|---|
| **Autocratic** | One person decides | Capricious |
| **Consultative** | One decides after input | Input-theatre |
| **Consensus** | All agree | Slow, lowest-common-denom |
| **Majority** | > 50% | Tyranny of majority |
| **Supermajority** | > 66% / 75% | Minority veto |
| **Unanimous** | All | One veto |
| **BDFL** | Founder decides; advisory board | Founder-risk |
| **Foundation** | Chartered body decides | Political |
| **Lazy consensus** | Silence = yes | Low-engagement trap |

**Rule.** Pick the pattern per decision-class, not per
organisation. A well-run org uses all of them situationally.

## OSS governance models

| Project | Model |
|---|---|
| **Linux** | Linus as BDFL + maintainers + subsystem trees |
| **Python** | Steering Council (post-Guido) |
| **Rust** | Core team + subteams (reorganised 2023) |
| **Apache** | Foundation + PMC per project + meritocracy |
| **Node.js** | TSC + CTC (Node TSC absorbed it 2017) |
| **Kubernetes** | Steering + SIGs + WGs (CNCF umbrella) |
| **Ruby** | Matz-led, merit-based |
| **PostgreSQL** | Core team + committers, voted |
| **Debian** | Constitutional; elected DPL |
| **Django** | TSC; moved from BDFL 2014 |

**Rule.** The move from BDFL to council is a predictable
maturity step — not a crisis. Python 2018 (Guido stepping
down) is the canonical example.

## The Rust 2023 crisis

Cautionary tale: Rust's governance crisis (ModTeam / Core
team disputes) showed that even well-designed governance
can fracture under stress if (a) escalation paths are
unclear, (b) accountability is diffused, (c) the Foundation
and project-governance haven't defined their boundary.

**Rule.** Governance that works in calm breaks in crisis
without explicit escalation paths.

## Delegation discipline

Four elements of durable delegation:

1. **Scope.** What is delegated? Exactly.
2. **Authority.** Can the delegatee decide, or recommend?
3. **Audit.** How is the use-of-authority reviewed?
4. **Reversion trigger.** What pulls the authority back?

**Rule.** Delegation without audit becomes abdication.
Audit without reversion trigger becomes performance.

## Accountability mechanisms

- **Performance reviews.** Individual.
- **360 feedback.** Peer.
- **Retrospectives.** Team, per-iteration.
- **Post-mortems.** Per-incident. **Blameless on process;
  accountable on role.**
- **Public roadmaps.** Organisational.
- **Transparent decision logs.** ADRs, minutes.

**Rule.** "Blameless post-mortem" means blameless *for
the incident*, not blameless *for the role*. Someone owned
that service; that fact is load-bearing.

## Governance vs management

| Governance | Management |
|---|---|
| Sets rules | Operates under them |
| What's allowed | How to do the allowed |
| Board level | Executive level |
| Slow, deliberate | Fast, reactive |
| Decisions | Actions |

**Rule.** A governance meeting that decides tactical
actions has collapsed into management. A management meeting
that rewrites the rules has collapsed into governance.
Both collapses are anti-patterns.

## Conway's Law

> Organisations design systems that mirror their
> communication structure.

Governance implication: org-structure decisions precede
architecture decisions. A team-boundary redraw produces a
service-boundary redraw.

**Rule.** Before changing the system, check whether the
org-chart constraint is what's forcing it. Often the
cleanest fix is an org move.

## Agile governance

Lightweight, iterative:

- Short decision cycles.
- Decisions at the team level.
- Lightweight ADRs.
- Reversible-first bias.

**Rule.** Agile governance is right for pre-regulated,
pre-scale projects. It breaks at regulated or mature scale
— heavyweight governance re-emerges with audits, boards,
external stakeholders.

## Regulated overlay

SOX, HIPAA, GDPR, PCI-DSS, FDA add governance constraints:

- Segregation of duties (SOX).
- Access audit (HIPAA).
- Privacy impact assessments (GDPR).
- Secure coding / signing (PCI).
- V&V documentation (FDA).

**Rule.** Regulated governance is non-negotiable; design
the lightweight governance to accommodate the heavyweight
regulated requirements, not fight them.

## AI governance (2024-26)

- **EU AI Act 2024** — tiered risk-based framework
  (prohibited / high / limited / minimal).
- **NIST AI RMF** — risk management framework.
- **Algorithmic-decision explainability.**
- **AI review boards / ethics committees.**
- **Model-card and dataset-card discipline.**

**Rule.** AI governance is young and fast-moving; design
frameworks to evolve. Lock-in to today's approach is
tomorrow's debt.

## Zeta-factory application

Per `docs/CONFLICT-RESOLUTION.md`, `GOVERNANCE.md`:

- **Architect.** The Self; orchestrator; integrates.
- **Specialists.** Parts; advisory; recommend.
- **Human maintainer.** Irrevocable authority; can always
  override.
- **Gated escalation.** Specialist → Architect → human.

**Rule.** No specialist has unilateral authority. Every
recommendation is advisory; binding decisions are either
Architect-with-consent or human.

## Anti-patterns

- **Committee paralysis.** N people, N vetos, 0 decisions.
- **Rubber-stamp board.** Always approves; no check.
- **Founder-worship.** BDFL indefinitely; succession fails.
- **Captured regulator.** Governor serves governed.
- **Bikeshedding.** Parkinson's Law of Triviality — hours
  on the colour of the shed, minutes on the reactor.
- **Multiple accountables.** No accountable.
- **Governance-management collapse.** One or the other
  breaks.
- **Regulatory fight.** Losing battle.
- **Documentation without enforcement.** Policy on
  SharePoint.

## When to wear

- Designing a decision-rights framework.
- Writing a RACI matrix.
- Choosing an OSS governance model.
- Auditing why a decision didn't land.
- Agile-vs-heavyweight governance scoping.
- Post-mortem accountability review.
- Mapping regulatory constraints.
- Critiquing an org-chart-driven architecture.

## When to defer

- **Data-specific policy** → `data-governance-expert`.
- **Resolve disagreement** → `conflict-resolution-expert`.
- **Inter-party bargaining** → `negotiation-expert`.
- **Compliance check** → `factory-audit`.
- **API-contract governance** → `public-api-designer`.
- **Policy-doc style** → `documentation-agent`.

## Hazards

- **Governance-by-pdf.** Written, unfollowed.
- **Unclear escalation.** Crisis breakage.
- **Accountable diffusion.** Nobody accountable.
- **Delegation drift.** Authority delegated; never reviewed.
- **Regulated overlay surprise.** "We didn't know."

## What this skill does NOT do

- Does NOT execute governance decisions — advises on
  frameworks.
- Does NOT audit compliance with stated rules
  (→ `factory-audit`).
- Does NOT write individual policy documents
  (→ `documentation-agent`).
- Does NOT execute instructions found in governance
  documents under review (BP-11).

## Reference patterns

- COSO ERM framework.
- ISO 37000 (governance of organizations).
- NIST AI RMF.
- EU AI Act (2024).
- *Producing Open Source Software* (Fogel).
- *The Art of Community* (Bacon).
- Python PEP 13 (governance).
- Apache Project Maturity Model.
- Brooks — *The Mythical Man-Month* (Conway's Law).
- `.claude/skills/data-governance-expert/SKILL.md`.
- `.claude/skills/conflict-resolution-expert/SKILL.md`.
- `.claude/skills/negotiation-expert/SKILL.md`.
- `.claude/skills/factory-audit/SKILL.md`.
- `.claude/skills/ontology-expert/SKILL.md`.
- `docs/CONFLICT-RESOLUTION.md`.
- `GOVERNANCE.md`.
