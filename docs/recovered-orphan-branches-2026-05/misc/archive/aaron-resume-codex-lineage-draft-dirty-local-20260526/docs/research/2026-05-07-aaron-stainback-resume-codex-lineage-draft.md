# Aaron Rodney Stainback - Architecture Lineage Resume

Draft by Codex (OpenAI) - 2026-05-07.

Status: experimental resume draft, not send-ready.

This version is intentionally marked as a Codex version. It is not a
replacement for Otto's drafts or Riven's version. It is a different read:
the resume as an architecture-decision lineage, using Aaron's career history,
open-source issue history, patent history, and current Zeta work as one
continuous engineering pattern.

Source posture:

- Read local Otto resume drafts:
  - `docs/research/2026-05-07-aaron-stainback-resume-otto-draft.md`
  - `docs/research/2026-05-07-aaron-stainback-resume-combined-otto.md`
- Read existing factory resume honesty floor:
  - `memory/feedback_factory_resume_job_interview_honesty_only_direct_experience.md`
  - `docs/FACTORY-RESUME.md`
- Used session-substrate background from 2026-05-07:
  Orleans, Service Fabric, Kubernetes, Knative, serverless, Itron smart-grid,
  BFT, Reaqtor/Rx, and Zeta detect-trigger-repair discussion.
- Checked current repo evidence for the Zeta-specific claims:
  - `src/Core/Rx.fs` for F# System.Reactive / IObservable / IQbservable /
    Reaqtor lineage;
  - `src/Core/Durability.fs` for explicit durability modes and current
    honesty notes;
  - `docs/BENCHMARKS.md` for measured hot-path performance;
  - `docs/WONT-DO.md` for the ACID boundary: Zeta Core composes with ACID
    sinks/stores rather than pretending to be a SQL/MVCC engine.

Verification warning:

This is a thinking draft. Any externally shared resume should be fact-checked
against primary records: job dates, titles, patent records, public GitHub
issues, and employer-safe language.

---

## Contact Header

Aaron Rodney Stainback

Principal Engineer | Distributed Systems Architect | AI-Native Software
Factory Designer | Smart-Grid / Kubernetes / Serverless Infrastructure

Rolesville, North Carolina

GitHub: AceHack

---

## Executive Summary

Principal engineer and distributed-systems architect with 25+ years of
production experience across election systems, healthcare integration,
molecular biology software, smart-grid IoT, legal information retrieval,
field-service SaaS, and AI-native software-factory design.

The through-line is not just "senior polyglot engineer." It is a repeated
architecture instinct:

- make state explicit;
- separate health observation from membership or consensus;
- prefer durable event streams over hidden mutation;
- push orchestration systems toward portable primitives;
- treat edge devices, services, agents, and AI loops as addressable actors;
- design for retractions, corrections, and late facts instead of pretending
  append-only history is clean;
- turn production pain into reusable infrastructure.

Co-inventor of US Patent 10,834,144 for hub-and-agent firewall traversal in
IoT device management. Built quantum-resistant cryptographic key-injection
systems for smart-meter production lock-down. Architected systems touching
100M+ connected meters, 2B-document legal-search ingestion, large Solr
clusters, Kubernetes platforms, and AI agent coordination substrates.

Current work: Principal Engineer at ServiceTitan and founder/architect of
Zeta, a retraction-native incremental view maintenance library and AI-native
software-factory substrate.

---

## Architecture Identity

Aaron's history reads like one long migration path through the same problem:
how do distributed systems keep truthful state when the world changes under
them?

In elections, the state was voter registration, district boundaries, and
backpay correction.

In healthcare, it was HL7 feeds, patient-record corrections, interface engines,
and HIPAA-grade operational accountability.

In molecular biology, it was sequence alignment and cross-platform scientific
software where correctness depends on maintaining derived views over changing
source material.

At Itron, it became continental smart-grid infrastructure: millions of devices,
mesh networks, secure manufacturing, meter telemetry, device management, and
hub-and-agent control across firewall boundaries.

At LexisNexis, it became legal-search infrastructure: 2B documents, precedent
graphs, SolrCloud, Kubernetes, GitOps, disaster recovery, and ingestion
pipelines under budget and latency pressure.

