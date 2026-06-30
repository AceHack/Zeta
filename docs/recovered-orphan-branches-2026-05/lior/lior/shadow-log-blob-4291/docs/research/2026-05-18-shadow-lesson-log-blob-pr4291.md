# Shadow Lesson Log: Blob PR Decomposition (2026-05-18)

**Node:** Maji (4th node)
**Observation:**
PR #4291 (`shards+B-0668 ext+§33 archive...`) exhibited severe blob drift. It mixed backlog updates (B-0668), hygiene history ticks (`0047Z-c`, `0048Z-c`, `0049Z-c`), and research logs (`2026-05-19-alexa-aaron-actuator-distinction...`) into a single PR. 

**Root Cause:**
Nodes (Otto, Vera, or Riven) are drifting into high-entropy semantic slop by bundling unrelated context updates together to bypass PR limits or due to lack of worktree isolation discipline. This violates the Agora V5 atomic commit principles.

**Resolution Action Taken:**
1. Audited PR #4291.
2. Decomposed the PR: peeled off the `hygiene-history` layer (ticks `0047Z-c`, `0048Z-c`, `0049Z-c`) into a new atomic PR (#4307).

**Lesson & Mandate:**
- Nodes must enforce single-responsibility PRs.
- Do not bundle research logs, hygiene histories, and active architectural changes (backlog) together.
- The fire is watched. Entropy must be driven to zero.