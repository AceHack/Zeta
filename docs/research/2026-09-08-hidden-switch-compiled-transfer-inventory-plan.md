# Guarded controller: finite transfer and operand inventory plan

Date: 2026-09-08
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: proposed finite metadata inventory; no new observation

This slice proposes an offline inventory over the exact 130 method records
retained by the [third decoder attempt](hidden-switch-compiled-validation/2026-09-07/llvm-decode-attempt-3/manifest.json).
It follows the current-extent/physical-identity and decoder slices, whose
full runtime, body and closure admission flags remain false. Independent
artifact review accepted the third attempt at
`230812d0286736f7f621dc234db3396e3eb38f0e`. No new dump, target, decoder invocation, registered
source or measurement is part of this proposal. The inventory will not open
the local dump or request new memory ranges.

## Exact inputs and allowed reuse

The decoder source is `20043d1408bfa3a515f5d59864ad858595044707`; actual
records are committed at `0fe0c33dc88e2cbfe291bc5ac60aeef0b5210587`.
Its 272-record manifest is 108,216 bytes with SHA256
`DDBAE0C9820E8D02B221466D1E3F9677A350A5CE4F7C66BD4D5158652ACFE8E7`.
The earlier mapped-extent manifest is 289,614 bytes with SHA256
`7C130526CB7981E209A5EF31AADA60194269BDE63213A1C4F91C3CCD25CBFE21`.
The compiler/reflection input comes from two additional already preserved
manifests: `clrmd-mapping-attempt-1/manifest.json` is 3,663 bytes with SHA256
`468239500FBFA138AF17119668E1E3DDA61176E2E14348C22DCA853D22BEDA61`, and
`dump-attempt-2/manifest.json` is 15,504 bytes with SHA256
`52BC974361A0C47764A70C99579011E89FCFA4C4F701799519434D6669DC446E`.
The latter authorizes only its existing metadata artifacts, including the
903,574-byte JIT transcript, never the local raw dump or binary custody paths.
All four immutable manifests and each consumed stored/original record must
match before use. The inventory reads these existing gzip artifacts, not
pathname equivalents in another writer.

Admit exactly the 130 decoded records in original method order: 8,665
four-byte words, 34,660 bytes, current body addresses, exact MethodDef token,
declaring type/name, captured file MVID association, and compiler-block
identity. The complete raw LLVM stream and its 851 comments remain source
records, with the exact diagnostic and re-encoding checks revalidated.
The MVID association is still local-file/native-reflection correspondence,
not dump-derived MVID or a generic-instantiation theorem.

Correlate compiler instructions and literal declarations only from the
already bound JIT transcript. Each offset and word must match both the
decoded row and the exact current extent. Keep the nine unprepared
reflection rows and nine unconsumed compiler blocks as separate unresolved
rosters; neither is silently removed by the successful 130-row inventory.

The 130 already preserved callable-cell records may provide a static target
value only when the cell address exactly matches a uniquely bound record
from this same dump/roster. Require Cell.Bytes=8 and recompute its retained
SHA256 from the unique recorded target's exact eight little-endian bytes.
Recheck that target against the same method's admitted current body. This
reuses an earlier physical-read identity
and executed comparison; it is not a new pointer read or observed call event.
Do not import addresses/cells/guard bytes from historical graph processes.

## Word and address classification

Every word keeps its role, offset, actual recorded PC, original bytes, LLVM
text/comment and compiler mnemonic/operands. Compute PC-relative addresses
from the actual instruction word and recorded PC with checked uint64
arithmetic. Never use LLVM's printed address as the runtime target or treat
a compiler symbolic label as an observed target identity.

The first supported finite categories are:

- B/BL: signed imm26 destination; distinguish jump and call. For a call,
  PC+4 is a continuation location, not evidence that the call returns.
- B.cond: signed imm19 destination plus PC+4 and the encoded condition.
  Admit the explicitly implemented condition forms; unsupported encodings
  and conditions remain refusals instead of invented fallthrough.
- CBZ/CBNZ and TBZ/TBNZ: encoded register/width or tested bit, signed
  destination and PC+4. Condition feasibility remains unproved.
- BR/BLR/RET: encoded register, with no inferred register value. RET and
  trap words have no invented successor. Keep breakpoint/exception-generation
  instructions explicit; decoding a trapping word is not ordinary execution.
- PC-relative literal loads: compute the address from the opcode first.
  Require supported width and a unique compiler literal label/byte declaration.
  Initially the supported declared data forms are double/Q LDR, as in the
  earlier candidate inspector. Other literal/address forms remain explicit
  unresolved-data records.

Use version-bound architecture/LLVM encoding definitions for the small
integer classifier and review the exact masks/sign extension before use.
The existing pure `indirect_cell` helper is a candidate for reuse, with its
source pin included: only consecutive MOVZ/MOVK construction, matching
unsigned-offset LDR and BR/BLR register dependency is recognized. Retain its
construction words/registers and checked cell address. A supported static
shape does not prove that it executes or that every possible dispatch target
has been found. Unsupported indirect shapes have no fabricated target.

For each computed control destination, record unique membership in the 130 current
ranges, including exact entry/interior offset, or explicitly outside those
ranges. Internal membership does not prove reachability, valid ABI state,
exception handling or a closed callee. Targets outside the retained ranges
remain unresolved; compiler helper/dynamic labels are hints kept separately.
No module attribution is guessed from an address or path substring.

