# Actual Zeta distributional room controls

Date: 2026-09-08 UTC
Operational status: research-grade
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

The [fixed protocol](../../../2026-09-08-distributional-learning-small-room-protocol.md)
was committed at `9e64ab3679b8b50c7fdb0719db553aa3b743cb59` before
the actual F# observations. These are deterministic known-answer engineering
controls, not learned performance, held-out results or state-of-the-art claims.
The [manifest](manifest.json) binds all process streams, source versions,
runtime observations and final commands with separate raw/stored hashes.

## Observed behavior

Source `2af8d581016d6c5a903aaba0335a3e73c8d5ac9b` completed all 25
designated checkpoints, ten finite-distribution rows and sixteen Zeta rows.
The ordinary process exited zero. Faults after checkpoints 2, 12 and 25 each
exited two and retained exactly that ordinary prefix. The invalid argument
control exited two with zero checkpoints. All five had empty stderr and no
timeout. These checkpoint counts refer to the protocol's designated calls,
not every constructor or internal operation.

The finite P and Q distributions share mean zero and variance one but assign
different mass to the tail and prefer opposite actions. Their identical
Gaussian summaries cannot retain this distinction. Repeating the same local
consensus message increases precision and crosses the chosen resolution
threshold; this API supplies no evidence-origin deduplication by itself.

Vision attention changes the funded ordering without changing the inferred
posterior. At capacity six, equal funding confidence of one half accompanies
boarded posterior masses of three quarters or one quarter. At capacity twelve,
funding confidence is one while the posterior remains uncertain. Declared
cost six is an accounting input, not measured memory, energy or compute time.

## Failures retained before the successful source

The first source, `dd39304b9f95e0bd7c2522b491b1999e69fe5b71`, failed
compilation with FS3886/FS0001 at a tuple-list boundary, exit one, empty stdout
and 647 stderr bytes. No room observations occurred in that attempt.
Source `5475ec0f409076d379ad962c600db45b57e510a9` repaired the syntax
and passed the ordinary room. Its first injected fault emitted the correct
two-checkpoint failure stream but the FSI host still exited zero. The driver
refused that mismatch before running the remaining three controls. The raw
stream and process record remain retained. The driver's tool-visible assertion
was not separately captured as a file and is not represented as a raw artifact.

The final source adds an explicit nonzero FSI host exit after the failure
terminal. It does not change room mathematics or acceptance criteria. Its five
new process records preserve the complete final roster. The first compile and
ordinary attempts have preserved streams and source identities; only the later
process records carry captured start/finish timestamps. None are invented for
the earlier attempts.

## Independent validation and limits

The [independent reference](../../../2026-09-08-distributional-learning-rooms-reference.md)
retains both actual validator attempts. Its first attempt refused a mistaken
expectation about the third assembly observation; source inspection confirmed
the ordered type witnesses are Core, Bayesian, Core, with identical complete
first and third entries. The repaired validator also retains earlier checked
prefixes on late framing refusals. Its 124 tests pass and all five unchanged
actual streams validate under their fixed modes. The source reviews are
[F# room](../../../2026-09-08-distributional-learning-zeta-room-source-review.md)
and [independent validator](../../../2026-09-08-distributional-learning-room-validator-review.md).

The runtime receipt identifies three type-selected assembly observations and
.NET 10.0.11. It is not the script's four-entry reference list or a complete
runtime dependency inventory. Complete runtime closure remains false. Native
process/source custody and independently validated output are separate records.
No FerryThrottler, full scheduler, affective network or CHIP8 learning run is
claimed by these controls. Registered compiled streams remain unopened.

The coordinator's imported reference passed all 124 tests in 4.66 seconds at
`ecb35bf73a669d2552af7d2dd53b1d94e4efc4c0`. Its complete log is
retained separately; that test run does not rerun the five native processes.
