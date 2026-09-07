# Guarded controller: actual candidate arithmetic and remaining closure

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, independent protocol-review agent
Capture source: `5ff11d7e5df2493d6bd96853cb3dce73663a2653`
Evidence preservation: `6a998fd4ab73a5304820a9bad9d84252c9327492`
Disposition: candidate-byte correspondence accepted; executing closure pending

This follows the [instrument review](2026-09-07-hidden-switch-compiled-candidate-body-review.md).
The reviewer read attempt 4's original native, compiler, mapping, raw-memory,
decoded-instruction and outcome records in the native writer. Inline record
and hash checks were executed without a separately retained original script
log. No reviewer debugger target, build, test, guard derivation, policy call,
registered source or measurement occurred.

## What the recorded capture establishes

Attempt 4 retained 127 roster positions, including four explicit unprepared
generic helpers. The other 123 positions have candidate spans totaling 33,444
bytes and ten bound literal-load records. The native process 40573 and debugger
completed successfully. Every candidate retains `BodyResolved=false`,
`ClosureAdmitted=false` and `RuntimeAdmitted=false`.

The reviewer independently recomputed every candidate raw hash and length,
checked its compiler-byte equality and complete contiguous four-byte LLDB
decoder correspondence, and checked all ten actual/declared literal byte
comparisons. These consistency checks passed. Nineteen captured source,
project and configuration records also match their committed bytes at the
capture source. That is the capture's particular file roster, not a claim
about a complete dependency closure or the old study's separate 19-file roster.
File correspondence is not proof that the installed binary was derived from
those sources.

## Actual arithmetic observations

Offsets below are relative to the retained candidate entry. They describe
static instructions, not execution counts or a complete call graph.

| Candidate | Observed operation sequence |
| --- | --- |
| `HiddenSwitchPolicy.predict` | Optional `1-b` subtraction at `0x64`, multiplication by `0.75` at `0x6C`, addition of `0.125` at `0x74` |
| `HiddenSwitchPolicy.condition` | Numerator multiply at `0x60`, complement subtraction at `0x68`, second multiply at `0x6C`, mass addition at `0x70`, division at `0x8C` |
| `HiddenSwitchPolicy+continuation@54-2.Invoke` | Numeric maximum at `0x24`, followed by probability multiplication at `0x28` |
| `HiddenSwitchPolicy+actionValue@57-3.Invoke` | First continuation addition at `0x0C`, then second addition at `0x10` |
| `HiddenSwitchPolicy.select` | `q1-q0` subtraction at `0x5C`, separate epsilon load at `0x60`, comparison at `0x64` and greater-than result at `0x68` |

The actual selector literal is eight bytes `11EA2D819997713D`, the
little-endian encoding of epsilon bits `3D719799812DEA11`. Its retained
address in this capture is `000000010806EB20`; that process-specific address
is not a reusable runtime identity.

The condition candidate reuses the rounded numerator multiplication for its
division. Under the fixed deterministic rounding premise, repeating that same
multiply would produce the same bits, so this reuse does not change the
software expectation. The continuation maximum receives finite, interior
posterior-derived child values in this bounded controller; unrelated signed-zero
maximum ties must not be inferred from its mnemonic alone.

Across the captured candidate instructions, the reviewer counted four `fadd`,
three `fsub`, four `fmul`, one `fdiv`, one `fmax`, 26 `fcmp` and 23 `fmov`.
No fused floating instruction appears in these spans. This observation cannot
be generalized to uninspected callees or future code versions.

## Guard loads and unresolved dispatch

The two guard getters each occupy a 20-byte candidate. They load the two
doubles at object-relative offsets 8/16 and 24/32 respectively. The actual
generated selector closure `HiddenSwitchCompiledSelector+choose@18-1.Invoke`
also contains these field loads, followed by the ordered low/high comparisons
and an indirect fallback call. Reading only the top-level `choose` candidate
would miss that arithmetic/dispatch role.

