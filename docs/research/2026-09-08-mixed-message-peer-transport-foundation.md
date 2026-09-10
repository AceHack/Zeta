# Mixed-message peer: incomplete transport foundation

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade development record
Lifecycle: active
Status: incomplete peer; development source only
Work item: 081M1Z63YMC087G0R003N5FH9X

## Scope and next dependency

This preserves the declaration-only foundation in
[MixedMessageEpochReplay.fsx](../../src/Research.FSharp/MixedMessageEpochReplay.fsx).
It is not the finished executable peer. There is no entrypoint, core epoch
invocation, Ready/ACK/Commit exchange, projection service call, EpochReturn or
terminal implementation yet. The next dependency is the core owner's compiled
epoch DTOs and codecs; the peer must invoke that real core and independently
check the agreed envelope correspondence. No named M4 or four-session M5 run
is admitted by this progress record. No main/publication promotion is intended.

The exact source at this progress cut is 28,479 bytes, SHA-256
`8D8BA3FF7FE26ECB049D8B3AB6C7C08D0DFEA2F2FA288DB0C11C01D9EED78F94`.
The [manifest](mixed-message-epoch/2026-09-08/peer-transport-foundation/manifest.json)
retains 50 lossless records: 211,070 original bytes and 59,840 gzip bytes,
including executed harnesses, commands, exact source copies and all first
outcomes. Earlier source copies are historical observations, not current bytes.

## Implemented development boundary

One sequential transport holder retains actual incoming prefixes and complete
attempted output originals. Reads are bounded by the frame allowance plus one
byte. A pending timed-out read keeps its borrowed stream and buffer; any later
returned bytes remain explicitly unadmitted. Failed output latches the output
boundary closed, preserving the attempted frame without guessing its physical
sent length. A later terminal cannot repair an incomplete frame.

Incoming frame positions count their first actual byte; empty EOF remains an
observation with no frame charge. Outgoing originals are reserved before I/O,
without refunds. Completed writes and flushes have separate counters. A new
coordinator budget prefix replaces the previous global prefix and must include
all locally known prior positions. The current carrier is charged once. Local
session counts remain separate, and prior-session use restricts new output.
Full BudgetSnapshot schema and work-count admission still belong to the core
and assembled bridge; these primitive checks do not replace them.

The passive JSON prewalk rejects duplicate keys, malformed/deferred strings,
invalid UTF8, excessive depth/tokens, nonfinite decimal/exponent values and
oversized number tokens. Large integral tokens remain passive under a finite
bound until the owning exact codec admits their role. This prewalk does not
admit arbitrary JSON as a numerical operation or an actual service result.

The file observer is explicitly limited to the reviewed local macOS descriptor
ABI. It opens a nonblocking/no-follow leaf, checks a regular file using that same
descriptor, admits the initial size before allocation, reads that size plus at
most one byte, and compares descriptor identity metadata after reading. It
retains the complete initial-byte hash before subsequent checks/close. Cleanup
cannot replace an earlier failure. The installed stat-header identity is
retained as guidance; regular-file, directory, symlink and FIFO fixtures also
exercise the actual local API. This provides neither hostile parent-directory
isolation, kernel-I/O cancellation nor loaded-code closure. Binding the actual
peer and three directly loaded DLL identities before Ready is still pending.

## Actual development outcomes

All commands are retained with their working directory and exact source hash.
Each invocation uses `dotnet fsi --quiet --exec` with the recorded source or
harness path. The harnesses invoke only transport/passive JSON and owned-file
fixtures, without core epochs, native projection or reference calls.

| Attempt | Actual result | Meaning |
| --- | --- | --- |
| transport-build-1 | exit 1, FS0010 | First private-record indentation failed compilation. |
| transport-build-2 | exit 0 | Corrected declarations compiled; no main body ran. |
| checks-draft-1 | exit 1 | An actual one-byte MemoryStream write followed by a synthetic exception allowed a second append; retained output was `7B7B7D0A`. Two top-level-use harness warnings are retained. |
| checks-2 | exit 0, 20 passed | Output latch repair, prefix/deadline/JSON checks; empty diagnostics. |
| checks-3 | exit 0, 25 passed | Added first-byte accounting and snapshot/global-quota discriminators; empty diagnostics. |
| checks-4 | exit 1, FS0072 | First file-observer compilation lacked the path type annotation; no fixture pass claimed. |
| checks-5 | exit 0, 30 passed | Corrected file reader plus all preceding checks; empty diagnostics. |

The source fixtures use a known regular file, a symlink to it, an empty
directory, and a FIFO created with Python `os.mkfifo`. The archive records
the regular bytes and harness; it does not attempt to read/archive the FIFO
or follow the symlink. Synthetic stream errors are labeled as seams even when
their preceding bytes were actually written. These are functional controls,
not throughput or scheduler measurements.

The public API/core review and assembled source gate remain separate required
work. The source-fixed three `#r` paths retain the scalar peer's order: Core,
Core.Abstractions, Bayesian. No generic RPC or dynamically instantiated result
type has been added.

The documentation/source quick gate exited 0 with all 16 checks passing.
Its four raw command/output/completion records extend the manifest to 54
records. Full peer, core integration and repository validation remain pending
the finished source; the focused FSI checks above are the actual development
compilation/functional evidence at this cut.