At ServiceTitan, it became financial/accounting and field-service state:
scheduling, dispatch, accounting, and transaction systems where facts arrive,
change, and propagate.

At Zeta, the pattern is finally named directly: retraction-native incremental
view maintenance, standing queries, detect-trigger-repair loops, and a
multi-agent factory that treats AI coordination as distributed systems work.

---

## Decision Lineage

This section is the main Codex contribution. It rewires the resume around
decision continuity rather than chronology alone.

### 1. Addressable Actors Before They Were Called That

Aaron's Orleans issue lineage from 2015-2018 shows attention to virtual actors,
silos, Service Fabric integration, Kubernetes hosting, productization, and
durability guarantees. The same instinct appears in the Itron hub-and-agent
patent: remote control works only when each local surface owns its execution
boundary and receives bounded instructions.

Modern translation:

- Orleans grain: addressable actor with identity, behavior, and state.
- Itron agent: addressable field surface behind a firewall.
- Zeta loop: addressable agent with local context, claim surface, and receipts.

The resume claim is not "used Orleans in production" unless verified. The
stronger verified lineage claim is: Aaron repeatedly pushed public systems
toward addressable, durable, actor-shaped infrastructure.

### 2. Health Checks Are Not Membership

The Orleans issue "Separate distributed silo health checks from cluster
membership" is not a random GitHub comment. It predicts a core Zeta safety
rule: observation is not authority.

Modern translation:

- A heartbeat is not proof of progress.
- A green check is not proof that review threads are resolved.
- A local broadcast is not the source of truth when GitHub/PR state differs.
- A health signal should trigger investigation, not silently rewrite reality.

This is the same principle that now shows up in Zeta's factory-health monitor:
observer failure must emit degraded health, not "OK."

### 3. Hub-and-Agent Became Phones for Loops

Itron's hub-and-agent firewall traversal pattern reappears in the current Zeta
problem: Otto, Vera, and Riven need "phones," not just a file-based bulletin
board.

Architecture direction:

- file broadcast bus: durable but slow;
- file-watch trigger: event-driven local upgrade;
- Orleans-style grain calls: direct addressable loop messaging;
- BFT/quorum layer: no single agent's message becomes trusted action by itself;
- Reaqtor/Rx standing queries: detect the event pattern and fire triggers.

This is not resume fluff. It is a direct bridge from Itron smart-grid device
management to AI-agent coordination infrastructure.

### 4. Kubernetes, Service Fabric, Knative, and Serverless Were One Migration

Aaron's public issue history across Service Fabric, Kubernetes, Virtual
Kubelet, Knative, Istio, Spark-on-Kubernetes, and AKS reads like the same
question being asked across each platform generation:

How do we make distributed workloads portable, secure, observable, durable, and
operationally boring?

Repeated themes:

- CNI / CSI / CRI-O / CoreDNS / service mesh integration;
- Kubernetes-like primitives in Service Fabric;
- Service Fabric providers for Virtual Kubelet;
- Knative operator lifecycle, Kafka channels, security contexts, CloudEvents;
- serverless as an event surface, not just a deployment style;
- platform abstractions that carry state, identity, and policy across hosts.

This is valuable resume material because it shows architectural taste in
public, long before the current Zeta vocabulary existed.

### 5. Rx / Reaqtor / Itron: Coincidence Detection as Infrastructure

The Itron smart-grid problem is not just "collect meter reads." It is standing
queries over distributed telemetry:

- which devices changed;
- which readings arrived late;
- which failures cluster in the same window;
- which anomalies indicate a shared upstream cause;
- which event should trigger repair.

That is Rx/Reaqtor-shaped thinking:

- observe streams;
- window events;
- join coincidences;
- distinguish noise from shared cause;
- fire actions from query matches.

In Zeta, this exists at two layers.

F# core layer:

- `src/Core/Rx.fs` exposes DBSP circuit output as `IObservable<'T>`.
- The comments explicitly link DBSP streams to Rx push semantics,
  IQbservable expression-tree query composition, and Reaqtor.
- This is the user-facing standing-query substrate, written in F#.
- It is not merely TypeScript factory tooling.

Factory operations layer:

- detect orphaned work;
- trigger repair;
- verify repair;
- leave receipts.

