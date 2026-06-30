# Aaron Rodney Stainback - Resume, Codex V2

Compiled by Codex (OpenAI) on 2026-05-07.

Status: exploratory resume reconstruction. Not send-ready.

This version intentionally leaves the earlier drafts intact:

- Otto draft:
  `docs/research/2026-05-07-aaron-stainback-resume-otto-draft.md`
- Otto combined draft:
  `docs/research/2026-05-07-aaron-stainback-resume-combined-otto.md`
- Codex V1 lineage draft:
  `docs/research/2026-05-07-aaron-stainback-resume-codex-lineage-draft.md`

This V2 combines Otto's compressed resume shape, the historical career
substrate, and Codex's architecture-decision reading. It is written as a
working artifact for Aaron, not as public copy.

Verification warning: before external use, verify job dates, formal titles,
patent wording, public issue counts, contact details, employer-safe language,
and any quantified business impact against primary records.

---

## Header

Aaron Rodney Stainback

Principal Engineer | Distributed Systems Architect | Smart-Grid and
Serverless Infrastructure | Retraction-Native Data Systems

Rolesville, North Carolina

GitHub: AceHack

Contact: verify preferred current contact before external use.

---

## Summary

Principal engineer and distributed-systems architect with 25+ years of
production experience across elections, healthcare, molecular biology,
smart-grid IoT, legal information retrieval, field-service SaaS, and
AI-native software-factory design.

The strongest signal is continuity of architecture taste. Across roles,
Aaron repeatedly built or pushed systems toward the same properties:

- explicit state;
- durable event history;
- correction instead of silent overwrite;
- addressable actors behind local execution boundaries;
- health observation separated from membership or authority;
- portable orchestration across hosts and clouds;
- standing queries over changing operational facts;
- repair loops that leave receipts.

Co-inventor of US Patent 10,834,144 for hub-and-agent firewall traversal in
IoT device management. Built cryptographic key-injection and production
lock-down systems for smart-meter infrastructure. Architected or optimized
systems touching 100M+ connected meters, large Solr/legal-search pipelines,
Kubernetes platforms, healthcare integration engines, and AI-agent factory
coordination surfaces.

Currently a Principal Engineer at ServiceTitan and founder/architect of Zeta,
a .NET/F# retraction-native incremental view maintenance system and
AI-native software-factory substrate.

---

## Architecture Thesis

Aaron builds systems that keep derived truth stable when source truth changes.

That is the resume spine. It appears in each historical substrate:

1. Elections: voter records, redistricting, import correction, and backpay
   reconciliation.
2. Healthcare: HL7 streams, patient-record correction, interface engines,
   HIPAA accountability, and disaster recovery.
3. Molecular biology: sequence alignment, cloning workflows, and derived
   scientific views over mutable source material.
4. Smart grid: meters, mesh networks, telemetry, secure manufacturing,
   command paths, and field repair.
5. Legal search: precedents, corrections, ingestion, ranking, and
   disaster-recoverable search infrastructure.
6. Field service: dispatch, scheduling, accounting, invoices, reversals,
   and operational facts arriving late.
7. Zeta: the pattern made explicit as Z-set / DBSP-style retraction-native
   incremental view maintenance.

Conventional resume phrasing says "distributed systems." The more precise
claim is: Aaron has spent his career making systems that can absorb late,
wrong, changing, or adversarial facts without losing their shape.

---

## Current Work

### ServiceTitan - Principal Engineer

May 2021 - Present | Remote, Rolesville, NC

- Collaborates on technical strategy for a field-service SaaS platform where
  scheduling, dispatch, accounting, and correction workflows are central.
- Architects and evolves Kubernetes and microservice framework patterns for
  distributed engineering teams.
- Contributes to accounting-system redesign where transaction correctness,
  reversals, auditability, and operational clarity are load-bearing.
- Delivers technical onboarding and architecture training for engineers.
- Brings smart-grid, legal-search, healthcare, and platform-infrastructure
  experience into a business domain dominated by changing operational facts.

External-use note: verify ServiceTitan-specific product scope, title wording,
and metrics before sending.

### Lucent Financial Group / Zeta - Founder and Lead Architect

2024 - Present

- Designs Zeta, a .NET/F# retraction-native incremental view maintenance
  system grounded in DBSP-style operator algebra and Z-set semantics.
