# Canonical JSON mismatch witness

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade
Status: executed minimal serialization witness; no numerical service invocation

The archive preserves eight originals: separate minimal .NET FSI and Python
standard-library programs, their actual argv/times/exit observations, stdout
and stderr. Both exited zero. Default Utf8JsonWriter escapes the plus in the
ordinary source-return tag while json.dumps with ensure_ascii=False preserves
it. The decoded string agrees; its encoded bytes differ. Unicode, HTML
punctuation and quote output also differ. These minimal programs do not invoke
the draft epoch, native solver, learner or registered M4/M5 controls.

[manifest.json](manifest.json) binds every original byte and
[custody.tar.gz](custody.tar.gz), an 830-byte archive with SHA256
`71C8EB2B0C8D31B1CD247B4FCB2DFD2B60FEB6757A7D4FE45A6B4513595870E7`.
Every member was reopened and checked. Actual integrated encoder agreement
requires the shared golden vectors and source-specific tests described in the
[identity/codec conventions](../../../2026-09-08-mixed-message-epoch-identity-codec-conventions.md).