Method bytes do not by themselves bind those loads to the actual verified
GuardSet instance or its four field values. Constructor/layout correspondence,
the same reference's data and its connection to the executing load remain
additional evidence obligations. A proposed graph-only pinned-data observation
can help, but the documented `AddrOfPinnedObject` result is a data address, not
a general object-header address. Do not assume an eight-byte subtraction
without separately justified layout/object evidence. Pinning also changes GC
behavior, so it belongs only in the inspection process. [Microsoft API documentation](https://learn.microsoft.com/en-us/dotnet/api/system.runtime.interopservices.gchandle.addrofpinnedobject?view=net-10.0)

The retained transfer ledger has 1,242 entries, including 199 indirect calls
(`blr`) and 22 indirect branches (`br`). Fifty-one direct calls have
compiler labels naming generated `dynamicClass` methods. These are concrete
unresolved dispatch targets. Runtime allocation/write-barrier helpers, F#
result/tailcall transport, task callbacks and arithmetic callees need explicit
role and identity classification. Matching method bytes or an assembly row
with `Dynamic=false` does not perform that classification.

An additional read-only opcode correlation identified 185 of the 199 indirect
call sites using the narrow consecutive `MOVZ/MOVK/MOVK`, same-register
load, indirect-call pattern. Fifty-six refer to pointer cells already captured
in the method mappings; 129 use 41 distinct uncaptured cells. Fourteen sites
fall outside this limited pattern. Already matched examples include compiled
fallback to `CompiledPolicy.native`, selector entry to common admission,
prediction/conditioning/evaluation to belief validation, continuation to
conditioning, action value to prediction and evaluation to its tree. This
reduces the missing-data roster; it is static stopped-cell correspondence,
not evidence that every site executed or that the complete call graph is known.
Direct-branch opcode decoding independently places all 453 direct calls
outside the 123 candidate ranges: 402 compiler-labeled runtime helpers and
the 51 generated-method calls above.

## Runtime observations and completion boundary

The same reported managed thread has FPCR zero and rounding-query result zero
before and after preparation. FPSR changes from `0000000008000010` to
`0000000008000011`. The status change is retained; this broad preparation and
inspection interval does not establish its cause. Equal mode snapshots do not
prove that every intermediate instruction ran with an unchanged mode. The raw
native-image counts are 357/357/357, still subject to the collector's declared
non-atomic snapshot and shared-cache/file-availability limits.

The current span length comes from compiler output and then passes an actual
memory/decoder comparison. This alone does not close all reachable instruction
paths. SOS/DAC metadata is one possible independent extent cross-check; the
frozen protocol does not mandate that particular tool. A complete independently
justified reachable-control-flow/range argument could address the same need.
Neither has yet been supplied for the full executing closure, and final
measurement callers do not yet exist. Runtime admission therefore remains false.

## Original record fingerprints

| Record | Bytes | SHA256 |
| --- | ---: | --- |
| `inputs.json` | 5997 | `ef930daabbe18b68f359bf18e22cbbd3880e738b20ab277a7f375f71254ee55d` |
| `native.jsonl` | 306647 | `e326f56139dda65a0af78c3615ce19e74e7dfb344cf46bde8c6794142e0fd3fc` |
| `jit.log` | 871559 | `0b9bd8fb2acb4714702d56182c089c0e8380d2ab74391e8c8b4408c273d5ddb3` |
| `body-candidates.json` | 639109 | `eb0e395c12b69b23c6ddd714f57658659da1ab0334437b1a88d10222b06891c7` |
| `compiler-blocks.json` | 1225343 | `5b883e74ee9b48fd946b0f8d2fa6f82c89f8794f47ca4578ab2bfda044be6adc` |
| `outcome.json` | 3756 | `7044f410ee9cfa2e9cf0019dd24049fa2aebec90924514345ed5c57f9625c4f8` |

## Subsequent guard and static-call observations

Attempt 5 uses source `18ef52ac8dea69a0bd98c4cce9c08619d90d7757`, with
its original records preserved at `bc97c8889e7befbdd4ab5a0e3981cccc255ead73`.
The reviewer independently checked the retained files without a debugger
target or policy execution. The first inline audit assumed contiguous raw-body
filenames and stopped at the first generic-roster gap; the corrected read
uses each retained method identity to locate its original mapping. Neither
inline invocation has a separately retained execution log. No receipt changed.

All 123 spans, totaling 33,496 bytes, agree with compiler bytes and complete
contiguous independent instruction decoding. There are ten literal records.
All 779 resolved selected-transfer rows retain consistent 16-byte target
prefix lengths/hashes. The reviewer recomputed the 590 direct target offsets
and 189 supported indirect cell-address constructions, actual pointer bytes,
repeated cells and candidate-range associations. The remaining 32 indirect
rows explicitly retain unsupported-dependency refusals. Among the 189 supported
sites, there are 67 distinct targets; 56 sites map to existing candidates.
These 811 rows cover only the declared selected transfer kinds, not a complete
control-flow graph or observed execution trace.

The actual pinned 32 bytes equal the four ordered getter bit patterns and the
second stopped read. The native ready record names the same GuardSet observation;
the finished record for process 89475 records pin release. This strengthens
the same-reference data/getter correspondence. Actual selector-register and
object-layout association remain explicitly unestablished. All body, closure,
layout and runtime admission flags remain false. Twenty particular captured
source/project/configuration/helper records match the committed capture source;
this does not establish binary derivation or the final dependency closure.

This capture predates the later conformance-boundary refactor. Its source and
observed graph must not be labeled as that later implementation's final graph.
The independent [SOS feasibility record](2026-09-07-hidden-switch-compiled-sos-feasibility-review.md)
also remains separate from these successful candidate-data observations.

| Attempt 5 record | Bytes | SHA256 |
| --- | ---: | --- |
| `body-candidates.json` | 640171 | `d181e2aa960c45e6a9ed253fd1d10ab6d5df1780d5cd9875548e111505b4ca19` |
| `selected-call-cells.json` | 1294851 | `648d287011c1143381bdfa7542e672e9f53e2629c37ecb5d915b7555774fad2c` |
| `guard-data-raw.json` | 1547 | `c6d5a764eae572d1db8b116e36a1627b166ebc68f72f12288cd475e8b7fbeb6b` |
| `guard-data-repeat.json` | 113 | `f881b9ed27c7f9c299d1759701edd879f6ed3320545dfd035f68276e7001224e` |
| `native.jsonl` | 309074 | `5cb466d95898943dbf2dd61811f24bbb9238d8fe6c4c13758de77ab94062cab6` |
