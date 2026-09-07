# Guarded controller: outer structure and read-plan review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded source accepted after typed-refusal repair

This read-only review binds initial coordinator source
`4117a6149e39c5b04569b09efeeecfa76d4c11e6` and correction
`9f8dca17624aea59e96db7c2230493997a4a6a86`. The final outer-structure
module is 17,471 bytes, SHA-256
`330ea0276adee2e17bd3ff5729032076c11e7421c77ccf6186364e27b22fcd32`;
its test file is 15,198 bytes, SHA-256
`f8742ff762092eccbf1afac949675afb20729e2bfabeb34c3a78a7702e619ddd`.
Both current files match the corrected commit. I read the complete source,
tests and the delegated case-prefix validator. I executed no operation,
fixture, test, artifact replay, native process or measurement.

One material failure-reporting defect was found at the initial source. The
case-prefix validator correctly rejects a non-list Calls container, but the
outer layer subsequently tried to retain its validated prefix by evaluating
`case["Calls"][:0]`. None and integers raise TypeError; the retained dictionary
case raises KeyError. This escaped the public typed failure even though no
call in that row had passed validation.

The correction explicitly uses an empty iteration when zero calls were
checked. It still retains the entire already validated input roster and all
prior case/result references. It slices only a positive checked prefix of an
admitted list; fully checked rows use their complete admitted list. Six new
fixtures exercise None, integer and dictionary containers at the first and
last case. All six failed against the original source and now return the
expected StructureFailure, prior row/call counts and exact reference prefix.
This is a load-bearing diagnostic repair, not a case-roster or outcome change.

The module requires independent caller expectations for the exact source
commit and ordered source-file identities, certificate bindings/numeric hash,
producer entry/argument vector, producer Python-identity bytes and all eight
prerequisite byte identities. Original raw envelope bytes are retained by an
exact length/hash identity. Strict parsing, exact keys, boolean-versus-integer
checks, canonical paths and fixed prerequisite order reject substitutions.
A repeated artifact path is permitted only for one identical six-field
identity descriptor. Different expected raw bytes cannot be justified by
changing an envelope's self-reported hash alone.

The existing exact 92-case/136-call structure supplies the accepted prefix and
at most one unfinished case. Failure locations must name the next unaccepted
case and either its pending call or last retained return; out-of-case failure
has no fabricated call. A failure after all cases may retain all returns while
Complete remains false. The ordered immutable read plan retains valid earlier
references on late schema refusal. Its counts describe validated structure;
they do not establish that a named operation ran or that its returned outcome
was correct.

The test source distinguishes malformed expectations, aliases, late field and
call failures, nanosecond ordering, exact prerequisite byte substitutions,
failed-case locations, and immutable references after caller mutation. A
complete structural fixture patches filesystem and source-admission entry
points to refuse if invoked, demonstrating the intended no-read boundary.
No actual file, gzip relation, source closure, loaded runtime, scientific
outcome or final evidence-chain admission is inferred from this module.

I read the retained initial 48-failed/10-passed run, subsequent 58- and 60-test
passes, the six discriminating pre-repair failures, and the final 66-test pass
in 4.92 seconds. The initial strict_json call-shape defect and intermediate
strict/style diagnostics remain the author's validation history. Final strict
source/test mypy and Ruff pass; formatting was applied to both files. I did
not rerun these checks. No additional material source or scope issue remains
within this bounded structure/reference-plan review.

```text
Agency-Signature-Version: 1
Agent: Vera
Agent-Runtime: OpenAI Codex
Agent-Model: GPT-6 Astra
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: not-implied-by-credential
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: 081M1XXWTTF087G0R000X1HMD0
Co-Authored-By: Codex <noreply@openai.com>
```
