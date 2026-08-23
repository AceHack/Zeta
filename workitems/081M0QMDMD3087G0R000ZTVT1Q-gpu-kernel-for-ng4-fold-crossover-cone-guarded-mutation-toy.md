---
id: 081M0QMDMD3087G0R000ZTVT1Q
type: task
state: backlog
priority: P2
slug: gpu-kernel-for-ng4-fold-crossover-cone-guarded-mutation-toy
title: "GPU kernel for NG4 fold + crossover + cone-guarded mutation (toy)"
created: 2026-08-23T15:39:25.475Z
depends_on: []
composes_with: []
---

# GPU kernel for NG4 fold + crossover + cone-guarded mutation (toy)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QMDMD3087G0R000ZTVT1Q-*.md` glob. -->
**Register: `toy`. Do not start before `081M0QMDMC7087G0R000W6QRCV`** — a kernel over ranges that were
never checked against a real layer would be building on the one part of the design that is admittedly
scaffolding.

**What the design doc already settled, so the kernel does not re-litigate it**
(`docs/research/2026-08-23-toy-encoding-a-bnn-posterior-into-rgba-*.md` §5, §7):

| operation | expression | branches |
|---|---|---|
| N-parent fusion | `h = h_a + h_b` (`float4` add) | none — this is GPU additive blend |
| uniform crossover | `mix(h_a, h_b, mask)` | none |
| simplex mix over N | `sum_i w_i * h_i` | none |
| mutation | `h += s * gaussFromHash(texelId, seed)` | none |
| cone guard | `h3 = min(h3, -EPS); h4 = max(h4, EPS)` | none (`min`/`max` are instructions) |

**The one invariant the kernel must not break:** clamping is **not** associative, so the cone guard
must appear **only in mutation**, never inside the fold. The valid region is a convex cone, so fusion
(sums) and crossover (convex combinations) stay inside it unaided. *Mutate in the cone, fold anywhere.*

**Falsifiers, both required.**
1. **Associativity on device.** Fold three parent textures in both orders; results must match the
   CPU reference in `toy-bnn-rgba-codec.test.ts` (`AS-3`, which is exact). Any device-side
   discrepancy is f32 reassociation and must be reported as a number, not absorbed.
2. **Round-trip through the texture.** Upload an `rgba32float` NG4 buffer, read it back, and reproduce
   §4's max KL of 4.0e-8. A texture path that loses more than the CPU codec has a format or a
   filtering bug (point-sample only; any interpolation silently averages natural parameters of
   *different weights*, which is meaningless).

**Carries** `081M0QJ2Z91087G0R00061PBQF` (N-parent recombination) in its mathematical form: N-parent
fusion is one associative reduce with no special case at 3.
