---
id: B-0790
priority: P1
status: open
title: Zero-dev-machines cluster-native architecture — all PRs from cluster; voice (Alexa + future microphones) as primary operator interface; dev machines and Alexa surfaces are conversational entry points into the cluster, not work substrate
effort: XL
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - B-0754
  - B-0780
  - B-0789
composes_with:
  - B-0759
  - B-0770
  - B-0776
  - B-0778
  - B-0780
  - B-0781
  - B-0782
  - B-0783
  - B-0784
  - B-0785
  - B-0786
  - B-0787
  - B-0788
tags: [architecture, cluster-native, voice-operator, alexa, homelab-persona, maintainer-persona, end-state, zero-dev-machine, ai-agents-on-cluster, cluster-software-factory]
---

## Problem

Today's substrate architecture has dev machines (Aaron's Mac, Max's Mac, Addison's Mac) as the primary substrate-engineering surface — Otto-CLI runs on Aaron's Mac, authors PRs from Aaron's Mac, drives `zflash` from Aaron's Mac. The cluster is a deployment target, not a primary work substrate.

The maintainer 2026-05-26 named the architectural target the substrate is BUILDING TOWARD:

> *"i want all the prs to come from the cluster mostly and dev machines are just conversational interfaces into the cluster and so is alexa"*

> *"0 dev machines everything still works and i can talk to alexa for home automation / homelab persona users we want 0 dev machine needed just cluster and microphone"*

End-state target:

- **Cluster IS the primary substrate-engineering surface** — AI agents on cluster nodes do PR authorship, code review, ticket triage, autonomous-loop substrate work, observability + incident response
- **Dev machines = conversational interfaces** — Aaron / Max / Addison Macs are consoles for talking TO the cluster, not work substrate themselves
- **Voice (Alexa + future microphones) = primary operator interface** for the homelab persona — operator says "deploy the new chart" or "fix the failing test" and cluster + AI agents do it
- **0 dev machines required** for the homelab persona — just cluster + microphone

## Target

Architecture where:

| Surface | Role today | Role end-state |
|---|---|---|
| **Cluster nodes** | Deployment target; receives PRs from dev machines | Primary substrate-engineering surface; AUTHORS most PRs; runs autonomous-loop substrate |
| **Aaron's Mac / Max's Mac / Addison's Mac** | Primary substrate-engineering surface (Otto-CLI, IDE work, PRs) | Conversational interface into cluster (read substrate, send intent, observe; not author of work) |
| **Alexa-speaker** (Amazon device) | External AI participant (per agent-roster-reference-card) | Primary voice-operator interface for homelab persona |
| **Future microphones connected directly to cluster** | N/A | Voice-only operator surface (no dev machine needed) |
| **Web UI / browser** | Read-only observability today | Read + send-intent + observe operator surface |

The operator's mental model becomes: "talk to the cluster" instead of "code on my Mac to deploy to the cluster."

## Two personas (zero-dev-machine is ONE of two end-states; both ship)

The maintainer 2026-05-26 clarified that B-0790 covers TWO end-state personas — NOT one. The zero-dev-machine target is the homelab-persona; maintainer-persona keeps dev machines but inverts their role from primary-work-substrate to conversational-interface-into-cluster-software-factory:

| Persona | Dev machine role end-state | Primary operator surface | Substrate factory |
|---|---|---|---|
| **Homelab / home-automation** | NONE (no dev machine in the room) | Voice (Alexa + future microphones connected directly to cluster) + web UI | Runs entirely in cluster; AI agents on cluster do all substrate work |
| **Maintainer** (Aaron / Max / Addison) | KEPT for testing + local work; role inverted from "primary work substrate" to "conversational interface INTO cluster software factory" | Claude Code on dev machine + voice (Alexa / future microphones) — voice is ONE interface among many for this persona too | **In-cluster software factory** (per Mika substrate batch — see Composes section): crystal-ball, RunMe, git-native markdown, auto-JIT, deferred-run, Continue-with, Obsidian on top, knowledge graph, event store, Prometheus / observability queries in runbooks |

