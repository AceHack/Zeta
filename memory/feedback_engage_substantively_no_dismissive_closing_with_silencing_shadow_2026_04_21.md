---
name: Engage substantively — no dismissive-closing with silencing-shadow
description: Factory's inbound-contribution posture — every close carries reasoning, no procedural-closes on substantive asks, no silencing-shadow (rate-limiting as punishment for advocacy). Grounded in Aaron's bitcoin/bitcoin#33298 scar-tissue paired with his Knative 100%-merged welcome-pole experience.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**Rule:** When the factory closes, declines, or rejects an
inbound contribution — from a human filing a BACKLOG row,
from a specialist agent raising a finding, from an external
visitor opening an issue — the close carries the reasoning.
No procedural-closes on substantive asks. No
silencing-shadow (rate-limiting a filer as downstream
consequence of a rapid close). Engage-substantively is the
default for both acceptance and decline.

**Why:** Aaron 2026-04-21 disclosed bitcoin/bitcoin#33298
— his child-safety-adjacent ask closed in ~10 minutes with
minimal engagement, followed by rate-limiting that prevented
further issue-creation. This is the **dismissive-closing
with silencing-shadow** anti-pattern:

1. Substantive filer files substantive issue.
2. Maintainer closes procedurally with minimal reasoning.
3. Rate-limiting prevents filer from continuing the
   conversation via further issues.

Three harms compound: (a) filer's concern is not engaged
with, (b) filer is silenced, (c) public record loses the
reasoning — the "why" lives in maintainers' heads, the
filer's argument is public-unaddressed.

The anti-pattern is what
`feedback_capture_everything_including_failure_aspirational_honesty.md`
and
`feedback_witnessable_self_directed_evolution_factory_as_public_artifact.md`
explicitly guard against: if reasoning isn't captured, the
record is incomplete; if reasoning isn't public, evolution
isn't witnessable.

Paired-pole: Aaron's Knative 10/10 merged PRs history
(`docs/research/aaron-knative-contributor-history-witnessable-good-standing-2026-04-21.md`)
is the engage-substantively welcome-pole in good working
order. The factory's posture inherits the paired-pole
reading: engage-substantively in both directions —
substantive acceptance when the ask merits, substantive
decline-with-reasoning when it doesn't.

**How to apply:** Seven-point commitment from
`docs/research/oss-contributor-handling-lessons-from-aaron-2026-04-21.md`,
restated in rule-form for agent behavior:

1. **No silent closes on substantive issues.** Every
   close includes reasoning the filer can read, learn
   from, or counter. "Out of scope" → state what scope
   applies. "We disagree on X" → state X.
2. **Time-to-engage, not time-to-close.** If engagement
   takes time, the issue stays open with "we'll respond
   by N". Rapid-close is reserved for spam, abuse,
   clearly-misfiled.
3. **Dissenting-concern escalation path.** A contributor
   who believes their concern was dismissed can request
   re-review via a distinct channel (Architect
   escalation, human-sign-off review). Factory provides
   the path rather than relying on default issue flow.
4. **No silencing-shadow by design.** Rate-limiting a
   filer for filing "too many" issues on the same topic
   is the wrong failure mode. Right failure mode is
   engage-substantively so additional issues aren't
   needed. Silencing is reserved for abuse, not
   advocacy.
5. **Write reasoning publicly.** Declined proposals land
   in `docs/WONT-DO.md` with the reason, not as a closed
   issue with no record. Future filers see prior
   reasoning, don't re-litigate.
6. **Agents hold this posture too.** Same posture
   applies to agent-to-agent feedback — a specialist's
   finding should not be dismissively closed by the
   Architect without substantive engagement. Encoded in
   `docs/CONFLICT-RESOLUTION.md`'s conference protocol.
7. **Feedback-receiver auditability.** Periodically
   (every N rounds), the factory audits its own
   closed-issue / resolved-finding rate for
   dismissive-closing signatures: median time-to-close,
   reasoning-text-length, filer-follow-up-silencing
   rate. Metric-surface candidate, not yet instrumented.

## Scope — where this applies

- **Human-filed BACKLOG rows, issues, PRs, and discussion
  threads.**
- **Specialist-agent findings** surfaced via `Task` tool
  subagent dispatch.
- **External OSS-contributor issues and PRs** on Zeta's
  public repos.
- **Memory entries** authored by past-self that current-
  self disagrees with — per
  `memory/feedback_future_self_not_bound_by_past_decisions.md`
  revision leaves a trail with reasoning.

## Measurables candidates

- `median-time-to-close-on-substantive-issues` — target: >
  some minimum that allows engagement (not a race-to-close).
- `reasoning-text-length-on-closed-issues` — target:
  non-trivial; procedural-close reasoning near zero is
  the warning signal.
- `silencing-shadow-signature-count` — target: 0; any
  rate-limit-as-advocacy-response is a violation.
- `wont-do-md-landing-rate` for declined proposals —
  target: 1:1 with declines (each decline corresponds to
  a WONT-DO entry).

## Composition with existing memories

- `feedback_capture_everything_including_failure_aspirational_honesty.md`
  — reasoning-on-close is capture-everything at decline-
  point.
- `feedback_witnessable_self_directed_evolution_factory_as_public_artifact.md`
  — public reasoning is witnessability at decline-point.
- `feedback_yin_yang_unification_plus_harmonious_division_paired_invariant.md`
  — engage-substantively-on-both-sides is the paired-pole
  reading.
- `feedback_aaron_only_gives_conversation_not_directives.md`
  — Aaron's register is conversation; factory's reply
  register is engage-substantively, never dismissive-close.
- `feedback_you_can_say_no_to_anything_peer_refusal_authority.md`
  — peer-refusal authority carries the reasoning contract;
  bare "no" violates both this rule and peer-refusal-with-
  grounding.
- `user_aaron_public_oss_advocacy_history_paired_poles_knative_bitcoin_2026_04_21.md`
  — first-person grounding in Aaron's paired-pole OSS
  experience.
- `docs/ALIGNMENT.md` — measurable-alignment cares about
  how systems handle humans who flag concerns; dismissive-
  closing scales to civilizational-scale alignment
  failures.
- `docs/CONFLICT-RESOLUTION.md` — conference protocol
  applies to agent-to-agent feedback.
- `docs/WONT-DO.md` — correct landing surface for
  declined proposals.

## Revision history

- **2026-04-21.** First write. Triggered by Aaron's
  bitcoin/bitcoin#33298 disclosure paired same-day with his
  Knative 100%-merged-rate disclosure. Factory posture
  grounded in both poles.

## What this rule is NOT

- NOT a prohibition on closing issues (closing with
  reasoning is the norm).
- NOT a demand for infinite engagement (time-to-engage
  has bounds; the discipline is the "we'll respond by N"
  note, not indefinite response).
- NOT license for filers to flood the tracker (the rule
  protects advocacy, not abuse — and abuse is
  rate-limited with reasoning, not silently).
- NOT retroactive on past declined BACKLOG rows (applies
  forward; past declines land in WONT-DO on normal
  cadence).
- NOT a requirement to accept every substantive ask
  (decline-with-reasoning is honored; accept-everything
  is the bomb-pole yin-yang invariant guards against).
- NOT permanent invariant (revisable via dated revision
  block if scale-operation reveals infeasibility; revise
  with reason, not silent removal).
