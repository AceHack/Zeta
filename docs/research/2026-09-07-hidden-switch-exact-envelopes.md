# Hidden switch: exact value envelopes for the supplied model

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XK02XM087G0R00043EW05
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: auxiliary finite-model derivation, outside behavioral/cost evidence

## Scope and units

The fixed model in the [registered protocol](2026-09-07-hidden-switch-protocol.md)
has a simple exact action boundary at each registered planning depth.
For `effect=true`, the depth-two boundary is `1/5` and the depth-three
boundary is `51/190`. Depth one always harvests. The null model always
harvests at all three depths. These statements concern exact arithmetic;
the registered tolerance and floating-point qualifications appear below.

This note interprets the supplied `q=1/8`, `p=3/4` model using the
[independent Fraction oracle](../../src/Interp.Python/zeta_interp/hidden_switch_reference.py).
It is not preregistered behavioral evidence. No source tape, registered
seed stream, episode, new policy arm, cost corpus or timing was generated
or executed for this derivation. The registered experiment, its arms and
its promotion thresholds remain unchanged. The computation enumerates
finite contingent policy trees and checks rational line inequalities.

Let `b=P(x=1)` immediately before choosing an action, after conditioning on
the current cue. Write `H` for harvest and `S` for switch. Values below are
expected sums of the next `d` rewards in reward units: a successful harvest
is `1`, an unsuccessful harvest is `0`, and switching costs `-1/4`.
They are not integer `Reward4` units and are not divided by depth.
The registered sixteen-step normalized return is `sum(Reward4)/64`, or
the reward-unit sum divided by `16`; its range is `[-1/4,1]`. Scaling both
action values by the same positive factor preserves an exact argmax,
but a numerical tie tolerance must be scaled with the values.

## Root-action envelopes when switching changes the hidden state

All intervals lie in `0 <= b <= 1`. At a shared endpoint the two adjacent
expressions agree, so either expression may be used.

| Depth | Root action | Belief interval | Exact action value |
| --- | --- | --- | --- |
| 1 | H | `[0,1]` | `b` |
| 1 | S | `[0,1]` | `-1/4` |
| 2 | H | `[0,1]` | `1/8 + 7b/4` |
| 2 | S | `[0,1]` | `5/8 - 3b/4` |
| 3 | H | `[0,17/42]` | `39/64 + 53b/32` |
| 3 | H | `[17/42,1]` | `11/32 + 37b/16` |
| 3 | S | `[0,25/42]` | `45/32 - 21b/16` |
| 3 | S | `[25/42,1]` | `65/64 - 21b/32` |

The exact Bellman values `V_d(b)=max(Q_d(H,b),Q_d(S,b))` are:

| Depth | Belief interval | Exact value |
| --- | --- | --- |
| 1 | `[0,1]` | `b` |
| 2 | `[0,1/5]` | `5/8 - 3b/4` |
| 2 | `[1/5,1]` | `1/8 + 7b/4` |
| 3 | `[0,51/190]` | `45/32 - 21b/16` |
| 3 | `[51/190,17/42]` | `39/64 + 53b/32` |
| 3 | `[17/42,1]` | `11/32 + 37b/16` |

The exact maximizing root action is S below `1/5` at depth two and below
`51/190` at depth three; H is strictly better above the relevant boundary.
At the boundary both root actions have equal value. The internal envelope
kinks `17/42` and `25/42` are ties between continuation trees for a fixed
root action, not additional root-action ties.

One direct derivation makes the cue dependence explicit. After the action,
the predicted prior is `u_H=1/8+3b/4` or `u_S=7/8-3b/4`. For either
action, `u` lies in `[1/8,7/8]`. The next-cue probabilities and posteriors are:

- Cue zero: probability `(3-2u)/4`, posterior `u/(3-2u)`.
- Cue one: probability `(1+2u)/4`, posterior `3u/(1+2u)`.

Depth-one harvest strictly dominates switch, so the depth-two formulas
follow by adding the immediate reward to the expected next belief. For
depth three, a cue-one posterior is at least `3/10`, above the depth-two
switch boundary `1/5`. The cue-zero posterior crosses `1/5` exactly at
`u=3/7`. Therefore the expected depth-two continuation is
`G(u)=1/2+7u/8` for `u <= 3/7`, and `G(u)=1/8+7u/4` for `u >= 3/7`.
Substituting into `Q_3(H,b)=b+G(u_H)` and
`Q_3(S,b)=-1/4+G(u_S)` gives the table. Equating the applicable first
pieces gives `(51-190b)/64=0`, hence the unique root tie `51/190`.

## Null model and tie qualifications

When `effect=false`, both actions have the same transition and cue law.
Their only difference is immediate reward. Thus
`Q_d(H,b)-Q_d(S,b)=b+1/4 > 0` for every admitted belief and depth.

| Depth | Exact H value, also V | Exact S value |
| --- | --- | --- |
| 1 | `b` | `-1/4` |
| 2 | `1/8 + 7b/4` | `-1/8 + 3b/4` |
| 3 | `11/32 + 37b/16` | `3/32 + 21b/16` |

There is no null root tie, including at `b=0`. The minimum action gap is
`1/4` in the stated reward units.

The registered selection rule favors H whenever the action-value
difference has absolute value at most `epsilon=1e-12`. Applied to exact
values in the units above, S is selected only when:

