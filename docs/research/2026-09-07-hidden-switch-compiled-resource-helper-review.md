# Guarded hidden-switch compilation: shared resource helper review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, independent reference writer
Artifact status: bounded read-only source acceptance; no measured cost admission

The shared-ratio change at `1fece22bc84153dae0128c3a90bbca2ed09772dc` is
accepted with no material finding. The reviewer read the complete cost-ledger
module and tests, the exact change, and the pinned integer/median helper
definitions. This review addresses the shared production calls required by
the [outer-negative resource cases](2026-09-07-hidden-switch-compiled-outer-negative-design.md#n-six-resourcedecision-domain-cases).

| Repository-relative file | Bytes | SHA256 |
| --- | ---: | --- |
| `src/Interp.Python/zeta_interp/hidden_switch_compiled_cost_ledgers.py` | 9185 | `EDEC1120FCF4FFBF199E3B0EE0831B1F18ED08E573B5E0CF876E3FC5BCE69F8E` |
| `src/Interp.Python/tests/test_hidden_switch_compiled_cost_ledgers.py` | 12146 | `EF8020A1752CEE40A181C30A91BCD3CD9DEAEB4A09345752FC9FA74FD9215FAB` |
| `src/Interp.Python/zeta_interp/hidden_switch_compiled_admission.py` | 14129 | `BD5BFEAA68735581E17BCEEB01C24AC0AF975021F35302DCBD76E30B2211EE91` |

The identities were independently recomputed from the pinned Git bytes. The
admission module is an unchanged dependency; only its relevant integer and
median definitions were re-read in this pass.

`descriptive_ratio` validates exact bounded integer inputs and a declared
metric before gcd reduction. Positive-denominator zero numerators yield 0/1;
CPU/allocation zero denominators retain actual totals and null plus a named
reason. A zero native wall denominator refuses. No floating division or
fixed-width intermediate multiplication is used. Positive wall observations
for every measured row remain separately required by timing admission; this
ratio helper alone does not admit a measured row.

The production cost-ledger path now calls that same helper and the actual
`half_median` boundary. It retains its raw median pairs and computes the four
required ordinary panel wall/allocation conditions independently. A zero
required native allocation median retains the complete valid ledger but marks
its required condition `refused`, distinct from `not-met`. Descriptive CPU
unavailability does not weaken those conditions. Boundary and whole-episode
ratios remain descriptive.

The injected typed-refusal tests discriminate removal of either shared call
from the production path. Existing tests distinguish ratio of medians from
median of paired ratios, prohibit panel pooling, exercise one-unit threshold
separation above binary64's exact-integer range, and preserve zero numerator,
zero denominator and late-row failure meanings. The complete 50-row roster
and precise grouping supply exactly five observations per comparison.

The author reported 89 passing tests in 4.01 seconds and clean strict mypy,
Ruff and format checks. This reviewer executed no tests, policy, source tapes
or measurements. Source acceptance and synthetic resource cases do not admit
actual outputs, warmups, allocation boundaries, process chronology, runtime
identity or a scientific speed claim.

Signed: Vera, OpenAI Codex using GPT-6 Astra, independent source reviewer.
