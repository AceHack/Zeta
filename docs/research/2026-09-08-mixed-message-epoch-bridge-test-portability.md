# Mixed-message bridge: portable source-retention fixture

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade test correction and validation custody
Lifecycle: active
Disposition: test-only correction; assembled source admission remains separate
Work item: 081M1Z63YMC087G0R003N5FH9X

The coordinator's assembled Python run exposed a repository-location assumption
in `test_source_identity_refusal_keeps_actual_read_and_hash`. It created a file
under pytest's default temporary directory, then tried to express that path
relative to the repository. On this host those directories are unrelated, so
`Path.relative_to` raised before the intended source read. The original
assembled run passed 110 tests and failed this one in 4.76 seconds. Its exact
command, raw stdout/stderr, completion and source observations are retained.

The owner's earlier 111-test validation used an explicit `--basetemp` under its
own repository. That setting masked the portability defect. The earlier
successful return remains historical evidence for that invocation, not evidence
that default pytest temporary-directory handling worked. An unchanged local
reproduction using pytest's default location failed the same fixture before
any bridge source read; the other 110 cases were deselected in that focused run.

The corrected fixture reads its actual repository test file and deliberately
changes one character of the expected SHA256. It retains actual loaded-module
origin admission, the real bounded descriptor read, the hash mismatch refusal,
the complete returned original bytes and their independently expected identity.
No source-read function, module-origin check or hash observation is mocked.
The fixture no longer needs a temporary file or a particular pytest directory.

Both production Python files remain byte-identical to
`567a9f004cf67b9df6d4a82c55fadaaf4fdd0b9b`. The corrected test is 68,707 bytes,
SHA256 `4C8ECC4B2CBF514265D93C138847039B3CEFA5EB50FBEF1AA1D7A75C78CC74A8`.
The production bridge remains 199,844 bytes, SHA256
`2A6154EB842116837843E8E100AB08CF4A4C735C635ED693E8C3F58E11B4961B`;
the controls remain 16,771 bytes, SHA256
`03ED13D4D860D1E3B61B73AF265B7C65A8251B258623C16B1B1ED28EC6C51711`.

The first corrected dedicated run passed all 111 tests in 2.81 seconds.
Strict three-file mypy and Ruff passed, but the formatter required a multiline
constructor layout. That exact source and diagnostic are preserved separately.
After the layout correction, all 111 tests passed in 4.10 seconds with default
pytest temporary-directory handling; strict three-file mypy, Ruff and format
checks passed. The production source bytes were unchanged throughout.

The source-stable full preflight returned exit one after 623.12 seconds:
17 checks passed, including all 16 static checks and the full dotnet test
check. The Release build failed because the F# compiler process for
Core.fsproj exited 139 (MSB6006), with zero warnings and one error. The complete
failed output is preserved. A single unchanged-source Release build retry
passed after 7.96 seconds with zero warnings and errors. This does not resolve
the cause of the original compiler crash or turn that failed gate into a
successful one. No full-suite retry was made. The separate formatter returned
zero after 14.84 seconds, retaining its explicit C#/VB-only and unsupported-F#
limitations.

The [lossless custody](mixed-message-epoch-bridge-validation/2026-09-08/portability-1/README.md)
contains 99 original files, 2,717,190 original bytes, in a 569,543-byte archive
with SHA256 `750AE2E4405A039650A13657CB65615069646EBE726D36AA2D74C1AFCFF5D7B0`.
It preserves the coordinator's original failure and three owned source copies,
the prior basetemp invocation, the unchanged local failure, both corrected test
attempts, initial/final style checks, source diff and identities, full gate,
formatter, separate build retry and executed capture/preservation helpers.
Every archive member matched its independently re-read local original. The
coordinator's original command is in its completion record; no separate
invocation JSON is invented.

The named M4/M5 driver, frozen nested query and standalone native numerical
producer were not invoked. Dedicated bridge tests use development fixtures;
repository gates include existing unit/model workloads. Final assembled gates,
independent manifest/capsule admission and the coordinator's named actual
controls retain their own source and execution boundaries.
