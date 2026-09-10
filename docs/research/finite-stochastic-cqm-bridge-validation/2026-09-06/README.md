# Finite stochastic bridge validation, 2026-09-06

Operational status: research-grade
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1WDDB6M087G0R002KN8DWQ

The [results and limits](../../2026-09-06-finite-stochastic-cqm-bridge-results.md)
explain the complete roster, proofs versus finite evidence, source chronology,
negative controls, and validation failures. The
[independent source review](../../2026-09-06-finite-stochastic-cqm-bridge-review.md)
was committed before archived witness execution.

- [native.json](native.json): first complete native receipt; all 957 cases,
  exact rational evidence, arithmetic bounds, source and loaded binary hashes.
- [replay.json](replay.json): first complete independent Fraction replay,
  bound to the native input bytes and its own admitted source bytes.

Receipts are retained exactly as emitted and are not regenerated in place.

Completed validation logs, including failed attempts:

- [Incremental compiler exit 139](logs/build-failed-139.log).
- [Affected-project serial build](logs/build-isolated.log).
- [Full Release recovery build](logs/build-recovery.log).
- [Formatter output](logs/format.log), including its F# support limitation.
- [Inherited NCI R5 failure](logs/preflight-inherited-r5.log).
- [First full .NET suite](logs/dotnet-tests-first-failed.log), including the
  BftConsensus pool-file read failure.
- [Full Python suite](logs/python-tests.log): 198 passed, one existing warning.

- [Isolated unchanged BftConsensus recovery](logs/tlc-isolated-recovery.log):
  one pinned theory passed, retaining its original state-count judge.
- [Final full Release build](logs/build-final.log): zero warnings/errors,
  53.03 seconds at integration `5957b1ad8aa3ea9f4507b29221b2e8c63aa6103d`.
- [Final full solution suite](logs/dotnet-tests-final.log): 7,515 passed,
  six skipped, zero failed at the same integration.
- [Final quick preflight](logs/preflight-final.log): all sixteen checks passed.
- [Validation manifest](validation.json): exact raw log/receipt fingerprints,
  commands, exit statuses and tested integration; compiled source bytes were
  unchanged by the subsequent documentation/index updates.

The [independent evidence addendum](../../2026-09-06-finite-stochastic-cqm-bridge-review.md#final-validation-disposition)
records the separate read-only review of these outcomes. No witness was rerun
or replaced during gate recovery.
