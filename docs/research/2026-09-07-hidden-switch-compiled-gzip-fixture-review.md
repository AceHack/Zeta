# Guarded controller: truncated gzip fixture correction

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: focused fixture correction accepted; file replay review separate

This read-only review binds root commit
`b62655e019914094dc443a6fc5a11d77d63197c3`. It adds two source lines and one
15-line regression. Current/source-commit bytes match:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| src/Interp.Python/zeta_interp/hidden_switch_compiled_file_fixtures.py | 20870 | 98ccdf808b27f5a7beb99c4b262cf696141b3d99b3f611acd09ce965308809bc |
| src/Interp.Python/tests/test_hidden_switch_compiled_file_fixtures.py | 14920 | 42687902b0f56e7128a6b92aea66e332506d6b884a83523535b47dc1e678d3e0 |

The original artifact/truncated-gzip fixture used file.bin with Encoding=gzip.
The actual shared descriptor validator therefore refused artifact-encoding
before decompression. Earlier tests that accepted any refusal did not establish
the intended decompression witness. The new file replay's stricter expected
boundary exposed this real fixture-quality gap; it is not a production gzip
decoder defect.

I read the original actual observation and failure logs. The retained
1,393-byte observation has SHA-256
`2e0d07ca34f071ee0c86852862c100da6235e67ce466ee269d1ce992720e6cf7` and records
CompletedOperation=1 with artifact-encoding at Artifact. The discriminating
regression fails on artifact-encoding versus artifact-gzip. The earlier new
file-replay run has 32 passes and that one failure; those results remain
historical failures.

The correction selects file.gz only for artifact/truncated-gzip. The same
selected leaf feeds the descriptor and actual exclusive setup write. Stored
truncated bytes, original bytes, both hashes and the real storage.read_artifact
entry are unchanged. The regression writes the complete actual observation
before asserting no harness failure, one completed operation, artifact-gzip at
file.gz and the expected target leaf. Thus a future earlier schema-only refusal
cannot satisfy this witness again.

I read the after log showing all 34 file-fixture cases passed in 4.79 seconds
and the retained after observation with CompletedOperation=1 and artifact-gzip
at file.gz. That observation is 1,395 bytes, SHA-256
`4a0dbcd5964c1e6d0f3c96b368beb26da3a31fdac71eb66e70aaba1049a13449`.
The author also reports strict source/test checks passed and the
new file replay's corrected 33-case run passed; the new replay implementation
has not yet been accepted by this review. No tests or fixture operations were
executed by this reviewer. No protocol, registered source, measurement criterion
or full runtime/outer admission changed.

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
