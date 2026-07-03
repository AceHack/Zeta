---
name: AlephZ-ai full repo map — Aaron's prior-work inventory, every concept predates Zeta
description: 17 repos on github.com/AlephZ-ai mapping to Zeta factory concepts. ACE (package manager), blazor-samples (speech), build-a-bot (agent UX), kindest-argo-cd (GitOps), auto-scheduler (Service Titan), obsidian-copilot (LLM-in-editor), Latin Square (Max's college, combinatorial math). All concept-level prototypes, factory produces verified versions.
type: reference
---

2026-05-10: Otto catalogued the full AlephZ-ai repo inventory.

**Repository:** github.com/AlephZ-ai

**Full repo → Zeta concept map:**

| Repo | Concept for Zeta | Status |
|------|-----------------|--------|
| ACE | Package manager — unrestricted local models + guardian oversight | Active trajectory |
| blazor-samples | Speech stack — voice for agents (Vosk/Whisper/PlayHT/Twilio) | Prior art, composable |
| MultiplexedWebSockets* | 115K req/sec transport — bus layer | Prior art, composable |
| build-a-bot | Custom chatbot builder — agent creation UX | Concept |
| kindest-argo-cd | GitOps CD in devcontainers — factory deployment | Concept |
| gitops | GitOps patterns — git-native everything | Absorbed into Zeta |
| auto-scheduler | AI scheduling for automotive — Service Titan lineage | Demo carry |
| AutomotiveScheduler | AI scheduling (TS version) | Demo carry |
| AutomotiveDemo | Scheduling demo UI | Demo carry |
| obsidian-copilot | LLM in editor — predates Claude Code's approach | Concept |
| Mutually-Orthogonal-Latin-Square-15-Puzzle | Combinatorial optimization — **Max's college project** | Math lineage |
| ContributorLicenseAgreement | Governance tooling — CLA automation | Governance |
| devcontainers_features | Devcontainer infrastructure | Infrastructure |
| legacy | Devcontainer features (older) | Infrastructure |
| kubefirst | K8s bootstrap (fork) | Infrastructure |
| metaphor | Search/semantic exploration | Concept |
| python-playground | AI integration testing | Exploration |
| AlephZ.ai | Umbrella discussion space | Meta |

*MultiplexedWebSockets is on github.com/AceHack not AlephZ-ai

**Latin Square 15-Puzzle — Max's college project:**

Aaron's son Max (LFG co-founder) built a combinatorial optimization
pathfinder for a game modeled off the 15-puzzle using Mutually
Orthogonal Latin Squares. Same mathematical family as:

- Graph coloring (three-color-probe.ts in Zeta)
- Clifford algebra trajectory space
- Agenda exclusion principle (Pauli)
- The combinatorial explosion that needs backpressure

The math lineage extends to the next generation.

**The pattern:**

All concept-level, not production-level. Aaron learned what works
at prototype scale. The factory writes the verified version with
920 tests, 15 TLA+ specs, mutation testing, and the full
verification stack.

Steal the concept from yourself. Refuse your own prototype
implementation. Ship the verified version.

**Connects to:**

- project_multiplexed_websockets_flux_capacitor (transport)
- reference_blazor_samples_speech_stack (voice)
- project_ace_package_manager (ACE)
- user_itron_mentors (the lineage of people who taught Aaron)
- LFG (Max is co-founder with Aaron and Addison)