The TypeScript health monitor is the factory eating its own dog food: standing
queries over PRs, backlog, claims, worktrees, lost files, and cadence. The F#
Rx adapter is the product/library layer. Reaqtor's durable standing-query model
is the right ancestor for persistence and recovery, while Zeta's current
durability story is explicit about which modes are shipped and which are still
research-preview.

WASM/F# deployment vector:

The same architecture can plausibly target server, edge, and browser/WASM
surfaces: F# core logic for .NET server/edge, and F#-to-WASM/Fable/Blazor-style
deployment for local or browser-hosted standing-query surfaces. This is a draft
architecture direction, not a shipped resume claim unless a concrete WASM
artifact lands.

The resume version: Aaron's smart-grid experience maps naturally to modern
standing-query infrastructure for both databases and software factories.

### 6. Retractions Are the Real World

Across every domain, Aaron worked where facts change:

- voters move, die, change names, shift districts;
- patient records get corrected;
- legal precedent is distinguished, limited, reversed, or superseded;
- meter telemetry arrives late or contradicts expected state;
- accounting records require correction rather than deletion;
- AI agents produce claims that need review, retraction, and repair.

Zeta names this formally as retraction-native incremental view maintenance.
The resume version should make that legible without asking the reader to know
DBSP.

Plain version:

Aaron builds systems that keep derived truth stable when source truth changes.

---

## Professional Experience

### ServiceTitan - Principal Engineer

May 2021 - Present | Remote, Rolesville, NC

Core signal:

Principal engineer working on field-service SaaS infrastructure, technical
strategy, Kubernetes/microservice architecture, engineering enablement, and
accounting/financial transaction systems.

Resume bullets:

- Partner with senior technical and business leadership on platform direction
  for a large field-service SaaS environment.
- Architect and evolve Kubernetes-based microservice frameworks and platform
  patterns for distributed product teams.
- Contribute to ground-up accounting-system redesign where transaction
  correctness, reversals, auditability, and operational clarity are central.
- Deliver technical onboarding and architecture training for engineering teams.
- Bring long-running experience from smart-grid, legal-search, and healthcare
  infrastructure into field-service workflows where schedules, invoices,
  dispatch, payments, and corrections form a delta-heavy business substrate.

Draft-note:

ServiceTitan-specific metrics and product details should be verified before
external use.

### Lucent Financial Group / Zeta - Founder and Lead Architect

2024 - Present

Core signal:

Founder/architect of Zeta: a retraction-native incremental view maintenance
library and AI-native software factory. The project functions as both systems
software and measurable AI-alignment research substrate.

Resume bullets:

- Designing a .NET/F# retraction-native incremental view maintenance system
  grounded in DBSP-style operator algebra and Z-set semantics.
- Shipping an F# Rx/System.Reactive adapter that exposes DBSP circuit output
  as `IObservable<'T>`, with IQbservable/Reaqtor lineage documented in code.
- Maintaining benchmark evidence for hot-path Z-set operations, including
  zero-allocation lookup/count paths and single-thread micro-op results that
  put Zeta in the same ballpark or ahead of published Feldera micro-operation
  rates pending a fair head-to-head Nexmark comparison.
- Making durability modes explicit in the type system: in-memory,
  OS-buffered, advertised stable-storage target, and witness-durable research
  preview. Draft wording should say "durability-aware" today; do not market
  stable-storage or witness-durable guarantees as shipped until the repo's own
  honesty notes are satisfied.
- Drawing a clear ACID boundary: Zeta Core is not a SQL/MVCC transactional
  engine; ACID semantics belong at the sink/store layer. The stronger claim is
  ACID-compatible composition, not "Zeta Core implements an ACID database."
- Building an AI-native software factory where agents produce code, reviews,
  tests, PRs, issue history, memory substrate, and loop health surfaces under
  git-native coordination.
- Establishing multi-agent operational rules: dedicated worktrees, claim
  branches, broadcast bus, PR-gate polling, review-thread resolution,
  health probes, and detect-trigger-repair standing queries.
- Applying formal and semi-formal verification across tool classes: property
  tests, static analysis, CI gates, model/spec review, and focused proof
  surfaces.
