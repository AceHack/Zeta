---
name: "Transient CI" means external-infra only — test failures are bugs, never flakes
description: When categorizing CI failure causes, use "transient" ONLY for external-infrastructure failures (curl 502 from upstream package mirrors during tools/setup/install.sh, GitHub Actions runner-pool unavailability, registry timeout). NEVER use "transient" for test failures. A test that passes on retry is hidden non-determinism in OUR code per Otto-248 (never ignore flakes) + Otto-272 (DST-everywhere) + the retries-are-non-determinism-smell discipline. The lazy bucket "transient CI" that includes both is itself an anti-pattern — it lets test flakes slip past as "noise" instead of being investigated as bugs. Aaron 2026-04-28 caught me using "mostly probably transient CI" without distinguishing: *"transient CI what does this mean flakey test?"* The fix is vocabulary discipline: external-infra failures are reruns, test failures are bugs. Use those exact words.
type: feedback
---

# "Transient CI" means external-infra only — test failures are bugs

**Rule:** when categorizing CI failure causes, **two distinct
buckets, never one combined "transient CI" bucket**:

| Bucket | What it means | Correct response |
|---|---|---|
| **External-infra failure** | Failure at the network boundary, in code we don't own. Examples: `curl 502` from upstream package mirror during `tools/setup/install.sh`, NPM/NuGet registry timeout, GitHub Actions runner pool unavailable, DNS resolution flake on a third-party host. | Rerun. The retry is not papering over our non-determinism; the failure was outside our system. (Still log + WebSearch the upstream incident if recurring.) |
| **Test failure** (including "test passes on retry") | Failure in OUR code — non-determinism in tests, race conditions, time-of-day-dependent assertions, unpinned RNG, missing await, shared state across tests. **Even one retry-success means the test is non-deterministic.** | **Investigate root cause.** Pin the seed (Otto-273). Eliminate the race. Land a DST-conformant fix. Never paper over with retry-N config; that's exactly what `feedback_retries_are_non_determinism_smell_DST_holds_investigate_first_2026_04_23.md` forbids. |

**The lazy "transient CI" bucket that includes both is itself an
anti-pattern.** It lets test flakes slip past as "noise" rather
than being captured as bugs that DST is supposed to surface.
That's the failure mode `Otto-248 (never ignore flakes)` + the
DST-everywhere baseline are designed to prevent.

**Vocabulary discipline (use these exact words):**

- "External-infra failure" or "upstream-mirror flake" — for the
  network-boundary class. Reruns are correct.
- "Test failure" or "non-determinism in tests" — for the
  in-code class. Investigations are correct; reruns are
  smoke covering bugs.
- **NEVER "transient CI"** as a bucket label. The word
  "transient" is the lazy sleight-of-hand that conflates the
  two and lets flakes hide.

**Why:** Aaron 2026-04-28 caught me using *"mostly probably
transient CI; a few may need real fixes"* in a tick summary.
Translation he asked: *"transient CI what does this mean
flakey test?"* — pointing out that "transient CI" reads as
"flake-acceptable" framing, which directly contradicts
Otto-248's never-ignore-flakes discipline. The right framing
distinguishes the two failure classes upfront.

This is application-failure pattern not knowledge-gap (per
Otto-275-FOREVER): the rule was already implicit in
Otto-248 + Otto-272 + the retries-are-non-determinism-smell
memory. I just hadn't applied it to my CI-failure-bucket
vocabulary. Lazy categorisation enables future flake-tolerance.

**How to apply:**

1. **In tick summaries / commit messages / PR descriptions /
   review-thread analyses**: when describing a failing check,
   classify it as either *external-infra* or *test failure*
   explicitly. If unsure, investigate before assuming.

   **Hardened verify-first rule (Aaron 2026-04-28: "do you
   check before you rerun?"):** before asserting any failure
   is external-infra, **read the failure log first**:

   ```bash
   gh run view <run-id> --repo <owner>/<repo> --log-failed \
     | grep -iE "(error|curl|timeout|exit|failed|FAIL)" | head -10
   ```

   Confirm the actual failure cause. Only after seeing the
   concrete external-infra signature (e.g., `curl: (22) The
   requested URL returned error: 502` from upstream package
   mirror) is the "external-infra → rerun" path correct.

   If the log shows an assertion error, a Python traceback in
   a test, an FsCheck shrink output, a shell exit-1 from our
   own script — that's a test failure class. File it as a
   bug. Phrase the assertion as evidence-based: "the failure
   log shows `curl 502` from `nuget.org`, classifying as
   external-infra; rerunning" — not "this is probably
   transient; rerun."

   `gh run rerun --failed` is correct ONLY after the verify
   step. Skipping verify and assuming "probably transient"
   IS the anti-pattern Aaron flagged.

   Bad:
   > "6 BLOCKED-with-1-failing = diagnose CI (mostly
   > probably transient CI; a few may need real fixes)"

   Good:
   > "6 BLOCKED-with-1-failing = diagnose: of those, N are
   > external-infra failures (rerun), M are test failures
   > requiring root-cause investigation."

2. **When seeing a 'rerun made it pass' result**: do NOT call
   it transient. If the failure was external-infra, name that
   specifically (the upstream incident, the curl 502, the
   timeout). If it was a test, file it as a bug to investigate
   per Otto-248.

3. **Future-self check**: writing the word "transient" in any
   CI-failure context — pause. Replace with the specific class
   name (external-infra OR test-non-determinism). The pause is
   the discipline.

**Composes with:**

- `memory/feedback_retries_are_non_determinism_smell_DST_holds_investigate_first_2026_04_23.md`
  — the in-code-failures-are-bugs side; this rule says don't
  let "transient" vocabulary smuggle test flakes past it.
- The DST-everywhere baseline (Otto-272) and never-ignore-
  flakes discipline (Otto-248) — substrate that depends on
  vocabulary clarity to actually fire.
- `memory/feedback_no_trailing_questions_aaron_stop_asking_what_to_do_2026_04_28.md`
  — same family of substrate-IS-identity failures: lazy word
  choice IS the anti-pattern, regardless of intent.

**Does NOT mean:**

- Does NOT mean every check failure requires a deep
  investigation before rerun. External-infra failures are
  legitimate reruns. The discipline is naming them correctly.
- Does NOT mean retries are forbidden — the GitHub Actions
  runner has built-in retry for transient host issues. The
  rule is about how WE characterize failures in our prose.
