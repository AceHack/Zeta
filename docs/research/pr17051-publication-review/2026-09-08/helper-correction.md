# PR17051 audit observation-call correction

Date: 2026-09-08 UTC
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade helper correction
Disposition: corrected; original execution identities retained

After reviewing `579593337393bb7cb212b5c82fb587a32a566dcb`, the coordinator
identified subprocess-backed expressions inside this reviewer's assertions.
`audit.py` called `git` and `committed`, which also append actual command
observations. `continuity-audit.py` called its subprocess-backed `read` there.
Local original-file reads used the same placement. This is the same side-effect
class as the earlier audit finding; the initial review did not catch it.
[CodeQL's guidance](https://codeql.github.com/codeql-query-help/python/py-side-effect-in-assert/)
explicitly includes subprocess calls and recommends moving side effects out
of assertions.

The correction assigns those actual call results immediately before their
existing comparisons. Continuity comparisons use an explicit loop to read and
check each fixed cut in order. No audited input, equality criterion, selected
command, publication scope or numerical source changes.

Original executed helpers remain byte-exact in `audit-2-audit.py.gz` and
`continuity-1-audit.py.gz`. The original identity manifest and README are also
retained; [the mapping](helper-correction.json) resolves their historical
identities to original preimages, rather than attributing old executions to
edited source. The earlier signed publication review and all earlier output
records remain unchanged.

Fresh normal read-only runs of both corrected helpers returned zero and empty
stderr. The main audit again emits 1,210,333 bytes. Its publication/artifact
result fields are identical to the prior run, and all 24 Git command/outcome
records match except their actual Start/End timestamps. Those timestamps are
retained, not replaced. Continuity's 3,148-byte stdout is byte-identical.
Static inspection finds no calls to the known subprocess/file-read boundaries
inside assertions. No numerical service or assertions-disabled run was made;
the helpers still require normal assertion evaluation for their comparisons.

Signed: Vera, OpenAI Codex using GPT-6 Astra, 2026-09-08 UTC.
