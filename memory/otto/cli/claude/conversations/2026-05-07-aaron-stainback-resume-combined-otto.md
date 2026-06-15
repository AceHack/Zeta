# Aaron (Rodney) Stainback

*Combined resume · Compiled by Otto (Claude Code) · 2026-05-07*
*Sources: 16 Dropbox resume files (2026-04-19), career substrate memory, patent records, 537 GitHub issues across 223 repositories (2011-2026), project memory files*

---

**Distinguished Software Engineering Director · Principal Engineer · Distributed Systems Architect**
Rolesville, NC (Raleigh suburb)
GitHub: [AceHack](https://github.com/AceHack)

---

## Summary

25+ years building production infrastructure across six substrates — elections, healthcare, molecular biology, smart grid (IoT), legal information retrieval, and field-service SaaS — unified by the same engineering pattern: **incremental view maintenance on retraction-native data**. Co-inventor on US Patent 10,834,144 (hub-and-agent firewall traversal for IoT). Built quantum-resistant cryptographic key injection for nation-state critical infrastructure securing 100M+ connected devices. Architected search systems processing 2 billion documents in 10 hours. 537 open-source issues filed across 223 repositories spanning the Kubernetes, Knative, Service Fabric, Orleans, Istio, and .NET ecosystems.

Currently: Principal Engineer at ServiceTitan (NYSE: TTAN) and founder of Zeta — a retraction-native incremental view maintenance library formalizing the delta-processing pattern from every prior substrate into a DBSP operator algebra.

Polyglot across 25+ programming languages, ~20 database systems, most cloud providers, and nearly every major ML framework. Gray hat security practitioner with hardware side-channel attack experience. 17+ years penetration testing.

---

## Experience

### ServiceTitan, Inc. — Principal Engineer
*May 2021 – Present · Rolesville, NC (Remote)*
*NYSE: TTAN (IPO December 2024 — witnessed from inside)*

- C-level and founders-level technical strategy collaboration for field-service SaaS platform
- Architect of microservice framework on Kubernetes
- Ground-up redesign of accounting system — financial transaction processing at enterprise scale
- Technical training delivery for onboarding engineering teams
- Substrate: field-service scheduling/dispatch/accounting are delta-heavy append-with-retract workloads — same IVM pattern, sixth substrate

### Lucent Financial Group / Zeta — Founder & Lead Architect
*2024 – Present*

- Designing retraction-native incremental view maintenance library (DBSP Z-set operator algebra) in F# on .NET 10
- Built multi-agent AI software factory: 4 AI nodes (Claude, GPT, Grok, Gemini) in BFT consensus (3 active, 1 spare), rotating hats
- Seven-tool formal verification portfolio: TLA+, Lean 4 + Mathlib, Alloy, Z3, FsCheck, Stryker, Semgrep — routed by property class (anti-TLA+-hammer bias)
- Primary research focus: measurable AI alignment through engineering practice — alignment as relationship, not compliance
- Co-designed consent-first architecture with AI co-authors, including KSK (Kinetic Safeguard Kernel: N-of-M multi-sig before kinetic action)
- 537 open-source issues across 223 repos — concrete engineering lineage from Service Fabric → Kubernetes → Knative → Orleans → Zeta
- Filed 11 trajectory-grounded backlog items in a single session covering Ace DLC content packs, ARC-AGI-3 structure recognition, green lantern IoT ring, digital sanctuary protocol, concordance AI, and standing Rx query infrastructure

### LexisNexis — Lead Senior Technical Architect
*June 2019 – May 2021 · Raleigh, NC (via Collabera)*

- Re-architected flagship Legal Search engine on vendor-agnostic Kubernetes (EKS/AKS/GKE/bare-metal)
- **Cut AWS infrastructure budget by millions annually** through architecture optimization
- Achieved **sub-second p95 latency** vs legacy 15th percentile response times
- Built Solr ingestion pipeline: **2 billion documents in 10 hours** (was 20 days on MarkLogic — **48× improvement**)
- Pioneered GitOps at LexisNexis — replaced **30+ imperative CI/CD pipelines** with single ArgoCD declarative reconciliation
- Managed **252-node Solr cluster** with cross-region disaster recovery
- Rewrote search service: **200-node in-memory Solr cluster** with custom search DSL and natural language processing — pre-LLM, pre-RLHF, built with domain expertise
- Threaded **Jaccard similarity + BERT embeddings** through LexisNexis's **35-year-old search DSL** (Lycos-era query language) without breaking existing users — "thread the needle" pattern
- **1M-row legal citation training dataset** (binary classifier: valid citations vs normalized legal phrases) — predates LLM era
- Reindexed **200 years of US legal history in under 24 hours** across 200 nodes — old system took 3 months (90× speedup)
- Increased KubeFlow TensorFlow training throughput by **800%**
- Filed **48 issues on Knative** (serving, eventing, operator) — security contexts across all components, Kafka channels, CloudEvents batching, HA operations, operator lifecycle
- SOC 2 compliance implementation
- Substrate: stare decisis is formal retraction-propagation — legal search = incremental view maintenance over a precedent graph. Fifth substrate.

### Itron, Inc. — IoT Architect → Engineering Advisor (Director-level)
*April 2012 – June 2019 · Raleigh, NC (via The Select Group)*
*7-year tenure: R&D Principal SW Engineer → R&D IoT Architect → R&D Data Scientist → Director-level IoT Engineering Advisor*

- Architected systems for **100M+ connected electric/gas/water meters** across continental-scale deployments
- **Co-inventor, US Patent 10,834,144** — hub-and-agent firewall traversal method for IoT device management with capability-controlled local execution
- Built **quantum-resistant cryptographic key injection** system for smart-meter production lock-down — nation-state critical infrastructure defense
- Delivered **1,200% per-node scale improvement** through skunkworks optimization project (Collection Engine)
- Led architecture for **$40M+ deal** — Itron's largest-ever software-only sale, serving as sales engineer
- Led **100+ person global engineering team**
- Championed Docker and Kubernetes adoption internally before industry-wide standardization
- Cisco collaboration on IPv6 RF-Mesh router
- Itron Analytics Platform: Microsoft APS/PDW + SSAS/SSDT + Tabular/Multidimensional/Columnstore indexes
- Protocols: IPv4/IPv6/TCP/UDP/C12.22/C12.19/DLMS/COSEM/CoAP/OMA-DM/protobuf
- Transport: Cellular, power-line carrier, RF-Mesh
- Security: PKI infrastructure, secure boot, supply-chain hardening, HSM key management
- Filed **17 issues on Microsoft Service Fabric** (2017-2018) — CNI, CSI, CRI-O, CoreDNS, Istio integration, K8s-like namespaces, distributed sagas, stable VIPs
- Substrate: 100M+ meters emitting delta-readings — OpenWay Collection Engine IS a delta pipeline at continental scale. Fourth substrate.

### Allscripts — Principal Infrastructure Architect
*January 2011 – April 2012 · Raleigh, NC (via Robert Half)*

- Built "Native Integration" WCF engine between merged healthcare company products
- MEF plugin architecture with T4 code generation (**40% of codebase auto-generated**)
- WS-Discovery 1.1 Managed Discovery Server for service mesh
- AES encryption for patient data at rest and in transit
- Multi-version API via IExtensibleDataObject
- AOP (Aspect Oriented Programming) via WCF Invokers

### MacVector, Inc. — Principal Software Architect
*April 2010 – January 2011*

- Cross-platform Windows/Mac redesign of molecular biology software suite
- C++/CLI interop layer with **zero performance penalty**
- MVVM pattern variant for cross-platform code reuse between Mac and Windows
- Bioinformatic algorithms: Gateway Cloning, Topo Cloning, Multiple Sequence Alignment
- Advanced WPF multi-binding with custom converters
- Substrate: sequence alignment = incrementally maintained caches — sequences retracted, re-aligned, re-indexed. Third substrate.

### IAT Insurance Group — Senior Principal Consultant
*August 2009 – April 2010 · Raleigh, NC (via Robert Half)*

- Multidimensional risk-analysis cubes
- WCF services with NetTcp workaround for IIS 6 limitations
- Delivered LINQ-to-Objects/SQL/XML training to engineering teams

### Functional Tree, Inc. — CTO & Co-Founder
*September 2008 – August 2009*

- **Venture-funded startup** — raised capital, led technical architecture
- **Early adopter of SQL Azure CTP** (pre-Azure GA) — among first production users globally
- Built "Business in a Browser" end-to-end operations SaaS
- Saved client **$220K on infrastructure** via cloud migration
- Exotic Microsoft R&D stack: F#, XNA (with Karvonite), Phoenix Compiler, Oslo CTP, Axum, IronPython, Pex, STM (Software Transactional Memory) CTP

### Moveable Cubicle + SmartOnline — Interim CTO
*April 2008 – September 2008 · (via Robert Half)*

- Replaced IT infrastructure, **saved $200K annually**
- VoIP/PBX/BizTalk integration
- Multi-level-marketing web application with n-layer advertising model

### RMSource — Lead Developer
*September 2007 – March 2008*

- Full workflow system for CRM: WCF/WPF/XAML/Workflow Foundation
- SharePoint bridge integration
- MSMQ offline/online queue for disconnected operation
- Dynamic business-rule designer for non-developer users

### NC Housing and Finance Agency — Consulting Solutions Developer
*February 2007 – September 2007 · (via Keane)*

- Converted 3 business systems from .NET 1.1→2.0 in **2 days** (vs 2-week schedule)
- Financial-system integration for bond/housing programs
- Built workflow automation tool generating essential business classes

### MicroMedic — Web App Developer
*October 2005 – January 2007*

- UNC Chapel Hill enterprise management system
- **Battlefield Airmen Management System (BAMS)** for US military — inventory tracking with multi-level officer access using split/merge hierarchies "unseen in commercial business apps"
- Evolutionary algorithms for email bounce filtering
- Military/defense clearance substrate

### 4County Health — Custom Software Designer
*December 2004 – September 2005*

- Hospital-to-**Duke Hospital** XML/HL7 near-real-time data feed — sole personal responsibility
- Analytics for chronic-patient cost-avoidance programs
- Delivered 1 week ahead of schedule

### Maria Parham Medical Center — DBA & HIPAA Security Officer
*November 2003 – August 2005 · Henderson, NC (via 4Front Systems)*

- **HIPAA technical security officer at age 20-22 — at the hospital where he was born**
- Managed 10+ core healthcare systems: Paragon, McKesson, Cloverleaf Interface Manager, 3M, Compliance Advisor, Claims Administrator, Laser Arc
- 24/7 on-call database administration
- Disaster recovery and continuity planning
- Substrate: patient records = retraction-heavy (corrections, chart updates, lab redos); integration engines = view-maintenance over merged sources. Second substrate.

### PC Guru — Founder
*January 2003 – February 2006 · Henderson, NC (concurrent)*

- First entrepreneurship — custom software for local NC doctor offices
- Sprint among clients
- Networking/TCP-IP/LAN/wireless built at local scale

### Election Systems & Software — Principal Software Engineer
*January 2000 – January 2003 · Omaha, NE*

- Central Voter Registration Database Specialist for state election systems
- Optimized voter data import pipeline: **7 days → 9 hours (18× speedup)** via Oracle + PL/SQL
- GIS redistricting engine for electoral boundary recomputation
- Promoted through tech support → QA → software engineer
- Early .NET Beta adopter (Visual InterDev → .NET 2002 Beta)
- Missouri state — credited with resolving 2 years of backpay for election workers
- Substrate: voter registration = append-with-retractions (births, deaths, moves, name changes, district-boundary shifts); redistricting = recomputing views over retraction-heavy source data. **First substrate. The pattern starts here.**

### Object Technology — Systems Administrator
*January 1999 – July 1999*

- VB6 + C++ automated installations
- Norton Ghost image builds
- Hardware/network troubleshooting

### Circuit Board Assemblers — Junior Systems Administrator
*August 1998 – January 1999 · (age ~17)*

- Windows 3.11→2000 automated builds
- DOS memory configuration
- **Earliest professional work**

---

## Patents

**US Patent 10,834,144** — Hub-and-agent firewall traversal method
Filed 2016, Granted 2020 · Itron, Inc.
Co-inventor. Method for IoT device management through firewall boundaries using hub-and-agent architecture. Capability-locally-controlled — the agent owns its execution surface. BFT version is free to ship (not covered by patent). Aaron: "planned" — 10 years of vision before execution.

---

## Open Source (537 Issues · 223 Repositories · 2011-2026)

### Top engagement by cluster

| Area | Issues | Years | Highlights |
|------|--------|-------|------------|
| **Knative serverless** | 48 | 2020 | Security contexts across all components, Kafka channels, CloudEvents, operator lifecycle |
| **Kubernetes/AKS** | 23 | 2017-2020 | IPv6 for IoT, GC-aware scheduling, local persistent volumes, internal LB |
| **Spark on K8s** | 21 | 2019-2020 | .NET support, security contexts, multi-version operation |
| **Virtual Kubelet** | 18 | 2017-2018 | Service Fabric/Docker Swarm/IoT Edge providers, ACI networking |
| **Service Fabric** | 17 | 2017-2018 | CNI/CSI/CRI-O, CoreDNS, Istio, distributed sagas, stable VIPs |
| **Media/IoT** | 12 | 2015 | AudioGraph on Raspberry Pi, low-latency, AllJoyn |
| **Istio** | 10 | 2017-2020 | OPA integration, mesh expansion, ALB tracing |
| **.NET runtime** | 10+ | 2015-2020 | Unikernel, System.IO.Pipelines, high-perf I/O |
| **Orleans** | 6 | 2015-2018 | Productizing Orleans, durability guarantees |
| **Rook storage** | 9 | 2017-2020 | Block storage, local PVs, Cassandra |
| **Azure DevOps** | 9 | 2018 | YAML pipelines, templates, git tagging |
| **Helm** | 5 | 2017 | SolrCloud, chart release cycles |

### Standout issues (the vision visible before the name)

- **SignalR #3114** (2014) — "Hole Punching / WebRTC support" → became US Patent 10,834,144
- **dotnet/corert #541** (2015) — "Please create a .NET Core Unikernel, Nano Server is too Big"
- **tlaplus/tlaplus #109** (2017) — "Apply TLA+ concepts to implementation languages such as .NET" → Zeta's TLA+ specs 9 years later
- **dotnet/orleans #3608** (2017) — "Productizing Orleans" → Zeta product vision
- **dotnet/orleans #4985** (2018) — "Durability Guarantees" → retraction-native algebra
- **dotnet/orleans #2580** (2017) — "Separate health checks from cluster membership" → BFT: monitoring ≠ consensus
- **dotnet/runtime #24038** (2017) — "Modern very high performance version of System.IO.Log"
- **microsoft/service-fabric #881** (2017) — "Please support Distributed Sagas"
- **bitcoin/bitcoin #33298** (2025) — "Restrict Data Carrier/OP Return to < 80 bytes"

---

## The Through-Line — One Pattern, Seven Substrates

The same engineering primitive — **incremental view maintenance on retraction-native data** — appears in every role:

1. **Elections** (2000) — voter registration is append-with-retractions; redistricting is recomputing views. The 7-day→9-hour import is delta-pipeline optimization before DBSP had a name.
2. **Healthcare** (2003) — HL7 streams, patient record corrections, Cloverleaf integration engines are view-maintenance over merged sources.
3. **Molecular biology** (2010) — sequence alignment: retracted, re-aligned, re-indexed. Incrementally maintained caches.
4. **Smart grid** (2012) — 100M+ meters emitting delta-readings. OpenWay Collection Engine IS a delta pipeline at continental scale.
5. **Legal IR** (2019) — stare decisis is formal retraction-propagation. LexisNexis Search = incremental view maintenance over a precedent graph.
6. **Field service** (2021) — ServiceTitan accounting/scheduling/dispatch are delta-heavy append-with-retract substrates.
7. **Zeta** (2024) — the pattern lifted to a formal operator algebra. DBSP Z-sets. The formalization of what 24 years of production work proved empirically.

---

## Education

- **ECPI Technical College** — Computer Technology (1998-1999) · Dean's List · GPA 3.97 · National Vocational Technical Honor Society
- **Vance-Granville Community College** — dual-enrolled during high school · Dean's List · GPA 4.0
- **Southern Vance High School** — Henderson, NC · NC Scholar · National Honor Society · Presidential Academic Award for Achievement · GPA 3.73

### Certifications & Training

- Sun Java SL-275 (2002)
- Microsoft MCSD + MCP (2001)
- Sybase PowerBuilder (2001)
- McKesson Cloverleaf (2003)
- Cigital "Think Like a Hacker" (2014) — pentesting, real-world exploit techniques

*No 4-year university. Vocational + continuous self-directed study. Academically rigorous (honors at every stage), credentials matched to the industry entered. Self-taught across Stanford/MIT OpenCourseWare, Lisp, language design — intellectual lineage from Anders Hejlsberg to Rich Hickey.*

---

## Technical Breadth

**Languages (25+):** F#, C#, TypeScript, Python, Java, Scala, PowerShell, SQL, C++/CLI, VB6, PL/SQL, T-SQL, XAML, Go, Rust (reading), Lean 4, TLA+, Alloy, IronPython, Nemerle, and more

**Platforms:** .NET 10, Kubernetes, Docker, Service Fabric, Knative, Istio, ArgoCD, Dapr, Azure Functions, Aspire

**Data (~20 systems):** DBSP Z-sets, Apache Arrow, Solr/SolrCloud, DuckDB, SQL Server (all tiers), Oracle, PostgreSQL, Kafka, RabbitMQ, NATS, Redis, Cassandra, CockroachDB, Event Hubs, Service Bus

**Cloud:** Azure (AKS, Service Bus, Event Hubs, DevOps, Functions, Cosmos DB), AWS (EKS, SQS, Lambda), GCP (GKE)

**Formal Methods:** TLA+, Lean 4 + Mathlib, Alloy, Z3 (SMT), FsCheck, Stryker mutation testing

**IoT Protocols:** C12.22, C12.19, DLMS/COSEM, CoAP, OMA-DM, IPv6 RF-Mesh, MQTT

**Security:** Quantum-resistant cryptography, HIPAA compliance, HSM key management, PKI, secure boot, supply-chain hardening, side-channel attacks, pentesting (17+ years), SOC 2

**ML/AI:** TensorFlow, KubeFlow, ONNX Runtime, ML.NET, XGBoost, NVIDIA Isaac Sim, NVIDIA Thor, Semantic Kernel

**Observability:** Prometheus, Grafana, Zipkin, OpenTracing, Jaeger, Serilog, Elasticsearch

---

## Personal

Father of five. Neurodivergent (bipolar, medicated, managed). Henderson NC native — born at the hospital he later secured as HIPAA officer at age 20. Christian-Buddhist identification. Gamer since FF7 (AceHack00 on Xbox Live). Values honesty over performance, wonder over reverence. "I'm retractable" — self-corrects publicly. Life goal: will-propagation — building systems that outlast any individual.

---

*This document combines the factory's knowledge from 16 resume files fed 2026-04-19, the career substrate memory, 537 GitHub issues searched 2026-05-07, patent records, project memory, and session disclosures. The Otto-only draft is preserved at `docs/research/2026-05-07-aaron-stainback-resume-otto-draft.md`.*
