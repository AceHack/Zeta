# Integrated case and interval source validation

Date: 2026-09-08 UTC
Operational status: research-grade implementation evidence
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

The existing project Python environment ran both dedicated suites together:
31 case-adapter controls plus 42 interval controls, all 73 passed in the
pytest-reported 4.34 seconds (5.295 seconds enclosing process). The
[manifest](manifest.json) retains the actual invocation, source head, stdout,
stderr and exit zero. No solver comparison or native process was invoked.

The [interval-core review](../../../2026-09-08-projection-interval-core-independent-review.md)
and [case-adapter review](../../../2026-09-08-projection-case-adapter-independent-review.md)
accept their separate source and custody boundaries. The original unit-test
failures and corrections remain in each component's linked record. Planned
40-case/88-call counts remain a preregistered roster, not an execution result.