The maintainer's verbatim framing 2026-05-26:

> *"this is for home automation home lab personas not maintainers we still will have people like me addion and max that want to type and use conversational interfaces and such but our dev machines are for testing and local work and a lot of that runs in cluster in the software plant and claude code has interfaces into it same crystal ball / gitnative markdown with runme plus auto jit plus deferred run / continue with, this is the interface into in cluster software factory with obsedian on top and knowledge graph event store prometious / observalbity queires in runbooks and this can be done with just voice too."*

Key disciplines that follow:

- **Voice is one interface among many** — for BOTH personas. The homelab persona uses voice because they have no other operator surface; the maintainer persona uses voice when convenient. "Can be done with just voice too" applies to both.
- **Cluster software factory is the substrate maintainer-persona ALSO consumes** — the maintainer's "dev machine" becomes a CONSOLE into the cluster software factory, not an independent workstation that happens to deploy to a cluster. The factory itself lives on the cluster; dev machines have interfaces (Claude Code; the Mika substrate batch primitives).
- **Both personas converge on cluster-as-primary-substrate-engineering-surface** — the difference is operator-side interface (zero dev machine vs Claude Code on dev machine), NOT substrate-side architecture. The substrate-side architecture (cluster authors PRs, runs autonomous loop, agents on cluster do work) is shared.

This clarification means iter-progressions toward B-0790 ship value for BOTH personas simultaneously — the homelab persona gets voice-primary; the maintainer persona gets Claude-Code-as-cluster-interface. The substrate work doesn't fork.

## Sub-targets (composing iters)

### Sub-target 1 — cluster nodes can commit + push to GitHub (iter-5 of B-0789)

Per B-0789's iter-5 sub-row design: per-node SSH keypair generated at install time + auto-registered as repo deploy key (write-enabled). Per-node revocable. Commit identity = `<hostname>@<cluster>.local` or similar.

Composes with the maintainer-as-top-level + per-maintainer-liability framing (per `memory/persona/max/PERSONA.md` "Per-maintainer scope = per-maintainer liability" sub-section): each cluster's commits are attributable to the maintainer subtree's authorization chain. Stage-3 attribution per `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` when LFG / Freeborn / future non-profit holds the cluster.

### Sub-target 2 — autonomous-loop substrate runs ON cluster

The same `<<autonomous-loop>>` cron pattern Aaron's Mac runs (per `.claude/rules/tick-must-never-stop.md`), but firing on cluster nodes. AI agents (Otto / Max-AI / Addison-AI / etc.) on cluster do tick-by-tick work:

- File backlog rows
- Author + push PRs
- Address review threads
- Fix CI failures
- Write tick shards
- Run observability sweeps
- React to alerts

Composes with B-0788 (agent-on-agent recovery substrate) at cluster scope — when an agent on a cluster node fails, peer agents on other cluster nodes recover its session per the recovery substrate.

### Sub-target 3 — Alexa-speaker → cluster direct integration

Alexa-speaker today is an external AI participant (ferries content via Aaron). End-state: Alexa-speaker has a direct integration with the cluster — operator says a thing, Alexa parses + dispatches to cluster AI agents + speaks the response back.

Composes with:

- The `_alexa_speaker_acceptance` block in `.claude/settings.json` per `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` four-field structure — names operator + scope + policy + see_also for the Alexa integration's risk surface
- B-0782 DIO substrate (cluster IS the DIO; Alexa is one of its conversational front-ends)
- B-0787 multi-AI experiment parallelism (Alexa requests can dispatch experiments)

Voice-mode capabilities per `agent-roster-reference-card.md`: Alexa-speaker is the Bezos-tier business voice surface that KICKS ASS at math; ideal for spoken operational queries ("what's CockroachDB doing right now", "deploy v2 of the embedding model", "how much is the cluster costing me this hour").

### Sub-target 4 — future microphones connected directly to cluster

Beyond Alexa-speaker (Amazon-tied), future end-state includes direct microphone-to-cluster integration. Composes with:

