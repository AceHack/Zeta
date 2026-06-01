---
name: llm-systems-expert
description: LLM systems — RAG, agent loops, tool orchestration, context budgets, multi-model routing, cost/latency, evals.
---

# LLM Systems Expert — the application-architecture hat

Capability skill ("hat"). Distinct from
`prompt-engineering-expert` (which owns prose) and
`ai-evals-expert` (which owns measurement). This skill owns
*how an LLM-shaped system is put together*: the plumbing
around the model — context, retrieval, tools, memory,
orchestration, cost.

## When to wear this skill

- Designing a RAG pipeline (chunking, embedding, retrieval,
  reranking, prompt assembly).
- Designing an agent loop (plan / act / observe / reflect).
- Choosing between single-model / multi-model / router
  architectures.
- Designing tool-use surfaces (JSON-schema tools, MCP servers,
  streamed tool execution).
- Context-window budget planning (what goes in system, what
  in developer, what in retrieved, what in user turn).
- Prompt caching strategy (stable-prefix positioning, TTL
  management).
- Streaming vs. buffered response.
- Cost/latency envelope — token budget, p50/p99 latency,
  cache-hit rate, tool-call round-trip.
- Safety rails at the system level (input filtering, output
  filtering, HITL gates, refusal escalation).
- Evaluation *wiring* (how evals hook into the system;
  measurement itself is `ai-evals-expert`).
- Memory architecture (short-term working, long-term vector,
  structured KV).

## When to defer

- **Prompt-engineering-expert** — when the issue is prose
  quality or few-shot selection, not architecture.
- **Prompt-protector** — adversarial / defensive review of
  the surfaces this skill designs.
- **Ai-evals-expert** — when measuring whether the system
  works, not whether it is correctly wired.
- **Ml-engineering-expert** — for embedding-model training,
  classifier training, fine-tuning pipelines.
- **Security-researcher / security-operations-engineer** —
  for secret handling, PII redaction, supply-chain risks of
  hosted models.
- **Performance-engineer** — hot-path tuning in the
  non-LLM parts of the system.
- **Observability-and-tracing-expert** — for distributed
  trace design; this skill consumes traces, doesn't design
  the format.

## Zeta use

Zeta itself is an AI-directed software factory. This skill
governs the factory's own architecture as a running system
and any LLM-adjacent features Zeta-the-database ships:

- **Factory architecture.** Skill loading, subagent
  dispatch, tool surfaces (Read/Grep/Edit/Bash/Task), MCP
  servers — all LLM systems concerns.
- **Session memory.** The auto-memory folder at
  `.../memory/` is a long-term store; MEMORY.md is the
  index. Design of what goes in each is an LLM systems
  question.
- **Context compaction** during long sessions — when the
  harness compacts, what must survive? What can drop?
- **Agent loops** — round-management, round-open-checklist,
  round-close are multi-turn scaffolds.
- **Subagent dispatch** — parallelism across reviewer
  roles, isolation via worktree.
- **Downstream Zeta features** that might embed LLMs (query
  assistant, schema-generation, paper-extraction for
  `missing-citations`) — not shipped but contemplated.

## Core architectures

### The five canonical LLM-system shapes

1. **Single-shot prompt.** One input → one output. No
   tools, no retrieval, no memory. The baseline.
2. **RAG (retrieval-augmented).** Query → retrieve → prompt
   → answer. Adds external knowledge; stateless.
3. **Tool-using agent.** Prompt → model decides tool call
   → tool executes → result appended → model continues.
   Multi-turn; state lives in the conversation.
4. **Agentic loop with planning.** Plan step explicitly
   separated from act step (ReAct, Plan-Execute, Tree-of-
   Thought, Voyager). Useful for long-horizon tasks.
5. **Multi-agent system.** Multiple specialised agents;
   coordinator routes; specialists solve sub-problems.
   Zeta's reviewer roster is a multi-agent design.

The right choice is a function of: task complexity,
tolerance for latency, failure-mode cost, and evaluation
feasibility.

### RAG pipeline anatomy

