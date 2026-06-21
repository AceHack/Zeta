# Multi-AI review — 081KT07NV0008QG0R001CBQ2X2 docker-vs-podman OCI-runtime default (Gemini + Grok, 2026-06-01)

Scope: verbatim external-AI review import (Gemini propose + Grok-build critique) of the
081KT07NV0008QG0R001CBQ2X2 §2 container-runtime decision (default podman vs docker; runtime-swappable via
`ZETA_CONTAINER_RUNTIME`; compose-at-infra; GPU-via-CDI), via `tools/peer-call/`.
Preserved per substrate-or-it-didn't-happen (`/tmp/peer-call-output/` is ephemeral).
Archived register, not operational policy. (A first run of this huddle in a prior
session was lost to context compaction; this is the re-run that captures the verbatim.)

Attribution: Gemini (Google) + Grok-build (xAI) at their attribution scopes;
synthesis/folding by otto-cli. NO re-authoring; preservation only.

Operational status: research-grade

Non-fusion disclaimer: each reviewer's text + operator framing + otto-cli synthesis
are distinct authorial substrates, no identity-fusion (asymmetric-authorship +
honor-those-that-came-before + NCI HC-8).

## The question put to both peers (verbatim prompt)

> Zeta is building a local AI-agent loop (observe.ts). One action ("do_item") needs a
> REAL container surface to run CLI work (git/npm/compilers) when an in-memory sandbox
> isn't enough. We will support the SAME executor concept later in TypeScript, Rust,
> C#, and F#, so the container is the language-agnostic boundary.
>
> Decision to validate: (1) Default to PODMAN (Apache-2.0, rootless, daemonless, $0)
> but make the runtime SWAPPABLE via `ZETA_CONTAINER_RUNTIME` (podman|docker|nerdctl|
> finch). (2) Keep COMPOSE at the INFRASTRUCTURE layer (Compose Spec) and OUT of the
> per-item executor (single-container `run`). (3) GPU via NVIDIA Container Toolkit +
> CDI (`--device nvidia.com/gpu=all`, runtime-neutral) rather than docker's `--gpus`.
> Name the strongest objection to each.

## Outcome (what it changed in 081KT07NV0008QG0R001CBQ2X2 §2)

The convergent verdict held on **(2)** and **(3)**; **(1) surfaced a real
disagreement** that the swappability mechanism — _plus auto-detect_ — resolves:

