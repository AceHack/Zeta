# Consistent Hashing — Research & Decisions

Captured from deep research agent 2025. Drives the selection in
`src/Dbsp.Core/ConsistentHash.fs`.

## Decision matrix

| Algorithm | Memory | Lookup | Rebalance churn | Supports removal | Supports weights | Maturity |
|---|---|---|---|---|---|---|
| Ring / ketama | O(N·V), V~160 | O(log NV) | ~1/N | yes | yes (vnodes) | production ~20y |
| **Jump** (Lamping–Veach 2014, arXiv:1406.2294) | O(1) | O(log N) | optimal 1/N | **no** (LIFO only) | no | production |
| HRW / Rendezvous (Thaler 1998) | O(N) | O(N) or O(log N) skeleton | optimal 1/N | yes | yes (Schindelhauer 2005) | production |
| Maglev (Google NSDI 2016) | O(M), M≈100N | O(1) | ~1% (not optimal) | yes | yes | production (Envoy, Cloudflare) |
| AnchorHash (Mendelson IEEE TNET 2020) | O(a) fixed | O(1) avg | near-optimal | yes | no | production-ready |
| DxHash (Dong ACM TOIT 2023) | O(a) bitmap | O(1) avg | near-optimal | yes | **arbitrary** | new but solid |
| **MementoHash** (Coluzzi IEEE TON 2024) | O(r), r=removed | O(ln n · ln(n/w)) | optimal | yes | no | **Pareto-best dynamic** |
| BinomialHash (2024) | O(1) | O(1) | optimal | via Memento wrap | no | brand-new |
| JumpBackHash (2024) | O(1) | O(1) expected | optimal | LIFO | no | 2024 |
| FlipHash (2024) | O(1) | O(1) | optimal | LIFO | no | 2024 |
| CRUSH (Weil 2006) | tree | tree-descent | optimal per level | yes | yes | production (Ceph) |

## Our picks

### Primary: `JumpConsistentHash` + `MementoHash`

- **Jump** is the hot-path default: zero memory, optimal rebalance,
  `O(log N)` lookup. Used by `Shard.Of` when bucket sets are known
  contiguous `[0, N)` and only grow.
- **MementoHash** is the elastic upgrade for worker pools that can
  fail/return: same Jump behaviour in the no-failures common case
  (zero perf regression), graceful degradation as workers go away
  with memory proportional to *actual failures* rather than capacity.
  The current Pareto-dominant algorithm per IEEE TON 2024.

### Secondary: `RendezvousHash` (named workers)

- For workers identified by name (`host-pod-42`) rather than index,
  HRW (Thaler 1998) is the natural fit. O(N) naive; bump to
  skeleton-tree for N > 64.
- For weighted heterogeneous workers, use
  **Schindelhauer-Schomaker 2005** logarithmic re-weighting
  `score = -ln(h) / weight` — true monotonicity under weight
  change, no vnode hack.

### Deferred

- **AnchorHash** — fixed-capacity pre-allocation is a footgun for
  DBSP's unknown-scale workloads.
- **CRUSH** — great for Ceph's replica placement across failure
  domains, but the hierarchical tree is the wrong abstraction
  for simple shard-to-worker routing. Revisit if we ever need
  AZ-aware placement.
- **Maglev** — still solid for L4 load balancing; we're not that.
- **Newer 2024 variants** (BinomialHash, JumpBackHash, FlipHash) —
  independent validation pending; track arXiv.

## Load-aware upgrade: Power-of-Two-Choices

Consistent hashing distributes keys uniformly but ignores
downstream load. **P2C** (Mitzenmacher 2001) picks two candidates
via the consistent hash and routes to the less-loaded — reduces
tail latency dramatically on heterogeneous workers. Used by Envoy,
NGINX upstream routing. Implement as a separate `LoadAwareRouter`
over `IConsistentHash`, not a new algorithm.

## Citations

- Jump — Lamping & Veach, [arXiv:1406.2294](https://arxiv.org/abs/1406.2294)
- HRW / Rendezvous — Thaler & Ravishankar 1998 (UMich TR);
  weighted variant: Schindelhauer & Schomaker 2005
- Multi-probe — Appleton & O'Reilly, [arXiv:1505.00062](https://arxiv.org/abs/1505.00062)
- Maglev — Eisenbud et al., NSDI 2016
- CRUSH — Weil et al., SC'06 (ceph.com/assets/pdfs/weil-crush-sc06.pdf);
  `straw2` is internal Ceph evolution
- AnchorHash — Mendelson et al., [arXiv:1812.09674](https://arxiv.org/abs/1812.09674) (IEEE TNET 2020)
- DxHash — Dong et al., [arXiv:2107.07930](https://arxiv.org/abs/2107.07930) (ACM TOIT 2023)
- **MementoHash** — Coluzzi et al., [arXiv:2306.09783](https://arxiv.org/abs/2306.09783) (IEEE TON 2024)
- FlipHash — Masson & Lee, [arXiv:2402.17549](https://arxiv.org/abs/2402.17549) (Feb 2024)
- JumpBackHash — Ertl, [arXiv:2403.18682](https://arxiv.org/abs/2403.18682) (Mar 2024)
- BinomialHash — Coluzzi et al., [arXiv:2406.19836](https://arxiv.org/abs/2406.19836) (Jun 2024)