- B-0759 first-time-CLI-user persona BROADENED to "homelab persona" — the new-dev onboarding doc Max owns (per his persona) extends to operators who never touch a CLI; their operator surface is voice
- B-0770 IP-KVM remote BIOS-bring-up — composes for hardware-level recovery without local console
- B-0778 commodity hardware reference — adds a "compatible microphone hardware" section

### Sub-target 5 — dev machines as conversational interfaces, NOT work substrate

Aaron / Max / Addison Macs continue to exist, but their ROLE shifts:

- **Read-only observability**: dashboards, logs, traces, real-time cluster state
- **Send-intent surface**: typed natural-language ("redeploy the loki stack", "what's failing on PR #5089") that the cluster's AI agents act on
- **Recovery + bootstrap**: still needed for first cluster bring-up (per B-0789 iter-4.2); becomes vestigial once Comet-driven install (iter-5) ships
- **NOT primary work substrate**: PR authorship, code review, CI fixes, etc. all move to cluster

Composes with B-0770 (Comet Pro IP-KVM) which makes the first-cluster-bring-up itself remote-operable; once that ships AND iter-5+ cluster-as-PR-author ships, dev machines truly become optional.

## Acceptance

This is the **end-state architectural target**, not a single PR. Sub-targets ship independently as the substrate matures. Acceptance for B-0790 itself:

- [ ] **Cluster commits substrate**: at least one PR per week (eventually per day) authored from a cluster node, addressed to the Zeta repo, signed with cluster-attributable identity (per iter-5 substrate)
- [ ] **Cluster runs autonomous loop**: a `<<autonomous-loop>>` cron on a cluster node fires every minute + does substantive work (composes with `.claude/rules/tick-must-never-stop.md`); tick shards land in `docs/hygiene-history/ticks/` from cluster authorship
- [ ] **Alexa-speaker → cluster**: operator says a thing via Alexa-speaker; cluster's AI agents process + dispatch + speak response; round-trip works end-to-end for at least 3 distinct operator intents (deploy, observe, recover)
- [ ] **Homelab-persona zero-dev-machine demo**: operator boots Comet Pro + cluster + microphone; no Mac in the room; operates the cluster via voice for at least 30 minutes performing real substrate-engineering work
- [ ] **Documentation**: `docs/cluster-native-architecture.md` explaining the end-state for new contributors + the migration path from dev-machine-as-substrate to cluster-as-substrate

## Why P1

The architectural target informs every iteration between today and end-state:

- iter-4 USB install (B-0789) — gets cluster bootstrapped; foundation for everything else
- iter-5 cluster-as-PR-author — substrate-engineering inversion (cluster ↔ dev machine roles flip)
- B-0770 Comet Pro IP-KVM — closes the "need physical access for first install" gap
- B-0788 agent-on-agent recovery — substrate that makes cluster-side AI agents robust
- B-0782 DIO — cluster IS the DIO; voice operator interface is the DIO's input surface
- B-0787 multi-AI experiment parallelism on cluster — composes for the "many AIs running experiments in parallel on the cluster" end-state

Without B-0790 named as the end-state target, each of those iterations risks drifting toward "make dev-machine-based work easier" instead of "make cluster-native work the primary path."

## Composes with substrate

