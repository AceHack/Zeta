---
name: Upstream PRs to other open source projects — encouraged when verified locally + CI-proven; speculative PRs require human-in-loop first to avoid spam
description: 2026-04-20; Aaron explicit policy; NOT identity-gated (my earlier "external-identity gate" framing was wrong); gate is verified-vs-speculative — local fork + candidate fix + CI proof the fix actually solves our issue = encouraged; speculative PRs without local verification require talking to Aaron first; the concern is not-spamming other open source projects; applies to bug reports, issues, and PRs alike; route all outbound contributions through this gate.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Upstream PR policy — verified, not speculative

## Rule

**Upstream PRs (or issues, or bug reports) to other open source
projects are encouraged when:**

1. We have verified locally that the upstream project has the
   problem we think it has (reproduced on our machine).
2. We have verified **with our CI** (or a rigorous local
   equivalent that mirrors CI) that a candidate fix actually
   solves our issue or produces the expected behavior.
3. The usual way to do (2) is: fork upstream → apply the
   candidate fix in the fork → point our build/CI at the fork
   → confirm our failing case now passes.

**Speculative PRs are NOT allowed without talking to a human
first.** Speculative = we think there's a bug / we have an idea
for a fix / we noticed something "off" but we have not run the
candidate fix through our own verification loop.

## Aaron's verbatim statement (2026-04-20)

> "opening an upstream PR on another open source project is
> encouraged if we've verified locally and with our ci that
> changes to their project actually solve our issues or the
> expected thing happened. Don't make speculative PRs to other
> open source projects without talking to a human first, not
> expicitly denied but we don't want to spam other open source
> projects."

## Why:

- **Spam avoidance is the root concern.** Open source
  maintainers are donating time; a PR/issue that we can't
  demonstrate actually fixes something is asking them to do
  our homework. Zeta's posture toward other projects must not
  burn the contribution goodwill we will eventually need.
- **The verification step is the *quality gate*.** A PR we
  can demonstrate solves a real problem in our CI is high-
  signal for the upstream; a PR with only a narrative claim
  ("we think this fixes X") is low-signal and can harm both
  sides (wasted review cycles upstream, unclear ROI for us).
- **Correction to prior framing.** Earlier in this session I
  treated upstream-PR-filing as "identity-gated" similar to
  the agent-email-identity policy
  (`feedback_agent_sent_email_identity_and_recipient_ux.md`).
  That was **wrong**: the email policy is about `From:`
  domain + recipient-UX disclosure; the upstream-PR policy
  is about *verification discipline* + spam-avoidance.
  Different concerns; different gates. Keep them distinct.
- **Fits the default-on-with-documented-exceptions posture**
  (`feedback_default_on_factory_wide_rules_with_documented_exceptions.md`).
  Default is **verified PRs are encouraged**; exception is
  **speculative PRs require human conversation first**.
  Named, scoped, reversible — exactly the shape that policy
  memo describes.

## How to apply:

- **When we find a bug in an upstream project:**
  1. Reproduce locally. Confirm it's really in upstream, not
     in our usage.
  2. Decide if a candidate fix exists. If yes → go to step 3.
     If no (we only have a report of symptoms) → escalate
     to Aaron before filing even an issue upstream.
  3. Fork the upstream repo. Apply the candidate fix in the
     fork.
  4. Repoint our build or CI at the fork. Run the gate that
     originally failed. Confirm it now passes.
  5. **Only then** file the upstream PR, with the evidence
     from step 4 in the PR description.
- **When we have only a bug report (no candidate fix):**
  - This is speculative by Aaron's rule. Route through Aaron
    before filing an issue upstream. An issue without a
    proposed fix is still a contribution cost to the upstream
    maintainer; spam-avoidance applies.
- **When the candidate fix is obvious but the fork-and-CI
  loop is expensive:** document the decision in a
  round-scope doc (ADR or BACKLOG row) and escalate. Do not
  shortcut "it's obviously right" into a speculative PR.
- **What "our CI" means here:** `dotnet build -c Release`
  clean + `dotnet test Zeta.sln -c Release` clean +
  `openspec validate --all --strict` clean + any
  capability-specific gate that the bug manifests in. Not
  just "the one test that was red is now green."
- **Relationship to the email-identity policy:** distinct
  and complementary. A PR is a public written record on
  GitHub under whatever GitHub identity the agent is
  operating as. Eventually when Lucent Financial Group is
  standing with a real `From:` mailbox + a Zeta / Lucent
  GitHub org, both policies converge on a single
  externally-legible agent identity. Today the gates are
  different and one does not imply the other.

## Candidate upstream PRs in queue as of 2026-04-20

- **OpenSpec validator first-line-MUST parsing bug** —
  surfaced during the round-43 circuit-recursion capability
  landing. **Not yet verified under this policy:** we worked
  around the bug in our own spec text (reworded the intro
  paragraph) but never forked openspec, applied a candidate
  fix, and confirmed our original spec text now validates.
  Status: **speculative — requires the fork-and-verify step
  before an upstream PR is allowable**. Parked accordingly.
- (Future entries go here as we accumulate them.)

## Sibling memories

- `feedback_agent_sent_email_identity_and_recipient_ux.md` —
  distinct policy (email-identity); do not conflate.
- `feedback_durable_policy_beats_behavioural_inference.md` —
  why this is a memory rather than inferred from behavior.
- `feedback_default_on_factory_wide_rules_with_documented_exceptions.md`
  — shape of the rule (default-on verified PRs; named
  exception for speculative PRs).
- `feedback_fail_fast_on_safety_filter_signal.md` — if a
  signal fires while a PR is being drafted, abandon the
  draft cleanly per the same posture.
- `project_lucent_financial_group_external_umbrella.md` —
  future convergence point for PR identity.

## Status as of 2026-04-20

- Policy confirmed durable.
- Outstanding speculative items (OpenSpec validator bug) are
  parked in the candidate queue above, waiting on the
  fork-and-verify step before they become allowable.
- No identity infrastructure (Lucent mailbox, Zeta GitHub
  org) required to file a verified PR today; the gate is
  verification, not identity.
