# Guarded controller: finite transfer-shape source review

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded pure source acceptance after malformed-text repair

This review accepts the plan clarifications at
`307567c0c20fb8583c0a399a276f2cb24d7d7464` following the retained
findings in `ca0a69e0e99ffad9f1aa4ddfd6b2715d8bd5af87`, and the pure
classifier at `8d50ae0b8c6d45eb58d6fc4e5a29693381fc9ecb` following
initial source `8d5b846be553f2578b6474d8a4083213a6e9d908`.

| File under src/Research.FSharp.Cli | Bytes | SHA-256 |
| --- | ---: | --- |
| hidden_switch_transfer_shapes.py | 12102 | aff328e0da812986da043b2404251f9652f39694fe99f38fc2d617a9ad24f5b2 |
| test_hidden_switch_transfer_shapes.py | 9904 | c0bbadcb2e197b6bd5b7601b6977407f2f26d8d4da67e60c6634901dbc15f11a |

Both current files equal their exact committed bytes. I read the complete
source/tests and the existing indirect_cell helper. The classifier performs no
memory read, subprocess launch or instruction execution. The separate bounded
artifact reader/recorder is not part of this source acceptance.

## Independent encoding check

I compared the implemented masks with the pinned primary
[LLVM 23.1.0 instruction definitions](https://github.com/llvm/llvm-project/blob/llvmorg-23.1.0/llvm/lib/Target/AArch64/AArch64InstrFormats.td).
The fetched 531,611-byte file hashes to
`e2328467bf6ffae505db98dd53218c568cc00daa3eb8c1392a494a865cd28aff`.
The relevant one-based source locations are BaseBranchReg 2151, BranchCond
2303, BaseCmpBranch 2322, BaseTestBranch 2389, BImm 2445, LoadLiteral 3892,
ExceptionGeneration 5287 and UDFType 5303. This is source guidance, not an
additional decoder or captured-host capability observation.

Direct branches derive a signed 26-bit word offset; conditional/compare
branches use 19 bits and test-bit branches 14 bits. All scale by four and add
to the actual instruction PC. The bit number and W/X register convention for
test-bit branches agree with the definition. Register branch/return masks leave
only the five-bit register variable. Unsupported condition codes, authenticated
or system transfers and register 31 remain unresolved. BRK and UDF are traps;
they are not assigned ordinary continuation.

Range admission checks positive aligned nonoverlapping half-open code spans
and unique identities. Target arithmetic uses unbounded integers followed by
explicit uint64/address admission. Entry, interior and outside membership stay
distinct. A call continuation is a static location, not proof of a return,
callee effects or feasible execution. The classifier does not consume printed
target operands as authoritative addresses.

Literal detection precedes the ordinary mnemonic category. The supported
double/Q forms require the exact 8/16-byte declaration and one compiler label;
their signed address is prospective data and may lie outside code. Their
physical binding remains false. The indirect dependency recognizes only the
existing consecutive MOVZ/MOVK, unsigned LDR and BR/BLR shape. Reused known cells
must bind eight bytes, a unique role's current entry and the SHA of the exact
little-endian target. That is corroboration of caller-admitted retained data,
not a new pointer read or a dynamic register/target-set observation.

Ordinary named instructions retain uninspected-effects status. Unsupported
rows continue a caller's complete word accounting; structural correspondence
failures stop with the selected row and available locator prefix. Neither the
ordinary list nor the broad control exclusions is promoted to a complete CFG,
exception/effect proof or a safe-default fallthrough rule. All execution and
full body/closure/runtime admission flags remain false.

## Finding and scope

Whitespace-only decoded text passed the initial nonempty-string check and then
raised IndexError at split()[0]. The new regression produced both original
IndexErrors before repair. The exact correction rejects an empty token list
as ValueError before indexing, consistent with the caller-owned structural
failure boundary. I read the corrected 20-case combined pass (0.001 seconds)
and clean Ruff log. The original 19-case pass and earlier style diagnostic
remain historical preparation, not the corrected gate.

The accepted plan separately binds four input manifests and finite input/output
quotas. Its unsupported word rows continue accounting; structural/storage
failure stops with a prefix. Literal ranges may lie outside code, and old
capture addresses cannot be silently reused. The nine unprepared reflection
rows and nine extra emitted blocks remain separate obligations. The actual
130-method inventory, all artifact read/output admission, branch feasibility,
exception/caller closure, literal/guard memory correspondence and full runtime
admission still require their own evidence and review.

No retained instruction inventory, compiler/decoder invocation, target, dump
query, registered source or measurement was run by this review.

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