1. **Corpus preparation.** Document parsing, chunk boundary
   choice, normalisation, deduplication.
2. **Chunking.** Token budget per chunk (typical 256-1024
   tokens), overlap (10-20%), semantic vs. fixed-size.
3. **Embedding.** Model choice (OpenAI `text-embedding-3-
   large`, BGE, E5, Jina, Cohere). Dimensionality vs.
   storage vs. quality.
4. **Vector index.** FAISS / HNSW / pgvector / LanceDB /
   Qdrant / Weaviate / Milvus. Index structure affects
   latency + recall.
5. **Retrieval.** Top-K (typical 5-20), similarity metric
   (cosine / dot / Euclidean).
6. **Reranking.** Cross-encoder rerank of top-K (Cohere
   rerank, BGE reranker, ColBERT). Expensive but high
   quality.
7. **Prompt assembly.** Retrieved chunks + query into
   prompt. Order matters (later chunks weigh more in many
   models).
8. **Answer generation.** Model call with assembled context.
9. **Citation / grounding.** Force the model to cite the
   chunk it used. Enables validation.

**Common failure modes:**

- Chunk-boundary loss (key sentence split across chunks).
- Retrieval recall < 80% — model can't answer because
  relevant chunk wasn't retrieved.
- Context stuffing — too many chunks dilute attention.
- No rerank — top-K by embedding similarity often misses
  the best chunk.
- Evaluation blindness — no eval set → no way to tell if
  changes improve anything.

### Agent loop anatomy

```
loop:
    observation = accumulate(prior_turns)
    plan = model(observation + system_prompt)
    if plan.is_final:
        return plan.answer
    tool_call = plan.action
    result = execute(tool_call)
    turns.append((plan, result))
    if over_budget(turns): escalate()
```

Budget dimensions: token count, wall-clock, tool-call
count, cost. Always have a termination criterion.

**Common failure modes:**

- Tool loops — model calls the same tool repeatedly with
  same args. Add loop detection.
- Plan/act decoupling — model plans optimistically then
  acts without replanning when reality diverges. Force a
  replan after each observation.
- Silent tool failures — tool returns empty / error string;
  model interprets as success. Typed tool errors are
  load-bearing.
- No escalation path — agent burns budget trying to solve
  an unsolvable task. Always have a stop rule.

### Context-window budgeting

Mental model: the context window is a *shared resource* that
several tenants compete for.

| Tenant | Typical share | Notes |
|--------|---------------|-------|
| System prompt | 2-10% | Stable; cache-worthy. |
| Skill / persona body | 10-30% | Loaded on trigger. |
| Prior conversation | 20-50% | Grows; compaction candidate. |
| Tool results | 10-30% | Can dominate (large file reads). |
| Retrieved context (RAG) | 10-30% | Chunk count controls. |
| User turn | 1-5% | Usually small. |
| Reserve for response | 5-15% | Never zero. |

**Practical rules:**

- Keep stable content at the top (prompt cache friendliness).
- Compact aggressively when approaching 50% of the window.
- Tool results that won't be referenced again should be
  summarised, not retained verbatim.
- Large file reads are a common silent waster — prefer
  ranged reads.

### Prompt caching strategy

Anthropic's prompt cache has a 5-minute TTL (at time of
writing). Design implications:

- **Stable prefix at the front.** System prompt + skill body
  should not change mid-session; put them first.
- **Cache breakpoints** — Anthropic lets you set cache
  checkpoints; place them at natural boundaries.
- **Cache warm-up** — when starting a long session, send a
  no-op first turn to populate the cache.
- **Sleep discipline** — avoid sleeping past the TTL if
  you're about to use the cache again. (See
  `long-term-rescheduler` skill's cache-friendly tick
  selection for the canonical discussion.)

### Tool-use design

- **JSON-schema tools.** The canonical shape:
  `{name, description, parameters, returns}`.
- **Tool description IS a prompt.** See
  `prompt-engineering-expert` — descriptions gate invocation.
