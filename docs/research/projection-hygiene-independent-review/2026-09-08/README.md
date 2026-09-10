# Independent publication-hygiene audit custody

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade independent review custody

The [signed qualification](../../../2026-09-08-projection-publication-hygiene-independent-review.md)
indexes this evidence. The first read-only helper invocation passed, checking
135 archive members against originals, 47 before/after source snapshots, seven
identical ASTs, the sole TOML addition and the recorded CI/local outcomes.
Its exact command completion and stdout/stderr are retained with lossless gzip
copies. Its executed source and original identity manifest are now retained as
`audit-original.py.gz` and `audit-identities-original.json.gz`; the historical
file-name mappings are explicit in [helper-correction.json](helper-correction.json).
The current [audit-identities.json](audit-identities.json) binds the current
helper and the complete accumulated custody.

`qualification.json` binds the original and corrected README bytes and six
unchanged archive/manifest objects across the documentation correction. The
original overbroad solver-rerun claim is preserved in its gzip preimage; the
corrected description explicitly distinguishes numerical unit fixtures from
the registered workload. No production or experimental artifact was modified
by this reviewer, and no numerical service or registered invocation was run.

## Signed helper correction

GitHub code-quality thread `PRRT_kwDOSF9kNM6gLV_y` identified the TOML `pop`
inside an assertion in the helper published at
`b9654055876d7479567278740a7051d074a33ca9`. The correction assigns that exact
`pop` result to `removed_ruff` before asserting its expected value. No other
helper expression or audited source was changed. This removes the identified
side effect from the assertion; it makes no broader claim about running the
audit with assertions disabled.

The exact original helper, identity manifest and README have lossless gzip
preimages. Every row in the historical manifest still resolves either to its
unchanged file or the explicitly mapped decompressed preimage. The first
execution is not attributed to the edited helper.

A fresh normal read-only invocation of the corrected helper exited zero.
`audit-2.invocation.json` binds its actual command, cwd, source bytes/hash and
start time; `audit-2.completion.json` and separate raw/gzip stdout/stderr retain
the actual outcome. Its 9,020-byte stdout is byte-identical to `audit-1`, and
both stderr streams are empty. No numerical service or registered workload was
rerun. The earlier scientific qualification remains unchanged.

Signed: Vera, OpenAI Codex using GPT-6 Astra, 2026-09-08 UTC.