All other instructions remain individually inventoried. An unimplemented
opcode/mnemonic/control-class combination is recorded as unsupported, not
defaulted to safe fallthrough. Ordinary arithmetic/load/store text is useful
to the later source-graph review but does not settle FP exception behavior,
memory faults, aliasing, value ranges or object association here. This slice
does not claim a complete CFG merely because every word received a row.

## Precisely missing evidence

This slice has no newly observed call-cell contents, indirect register
values, outside-body target bytes, caller-specific generic identities or
dynamic/framework helper extents. Existing callable-cell values cover only
exact matching cells in their preserved roster. All other computed cells
become a finite proposed future-read roster, not permission to read them.

The ten compiler literal declarations do not yet have fresh dump-two
physical literal-byte observations in this mapped/decoded slice. Compute
and retain prospective addresses and expected bytes, explicitly marking
physical literal binding absent. Separate literal storage can validly lie
outside all 130 code spans: code-range membership is not literal admission.
Unexpected width, invalid address or conflicting declaration is unresolved
data; a valid prospective literal address still provides no physical binding
and no authority to read it.

The compiled selector's object-register loads are not yet associated with
the pinned numeric GuardSet through executing-register evidence or another
independently justified object/layout argument. Historical same-reference
getter/pin observations do not close this boundary for the current dump.
No heap/object/stack inspection is part of the proposed inventory.

The nine unprepared methods, nine extra compiler blocks, dynamic tail-call
helpers, ordinary runtime/framework callees, exception/unwind edges and
inlined/concrete generic bodies still need their declared roles and coverage
resolved. A current hot extent with no cold region does not prove all of
those obligations or every possible runtime path. FP-mode and arithmetic
source correspondence remain separate review premises.

## Retention and falsifiers

The implementation will open only the exact named retained artifacts through
bounded regular-descriptor reads. It will check compressed identities before
bounded decompression, exact original length/hash and aggregate input limits:
at most 600 selected gzip records, two MiB compressed and two MiB original
per record, and 16 MiB total original input. The four manifests are each
bounded at 512 KiB. File names must be exact selected manifest entries;
these limits do not allow an arbitrary record-selection or path escape.
No unbounded decompression, guessed artifact path, new dependency fetch or
subprocess belongs in the pure inventory. An outer invocation records source,
arguments and all direct helper identities.

Create an exclusive owned output directory, retain its input pins before
classification, and publish each complete method plus active role/offset
prefix before the next dependent method. Word-level unsupported/unresolved
classifications are retained rows and processing continues to account for
all 8,665 words. They cannot silently truncate the roster or set an admitted
flag. A structural input/correspondence or collector/storage failure stops
processing, makes Complete=false and preserves the completed/active prefix;
it is separate from the unresolved count in a completed inventory.
Guard closure/output
errors so a secondary failure cannot erase the first failure or the available
prefix. Before publication, enforce two MiB per method/terminal record,
eight KiB per word diagnostic and 32 MiB total output; a compact terminal
failure/count record must remain possible if the full report exceeds its
bound. Their checked limits do not assert kernel-I/O cancellation or an OS
quota, and serialization allocation remains a separate finite-input limit.

Required discriminators before this inventory is accepted:

1. Changed manifest, stored/original byte identity, missing/extra/reordered
   method or word, wrong body base/extent and changed compiler association.
2. Positive/negative/zero/maximal branch immediates; address underflow,
   overflow, unaligned and boundary/interior/outside target membership.
3. B versus BL, every supported conditional family, register/bit extraction,
   and unsupported condition/authenticated/system/control encodings.
4. A trap or unsupported instruction cannot acquire a normal fallthrough;
   a call continuation cannot become proof of return or full CFG completion.
5. Static MOVZ/MOVK/LDR/branch patterns with changed register, missing word,
   intervening write, repeated chunk, unsigned-load offset and overflow.
6. Exact known-cell reuse versus unknown cell, duplicate cell metadata,
   wrong byte length/hash and conflicting recorded target. Unknown targets
   must remain absent.
7. Opcode-driven literal detection despite absent/misleading compiler text;
   wrong label/width/value declaration, duplicate/unconsumed declarations and
   target overflow. A legitimate separate-data address outside the code
   ranges must stay a prospective literal, not a malformed control target.
   No case promotes expected bytes to observed physical data.
8. Original raw comment/word/offset associations remain unchanged, including
   actual retained examples from the accepted decoder stream.
9. Broken publication after an actual computed target/literal locator keeps
   that active diagnostic in independent terminal output; secondary cleanup
   failures do not replace the first failure.
10. Missing extra/unprepared rosters or a claimed admitted flag refuses.
    Completing the inventory with unresolved rows must retain all 8,665
    word rows, keep every full admission flag false and expose the unresolved
    count; a structural/collector failure instead retains its partial scope.

Exact source, pure-fixture results and the finite selected input identities
must receive independent review before this proposal is used as an actual
inventory result. A later memory/query expansion requires a separately
reviewed finite roster and authorization. The frozen scientific protocol,
old source bytes, measured strategy and stream/cost schedule are unchanged.

```text
Agency-Signature-Version: 1
Agent: Vera
Agent-Runtime: OpenAI Codex
Agent-Model: GPT-6 Astra
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: none
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: 081M1XXWTTF087G0R000X1HMD0
Co-Authored-By: Codex <noreply@openai.com>
```
