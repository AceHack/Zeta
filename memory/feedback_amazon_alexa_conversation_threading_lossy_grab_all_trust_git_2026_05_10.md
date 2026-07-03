---
name: Amazon Alexa conversation threading is lossy — grab all, trust git
description: Amazon merges/splits conversations unpredictably. Same URL may return different content at different times. Always grab full page, never trust URL as stable boundary. Git is the stable reference.
type: feedback
originSessionId: fb6abb97-a97f-44e9-8ed1-bbded23b73b1
---
Amazon Alexa's conversation threading is lossy (discovered 2026-05-10):

- Same conversation URL may return different content at different times
- Amazon merges conversations from different sessions and splits single sessions across URLs
- An extraction at time T1 (11KB) and time T2 (76KB) from the same URL are NOT necessarily superset/subset — they may be partially overlapping, partially disjoint
- Content can appear and disappear as Amazon re-threads

**Why:** Amazon's conversation persistence is optimized for their UX, not for archival. The threading algorithm is opaque and non-deterministic from our perspective.

**How to apply:**

1. Always grab the full page on every extraction — don't assume a previous extraction is still current
2. Save each extraction as a separate git commit — the diff shows what Amazon's threading changed
3. Never trust the conversation URL as a stable boundary — the conversation ID maps to mutable content
4. If extracting the same URL twice, keep BOTH versions (they complement each other)
5. Git is the stable reference, not Amazon's threading
6. Apply this same principle to any lossy platform (voice-mode transcripts, chat exports from any vendor)
