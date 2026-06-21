# Cost Reduction Lessons — token budget economics

Learnings from running a 200+ skill AI factory on Claude Code
on **enterprise API billing** (per-token, not subscription).

For prototypes with one dev on Max ($200/month), token budgets
don't matter — you're capped. On enterprise API billing, every
token is real money. This doc is for the API billing case.

## The headline number

A heavy week on Opus 4.6 high-effort with 3 background agents
costs **$8,000-12,000/week** on enterprise API billing. The
breakdown and the levers to cut it are below.

## Lesson 1: Skill descriptions are a per-call tax

### The problem

Every Claude Code session loads the skill listing into context.
With 200+ skills at ~50 tokens each = ~10K input tokens loaded
before the agent reads a single line of code.

### The cost (Claude Opus 4.6, May 2026 pricing)

| Scenario | Input tokens | Cost per session start |
|---|---|---|
| Paragraph descriptions (50 tok × 200) | 10,000 | $0.050 |
| Carved sentences (15 tok × 200) | 3,000 | $0.015 |
| **Savings per session** | 7,000 | **$0.035** |

At $15/M input tokens (Opus 4.6):

| Scale | Sessions/day | Annual waste (paragraphs) | Annual savings (carved) |
|---|---|---|---|
| 1 dev, interactive | ~20 | $365 | $255 |
| 1 dev + background loop | ~100 | $1,825 | $1,278 |
| 3 agents (Otto/Vera/Riven) | ~300 | $5,475 | $3,833 |
| 10 devs + agents | ~1,000 | $18,250 | $12,775 |
| 50 devs + agents | ~5,000 | $91,250 | **$63,875** |

**With prompt caching** (cache hit = 10% of input price):

- First load: full price ($0.050 per session)
- Cached loads (within 5min TTL): $0.005 per session
- Background loops hitting every 60s stay cached; the
  skill listing cost drops to ~$0.001 per tick
- But: every new session, every compaction, every cache
  miss pays full price again

### The fix

081KR50HA0008QG0R002ZNFQBZ: Carve every skill description to <120 chars.
Cost: zero (mechanical edit). Savings: 70% of skill
listing budget.

## Lesson 2: CLAUDE.md size is a per-call tax

### The problem

CLAUDE.md at 62K chars (~15K tokens) loads on every session
start. That's $0.075 per session on Opus 4.6.

| Scale | Sessions/day | Annual CLAUDE.md cost |
|---|---|---|
| 1 dev | 20 | $548 |
| 3 agents | 300 | $8,213 |
| 10 devs + agents | 1,000 | $27,375 |

### The fix

081KQJZR90008QG0R002Z4B6VW: Trim CLAUDE.md to <40K chars. Move content to
`.claude/rules/` (auto-loaded, same priority) or skills
(router-loaded, pay only when needed).

## Lesson 3: Context compaction multiplies input cost

Every time the context window fills and compaction fires,
the compacted summary becomes new input tokens on the next
turn. A 200K context session that compacts 3 times pays
for the skill listing + CLAUDE.md content ~4 times.

**Mitigation**: Keep sessions shorter. Use subagents for
context-heavy work (they get their own window). The
background loop's 60s tick cycle naturally stays short.

## Lesson 4: The `/doctor` command catches budget waste

`/doctor` reports:

- Skill descriptions exceeding per-entry cap (truncated)
- Skill descriptions dropped entirely (invisible to router)
- Large CLAUDE.md files
- Settings schema errors (broken hooks = wasted retries)

Run `/doctor` after any settings or skill change.

## Lesson 5: Budget fraction vs description length

`skillListingBudgetFraction` in settings.json controls what
% of context the skill listing can use. Default is 1%.

**Budget fraction is a lever; description length is the
multiplier.** Raising the fraction costs context everywhere
(less room for code, conversation, tool results). Shortening
descriptions costs nothing.

| Approach | Context cost | Routing quality |
|---|---|---|
| Raise fraction to 5% | High (10K tokens) | Good |
| Carve descriptions | Low (3K tokens) | Same or better |
| Both | Medium | Best |

## Lesson 6: Extended thinking is 70% of the bill (THE BIG ONE)

### The problem

High-effort mode on Opus generates **10-50K thinking tokens
PER RESPONSE**. These are billed as **output tokens at $75/M**
— 5x the input rate. This is the dominant cost center, not
skill descriptions or CLAUDE.md.

### The math

