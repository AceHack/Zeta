# Guarded hidden-switch compilation: input-binding source review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, independent reference writer
Artifact status: bounded read-only source acceptance; actual phase admission pending

The independent review accepts coordinator source
`bdeb180c1dbc9766ec90e4f79941ce348995d605` with no material finding in this
scope. The complete input-binding module and its test file were read at that
exact commit. This reviews the shared primitive and seven-subject synthetic
adapter required by the [accepted outer-negative design](2026-09-07-hidden-switch-compiled-outer-negative-design.md).
It does not admit the complete 92-case coordinator envelope, scientific phase
schemas, filesystem acquisition, a native runtime or a measured run.

## Exact reviewed source

| Repository-relative file | Bytes | SHA256 |
| --- | ---: | --- |
| `src/Interp.Python/zeta_interp/hidden_switch_compiled_bindings.py` | 14671 | `14A91DEEA826EB94F40407B269124D734C5A1AF754B1A7A5036216033AB4C14F` |
| `src/Interp.Python/tests/test_hidden_switch_compiled_bindings.py` | 15607 | `70FE51D15C62094BA2139D1BC653D2E9BBE12AFC824297AE6846DF896B9FB92A` |

These identities were independently recomputed from `git show` at the pinned
commit and agree with the author's binding-subjects manifest. No task module
was imported or executed by this reviewer.

## Accepted properties and discriminators

`admit_binding_subject` first validates the actual stored/original artifact
relation, then compares the complete original bytes against the independently
expected length and SHA256. It parses Role, Context and ordered Inputs from
those same immutable original bytes. There is no detached-metadata parameter.
The actual role, all four context fields and all ordered upstream inputs are
checked against separately supplied expectations. Extra phase fields remain
the eventual phase parser's responsibility; the primitive does not claim that
those fields have been admitted.

The synthetic adapter invokes this primitive for all seven ordered subjects,
requires exact materialized-file and nested subject rosters, and admits only
the exact Witness0 payload. CompletedSubjects counts whole admitted subjects.
A late timeline refusal therefore retains seven completed subjects without
claiming overall success.

The two lexical mutations preserve the decoded JSON tree and refresh their
ordinary artifact descriptors while retaining the independently expected raw
input identity. Each actual adapter call fails specifically with
`input-envelope-bytes` at `Records[6].Expected.Subject`. The fixture replaces
only the private complete-byte comparator; its resulting actual acceptance
then fails the real negative-outcome checker. There is no production bypass
flag. These cases distinguish a missing raw-byte check from a semantic-shape
refusal, within the ordinary trusted Python execution assumptions.

The chronology implementation uses `pairwise(TIMELINE_FIELDS[3:])` for the
cost-start suffix and explicitly adds finish-to-closure, finish-to-exit and
both closure/exit-to-cost edges. It imposes neither ordering between closure
and exit. The exchanged-order positive control and individual one-nanosecond
edge violations are discriminating; equality remains allowed. Metadata,
every expected-hash position, upstream-order, roster, bool-versus-int and
strict raw-JSON mutations retain meaningful refusal coverage.

## Validation provenance and limits

The author reported 57 passing cases in 4.09 seconds and clean strict mypy,
Ruff and format checks at the final pin. This reviewer read the retained
test/style history and verified all 14 stored/original log byte-count and
SHA256 pairs against its manifest; the reviewer did not rerun those checks.

The first run passed 57 cases while Ruff reported 11 style findings. Its
unsafe zip-to-pairwise rewrite dropped the timeline slice. The next retained
run passed 56 cases and failed the existing closure/exit positive control.
The failed checkpoint `85f89d62f0d9bc5fe00c4ac2f743d93dac4a0bcf` remains
preserved; the final successor restores the slice. Acceptance applies to the
repaired pin, and does not relabel the intermediate failure as a pass.

This is source review and retained-evidence inspection. No reviewer tests,
policy calls, native targets, debugger/dump reads, registered source tapes or
cost measurements were performed. Shared parsing/artifact helpers remain
separately reviewed dependencies; these supplied-byte checks do not prove
file provenance, future immutability, hostile-interpreter isolation, complete
scientific-envelope admission or runtime-body closure.

Signed: Vera, OpenAI Codex using GPT-6 Astra, independent source reviewer.
