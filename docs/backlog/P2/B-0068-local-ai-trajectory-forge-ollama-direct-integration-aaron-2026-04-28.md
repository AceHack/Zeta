---
id: B-0068
priority: P2
slug: local-ai-trajectory-forge-ollama-direct-integration
status: backlog
created: 2026-04-28
maintainer: aaron
ownership: otto
title: Local AI trajectory — Forge CLI/harness + Ollama + direct local-model integration (umbrella)
---

# B-0068 — Local AI trajectory umbrella

## Why

Aaron's framing 2026-04-28 (verbatim, /btw aside during PR drain):

> "backlog forge cli/harness. I'm already logged into it some of
> the accounts on there, also it can access ollama and we can use
> local models, we need to install some local models and test
> make sure you search for best latest for the hardware we are
> on. Aslo make sure you take into account the resources on the
> machine. This will be a later tasks, also we should reasearch
> direct integration with local modeal rather than going through
> forge or ollama as another alternative, we need a whole local
> AI trajectory, this is just the start, backlog."

The factory currently runs entirely on hosted-LLM substrate
(Anthropic API for Claude Code, OpenAI/x.ai for ferries
through Codex/Cursor/Grok harnesses). A **local-AI
trajectory** is additive substrate that:

- decouples the factory from any single hosted provider's
  uptime / pricing / policy
- composes with Otto-235 (4-shell portability target) by
  giving the factory a substrate that runs without external
  network reachability
- composes with the resource/cost monitoring work (task
  #287) — local inference cost shape is fundamentally
  different from API-billed
- expands the peer-call roster (task #303 sibling
  scripts: `tools/peer-call/{gemini,codex,grok}.sh`) by
  adding a local sibling `tools/peer-call/local.sh`
  trajectory
- aligns with the autonomous-loop discipline by removing
  the network-dependency class from tick-execution
  failure modes

Aaron explicit: *"this is just the start"* — this row is
an umbrella, not a single deliverable. Sub-rows will spawn
as the trajectory clarifies.

## What

Three parallel exploratory paths, sequenced by leverage:

### Path 1 — Forge CLI/harness (entry point, fastest leverage)

**Status:** backlog; Aaron already logged into accounts on
Forge.

- Add Forge to the agent / CLI roster alongside
  Claude-Code, Codex, Cursor, Grok-CLI, Kiro-CLI (per
  `memory/feedback_kiro_cli_added_to_agent_roster_aaron_2026_04_28.md`)
- Forge accesses Ollama natively → cheapest path to a
  local-substrate sibling without re-authoring the
  peer-call protocol
- Per Otto-247 version-currency: WebSearch the current
  Forge CLI version, supported model surface, and Ollama
  bridge before any commitment in code
- Per `memory/feedback_announce_non_default_harness_dependencies_plugins_mcp_skills_2026_04_28.md`:
  any Forge-routed work names Forge as the harness in the
  PR / commit / tick-history at point of use

### Path 2 — Local-model install + test (hardware-aware)

**Status:** backlog; needs hardware audit before model
selection.

- Inventory current dev machine: CPU / RAM / disk free /
  GPU (if any) / OS-level inference frameworks already
  installed (Metal on macOS / CUDA on Linux / DirectML
  on WSL)
- Aaron explicit: *"search for best latest for the
  hardware we are on. Also make sure you take into
  account the resources on the machine."*
  → Otto-247 version-currency applies HARD: model release
  cadence is weeks; defaulting to "training-data-known"
  models will pick stale releases. WebSearch every
  candidate at install time.
- Install Ollama; pull a small validation model
  (`llama3.2:3b` or comparable current-best small) to
  prove the toolchain end-to-end before pulling larger
  models that would saturate disk/RAM
- Document the install in `tools/setup/`-adjacent space
  per GOVERNANCE §24 (one install script consumed three
  ways) — but as an OPTIONAL substrate, NOT required for
  base factory operation; per Otto-235 portability target
  the install must work on the 4-shell matrix or be
  scoped to subset
- Smoke test: run a small local model against a known
  prompt (e.g., the one used in
  `memory/feedback_lfg_master_acehack_zero_divergence_fork_double_hop_aaron_2026_04_27.md`
  for cross-CLI verification) and compare quality vs. a
  known-good hosted result

### Path 3 — Direct local-model integration (alternative to Forge or Ollama)

**Status:** research-grade; Aaron explicit alternative.

> *"we should reasearch direct integration with local modeal
> rather than going through forge or ollama as another
> alternative"*

Direct integration paths to research (via WebSearch +
peer-call ferries; per Otto-247 these names date FAST):

- **`llama.cpp` direct** — F# bindings (LlamaSharp,
  ONNX Runtime + GGUF) executed in-process; no broker;
  bypasses HTTP serialization
