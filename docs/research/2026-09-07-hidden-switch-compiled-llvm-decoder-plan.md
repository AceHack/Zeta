# Guarded controller: finite LLVM decoder plan

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: feasible source proposal; actual decoder script and candidate execution pending

This pass executed version/help and dynamic-link inventory commands only. It
read installed headers and official version-tag source. It did not disassemble
any bytes, open a dump, launch a study target or change an admission flag.
The native owner separately owns a proposed synthetic grammar probe and the
subsequent decoder implementation. The mapped-run evidence audit is separate.

The retained [inventory](hidden-switch-compiled-validation/2026-09-07/llvm-decoder-inventory/inventory.json)
binds exact command outputs, six installed files and three fetched source
fingerprints. The executable resolves to Homebrew LLVM 23.1.0, arm64:

| Installed file | Bytes | SHA-256 |
| --- | ---: | --- |
| bin/llvm-mc | 107432 | 1e6100f8891f7c1f27daf80ce98a5962331b555ceb7821e61c68211c40fd03d0 |
| lib/libLLVM.23.1.dylib | 169150736 | 407f3a39e56a727ea161e95767eafd96bdcd09071638f583beff0106bffa34f5 |
| INSTALL_RECEIPT.json | 3944 | 68cb3c7e28a90b045654f0cdd4bb97da215c59a93900d81c29137c8e16061efd |
| MCDisassembler.h | 10589 | f30c0820c0067d066c62c79d322a159a839c7dc4e719fb142eee7b452ce5b955 |

The installation root is /opt/homebrew/Cellar/llvm/23.1.0. The header is under
include/llvm/MC/MCDisassembler. `otool -L` declares LLVM, z3, zstd and system
libraries. The inventory hashes the available Homebrew libraries; declared
links are not an actual loaded-image snapshot or full system-library identity.
The bottle receipt and public llvmorg-23.1.0 source are guidance, not proven
source-to-binary provenance for the installed tool.

The installed help and [official command guide](https://llvm.org/docs/CommandGuide/llvm-mc.html)
support `--disassemble`, `--triple`, `--show-encoding`, CPU/features and explicit
output selection. The current web guide describes a newer development version;
the following implementation observations use the named 23.1.0 source instead.

In [Disassembler.cpp](https://github.com/llvm/llvm-project/blob/llvmorg-23.1.0/llvm/tools/llvm-mc/Disassembler.cpp),
newlines and commas are whitespace. Brackets delimit atomic byte chunks.
An invalid encoding outside a chunk can warn, skip bytes and still return zero.
SoftFail warns and still emits an instruction, including inside a chunk. Decode
addresses are offsets within the current chunk. Thus exit status alone cannot
admit a decoding, and one input line does not establish one instruction.

In [MCAsmStreamer.cpp](https://github.com/llvm/llvm-project/blob/llvmorg-23.1.0/llvm/lib/MC/MCAsmStreamer.cpp),
the encoding comment comes from re-encoding the decoded MCInst; it is not a copy
of the original input. Fixups can produce symbolic markers. The assembly printer
receives address zero. The installed header also distinguishes a valid decode
from a disassemblable but architecturally invalid SoftFail. These are reasons to
reject diagnostics, symbolic bytes and unassociated printed addresses.

The proposed finite script should satisfy these obligations before execution:

1. Bind exact reviewed mapping, successful mapped metadata and compiler/physical
   byte records. Derive exactly 130 methods, 34,660 bytes and 8,665 ordered
   four-byte words from those admitted inputs. Preserve method identity, current
   native base, offset and original word before external decoding. No additional
   dump ranges, JIT generation or target preparation is needed.
2. Generate source-fixed ASCII input with one bracketed four-byte chunk per
   word, using explicit `0xNN` tokens. Pin the absolute executable, linked-file
   inventory, argv, triple, CPU/features and environment delta. Do not infer a
   CPU from the running host or silently enable features after a refusal.
3. Run an owned child with bounded input, output and deadline; retain exact raw
   streams and terminal status before parsing. Require successful exit, empty
   stderr, exactly one admitted instruction per input word and exact ordered
   equality of four concrete re-encoded bytes. Reject unknown directives,
   malformed/extra/missing instructions, fixups, warnings and truncation.
4. Preserve decoded text and aliases as observations. Compute each actual PC as
   retained method base plus offset, with checked arithmetic. Associate each
   supported PC-relative branch, address calculation or literal reference using
   an independently reviewed opcode/immediate rule at that PC. Printed numbers
   alone cannot authorize a target. Reject unsupported forms for any claimed
   classification; do not turn them into fallthrough.
5. Keep decoded instruction coverage separate from reachable control flow,
   actual execution, indirect targets, exception edges, literal values, dynamic
   methods and source-to-native correspondence. LLVM and LLDB can share decoder
   lineage; agreement is corroboration rather than independent architectural
   proof. No complete CFG, arithmetic theorem or runtime admission follows from
   a successful byte round trip.

Before the candidate script runs, its fixtures should discriminate a valid
word, invalid and truncated words, warning-plus-output, dropped/reordered words,
changed encoding, symbolic encoding, unsupported text and address overflow.
An actual small synthetic grammar probe can establish the installed output
shape, but cannot substitute for reviewing that parser and its refusal paths.
All full body, closure and runtime admission flags remain false.

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