- Depth two: `b < 1/5 - 2*epsilon/5`.
- Depth three: `b < 51/190 - 32*epsilon/95`.

Equality at these shifted boundaries selects H. The formulas describe the
selection rule applied to exact envelopes, not certified binary64
boundaries. Native and reference recursion evaluate values numerically;
rounding, subtraction and the representable value of `1e-12` can affect
beliefs extremely close to a boundary. No bit-for-bit equivalence between
a compiled threshold and the executed recursive policy is established.

The recursion propagates the numerical maximum of child action values,
even when tolerance would select the slightly lower H action. Accordingly,
the exact envelopes describe Bellman maxima; they are not a claim that a
tolerance-selected policy attains that maximum exactly at every belief.
The [independent review](2026-09-07-hidden-switch-independent-review.md)
records a depth-three regression witness for that distinction.

## Finite certificate and reproducible derivation

For each depth, an alpha vector `(a0,a1)` represents one contingent policy
tree and gives the affine value `a0+(a1-a0)*b`. The oracle enumerates all
`2`, `8`, and `128` trees at depths one, two and three, respectively:
`1`, `4`, and `64` candidates for each fixed root action. There is no
pruning before the certificate check.

For every interval in an asserted envelope, its line is itself one of the
candidate lines. At both endpoints it must dominate every candidate for
that root action. The difference of two affine functions is affine, so
endpoint dominance proves dominance at every point of the closed
interval. Coverage of `[0,1]` then proves the whole envelope. The same
check over all root actions proves each `V_d` envelope. This is a finite
certificate over the enumerated model, rather than a sampled belief grid
or a claim of theorem-prover verification of the oracle implementation.

The following inline derivation was executed with the pinned reference
source from remotely preserved commit
`adfefff120f29224298539367822f3c6911dea42`. It checks the source SHA256
before loading it; this source pin is separate from the eventual complete
experiment implementation archive. Run from a clone containing that
commit with its existing Interp Python environment. It does not call the
source generator, numerical planner or episode runner.

```bash
uv run --project src/Interp.Python python - <<'PY'
from fractions import Fraction as F
from hashlib import sha256
from itertools import combinations
import subprocess
import sys
import types

rev = "adfefff120f29224298539367822f3c6911dea42"
path = "src/Interp.Python/zeta_interp/hidden_switch_reference.py"
source = subprocess.run(
    ["git", "show", f"{rev}:{path}"], check=True, capture_output=True
).stdout
assert sha256(source).hexdigest() == (
    "7130fbf88e4a5f7393ad59cffd6c56637b3d226f630b8cf547167d319bf880e2"
)
module = types.ModuleType("pinned_hidden_switch_reference")
sys.modules[module.__name__] = module
exec(compile(source, f"{rev}:{path}", "exec"), module.__dict__)

def envelope(candidates):
    lines = sorted(set(candidates))
    points = {F(0), F(1)}
    for (c, m), (d, n) in combinations(lines, 2):
        if m != n and 0 < (x := (d-c)/(m-n)) < 1:
            points.add(x)
    cuts = sorted(points)
    result = []
    for lo, hi in zip(cuts, cuts[1:]):
        c, m = max(lines, key=lambda line: line[0]+line[1]*(lo+hi)/2)
        assert all(c+m*x >= d+n*x for x in (lo, hi) for d, n in lines)
        if result and result[-1][2:] == (c, m):
            result[-1] = (result[-1][0], hi, c, m)
        else:
            result.append((lo, hi, c, m))
    assert result[0][0] == 0 and result[-1][1] == 1
    assert all(a[1] == b[0] for a, b in zip(result, result[1:]))
    for lo, hi, c, m in result:
        assert (c, m) in lines
        assert all(c+m*x >= d+n*x for x in (lo, hi) for d, n in lines)
    return [tuple(map(str, row)) for row in result]

for effect in (True, False):
    for depth in (1, 2, 3):
        trees = module.alpha_vectors(depth, effect, F(1, 8), F(3, 4))
        assert len(trees) == {1: 2, 2: 8, 3: 128}[depth]
        for action in (0, 1, None):
            lines = [(t.values[0], t.values[1]-t.values[0])
                     for t in trees if action is None or t.action == action]
            print(effect, depth, "V" if action is None else action,
                  envelope(lines))
PY
```

Each printed row is `(left, right, intercept, slope)`. All exact endpoint
inequalities passed, and the output gave the action and value intervals
reported above. Deduplicating equal lines only removes identical affine
functions; every original tree is still represented in the comparisons.
The derivation is independently readable through `G(u)` above, but the
executable certificate still depends on the correctness of the pinned
alpha-vector construction. Its separate transition/emission formulation
and existing rational conformance tests are described in the review.

## Interpretation boundary

In exact arithmetic, the depth-three receding-horizon action rule can be
written as a belief threshold using `51/190` with at least three decisions
remaining, `1/5` with two remaining, and H with one remaining. A tolerance
version can use the shifted boundaries above. This exposes a possible
compiled form of the supplied finite controller. It neither implements
that controller nor measures its return, cost or agreement with native
binary64 recursion.

The registered planner may demonstrate the value of using action effects
and delayed consequences under partial observability. Its comparison with
myopic and padded-myopic controls cannot identify online tree search as a
necessary computation. The exact envelopes make that limitation concrete;
they do not add a new experimental comparison or alter any registered
behavioral or resource criterion.
