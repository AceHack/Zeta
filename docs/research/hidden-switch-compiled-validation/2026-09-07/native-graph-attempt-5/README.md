# Historical compiled-controller graph capture five

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1YPKNM3087G0R001M4RW87
Parent implementation: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: unchanged diagnostic evidence; runtime admission remains false

This publication preserves all 2,550 records from the fifth historical
compiled-controller graph capture. The [original manifest](manifest.json)
remains byte-identical: 10,204,700 original bytes are stored as 1,753,389 bytes
of lossless gzip, excluding the manifest. Each file is exactly one gzip member;
both byte counts and SHA256 values have been independently checked during
publication preparation. [Verification records](../capture-five-publication/manifest.json)
retain the actual check and source-preservation evidence.

The capture ran source `18ef52ac8dea69a0bd98c4cce9c08619d90d7757` on
2026-09-07 from 18:30:34.020760 to 18:30:37.232363 UTC. Native process 89475
and LLDB both exited zero. The records retain inputs, candidate instruction
spans, prefixes, guard data, selected cells and their repeated reads, unresolved
transfers, compiler text, native pin release and terminal outcomes.

There are 123 compiler-sized candidate spans totaling 33,496 bytes. The selected
transfer ledger has 811 rows: 590 direct transfers, 189 recognized indirect
cell shapes and 32 unresolved indirect dependencies. The observed guard-data
bytes agree with the same pinned object's getters and repeated debugger read.
These correspondences leave complete method extents, helper closure, dispatch
explanation and the selector's live object relationship unproved. All runtime,
body, layout and closure admission flags remain false.

This is a bounded preservation PR because the wider implementation checkpoint
exceeds GitHub's documented [3,000-file PR-files endpoint maximum](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files).
The original manifest uses `File` for the original local provenance path and
`StoredFile` for the adjacent preserved gzip file. Neither field is rewritten
into the later phase descriptor schema. The [original writer histories](../source-history-retention.md)
remain reachable separately from any future scientific implementation archive.

The [registered protocol](../../../2026-09-07-hidden-switch-compiled-protocol.md)
and its immutable tag remain unchanged. This capture precedes later source
changes and is not admission of their executing code. No registered behavior
or cost stream, measurement, speed result or completed implementation is
introduced here. The parent implementation task continues.

## Publication validation

The first full local preflight passed all 18 checks, including the release
build and full .NET test command. The raw log is retained in the verification
inventory. The earlier publication-claim hook and source-history push each
passed all 16 quick checks. Those are repository publication checks, not
runtime admission or validation of later compiled implementation source.

The [independent publication review](../../../2026-09-07-hidden-switch-compiled-capture-publication-review.md)
accepts the exact `11cd3368af8fbd0f20b45ae4a825372ed2144b3a` inventory and
retention scope. It independently verifies all stored-file hashes and original
Git blob identities, while distinguishing retained author checks from reviewer
execution. No runtime admission or new target execution follows from it.
