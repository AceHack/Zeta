# Guarded controller: finite decoder source review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: finite offline decoding source accepted before candidate execution

This source-only review binds native commit
`036c114c093d2021d5e9ff187ddceea2a0befbb5` and the exact files:

| File beneath src/Research.FSharp.Cli | Bytes | SHA-256 |
| --- | ---: | --- |
| decode_hidden_switch_methods.py | 17383 | f020f42ff84ef19fd76fd44d7e476359e9f2e718fab13e131982f59743f636a0 |
| test_decode_hidden_switch_methods.py | 6290 | 3f50f5c85a9ad8d51a2c432b85f96443ecebea930b9170b2dbabbbfe331c404a |

The [tool plan](2026-09-07-hidden-switch-compiled-llvm-decoder-plan.md) and
[actual mapped-evidence review](2026-09-07-hidden-switch-compiled-mapped-extent-evidence-review.md)
remain prerequisites. The script admits the exact 700-record evidence manifest,
then binds its actual helper input/output, closed outcome, captured compiler
transcript and per-method physical-read identities. It requires precisely 130
methods and 8,665 ordered words corresponding to 34,660 compiler bytes. It opens
no dump and starts no policy or study target.

Two prelaunch findings were resolved before this pin:

1. The initial Path.open read could block on a FIFO before fstat, and the
   imported read-until-EOF identity helper bypassed finite read limits. The final
   shared reader opens nonblocking/no-follow on this verified macOS host, admits
   the same regular descriptor and initial size, consumes bounded chunks plus
   one byte, checks metadata and a ten-second deadline, and closes exactly once.
   Tool identity has a 256-MiB initial cap, including the 169-MiB LLVM library.
   These checked deadlines do not cancel a stalled kernel call. Optional-flag
   fallback is not a cross-platform FIFO-safety claim.
2. Initial finalization could let cleanup/status/console exceptions replace a
   primary failure or prevent terminal reporting. The final code separately
   guards poll, signal, join, each close and final status. It preserves a primary
   read error through a secondary descriptor close and records secondary notes.
   Terminal file and console reporting have independent guarded attempts, with
   a separate reporting-failure record where possible. Failed storage can still
   prevent durable reporting; the code retains failure status rather than
   claiming a successful publication.

The exclusive decoder input is reused through its original read/write
descriptor. The owned decoder child uses the exact pinned executable,
aarch64-apple-darwin triple and generic CPU; inherited nonempty DYLD overrides
refuse. Four Homebrew executable/library files are pinned separately from
actual loaded-image/system-library correspondence. Its process deadline is 30
seconds, with a polled two-MiB output threshold and bounded cleanup join. Polling
may overshoot; no OS quota or general descendant-quiescence guarantee follows.

Each word is an explicit four-byte bracketed chunk. Admission requires zero
exit status, empty stderr, the exact output count, supported instruction-line
grammar and four concrete re-encoded bytes equal to the original word. Symbolic
fixups, warnings, malformed lines, changed bytes and missing/extra words refuse.
Raw streams remain retained. Completed decoded methods are published before
later ones; a later encoding/publication failure retains the active decoded
prefix. This does not turn a globally refused stream into admitted prior words.

The code attaches each word's checked actual address from the retained method
base and offset. Printed numbers explicitly are not interpreted as runtime
targets. No branch classification, literal-value admission, complete CFG,
arithmetic proof or call-closure theorem is performed. All full admission flags
remain false even if this finite decoder succeeds.

I read the owner's actual synthetic grammar outputs: nop/ret/b/udf produced
four concrete encodings without diagnostics. A bracketed invalid 0xffffffff
word produced a warning and exit one after two prior emitted instructions.
These are synthetic words, not candidate bodies. A decoded udf illustrates why
valid byte decoding cannot itself establish safe fallthrough or a CFG.

The retained logs show 40 combined pure/custody cases passed in 0.135 seconds,
followed by the final ten decoder cases in 0.004 seconds; the final Ruff log
passes. Fixtures cover finite file size/deadline, FIFO/symlink refusal,
cleanup-after-status-failure, broken-console primary retention, exact atomic
words/addresses, diagnostics, invalid encoding shape and late-prefix survival.
Initial annotation/import diagnostics remain the owner's validation history.
I executed no tests, synthetic probe, candidate decoder, target or dump query
in this source review. No material implementation finding remains at this pin.

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