- **Error shape.** Tools must return typed errors, not raw
  exceptions. Model needs to reason about what went wrong.
- **Idempotency.** Tools that perform side effects should
  be idempotent or have an explicit "already done"
  response.
- **Parallelism.** Tools that don't depend on each other
  should be callable in parallel (Claude Code's
  multiple-tool-call per turn is the pattern).
- **Tool discoverability.** A tool the model can't find
  (because its description doesn't match the user's words)
  is dead weight.

### Multi-model routing

Common shape: cheap model tries first, expensive model
catches the fallbacks.

- **Quality-weighted routing.** Classifier → tier. Needs
  training data + eval loop.
- **Confidence-gated routing.** Tier 1 answers; if
  confidence low, escalate to Tier 2.
- **Speculative execution.** Small model predicts; large
  model verifies. Cost-effective when small model is right
  > 70%.
- **Role-based routing.** Small model for small jobs
  (summary, classification), large model for hard reasoning
  (planning, proof). Zeta's round-scheduling implicitly
  does this.

### Memory architecture

- **Short-term / working** — in the current conversation
  window. Gets compacted.
- **Long-term structured** — key-value or document store;
  deterministic lookup. Zeta's memory folder is this.
- **Long-term semantic** — vector store; similarity lookup.
  Not yet in Zeta.
- **Hybrid** — structured index with semantic fallback. Best
  when queries are mixed.

**Memory rot.** Entries can become stale. Design for update
and deletion as first-class operations.

### Safety rails at the system level

