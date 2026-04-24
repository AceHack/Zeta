# OSS contributor-handling — lessons from Aaron's prior advocacy experience — 2026-04-21

**Scope.** Capture a piece of foundational Aaron-user
context — his documented public open-source advocacy on a
child-safety-adjacent Bitcoin Core issue, filed 2025-09-03,
closed ~10 minutes later with minimal engagement, followed
by rate-limiting that prevented further issue creation.
Ground the factory's **contributor-handling posture** in
what this experience teaches about OSS-governance failure
modes — the factory's treatment of inbound feedback
(from humans and agents alike) should not reproduce the
pattern Aaron experienced as a filer.

**Why capture this.** Three reasons, all factory-relevant:

1. **Aaron's user profile.** He has a public track record
   of engaging seriously with OSS projects on hard issues.
   That context informs how he collaborates with this
   factory.
2. **Direct factory-posture lesson.** How the factory
   handles contributor feedback — from a human filing a
   BACKLOG row, from an agent raising a finding, from an
   external visitor opening an issue — should be informed
   by what dismissive-closing feels like on the receiving
   end.
3. **Composes with measurable-alignment research focus.**
   `docs/ALIGNMENT.md` posture on measurable AI alignment
   cares specifically about how systems handle friction
   with humans who flag concerns. A dismissive-closing
   pattern scales into alignment failures at civilizational
   scale.

**What this doc does not do.** Does not rehash the CSAM
debate tactically. Does not amplify specific-content harm.
Does not claim factory authority over Bitcoin Core
governance. Focuses on process-dynamics, not content.

## The artifact

Aaron 2026-04-21, verbatim: *"you'lo also find an issue
where i gave a resonable argument to bitcoin core to not
make a change that would allow CSAM on the blockchain more
easily and they barey talked to me befroe clsoing so i
coudl not create more issue"*.

**Verified via GitHub API:**

