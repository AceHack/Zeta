# Guarded hidden-switch compilation: actual outer artifact reads

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: reviewed strict read primitive; operation replay remains pending

The [artifact reader](../../src/Interp.Python/zeta_interp/hidden_switch_compiled_outer_artifacts.py)
first checks the exact outer structure and its independent expected identities.
Only then does it execute the existing strict owned-root artifact reader for
each unique file. Every actual returned value is retained before later checks;
a typed refusal, untyped result, inconsistent admitted bytes or ordinary raised
exception leaves the complete earlier read prefix and first failure available.
A missing return is explicitly distinct from a returned negative result.

Aliases use the exact original bytes retained by the first read. They do not
trigger a second read or claim the path remains unchanged afterward. The reader
charges original envelope length plus declared stored and original lengths of
each unique artifact before reading it, against a 256 MiB implementation limit.
The amount reserved for a failed read remains charged. This finite retention
budget is distinct from an OS memory quota: parser objects, Python overhead
and the caller's input allocation are outside that accounting.

The result binds actual strict artifact reads, including gzip relation and both
stored/original identities. It neither admits the contents as successful loaded
Python identity nor executes the 136 conformance operations. Source/runtime
admission and complete operation replay remain explicit separate duties. Its
fixtures use synthetic outer schemas and tiny controlled artifacts, not a
registered behavioral/cost source or an actual complete outer conformance run.

At `8c50250f8978e159be049c400973933ae638c22a`, the initial 23 tests passed
in 4.55 seconds with strict mypy and configured Ruff/format checks. Independent
review found that the helper-exception boundary omitted custom ordinary
exceptions and `KeyError`; both late-reader regressions failed against that
source. Repair `0e0008386865202805ab32450c298be9049228a9` retains ordinary
`Exception` values as raised observations, while leaving `BaseException`
control flow outside the contract. All 25 tests pass in 4.05 seconds, with
strict checks passing. The narrow documented BLE001 exception is local to
this helper-return boundary, consistent with the separately reviewed store.

The [lossless inventory](hidden-switch-compiled-validation/2026-09-07/outer-artifacts/manifest.json)
retains 20 artifacts, both original/corrected source groups and the exact
outer-structure test-helper identity. It includes all three actual owned trees:
500 entries/1,022 regular bytes for the initial suite, 21/36 for the failing
regressions, and 521/1,058 for the final suite. Symlinks are preserved as links.
The tests cover the complete read plan, aliases after a file changes, late
missing/symlink/changed/oversized files, complete and trailing-member gzip,
pre-read aggregate refusal, independent identity refusal before any read,
and typed/untyped/raised return distinctions. No failed record was rewritten.

The [independent acceptance](2026-09-07-hidden-switch-compiled-outer-artifact-review.md)
binds the corrected source and both failing regression witnesses.