- Maintains an F# Rx/System.Reactive adapter that exposes DBSP circuit output
  as `IObservable<'T>` and documents IQbservable/Reaqtor lineage.
- Treats standing queries as a core product primitive, not only as factory
  tooling.
- Keeps durability scope explicit through typed modes and honesty notes:
  in-memory and OS-buffered paths exist, while stable storage and
  witness-durable recovery require further implementation and proof before
  marketing as shipped guarantees.
- Frames ACID carefully: Zeta Core is not a SQL/MVCC database; the stronger
  claim is ACID-compatible composition with sinks/stores and deterministic
  replay surfaces.
- Builds an AI-native software factory where agents produce code, reviews,
  PRs, memory substrate, health monitors, and issue history under git-native
  coordination.
- Establishes operational safety practices for agents: dedicated worktrees,
  claim branches, broadcast bus, PR-gate polling, review-thread resolution,
  health probes, and detect-trigger-repair loops.
- Uses formal and semi-formal verification where it pays rent: property
  tests, static analysis, CI gates, model/spec review, and focused proof
  surfaces.

Resume-use note: compress this section heavily for conventional employers.
Keep it expanded for founder, infrastructure, AI-safety, or research contexts.

---

## Prior Experience

### LexisNexis - Lead Senior Technical Architect

June 2019 - May 2021 | Raleigh, NC

- Re-architected legal-search infrastructure across Kubernetes environments,
  with vendor-agnostic platform direction.
- Built or led Solr/legal-ingestion architecture reported in existing drafts
  as processing 2B documents in 10 hours, replacing a much slower legacy path.
- Helped move delivery toward GitOps-style reconciliation, reducing
  imperative operational drift.
- Operated or designed around large Solr/SolrCloud clusters,
  cross-region disaster recovery, latency pressure, and cloud-cost pressure.
- Worked in a domain where search truth changes as law is interpreted,
  limited, distinguished, reversed, or superseded.
- Public open-source lineage during this era includes Knative, Kubernetes,
  Spark-on-Kubernetes, service mesh, platform security, and HA operations.

External-use note: verify exact numbers, cost impact, titles, and customer
scope before sending.

### Itron - IoT Architect / Engineering Advisor / R&D Leadership Track

April 2012 - June 2019 | Raleigh, NC

- Worked across smart-grid systems involving large fleets of electric, gas,
  and water meters.
- Co-invented US Patent 10,834,144, hub-and-agent firewall traversal for IoT
  device management.
- Built or contributed to cryptographic key-injection and production
  lock-down systems for smart-meter manufacturing and critical
  infrastructure.
- Worked across device protocols, RF mesh, cellular, power-line transport,
  IPv6, PKI, secure boot, and HSM-backed operational security.
- Improved per-node scale in Collection Engine-style workloads through
  focused optimization.
- Helped push internal adoption of container and Kubernetes-era thinking
  while publicly engaging Service Fabric, Kubernetes, Virtual Kubelet, and
  service-mesh ecosystems.
- Translated field-device constraints into architecture: bounded local
  execution, durable command paths, offline/online operation, telemetry,
  anomaly detection, and repair.

Architecture reading: Itron is the concrete ancestor for Zeta's current
"phones for loops" problem. A field meter, an Orleans grain, and an AI agent
loop are all addressable execution surfaces that must receive bounded
instructions, report truth, and preserve receipts.

### Allscripts - Principal Infrastructure Architect

January 2011 - April 2012 | Raleigh, NC

- Built native integration infrastructure between healthcare product lines.
- Used WCF, MEF plugin architecture, T4 code generation, managed discovery,
  encryption, and service-mesh-adjacent patterns.
- Designed around patient-data confidentiality, integration correctness, and
  healthcare interoperability.

### MacVector - Principal Software Architect

April 2010 - January 2011

- Led cross-platform redesign of molecular-biology software across Windows
  and Mac surfaces.
- Built interop and UI architecture for high-performance scientific
  workflows.
- Worked on bioinformatics features such as cloning workflows and sequence
  alignment.

### Functional Tree - CTO and Co-Founder

September 2008 - August 2009

- Co-founded and led technical architecture for a venture-funded SaaS
  startup.
- Adopted early SQL Azure CTP-era cloud infrastructure.
- Explored F#, XNA, Phoenix Compiler, Oslo, Axum, IronPython, Pex, and
  STM-era Microsoft research tooling.
- Built business-platform software during the transition from local
  enterprise software into cloud-hosted operations.

