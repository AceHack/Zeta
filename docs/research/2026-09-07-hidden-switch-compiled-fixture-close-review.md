# Guarded controller: explicit fixture-close review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1YYRTYF087G0R003TXBK2W
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: two reported close findings are false positives at reviewed source

The publication owner reported two PR 16982 code-quality threads:
`PRRT_kwDOSF9kNM6gCpQ0` at file_fixtures.py line 359 and
`PRRT_kwDOSF9kNM6gCpQ7` at identity_fixtures.py line 293. This independent
read-only source review uses publication
`394e2183084d9ec670f7a37ca6b0384e49ee7c19`. I did not post a reply, resolve
a thread, rerun tests or alter source. The owner retains the actual remote
finding and resolution records.

The production file-fixture module is 20,799 bytes, SHA-256
`fb8b0d46f8f276535207b866be530a6c60b860fe31e847ee937d9e804de1153b`.
The production identity-fixture module is 35,228 bytes, SHA-256
`9f9915fce386175fbf2aa1de1073b831725fed70bf0b29520d85aacdd2569c8d`.
Both publication files matched the coordinator's current source bytes.

In the first path, changed_metadata opens mutation_fd, initializes its local
completion marker, and enters the try/finally around descriptor identity,
write and fsync. Every ordinary exit from that body reaches line 390's
`_close_mutation_descriptor(mutation_fd)`. The helper at line 39 directly
calls os.close. The close is attempted once. Its OSError becomes a separate
cleanup observation; an active mutation failure remains primary, while a
close-only failure refuses the operation. No ownership is transferred to an
untracked consumer. The existing two-case regression actually closes first,
then injects a cleanup error, both with and without an earlier fsync error.
It requires one close invocation and the correct primary failure.

In the second path, capture initializes an empty owned descriptor list before
its try. Each successful stdout/stderr open, and the optional stdin open, is
immediately appended. Failure of a later open, Popen setup or capture body
still enters the enclosing finally. After the bounded owned-process cleanup,
lines 353-358 drain the list by popping each descriptor before calling
`_close_descriptor`; the helper at line 155 directly calls os.close. An
OSError is retained and the loop continues with remaining descriptors. Popping
before the uncertain close prevents a retry from targeting a reused descriptor
number. The existing real-close-then-error test requires two distinct owned
close attempts, the retained cleanup error and the already returned collector
result.

These are explicit close-helper and ownership-list paths, not evidence of
unclosed normal branches. The source supports an exactly-once close-attempt
contract with observed cleanup failures; it does not promise that an operating
system close can never fail or that cleanup survives process termination.
There is no material lifecycle defect in the reported ordinary paths and no
reason to weaken first-failure or ownership behavior merely to change the
analyzer's syntactic view. Remote disposition remains the publication owner's
action against the exact checked head.

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
Task: 081M1YYRTYF087G0R003TXBK2W
Co-Authored-By: Codex <noreply@openai.com>
```
