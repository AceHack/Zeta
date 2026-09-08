# Checked epoch identity and codec conventions

Date: 2026-09-08
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade
Status: implementation conventions under independent review; no numerical control result

This note concretizes omissions discovered while implementing the
[accepted source contract](2026-09-08-checked-mixed-message-module-epoch-source-contract.md)
and its [transport amendment](2026-09-08-mixed-message-epoch-transport-amendment.md).
It is an additional source binding for the finite implementation. It does not
rewrite either reviewed source, change the fixed M4/M5 data or numerical
limits, or establish a learned-system advantage.

## Variable, factor and prior identity

For each precision node, derive each variable ID as the uppercase 64-character
SHA256 of canonical JSON with exactly these fields:

```json
{"InstancePath":"node/path","Kind":"mixed-epoch-variable-v1","Role":"z"}
```

Role is `z` for its Gaussian variable, and `gamma/0` or `gamma/1` for the
Gamma variable associated with the corresponding input TargetSlot. The
example path is illustrative, not an extra control input. Neural nodes and
composite aliases introduce no precision variable or prior owner.

`Prior.Gammas[j]` belongs to `Node.Inputs[j]` in the admitted declared order.
Their lengths must agree. That input's unique TargetSlot `s` determines
`gamma/s` and `normal/s`; a sole slot 1 remains slot 1. Retain this association
before sorting factor visitation. Reordering factor visitation cannot silently
reorder the prior/input pairing.

The exact `EvidenceCut.PriorOwners` key set is the derived variable roster.
Its values are independently supplied prior contribution IDs, distinct for
these distinct variables. The Gaussian and Gamma prior values remain in
Node.Prior and enter their associated total exactly once. An alias referring
to an existing node creates no second prior, variable or model factor.

For each Normal factor and unary factor, derive a model contribution ID as
the uppercase SHA256 of canonical JSON with exactly these fields:

```json
{"Factor":"normal/0","InstancePath":"node/path","Kind":"mixed-epoch-factor-v1"}
```

Factor is `normal/0`, `normal/1` or `unary` as applicable. A site key retains
`InstancePath`, that local Factor literal, Port `z` or `gamma`, and the derived
model ContributionId. The Normal factor's two directed sites share that
factor contribution ID; distinct Ports distinguish their replacements. The
unary has only a z site. Revisions replace sites under the same identity.

Do not put a prior-owner contribution ID on a likelihood or unary site.
Prior ownership, model-factor identity and the evidence row's observed/forecast
uses are distinct roles; naming a model factor does not create independent
evidence. Preserve evidence reuse and dependency lineage through the original
admission rules.

Check uniqueness of node instance paths and derived definitions. Reject an
intersection between distinct derived variable/factor definitions or with
independently supplied prior contribution IDs, evidence row IDs and evidence
contribution IDs. Expected references to a definition, such as PriorOwners
keys or the two directed sites of one Normal factor, are not new definitions.
Reject conflicting duplicate definitions; do not treat hash collision as
impossible. All derived IDs satisfy the existing 64-character grammar: no
concatenated path exception or new unbounded namespace. The existing 32-variable
and 64-site limits still apply.

## Canonical bytes across F# and Python

The implementation uses one explicit string policy for canonical compact UTF8
JSON: ordinal ASCII object keys, retained array order, exact base10 integers,
lowercase literals, and the original Bits/Hash representation. Quote and
backslash are escaped. Backspace, tab, newline, form feed and carriage return
use their short JSON escapes. Other U+0000 through U+001F characters use
lowercase hexadecimal Unicode escapes. Other valid Unicode scalars are literal
strict UTF8, including plus, HTML punctuation, U+2028 and U+2029. Isolated
surrogates refuse. This policy applies to canonical hash preimages as well as
encoded source-return values; raw frame hashes still bind the exact original
frame including its terminating LF.

An actual nonnumerical .NET witness found that default Utf8JsonWriter emits
an escaped plus in `Zeta.Bayesian.BoundedModuleLearner+StepAttempt`, while the
Python canonical writer emits a literal plus. Those byte strings hash
differently despite decoding to the same string. Default or relaxed encoder
names are not evidence of equivalence. Shared golden vectors must compare
exact bytes and hashes for the ordinary source-return tag, quote/backslash,
all controls, HTML punctuation, separators and a supplementary Unicode scalar,
with isolated-surrogate rejection. Preserve the original witness and first
failed development checks when publishing the implementation review.

## Two admission clarifications

Training.ChildCuts is concretized as an ordinal object mapping each canonical
cut hash to its full EvidenceCut. Recompute every key from the complete cut;
retain the original maximum of 16 and admit all nested rows before use. A
hash-only cut or duplicate/conflicting identity does not supply lineage.

LabelAvailable remains a nonnegative int64 in every EvidenceRow, as in the
original contract; only Target is nullable. A target-hidden query retains its
metadata and consumes no label value. Raw training features and targets have
the original absolute bound 64. Query raw features must be finite and use the
stored transformation, with the original processed bound 8. A root review
suggestion to add raw-query bound 64 was withdrawn after rereading section 3;
it was a review error, not an implementation defect or contract amendment.

For a closed Error variant, Failure must be a non-null four-field failure.
Optional Failure fields elsewhere retain their explicit null case. Retaining
a nested result is not by itself evidence that its complete source-specific
schema or execution provenance was admitted.

## Review and execution boundary

The existing core, peer and bridge owners must agree on these identities,
exact bytes and field shapes before their final source pins. Independent
review then checks the concrete implementation and discriminating fixtures.
The first actual M4 peer/projection route and the four-session M5 child-to-parent
route remain subject to the original independent source admission and budget
registration. No result from either route is reported here.
