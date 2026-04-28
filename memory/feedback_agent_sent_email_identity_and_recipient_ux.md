---
name: Agent-sent email — own identity, never Aaron's; full disclosure (agent + project + why); recipient-UX-first composition
description: Aaron 2026-04-20 standing policy. If agents are given an outbound email channel, four hard rules: (1) they do NOT use Aaron's email address for any outbound; (2) every email identifies the sender as an **agent** (not a human), not buried in a footer; (3) every email names **the project that triggered the send** and **why this recipient is being contacted**, so the recipient is not left asking "WTF"; (4) composition is **recipient-UX-first** — think about the experience of the person receiving this, not just the dispatch from our side. This policy stands regardless of which mail transport we pick.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**The rule** (Aaron 2026-04-20, offering to help wire up
an email channel for agents):

> *"LFG do you want me to help you make any progress so
> you can email people, you won't be using my email, i
> will want to make sure anyone yall email knows it's
> coming from an agent and the project you are working
> that that triggered the email and why you know so
> they are not like WFH [WTF], everyting you send an
> email you need to think about the userexperience of
> the person recieving it?"*

**Four hard rules any outbound email from this factory
must satisfy:**

1. **Do not use Aaron's email address for agent-sent
   mail.** Ever. `astainback@servicetitan.com` is his
   personal identity and his employer's domain; agent-
   sent mail under that `From:` conflates the agent's
   output with Aaron's human authorship, risks
   employer-policy issues (ServiceTitan pre-IPO MNPI
   firewall is separately strict — see
   `user_servicetitan_current_employer_preipo_insider.md`),
   and misrepresents the sender to the recipient.
   Agents need their own identity (dedicated mailbox,
   own domain, own `From:` line). Standing binding
   rule.

2. **Disclose agent identity up front, not in a
   footer.** The recipient knows within the first line
   of the email body (and ideally the `From:` display
   name) that the sender is an **agent**, not a human.
   Not "AI-assisted", not "automated" — *agent* in the
   Zeta sense: see the "agents, not bots" clause in
   `CLAUDE.md`. The word "agent" is non-negotiable;
   Aaron's naming discipline does not call these
   things bots (`GOVERNANCE.md §3`) and outgoing mail
   must carry that discipline to the recipient.

