---
id: B-0029.2
zetaid: 081KR50HA0008QG0R0027AAPTZ
priority: P2
status: open
title: "B-0029.2 — Setup: GitHub Sponsors profile + npm funding field (the 54th-package experiment)"
created: 2026-05-09
last_updated: 2026-05-09
parent: B-0029
depends_on: [B-0029.1]
classification: buildable-after-B-0029.1
type: feature
effort: XS
decomposition: atomic
---

# B-0029.2 — Open-source funding setup: the 54th-package experiment

**Slice of:** [B-0029](B-0029-superfluid-ai-substrate-enabled-autonomous-self-sustaining-funding-sources.md)

## What

Implement the lowest-friction funding surface from B-0029.1's survey. The "54th package" framing from Aaron's origin message — the 53 packages requesting funding plus Zeta as the 54th — motivates the minimal slice:

1. Add `funding` field to any applicable `package.json` in the repo (links to Sponsors page)
2. Evaluate whether a GitHub Sponsors profile on `Lucent-Financial-Group` is appropriate and feasible
3. Evaluate Open Collective as alternative/complement
4. Recommend which to activate first based on B-0029.1 survey findings

The goal is **one live funding link** that compounds passively — not a sponsorship campaign.

## Acceptance criteria

- [ ] `funding` field added to root `package.json` (or a justification committed if N/A for this repo type)
- [ ] Decision record committed: GitHub Sponsors vs Open Collective vs both, with rationale from B-0029.1 survey
- [ ] If Sponsors profile setup requires human maintainer action (GitHub org billing etc.), a clear instruction doc committed at `docs/ops/github-sponsors-setup.md`
- [ ] B-0029.1 survey findings referenced in the decision

## Dependencies

Depends on B-0029.1 because positioning language and tier structure should be informed by comparable projects before committing to a public profile.

## Out of scope

- Marketing, outreach, or any active sponsorship campaign
- Grants (that is B-0029.3)
- Trading revenue (that is B-0029.4)

## Effort sizing

XS — config changes + a decision record doc. No implementation code.
