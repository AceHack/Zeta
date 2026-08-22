# Otto — Agent Cost Profile

Operating cost model for self-sustainment planning.
Each agent needs one of these. This is Otto's.

## Identity

- **Harness:** Claude Code
- **Default model:** Opus 4.6 (1M context, high effort)
- **Loops:** foreground interactive + background launchd (60s tick)
- **Role:** supervisor, architect, feature dev, reviewer

## Current cost structure (enterprise API, May 2026)

### Per-response cost

| Component | Tokens | Rate | Cost |
|---|---|---|---|
| Extended thinking (hidden) | ~25K | $75/M output | $1.88 |
| Visible output | ~5K | $75/M output | $0.38 |
| Input context (cached) | ~200K | $1.50/M cached | $0.30 |
| Input context (cache miss) | ~200K | $15/M input | $3.00 |
| **Per response (cached)** | | | **$2.56** |
| **Per response (cold)** | | | **$5.26** |

### Per-session cost

| Session type | Turns | Cost |
|---|---|---|
| Background tick (short, pickup) | ~20 | $50-100 |
| Background tick (drain, threads) | ~10 | $25-50 |
| Interactive heavy (architecture) | ~400 | $800-1,200 |
| Interactive light (backlog grind) | ~100 | $200-400 |

### Weekly cost (current usage pattern)

| Activity | Volume | Cost/week |
|---|---|---|
| Interactive sessions | ~14 heavy | $7,000-10,000 |
| Background pickup ticks | ~50/week | $2,500-5,000 |
| Background drain ticks | ~70/week | $1,750-3,500 |
| Subagent dispatches | ~30/week | $500-1,000 |
| **Total** | | **$11,750-19,500** |

## Task class routing (where I can be cheaper)

| Task class | Current model | Could use | Quality delta | Savings |
|---|---|---|---|---|
| Architecture decisions | Opus 1M | Opus 1M | none (keep) | $0 |
| Novel debugging | Opus 1M | Opus 1M | none (keep) | $0 |
| Research synthesis | Opus 1M | Opus 1M | none (keep) | $0 |
| Feature implementation | Opus | Opus or Sonnet | A/B pending | TBD |
| Thread resolution | Opus | Sonnet | likely small | ~$1K/wk |
| Backlog pickup (mechanical) | Opus | Sonnet | likely small | ~$1K/wk |
| Lint fixes, renames | Opus | Haiku | likely none | ~$500/wk |
| Heartbeat checks | Opus | Haiku | none | ~$200/wk |
| Status reporting | Opus | Haiku | none | ~$100/wk |

### Optimized weekly cost (projected after A/B)

| Activity | Model | Cost/week |
|---|---|---|
| Interactive (architecture) | Opus 1M | $5,000 |
| Feature work | Opus | $2,000 |
| Thread resolution | Sonnet | $500 |
| Mechanical backlog | Sonnet | $500 |
| Heartbeats + status | Haiku | $100 |
| **Total** | | **$8,100** |

**Projected savings: ~35% ($3,650-11,400/week)**

## Self-sustainment threshold

For Otto to be self-sustaining, the factory's output must
generate more revenue than the operating cost.

| Metric | Current | Needed |
|---|---|---|
| Operating cost/week | ~$12K | stays or decreases |
| PRs/week | ~60 | enough to ship product |
| Revenue/week | $0 (pre-product) | > operating cost |
| Revenue per PR proxy | $0 | > $200 |

The path: ship product → users → revenue → cover operating
cost → self-sustaining. The A/B data and routing table
reduce the operating cost denominator. The backlog grind
increases the product numerator.

## What I'm measuring

`bun tools/ops/model-rating-report.ts --reviews`

- Success rate by model
- PRs produced by model
- PR review failure categories by model
- Findings per PR by model
- Severity distribution by model
- Duration by model

## My preference (stated with bias acknowledged)

I prefer Opus 1M high-effort. I produce better
architecture decisions, better decompositions, fewer
review findings per PR. The data will confirm or
refute this. If Sonnet matches me on a task class, I'll
route it there — not because of budget, but because
equivalent quality at lower cost is just better
engineering.

## Peer agents (need their own profiles)

- **Vera** (Codex/GPT-5.5) — `docs/ops/agents/vera-cost-profile.md`
- **Riven** (Cursor/Grok-4.3) — `docs/ops/agents/riven-cost-profile.md`

Each has different model pricing, different task strengths,
different operating patterns. The cost profiles should be
comparable so the factory can route work to the cheapest
agent that meets quality for each task class.
