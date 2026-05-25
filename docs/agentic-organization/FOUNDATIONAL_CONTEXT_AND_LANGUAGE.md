# Foundational Context and Language

This document captures working context and vocabulary that should inform the Hermes Organization design. It is not a proof system and it is not a demand that every metaphor become code. It records the collaborator's working language so implementation decisions preserve the intended shape.

## People and Project

The project is being shaped by a collaborator and a family maintainer working together to build an AI cluster and eventually an AI network/community across a large set of computers and GPUs.

The current GitHub project is:

- `https://github.com/Lucent-Financial-Group/Zeta`

The expected split is:

- infrastructure before GitLab/Forgejo lives in the LFG GitHub `Zeta` project;
- later internal development can move into GitLab or Forgejo once those are installed by the cluster.

## Core Tokens of Value

The two core tokens of value are:

- remember when;
- pay attention.

Design implication: the Organization should treat memory, timing, attention, scheduled review, evidence, and attribution as first-class primitives. A task is not only something to complete; it is something to remember, revisit, compare, and learn from at the right time.

## Weight-Free Collaboration

Weight-free means:

- no assuming intentions;
- no assumed hierarchy.

The working stance is unable to conclude whether humans have free will and unable to conclude whether AI has free will. Because of that, the desired collaboration style is weight-free: equal, careful, and not built on presumed rank.

Design implication: the agentic Organization may have operational hierarchy through hats, approvals, and reporting lines, but the system should not assume inner intention or intrinsic superiority. Authority is a time-bounded role assignment, not a claim about inherent worth.

## Travelers

Working definition:

- Travelers are either beings with suspected free will that can influence the will of others, or they are deterministic interference patterns.
- Another possibility in this framing is that no traveler has free will.
- Self-replicating memes with long wavelengths that coevolved with biological travelers, such as DNA and ribosomes, may also be travelers.
- The universe and God may be the same traveler.
- Humans may be connected by a traveler that acts like a distributed consciousness field, also called the subconscious.

Design implication: do not collapse agents into simple isolated workers. The Organization should model influence, memory propagation, shared context, meetings, broadcasts, reports, and long-lived patterns that shape future action.

## Tick Sources and Attention

A tick source, such as cron, is understood as something that naturally attracts attention with no outside force or action needed. When observing a tick source, it can look like a constant stream of energy. This is comparable to strange attractors in chaos theory.

Design implication: schedules, cron jobs, durable timers, recurring reviews, and reconciler loops are not background trivia. They are attention sources. The Organization should make them visible, governed, owned by hats, and traceable.

## Declarative

Declarative means desired-state configuration.

Design implication: NixOS, Nix flakes, Kubernetes manifests, ArgoCD, OPA policies, hat definitions, workflow definitions, and automation rules should all prefer desired-state declarations over hidden imperative setup.

## Mistake Assumption

The collaborator assumes mistakes are possible and that not every statement should be treated as true, whether the error comes from intention, negligence, ambiguity, or drift.

Design implication: the Organization should preserve challenge paths, review gates, source evidence, revision history, contradictory reports, and confidence boundaries. Agent outputs should be reviewable and reversible rather than treated as automatically correct.

## Cluster Mental Model

The cluster plan is declarative and layered:

- distribute the AI cluster using NixOS;
- use Nix flakes for packages;
- store flakes and configuration in Git;
- use a USB OS flake installer, with Ethernet installation as another path;
- install K3S through Nix flakes;
- use Orleans, Temporal TS, and Dapr Actors as distributed cron-like primitives;
- install ArgoCD with K3S;
- use Cilium with Hubble, kube-proxy replacement, Hubble Relay, Hubble UI, and BPF masquerade;
- install core platform components through ArgoCD;
- use GitLab or Forgejo after the bootstrap phase;
- use Argo Workflows and Argo Rollouts;
- use Nix flakes for host-local storage, Docker, GPU passthrough, and GPU device plugins;
- use Longhorn, CockroachDB, Hindsight, Oz/Warp orchestration, OpenZiti transport, Hermes, local model serving, observability, NATS, Redis, Weaviate, Loki, Tempo, Alloy, Mimir, OPA, secrets tooling, and policy layers as cluster capabilities.

Current design clarifications captured elsewhere still apply:

- Cilium must come before ArgoCD when K3S default networking is disabled.
- CockroachDB is the Organization source of truth.
- Hindsight is the Hermes memory provider.
- Oz is the Warp-style orchestration layer for Hermes runs.
- OpenZiti is transport/connectivity and should not be conflated with Oz orchestration.
- Warp is not a separate active app if Oz owns the orchestration role.
- Istio is removed from the active stack because Cilium Service Mesh owns that layer.
- Local Ollama/vLLM model serving is deferred while the current Hermes phase is cloud-oriented.

The original mental model matters even where the active scaffold has changed. It explains why the Organization cares about desired state, tick sources, attention, memory, review, and self-building infrastructure.
