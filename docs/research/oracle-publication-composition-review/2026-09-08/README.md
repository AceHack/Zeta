# Oracle publication independent composition custody

Operational status: research-grade

The [signed review](../../2026-09-08-oracle-publication-composition-independent-review.md)
is the entry point. [audit.py](audit.py) reads the exact publication Git cut,
verifies all 26 earlier archive members and 17 imported artifacts, checks
source and manifesto preservation, and reconstructs the full merge tree.
It imports no project implementation and runs no numerical workload.

The complete [audit observation](audit-observation.json) binds every checked
record, current source identity, original import and later index addition.
The [manifest](manifest.json) binds the executed audit source and output,
plus 12 lossless gzip records: the four current full-gate records, five
coordinator merge records, and the reviewer's actual independent merge
command invocation/stdout/stderr. No log bytes are stripped or normalised.

The independent merge command deliberately returns one because its two
document conflicts are unresolved. The procedure then restores only the
two exact premerge oracle entries in a review-owned index and requires the
complete resulting tree to equal the actual publication tree. All generated
objects/index paths are inside the reviewer's private writer. The publication
clone's object directory is a read-only alternate; its worktree is untouched.

The initial [audit draft](audit-draft-1.py.gz) and its
[tool-observed refusal](audit-draft-1-observation.json) retain an overly strong
review assumption: original import hashes were required to equal final
research-note hashes despite two later additive index paragraphs. The
corrected audit binds the initial import first, then checks those exact
suffixes separately. This was an audit correction, not a source defect or
new validation run. No separately redirected first-attempt stderr existed;
the observation is labelled accordingly.