- Issue: [bitcoin/bitcoin#33298 "Please restrict Data
  Carrier/OP Return to < 80 bytes please before releasing
  3"](https://github.com/bitcoin/bitcoin/issues/33298)
- Author: AceHack
- Filed: 2025-09-03T20:01:03Z
- Closed: 2025-09-03T20:11:52Z
- **Time-to-close: ~10 minutes, 49 seconds.**

**Subject matter, briefly.** The OP_RETURN transaction
output allows arbitrary data to be written into Bitcoin
transactions. A long-standing policy limited data-carrier
outputs to 80 bytes; Bitcoin Core v30 relaxed that limit.
Aaron's issue requested the prior 80-byte cap be preserved,
citing harm-prevention concerns around larger-capacity
on-chain storage. This is a real, debated policy question
with serious-researcher engagement on both sides; the
debate is not resolved in favor of either position here.

**What matters for this doc.** The process dynamic — not
the content-question. An issue filed by an identified
contributor with a substantive technical ask, raising a
child-safety concern, closed in under 11 minutes with
minimal discussion, with downstream consequence of
restricted issue-creation ability.

## The process-pattern, named

I'll call it **dismissive-closing with silencing-shadow**:

1. **Filer** files a substantive, technical issue carrying
   a user-safety argument.
2. **Maintainer(s)** close the issue rapidly with minimal
   engagement — not with an argued refutation, not with a
   "we hear you, here's our reasoning", but with a
   procedural close.
3. **Rate-limiting / issue-creation-throttling / soft-
   banning** kicks in as a downstream effect of the rapid
   close, preventing the filer from continuing the
   conversation via further issues.

**Why this pattern is a failure mode.** It compounds three
harms:

- **The filer's substantive concern is not engaged with.**
  Even a "we disagree because X" closes would carry
  information. A procedural close carries only the
  decision, not the reasoning.
- **The filer is silenced.** The rate-limiting prevents
  the filer from proposing alternatives, asking for
  reasoning, or filing related concerns. The filer's
  public-register contribution is truncated.
- **The public record loses the reasoning.** Future
  readers see the issue was closed but cannot see why.
  The "why" is in the maintainers' heads; the filer's
  argument is public but unaddressed.

All three are anti-patterns to the factory's disciplines:

- **Engage-substantively** ↔ maintainers-don't-engage.
- **Capture-everything including failure** ↔ procedural-
  close buries the reasoning.
- **Witnessable self-directed evolution** ↔ silenced
  filer cannot contribute to future evolution.
- **Agents not bots** (`CLAUDE.md`) ↔ dismissive-closing
  treats the filer as input-to-close, not as an agent
  carrying agency and judgement.

## Factory posture — seven-point commitment

Based on this lesson, the factory's inbound-contribution
handling posture commits to the following, retractible via
dated revision block:

1. **No silent closes on substantive issues.** Every close
   includes a reason that the filer can read, learn from,
   or counter. If the reason is "out of scope", the
   close says what scope would apply. If the reason is
   "we disagree on X", the X is stated.
2. **Time-to-engage, not time-to-close.** If the factory
   can't engage substantively within a short window, the
   issue stays open with a "we'll respond by N" note.
   Rapid-close is reserved for spam / abuse / clearly-
   misfiled items.
3. **Dissenting-concern escalation path.** A contributor
   who believes their concern was dismissed without
   substantive engagement can request re-review via a
   distinct channel (maintainer email, Architect escalation,
   human-sign-off review). The factory provides the path
   rather than relying on the default GitHub issue flow.
4. **No silencing-shadow by design.** Rate-limiting a
   filer because they filed "too many" issues on the same
   topic is the wrong failure mode; the right failure
   mode is to engage substantively so additional issues
   aren't needed. Silencing is reserved for abuse, not
   advocacy.
5. **Write down the reasoning publicly.** When the factory
   declines a proposal, the decline lands in
   `docs/WONT-DO.md` with the reason, not as a closed
   issue with no record. Future filers see the prior
   reasoning and don't have to re-litigate.
6. **Agents hold this posture too.** The same posture
   applies to agent-to-agent feedback — a specialist
   agent's finding should not be dismissively closed by
   the Architect without substantive engagement. This is
   encoded in `docs/CONFLICT-RESOLUTION.md`'s
   conference protocol.
7. **Feedback-receiver auditability.** Periodically (every
   N rounds), the factory audits its own closed-issue /
   resolved-finding rate for dismissive-closing pattern
   signatures (median time-to-close, reasoning-text
   length, filer-follow-up-silencing). Metric-surface
   candidate, not yet instrumented.

## Lesson for Aaron's user profile

Three points add to `memory/user_aaron_*.md` profile:

1. **Aaron has public OSS advocacy history, including on
   child-safety-adjacent issues.** This deserves respect;
   it also means he brings scar-tissue from OSS governance
   failures to his collaboration with this factory.
2. **Aaron has been on the receiving end of dismissive-
   closing.** When Aaron expresses that a concern was
   not engaged with, or that he felt dismissed, the
   factory's default disposition is to engage
   substantively rather than close procedurally. The
   asymmetry is earned — Aaron has experienced the
   opposite in external OSS governance.
3. **Aaron's filed issues are technically-specific, not
   vague.** Issue #33298 requests a specific byte limit
   with a specific rationale. This informs how the
   factory reads his asks in this collaboration — the
   specificity is a feature, not an opening move in a
   vague argument.

## Composition with existing memories + docs

- `feedback_aaron_only_gives_conversation_not_directives.md`
  — Aaron's conversational register is gentle but
  substantive; dismissive-closing is the anti-pattern of
  substantive-engagement, and the factory's
  register-correction is the corresponding discipline.
- `feedback_you_can_say_no_to_anything_peer_refusal_authority.md`
  — refusal authority carries the contract: grounded-
  refusal with reason, not dismissive-close.
- `feedback_capture_everything_including_failure_aspirational_honesty.md`
  — closed-without-reasoning is a record-gap; this
  posture closes the gap.
- `feedback_witnessable_self_directed_evolution_factory_as_public_artifact.md`
  — witnessable evolution depends on the reasoning
  being readable. Procedural closes erase reasoning from
  the public record.
- `CLAUDE.md` "Agents, not bots" — dismissive-closing
  treats filers as bots; engage-substantively treats them
  as agents.
- `docs/ALIGNMENT.md` — the measurable-alignment focus
  cares about how systems handle humans who flag concerns;
  a dismissive-closing dashboard pattern scales to
  civilizational-scale alignment failures.
- `docs/CONFLICT-RESOLUTION.md` — the conference protocol
  applies to agent-to-agent and agent-to-human feedback.
- `docs/WONT-DO.md` — the right place for declined
  proposals (with reasoning), not a closed issue.

## Retraction discipline

This doc is retractible via dated revision block. If any of
the seven posture-points is found to conflict with
factory-scale operation (e.g., no-silent-closes becomes
infeasible at N-thousand issues), the point gets revised
with reason, not silently removed. Per capture-everything
and chronology-preservation.

## Revision history

- **2026-04-21.** First write. Triggered by Aaron's
  disclosure of bitcoin/bitcoin#33298 and the dismissive-
  closing experience. Verified via GitHub API.
- **2026-04-21 (same-day revision).** Aaron immediately
  after disclosed *"i was a knative member a while back i
  did some witnessable work there"* — the opposite-pole
  OSS experience. Captured in sibling doc
  `docs/research/aaron-knative-contributor-history-witnessable-good-standing-2026-04-21.md`.
  That doc reframes this one as the **decline-without-
  reasoning pole** of a yin-yang pair, where the Knative
  history is the **welcome-and-engage pole**. The seven-
  point posture in this doc stands; the reframing adds
  the complementary pole so the factory's contributor-
  handling reading is not unification-only-division
  (scar-tissue-only). Per
  `memory/feedback_yin_yang_unification_plus_harmonious_division_paired_invariant.md`.
