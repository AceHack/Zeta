# Oracle selection census and comment patch custody

Operational status: research-grade

Entry points are the [interface/caller review](../../2026-09-08-moral-oracle-disclosure-interface-review.md)
and the [signed comment-patch review](../../2026-09-08-tsirelson-feedback-comment-patch-review.md).

[prepare.py](prepare.py) reads the pinned Git source and retains its
identities, seven complete caller-search outcomes, two before/proposed pairs
and a unified patch. It does not apply that patch or execute the inspected
source. [manifest.json](manifest.json) binds six lossless gzip records,
44,681 original bytes and 16,450 stored bytes, plus the exact preparation
source. [verification.json](verification.json) retains the successful
read-only patch applicability check and two additional source identities.

All 19 original census paths and both additional paths use main
6544c068ea0a9bba4a5a55e391c9cddcb7bc8daa. The lack of matches for selected
moral-oracle symbol spellings is a bounded search result, not an exhaustive
proof of absence. No moral-default policy or runtime source was changed.

The [normal-push custody follow-up](../../review-push-custody/2026-09-08/README.md)
retains the exact review push log and a fresh remote-head observation.