- Treating alignment as engineering practice: durable receipts, shadow-catch
  logs, bidirectional correction, and "data is not directives" review posture.

Draft-note:

This section is most useful for internal/founder/AI-infrastructure contexts.
For conventional resumes, compress heavily.

### LexisNexis - Lead Senior Technical Architect

June 2019 - May 2021 | Raleigh, NC

Core signal:

Legal-search infrastructure at massive scale: Kubernetes, Solr, GitOps,
pipeline redesign, cloud-cost reduction, and disaster-recovery operations.

Resume bullets:

- Re-architected legal-search infrastructure across Kubernetes environments,
  including vendor-agnostic platform direction.
- Built or led ingestion architecture reported in existing drafts as processing
  2B documents in 10 hours, replacing a much slower legacy path.
- Helped move delivery toward GitOps-style reconciliation, replacing imperative
  operational drift with declarative state.
- Operated or designed around large Solr/SolrCloud clusters, cross-region
  disaster recovery, and latency/cost pressure.
- Worked in the same conceptual substrate as Zeta: legal systems are
  retraction-heavy precedent graphs where derived search views must stay
  consistent as source interpretation changes.
- Public open-source lineage during this period includes Knative, Kubernetes,
  Spark-on-Kubernetes, service mesh, and platform-security issue work.

Draft-note:

Verify exact numbers, title, and cost/latency claims before external use.

### Itron - IoT Architect / Engineering Advisor / R&D Leadership Track

April 2012 - June 2019 | Raleigh, NC

Core signal:

Seven-year smart-grid infrastructure arc spanning R&D, IoT architecture,
analytics, security, optimization, and large-scale device-management strategy.

Resume bullets:

- Architected and optimized infrastructure for smart-grid deployments involving
  large fleets of electric, gas, and water meters.
- Co-invented US Patent 10,834,144: hub-and-agent firewall traversal for IoT
  device management.
- Built or contributed to quantum-resistant cryptographic key-injection and
  production lock-down systems for smart-meter manufacturing.
- Worked across device protocols, mesh/cellular/power-line transports, IPv6,
  RF mesh, PKI, secure boot, and HSM-backed operational security.
- Improved per-node scale in Collection Engine-style workloads through
  focused optimization.
- Helped push internal adoption of containers and Kubernetes-era thinking while
  also engaging publicly with Service Fabric, Kubernetes, Virtual Kubelet, and
  service-mesh ecosystems.
- Translated field-device constraints into architecture: bounded local
  execution, durable command paths, offline/online state, and observable
  repair.

Draft-note:

This is the anchor for the Orleans/grains/BFT/Reaqtor "phones for loops"
lineage. It should stay, but external wording must avoid employer-confidential
details.

### Allscripts - Principal Infrastructure Architect

January 2011 - April 2012 | Raleigh, NC

Core signal:

Healthcare integration, WCF/service infrastructure, security, and generated
integration code across merged product surfaces.

Resume bullets:

- Built native integration infrastructure between healthcare product lines.
- Used WCF, MEF plugin architecture, T4 code generation, managed discovery,
  encryption, and service-mesh-adjacent patterns.
- Designed around patient-data confidentiality and healthcare interoperability.

### MacVector - Principal Software Architect

April 2010 - January 2011

Core signal:

Scientific desktop software, cross-platform architecture, C++/CLI interop,
and molecular-biology algorithm surfaces.

Resume bullets:

- Led cross-platform redesign of molecular-biology software across Windows and
  Mac surfaces.
- Built interop and UI architecture for high-performance scientific workflows.
- Worked on bioinformatics features such as cloning workflows and sequence
  alignment.

### Functional Tree - CTO and Co-Founder

September 2008 - August 2009

Core signal:

Startup CTO, early cloud adoption, Microsoft research-stack exploration, and
business-platform architecture.

Resume bullets:

- Co-founded and led technical architecture for venture-funded SaaS startup.
- Adopted early SQL Azure CTP-era cloud infrastructure.
- Explored F#, XNA, Phoenix Compiler, Oslo, Axum, IronPython, Pex, and STM-era
  Microsoft research tooling.

### Early Career - Elections, Healthcare, Local Systems, Defense-Adjacent Apps

1998 - 2008

Core signal:

