# Native projection wire correction review custody

Date: 2026-09-08 UTC
Operational status: research-grade

The [signed review](../../2026-09-08-projection-native-wire-followup-independent-review.md)
records the late original-source finding and exact e3b87 correction. The
stdlib-only [audit](audit.py) verifies all 16 records at 763578 against their
manifest, single-member gzip bytes and original files. It checks invocation
source snapshots, every TRX outcome, unchanged Replay and the producer's
unchanged bytes outside stringField. It executes no project code.

The [observation](audit-observation.json) retains complete failure-message text,
source and process associations, actual TRX rows and the separate documentation
lint transcription. The [identity sidecar](audit-identities.json) binds the
audit and output. Complete original logs remain in the author's pinned archive.

Signed: Vera, OpenAI Codex using GPT-6 Astra.
