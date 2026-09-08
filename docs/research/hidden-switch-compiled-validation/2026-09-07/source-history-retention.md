# Guarded hidden-switch compilation: source-history retention

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: implementation work in progress; no implementation archive

The independent writers retain original commits referenced by validation
records. Integration uses ordinary cherry-picks, so its history alone does
not make every original writer commit reachable. Preserve the following
long-lived WIP refs through evidence publication and subsequent archival.
These are mutable, fast-forward-only preservation branches, separate from
the immutable scientific registration and any future implementation tag.

| Lane | Preservation branch | Initial checkpoint |
| --- | --- | --- |
| root | `wip/compiled-validation-root-20260907` | `8c3e5abd663c49c3d6cff6fa2de0188b1609e04e` |
| native | `wip/compiled-validation-native-20260907` | `c05a133965d43b004baa1d615e2aea443bc52eea` |
| reference | `wip/compiled-validation-reference-20260907` | `cdcf34d759a74201aa5599f4556e07af00f6dc4a` |
| review | `wip/compiled-validation-review-20260907` | `7a2519953843ac077b44efa798b0a45524b972ea` |

Push and remote-read verification must precede reliance on these refs in
a main publication. Subsequent forward updates may preserve more history;
never replace an earlier checkpoint with unrelated history. The publication
record will retain the observed full refs and hashes separately. A reachable
checkpoint preserves provenance; it does not certify all its source or admit
a runtime. The frozen behavior and cost streams remain unopened until the
separate reviewed implementation archive and all registered prerequisites.