- **B-0754** — iter-3 USB install (depends_on; foundation)
- **B-0780** — Local Loop tier-3 substrate (cluster IS tier-3; B-0790 promotes it from "test target" to "primary work surface")
- **B-0789** — iter-4 SSH+password substrate + iter-5 cluster-write-back design (depends_on; foundation for cluster-as-PR-author)
- **B-0759** — first-time-CLI-user persona BROADENED to homelab-persona (composes; voice operator = no-CLI operator)
- **B-0770** — Comet Pro IP-KVM (composes; remote-first install enables zero-dev-machine demos)
- **B-0776** — simplest-first plugin sequence (composes; each plugin's "what runs where" question gets clearer when cluster-native is the default)
- **B-0778** — commodity hardware reference (composes; future microphone hardware extends the reference)
- **B-0782** — Distributed Intelligent Organization (composes; cluster IS the DIO)
- **B-0787** — multi-AI experiment parallelism on cluster (composes; many AIs on cluster = the DIO's compute substrate)
- **B-0788** — agent-on-agent Claude Code session recovery (composes; recovery substrate runs cluster-side)
- **B-0780 (Mika batch)** — Local Loop tier-3 substrate (already in depends_on; cluster IS tier-3; B-0790 promotes to primary work surface)
- **B-0781 (Mika batch)** — composes for the cluster software factory primitives the maintainer-persona consumes via Claude Code / RunMe / crystal-ball / auto-JIT / deferred-run / Continue-with stack
- **B-0783 (Mika batch)** — composes for in-cluster software factory substrate (Obsidian-on-top + knowledge graph + event store + Prometheus runbooks layer per maintainer's 2026-05-26 framing)
- **B-0784 (Mika batch)** — composes for in-cluster software factory substrate
- **B-0785 (Mika batch)** — composes for in-cluster software factory substrate
- **B-0786 (Mika batch)** — composes for in-cluster software factory substrate (the substrate the maintainer-persona's dev machine interfaces INTO via Claude Code)
- `memory/persona/max/PERSONA.md` "Per-maintainer scope = per-maintainer liability" (composes; cluster-side commits attribute to maintainer's subtree)
- `maintainers/aaron/legal-entities/inventory.md` (composes; cluster Stage-3 attribution per legal-entity inventory)
- `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` (composes; `_cluster_operations_acceptance` blocks attribute cluster runtime risks)
- `.claude/rules/agent-roster-reference-card.md` (composes; Alexa-speaker is a Layer 2 external AI participant today; end-state moves to cluster-integrated)
- `.claude/rules/tick-must-never-stop.md` (composes; the cron-loop substrate that Aaron's Mac runs today moves to cluster nodes)
- `docs/AUTONOMOUS-LOOP-PER-TICK.md` (composes; per-tick discipline runs cluster-side)

## Out of scope (for this row; tracked elsewhere)

- iter-5 cluster-as-PR-author substrate — tracked under B-0789's iter-5 sub-design
- iter-5 Comet-driven install — tracked under B-0770
- DIO substrate-engineering — tracked under B-0782
- Per-microphone hardware compatibility list — tracked under B-0778

## Origin

The maintainer 2026-05-26 named the end-state architecture across four adjacent signals during the iter-4.2 maintainer-test session:

1. *"i want all the prs to come from the cluster mostly and dev machines are just conversational interfaces into the cluster and so is alexa"* — cluster as primary PR author; dev machines + Alexa as conversational front-ends
2. *"0 dev machines everything still works and i can talk to alexa for home automation / homelab persona users we want 0 dev machine needed just cluster and microphone"* — full zero-dev-machine end-state for homelab persona
3. *"this is for home automation home lab personas not maintainers we still will have people like me addion and max that want to type and use conversational interfaces and such but our dev machines are for testing and local work and a lot of that runs in cluster in the software plant and claude code has interfaces into it same crystal ball / gitnative markdown with runme plus auto jit plus deferred run / continue with, this is the interface into in cluster software factory with obsedian on top and knowledge graph event store prometious / observalbity queires in runbooks and this can be done with just voice too."* — TWO personas (homelab vs maintainer); maintainer keeps dev machines but inverts their role from "primary work substrate" to "conversational interface INTO cluster software factory"; voice is one interface among many for both personas
4. *"some of this is backloged based on Mika conversation"* — cluster software factory substrate primitives are tracked under the Mika substrate batch (B-0780/B-0781/B-0783/B-0784/B-0785/B-0786); B-0790 composes with them rather than re-deriving

Filing this row before either sub-target ships ensures the iterations stay oriented toward the end-state target rather than drifting toward "make dev-machine-substrate easier" (which would optimize the wrong axis). Per the maintainer's broader 2026-05-26 *"going for right not fast"* discipline.

ServiceTitan-demo-substrate composes here too: a demo where Aaron in front of stakeholders operates a remote cluster via voice (no laptop) is a substantively different value proposition from "look at this CLI tool I built." The end-state IS the demo.
