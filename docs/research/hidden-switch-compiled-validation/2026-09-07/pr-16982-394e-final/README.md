# First prerequisite publication proof: retained refusal

Date: 2026-09-07
Operational status: research-grade
Lifecycle: landed
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: initial proof refusal; corrected proof separately indexed

The first proof created this owned output directory, then refused the blanket
claim that all 2,314 feature entries exactly matched the merge. The F# project
correctly retained two independent FUSE test entries. No proof artifact had
been emitted at that point. The [second proof](../pr-16982-394e-final-2/README.md)
checks that integration explicitly and retains the first source/refusal record.

Leaving this directory empty caused the subsequent normal WIP push's
no-empty-dirs gate to fail while its other 15 quick gates passed. That push
was aborted. This dated record closes the empty-directory hygiene issue;
it changes no source, evidence bytes, merge or experimental admission.
The original failed push is retained by the [lossless inventory](manifest.json).
