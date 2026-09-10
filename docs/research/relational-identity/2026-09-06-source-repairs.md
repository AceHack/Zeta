# Source repairs before the complete result panel

Date: 2026-09-06
Operational status: research-grade
Lifecycle: active
Protocol: [registered protocol](2026-09-06-protocol.md)
Original source: `0f021adac`, `archive/relational-identity-20260906-source-v1`
Repaired source archive: `archive/relational-identity-20260906-source-v2`

Source v1 is preserved unchanged. Its ten focused native tests passed, but two
additional checks found defects before the complete experiment was executed.
The v2 fixture panel adds one regression mutation, making eighteen cases. This
is a witnessed implementation repair, without changing the hypothesis,
threshold, graph budget or promotion rule.

## Unavailable alternatives were hidden by event-ID coverage

A view contained an accepted receipt for event `e` and a second occurrence
with the same event ID, a different claim, and unavailable authentication.
The other view contained only the accepted receipt. The v1 witness returned:

```text
Status=consistent-on-declared-cut; UnverifiedRight=[]; InvariantPresent=true
```

The cause was subtracting all accepted event IDs from unavailable event IDs.
That erased an unresolved alternative. Source v2 preserves every unavailable
occurrence in the diagnostic and returns unknown coverage if any exists,
including when another occurrence covers its event ID. An authenticated
conflict still takes priority. This is deliberately conservative: even an
unavailable duplicate of identical content remains visible and unknown.
Only identical *authenticated* receipts have the registered idempotent replay
behavior. The native and independent Python tests retain both variants.

## The runner used a reserved F# identifier

The frozen kernel and test executable compiled with zero warnings and errors.
A separate compile-only invocation of the runner with `--warnaserror` found
`FS0046`: its local name `process` is reserved for future F# use. Rename that
local to `runningProcess`. No panel ran and no output receipt was written by
the failed invocation. The repair does not change the model or measurements.

## Source verification and execution

The strict independent replay accepts the v2 archive and checks all source
hashes, including this repair record. Current-tree regression tests regenerate
all semantic outcomes and validate the source-hash schema; a separate temporary
snapshot test checks actual hash mismatch rejection. Historical source hashes
remain evidence about their archive checkout, rather than a prohibition on
future unrelated edits to the live repository.

Both archived refs must remain reachable. Run the complete panel only after
the v2 source ref is pushed, retain the output and independent replay, then
apply the registered stopping and promotion rules.

## Source v3: carry the declared cut through the JSON projection

Before the complete panel ran, review of the wire projection found that the
kernel's `Readout.Expected` field was being dropped from each JSON case. The
protocol requires every report to name its declared cut. Source v3 adds
`Expected` to every case, including incomplete and refused views, and adds
native/Python regression assertions. Neither the kernel's consistency rule nor
any registered threshold changes. The planned first complete measured panel then targeted
`archive/relational-identity-20260906-source-v3`; v1 and v2 remain preserved.

## Source v4: honor the historical-replay source check option

Independent review found that `check_source_snapshot=False` was reported in
replay metadata but the verifier still unconditionally read and hashed current
source bytes. This contradicted the documented historical-regression contract.
Source v4 always validates the exact path roster, unique coverage and uppercase
64-digit hexadecimal SHA256 format. It compares current bytes only when the
option is true; the command-line replay keeps that strict default. The temporary
snapshot regression now requires strict mode to reject altered bytes and
historical semantic mode to succeed even when the source directory is absent.

No complete panel or output receipt existed before this repair. The first
complete measured panel uses `archive/relational-identity-20260906-source-v4`;
all three earlier refs remain unchanged. This correction changes replay
validation, not fixtures, thresholds, model outcomes or promotion criteria.

The same pre-result review found that hashing live source while naming an
archive did not verify archive equality, and source hashes did not identify
the prebuilt Core DLL actually loaded. Source v4 resolves the archive to its
full commit and refuses execution when any registered source byte differs
from that commit. Strict Python replay independently verifies the archive
resolution and each source hash, including a regression where altered current
bytes and a correspondingly altered receipt still fail the archive check.
The runner additionally records the loaded Core assembly SHA256 and module
version ID. A fresh Release build and its validation record are retained
separately; these identify the artifact and build activity without claiming a
reproducible-build attestation or proof of source-to-binary derivation.

A final inspection found that ordinary Python dictionary equality treats
`False` as equal to count `0`, and `1` as equal to boolean `True`. Source v4
compares the full semantic tree with explicit types: booleans and integers
remain distinct, floating statistics admit finite JSON integers/floats but
exclude booleans, and dictionary keys/list lengths must agree exactly. Four
malformed-receipt controls preserve the type and extra-field defects. This
closes an overly permissive replay verifier without changing native outcomes.
