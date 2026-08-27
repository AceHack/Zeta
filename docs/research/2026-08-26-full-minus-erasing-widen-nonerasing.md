# Full −1 is erasing of the view; widening is non-erasing of support

*2026-08-26. Operational status: research-grade absorb of a current-state
plan; live pointer
[`docs/trajectories/own-ai-harness/RESUME.md`](../trajectories/own-ai-harness/RESUME.md).
GOVERNANCE.md §33.*

Aaron 2026-08-26: *our −1 can be viewed as full retraction, this is
erasing, and uncertainty widening non-erasing.* Reversible-computing
theory is already the vocabulary (`ErasureClass`, Landauer 1961,
Bennett 1973). Dual-use: the mechanism is retraction; the
**observation** decides the class.

## Three observations (not one)

| Observation | Op | Class w.r.t. that observation |
|---|---|---|
| The Z-set after `neg` | `ZSet.neg` / `WSet.negate` | **Reversible** — bijection, Bennett-free. Landauer meter reads 0. |
| The **view** after `z + (−z)` | add then consolidate | **Erasing** — annihilation maps two states to one. Support gone. |
| SoftValue candidate support after `widen` | `SoftValue.widen` | **Non-erasing of support** — no candidate dropped; optionality restored. |

`WSet.fs` already says negate and annihilation "are easily read as one
operation, and they are not." Full −1 *as one op on the view* is the
erasing reading. Widen is the non-erasing reading. Inverse-free
corners (EP/ADF re-normalise) do not get the erasing reading; they
can still widen.

`foldRetained` is the commutative twin of widen: retract the evidence
**set** (Z-set −1 of a named prior), re-fold. That −1 is an append, not
a rewrite. Whether the *view* erases depends on consolidation; the
*log* stays append-only.

Workitem `081M10BD9BM087G0R001SGDRXT`. Module `src/Core/RetractionReading.fs`.

## Anchors

- Landauer 1961 — logical irreversibility priced
- Bennett 1973 — bijective steps are free
- Anderson & Anderson 1999 — covariance inflation (widen's classical analogue)
- `ErasureClass` — class is relative to a declared observation