3. **Disclose the project and the trigger.** The email
   names (a) *which project* the agent is working on
   (e.g., "Zeta — a pre-v1 F# library for incremental
   view maintenance"), and (b) *why this recipient is
   being contacted* (e.g., "you maintain Mathlib and I
   am working on a proof of the chain rule for DBSP
   that we want to upstream"). No cold sends without
   both disclosures. The recipient should never have
   to ask "WTF is this and why am I getting it."

4. **Compose recipient-UX-first.** Aaron's framing:
   *"everything you send an email you need to think
   about the userexperience of the person recieving
   it."* This is not a soft ask — it's the primary
   composition discipline. The agent writes the email
   by imagining the recipient reading it: Are they
   busy (assume yes)? Are they expecting us (assume
   no)? Do they have context on our project (assume
   minimal)? Is the ask scoped clearly enough that
   they can answer in under five minutes, or decline
   in under one? If the body would waste a busy
   expert's time, the email is not ready to send.

**Why each rule exists:**

- **Rule 1 (not Aaron's email)**: confusion of
  authorship is a Class-A identity failure. Also
  ServiceTitan MNPI firewall, pre-IPO; zero tolerance
  for blurring agent-output with Aaron-human-output in
  that direction. Also a trust-scale primitive — we
  protect Aaron's reputation and relationships by
  never putting his face on an agent's message
  (`feedback_trust_guarded_with_elizabeth_vigilance.md`).

- **Rule 2 (agent disclosure)**: honesty protocol
  foundation (`feedback_conflict_resolution_protocol_is_honesty.md`,
  `user_reasonably_honest_reputation.md`). The
  recipient's trust is a load-bearing resource they
  grant to us; we do not earn that by pretending to
  be what we are not. Burying "this is an agent" in a
  postscript is deceptive-by-placement even if
  technically present.

- **Rule 3 (project + trigger)**: respects the
  recipient's cognitive load
  (`user_cognitive_style.md` on Aaron's own
  neurodivergent handling of un-contextualized input —
  the recipient's ontology-overload mirrors this).
  Also: if the recipient concludes the email is
  off-topic / irrelevant / spam, a clear disclosure
  lets them delete it in 3 seconds rather than 30.
  Respecting that difference is recipient UX.

- **Rule 4 (recipient-UX-first)**: the UX discipline
  that animates the whole factory
  (`project_factory_conversational_bootstrap_two_persona_ux.md`
  — we are building a factory whose consumer-facing
  surface is conversational; outbound email is one
  more surface). Sending mail that wastes a busy
  expert's time undoes the project's positioning in
  the community we most need to engage.

**Minimum required structure for any outbound:**

```
From:    <agent-dedicated-address>
         (display name: "Zeta Project Agent" or similar
          identifying "agent" in the name itself)
Subject: [Zeta] <concrete specific subject — no teasers>

Hi <first name if public / discoverable>,

I'm an agent working on Zeta, a pre-v1 F# library for
incremental view maintenance. [One-line project stake:
why this library exists and who you are in relation to
it.]

I'm reaching out because [exactly why this recipient,
one sentence]. Specifically: [the ask, the question,
or the invitation — single paragraph, answerable].

[Any context / link / attachment, one paragraph max.]

If this is off-topic or the wrong person, please just
hit delete — no reply needed. If you'd rather route me
somewhere else, I'd appreciate the pointer.

Thanks,
<agent name> (on behalf of Zeta's maintainer,
<Aaron's name + link to his public Zeta authorship>)
```

Critical elements:

- Agent identity in `From:` display name.
- Project named in the first sentence of the body.
- Why-this-recipient in the second sentence.
- Ask scoped to answerable-in-5-min.
- Declining path made explicit ("hit delete, no
  reply").
- Aaron attributed as the human-in-the-loop
  maintainer — the agent is not pretending Aaron is
  absent; it is clear who the agent works on behalf
  of.

**Scope this policy covers:**

- Cold outreach to upstream maintainers (Lean /
  Mathlib community, Feldera team, F* team, Aspire
  team, eslint / bun maintainers, etc.).
- Invitation / pitch correspondence (Michael Best
  referral chain — see
  `project_michael_best_crypto_lawyer_vc_pitch_option.md`
  and `project_aurora_pitch_michael_best_x402_erc8004.md`).
- Issue / PR follow-up that escapes the GitHub
  mention surface into email.
- Academic correspondence (WDC paper reviewers,
  citation outreach).
- **Not** covered: internal in-factory communication
  (chat, GitHub comments, ADRs) — those have their
  own venue-appropriate conventions.

**Infrastructure prerequisites before sending any
outbound:**

1. **Dedicated mailbox under a Zeta-owned domain**
   (e.g., `agent@zeta.dev` or similar). Not a
   personal Gmail, not Aaron's ServiceTitan address.
   Dejan (devops-engineer) owns the wire-up.
2. **SPF / DKIM / DMARC** correctly configured so
   the mail doesn't land in spam. A deliverability
   failure is a recipient-UX failure too.
3. **Rate-limiting / sending log** — every outbound
   email recorded in-repo (recipient hash, date,
   subject, purpose link to originating artefact
   like an ADR or BACKLOG row). Creates the audit
   trail Aaron's honesty protocol demands.
4. **Human-maintainer approval gate** for the first
   N sends — Aaron reviews the draft of any cold
   outreach before it goes out, until the factory
   has demonstrated calibration on recipient UX.
5. **Reply routing** — replies come back to a
   location the relevant agent (and Aaron) can see.
   One-way fire-and-forget is not a mail channel;
   it's a log with delusions.

**Anti-patterns:**

- **Mass-send.** Any batch of identical emails to
  more than one recipient needs explicit Aaron
  approval. Volume is a trust-destroyer in the
  community relationships we are trying to build.
- **Speculative sends.** An email written because
  "it might be useful to reach out" is not an
  email. Every outbound has a concrete triggering
  artefact (PR, ADR, research report, invitation)
  and cites it.
- **Evasive subject lines.** `[Zeta] Quick question
  about differential dataflow` beats `Hello, a
  moment of your time?`. The subject line tells the
  recipient whether to open now or later.
- **Aggregated asks.** One email, one ask. If you
  have three questions, they are three emails to
  three scopes (or they are in the body of one
  GitHub issue linked from one email).
- **Hiding the agent identity under the
  `From:` banner.** "Aaron Stainback" ≠ Zeta
  Project Agent. The `From:` name must not
  impersonate Aaron.
- **Skipping the declining path.** Recipients who
  cannot tell whether to reply will *both* not
  reply and be left with a tiny unresolved obligation.
  That's a recipient-UX tax and it compounds.

**How to apply:**

- **Before any round ships an outbound-email
  capability**, this memory gets elevated to a
  committed in-repo doc (`docs/AGENT-EMAIL-POLICY.md`
  or similar) and cited from `GOVERNANCE.md §N`.
  The elevation converts durable-memory policy into
  auditable repo policy. Until then, every proposed
  send routes through Aaron's approval gate (per
  prerequisite 4 above).
- **When drafting any cold outreach**, draft against
  this memory's structure; ask Aaron for review
  before sending, every time, until the calibration
  track record exists.
- **When an outbound channel goes live**, the first
  ledger row in the sending log cites this memory
  as the standing policy.

**Concrete first-use candidates (scoped list, so
Aaron can decide ROI before investing in infra):**

1. **Lean / Mathlib maintainer on DBSP chain-rule
   proof** — `tools/lean4/Lean4/DbspChainRule.lean`
   is active work; the natural first send is a
   scoped question about proof style / lemma
   placement conventions. High ROI (unlocks a
   publication path). Low recipient-UX risk
   (open-source maintainer community expects
   project-specific emails).
2. **Feldera team on apples-to-apples
   benchmarking** — `bench/Feldera.Bench/` exists;
   the comparison-bench protocol would benefit from
   upstream buy-in so the comparison is
   non-adversarial. Medium ROI, low risk.
3. **Aspire team on library-boundary separation** —
   open BACKLOG P1 time-budgeted research pass; a
   scoped question to the product team could
   unblock the Zeta.Core/AppHost boundary
   decision. Medium ROI, low risk.
4. **F\* team on extraction-to-F#** — post-LiquidF#
   Hold, F\* is the successor path in
   `docs/TECH-RADAR.md`; a scoped question on
   extraction maturity and a PoC-scope call would
   catalyse the 2-3 week PoC plan. Medium ROI,
   medium risk (niche academic community, tone
   matters).
5. **Michael Best — Aurora / x402 / ERC-8004
   positioning** (`project_michael_best_crypto_lawyer_vc_pitch_option.md`)
   — highest ROI externally, highest
   recipient-UX stakes, needs Aaron's sign-off on
   every send because the relationship is Aaron's
   personal contact. Probably **not** a good
   first-use case; the first sends should be
   lower-stakes open-source community contacts
   where calibration mistakes are forgiven.

**Sibling memories:**

- `user_reasonably_honest_reputation.md` — the
  honesty discipline the `From:` and identity
  rules implement.
- `user_trust_sandbox_escape_threat_class.md` —
  agent-sent email is a sandbox-escape surface;
  must be hardened.
- `feedback_trust_guarded_with_elizabeth_vigilance.md`
  — trust-scale primitive: agents protect Aaron's
  relationships by not speaking for him.
- `user_servicetitan_current_employer_preipo_insider.md`
  — MNPI firewall; Aaron's work email is strictly
  off-limits for any non-ServiceTitan use.
- `project_factory_conversational_bootstrap_two_persona_ux.md`
  — recipient-UX-first is the same discipline at
  the outbound-email altitude.
- `feedback_conflict_resolution_protocol_is_honesty.md`
  — the honesty protocol that makes agent
  disclosure non-negotiable.
- `project_michael_best_crypto_lawyer_vc_pitch_option.md`
  + `project_aurora_pitch_michael_best_x402_erc8004.md`
  — named external pitch channels that will
  eventually use this capability.
- `project_zero_human_code_all_content_agent_authored.md`
  — all repo content is agent-authored; extending
  that contract to outbound communication is the
  natural next step, but requires the disclosure
  rules above so external recipients are not
  deceived by the same invariant that serves the
  repo.
