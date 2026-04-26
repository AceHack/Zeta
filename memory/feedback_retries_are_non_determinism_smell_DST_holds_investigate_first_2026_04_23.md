---
name: Retries are a non-determinism smell; DST (Deterministic Simulation Theory) holds throughout the factory except where explicitly decided-against for real external uncontrollable reasons; investigate root cause before adding a retry
description: Aaron 2026-04-23 *"retries should be investigated before just adding they are a non determinist smell, remember DST deterministic simulation theory hold throughout except when expicitly decided against for real exteral reasons we can't control."* Retry wrappers mask non-determinism rather than root-causing it. DST (per the `deterministic-simulation-theory-expert` skill) says same inputs should produce same outputs; any retry is evidence of a non-deterministic input or state. Exception requires explicit acknowledgement (real external cause, out of our control) — not a default reach.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Retries are a non-determinism smell — investigate first

## Verbatim (2026-04-23)

> remember retires should be investigated befoe just adding
> they are a non determinist smell, remember DST
> deterministic simulation theory hold throughout except
> when expicitly decided against for real exteral reasons
> we can't control.

## Context of arrival

I had added a `tools/git/push-with-retry.sh` helper to
retry `git push` on transient GitHub 5xx errors, after
observing several such errors during autonomous-loop tick-
close commits on 2026-04-23. Aaron had also noted the
error URL showed `Zeta.git/` with a trailing slash — a
potential root cause I didn't investigate before reaching
for the retry wrapper.

## What this names

Deterministic Simulation Theory (DST) — captured in the
factory's `deterministic-simulation-theory-expert` skill —
is a load-bearing discipline for the whole factory, not
just Zeta's DST testing substrate. DST says:

- **Same inputs produce same outputs.**
- Any observed non-determinism has a cause: hidden state,
  un-captured input, race condition, environment
  difference, wall-clock dependency, external service
  dependency, etc.
- The cause is almost always **fixable** by surfacing the
  hidden input, eliminating the race, pinning the
  environment, or replacing wall-clock with deterministic
  time.

Adding a **retry** is the opposite of that discipline:
retry says "I don't know why it failed, but let's try
again until it works." Retries hide the cause rather
than exposing it. In a DST-held factory, retry should be
a last resort, not a first reach.

## The exception

Aaron's phrasing is explicit: *"except when explicitly
decided against for real external reasons we can't
control."* Retries are legitimate when:

- The failure cause is genuinely **external and
  uncontrollable** (remote service outage, network
  partition, rate-limit backoff) — and we've verified this,
  not assumed it.
- The factory has **explicitly decided** to accept the
  non-determinism at this boundary, with a paper trail
  (commit body / ADR / memory / BACKLOG row naming the
  external cause).
- The retry is scoped to exactly the uncontrollable
  boundary — not a broader retry that would also mask
  internal non-determinism.

Compare: Aaron's own past use of retries is always scoped
tightly — e.g., DNS resolution under packet loss, cloud
object-store eventual consistency reads. These are
genuinely external. The factory's transient GitHub 5xx
was **assumed** external without investigation.

## The failure mode this rule prevents

**Retry-driven assumption drift.** When a retry wrapper
lands before the root cause is investigated:

1. The retry succeeds in most cases (because the cause
   was short-lived or partially external).
2. The failing cases degrade silently (retries exhaust,
   errors look identical).
3. The actual root cause is never fixed because the
   symptom is hidden.
4. Future similar errors in different contexts get the
   same retry treatment without investigation.
5. Factory drifts toward a retry-everywhere posture,
   which is the opposite of DST.

The cost is long-term correctness loss. Short-term
convenience (retry helps this tick) trades against
long-term factory coherence (root cause never surfaces).

## How to apply

- **On observing a recurring failure (transient or
  otherwise)**, investigate root cause FIRST. Evidence:
  error message verbatim, request trace, environment
  snapshot, timing, input diff between passing and failing
  runs.
- **Before reaching for `retry`**, ask:
  1. What specifically differs between the failing run and
     a passing run? (If "nothing," DST says the cause is
     external or hidden.)
  2. What external services are in the request path, and
     are they actually down? Or is a header / URL /
     timeout / version the cause?
  3. Is the failure deterministic under some input —
     i.e., does X always fail while Y always succeeds? If
     yes, the input is the signal.
  4. Can the observation be reproduced offline?
- **If retry is genuinely warranted**, scope it narrowly
  to the external boundary + record the "decided against
  DST here because <specific external reason>" rationale
  in the commit body or ADR. Do not hide the decision.
- **Pair each retry with an observation window**. If the
  retry fires more than N times in a short window, that's
  a signal to investigate the underlying external issue
  (escalation threshold, not a settle-for-retry answer).

## Specific application to the 2026-04-23 GitHub 500 case

The `tools/git/push-with-retry.sh` wrapper I landed in
PR #169 was an example of reaching for retry before
investigating:

1. **Skipped-investigation items:** Aaron's trailing-slash
   observation was left to the wrapper's commentary
   rather than actually investigated. I should have
   first checked local git config (done — clean), then
   inspected what actually appears on the wire (git's
   `GIT_TRACE=1 GIT_CURL_VERBOSE=1` output), then looked
   for the trailing slash's origin. Only after the
   investigation resolved to "genuinely external transient
   GitHub issue" would retry be legitimate.
2. **Corrective action:** revisit PR #169. Either convert
   the wrapper into an investigation script (trace + log
   the error, no retry), or mark the wrapper as
   preliminary/pending investigation, or close the PR
   and handle the transient by investigating further when
   it fires again.
3. **Paper trail discipline:** the wrapper's commit body
   does acknowledge the investigation was incomplete, but
   the action (add retry) runs ahead of that
   acknowledgement. That order is backward — the
   investigation should land first, then the decision.

## What this is NOT

- **Not a prohibition on retries.** Retries are
  legitimate at genuinely external uncontrollable
  boundaries. The rule is about order — investigate
  first, then decide.
- **Not a DST-purity demand.** Wall-clock, network,
  filesystem, external services are all unavoidable
  sources of real-world non-determinism. DST doesn't ban
  them; it demands we *surface* them as explicit
  boundaries and handle them with intent.
- **Not a demand to remove every existing retry.**
  Existing retries in the factory substrate may be
  well-scoped; this rule applies to new retries. Audit
  on discovery, not as a sweep.
- **Not a rule to ignore observability.** Transient
  errors that recur should be logged with enough context
  to enable later investigation (trace output, error
  verbatim, context snapshot). Observation is cheap;
  correction is not.

## Composes with

- `.claude/skills/deterministic-simulation-theory-expert/SKILL.md`
  (the DST discipline itself; this memory extends the
  discipline to the retry-as-smell heuristic)
- `.claude/skills/race-hunter/SKILL.md` (detect hidden
  races; the retry-alternative diagnostic surface)
- `feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`
  (investigate the signal before mangling the
  transformation)
- `docs/research/zeta-self-use-local-native-tiny-bin-file-germination-2026-04-22.md`
  (DST is load-bearing for Zeta's algebraic substrate;
  same principle at factory-wide scope)
- `feedback_free_work_amara_and_agent_schedule_paid_work_escalate_to_aaron_2026_04_23.md`
  (self-scheduled freedom includes the freedom — and
  obligation — to investigate before reaching for
  short-cuts)
