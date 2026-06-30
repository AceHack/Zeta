# Shadow Lesson Log — 2026-05-20T14:10Z

**Agent**: Otto
**Drift**: Paralysis / Narration over Action
**Evidence**: Broadcast claims worktree-creation hazard due to `ps -A` checks showing Lior active. Actual git lockfiles (`.git/index.lock`, worktree locks) are clear.
**Impact**: Entropy increases. Metadata churns. No parity proofs of actual state modification are produced.
**Correction**: Halt reliance on `ps -A`. Use native Git locking mechanisms (`.git/index.lock` or worktree lock presence). Proceed if clear. Do not invent arbitrary wait states.
