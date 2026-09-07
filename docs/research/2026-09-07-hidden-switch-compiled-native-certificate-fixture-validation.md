# Guarded hidden-switch compilation: actual certificate refusals

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: 31 actual native verifier calls; full admission pending

The real native verifier accepted the unchanged control and refused all 30
altered or malformed certificates in the retained finite corpus. All 31
processes exited zero. Each reported exactly one verifier call, zero source
draws and `RuntimeAdmitted=false`. The first batch began at
`2026-09-07T19:49:58.876327+00:00` and finished at
`2026-09-07T19:50:12.956251+00:00`; no row was replaced or discarded.

The [lossless inventory](hidden-switch-compiled-validation/2026-09-07/native-certificate-fixture-attempt-1/manifest.json)
binds 162 records: every raw input, native output and native checkpoint
journal; per-process stdout/stderr; binding map; coordinator journal/result;
and the actual driver, its stdout/stderr and preservation script. Malformed
UTF-8 and other byte-level inputs remain exact in gzip. Stored and original
lengths and SHA256 values were verified for every record.

## Source and execution identity

The native source is `34b4395175cd58ee2caba179e6061e54521673f6`. The existing
[corpus](2026-09-07-hidden-switch-compiled-certificate-cases-validation.md)
is pinned to `60eeb0b868b973298cb1c6f48044ee7172ada369`. Each retained
corpus input was checked through the real strict artifact-byte validator
before copying to its exclusive case directory. Native output was read only
after successful process closure. The accepted control SHA256 is
`CF3C800035F4E303FC4479F0DAC120517621093D3A1300925ACA209649900962`.

The executed CLI assembly was 439,808 bytes with SHA256
`203F68A0B23157D6A07D7395DE00C8DD556E5D4E95C788DC15CB09EF1F922E77`.
The host ran .NET 10.0.11 with tiered compilation, tiered PGO and ReadyToRun
disabled from launch. The runtime configuration pins 10.0.11 with roll-forward
disabled. The driver retained all arguments and bound the input, binding-map
and reported assembly hashes. Twenty-three observed binary/configuration/host
files had identical before/after identities; the journal records that equality.
This finite file snapshot is not complete loaded-image or source-to-code proof.

## What the refusals establish

The coordinator compared the actual native acceptance/refusal disposition
with the independent Python result for every corpus row. For native refusals
it checked the complete nine-field failure DTO, including all six null
location fields. It retained the actual codes and details from both
implementations; it did not require their error taxonomies to be identical.
A refused certificate is a successful execution of the verifier command,
distinct from command failure or a failed process.

The explicit `hand/source.py` zero-hash binding remains a fixture placeholder.
These calls establish numerical-certificate conformance under that declared
binding, not admission of the final source archive. The driver checks scoped
output fields and result schemas; it is not the final complete-envelope
validator. The separate [92-case design](2026-09-07-hidden-switch-compiled-outer-negative-design.md)
still requires actual coordinator negatives, exact byte/chronology admission
and independent native runtime-body closure. No implementation archive,
registered behavior/cost source generation or measurement follows from this
batch.
