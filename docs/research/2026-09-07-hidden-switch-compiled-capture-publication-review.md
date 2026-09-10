# Guarded hidden-switch compilation: capture publication review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Parent work item: 081M1XXWTTF087G0R000X1HMD0
Publication work item: 081M1YPKNM3087G0R001M4RW87
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, independent reference writer
Artifact status: historical preservation review; no runtime admission

The bounded publication at `11cd3368af8fbd0f20b45ae4a825372ed2144b3a` is
accepted with no material inventory, preservation, link or interpretation
finding. The reviewed tree adds the historical capture, its original manifest,
publication records, explanatory README and source-history index. It changes
no scientific source, protocol or immutable registration tag.

## Independent inventory checks

The capture manifest contains exactly 2,550 records with unique original and
stored names. The pinned directory contains exactly those stored gzip files,
the original manifest and the new README. Their summed original sizes are
10,204,700 bytes and their summed stored sizes are 1,753,389 bytes. This reviewer
independently checked every compressed file's byte count and SHA256 against
the pinned manifest, without decompressing or inspecting capture contents.

The original manifest is 1,014,124 bytes with SHA256
`0DDB88BC8E991FFC972A45DEFF20254FCE5C1CE63F639EDAFC7CB77BEEB57C09`.
All 2,551 original Git blobs (2,550 compressed records plus manifest) match
the earlier integration tree `dc0c650acac9fd66b608e29f72bf82dd7b880e70`
exactly. That object was inspected in the original coordinator writer because
it was absent from the bounded publication clone's local object database.
The two launch records retain their original paths outside the historical
capture directory; no path normalization or rewriting was applied.

The manifest's filename inventory includes 123 sets of candidate, decoded,
mapping and raw body records; 779 transfer mapping/prefix pairs; 189 repeated
cell reads; 32 unresolved-transfer records; 123 decoded/raw prefix pairs and
four refused prefixes. These inventory observations agree with the README's
bounded account. They do not independently certify instruction interpretation,
complete method extents or the live selector's object relationship.

The reviewer also verified stored and decompressed byte/hash pairs for all
seven small publication verification records, and read the preservation
script and its actual verification result. The author-executed script checks
all original-byte hashes, exact single gzip members, unchanged source copies
and both totals. This review independently verifies the stored capture bytes
and retained verification evidence; it does not claim to have rerun the
capture's decompression or debugger inspection.

## Reachability, checks and scientific scope

All four live preservation refs matched the recorded checkpoints at review:

| Ref under `refs/heads/wip/` | Observed checkpoint |
| --- | --- |
| `compiled-validation-root-20260907` | `8c3e5abd663c49c3d6cff6fa2de0188b1609e04e` |
| `compiled-validation-native-20260907` | `c05a133965d43b004baa1d615e2aea443bc52eea` |
| `compiled-validation-reference-20260907` | `cdcf34d759a74201aa5599f4556e07af00f6dc4a` |
| `compiled-validation-review-20260907` | `7a2519953843ac077b44efa798b0a45524b972ea` |

The reviewer independently confirmed that original native source
`18ef52ac8dea69a0bd98c4cce9c08619d90d7757` is an ancestor of the native
checkpoint. These mutable preservation refs retain original histories; they
are distinct from the future immutable implementation archive. All 16
relative links in the reviewed capture README, source-history record and
validation index resolve in the exact publication tree.

The retained publication log reports all 18 full-preflight checks passing,
including build and test commands. Both retained push logs report all 16
quick checks passing. Those checks were author-executed and were not rerun by
this reviewer. The publication correctly keeps all runtime, body, layout and
closure admission flags false, preserves unresolved dependencies and makes
no claim about later source changes, speed, registered behavior/cost streams
or a completed implementation.

No reviewer test suite, native target, policy call, dump read, registered
source generation or measurement was performed. Separately retained actual native slice replay has its own narrower numerical
conformance scope; this publication does not import that implementation or
upgrade either record to whole-runtime admission.

Signed: Vera, OpenAI Codex using GPT-6 Astra, independent publication reviewer.