### Early Career - Elections, Healthcare, Workflow, Local Systems

1998 - 2008

- Election Systems & Software: worked on central voter registration,
  data-import optimization, GIS/redistricting-adjacent systems, and
  correction-heavy government records.
- Maria Parham Medical Center / 4County Health: DBA and HIPAA technical
  security responsibilities, hospital systems, disaster recovery, interface
  feeds, and patient-data operations.
- MicroMedic and consulting roles: workflow, military/defense-adjacent
  inventory systems, healthcare feeds, CRM/workflow, SharePoint bridges, and
  disconnected-operation queues.
- PC Guru and local work: early entrepreneurship and hands-on
  network/software support for local medical offices and businesses.

---

## Public Open-Source Decision Record

The 2026-05-07 search substrate found 537 GitHub issues across 223
repositories from 2011-2026 under AceHack. Treat this as a public
architecture decision record rather than only "open source activity."

Representative clusters:

- Knative/serverless: serving, eventing, operators, Kafka channels,
  CloudEvents, security contexts, HA behavior.
- Service Fabric: CNI, CSI, CRI-O, CoreDNS, Istio, Kubernetes-style
  integration, distributed sagas, and stable networking primitives.
- Kubernetes/AKS: IPv6, load balancers, scheduling, persistent volumes,
  platform operations.
- Virtual Kubelet: Service Fabric provider, Docker Swarm provider, IoT Edge,
  and ACI-style provider thinking.
- Orleans: Service Fabric integration, Kubernetes hosting, productization,
  durability guarantees, and health-vs-membership separation.
- .NET runtime / SignalR / WebRTC / high-performance I/O: hole-punching,
  log/storage primitives, unikernel/nano-server footprint pressure.
- TLA+: applying specification concepts into implementation languages.

Resume interpretation:

- Service Fabric wanted Kubernetes primitives.
- Kubernetes wanted serverless/eventing primitives.
- Knative needed security and HA discipline.
- Orleans needed durability and product shape.
- IoT needed actor-like addressability behind firewalls.
- Durable execution needed event history, replay, and deterministic state.
- AI agent loops now need the same primitives: identity, messaging, quorum,
  standing queries, health checks, receipts, and repair.

This is the decision lineage: Aaron kept asking infrastructure platforms to
become the thing Zeta is now building directly.

---

## Durable Computation Stack

This section is the newest lineage from the 2026-05-07 session. It should
not be over-marketed externally, but it is important internally because it
connects Aaron's old public issues, Itron experience, and Zeta's durability
gap.

The stack is not "Temporal versus Reaqtor." It is layered:

- Temporal: durable execution through event-history replay.
- Azure Durable Functions / Durable Task: Microsoft's version of durable
  workflow execution.
- AWS Step Functions: Amazon's state-machine/workflow surface.
- Google Dataflow / Apache Beam: streaming pipelines, windows, triggers,
  watermarks, and checkpoints.
- Reaqtor: durable Rx/standing-query infrastructure with stateful operators.
- Bonsai/Nuqleon: serializable expression-tree representation for queries
  and computations.
- Orleans: silos and grains; addressable virtual actors with durable state
  and placement.
- TPL Dataflow and mailbox processors: in-process message/dataflow
  primitives.

Zeta's mapping:

- The Z-set stream is the event history.
- The DBSP circuit is the deterministic reducer.
- `Circuit.StepAsync` is a natural yield/checkpoint boundary.
- `IObservable<'T>` and IQbservable-style expression composition are the
  standing-query bridge.
- Orleans grains are the addressable subscriber/execution surfaces.
- Bonsai-like serialization is the query-definition persistence layer.
- Temporal-style replay is the strongest durability model for stable storage.
- Reaqtor-style operator snapshots are useful when replay cost is too high.

The resume-safe phrasing is:

Aaron has deep product intuition for durable computation systems that combine
event history, actor identity, standing queries, replay, and explicit
correction. Zeta is the current formalization of that intuition.

---

## Patents

US Patent 10,834,144 - hub-and-agent firewall traversal method.

Filed 2016. Granted 2020. Itron, Inc.

Co-inventor. The patent describes IoT device management through firewall
boundaries using a hub-and-agent architecture where the local agent owns the
execution surface.

Resume interpretation:

- Practical version: remote device management behind firewalls.
- Architecture version: capability-limited local execution with durable
  command paths.