```
One response on Opus high-effort:
  Thinking tokens: ~25K average (hidden, still billed)
  Visible output:  ~5K
  Total output:    30K × $75/M = $2.25 per response

One heavy interactive session (400 turns):
  Output: 400 × 30K = 12M tokens × $75/M = $900
  Input:  400 × 200K = 80M tokens × $1.50/M (cached) = $120
  Session total: ~$1,020

One background loop tick (shorter):
  Output: ~10K tokens × $75/M = $0.75
  Input:  ~50K tokens × $15/M = $0.75
  Tick total: ~$1.50
```

### Weekly cost breakdown (enterprise API billing)

| Cost center | $/day | $/week |
|---|---|---|
| **Interactive Opus high-effort** (2 heavy sessions) | $1,000 | $7,000 |
| **Background loops** (3 agents, ~120 ticks/day) | $180 | $1,260 |
| **Subagent spawns** (reviewers, explorers) | $100 | $700 |
| Skill listing overhead | $15 | $105 |
| CLAUDE.md overhead | $23 | $161 |
| **TOTAL** | **$1,318** | **$9,226** |

**Extended thinking output = 76% of total cost.**

### The levers (ranked by impact)

| Lever | Savings | Effort |
|---|---|---|
| **Use Sonnet for background loops** | ~$900/week (5x cheaper output) | Change one line in tick script |
| **Use Sonnet for mechanical work** (thread resolution, lint, backlog) | ~$500/week | Route by task type |
| **Reserve Opus high-effort for decisions** (architecture, debugging, research) | ~$2,000/week | Discipline |
| **Shorter sessions** (avoid compaction tax) | ~$500/week | Natural with loops |
| Carve skill descriptions (081KR50HA0008QG0R002ZNFQBZ) | $75/week | Mechanical edit |
| Trim CLAUDE.md (081KQJZR90008QG0R002Z4B6VW) | $115/week | Mechanical edit |

### The single biggest optimization

**Switch background loops from Opus to Sonnet.**

```
Background loops (current — Opus):
  120 ticks/day × $1.50/tick = $180/day = $1,260/week

Background loops (Sonnet — 5x cheaper):
  120 ticks/day × $0.30/tick = $36/day = $252/week

Savings: $1,008/week = $52,416/year
```

Sonnet handles mechanical work (PR thread resolution,
backlog pickup, lint fixes, thread drain) as well as
Opus. Opus is only needed for architecture decisions,
novel debugging, and research synthesis.

## Lesson 7: Model routing is the enterprise cost strategy

For enterprise API billing, the question isn't "Opus or
Sonnet" — it's "which model for which task."

| Task class | Right model | Output rate |
|---|---|---|
| Architecture, debugging, research | Opus high-effort | $75/M |
| Code generation, feature work | Opus or Sonnet | $15-75/M |
| Thread resolution, lint, backlog | Sonnet | $15/M |
| Status checks, heartbeats | Haiku | $5/M |
| Bulk formatting, rename passes | Haiku | $5/M |

A factory that routes tasks to models by complexity can
run at **30-40% of the cost** of one that uses Opus for
everything.

## Summary: the cost stack

| Layer | % of bill | Fix |
|---|---|---|
| Extended thinking (output tokens) | 76% | Model routing |
| Visible output (code generation) | 12% | Sonnet for mechanical |
| Input context (conversation + files) | 8% | Shorter sessions |
| Bootstrap overhead (skills + CLAUDE.md) | 4% | Carve + trim |

**Don't optimize the 4% first. Optimize the 76%.**

But do both — the 4% is free to fix and compounds
with headcount.

## Pricing reference (May 2026)

| Model | Input/M | Output/M | Cache hit/M |
|---|---|---|---|
| Opus 4.6 / 4.7 | $15.00 | $75.00 | $1.50 |
| Sonnet 4.6 | $3.00 | $15.00 | $0.30 |
| Haiku 4.5 | $1.00 | $5.00 | $0.10 |

Source: [Anthropic API Pricing](https://platform.claude.com/docs/en/about-claude/pricing)

Note: Opus 4.7's new tokenizer can produce up to 35% more
tokens for the same input text — the rate card is unchanged
but per-request cost can increase.

## For the cost conversation with finance

- Prototype phase (1 dev, Max plan): $200/month. Doesn't matter.
- Enterprise API (current): ~$9K/week on Opus high-effort everywhere.
- Enterprise API (optimized routing): ~$4K/week. Same output.
- The fix isn't "use AI less." It's "use the right model for
  each task class." Background loops on Sonnet alone saves $52K/year.

## Tracked at

- 081KR50HA0008QG0R002ZNFQBZ (carved-sentence skill descriptions — the 4%)
- 081KQJZR90008QG0R002Z4B6VW (CLAUDE.md trim — the 4%)
- `docs/ops/SKILL-ROUTING-BUDGET.md` (budget math detail)
- Background loop model routing (not yet filed — file when ready)
