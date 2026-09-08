# Guarded hidden-switch compilation: exact outer structure

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: reviewed pure structure/read-plan primitive; actual reads/replay separate

The [outer structure module](../../src/Interp.Python/zeta_interp/hidden_switch_compiled_outer_structure.py)
checks the exact frozen outer schema against independently supplied source,
certificate, producer-entry/arguments and prerequisite byte identities. A
producer cannot substitute the complete bytes of its identity or one of the
eight prerequisites by refreshing only its own descriptor. Source membership,
ordering and every declared byte/hash pair must match the caller's expectation.
The caller must establish those expectations separately; copying them from the
checked envelope would not meet this API's admission premise.

The output is an immutable ordered artifact read plan. It reads no files,
executes no producer-named operation and does not inspect or admit loaded Python
identity contents. Actual strict reads, successful entry-identity admission,
complete operation replay and source/runtime admission remain separate duties.
Every admitted result names these omissions explicitly. A syntactically correct
92-case/136-call record is therefore a structural result, not conformance proof.

Failure metadata must agree with the first unaccepted case and the pending or
last retained call. Before/between cases and after all cases, a null case/call
can record a global failure. A retained failed-case row must name that case.
Late malformed fields retain earlier checked case/call counts and artifact
references; a refusal in a call row also retains that case's already checked
inputs and earlier call references. An alias may share one exact descriptor;
conflicting descriptions of one file refuse. The original raw input and its
actual artifacts remain the caller's retention responsibility.

At `4117a6149e39c5b04569b09efeeecfa76d4c11e6`, all 60 tests pass in
5.64 seconds, with strict source/test mypy and configured Ruff/format checks
passing. Tests cover a complete synthetic schema, independent whole-byte
substitutions, one-nanosecond chronology, exact booleans, source/order changes,
late failures, all admitted failed-call prefix shapes and forbidden file reads.
No actual native operation, complete outer fixture run or registered source is
part of this pure suite.

The [lossless inventory](hidden-switch-compiled-validation/2026-09-07/outer-structure/manifest.json)
retains 17 diagnostics and two final source identities. The first file-writing
command used the wrong working-directory-relative path and the formatter found
no file. The initial executed suite then had 48 failures and ten passes because
a draft called the existing keyword-only JSON API with a positional path.
Mypy also found a reused local pair annotation and a test's unexported module
alias. The ordinary repair uses the actual API and directly imported module;
all 58 initial tests passed in 4.42 seconds. Two additional late-prefix tests
then passed with the final 60-case suite. Initial uncommitted drafts are not
claimed as archived source pins; their actual diagnostic logs remain retained.
Only the explicitly selected C408 test-dictionary literal rewrite was applied;
no chronology/pairwise rewrite or broad unsafe source fix was used.

## Accepted malformed-call-container correction

Independent [source review](2026-09-07-hidden-switch-compiled-outer-structure-review.md)
found that preserving a zero-call prefix sliced the original `Calls` value even
when it was null, an integer or an object. The inner checker returned a typed
refusal, but the retention wrapper then raised. All six new regressions at the
first/final row failed against the original source. Repair
`9f8dca17624aea59e96db7c2230493997a4a6a86` uses an explicit empty iteration
when no calls were checked, retaining the already validated inputs. All 66
tests pass in 4.92 seconds with strict checks passing; independent review
accepted the exact repair. The [separate lossless inventory](hidden-switch-compiled-validation/2026-09-07/outer-structure-repair/manifest.json)
retains both outcomes and corrected source pins. No original evidence was
rewritten or promoted to whole outer conformance.
