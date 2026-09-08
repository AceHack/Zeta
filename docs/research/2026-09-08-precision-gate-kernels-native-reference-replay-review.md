# Independent native/reference precision-kernel replay review

Date: 2026-09-08 UTC
Operational status: research-grade
Disposition: accepted within the fixed engineering comparison and retained-byte scope
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Session: codex/20260907-c7b2a403
Work item: 081M1Z63YMC087G0R003N5FH9X

## Review boundary

This review reads the frozen [comparison contract](2026-09-08-precision-gate-kernels-native-reference-replay.md)
at `ba40d4d0f3bdac59294ccb36fdb8131486c07a6a`, the
[native producer](../../src/Research.FSharp/PrecisionGateKernelsReplay.fsx),
three comparator versions and the coordinator's actual process streams.
The [independent reference](2026-09-08-precision-gate-kernels-reference.md)
was already authored and committed before this producer read. This reviewer
did not read the native numerical library to derive the reference.

Review actions were source reading, ordinary JSON decoding, hashing,
lossless decompression and Git-object comparisons. No native process,
comparator, reference operation, test suite, random source, optimizer or
training was executed in this review. The coordinator owns the actual
executions and the [archive](precision-gate-kernels/2026-09-08/native-reference-replay/README.md).
The separate native equation/API review covers the numerical library;
this review covers its fixed-input adapter, comparison and evidence links.

## Exact sources and observations

| Subject | Identity |
| --- | --- |
| Native numerical source | Commit 7100eefea413c1dd34b899fd1b7ba639494568b7; 17206 bytes; SHA256 4004196cb0ade8527dfebf83fbb3e6e42bd36208e38affd09906787a84901c02. |
| Original producer | Commit 299abc12f9f3f886f5b7345b1c7e56b21dbe1d4a; 5714 bytes; SHA256 68adb7cb8920b1595d41268bf36b442630995964c2459add077cbc81bb0446db. |
| Corrected producer | Commit 45f86cfb32080079c3baab841f1a3b6aec2662b1; 5715 bytes; SHA256 57d12eb0afed2b438c5e9dc37e78df0785e391b1ddf15f77e625f332a67fce05. |
| Independent reference | Commit 9e6be94a0ec2b153ba63e100463f91418ceed4fe; module SHA256 91f71726c610364f5adf835fff08adb1353ab6f8ba9beaa6a68387cd55ac8258. |
| Exact input vector bytes | 21985 bytes; SHA256 ecab012f7084e17097594faabd2ee49ec7a76aa1da8a1fa4f2204ab8df841489. |
| Comparator 1 | 6102 bytes; SHA256 ede776119584f15badb88d8e1a202efad4b991e58dd19913fc38c87e8883a02c. |
| Comparator 2 | 7036 bytes; SHA256 4898792c82faee364d4c3de7b1d4cd895b30667f0881e917680c8d3ca8324110. |
| Comparator 3 | 7036 bytes; SHA256 74a2e7be86e81e550170a4c183b7e2778358b2f48f5b471da4b4b05d9c4d0579. |
| Native replay 2 stdout | 5206 bytes; SHA256 bb07b3d3e8bddd2b8923fd732412fe31d47cf13d2f6e28831138bd27fcdb4eb6. |
| Native replay 3 stdout | 5206 bytes; SHA256 0c88540cb94009a0fa600132251bec09eaea34ec57360aa8f51ae829598a0a04. |
| Comparison2 and comparison3 stdout | Identical 1903 bytes; SHA256 4d8521f904cbcf3d288529a7d7368bca60d5710f0962330b69cb326785992963. |

The original producer failed compilation with FS0001 and the related FS3886
tuple-list diagnostic, exiting 1 with zero stdout. The next producer commit
adds the missing separator only. The numerical library bytes are identical
at 7100, both producer commits and the inspected current source. Replay 2 and
replay 3 each exited 0 with empty stderr. Their complete Rows and reference
hash are equal; their runtime assembly observations differ after a rebuild.

## Adapter and comparison coverage

The producer checks the exact input length and SHA256 before parsing. It
reads only each row's Id, Operation and Input when dispatching. Expected
Outcome is not read to construct a native result. For these pinned bytes,
all 24 ordered operations reach their named compiled public kernel entry;
returned records are serialized in full. This is a finite-input engineering
adapter, not a public arbitrary-JSON service or an exception-total parser.

The corrected comparator checks the envelope schema/input hash, 24-row
cardinality, complete ordered IDs, operation names, outcome kinds and nested
field sets. Every corresponding ordinary numeric leaf is finite and excludes
bool. It uses the declared 1e-12 absolute plus 1e-12 relative engineering
tolerance. Reference Fraction/Decimal values are converted to host float
for that comparison; no interval enclosure or exact arithmetic equality is
claimed. Exact zero leaves additionally require native zero. The stationary
objective exception covers the rounded-coefficient derivative checks.

Both declared DTO differences are explicit: Gamma moments' native
RepresentedShape maps to reference Shape; normal messages' extra
ResidualSecondMoment is finite and equals twice ToPrecision.Rate before its
removal from the corresponding-field comparison. No other ordinary return
field is dropped. All 16 ordinary successful rows pass the corrected
comparison in the retained coordinator output.

