# Exact finite-distribution room reference

Date: 2026-09-08 (UTC).
Operational status: research-grade.
Lifecycle: active, independent exact reference and comparison contract.
Task: 081M1Z63YMC087G0R003N5FH9X.
Author: Vera, OpenAI Codex using GPT-6 Astra.

## Purpose and ownership

This note fixes the finite model and case inventory before implementation or
execution. The coordinator accepted this schema in chat and remotely co-claimed
exactly this note, the new Python module and its dedicated existing-directory
test file in ccd068619bbc9f4ea80d3ddb56c75b37574805ee. The author independently
verified that claim ref before writing. The writer is
Zeta-relational-identity-20260906, branch
codex/distributional-rooms-reference-20260908, session
codex/20260907-c7b2a403. The coordinator owns the independent F# room harness and
integration evidence. This module will import no compiled-controller reference,
native source or learning implementation.

The [coordinator direction](https://github.com/Lucent-Financial-Group/Zeta/blob/bd229f56aafb9a387285f59b198bb4b1bc6d5c2e/docs/research/2026-09-08-distributional-learning-resource-aware-integration-direction.md)
is the source-grounded motivation. The present finite examples concern loss
from retaining only two moments outside a restricted distribution family,
finite transport, and conditioning. They are neither learned performance nor
state-of-the-art comparisons. They are not continuous Liouville dynamics,
physical experiments or a claim that Gaussian moments are insufficient within
the Gaussian family. The earlier frozen compiled-controller study and its
unopened source streams are unaffected.

## Fixed model and ordered case inventory

The common ordered support is [-2, -1, 0, 1, 2], retaining all zero masses.
P has masses [0, 1/2, 0, 1/2, 0]. Q has masses [1/8, 0, 3/4, 0, 1/8].
Both have exact mean 0 and variance 1. The tail event is strictly
absolute value greater than 3/2; its probabilities are 0 and 1/4.

Actions, in tie order, are steady then tail-exposed. Their utility rows are
[0, 0, 0, 0, 0] and [-7, 1, 1, 1, -7]. Expected utilities are [0, 1] for P
and [0, -1] for Q. Maximization chooses tail-exposed for P and steady for Q.
The utility is supplied, fixed and distribution-sensitive. This is a finite
counterexample to identifying decision utility from just these moments,
not a general optimal representation theorem.

Transport uses the source-index-to-destination-index convention: mass at index
i moves to permutation[i]. The fixed permutation is [1, 2, 3, 4, 0] and its
inverse is [4, 0, 1, 2, 3]. Both compositions must be the identity. The ordered
rows are P/cycle then Q/cycle. Record forward masses, recovered masses, forward
mean and forward variance. Total mass and exact inverse recovery are required;
moments need not be invariant under this relabeling of support positions.

Conditioning order is P then Q, each with unit, soft, tail likelihoods:

| Likelihood ID | Values on the full support |
| --- | --- |
| unit | [1, 1, 1, 1, 1] |
| soft | [1/4, 1/2, 3/4, 1, 1/2] |
| tail | [1, 0, 0, 0, 1] |

All are supplied probabilities of a single event conditional on each atom.
Evidence is the sum of prior mass times likelihood; posterior divides those
products by evidence. Row IDs are P/unit, P/soft, P/tail, Q/unit, Q/soft, Q/tail.
P/tail alone returns ZeroEvidence. The five other rows return exact normalized
posteriors. No posterior is invented for the zero-evidence event. Multiplication
and normalization are separate from transport and generally have no inverse.

## Exact public contract

The three owned paths are
[src/Interp.Python/zeta_interp/distributional_learning_rooms_reference.py](../../src/Interp.Python/zeta_interp/distributional_learning_rooms_reference.py),
[src/Interp.Python/tests/test_distributional_learning_rooms_reference.py](../../src/Interp.Python/tests/test_distributional_learning_rooms_reference.py)
and this note. The two source links name planned files until the implementation
commit. No package, dependency, native project or test-wiring edit is needed.

Public numerical APIs are distribution, moments, decide, transport, condition,
encode_rational, decode_rational and reference_receipt. They return an own
immutable Success with Value or Failure with Code and Message. Inputs use exact
int or Fraction values, excluding bool and float. Finite tuples are checked
before arithmetic; caller-created distribution records are revalidated on every
public operation. These are ordinary same-process mathematical APIs, not a
hostile-object or memory-allocation boundary.

A wire rational is exactly {Num: string, Den: string}. Both are canonical base10
integer strings; denominator is positive, numerator permits a leading minus
only when negative, the integers are coprime, and zero is exactly 0/1. No
leading zeros, plus signs, whitespace or unreduced fractions are admitted.
No JSON numeric precision enters an exact mathematical quantity. Index arrays
and ActionIndex remain ordinary integers, never booleans.

The successful reference_receipt Value is a JSON-compatible dictionary with
exact fields and order below. Object key order is descriptive; array order is
part of the contract. Every rational entry below has the Num/Den form.

- Schema: zeta.distributional-rooms.reference.v1.
- Support: five rationals; Actions: two strings; Utilities: two rows of five
  rationals; TailEvent: {Kind: absolute-greater-than, Threshold: rational}.
- Distributions: two rows with exact keys Id, Mass, Mean, SecondMoment, Variance,
  TailProbability, ExpectedUtilities, ActionIndex, Action. Arrays have the fixed
  five/two entries above.
- Transport: Convention, Permutation, Inverse, Rows. Convention is exactly
  source-index-to-destination-index. Each of two Rows has Id, Distribution,
  ForwardMass, RecoveredMass, ForwardMean, ForwardVariance.
- Conditioning: six rows, each with Id, Distribution, LikelihoodId, Likelihood,
  Outcome. Successful Outcome is exactly {Kind: conditioned, Evidence: rational,
  Posterior: five rationals}. Refused Outcome is exactly {Kind: refused,
  Code: ZeroEvidence, Message: conditioning evidence is zero}.

No native observations, timing, source-admission booleans or learned claims
are embedded. Root will compare this complete finite projection field-for-field
and retain its actual Zeta Gaussian/consensus/priority observations separately.

## Fixed validation inventory before execution

The following validation families are fixed before source execution:

1. Exact full receipt versus an independently written literal expected DTO,
   deterministic repeat, canonical JSON round trip, every rational canonical.
2. P/Q moments, strict tail threshold and both utility choices; a shifted
   distribution distinguishes variance from second moment; an equal-utility
   control exercises the declared first-action tie rule.
3. Both transport rows, both inverse compositions, direction versus reversed
   pushforward, exact round trips, and changed moments.
4. All six conditioning rows, exact evidence/posteriors, constant-one identity,
   zero-evidence refusal, and discrimination against omitted normalization,
   uniform normalization or confusing likelihoods with a posterior.
5. Canonical rational round trips including negative and zero; refusals for
   wrong keys/types, bool, float, signed/leading zero, plus/whitespace, negative
   or zero denominator and unreduced fractions.
6. Distribution refusals for non-tuples, empty/mismatched support and mass,
   duplicate/unsorted support, negative or nonunit mass, and float/bool atoms.
   Forged public records are revalidated by every mathematical operation.
7. Transport refusals for wrong length, duplicate/range/bool indices and an
   inverse that is a permutation but not the actual inverse.
8. Conditioning refusals for ragged likelihoods, negative/above-one values and
   bool/float values. Decision refusals for duplicate/empty action names, ragged
   utility rows and bool/float utility values; tail thresholds refuse negatives.
9. Load-bearing mutation checks use deliberately wrong finite calculations:
   second moment as variance, unweighted utility, inverse transport direction,
   omitted Bayes normalization, and likelihood-only posterior. Each must differ
   from the corresponding actual exact operation result. No mutation is a new
   scientific arm or source draw.

Only these fixed hand calculations and ordinary module tests run in this lane.
No target/native process, policy episode, RNG stream or resource measurement
is authorized by this note. Focused pytest, strict mypy and Ruff/format are the
relevant source checks. Root owns integrated cross-language/build validation.
Original diagnostics, source pins, exact observations and independent review
will be appended below rather than replacing this pre-execution inventory.

## Implementation and source-bound observations

Implementation source is cc857317c0645f8ce99ff8823d0b30e7e8b309f6,
after the pre-execution model/validation plan 43941b976. The first 74 focused
cases passed. Initial strict checking found two union-narrowing diagnostics and
three int-versus-Fraction tuple-comparison diagnostics; Ruff found one import
spacing issue. Corrections use an explicit Failure narrowing and exact Fraction
expected tuples. Neither change alters the finite room model.

Source inspection additionally identified an uncaught ValueError from Python's
integer-to-text digit limit on very large exact rationals. A 75th boundary test
sets the limit to 640 digits, invokes the original public encoder with 10**641,
and restores the prior setting in a finally block. It failed with the real
uncaught exception before repair. The encoder now returns InvalidRational for
that conversion failure, just as the decoder already does for over-limit input
text. All 75 cases pass after repair. This is an extra generic API boundary
regression, not a new room, random source or empirical experiment.

Independent reviewer Vera, OpenAI Codex using GPT-6 Astra, accepted the exact
source pin after reading both full files, all ten room rows, independent literal
expectations, canonical rational admission and the retained diagnostics. No
material finding remained. The reviewer did not execute either implementation
or the tests. Hostile-object/resource isolation, native output, learning and
physical claims remain outside that bounded acceptance.

The standalone capture ran under Python 3.14.6 with no native launch. The first
capture setup used a repository-relative script path from the package working
directory and therefore failed before creating or executing the harness. That
shell error and Python file-not-found stderr remain below. After correcting
only the owned scratch path, the exact source capture exited 0, stderr empty.
The 4,304-byte receipt below is byte-identical to successful stdout and includes
its final LF. There is no source-to-bytecode theorem: module path and before/after
current-byte observations are precisely the scope of the harness check.

### Source byte identities

| Version | Path | Bytes | SHA256 |
| --- | --- | ---: | --- |
| initial | src/Interp.Python/zeta_interp/distributional_learning_rooms_reference.py | 12859 | 47BECD3A8B0A2D2A059999F2012E92069BDE3D2965C97FE6568340B36FD48AE3 |
| initial | src/Interp.Python/tests/test_distributional_learning_rooms_reference.py | 11883 | 67A6B18AEE1601CFB5B048D648153D6FED8243ABF663FF8E641465815FD06773 |
| reviewed | src/Interp.Python/zeta_interp/distributional_learning_rooms_reference.py | 13024 | 7CC06550D62564B73C240DA0A85FF89F499E9B6B843518CB2AD00838EBC6DA6D |
| reviewed | src/Interp.Python/tests/test_distributional_learning_rooms_reference.py | 12324 | CEB650A441C1DF1048C740C25931A9BC185853398B48561EF86AFDB8AA1B9285 |

### Actual receipt and capture identities

```json
{
  "ResultType": "zeta_interp.distributional_learning_rooms_reference.Success",
  "SourceCommit": "cc857317c",
  "ObservedModuleFile": "/Users/acehack/.zeta/agents/codex/Zeta-relational-identity-20260906/src/Interp.Python/zeta_interp/distributional_learning_rooms_reference.py",
  "ObservedModuleBytes": 13024,
  "ObservedModuleSha256": "7CC06550D62564B73C240DA0A85FF89F499E9B6B843518CB2AD00838EBC6DA6D",
  "PythonExecutable": "/Users/acehack/.zeta/agents/codex/Zeta-relational-identity-20260906/src/Interp.Python/.venv/bin/python3",
  "PythonVersion": "3.14.6",
  "ReceiptBytes": 4304,
  "ReceiptSha256": "3DF866A0745ED6873933BE5B9119FB596CDFB5FA722A0D76F545C7FDB8A3A2D4",
  "Scope": "fixed finite exact reference only; no native, learned or runtime admission"
}
```

```json
{"Actions":["steady","tail-exposed"],"Conditioning":[{"Distribution":"P","Id":"P/unit","Likelihood":[{"Den":"1","Num":"1"},{"Den":"1","Num":"1"},{"Den":"1","Num":"1"},{"Den":"1","Num":"1"},{"Den":"1","Num":"1"}],"LikelihoodId":"unit","Outcome":{"Evidence":{"Den":"1","Num":"1"},"Kind":"conditioned","Posterior":[{"Den":"1","Num":"0"},{"Den":"2","Num":"1"},{"Den":"1","Num":"0"},{"Den":"2","Num":"1"},{"Den":"1","Num":"0"}]}},{"Distribution":"P","Id":"P/soft","Likelihood":[{"Den":"4","Num":"1"},{"Den":"2","Num":"1"},{"Den":"4","Num":"3"},{"Den":"1","Num":"1"},{"Den":"2","Num":"1"}],"LikelihoodId":"soft","Outcome":{"Evidence":{"Den":"4","Num":"3"},"Kind":"conditioned","Posterior":[{"Den":"1","Num":"0"},{"Den":"3","Num":"1"},{"Den":"1","Num":"0"},{"Den":"3","Num":"2"},{"Den":"1","Num":"0"}]}},{"Distribution":"P","Id":"P/tail","Likelihood":[{"Den":"1","Num":"1"},{"Den":"1","Num":"0"},{"Den":"1","Num":"0"},{"Den":"1","Num":"0"},{"Den":"1","Num":"1"}],"LikelihoodId":"tail","Outcome":{"Code":"ZeroEvidence","Kind":"refused","Message":"conditioning evidence is zero"}},{"Distribution":"Q","Id":"Q/unit","Likelihood":[{"Den":"1","Num":"1"},{"Den":"1","Num":"1"},{"Den":"1","Num":"1"},{"Den":"1","Num":"1"},{"Den":"1","Num":"1"}],"LikelihoodId":"unit","Outcome":{"Evidence":{"Den":"1","Num":"1"},"Kind":"conditioned","Posterior":[{"Den":"8","Num":"1"},{"Den":"1","Num":"0"},{"Den":"4","Num":"3"},{"Den":"1","Num":"0"},{"Den":"8","Num":"1"}]}},{"Distribution":"Q","Id":"Q/soft","Likelihood":[{"Den":"4","Num":"1"},{"Den":"2","Num":"1"},{"Den":"4","Num":"3"},{"Den":"1","Num":"1"},{"Den":"2","Num":"1"}],"LikelihoodId":"soft","Outcome":{"Evidence":{"Den":"32","Num":"21"},"Kind":"conditioned","Posterior":[{"Den":"21","Num":"1"},{"Den":"1","Num":"0"},{"Den":"7","Num":"6"},{"Den":"1","Num":"0"},{"Den":"21","Num":"2"}]}},{"Distribution":"Q","Id":"Q/tail","Likelihood":[{"Den":"1","Num":"1"},{"Den":"1","Num":"0"},{"Den":"1","Num":"0"},{"Den":"1","Num":"0"},{"Den":"1","Num":"1"}],"LikelihoodId":"tail","Outcome":{"Evidence":{"Den":"4","Num":"1"},"Kind":"conditioned","Posterior":[{"Den":"2","Num":"1"},{"Den":"1","Num":"0"},{"Den":"1","Num":"0"},{"Den":"1","Num":"0"},{"Den":"2","Num":"1"}]}}],"Distributions":[{"Action":"tail-exposed","ActionIndex":1,"ExpectedUtilities":[{"Den":"1","Num":"0"},{"Den":"1","Num":"1"}],"Id":"P","Mass":[{"Den":"1","Num":"0"},{"Den":"2","Num":"1"},{"Den":"1","Num":"0"},{"Den":"2","Num":"1"},{"Den":"1","Num":"0"}],"Mean":{"Den":"1","Num":"0"},"SecondMoment":{"Den":"1","Num":"1"},"TailProbability":{"Den":"1","Num":"0"},"Variance":{"Den":"1","Num":"1"}},{"Action":"steady","ActionIndex":0,"ExpectedUtilities":[{"Den":"1","Num":"0"},{"Den":"1","Num":"-1"}],"Id":"Q","Mass":[{"Den":"8","Num":"1"},{"Den":"1","Num":"0"},{"Den":"4","Num":"3"},{"Den":"1","Num":"0"},{"Den":"8","Num":"1"}],"Mean":{"Den":"1","Num":"0"},"SecondMoment":{"Den":"1","Num":"1"},"TailProbability":{"Den":"4","Num":"1"},"Variance":{"Den":"1","Num":"1"}}],"Schema":"zeta.distributional-rooms.reference.v1","Support":[{"Den":"1","Num":"-2"},{"Den":"1","Num":"-1"},{"Den":"1","Num":"0"},{"Den":"1","Num":"1"},{"Den":"1","Num":"2"}],"TailEvent":{"Kind":"absolute-greater-than","Threshold":{"Den":"2","Num":"3"}},"Transport":{"Convention":"source-index-to-destination-index","Inverse":[4,0,1,2,3],"Permutation":[1,2,3,4,0],"Rows":[{"Distribution":"P","ForwardMass":[{"Den":"1","Num":"0"},{"Den":"1","Num":"0"},{"Den":"2","Num":"1"},{"Den":"1","Num":"0"},{"Den":"2","Num":"1"}],"ForwardMean":{"Den":"1","Num":"1"},"ForwardVariance":{"Den":"1","Num":"1"},"Id":"P/cycle","RecoveredMass":[{"Den":"1","Num":"0"},{"Den":"2","Num":"1"},{"Den":"1","Num":"0"},{"Den":"2","Num":"1"},{"Den":"1","Num":"0"}]},{"Distribution":"Q","ForwardMass":[{"Den":"8","Num":"1"},{"Den":"8","Num":"1"},{"Den":"1","Num":"0"},{"Den":"4","Num":"3"},{"Den":"1","Num":"0"}],"ForwardMean":{"Den":"8","Num":"3"},"ForwardVariance":{"Den":"64","Num":"79"},"Id":"Q/cycle","RecoveredMass":[{"Den":"8","Num":"1"},{"Den":"1","Num":"0"},{"Den":"4","Num":"3"},{"Den":"1","Num":"0"},{"Den":"8","Num":"1"}]}]},"Utilities":[[{"Den":"1","Num":"0"},{"Den":"1","Num":"0"},{"Den":"1","Num":"0"},{"Den":"1","Num":"0"},{"Den":"1","Num":"0"}],[{"Den":"1","Num":"-7"},{"Den":"1","Num":"1"},{"Den":"1","Num":"1"},{"Den":"1","Num":"1"},{"Den":"1","Num":"-7"}]]}
```

### Exact capture harness

Run from src/Interp.Python with uv run python and the owned scratch script path.
The abbreviated source identity in the captured metadata resolves to the full
immutable commit stated above.

```python
from pathlib import Path
import hashlib
import json
import platform
import sys

from zeta_interp import distributional_learning_rooms_reference as reference

writer = Path.cwd().parents[1]
module_path = writer / 'src/Interp.Python/zeta_interp/distributional_learning_rooms_reference.py'
assert Path(reference.__file__).resolve() == module_path.resolve()
before = module_path.read_bytes()
actual = reference.reference_receipt()
assert type(actual) is reference.Success, actual
raw = (json.dumps(actual.Value, sort_keys=True, separators=(',', ':'), ensure_ascii=True) + '\n').encode('ascii')
assert module_path.read_bytes() == before
capture = {
    'ResultType': type(actual).__module__ + '.' + type(actual).__qualname__,
    'SourceCommit': 'cc857317c',
    'ObservedModuleFile': str(module_path),
    'ObservedModuleBytes': len(before),
    'ObservedModuleSha256': hashlib.sha256(before).hexdigest().upper(),
    'PythonExecutable': sys.executable,
    'PythonVersion': platform.python_version(),
    'ReceiptBytes': len(raw),
    'ReceiptSha256': hashlib.sha256(raw).hexdigest().upper(),
    'Scope': 'fixed finite exact reference only; no native, learned or runtime admission',
}
output = writer / '.git/distributional-rooms-development'
with (output / 'receipt.json').open('xb') as stream:
    stream.write(raw)
with (output / 'capture.json').open('x') as stream:
    stream.write(json.dumps(capture, indent=2) + '\n')
sys.stdout.buffer.write(raw)
```

### Retained first diagnostics and final checks

The following blocks are complete raw command-output bytes, with their byte
counts and hashes. Empty output is explicitly recorded. Focused tests and
checks operated only on the two owned files; integrated native/F# and broader
room comparison remain coordinator responsibilities.

uv run pytest (74 original cases): exit 0; 179 bytes; SHA256
C07187DB0AC003097F2B98EF9141E0C120FF847D0210BC170959393F70959505.

```json
"........................................................................ [ 97%]\n..                                                                       [100%]\n74 passed in 5.44s\n"
```

uv run mypy --strict (initial): exit 1; 1021 bytes; SHA256
EB1DDDEA92F9661E6C8137E017E7AD0E4A8A1C099099CFFEAEAF6580B3C5ED79.

```json
"zeta_interp/distributional_learning_rooms_reference.py:336: error: Item \"Failure\" of \"Success[Conditioned] | Failure\" has no attribute \"Value\"  [union-attr]\nzeta_interp/distributional_learning_rooms_reference.py:337: error: Item \"Failure\" of \"Success[Conditioned] | Failure\" has no attribute \"Value\"  [union-attr]\ntests/test_distributional_learning_rooms_reference.py:153: error: Non-overlapping equality check (left operand type: \"tuple[Fraction, Fraction, Fraction]\", right operand type: \"tuple[int, int, int]\")  [comparison-overlap]\ntests/test_distributional_learning_rooms_reference.py:154: error: Non-overlapping equality check (left operand type: \"tuple[Fraction, Fraction, Fraction]\", right operand type: \"tuple[int, int, int]\")  [comparison-overlap]\ntests/test_distributional_learning_rooms_reference.py:155: error: Non-overlapping equality check (left operand type: \"tuple[Fraction, Fraction]\", right operand type: \"tuple[int, Fraction]\")  [comparison-overlap]\nFound 5 errors in 2 files (checked 2 source files)\n"
```

uv run ruff check (initial): exit 1; 534 bytes; SHA256
0D3B473C867D0D195072CCC520D62BB1F8EC231A2D361B5C74722A1E53E0DC57.

```json
"I001 [*] Import block is un-sorted or un-formatted\n  --> zeta_interp/distributional_learning_rooms_reference.py:9:1\n   |\n 7 |   \"\"\"\n 8 |\n 9 | / from __future__ import annotations\n10 | |\n11 | | import re\n12 | | from collections.abc import Callable\n13 | | from dataclasses import dataclass\n14 | | from fractions import Fraction\n   | |______________________________^\nhelp: Organize imports\n   |\n15 |\n   -\n16 | type Json = None | bool | int | str | list[Json] | dict[str, Json]\n   |\n\nFound 1 error.\n[*] 1 fixable with the `--fix` option.\n"
```

uv run pytest -k interpreter_integer_text_limit (before repair): exit 1; 2261 bytes; SHA256
6448A2E2F747B4B7B7569D9319BCB9A7A95135FDA00912376539A4E755D0EBA7.

```json
"F                                                                        [100%]\n=================================== FAILURES ===================================\n____________ test_interpreter_integer_text_limit_is_a_typed_refusal ____________\n\n    def test_interpreter_integer_text_limit_is_a_typed_refusal() -> None:\n        import sys\n    \n        original = sys.get_int_max_str_digits()\n        try:\n            sys.set_int_max_str_digits(640)\n>           assert isinstance(r.encode_rational(10**641), r.Failure)\n                              ^^^^^^^^^^^^^^^^^^^^^^^^^^\n\nsrc/Interp.Python/tests/test_distributional_learning_rooms_reference.py:352: \n_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ \nsrc/Interp.Python/zeta_interp/distributional_learning_rooms_reference.py:236: in encode_rational\n    return _capture(lambda: _wire(_rational(value)))\n           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\nsrc/Interp.Python/zeta_interp/distributional_learning_rooms_reference.py:70: in _capture\n    return Success(operation())\n                   ^^^^^^^^^^^\nsrc/Interp.Python/zeta_interp/distributional_learning_rooms_reference.py:236: in <lambda>\n    return _capture(lambda: _wire(_rational(value)))\n                            ^^^^^^^^^^^^^^^^^^^^^^^\n_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ \n\nvalue = Fraction(1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000...0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000, 1)\n\n    def _wire(value: Fraction) -> dict[str, Json]:\n>       return {\"Num\": str(value.numerator), \"Den\": str(value.denominator)}\n                       ^^^^^^^^^^^^^^^^^^^^\nE       ValueError: Exceeds the limit (640 digits) for integer string conversion; use sys.set_int_max_str_digits() to increase the limit\n\nsrc/Interp.Python/zeta_interp/distributional_learning_rooms_reference.py:232: ValueError\n=========================== short test summary info ============================\nFAILED src/Interp.Python/tests/test_distributional_learning_rooms_reference.py::test_interpreter_integer_text_limit_is_a_typed_refusal\n1 failed, 74 deselected in 4.52s\n"
```

uv run pytest (all 75 cases): exit 0; 179 bytes; SHA256
3910CCF64D9473528440D3E89B8E9CD91854A518EE56C3D3A30193E867E03B7E.

```json
"........................................................................ [ 96%]\n...                                                                      [100%]\n75 passed in 3.23s\n"
```

uv run mypy --strict (final): exit 0; 43 bytes; SHA256
F9B031E5C45AA702CD4FEF028D465551CB20A2C4698E0913C7B00766B20AC4D8.

```json
"Success: no issues found in 2 source files\n"
```

uv run ruff check (final): exit 0; 19 bytes; SHA256
82B3E6A6C090A57601D22943BD23FCA9218D1031DBE5A7B754092F9A156B4F18.

```json
"All checks passed!\n"
```

uv run ruff format --check (final): exit 0; 26 bytes; SHA256
3BC53BF3E981A98A34A852E175BF9B77AF841EDEA74FCA595D9AEDCBAF9A4938.

```json
"2 files already formatted\n"
```

first capture setup stdout: exit 2; 0 bytes; SHA256
E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855.

Empty output.

first capture setup stderr: exit 2; 301 bytes; SHA256
03276E6FF46FC5B8C2EECB2315854D29A1C200AF32F0A79206C392CE3D3E4E30.

```json
"/Users/acehack/.zeta/agents/codex/Zeta-relational-identity-20260906/src/Interp.Python/.venv/bin/python3: can't open file '/Users/acehack/.zeta/agents/codex/Zeta-relational-identity-20260906/src/Interp.Python/../../.git/distributional-rooms-development/capture.py': [Errno 2] No such file or directory\n"
```

successful capture stderr: exit 0; 0 bytes; SHA256
E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855.

Empty output.

initial evidence Markdown whitespace check: exit 2; 1304 bytes; SHA256
0B5C4B167E15BBF2E278657D277ECE8AD725F32C1FD9C2B7081FF97D62C784C8.

```json
"docs/research/2026-09-08-distributional-learning-rooms-reference.md:322: trailing whitespace.\n+    \ndocs/research/2026-09-08-distributional-learning-rooms-reference.md:329: trailing whitespace.\n+src/Interp.Python/tests/test_distributional_learning_rooms_reference.py:352: \ndocs/research/2026-09-08-distributional-learning-rooms-reference.md:330: trailing whitespace.\n+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ \ndocs/research/2026-09-08-distributional-learning-rooms-reference.md:340: trailing whitespace.\n+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ \ndocs/research/2026-09-08-distributional-learning-rooms-reference.md:424: trailing whitespace.\n+ \ndocs/research/2026-09-08-distributional-learning-rooms-reference.md:426: trailing whitespace.\n+ \ndocs/research/2026-09-08-distributional-learning-rooms-reference.md:428: trailing whitespace.\n+ \ndocs/research/2026-09-08-distributional-learning-rooms-reference.md:429: trailing whitespace.\n+ \ndocs/research/2026-09-08-distributional-learning-rooms-reference.md:438: trailing whitespace.\n+ \ndocs/research/2026-09-08-distributional-learning-rooms-reference.md:439: trailing whitespace.\n+ \ndocs/research/2026-09-08-distributional-learning-rooms-reference.md:453: trailing whitespace.\n+ \n"
```

The earlier shell path diagnostic, before the attempted Python invocation, was:

```text
zsh:1: no such file or directory: .git/distributional-rooms-development/capture.py
```

### Reconstructible source correction history

The lossless gzip/base64 below decodes to the complete unified diffs from the
initial source/test snapshots to the reviewed files. Together with the immutable
final source and initial byte hashes above it preserves the first source without
extra unowned files. The 75th test is the sole case added after the initial run.
The first evidence packaging used literal diagnostic and diff fences; git diff
--check refused retained trailing spaces. JSON string and gzip/base64 packaging
now preserves those exact bytes without stripping or normalizing them.

Raw: 2786 bytes, SHA256 4A836FD557D5EBF76DE8B19F91B8EDC5C21A3B3B9071749882DB3D5D316E27AD.
Stored gzip: 1048 bytes, SHA256 1D13D61A26B2D1FD690A6F0FE3F2DD3C0680BD470A9D034E87C75F7A12A4F844.

```text
H4sIAAAAAAAC/61WbW/bNhD+rl/B6ZMUS4rtpMlqIIOBrgY6oEWRFf3QICBo8exwoUSZpNK4Xf/7jtRLZDXbmiKSoBfy+Bzv+NxD
pWlKRCmsYPLY6Pz4TWlBV9n7vb1R5fEXsIwK33TMhbFarGsrVMkklcB0Kcot1UoVhmrYgIYyh6zaB5PJhGi4E/AZ+POhLpcknc2T
czLB+xlZLgOy0aoguZIScgdgMrbOiSgqpS15xaRkawmtFWeW5ZIZA6az6Jtak41mDUxnsGobgjQgAbH7CsgfRpXkgrxTJZC/yVop
iQ+MBe8YCN4lBnTlrK7xg4vcXmF74sddI4oLYj5/6aKYz39NZnMfhzs5bAj9LDREd0zWsOi9xyT9bYy0CFKChwZb65J8Dd/VRbhw
M2gGZ2VdgGZW6Tgh4e9QHnRyKFUhSt/9LZg4IKv3i+btWWHhPofKko+u/7XWSg+dMGGA0EvY1IbJ6KHDHeGbEkEFv2QNMUL05xiz
BU28Nw8N3JCGRzhj7LFwbwnjhTAGR4UPkHGzwG7VHpKNvFIcqG5ddGlX67+QTT7pl2Bqaa9Gucfku1U8mXsunszP8OEWsTs2SiML
bkGKG6U4FTwZfOJ8B19mEQyjJqq2uSpwEt8RZ3ggLWomkYW5Krlws48qLZQe+okbgnSH2Hj6Rs3QmAhDVkzIWsPiMPFoKIwojWVY
da150tnGo+m2Axqr7BVmk/xyQcJPoNXrO8Fd4YaPDHlk9QcQSYf3FoxhW4i/B2jThBn4GqT/KWAWjDX+Tp9Pv34O1MvXi2nyEvXL
P5rCd0z0ULDDoGmBcZXWUK5oqRDf8RqLCqjFJaDoRwq7jzw7HZvb7FYmITuD+VC3kc5ajKiKsExX0UlC5nGMrwedu4POhi1OHVH2
ospg8lmZIG72JziWvfWjfMNHpoUjR0wuLkg0TcgMrxHArgPYjQF2PwaAfj5gwO+1WrO1j9kPHbX1CKsIMU4xjMlPhrGKpj4ds/Y+
QnpCPP+D9JTAeqgmNr/SDQMEuMWOXOgPF9pG6XmTTn+l592oinfc4JBjYTbUiEJjgfG9E1dHrxTuK2WAh9jX++kgdmOI3VMgvGCe
zpITFEx8zBrFXFZ7R/2sYPo2q5hmBWA1fYEotDcazI2SHIGvUozlg65RGWbZ9Doe1Iwvit6W9tIf9W0Hej6omHY9Blo3qpseAd91
1glgMHFn73+w+dB2e6JuE6JSFAK7DWXU6S53UuCFbjAPz4v2T8PsjQP24qbFFndRp+/Ymm3Bu6EFu6eoNag4W4FzjB/bt529edz+
7HQaPxg+Fv14O5xNj47OTmej8P8d4XAf8TQ5wOv+JsJZSCYknIbkiCB+/yOB7d+Gzga7d/O6cVmRPxhvl8U4+AfOvH3I4goAAA==
```

Independent signed source review is e09966093aebaf5390a905566eb09d06380f3a1a,
owned by the reviewer and delivered separately for coordinator indexing.

Signed: Vera, OpenAI Codex using GPT-6 Astra, independent reference author.

## Separate actual-room transcript validation plan

This extension is fixed before validator source execution or reading actual
native room output. It follows coordinator protocol
9e64ab3679b8b50c7fdb0719db553aa3b743cb59 and the first source boundary
dd39304b9f95e0bd7c2522b491b1999e69fe5b71, with the subsequently agreed two
pending-checkpoint terminal fields. The earlier exact reference, its 4,304-byte
receipt and all recorded source/evidence identities above remain unchanged as
historical artifacts. New validation is a separate function and result scope.

The pure API will be validate_room_ndjson(raw, *, mode="ordinary",
ordinary_raw=None). Modes are exactly ordinary, fault-2, fault-12, fault-25
and invalid-control. A RoomRunValidated result means the entire supplied fixed
control transcript met the declared content checks. RoomRunRefused retains the
first Code, Message, Path and CaseId, full supplied raw value, decoded record
prefix and checked checkpoint count. Neither result claims process execution,
exit status, loaded-source/assembly custody or complete runtime admission.
A checked prefix is never promoted to a successful whole transcript.

Input must be bytes, at most 1 MiB total. Each nonempty NDJSON line, including
its terminating LF or CRLF, is at most 64 KiB. Every line must be terminated.
At most 64 checkpoints plus one terminal are allowed. Strict UTF-8 and JSON
reject duplicate object keys, NaN/infinity including overflowing exponent
literals, invalid Unicode surrogate strings, and invalid/deep JSON through a
typed refusal. Full original bytes remain retained independently of parsed
objects. No producer-selected operation or type is instantiated.

Integer counters and indices must decode as exact int, excluding bool and
float. Lexical -0 is preserved as negative floating zero and consequently
refused in integer positions. Declared F# double fields admit finite int or
float tokens excluding bool, since System.Text.Json emits integral-valued
doubles as integer tokens. Outside SoftValue they must match the expected
binary64 value exactly, including zero sign. Canonical rational strings and
all structural keys/IDs/order remain exact.

### Fixed checkpoint roster

Every checkpoint is exactly Kind, Sequence, Category, Id, Value. Kind is
checkpoint; Sequence is one-based and consecutive. The fixed 25 rows are:

| Sequence | Category | ID |
| ---: | --- | --- |
| 1 | GaussianProjection | P |
| 2 | GaussianProjection | Q |
| 3 | RepeatedEvidenceConsensus | 1 |
| 4 | RepeatedEvidenceConsensus | 2 |
| 5 | SoftValueConstructor | P |
| 6 | SoftValueConditioning | P/unit |
| 7 | SoftValueConditioning | P/soft |
| 8 | SoftValueConditioning | P/tail |
| 9 | SoftValueConstructor | Q |
| 10 | SoftValueConditioning | Q/unit |
| 11 | SoftValueConditioning | Q/soft |
| 12 | SoftValueConditioning | Q/tail |
| 13 | Inference | two-candidates |
| 14, 15 | PriorityPrediction, DirectPrediction | 0/neutral |
| 16, 17 | PriorityPrediction, DirectPrediction | 0/attention-ten |
| 18, 19 | PriorityPrediction, DirectPrediction | 6/neutral |
| 20, 21 | PriorityPrediction, DirectPrediction | 6/attention-ten |
| 22, 23 | PriorityPrediction, DirectPrediction | 12/neutral |
| 24, 25 | PriorityPrediction, DirectPrediction | 12/attention-ten |

The sixteen terminal Zeta rows are two Gaussian projections, two consensus
rows, six SoftValue observations and six priority/budget rows. The exact finite
reference is compared against a fresh independent reference_receipt call.
Terminal observation rows must also agree exactly with their corresponding
actual decoded checkpoint values, so separate plausible but inconsistent
checkpoint and summary observations refuse.

Gaussian means and precision-means are 0; variances and precisions are 1.
Consensus reports one/two supplied copies, source annotation same-evidence,
ProvenanceEnforcedByApi=false, threshold 2.5, precisions 2/3, means 1/2 and 2/3,
and states Undecided and ResolvedYes respectively.

SoftValue reconstructs all five support positions. Only posterior, maximum
mass and sum comparisons use absolute tolerance 1e-12, with no relative
allowance. Every probability must be finite and exactly in [0,1]. MaximumMass
is also compared with the actual maximum of the reconstructed probabilities;
sum is compared with 1. P/tail is exactly {Kind: refused}; all five other
observations and both constructors are conditioned snapshots.

Inference shares remain 3/4 and 1/4 and Best remains likely. Priority rows use
capacities 0, 6, 12 and neutral then attention-ten. Full prediction snapshots
retain ordered Requested/Boarded/Deferred, byte totals, before/after tank charge,
Outcome, Starved and VisionConfidence. Neutral matches the direct control in
full; attention-ten differs at all three capacities, including order when sets
coincide. VisionConfidence is exactly 0, 1/2, 1 according to capacity, while
BoardedPosteriorMass at capacity 6 is 3/4 or 1/4 according to the chosen order.
No confidence-calibration claim follows from a funded branch fraction.

### Terminal and partial-control admission

Every terminal has exactly Kind, Schema, Complete, Failure, Receipt,
ObservedCheckpointCount, WrittenCheckpointCount, PendingCheckpoint and
PendingCheckpointOmission. Kind is terminal, Schema is
zeta.distributional-rooms.run.v1. Both pending fields are null in every supported
mode; unexpected serialization/sink failures remain refused with raw retention.

Ordinary requires Complete=true, Failure=null, both counts 25, the full
actual-zeta.v1 receipt and exactly 25 preceding checkpoints. Receipt has exactly
Schema, FiniteReference, ZetaObservations and Runtime. Runtime has exactly
DotNetVersion, LoadedAssemblies and CompleteRuntimeClosureAdmitted=false.
Three assembly metadata rows retain Name, positive integer Bytes and uppercase
64-hex Sha256; their declared order is Zeta.Core, Zeta.Bayesian and
Zeta.Core.CSharp.DynamicValue. These are metadata shape observations, not proof
of loading those files or of a source-to-binary relationship.

For each fault mode, the function first independently validates the complete
ordinary_raw under ordinary mode. It then requires exactly 2, 12 or 25
checkpoint lines byte-identical to that ordinary prefix, followed by
Complete=false, Failure=InjectedCheckpointFailure, Receipt=null and both
counts equal to the selected prefix length. No later checkpoint or terminal is
allowed. The actual ordinary validation result is retained in the fault result.
The invalid-control mode requires zero checkpoints, Complete=false,
Failure=InvalidControlArguments, Receipt=null and zero counts. CLI arguments and
process exits remain independent external obligations, never inferred here.

### Fixed validator mutation inventory

Tests will construct explicitly synthetic known-answer NDJSON, never label it
native-produced, and exercise all five supported control modes. Mutants cover
lost/reordered/duplicate/extra events; structural bool/int and lexical -0;
posterior or terminal-row rewrite; false Vision/posterior-mass calibration;
attention/direct full-report equality at all capacities; bad terminal counts,
pending event, receipt, failure or completion; substituted ordinary prefixes;
missing ordinary input or invalid ordinary validation; duplicate/nonfinite JSON,
invalid UTF-8/surrogates/depth; exact line/total/count bounds and unterminated
lines. Late failures must preserve all earlier checked records and first case.
Original diagnostics and later actual-native validation will be appended with
distinct source pins; no native process or registered stream runs in this lane.
