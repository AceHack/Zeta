# Aaron (Rodney) Stainback — Resume

*Draft by Otto (Claude Code) · 2026-05-07 · from career substrate, patent records, and 537 GitHub issues across 223 repos*

---

**Principal Engineer · Distributed Systems Architect · IoT Infrastructure**
Rolesville, NC · astainback@servicetitan.com
GitHub: [AceHack](https://github.com/AceHack) · [537 issues across 223 repos](https://github.com/search?q=author%3AAceHack+type%3Aissue&type=issues) (2011–2026)

---

## Summary

Principal engineer with 25+ years building production infrastructure across elections, healthcare, molecular biology, smart grid, legal search, and field service. Co-inventor on US Patent 10,834,144 (hub-and-agent firewall traversal for IoT). Built quantum-resistant cryptographic systems for nation-state critical infrastructure protecting 100M+ connected devices. Designed and shipped search systems processing 2B documents in 10 hours. Currently building retraction-native incremental view maintenance libraries in .NET 10 F# — the same delta-processing pattern applied across every prior substrate, now formalized as an operator algebra.

---

## Experience

### ServiceTitan, Inc. — Principal Engineer
*May 2021 – Present · Rolesville, NC (Remote)*

- Collaborate with C-level leadership and founders on technical strategy for field-service SaaS platform
- Architect microservice framework on Kubernetes for ServiceTitan's distributed platform
- Redesigned accounting system ground-up — financial transaction processing at enterprise scale
- Deliver onboarding technical training to engineering teams

### Lucent Financial Group / Zeta — Founder & Lead Architect
*2024 – Present*

- Designing retraction-native incremental view maintenance library (DBSP operator algebra) in F# on .NET 10
- Built multi-agent AI software factory with 3 active AI nodes (Claude, GPT, Grok) in BFT consensus
- 537 open-source issues filed across 223 repositories over 15 years — concrete engineering lineage from Service Fabric → Kubernetes → Knative → Orleans → Zeta
- Formal verification portfolio: TLA+, Lean 4 + Mathlib, Alloy, Z3, FsCheck — routed by property class
- Alignment research as primary project focus — measurable AI alignment through engineering practice

### LexisNexis — Lead Senior Technical Architect
*June 2019 – May 2021 · Raleigh, NC (via Collabera)*

- Re-architected flagship Legal Search on vendor-agnostic Kubernetes (EKS/AKS/GKE/bare-metal)
- Cut AWS infrastructure budget by millions annually through architecture optimization
- Achieved sub-second p95 latency vs legacy 15th percentile response times
- Built Solr ingestion pipeline: **2 billion documents in 10 hours** (was 20 days on MarkLogic — 48× improvement)
- Pioneered GitOps at LexisNexis — replaced 30+ imperative pipelines with single ArgoCD declarative reconciliation
- Managed 252-node Solr cluster with cross-region disaster recovery
- Increased KubeFlow TensorFlow training throughput by 800%
- Filed 48 issues on Knative (serving, eventing, operator) — security contexts, Kafka channels, CloudEvents, HA operations

### Itron, Inc. — IoT Architect → Engineering Advisor (Director-level)
*April 2012 – June 2019 · Raleigh, NC (via The Select Group)*

- **7-year tenure** across R&D Principal SW Engineer → IoT Architect → Data Scientist → Director-level Engineering Advisor
- Architected systems for **100M+ connected electric/gas/water meters** across continental-scale deployments
- **Co-inventor, US Patent 10,834,144** — hub-and-agent firewall traversal method for IoT device management
- Built **quantum-resistant cryptographic key injection** system for smart-meter production lock-down (nation-state critical infrastructure)
- Delivered **1,200% per-node scale improvement** through skunkworks optimization project
- Led architecture for **$40M+ deal** (Itron's largest-ever software-only sale) as sales engineer
- Led 100+ person global engineering team
- Championed Docker and Kubernetes adoption internally before industry-wide adoption
- Protocols: IPv4/IPv6/TCP/UDP/C12.22/C12.19/DLMS/COSEM/CoAP/OMA-DM/protobuf
- Transport: Cellular, power-line carrier, RF-Mesh (Cisco collaboration on IPv6 RF-Mesh router)
- Analytics: Itron Analytics Platform on Microsoft APS/PDW + SSAS/SSDT + Tabular/Multidimensional/Columnstore indexes
- Filed 17 issues on Microsoft Service Fabric (2017-2018) — CNI, CSI, CRI-O, CoreDNS, Istio, Kubernetes integration, distributed sagas

### Allscripts — Principal Infrastructure Architect
*January 2011 – April 2012 · Raleigh, NC (via Robert Half)*

- Built "Native Integration" WCF engine between merged healthcare company products
- MEF plugin architecture with T4 code generation (40% of code auto-generated)
- WS-Discovery 1.1 Managed Discovery Server for service mesh
- AES encryption for patient data at rest and in transit

### MacVector, Inc. — Principal Software Architect
*April 2010 – January 2011*

- Cross-platform Windows/Mac redesign of molecular biology software suite
- C++/CLI interop layer with zero performance penalty
- Implemented bioinformatic algorithms: Gateway Cloning, Topo Cloning, Multiple Sequence Alignment

### Functional Tree, Inc. — CTO & Co-Founder
*September 2008 – August 2009*

- Venture-funded startup — raised capital, led technical architecture
- **Early adopter of SQL Azure CTP** (pre-Azure GA) — among first production users
- Built "Business in a Browser" end-to-end operations SaaS
- Saved client $220K on infrastructure via cloud migration
- Stack: F#, XNA, Phoenix Compiler, Oslo CTP, Axum, IronPython, Pex, STM CTP

### Election Systems & Software — Principal Software Engineer
*January 2000 – January 2003 · Omaha, NE*

- Central Voter Registration Database Specialist for state election systems
- Optimized voter data import pipeline: **7 days → 9 hours** (18× speedup) via Oracle + PL/SQL
- GIS redistricting engine for electoral boundary recomputation
- Early .NET Beta adopter (Visual InterDev → .NET 2002 Beta)
- Missouri state — credited with resolving 2 years of backpay for election workers

### Maria Parham Medical Center — DBA & HIPAA Security Officer
*November 2003 – August 2005 · Henderson, NC (via 4Front Systems)*

- HIPAA technical security officer at age 20-22 — at the hospital where he was born
- Managed 10+ core healthcare systems: Paragon, McKesson, Cloverleaf Interface Manager, 3M
- 24/7 on-call database administration and disaster recovery planning

---

## Patents

**US Patent 10,834,144** — Hub-and-agent firewall traversal method
Filed 2016, Granted 2020 · Itron, Inc.
Co-inventor. Method for IoT device management through firewall boundaries using hub-and-agent architecture with capability-controlled local execution.

---

## Open Source Contributions (537 Issues · 223 Repositories · 2011–2026)

### Top engagement clusters

| Area | Repos | Issues | Years | Highlights |
|------|-------|--------|-------|------------|
| **Knative serverless** | 7 repos | 48 | 2020 | Security contexts across all components, Kafka channels, CloudEvents batching, operator lifecycle |
| **Kubernetes/AKS** | 5 repos | 23 | 2017-2020 | IPv6 for IoT, Calico, internal LB, GC-aware scheduling, local persistent volumes |
| **Spark on K8s** | 1 repo | 21 | 2019-2020 | .NET support, security contexts, webhook certs, multi-version operation |
| **Virtual Kubelet** | 2 repos | 18 | 2017-2018 | Service Fabric provider, Docker Swarm provider, IoT Edge, ACI networking |
| **Service Fabric** | 2 repos | 17 | 2017-2018 | CNI/CSI/CRI-O, CoreDNS, Istio, K8s namespaces, distributed sagas, stable VIPs |
| **Istio service mesh** | 1 repo | 10 | 2017-2020 | OPA integration, mesh expansion, ALB tracing, Thrift support |
| **Orleans virtual actors** | 1 repo | 6 | 2015-2018 | Service Fabric integration, productizing Orleans, durability guarantees |
| **IoT/media** | 1 repo | 12 | 2015 | AudioGraph on Raspberry Pi, low-latency, AllJoyn, Azure Media Services |
| **.NET runtime** | 5 repos | 10+ | 2015-2020 | Unikernel, System.IO.Pipelines, Socket.SendAsync, high-perf I/O |
| **TLA+** | 1 repo | 1 | 2017 | "Apply TLA+ concepts to implementation languages such as .NET" |

### Notable issues

- **SignalR #3114** (2014) — "Hole Punching / WebRTC support" — precursor to US Patent 10,834,144
- **dotnet/corert #541** (2015) — ".NET Core Unikernel, Nano Server is too Big"
- **tlaplus/tlaplus #109** (2017) — "Apply TLA+ concepts to implementation languages such as .NET"
- **dotnet/orleans #3608** (2017) — "Productizing Orleans"
- **dotnet/runtime #24038** (2017) — "Modern very high performance version of System.IO.Log"
- **bitcoin/bitcoin #33298** (2025) — "Restrict OP_RETURN to < 80 bytes"

---

## The Through-Line

The same engineering pattern — **incremental view maintenance on retraction-native data** — appears across every substrate:

1. **Elections** (2000) — voter registration is append-with-retractions; redistricting is recomputing views over retraction-heavy source data
2. **Healthcare** (2003) — HL7 streams, patient record corrections, chart updates — integration engines are view-maintenance over merged sources
3. **Molecular biology** (2010) — sequence alignment: retracted, re-aligned, re-indexed — incrementally maintained caches
4. **Smart grid** (2012) — 100M+ meters emitting delta-readings; OpenWay Collection Engine IS a delta pipeline at continental scale
5. **Legal IR** (2019) — stare decisis is formal retraction-propagation; LexisNexis Search = incremental view maintenance over a precedent graph
6. **Field service** (2021) — accounting/scheduling/dispatch are delta-heavy append-with-retract substrates
7. **Zeta** (2024) — the pattern lifted to a formal operator algebra (DBSP Z-sets)

---

## Education

- **ECPI Technical College** — Networking Technology (attended)
- **Vance-Granville Community College** — dual-enrolled during high school
- **Southern Vance High School** — NC Scholar, National Honor Society, Presidential Academic Award for Achievement, National Vocational Technical Honor Society, GPA 3.97-4.0

---

## Technical Skills

**Languages:** F#, C#, TypeScript, Python, Java/Scala, PowerShell, SQL, C++/CLI
**Platforms:** .NET 10, Kubernetes, Docker, Service Fabric, Knative, Istio, ArgoCD
**Data:** DBSP Z-sets, Apache Arrow, Solr, DuckDB, SQL Server, Oracle, Kafka, RabbitMQ
**Cloud:** Azure (AKS, Service Bus, Event Hubs, DevOps), AWS (EKS, SQS), GCP (GKE)
**Formal Methods:** TLA+, Lean 4, Alloy, Z3, FsCheck, Stryker
**IoT Protocols:** C12.22, C12.19, DLMS/COSEM, CoAP, OMA-DM, IPv6 RF-Mesh
**Security:** Quantum-resistant cryptography, HIPAA compliance, HSM key management
