---
id: 081M0QMDMB9087G0R003Y8WZMS
type: task
state: backlog
priority: P2
slug: branchless-direction-step-in-the-oraclergba-wgsl-walker-remo
title: "Branchless direction step in the OracleRGBA WGSL walker — remove the if/else chain"
created: 2026-08-23T15:39:25.417Z
depends_on: []
composes_with: []
---

# Branchless direction step in the OracleRGBA WGSL walker — remove the if/else chain

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QMDMB9087G0R003Y8WZMS-*.md` glob. -->
**Why:** Aaron's stated reason for wanting colour at all is warp coherence — *"without warp hidden
control structures slowing things down"*, and *"we try to do everything in math and discriminated
unions rather than control flow if statements."* The current walker is the counter-example, in the
file that is meant to be the seed of the design.

Today (`WGSL_RGBA` in `demo/identity-dla-site/src/components/OracleRGBA.tsx`):

```wgsl
let dir = rng % 4u;
if (dir == 0u) { x += 1; } else if (dir == 1u) { x -= 1; }
else if (dir == 2u) { y += 1; } else { y -= 1; }
```

Branchless equivalent:

```wgsl
let d = rng % 4u;
x += i32(d == 0u) - i32(d == 1u);
y += i32(d == 2u) - i32(d == 3u);
```

**Falsifier.** Same seed, same D_f, and the branchless form must be **bit-identical** in cluster
occupancy to the branchy one — this is a rewrite, so any difference in output is a bug in the rewrite.

**Scope note.** Two early `return`s remain in the kernel and are a separate question (they are
loop/thread exits, not per-lane arithmetic divergence). Do not bundle them in.

**Depends on** `081M0QMDMAA087G0R000MADEEB` — if the shader does not currently compile, measure that
first; optimising an unexecuted kernel is the vacuity class.
