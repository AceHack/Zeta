# Guarded controller: finite retained artifact reader review

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded helper acceptance after exponent-overflow repair

I read both complete files at initial source
`aef64955ea6401d6c52f3f4985f793b0bedaf18f` and their correction at
`e9d4c654da515097b13aa1d9f57f744155198ca9`. Final current bytes equal
the committed files:

| File under src/Research.FSharp.Cli | Bytes | SHA-256 |
| --- | ---: | --- |
| hidden_switch_retained_artifacts.py | 7788 | add43e5ab1616b9e6b8056b8ac1871217f8184ca127d71287295dcf43d677e7a |
| test_hidden_switch_retained_artifacts.py | 8509 | 3771da1c1a0197cbc190020e8bd0e70720a569c1e7b624737eb11dcb2f95a813 |

The initial strict_json rejected nonfinite constant tokens but retained Python's
default parse_float. Finite lexical exponent forms therefore escaped as
infinities: the preserved probe records top-level 1e400 and nested -1e400.
The repair admits only finite float conversion. Four positive/negative,
top-level/nested overflow cases now refuse while a large finite control parses.
I read the final 33-case combined pass (0.034 seconds) and clean Ruff log.
Original setup/style failures and the overflow observation remain historical.

The helper admits the same nonblocking, no-follow leaf descriptor as regular
before reading. Initial length is bounded; reads request that length plus one
byte, with short/growing and changed-metadata refusal. The checked ten-second
deadline does not claim to cancel blocked kernel I/O. Descriptor ownership is
transferred only after fdopen succeeds and each owned close is attempted once.
An established read/admission failure remains primary through a close failure.

Manifest bytes must match their caller-selected immutable length/hash before
parsing. Selected records require a canonical relative path, exact stored
identity and bounded single-member gzip expansion before original identity.
Unused data, trailing members, incomplete streams and excess output refuse.
No unbounded flush is used. The implementation never follows OriginalLocalFile
or opens a raw dump. Four manifests, 600 selected records, two MiB per record
and 16 MiB aggregate original input are finite implementation limits; temporary
Python allocation remains a separate limit.

Available manifest/stored/original pins are appended before their fallible
checkpoint callback. Original admitted bytes remain cached if the final
checkpoint fails. Recheck reads only selected manifest/stored paths; their
stored hashes bind the previously admitted original bytes. This is not future
immutability or a new physical-memory observation.

The outer driver must catch constructor/read/checkpoint exceptions and stop
after its first failure. The helper does not latch a failed state or guarantee
hostile namespace isolation; stable writer paths and sequential fail-stop use
are explicit premises. The author confirmed that the separate driver owns those
boundaries. That driver, full metadata association/output custody and an actual
retained inventory still need independent review. No real inventory, decoder,
dump, target, registered source or measurement was run by this review.

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
