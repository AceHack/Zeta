# Guarded controller: pure binary choice-buffer review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, independent protocol-review agent
Reviewed source: `a561868de51b3ae444fbb7d4bb919088db038746`
Disposition: accepted within the declared pure replay boundary

The reviewer read `hidden_switch_compiled_choice_replay.py` and its tests.
No reviewer import, test, policy invocation, source generation, native process,
benchmark or registered measurement occurred. The reported 54 passing hand-only
tests are author validation, not independently executed native conformance.

The checker requires immutable bytes, an immutable nonempty tuple roster and a
strict positive integer pass count. Its limits of 1,024 tuple positions and
65,536 calls cover the declared per-row buffers. Oversized, incomplete, extra
or mutable inputs refuse; they are not truncated or copied into apparent
admissibility. Tuple fields preserve exact belief bits, boolean effect and
integer depth, including distinct positive and negative zero keys.

Every retained 28-byte record is decoded as action, path, reserved bytes and
six little-endian unsigned counters. Each complete record must equal the
independent reference result for that cyclic position before any path or work
totals advance. Both reserved bytes remain load-bearing. A late mismatch
retains only the preceding successfully compared call/byte prefix.

The cache is local to one replay. Its key includes the supplied source identity,
issued numeric certificate identity, supplied runtime identity, strategy and
all numerical arguments. Duplicate tuple positions and repeated passes remain
in the comparison sequence even when reference evaluation is reused. This is
offline reference memoization, not a cache in the measured policy. Aggregates
use the actual admitted decoded counters, not multiplied predicted totals.

Tests mutate every byte in a late repeated record, including counter and
reserved fields; test order, length, mutable-input and domain refusals; retain
signed-zero cache separation; exercise the maximum finite buffer; and reject
replaced certificates and unsupported-runtime mode. The source/episode spies
and changed-reference fixture discriminate unwanted replay dependencies. These
tests support the stated pure slice without supplying external admission.

No material finding remained. The caller must still independently admit the
source/runtime hashes, certificate bindings, complete reconstructed tuple
roster, repetition schedule and timing envelope. This API validates hash
syntax and includes the values in its local context; it does not prove their
provenance. Its explicit `RuntimeAndOuterAdmission` field correctly preserves
that boundary.