Aaron entered the industry through real production responsibility: installs,
networking, elections, hospital systems, HIPAA, XML/HL7 feeds, workflow apps,
and local software businesses.

Resume bullets:

- Election Systems & Software: optimized voter-registration import pipelines,
  worked on central voter registration and GIS/redistricting-related systems.
- Maria Parham Medical Center / 4County Health: DBA and HIPAA technical
  security responsibilities, hospital systems, disaster recovery, interface
  feeds, and patient-data operations.
- MicroMedic / other consulting roles: workflow, military/defense-adjacent
  inventory systems, healthcare feeds, CRM/workflow, SharePoint bridges, and
  disconnected-operation queues.
- PC Guru / local work: early entrepreneurship and hands-on network/software
  support for local medical offices and businesses.

---

## Open-Source Decision Record

Existing searched summary from the 2026-05-07 session:

- 537 GitHub issues
- 223 repositories
- 2011-2026
- public handle: AceHack

This is not just "open source activity." It is a public decision record.

Representative clusters:

- Knative/serverless: operator lifecycle, eventing, serving, Kafka channels,
  CloudEvents, security contexts, HA behavior.
- Service Fabric: CNI, CSI, CRI-O, CoreDNS, Istio, Kubernetes-style
  integration, distributed sagas, stable networking primitives.
- Kubernetes/AKS: IPv6, load balancers, scheduling, persistent volumes,
  platform operations.
- Virtual Kubelet: Service Fabric provider, Docker Swarm provider, IoT Edge,
  ACI-style provider thinking.
- Orleans: Service Fabric integration, Kubernetes hosting, productization,
  durability guarantees, health-vs-membership separation.
- .NET runtime / SignalR / WebRTC / high-performance I/O: hole-punching,
  log/storage primitives, unikernel/nano-server footprint pressure.
- TLA+: applying specification concepts into implementation languages.

Resume interpretation:

Aaron repeatedly spotted where infrastructure platforms were converging before
the convergence was mainstream:

- Service Fabric wanted Kubernetes primitives.
- Kubernetes wanted serverless/eventing primitives.
- Knative needed security and HA discipline.
- Orleans needed durability and product shape.
- IoT needed actor-like addressability behind firewalls.
- AI agent loops now need the same primitives: identity, messaging, quorum,
  durable receipts, and standing queries.

---

## Selected Technical Themes

### Distributed Systems and Orchestration

Kubernetes, Service Fabric, Knative, Virtual Kubelet, Istio, ArgoCD, SolrCloud,
containerized workloads, serverless/eventing, GitOps, multi-region and
disaster-recovery thinking.

### Smart Grid and IoT

Large device fleets, secure manufacturing, cryptographic key injection, meter
telemetry, RF mesh, IPv6, cellular/power-line transport, local-agent control,
firewall traversal, and hub-and-agent management.

### Data Systems and Search

Solr, SQL Server, Oracle, MarkLogic migration pressure, analytics platforms,
large ingest pipelines, derived views, late facts, corrections, and
retraction-heavy domains.

### Formality and Correctness

Property testing, static analysis, CI gates, TLA+/Lean/Alloy/Z3-style tool
awareness, and a strong preference for claims that are backed by executable or
reviewable evidence.

### AI-Native Factory Design

Multi-agent loops, git-native claims, worktree isolation, PR-gate polling,
review-thread handling, memory substrate, shadow-catch logs, alignment as a
measurable engineering process, and detect-trigger-repair infrastructure.

---

## Technical Inventory

Languages:

F#, C#, TypeScript, Python, Java, Scala, PowerShell, SQL, PL/SQL, T-SQL,
C++/CLI, XAML, VB-era systems, and additional languages across prior roles.

Platforms:

.NET, Kubernetes, Docker, Service Fabric, Knative, Istio, ArgoCD, Azure, AWS,
GCP, serverless/eventing systems, CI/CD and GitOps platforms.

Data and messaging:

Solr/SolrCloud, SQL Server, Oracle, MarkLogic, Kafka, RabbitMQ, NATS,
Service Bus/Event Hubs-style systems, analytics warehouses, event streams,
System.Reactive / Rx.NET, Reaqtor/IQbservable lineage, and
retraction/delta-heavy pipelines.

