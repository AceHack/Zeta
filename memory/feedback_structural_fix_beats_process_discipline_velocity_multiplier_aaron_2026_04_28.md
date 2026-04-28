---
name: Structural fix beats process discipline — first ask "can this failure class be eliminated in code?" before landing a runtime rule
description: When a recurring failure class surfaces (e.g., curl 502 from upstream during CI install, lazy "transient" vocabulary, manual-verify-before-rerun), the first instinct should be "can this be eliminated structurally — by changing the code / config / infrastructure?" — NOT "land a process discipline that the agent must remember to apply." Process disciplines (vigilance rules, verify-first checklists, vocabulary lints) decay; structural fixes (retry-with-backoff inside the script, helper extraction, idempotent guards) don't. Aaron 2026-04-28: *"Structural fix beats workflow-rerun discipline, you knew this already or shoud have i've told you before"* + *"this is how you get velocity."* Velocity comes from removing failure classes once-and-for-all, not from disciplining the agent to handle each instance manually. Composes with Otto-341 mechanism-over-vigilance but generalises it: mechanism-over-vigilance is for agent discipline; this is for FAILURE HANDLING — fix the code first, fall back to process discipline only when structural fix isn't available.
type: feedback
---

# Structural fix beats process discipline (velocity multiplier)

**Rule:** when a recurring failure class surfaces, the **first
question is "can this be eliminated structurally?"** — by
changing the code, config, infrastructure, or workflow shape.
Only fall back to a process discipline (verify-first checklist,
vocabulary rule, manual-rerun procedure, vigilance reflex) when
the structural fix isn't available or is significantly more
expensive than the runtime rule.

**Why velocity:** structural fixes remove a failure class
**once-and-for-all**. Process disciplines require remembering
the rule on every instance. Vigilance decays; substrate doesn't
(per Otto-341 mechanism-over-vigilance + Otto-275-FOREVER
knowing-rule-≠-applying-rule). Each structural fix is a
permanent capability gain; each process discipline is a
recurring tax.

**Why this rule needed to land** (Aaron 2026-04-28): I'd been
shipping process disciplines as primary corrections this session
when structural fixes were available:

- "Lazy 'transient CI' vocabulary" → I shipped vocabulary-
  discipline memory ("never use 'transient' as a bucket label").
  Aaron's better question: *"why should a PR ever fail for this?
  our code does not handle the retries already?"* — the
  structural fix was missing curl `--retry` flags in 3 of 4
  install scripts. After the structural fix, the failure class
  is gone — the vocabulary discipline becomes a footnote, not a
  load-bearing rule.

- "Verify failure log before rerun" → I shipped verify-first
  process discipline. Aaron's better question: was actually the
  same as above — the verify step exists to triage between
  external-infra and test failure, but if external-infra
  failures are absorbed structurally, the verify step is rarely
  needed.

- The Aaron correction: *"Structural fix beats workflow-rerun
  discipline, you knew this already or shoud have i've told you
  before"* + *"this is how you get velocity."* The pattern
  was implicit in mechanism-over-vigilance but I hadn't
  generalised it from agent-discipline to failure-handling.

**How to apply** (every recurring failure class triggers this
flow):

1. **Name the failure class explicitly** (one sentence).
2. **Ask: can this be eliminated structurally?**
   - Change the code (e.g., add retries, idempotent guards,
     fallback paths).
   - Change the config (e.g., GitHub Actions `continue-on-error`
     where appropriate, runner pool selection).
   - Change the infrastructure (e.g., upstream cache, mirror,
     workflow-level concurrency settings).
   - Change the workflow shape (e.g., split a step that fails
     for two distinct reasons into two steps).
3. **If structural fix is available + bounded cost: ship it
   first.** This is the velocity move.
4. **If structural fix is unavailable / high-cost: fall back to
   process discipline.** Land it as memory + apply via
   cadenced-reread + prefer mechanism over vigilance where
   tooled.
5. **Track the structural fixes in a session-level log** so
   future-self can see "this whole class is fixed — the
   process-discipline below applies only to OTHER instances."

**Diagnostic tell:** if your reflex on a recurring failure is
"add a verify-first / never-do-X / always-check-Y rule for
agents to follow," pause and ask "can the failure be eliminated
in code first?" The agent-discipline rule is the second-best
answer if structural-fix is unavailable.

**Concrete velocity proof point** (the curl 502 case
2026-04-28): one PR adding `tools/setup/common/curl-fetch.sh`
+ refactoring 4 call sites permanently absorbs the upstream-
mirror-5xx failure class for the install path. The companion
process-discipline memory (verify-first before rerun) goes from
"applied to every CI failure" to "applied to OTHER classes that
don't have a structural fix yet." Net result: less rule to
remember, fewer manual reruns, less time spent on triage.

**Composes with:**

- `feedback_otto_341_lint_suppression_is_self_deception_noise_signal_or_underlying_fix_greenfield_large_refactors_welcome_training_data_human_shortcut_bias_2026_04_26.md`
  (Otto-341 mechanism-over-vigilance is about agent
  discipline; this rule generalises to failure handling).
- `feedback_otto_275_forever_manufactured_patience_live_lock_9th_pattern_2026_04_26.md`
  (knowing-rule-≠-applying-rule; structural fixes don't
  depend on application).
- `feedback_transient_ci_external_infra_only_test_failures_are_bugs_not_flakes_2026_04_28.md`
  (the verify-first discipline that prompted Aaron to point at
  the structural alternative). Now scoped to "OTHER classes
  beyond curl-from-install."

**Does NOT mean:**

- Does NOT mean process disciplines are useless. They're the
  fallback when structural fix isn't available. The order is:
  structural-fix-first; process-discipline-second.
- Does NOT mean ship structural fixes without thinking. The
  bar is "bounded cost + permanent class-elimination." A
  90%-cost fix for a 10%-class isn't worth it.
- Does NOT excuse skipping verification on the structural
  fix itself. The structural fix is code change; it gets
  reviewed + tested like any other change.