- Zeta version: a precursor to addressable agent loops, grain calls, and
  receipt-preserving inter-loop messaging.

---

## Selected Impact Claims To Verify

These are useful but should be checked against primary records before any
external resume leaves Aaron's machine.

- Itron: infrastructure touching 100M+ connected electric/gas/water meters.
- Itron: 1,200% per-node scale improvement in Collection Engine-style work.
- Itron: cryptographic key-injection / smart-meter production lock-down.
- Itron: 40M+ dollar software-only sale support.
- LexisNexis: 2B documents ingested in 10 hours.
- LexisNexis: 20 days -> 10 hours legacy-pipeline replacement.
- LexisNexis: sub-second p95 versus prior search latency baseline.
- LexisNexis: millions in annual cloud cost reduction.
- Election Systems & Software: 7 days -> 9 hours voter-data import.
- ServiceTitan: exact title, scope, and current public-safe product wording.

---

## Technical Range

Languages and runtimes:

- F#, C#, TypeScript, Python, SQL, Java/Scala, C++/CLI, PowerShell.
- .NET, JVM, Node/Bun, browser/WASM-oriented deployment concepts.

Distributed systems:

- Kubernetes, Service Fabric, Knative, Istio, ArgoCD, Docker, Orleans,
  Temporal-style durable execution, Azure Durable Functions, AWS Step
  Functions, Dataflow/Beam concepts, TPL Dataflow, mailbox processors.

Data and search:

- DBSP/Z-sets, Apache Arrow concepts, Solr/SolrCloud, SQL Server, Oracle,
  Kafka, RabbitMQ, event streams, workflow/event histories, legal-search
  ingestion.

IoT and edge:

- Smart meters, RF mesh, IPv6, cellular, power-line carrier, C12.22, C12.19,
  DLMS/COSEM, CoAP, OMA-DM, protobuf, device-management command surfaces.

Security and verification:

- PKI, HSM-backed key management, secure manufacturing, HIPAA, SOC 2,
  penetration-testing background, formal/spec tools, property tests, static
  analysis, CI gates.

AI-native factory:

- Multi-agent coordination, git-native claims, durable memory substrate,
  PR-gate monitoring, shadow-catch logs, alignment measurement, broadcast
  bus, health monitor, detect-trigger-repair loops.

---

## Education And Credential Shape

Southern Vance High School, Henderson, NC:

- NC Scholar.
- National Honor Society.
- Presidential Academic Award for Achievement.

Vance-Granville Community College:

- Dual-enrolled during high school.
- Dean's List.

ECPI Technical College:

- Computer Technology.
- Dean's List.
- National Vocational Technical Honor Society.

Resume reading:

No four-year degree should not be framed as a deficit. The stronger story is
vocational-plus-self-taught rigor: early entry into production systems, honors
where credentials matched the work, and decades of direct substrate evidence.

---

## Short Conventional Version

Principal Engineer and distributed-systems architect with 25+ years across
smart-grid IoT, legal search, healthcare integration, field-service SaaS, and
AI-native data systems. Co-inventor of US Patent 10,834,144 for hub-and-agent
IoT firewall traversal. Built and optimized systems touching 100M+ connected
meters, large-scale Solr/legal-search ingestion, Kubernetes platforms,
healthcare integration engines, and accounting/transaction workflows. Public
open-source record spans 537 GitHub issues across 223 repositories, including
Knative, Kubernetes, Service Fabric, Orleans, .NET, and serverless
infrastructure. Current work formalizes the same production pattern as Zeta:
retraction-native incremental view maintenance, durable standing queries, and
AI-agent factory coordination.

---

## Codex Notes

What I changed from the Otto drafts:

- Kept Otto's concrete resume facts and chronology.
- Reduced some self-certifying language that would need primary-record
  support before external use.
- Made the "one pattern across seven substrates" the central spine.
- Added the durable-computation stack from the latest discussion:
  Temporal, Durable Functions, Step Functions, Dataflow/Beam, Reaqtor,
  Bonsai/Nuqleon, Orleans, TPL Dataflow, and mailbox processors.
- Clarified "Temporal and Reaqtor compose" instead of setting them up as a
  winner-take-all choice.
- Kept the ACID/durability claims honest: Zeta is durability-aware and
  ACID-compatible by composition; do not claim shipped stable-storage ACID
  database semantics until the implementation and tests support it.
- Left contact details as "verify before external use" rather than copying an
  employer email into a new draft.