- **(1) Default runtime — DISAGREEMENT, folded not collapsed.** Gemini: _reject_
  podman-as-default, default **docker** on Mac/Win (Podman Machine VM volume-mount +
  networking brittleness; a silent volume error makes an autonomous agent hallucinate
  fixes), podman opt-in on Linux. Grok: podman-default is **good** for an agent factory
  (rootless/daemonless = smaller attack surface when an AI spawns containers; Apache-2.0
  removes license friction) — but the strongest objection is docker is the **de-facto**
  standard in devcontainers / GitHub Actions / corporate fleets, so podman-first causes
  first-contact "works on my machine" friction. **Fold:** podman is the _declared,
  preferred_ default (free + rootless for the autonomous/Linux-cluster case), and the
  resolution order is **(a) `ZETA_CONTAINER_RUNTIME` if set → (b) auto-detect the first
  present of `[podman, docker]` → (c) fail-fast** — so a corp laptop with only Docker
  Desktop transparently gets docker (Grok's friction objection), the Linux cluster gets
  podman (Gemini agrees podman-on-Linux), and a maintainer with both can force either.
- **(2) Compose at infra, executor does single-container `run` — AGREE (both).** Shared
  caveat: real `do_item` cases want short-lived multi-container envs (Postgres sidecar
  for an integration test). Gemini: don't reach for Compose then — use **`podman play
kube`** / pods. Grok: the clean single-container separation is "elegant on paper; real
  workloads want the middle option." Fold: executor stays single-container `run`;
  multi-service is a _separate, higher-layer_ "environment" concept (pod / `play kube` /
  Compose Spec at infra), never smuggled into the per-item executor.
- **(3) GPU via CDI — AGREE (both), with the laptop caveat.** Both: CDI is the correct
  runtime-neutral path; tying to docker's `--gpus` would be wrong lock-in. Both flag:
  **CDI is a Linux container-runtime feature** — on Mac/Win laptops GPU is
  Docker-Desktop-passthrough / WSL2, so the "one container surface, all languages" claim
  holds cleanly _on Linux hosts_. Fold: GPU items are **Linux-host (cluster) scope**;
  CDI runtime-neutral there; laptops document "GPU = Linux-host-only" + fail-fast rather
  than a bifurcating fallback.

---

## Gemini (verbatim)

> Otto, here is the proposal validation and the adjacent possibility space.
>
> **1. Podman Default (Swappable OCI)**
> _Verdict:_ Support swappability, but reject Podman as the _default_.
> _Strongest Objection:_ Podman on macOS/Windows requires a VM (Podman Machine) with
> notoriously brittle volume-mount permissions and networking edges. If an autonomous
> agent hits a silent volume permission error, the loop will confidently hallucinate
> fixes until it spirals.
> _Proposal:_ Mandate strict OCI CLI compatibility, but default
> `ZETA_CONTAINER_RUNTIME=docker` for path-of-least-resistance host integration. Let
> Linux host environments opt into Podman.
>
> **2. Compose at Infra (Single-container Executor)**
> _Verdict:_ Strongly agree. Keep the executor fast, stateless, and predictable.
> _Strongest Objection:_ The agent loses autonomy to spin up complex, ephemeral Systems
> Under Test (e.g., executing a test that requires a fresh Postgres sidecar).
> Pre-provisioning these at the infra layer limits dynamic agent exploration.
> _Proposal:_ If multi-container becomes necessary, bypass Compose. Use Podman Pods or
> lightweight K8s-style pod YAMLs (`podman play kube`), treating the "sandbox" as a Pod
> rather than a Compose stack.
>
> **3. GPU via CDI (`--device nvidia.com/gpu=all`)**
> _Verdict:_ Agree. CDI is the correct runtime-agnostic standard.
> _Strongest Objection:_ Host environment fragility. CDI requires a modern NVIDIA
> Container Toolkit setup. Older ML rigs will flatline where Docker's legacy `--gpus`
> would survive.
> _Proposal:_ Accept the strict dependency. Fail fast on boot if CDI isn't configured
> rather than attempting messy fallbacks that bifurcate our abstraction.

## Grok-build (verbatim)

> **1. Podman default + swappable via ZETA_CONTAINER_RUNTIME: Good call for an agent
> factory.**
> Rootless + daemonless reduces the attack surface when an AI is spawning containers to
> run arbitrary git/npm/build workloads. Apache 2.0 removes license friction.
> Swappability is the right hedge.
> **Strongest objection:** Docker socket is still the de-facto standard in devcontainers,
> GitHub Actions runners, corporate laptop fleets, and most published images. A
> Podman-first default will cause immediate "works on my machine" pain and extra docs for
> anyone not already on Podman. The swappability helps after the fact but doesn't solve
> first-contact friction.
> **2. Compose strictly at infrastructure layer, executor does single-container `run`:
> Agree.**
> The per-item executor should stay a thin, language-agnostic `run` primitive.
> Orchestration belongs one layer up (workspace definitions, action types that declare
> "this item needs a compose project").
> **Strongest objection:** Some realistic "do*item" cases (integration tests, full-stack
> previews, multi-service verification) genuinely want short-lived multi-container
> environments. If the executor can \_only* do single containers, you will either (a) push
> people to hand-roll docker/podman run sequences inside the item, or (b) need a second,
> higher-level "environment" concept that duplicates a lot of compose semantics. The
> clean separation is elegant on paper; real workloads often want the middle option.
> **3. NVIDIA CDI (`--device nvidia.com/gpu=all`) for runtime neutrality: Agree in
> principle.**
> It is the correct long-term path. Tying the agent loop to Docker's `--gpus` flag would
> have been the wrong lock-in.
> **Strongest objection:** On the actual developer laptops where most of this work will be
> prototyped (macOS + Windows), the story is still Docker Desktop's own GPU passthrough or
> WSL2 hacks. CDI is a Linux container-runtime feature. You will need fallback paths or
> explicit "Linux host only" documentation for GPU items, which undercuts the "one
> container surface, all languages" claim for the common case. The runtime-agnostic win
> only materializes cleanly on Linux hosts today.
> Overall: the direction is sound for a security-conscious, cross-language agent runtime.
> The practical objections are mostly about the gap between "OCI standard in theory" and
> "what actually works on the laptops and CI fleets people use today."

## Composes with

- `docs/backlog/P1/081KT07NV0008QG0R001CBQ2X2-effectful-do-item-command-vs-fact-event-envelope-injected-executor-just-bash-sandbox-surface-2026-06-01.md` (§2 — the decision this review folds into)
- `docs/research/2026-06-01-multi-ai-review-b0964-bash-surface-tool-choice-gemini-amara.md` (the prior huddle — fake/just-bash/container/CF tiers; this one resolves _which container runtime_)
- `tools/setup/manifests/{brew,apt,windows}` (podman declared as the default OCI runtime, symmetric)
- `.claude/rules/dep-pin-search-first-authority.md` + `.claude/rules/refresh-world-model-poll-pr-gate.md` (the verify-then-fold discipline this huddle embodies)
