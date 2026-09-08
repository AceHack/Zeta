# Distributional rooms: fixed transcript validator review

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: active
Work item: 081M1Z63YMC087G0R003N5FH9X
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded repaired source acceptance; actual replay custody separate

I read the complete validator extension and its synthetic fixtures at
`6512494eb359645c3038235e9cd6498a4235fe6e`, then the separate repair at
`40833d9e85796f22e500800389aa4a09ef672161`. Final current files equal the
immutable repair blobs:

| Path under src/Interp.Python | Bytes | SHA-256 |
| --- | ---: | --- |
| zeta_interp/distributional_learning_rooms_reference.py | 37612 | c7b5d66066dd6a5a203c69e405871f5fae6948157a5f9d87ef03a5822a97e1c2 |
| tests/test_distributional_learning_rooms_reference.py | 32046 | 90886b2f6679601c70dc567f9381156b28526bc10d3e438355bb9c6db1c40413 |

The initial pin had respective source identities 37,293 bytes /
443ed32ab127fbf13f00d4fe272ff4c99ab7be1f949ba8e09ae553e2eebd8d88
and 31,040 bytes /
4298c38bf8cc3afcac9ead76ad24feb7e7e68f2bc617fa93fb61e299d0cad7c6.
Its plan was committed separately as
`037ed72b56ee86f9bdcfd8386010a107cff69292`. The earlier exact finite
reference and its [source review](2026-09-08-distributional-learning-room-reference-review.md)
remain distinct from this new transcript validator.

## Findings and repair

The first implementation checked final LF and total split-line count before
examining any record. Consequently, an otherwise complete transcript with
only the terminal LF removed refused with zero checked checkpoints and no
decoded prefix. A late excess-line suffix likewise erased the available
checked prefix. This contradicted the fixed plan's late-failure retention
requirement. I reported the source finding before any reviewer execution.

The repair moves framing checks into the bounded sequential loop. Type and
one-MiB whole-input admission remain early. A missing terminal LF now retains
25 checked records; a suffix following the complete terminal retains those
25 checkpoints, the terminal and the offending decoded row, refusing
AfterTerminal. Earlier semantic failures appropriately precede later framing
errors. Both discriminating fixtures failed against the initial source and
pass after repair; raw input always remains in the returned refusal.

The first actual validation also found an author-inferred assembly name was
wrong. Initial expectations named Core, Bayesian and the separate C# DynamicValue
assembly. The script actually selects typeof<PS.Rational>, typeof<Gaussian>
and typeof<Zeta.Core.DynamicValue>; the latter DU is defined in
src/Core/DynamicValue.fs, so the order is Core, Bayesian, Core. I independently
confirmed these source sites after the actual failure. My initial source pass
also did not catch this namespace/assembly inference.

The initial actual ordinary validation retained 25 checked checkpoints and
refused at Lines[25].Receipt.Runtime.LoadedAssemblies[2].Name. All three fault
validations refused their ordinary prerequisite; invalid-control accepted.
Those are validator expectation failures, not failures of the already retained
native room streams. The repair requires the correct three ordered names and
exact equality of every first/third assembly metadata field. A third regression
fails on the old source and discriminates a changed repeated hash afterward.

The author retained all three before-repair failures (5.10 seconds), then
124 passing cases (3.51 seconds), strict two-file mypy and clean Ruff/format.
Earlier development history remains: 119 passes plus one overly specific
depth-error-code fixture failure, four test typing diagnostics, eight
immediately-used closure lint diagnostics, a corrected 120-case pass and
the initial pinned 121-case pass. Allowing either a parser refusal or a
fixed-shape refusal for syntactically valid deeply nested wrong-shaped input
does not permit success. I read these logs and did not rerun tests.

## Accepted content boundary

The public API performs no process launch, file read or producer-selected
dispatch. It accepts only the fixed ordinary, fault-2/12/25 and invalid-control
modes. Bounded strict UTF-8/JSON rejects duplicate keys, exponent overflow,
nonfinite constants and surrogate strings. Integer counters exclude bool and
float; lexical -0 becomes negative floating zero and refuses integer positions.
Declared double fields accept finite numeric tokens because integral-valued
F# doubles serialize as integer JSON lexemes. Outside SoftValue, expected
binary64 values, including zero sign, match exactly.

Expectations come from the independently reviewed fixed reference and explicit
known-answer room formulas. All 25 checkpoint identities, order and complete
value shapes are checked. Gaussian moments, repeated-message consensus,
exact rational inference shares, six priority/direct prediction pairs and
the sixteen summary rows remain separate observations. Posterior masses and
maximums alone use the declared absolute 1e-12 allowance, with exact [0,1]
bounds, an independently computed sum and observed maximum comparison.
No relative tolerance or arbitrary field omission is introduced.

Every summary observation is also bound to its actual checkpoint value with
exact decoded types and floating bits. Budget summaries retain exact posterior
mass and full-report equality against their direct controls; an attention
report cannot be called equal merely because its sets coincide. This prevents
two separately plausible but inconsistent checkpoint/summary reports passing.
FiniteReference is compared in full with a fresh fixed reference result.

Fault validation first revalidates complete ordinary bytes, retains that
result and requires byte-identical checkpoint-line prefixes. Each terminal
has the exact schema, selected counts, failure/receipt/completion fields and
null pending-event fields. Unexpected I/O or serialization-failure terminals
are retained refusals outside these fixed control modes. A terminal cannot
authorize following rows, and a prefix cannot become whole success.

Runtime checks admit only the stated metadata shape and repeated-assembly
consistency. Version strings and file hashes do not prove actual loading,
source-to-binary correspondence or complete runtime closure. RoomRunValidated
explicitly leaves process exits, raw-artifact and source custody to the caller.
The [native source/exit review](2026-09-08-distributional-learning-zeta-room-source-review.md)
is a separate observation, not supplied by these flags.

No material source blocker remains at 40833. This acceptance is not an audit
of the forthcoming repaired actual replay archive, and no new native process,
registered source stream or scientific measurement ran in this reviewer lane.

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
Task: 081M1Z63YMC087G0R003N5FH9X
Co-Authored-By: Codex <noreply@openai.com>
```
