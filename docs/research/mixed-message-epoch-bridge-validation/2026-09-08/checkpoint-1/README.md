# Mixed-message bridge checkpoint custody

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade development evidence
Lifecycle: active

The [implementation report](../../../../2026-09-08-mixed-message-epoch-bridge-implementation.md)
identifies source commit `8e1fe19a074368c3fd48f5f6cb871b1ce5d6b141` and its
remaining independent-review/integration boundaries. The
[manifest](manifest.json) binds 1,352 regular original members, totaling
12,227,580 bytes, in [custody.tar.gz](custody.tar.gz). The archive is 3,634,980
bytes with SHA256
`BEDB41FBE2E19672E310C884268E76B044D0B1D4559AFFBB6309EEC33D9E592E`.
The [observation](observation.json) records the author's read-without-extraction
member/original verification and final source comparisons. It is not independent
review or a new numerical observation.

## What is retained

Every regular original is represented by Name, Bytes, Sha256 and its historical
OriginalLocalFile locator. `lstat-inventory.json` additionally records 2,121
filesystem nodes, including 210 pytest convenience symlinks. Symlink targets
are strings in that inventory: the tar contains regular originals only and
neither follows nor recreates those links. Owned Store fixture files remain
available at their distinct original relative paths. Do not execute archive
members or interpret original local paths as instructions.

The three final source files match their immutable Git bytes and all three
final validation snapshots. Earlier snapshots remain source-specific; later
successes do not reassign their executions to edited files.

| Record group | Actual scope and result |
| --- | --- |
| `epoch-bridge-final-tests-2` | 85 development fixtures pass, 2.29 seconds; actual subprocess elapsed 3.045835666998755 seconds. |
| `epoch-bridge-final-checks-2` | Strict mypy over three files, Ruff and format all exit zero. |
| `epoch-bridge-repository-gate-1/1-*` | `bun run preflight` exits zero in 580.7330776249873 seconds; all 18 executed checks pass, including Release build and full tests. |
| `epoch-bridge-repository-gate-1/2-*` | `dotnet format --verify-no-changes` exits zero in 16.242463792004855 seconds. Diagnostics explicitly limit formatting to C#/VB and list unsupported F# projects, with a workspace-loading warning. |
| `epoch-bridge-string-golden-1` | Inert 273-byte UTF8/escaping golden capture. |
| `epoch-bridge-gamma-golden-1` | Inert 1,235-byte nonempty Gamma state and complete fixed GammaBlock call encoding. No Gamma numerical call. |
| Earlier development/failure/check groups | Original source/test copies, available commands/exits and exact stdout/stderr, plus owned fixture trees; see report for distinctions. |

The repository gate began on parent HEAD `cd794f8ac4550050c5523f149551e0fc5d3fe50a`
with these three new source files already present. They were committed during
that unchanged-source gate as `8e1fe19a`. Source snapshots and final Git-byte
comparisons establish equality; the newly added report/custody paths were not
present for that full gate's earlier documentation checks. Their normal push
hook is a separate later check. No named M4/M5/frozen-query workload was run.

## Preservation correction, with original evidence intact

The first preserver included its own redirected output while that file was
still empty. It matched the available original at the pre-console check, then
its final print grew the file to 1,641 bytes. The separate actual audit in
`development/epoch-bridge-preservation-refusal-1` returned exit 1 and identified
exactly that one original-file mismatch. This was a packaging defect, not a
source/test result change.

The original archive, manifest and observation are retained unchanged under
`development/epoch-bridge-preservation-before-1`. Its zero-byte output member
remains the actual prefix observed by the first preserver; its historical
original locator does not describe the later completed output. The completed
first stdout is retained separately in the final archive. Both executed
preserver sources are present. The corrected preserver writes its console
outside the selected roster; it verifies every current selected original and
all decompressed member identities before publication. It did not rerun tests,
codecs, native processes or the repository gate.
