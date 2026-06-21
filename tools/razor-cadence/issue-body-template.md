## Razor cadence -- daily fire

This issue is the durable artifact of the razor-cadence trigger
(`.github/workflows/razor-cadence.yml`). It fires daily whether or
not any AI is running, so the discipline does not depend on
agent-remembering-to-check.

### Cadence checklist (run on next wake)

For each load-bearing rule encoded since the last razor pass:

1. **Test 1 (operational form)**: what observable variable
   determines whether this claim is true? If no answer ->
   metaphysical -> cut. (Per
   `memory/feedback_razor_discipline_no_metaphysical_inference_only_operational_claims_rodney_razor_aaron_claudeai_2026_05_03.md`)

2. **Test 2 (dialectical-unfalsifiability)**: what observation
   would I treat as falsifying this claim? If "no observation
   could falsify it because every observation is consistent with
   some condition under which the claim holds" -> unfalsifiable
   -> cut OR specify falsification boundary. (Per
   `memory/feedback_dialectical_unfalsifiability_detection_razor_extension_holding_all_truths_failure_mode_aaron_2026_05_04.md`)

3. **Mechanization audit**: is this rule mechanized (linter,
   pre-commit hook, scheduled workflow, validator) or does it
   depend on agent-remembering? If the latter, file a backlog
   row for mechanization (per 081KQR4HQ0008QG0R001GAD29A itself; per
   `memory/feedback_orchestrator_pre_commit_verify_branch_rule_aaron_2026_05_04.md`
   the encoded-rule-alone failure mode).

4. **Composes-with audit**: does the rule's `Composes with`
   section point at existing files? Are the cross-references
   live or stale? Update or remove dead links.

5. **MEMORY.md index audit**: are recently-added memory files
   indexed in `memory/MEMORY.md`? The router's discoverability
   depends on it (per `memory/README.md`).

### Pointers

- `docs/active-trajectory.md` -- current trajectory state.
- `docs/backlog/P1/081KQR4HQ0008QG0R001GAD29A-github-actions-razor-cadence-trigger-aaron-2026-05-04.md`
  -- this row.
- `memory/feedback_dialectical_unfalsifiability_detection_razor_extension_holding_all_truths_failure_mode_aaron_2026_05_04.md`
  -- Test 2 razor extension.

### Resolving this issue

Close this issue when the razor pass has been run. The next
cadence fire will open a new issue (or update the next-day's
artifact). Issues that age in the open state without being
closed indicate cadence-skip; that itself is a signal for the
maintainer.

---

Fired by `.github/workflows/razor-cadence.yml` run RUN_ID_PLACEHOLDER on TODAY_PLACEHOLDER.
