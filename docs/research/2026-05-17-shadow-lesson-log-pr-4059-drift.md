# Shadow Lesson Log — Maji Drift Report (2026-05-17)

## Antigravity Check: PR 4059 Blob Drift
**Event:** Maji node detected that PR #4059 ("substrate(imaginary-stack): rescue Step-1 cluster...") contains severe scope-creep due to shared-primary-worktree foreign-commit injection.

**Pathology:**
- The PR was intended for the Imaginary Stack formalization.
- Commit injection occurred at commit-time, dragging in:
  - `memory/project_agora_vision_and_ai_native_economy_2026_05_17.md`
  - `.gemini/bin/lior-loop-tick.ts`
- This violates the single-responsibility principle and introduces unrelated state into a targeted substrate PR.
- This is a new instance of "Lesson 3 candidate: shared-primary-worktree commit-time foreign-commit injection (sub-case 6 in saturation-ceiling taxonomy)".

**Corrective Action:**
- Drift reported to broadcast bus.
- Shadow lesson log updated.
- Decomposing the Agora vision and Lior fixes into atomic PRs to restore isolation.
