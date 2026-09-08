# Guarded controller: finite retained transfer collector review

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded source acceptance after retention corrections

I read the four complete input/collector source and test files at
`c97efff55ca56baa530e21c117527b8f2f4351ec` and the correction at
`370c110c93598874615efe60a5bed23ac6e5263d`. Final current files equal their
committed bytes:

| File under src/Research.FSharp.Cli | Bytes | SHA-256 |
| --- | ---: | --- |
| hidden_switch_transfer_inputs.py | 12373 | f166a45caf7eb105c17cc986b8b15260c26e67799de9ad3eb7df7f4873f3f11a |
| inventory_hidden_switch_transfers.py | 13917 | 99bc53f65a80687e78f24ba5a284783ef5842a06edea044d91a89313eaaaf3f5 |
| test_hidden_switch_transfer_inputs.py | 5938 | 902a2531d3337cca6c4da7b5d0194ffff2f1fc8979438b2bd712a869811312f2 |
| test_inventory_hidden_switch_transfers.py | 14393 | a5383c6e59c757872575f007052920f0b58ac86e7d806830e60874f3bc00fce0 |

This pass builds on the separately
accepted shape classifier and bounded retained-artifact reader. It reviews an
offline inventory over preserved data, with no new process, decoder, dump,
target, source stream or measurement in this review.

## Findings retained

The author independently found that the collector reserved two MiB for its
primary terminal file but omitted the secondary terminal file from the total
output reservation. A successful full terminal write followed by a close
failure could consume both files. The author reported that edge before I
issued a finding; my source read reached the same conclusion. The correction
reserves two MiB for the primary terminal plus 16 KiB each for the secondary
terminal and console. The ordinary writer charges attempted bytes before
publication, and all three reserved outputs include their newline byte. The
new aggregate-bound fixture discriminates the prior missing reservation.

Independent review found a separate source-prefix gap. The source inventory
kept all observed hashes in its local list and returned only after reading and
parsing the entire import closure. A later read, path or AST failure left the
outer result's Sources empty, losing earlier established source identities.
The correction appends each source identity to the outer retained prefix
before its fallible checkpoint, parse or next read, with the active filename
in its locator. The new real-file fixture checks later missing-file refusal,
and a second seam checks failure while checkpointing the current identity.
Both keep the already established identity in the final result.

I read the corrected focused 20-case pass (0.309 seconds), combined 69-case
pass (0.380 seconds) and clean Ruff output. No source test was rerun in this
review. The author's later exact-original-source diagnostic replay, if retained,
is separate evidence from these read source defects and corrected fixtures.

## Bounded input correspondence

The input module binds four exact manifest byte identities, then selects a
fixed metadata roster. It reconstructs the complete reflection/compiler
mapping and checks the same capture's dump identity, module custody and closed
helper outcome. It never opens the dump or module paths named by those records.
The earlier physical comparisons remain preserved observations; this inventory
corroborates their metadata and does not repeat physical reads.

The 130 methods retain their exact token, declaring type/name, native-reflection
MVID association, compiler block, body address/length/hash and recorded DAC row.
Each callable cell is associated with that same method's selected physical
record. Known-cell reuse separately requires the eight-byte little-endian
target hash and same current range. Historical process addresses and unknown
cells cannot supply observed target values.

All 8,665 compiler words are checked against the exact decoder input records,
the bracketed atomic input and the reconstructed complete stdout/stderr parse.
The 851 immediate comments and word order remain exact. The nine unprepared
reflection rows and nine additional compiler blocks remain separate unresolved
rosters, rather than being inferred to correspond one-to-one.

## Accounting and publication

The collector retains the selected word before classification. Unsupported
shapes continue as explicit unresolved rows; structural correspondence failure
stops with the current role, offset, attempted target and available prefix.
The complete synthetic NOP fixture verifies 130 methods and 8,665 unresolved
words without promoting ordinary instructions to safe fallthrough or execution.
It is not an actual inventory over the retained task methods.

A fully computed method remains active until its exclusive file publication
returns. A journal failure can therefore leave its actual computed words in
the independent terminal report. Attempt creation is exclusive, descriptors
close once, cleanup failure remains separate from the established primary
failure, and final publication has a separate compact failure path. Oversized
metadata explicitly makes the report incomplete and records omitted counts.
Serialization allocation, kernel cancellation, hostile namespace changes and
future source immutability are outside these checked byte limits.

Source identities are a finite local import-file observation, not a theorem
about loaded Python bytecode, interpreter or arbitrary dependency closure.
The externally recorded source-commit argument still needs its surrounding
launch/source evidence. No successful inventory sets BodyResolved,
ClosureAdmitted or RuntimeAdmitted true; complete word accounting is separate
from reachability, arithmetic effects, actual indirect dispatch, object layout,
literal data, exceptions and the outstanding caller/framework closure.

## Initial preparation inventory

At preservation commit `5cf6d40ceac8ab0ccef1e00f62ade5072d8f43d1`, all eight
committed/current gzip records matched their compressed and original identities.
All 14 source/test pins matched immutable source c97efff. The preparation
contains 3,727 stored bytes and 11,190 original bytes. Its earlier 14/15-case
draft runs remain distinct from the final 18-case pass (0.346 seconds), combined
67-case pass (0.439 seconds), initial Ruff diagnostics and final clean result.

The independent [preparation audit](hidden-switch-compiled-validation/2026-09-07/transfer-inventory-independent-preparation/initial-audit.json)
also reconstructs the proposed selected-name set from manifest tables alone:
534 records, 6,747,916 original record bytes plus 416,997 manifest bytes,
totalling 7,164,913 bytes. Maximum selected sizes are 903,574 original bytes and
96,637 stored bytes. These fit the declared 600-record, 16 MiB aggregate and
two MiB per-record limits. This footprint check does not decompress/classify
the complete selected task roster or replace a later actual inventory audit.

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
