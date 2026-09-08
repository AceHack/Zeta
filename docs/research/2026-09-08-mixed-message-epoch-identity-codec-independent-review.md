# Checked epochs: independent identity and codec convention review

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra, independent peer owner lane
Operational status: research-grade review
Lifecycle: active
Verdict: ACCEPT for the bounded implementation conventions
Work item: 081M1Z63YMC087G0R003N5FH9X

## Reviewed source and evidence

I read the complete convention note at coordinator commit
`02c2ac7249aba31cc8377c1804264c02fff35e47`, against the
[original contract](2026-09-08-checked-mixed-message-module-epoch-source-contract.md)
and [transport amendment](2026-09-08-mixed-message-epoch-transport-amendment.md).
The note is 6,583 bytes, SHA-256
`BB623AB96A329A075E8C9BC06953D7284DA62BA10766B0D06479D51A011F98C2`.
Its immutable Git blob and observed current file match the reviewed draft.
The [evidence companion](mixed-message-epoch/2026-09-08/identity-codec-independent-review/manifest.json)
retains the exact note, original witness manifest/archive, and independent
audit source/result. It is not an implementation or numerical acceptance.

The independent audit verified all eight archive members against their declared
lengths/hashes and original local files: 1,521 original member bytes in the
830-byte archive, SHA-256
`71C8EB2B0C8D31B1CD247B4FCB2DFD2B60FEB6757A7D4FE45A6B4513595870E7`.
The manifest and archive also equal their immutable Git blobs. Both retained
commands report exit 0 and empty stderr. I parsed both pairs of output strings:
each pair has equal decoded values and unequal bytes and hashes. The actual
source-return tag contains an escaped plus in the default .NET output and a
literal plus in the Python output. I did not rerun either witness, invoke a
numerical module, or execute an epoch/M4/M5 control. The separate main/PR
publication archive is outside this audit.

## Identity and model correspondence

The two domain-separated canonical hash preimages give bounded variable and
model-factor IDs without extending the existing path/ID grammar. PriorOwners
uses the exact derived variable keys and distinct independently supplied prior
contribution values. Priors enter once; aliases add no variable, factor or
prior. Both directions of a Normal factor share its model contribution while
their ports distinguish site replacement. A model contribution never replaces
the independent prior or evidence contribution identity.

The final note resolves the draft pairing ambiguity explicitly:
`Prior.Gammas[j]` belongs to the retained `Node.Inputs[j]`; its TargetSlot
selects the gamma/Normal identity before factor traversal is sorted. A sole
slot 1 remains slot 1. Equal lengths, unique slots and retained association
are required. Collision refusal covers distinct derived definitions and the
independent prior/evidence identities, while ordinary references to the same
definition remain legal. This does not assume hash collisions are impossible
or infer statistical independence from different names.

## Codec and admission correspondence

The explicit string policy resolves the observed cross-language mismatch:
short standard control escapes, lowercase hexadecimal for other controls,
literal valid UTF8 scalars elsewhere, including plus and U+2028/U+2029, and
isolated-surrogate refusal. It applies to canonical hash preimages and encoded
source values; raw frame hashes separately include the actual LF. Merely
choosing an encoder called relaxed would not establish this policy. Exact
shared golden vectors and concrete source review remain required, including
the actual tag, all control characters and supplementary Unicode. Passive
semantic JSON equality is insufficient for a byte identity assertion.

The ChildCuts object supplies full cuts under recomputed canonical cut hashes
and the existing finite roster/nested admissions. LabelAvailable stays a
nonnegative int64; target-hidden queries do not erase that metadata. The
training-only raw bound and query processed bound agree with original section
3. The note accurately preserves the coordinator's withdrawn raw-query-bound
suggestion as a review error. A closed Error variant requires the non-null
four-field failure; unrelated optional Failure fields retain their null case.

No material issue remains in these exact conventions. The implementation must
still demonstrate these checks, complete returned-value retention, the actual
scheduler route and the registered finite controls. This review adds no data,
numerical tolerance, training run, closure claim or full-PGE prerequisite.

The retained documentation quick gate exited 0 with all 16 checks passing.
Its command/output/completion records are listed separately in the companion.