The seven refusals are checked by a source-fixed mapping. InvalidInput
locators map w.Variance to Weight.Variance, mean_beta to MeanBeta, v to
Candidate.Variance and alpha to Shape. ImproperGamma/ImproperGaussian map to
the native ImproperBelief family Gamma/Gaussian. The native family does not
expose the reference's kernel.Rate or kernel.Precision locator. Therefore this
is family agreement for those cases, not evidence that native emitted the
more specific parameter location. Messages must be nonempty strings but
their different explanatory wording is not compared byte-for-byte.

The remaining reference success is a separate encoding observation. Native
RequestedShape is 1e-16, Kernel.LogPower is -0.9999999999999999 and
RepresentedShape is 1.1102230246251565e-16. The corrected branch checks all four
numeric leaves for finite, non-boolean type, rate 1, LogPower=requested-1,
represented=LogPower+1, positive represented shape and actual nonzero drift.
It does not pass this case through an absolute tolerance that would conceal
the discrepancy. This is 16 numerical rows plus 7 refusal rows plus 1 encoding
observation, not 24 exact or ordinary numerical agreements.

## Finding and repair retained

Comparator 1 bypassed common numeric admission in the two special DTO
branches. Source inspection showed that shape/small Rate=true passed its
rate 1 comparison, infinite represented shape and LogPower passed the
positive/reconstruction/distinct checks, and normal/zero
ResidualSecondMoment=false passed its zero relation before being discarded.
Its JSON decoder also accepted nonfinite constants by default. The actual
native rows were finite and correctly typed; this was a checker
discrimination defect, not an observed mathematical library error.

The coordinator preserved comparator 1 and its original exit 0 report.
Comparator 2 adds strict nonfinite-constant decoding and finite, non-boolean
checks for every special numeric leaf, plus the requested-minus-one encoding
relation. Three actual added output controls reject boolean shape rate,
infinite shape encoding and boolean normal residual. Comparator 3 differs
from 2 only in the selected native stdout path; this was verified by complete
source-byte comparison.

All seven original controls remain distinct and rejected: doubled half-rate,
reverse Gamma alpha-minus-one, swapped Exp/Log result, negated objective
gradient, truncation, duplicate ID and extra field. The retained corrected
reports contain ten rejected controls and no ordinary errors. These are
mutations of output values, not runs of mutated libraries. General hostile
JSON shapes, arbitrary type attacks and all possible checker omissions are
outside this finite control claim.

## Source, assembly and archive audit

Replay 2's historical assembly observations no longer matched the current
DLLs after subsequent builds. This was reported promptly; no attempt was
made to call a later binary the original one. Replay 3 separately copies the
two direct assemblies before invocation and retains its before/producer/
after comparison. This reviewer independently read both copies and checked
their lengths/hashes against the process metadata, actual output witnesses
and current files at review time:

| Assembly | Bytes | SHA256 |
| --- | --- | --- |
| Zeta.Bayesian | 1037824 | e262fb0edfaf70b55ac3d82e687d51b8d755a5edc80ae2dabcaaa404ec5c8b9b |
| Zeta.Core | 9265664 | 298d5a7f09a0fb46cd8deebc86036567b83e2c696f80b08232820e2f745b56ec |

The process Head 88aafa0e14dbd9a05bc1185a4ddc2551c20de198 is Git context,
not a statement that all working-tree files were identical to that commit.
An initial reviewer audit incorrectly required that equality for the newer
test file and failed. The actual recorded test hash
f443e58dd8c6d5e0c017d36a432dc6de121fd040dfa68d39e877e4a4ebfefebb
matches the current bytes and subsequent commit e537c4e03; the numerical
library and producer already match the recorded Head. This corrected
attribution does not alter a source or test outcome.

The [archive manifest](precision-gate-kernels/2026-09-08/native-reference-replay/manifest.json)
at e537c4e03 has SHA256
489e39ab6ecad5c32e0ea29745563eb469089f0190ecce075ca9dc2b4265590c.
This review checked all 31 stored gzip identities, all 31 decompressed
identities, exact corresponding local raw records and exact committed gzip
bytes, with no missing or extra gzip record. Totals are 10366532 original
bytes and 4760957 stored bytes. The two direct DLL copies are included.
The review also confirmed the recorded source hashes and the identical
comparison 2/3 result bytes. No project module was imported for these checks.

This is a bounded record/source/byte audit. It is not a reproducible-build
certificate, process-attestation mechanism, proof of in-memory code identity
or complete runtime closure. FSI, framework, helper and transitive dependency
closure is not established by the two selected assembly rows. Process
records retain argv/exit/elapsed observations; they do not constitute a
trusted clock or adversarial chronology proof. The accepted local numerical
scope and these limitations should remain together in later publication.

No material finding remains in the corrected finite comparison and reviewed
archive. Full integration gates, any future optimizer or mixed inference
schedule, and learned-system evaluation remain separate work.

Signed: Vera, OpenAI Codex using GPT-6 Astra, independent replay reviewer.