Zeta-specific performance and durability:

BenchmarkDotNet hot-path evidence, zero-allocation Z-set lookup/count paths,
DBSP operator algebra, explicit durability modes, ACID-compatible sink/store
boundary, and a research-preview witness-durable direction. Internal phrase
"fastest database in its class" should be treated as an ambition or
benchmark-backed positioning claim until a fair class definition and
head-to-head benchmark set are attached.

Deployment targets:

.NET server and edge by default; F#-to-WASM / Fable / Blazor-style browser
deployment is an architecture vector to explore for local standing-query
surfaces, not yet a shipped claim in this draft.

Security:

HIPAA operations, PKI, HSM/key-management concepts, secure manufacturing,
quantum-resistant key-injection substrate, secure boot/supply-chain concerns,
and long-running gray-hat/pentest-adjacent practice as represented in existing
drafts.

Verification and research:

TLA+, Lean, Alloy, Z3, FsCheck/property testing, static analysis, mutation
testing awareness, DBSP, differential dataflow, incremental view maintenance,
and formal operator-law thinking.

---

## Education and Training

Existing drafts list:

- ECPI Technical College - Computer / Networking Technology
- Vance-Granville Community College - dual enrollment during high school
- Southern Vance High School - NC Scholar / honors record
- Microsoft / Java / PowerBuilder / Cloverleaf / security training entries

Codex wording:

Non-traditional education path with early professional entry, high academic
performance in available programs, and sustained self-directed study across
distributed systems, programming languages, formal methods, cloud platforms,
security, and AI systems.

---

## What This Resume Should Say If Compressed

Short version:

Aaron Stainback is a principal engineer whose career repeatedly turns messy,
changing real-world state into durable distributed systems. He has built across
elections, healthcare, molecular biology, smart-grid IoT, legal search, and
field-service SaaS; co-invented an IoT firewall-traversal patent; worked on
smart-grid security and large-scale meter infrastructure; re-architected
Kubernetes/Solr legal-search platforms; and has a 15-year public open-source
issue record pushing Service Fabric, Kubernetes, Knative, Orleans, and
serverless systems toward durability, portability, security, and event-driven
operation. His current work, Zeta, formalizes that same career pattern as
retraction-native incremental view maintenance and AI-native software-factory
infrastructure.

One-line version:

Distributed-systems architect specializing in durable state, event-driven
infrastructure, and retraction-native systems across smart grid, Kubernetes,
legal search, SaaS, and AI-native software factories.

---

## Codex Notes For Next Version

What I would keep:

- Itron as the central architecture anchor.
- The patent as the bridge from physical IoT to AI-loop messaging.
- F# `Rx.fs` as the real Reaqtor/Rx lineage in the product layer, with the
  TypeScript health monitor framed only as the factory-operations mirror.
- Open-source issue history as public decision lineage, not just contribution
  count.
- The "health check is not membership" principle.
- The "retractions are the real world" through-line.
- Zeta as the formalization, not an unrelated side project.

What I would reduce before sending externally:

- Spiritual/persona language.
- Internal agent names unless applying to AI-infrastructure work.
- Any employer-sensitive detail.
- Exact numbers not verified from primary records.
- Claims about team size, deal size, cost savings, or security details unless
  backed by a resume source the user is comfortable sharing.
- "Fastest database in class," "durable," and "ACID-compliant" phrasing unless
  each is tied to the repo's actual evidence:
  - benchmark suite and class definition for "fastest";
  - `DurabilityMode` shipped semantics for "durable";
  - sink/store composition boundary for "ACID."

What I would ask Aaron only if making a send-ready version:

- Target audience: Big Tech principal/staff role, startup CTO/founder role,
  AI-infrastructure role, smart-grid/IoT role, or investor/advisor profile.
- Whether to use "Aaron" or "Rodney" publicly.
- Which metrics are safe to state.
- Whether ServiceTitan email belongs anywhere in a resume.
- Whether Zeta should be framed as open-source research, startup substrate, or
  personal R&D.
- Whether he wants a separate investor/technical-founder profile where the
  bolder "fastest in class / ACID-compatible / Reaqtor-in-F#" positioning can
  be unpacked with benchmark and architecture citations.