- **MLX (Apple Silicon native)** — Apple's ML framework
  optimized for M-series chips; potential best
  inference latency on Aaron's macOS development
  hardware
- **vLLM / SGLang server** — structured-output server
  layers that beat Ollama on throughput for batch /
  multi-tenant workloads
- **Direct GGUF model loading via .NET ML libraries**
  — TorchSharp / ONNX Runtime on .NET 10 keeps the
  inference within the factory's primary runtime
- Compare on: latency, throughput, GPU/CPU utilization,
  RAM ceiling, cold-start, cross-platform shape (4-shell
  target), and substrate-cleanliness (how much
  factory-specific glue code each path requires)

## Non-goals

- **NOT** a hosted-substrate replacement. Hosted ferries
  (Anthropic, OpenAI, x.ai) keep the high-quality
  reasoning surface; local substrate is additive for
  bandwidth / privacy / offline / fast-feedback loops.
- **NOT** an Ollama-only path. Ollama is path 1 + 2;
  path 3 explicitly explores no-broker alternatives.
- **NOT** a model-quality benchmark project. The trajectory
  is about *substrate availability*; model quality is
  measured incidentally during smoke-tests, not as the
  primary deliverable.
- **NOT** committing to a specific stack until path 1-3
  exploration completes.

## Composition with prior substrate

- Otto-247 version-currency — every model name + version
  is a load-bearing claim → WebSearch first
- Otto-235 4-shell portability target — local AI install
  must respect the macOS-bash-3.2 / Ubuntu / git-bash /
  WSL matrix or scope to subset with explicit rationale
- task #287 resource/cost monitoring — local inference
  cost shape needs to enter the cost-monitoring substrate
  if the trajectory matures
- task #303 peer-call sibling scripts — `local.sh`
  becomes the canonical sibling once local substrate is
  selected
- `feedback_announce_non_default_harness_dependencies_plugins_mcp_skills_2026_04_28.md`
  — Forge / Ollama / local model name is named at point
  of use

## How to apply

This row is the umbrella. Concrete sub-rows spawn as paths
clarify:

1. WebSearch latest Forge CLI release + capability matrix
   → file B-NNNN for Forge integration (path 1)
2. Hardware audit + model-candidate research → file
   B-NNNN for local install + smoke-test (path 2)
3. Direct-integration research → file B-NNNN per concrete
   integration candidate (`llama.cpp`, MLX, vLLM, etc.)
   (path 3)

Per Otto-275 (log-but-don't-implement-yet) + Aaron's
*"this will be a later tasks"* framing: do NOT start
implementation work this tick. The umbrella is the
deliverable for now.

## Cadence

When other 0/0/0 work clears OR when a hosted-substrate
incident surfaces local-substrate as a need (whichever
fires first). No deadline.

## Provenance

- Aaron 2026-04-28 verbatim aside during PR drain (full
  quote in "Why" section above)
- Companion entry: kiro-cli roster row
  (`memory/feedback_kiro_cli_added_to_agent_roster_aaron_2026_04_28.md`)
- /btw classification: directive-queued, cross-session,
  durable-backlog landing per the /btw skill's
  durability-escalation rule