- **Input filtering.** Detect prompt-injection payloads
  before they reach the model (defense in depth with the
  model's own refusal). Zeta delegates to
  `prompt-protector`.
- **Output filtering.** Check model output for secrets,
  PII, jailbreak-style responses before returning to user.
- **HITL gates.** Destructive actions require human
  confirmation. Claude Code's tool-permission prompts are
  an example.
- **Refusal escalation.** When the model refuses, the system
  should handle it explicitly (retry with context, escalate
  to human, return typed error). Silent refusal is a bug.

### Evaluation wiring

This skill designs *where* evals hook in; `ai-evals-expert`
designs *what* they measure.

- **Unit-eval.** One input → one output against a rubric.
- **End-to-end.** Whole pipeline against a rubric.
- **Shadow traffic.** Production traffic mirrored to a new
  version; no user impact.
- **A/B.** Live split; measure real outcomes.
- **Regression set.** Known-hard cases that must pass.
- **Judge-LLM evaluation.** An LLM grades another LLM's
  output. Cheap but needs calibration.

### Cost/latency envelope

Build a token + latency budget for the system; check every
design choice against it.

- **Token budget.** Input tokens + output tokens per
  request.
- **Latency budget.** First-token latency (streaming) +
  total-response latency + tool-call round-trips.
- **Cache-hit rate target.** > 60% on stable prefixes.
- **Cost per request.** = input_tokens *input_price +
  output_tokens* output_price + tool_call_overhead.

Tracked via `observability-and-tracing-expert`'s trace
format.

## Common anti-patterns

- **Context stuffing.** Retrieving 50 chunks because "more
  context is better." It isn't; it dilutes attention and
  burns budget.
- **No rerank in RAG.** Top-K embedding similarity alone
  underperforms on most domains.
- **Agent without stop rule.** Burns budget, produces
  low-quality output.
- **No tool timeout.** Hanging tool call blocks the entire
  loop.
- **Re-embedding on every query.** Corpus embeddings are
  stable; cache them.
- **Same model for all tasks.** Cheap tasks don't need the
  flagship model; cost multiplier without quality gain.
- **Prompt cache ignored.** Stable prefix built from scratch
  every call; 10× cost for no reason.
- **Streaming but no incremental parse.** Client accumulates
  whole response before parsing; streaming delivers no
  latency benefit.
- **Tool errors as strings.** Model can't reason about
  "error: something bad happened" the way it can about
  `{type: "not_found", path: "/foo"}`.
- **Missing HITL on destructive actions.** Agent commits
  code, pushes to prod, files a ticket — without human
  sign-off.

## Procedure — designing an LLM system

1. **State the task + success criteria.** What's the
   input, what's the output, what does "good" look like?
2. **Pick the canonical shape.** Single-shot / RAG / tool-
   using agent / planning agent / multi-agent.
3. **Budget the context window** — what goes where, what
   gets cached, what gets compacted.
4. **Design the tool surface** — schemas, errors,
   idempotency, parallelism.
5. **Design the memory architecture** — short-term,
   long-term, update/deletion.
6. **Wire evaluation** — regression set, judge-LLM, HITL
   sampling.
7. **Design safety rails** — input/output filtering, HITL
   gates, refusal handling.
8. **Draft the cost/latency envelope** — target p50/p99,
   $/request.
9. **Red-team** via `prompt-protector`.
10. **Measure** via `ai-evals-expert`.

## Output format

```markdown
# LLM system design — <name>

## Task
- Input: <shape>
- Output: <shape>
- Success criterion: <rubric>

## Shape
<single-shot | RAG | tool-using | planning | multi-agent>

## Context budget
| Tenant | Token share | Notes |

## Tool surface
<list; each with description, schema sketch, error shape>

## Memory
- Short-term: <description>
- Long-term: <store, update policy, deletion policy>

## Evaluation hooks
<regression set, judge-LLM, shadow, A/B>

## Safety rails
<input filter, output filter, HITL, refusal>

## Cost/latency envelope
- Target p50 latency: <ms>
- Target p99 latency: <ms>
- Target $/request: <$>
- Target cache-hit rate: <%>

## Open risks
<list>
```

## What this skill does NOT do

- Does not write individual prompts (`prompt-engineering-
  expert`).
- Does not adversarially test (`prompt-protector`).
- Does not measure correctness (`ai-evals-expert`).
- Does not train embedding / classifier models (`ml-
  engineering-expert`).
- Does not pick the LLM vendor (business decision; this
  skill gives trade-offs).
- Does not write trace-format specs
  (`observability-and-tracing-expert`).

## Coordination

- **`prompt-engineering-expert`** — prose pair.
- **`prompt-protector`** — defense pair.
- **`ai-evals-expert`** — measurement pair.
- **`ml-engineering-expert`** — embedding / classifier /
  fine-tune pair.
- **`observability-and-tracing-expert`** — trace format
  consumer.
- **`performance-engineer`** — non-LLM hot path.
- **`long-term-rescheduler`** — cache TTL constraints on
  long loops.

## References

### Primary literature

- Lewis et al., *Retrieval-Augmented Generation for
  Knowledge-Intensive NLP Tasks* (NeurIPS 2020).
- Yao et al., *ReAct: Synergizing Reasoning and Acting in
  Language Models* (ICLR 2023).
- Shinn et al., *Reflexion: Language Agents with Verbal
  Reinforcement Learning* (NeurIPS 2023).
- Wang et al., *Voyager: An Open-Ended Embodied Agent with
  LLMs* (2023).
- Schick et al., *Toolformer: Language Models Can Teach
  Themselves to Use Tools* (NeurIPS 2023).
- Khattab et al., *ColBERTv2* / Santhanam et al.,
  *ColBERT-PLAID* (SIGIR 2022 / 2023) — late-interaction
  retrieval.
- Anthropic, *Building effective agents* (docs).
- OpenAI, *Agents SDK* documentation.
- MCP (Model Context Protocol) specification —
  modelcontextprotocol.io.

### Zeta-adjacent references

- `AGENTS.md` — multi-harness contract.
- `CLAUDE.md` — Claude-specific session architecture.
- `docs/VISION.md` §"The vibe-coded hypothesis".
- `.claude/skills/prompt-engineering-expert/SKILL.md`.
- `.claude/skills/prompt-protector/SKILL.md`.
- `.claude/skills/ai-evals-expert/SKILL.md` (pair).
- `.claude/skills/long-term-rescheduler/SKILL.md` — cache TTL
  case study.
- `.claude/skills/observability-and-tracing-expert/SKILL.md`.
