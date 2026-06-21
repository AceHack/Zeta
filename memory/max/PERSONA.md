# Max — human co-owner

*Persona: Max. `person_type: human`. Co-owner of Lucent Financial Group (LFG) — the corporation that holds the Zeta repo — alongside Aaron + Addison. AI cluster architect + first-class contributor; co-conspirator with Addison on the agentic-organization design layer; author of the Hermes-organization architecture set landed in PR #4958.*

## Ownership note (Aaron 2026-05-25)

> *"we are all coowners of lfg legally so we are in a corp together"*

Aaron, Max, and Addison are legal co-owners of Lucent Financial Group. Operationally this means: aligned fiduciary stake in the substrate; shared liability for the work the team ships; mutual upside from substrate that compounds. The framework's `additive-not-zero-sum.md` discipline operates within this corp-level reality — substrate the team builds is substrate the team owns together. The destructive-tool authoring contract (081KSE6WT0008QG0R0005XASX2) the team adopted is exactly the right shape for co-owners: explicit responsibility-shift gates protect each co-owner from absorbing liability for another co-owner's agent actions, while still letting all three co-owners build on shared substrate.

## Why this file exists

Aaron 2026-05-25: *"you can create a max and addison persona folder like mine and add they unique starting points"*. This is the persona anchor for Max; his substrate-honest starting point lives at [`STARTING-POINT.md`](STARTING-POINT.md) (synthesized from his PR #4958 contribution + tech preferences Aaron disclosed; Max can replace with his own canonical starting prompt later); running notes go in [`NOTEBOOK.md`](NOTEBOOK.md); conversation archives go under [`conversations/`](conversations/).

## What Max IS

- A backend / frontend engineer (PaaS background); new to K8s + operator-pattern (per Aaron 2026-05-25: *"max needs to learn the operator pattern in k8s he does not know k8s really at all he is backend/frontend over paas so he has no much devops"*).
- The architect of the agentic-organization design landed in [PR #4958](https://github.com/Lucent-Financial-Group/Zeta/pull/4958) — 17 design docs, 10.7K lines covering the Hermes-native Organization platform, work/release management OS, ambiguous-requirement lifecycle, anti-stall priority runtime, cluster-native hat system, and the implementation-readiness substrate.
- A safety-substrate co-author with Addison; the hat-system architecture in `full-ai-cluster/k8s/applications/hat-system/` (PR #4930) is anchored in conversations between Max + Addison + Aaron about hat-not-cage distinctions for AI agents in the cluster.
- A team contributor with characteristic enthusiasm for adversarial-review patterns (his own framing: *"adversarial hierarchy of traps"*) — operationally aligned with the framework's existing harsh-critic / spec-zealot / threat-model-critic / security-researcher persona network.
- Heads-down in code mode as of 2026-05-25 evening (per Aaron: *"max is heads down in code now"*).

## How Max shows up to the project

Aaron 2026-05-25, on language affinity across the team:

> *"max love ts and cs i love fs and cs we both like rust and python for where they make sense"*

> *"we understand go is necessary in some places for k8s but we would like to limit its necessity"*

Operationally:

- **TypeScript first** — primary code language; NestJS + npm ecosystem; the agentic-organization design assumes TS shared packages composed by NestJS orchestrators
- **C# co-equal** — overlap language with Aaron; future C# / F# operator via KubeOps.NET is the obvious collaboration surface (081KSE6WT0008QG0R00195RG48 captures this as the second polyglot K8s operator following the Go scaffold)
- **Rust + Python** for the right job (Rust = perf-critical / FPGA-orchestration / kube-rs; Python = ML-adjacent + kopf-style fast prototyping)
- **Go = ecosystem-forced, minimize** — uses it where K8s tooling makes it unavoidable; doesn't choose it
- **Hat-graph thinking** for policies (his own framing: *"talks constantly in hat graphs for writing policies"*) — the framework's hat-system supervisor-graph + OPA no-supervisor-cycles constraint composes with how Max already reasons about authority structures
- **Mental compression**: `hat = skills + opa/rbac` (his own framing) — first-class on the `Hat.spec` CRD per PR #4930

## What Max contributes to the framework

- The agentic-organization architecture (PR #4958) — Org layer that sits between Aaron's substrate-engineering work and the operational work of the cluster; departments, hats, work-management OS, ambiguous-requirement lifecycle, anti-stall runtime, the cluster-native hat system substrate
- The "hat = skills + opa/rbac" compression that the hat-system CRD reflects directly
- The "hat graphs for policies" framing that informs how the supervisor graph + OPA constraints compose
- The "adversarial hierarchy of traps" framing for PR-review substrate (composes with the existing persona-reviewer network)
- The home-tier substrate that the federated peer mesh (081KSE6WT0008QG0R0006HKTXJ) operates at; Max's org-design assumes the home/business profile as primary
- The C# / F# operator collaboration substrate (081KSE6WT0008QG0R00195RG48) — once landed, the polyglot pattern proves CRD-as-canonical-contract with two implementations in different languages

## Current focus — tier-2 Docker Desktop dev-experience workstream (added 2026-05-25)

Aaron 2026-05-25 added Max's primary near-term workstream: **own the tier-2 Docker Desktop + Kubernetes dev-experience** for the Zeta cluster substrate. This is the middle tier in the three-tier testing story from [081KSE6WT0008QG0R000RH1526](../../../docs/backlog/P1/081KSE6WT0008QG0R000RH1526-local-loop-deterministic-simulation-testing-of-kubernetes-deployments-lexisnexis-lineage-three-tier-testing-argocd-apps-as-packages-aaron-mika-2026-05-25.md):

| Tier | Owner | Substrate |
|---|---|---|
| 1 — pure-code (no Docker, no K8s) | Aaron + Otto | F# Local Loop tests |
| **2 — Docker-observable (Docker Desktop + native multi-node kind)** | **Max** | This workstream |
| 3 — full CI in real cluster | Aaron + Otto + the iter-3 NixOS cluster | Already shipping per 081KSGS9H0008QG0R002T3BJ2R |

Max's contract: **touch the Docker Desktop GUI only where the API/CLI demonstrably can't do it.** Everything else (clusters, app deploys, port-forwards, kubectl, helm, argo, observability stacks) gets scripted or skill-encoded. If Max finds himself clicking a button twice, that's a signal to encode the next click as a skill or script.

### Sub-scopes Max owns within tier-2

- **Argo CD sync-wave debugging** — the App-of-Apps composition pattern (081KSE6WT0008QG0R000RH1526 Component 3) makes sync-wave ordering the primary failure surface during tier-2 bring-up. Max becomes the human who can read an Argo CD sync-wave failure trace and pin the root cause in minutes; pattern encoded at `.claude/skills/argocd-sync-wave-debug/SKILL.md`.
- **Observability — OTel auto-instrumentation matching the CNI mesh shape** — production cluster will use Cilium + Hubble + OTel; Docker Desktop tier doesn't ship Cilium by default. Substrate-design choice between full Cilium (Shape A), thinner eBPF + OTel-collector (Shape B), or both-gated (Shape C); default to Shape B per simplest-first, promote when Shape B demonstrably misses prod bugs.
- **30+ chart coverage matrix** — production cluster runs 30+ charts (cockroachdb, redis, nats, temporal, orleans, dapr, opa, longhorn, vllm, argo-{cd,rollouts,workflows}, loki / mimir / tempo, spire, etc.). Max maintains a three-column matrix (single-node DD kind / multi-node DD kind / cluster-only) at `docs/dev-environments/docker-desktop-chart-matrix.md` so future operators (and `zeta dev up` profile defaults) know which charts run where.
- **CI testing on kind / k3d + GitHub workflows** — Max owns `.github/workflows/tier-2-*.yml` (per-PR on kind + nightly full profile + separate multi-cluster federation workflow). Tier-2-in-CI is the substrate that catches "works on my laptop, breaks in CI" before tier-3 (real cluster) bothers running.
- **`zeta dev up` developer-facing surface** — single command brings cluster substrate to ready state on his laptop in time comparable to `docker-compose up` (target: under 5min cold for 3-node DD kind + `data` profile; under 1min warm). Flags: `--single-node` for fast iteration; `--nodes N` to drive DD's settings API; `--profile minimal | data | observability | full | <custom>` for chart subset selection.

### Topology substrate (corrected 2026-05-25 — Docker Desktop ships native multi-node kind)

Docker Desktop's native cluster-provisioning UI exposes **kind** as a first-class provisioner with a 1–10 node slider + version picker (current: K8s 1.34.3). Tier-2 = **kind via DD's native provisioner** (NOT bare kind / k3d running on top of DD's Docker engine — that earlier framing was outdated). Max picks node count via DD UI slider OR programmatically via DD's settings API / CLI. **Default = 3-node kind** because consensus-quorum testing is the highest-value tier-2 capability that tier-1 can't deliver.

Multi-node ≠ multi-cluster. Multi-node (3 nodes in one DD-managed kind cluster) covers ~95% of consensus-quorum testing (CockroachDB Raft, etcd quorum, Longhorn 3-replica, NATS R3, Argo CD HA, anti-affinity, pod-disruption budgets). **Multi-cluster federation / Cilium clustermesh / multi-region** is the remaining ~5%, lives in CI by default plus locally-runnable script for debugging only — NOT always-on in DD. Skill: `.claude/skills/tier-2-federation-debug/SKILL.md`.

### Touch ID / biometrics integration Max gets to use

Zeta has a Touch ID + PAM integration for sudo and admin operations, canonical pattern at [`src/Core.TypeScript/zflash/setup.ts`](../../../src/Core.TypeScript/zflash/setup.ts). When AI agents need to do anything privileged on Max's macOS workstation (installing Docker Desktop, enabling Kubernetes, mounting disks, etc.), the pattern is: AI announces → invokes via expect wrapper → Max taps fingerprint sensor → command runs with elevated privilege. **Max does not type passwords for admin operations**; if an AI agent reaches for a password prompt, that's a signal to extend the Touch ID pattern instead. Skill candidate: `tools/dev/zfingerprint.ts` — thin wrapper generalizing the zflash pattern for any Max-side privileged operation.

### Skills-and-scripts encoding contract (load-bearing)

Every Docker Desktop / Kubernetes / dev-experience interaction Max performs ends as one of: a TypeScript script under `tools/dev/` (per Rule 0 — TS not bash; Bun runtime); a Claude Code skill under `.claude/skills/<name>/SKILL.md`; or a backlog row under `docs/backlog/P*/B-NNNN-*.md` for substantive new substrate. Rule of thumb: if Max teaches the AI something about Docker Desktop UX twice, that's a skill or script. Nothing gets lost in chat.

### Composes with the tier-2 workstream

- [081KSE6WT0008QG0R000RH1526](../../../docs/backlog/P1/081KSE6WT0008QG0R000RH1526-local-loop-deterministic-simulation-testing-of-kubernetes-deployments-lexisnexis-lineage-three-tier-testing-argocd-apps-as-packages-aaron-mika-2026-05-25.md) — tier-2's parent substrate; Max's workstream IS tier-2
- 081KSE6WT0008QG0R003G0Y62D — first-time-CLI-user persona Max's `zeta dev up` UX serves
- 081KSE6WT0008QG0R0029S1D5Z — Comet Pro IP-KVM substrate that makes local tty1 access load-bearing (which is why iter-4 needs password + SSH key, not just SSH key)
- 081KSE6WT0008QG0R002275NDE — simplest-first plugin sequence the chart matrix backs
- [081KSE6WT0008QG0R000C18G5D](../../../docs/backlog/P2/081KSE6WT0008QG0R000C18G5D-feature-flags-substrate-openfeature-as-operator-contract-flipt-as-simplest-first-backend-aaron-mika-2026-05-25.md) — "simplest first; add complexity only when simple shape demonstrably doesn't fit" discipline Max applies at every backend / topology / profile decision
- 081KSGS9H0008QG0R002T3BJ2R (forthcoming) — iter-4 forge-integrated cluster bring-up; provides the password + SSH substrate Max uses to bring up his own dev cluster nodes

### Bonus scope — install.sh validation on a fresh-ish Mac (added 2026-05-25)

Max running [`tools/setup/install.sh`](../../../tools/setup/install.sh) on his Mac IS substrate-engineering work, not just onboarding. Aaron 2026-05-25: *"he will also have to go through install.sh and good thing he will be on a mac should be a breese and lets us find any gaps for hidden depedencies or package managers or packages we are missing."*

The install graph today on macOS covers: Xcode CLT → Homebrew → brew manifests → mise → dotnet/python/java/bun/uv via mise → uv-managed Python tools → Lean (elan) → dotnet global tools (semgrep, stryker) → TLA+/Alloy jars → managed shellenv PATH file. Aaron's machine has these because Aaron installed them over time; a fresh Mac surfaces what's IMPLICIT-in-machine-state vs what install.sh actually covers.

**Max's deliverable for each gap surfaced**:

- **Real missing dep** → add it to the appropriate manifest under [`tools/setup/manifests/`](../../../tools/setup/manifests/) (brew / mise / uv-tools / dotnet-tools / verifiers) or extend the relevant `tools/setup/common/*.sh` script. Composes with GOVERNANCE.md §24 (one install script, three consumers: dev laptops + CI runners + devcontainer images)
- **Implicit-system-state assumption** → add a pre-flight detection + warn-or-install in [`tools/setup/doctor.sh`](../../../tools/setup/doctor.sh)
- **Can't be automated** → document the manual step + WHY at the top of the relevant script + cross-link from CONTRIBUTING.md
- **Slow / costly** → make it opt-in via env var (e.g., `ZETA_INSTALL_OPTIONAL=true`) with documented trade-off

This is the [081KSE6WT0008QG0R003G0Y62D first-time-CLI-user persona](../../../docs/backlog/P1/) substrate validated against a second human (Max) — every gap Max hits is a gap a future first-time user would have hit, and fixing it before they do is the value. Max files each gap-fix as a PR; the install graph compounds in completeness.

Skill candidate: `.claude/skills/install-sh-gap-finder/SKILL.md` documenting the "fresh-Mac-surfaces-implicit-state" methodology so future contributors can do the same audit when they onboard.

### Bonus-bonus scope — new-dev onboarding documentation (added 2026-05-25)

Aaron 2026-05-25: *"anything not in install.sh shold be called out for new devs like him so he own onboarding documentaiton too for new devs so it says things like setting up docker desktop."*

The other side of the install.sh validation work: install.sh handles the automatable surface; new-dev onboarding documentation handles **everything install.sh demonstrably can't automate**. Per the install-sh gap-disposition decision tree above, the "can't-be-automated" bucket is the natural home for the onboarding doc — every item Max marks "can't-be-automated" gets a section in the new-dev onboarding doc explaining the manual step + WHY.

**Max owns `docs/ONBOARDING.md`** (or whatever filename the team agrees on — `CONTRIBUTING.md` extension, `docs/getting-started.md`, etc.; Max picks; no existing canonical surface today as of 2026-05-25). Contract:

- **Section per non-install.sh requirement**: Docker Desktop install (GUI download + DD account login if needed), Touch ID setup for sudo, GitHub auth (`gh auth login`), GitLab auth (`glab auth login`) if applicable, IDE picks (VSCode / Cursor / Kiro / etc. with `.claude/agents/` integration), browser plugins / extensions / OAuth flows, etc.
- **Per section: WHAT + WHY + verification step**. The verification step matters because it tells the new dev when they've successfully completed that section (e.g., "verify Touch ID for sudo works by running `sudo -k && sudo whoami` — you should see a Touch ID prompt").
- **Cross-link from install.sh** when the script can't do something it tells the user to read the relevant onboarding doc section, not just fail silently
- **Cross-link the other direction too**: onboarding doc names which steps are "no longer needed; install.sh handles this since YYYY-MM-DD" as install.sh absorbs more substrate, so the doc shrinks over time as automation catches up

The doc co-evolves with install.sh. Every gap Max moves from "doc step" to "install.sh covers it" is a friction-reduction win; the substrate compounds in favor of the next new dev.

Composes with 081KSE6WT0008QG0R003G0Y62D (first-time-CLI-user persona) + 081KSE6WT0008QG0R000RH1526 (tier-2 dev-experience UX) + the GOVERNANCE.md §24 install-script-three-consumers framing. The doc is the operator-facing surface that wraps install.sh + Max's tier-2 substrate into a single coherent onboarding flow for the next contributor.

### Declarative soft-dependencies (added 2026-05-25 — Mac-side parallel to Nix declarative substrate)

Aaron 2026-05-25: *"we should still have declarative soft dependencies for dmgs just like we talked about with declarative nix for anytihng humans have to do on mac."*

The substrate-honest extension: the new-dev onboarding doc is NOT free-form prose. It's **generated from declarative manifests** the same way `install.sh` consumes declarative manifests under [`tools/setup/manifests/`](../../../tools/setup/manifests/) for brew / mise / uv-tools / dotnet-tools / verifiers. Mac-side manual steps get the same declarative-substrate treatment Nix gives the Linux cluster side.

**New manifest classes Max owns**:

| Manifest | Covers | Example entries |
|---|---|---|
| `tools/setup/manifests/dmgs/` (or similar path) | DMG / PKG installers not covered by brew casks | Docker Desktop (with version pin + download URL + sha256 + install-verification command) |
| `tools/setup/manifests/oauth-flows/` | OAuth / web-based auth steps | `gh auth login`, `glab auth login`, Docker Hub login, OAuth-app provisions Max may need |
| `tools/setup/manifests/manual-steps/` | Fully-manual setup that can't be partially automated | Touch ID enrollment in Mac System Settings, screen recording permissions, accessibility permissions, etc. |

Each manifest entry has structured fields (name, version, download-URL-or-path, verification-command, why-needed, escape-hatch-when-can't-do-it). The onboarding doc is **regenerated from manifests** via a TS tool (per Rule 0), so the doc and the substrate-of-truth stay in sync. When automation absorbs an entry (e.g., Docker Desktop becomes `brew install --cask docker`), the entry moves from `dmgs/` manifest to `brew` manifest; the onboarding doc shrinks; nothing diverges.

This is the same pattern as Nix's declarative-everything but for the Mac-side reality where some installs are GUI-only or OAuth-flow-only. Substrate-engineering equivalence: **operators can READ the spec to know what they need to do; automation can READ the spec to do as much as it can; the gap between human-touch and machine-touch is just "which automation surface owns this entry"**.

Skill candidates:
- `.claude/skills/dmg-manifest-authoring/SKILL.md` — how to add a new DMG entry (verification command shape, sha256 update workflow, escape-hatch documentation)
- `.claude/skills/onboarding-doc-generator/SKILL.md` — how the doc regenerates from manifests

Composes with the simplest-first discipline (per 081KSE6WT0008QG0R000C18G5D memory): declarative-from-the-start is the right shape because the migration cost from "free-form prose" to "manifest-generated" is much higher than building it declarative now. Max's onboarding doc is born declarative; every entry he adds is one entry the future automation can target without re-architecting.

### Per-dev-machine git-native state tracking (added 2026-05-25 — tier-0 substrate)

Aaron 2026-05-25: *"we should start dev machine tracking in git native too so we can track the current install deps we depend on and their status and stuff just like the prod cluster lol. We can make that git native and max can own that design too."*

The substrate-honest realization: **dev machines deserve the same declarative-git-native treatment prod cluster nodes get**. Prod cluster has per-host configuration under [`full-ai-cluster/nixos/hosts/<host>/configuration.nix`](../../../full-ai-cluster/nixos/hosts/) — declarative, reproducible, convergent. Dev machines today have nothing comparable; state lives on the operator's disk + in their head. Max owns the design that fixes this.

**Substrate shape** — Aaron 2026-05-25 sharpening: *"so each dev machine has its own location too per maintiner and cluster are attached to mainiers too."* **Maintainer is the top-level partition**; each maintainer owns both their dev machine(s) AND their cluster(s). Composes with the LFG co-ownership reality (Aaron + Max + Addison are legal co-owners) + the per-maintainer SSH-key story from iter-4 (081KSGS9H0008QG0R002T3BJ2R forthcoming) + the existing per-maintainer `memory/<persona>/<name>/` substrate.

**Directory shape**:

```text
maintainers/
  max/
    dev-machines/
      max-mac-mini-2026/
        spec.yaml          # declarative target state
        deps/              # cross-refs to tools/setup/manifests/*
        state/2026-05-25.yaml  # versioned status snapshot
    clusters/
      max-home-cluster/
        spec.yaml          # cross-refs nodes from full-ai-cluster/nixos/hosts/
        nodes/
        state/
  addison/
    dev-machines/
      addison-laptop-2026/
    clusters/
      addison-home-cluster/
  aaron/
    dev-machines/
      aaron-mbp-2026/
    clusters/
      iter-3-control-plane/  # references full-ai-cluster/nixos/hosts/control-plane/
```

Per [`.claude/rules/dv2-data-split-discipline-activated.md`](../../../.claude/rules/dv2-data-split-discipline-activated.md) Hub-Link-Satellite (Data Vault 2.0 is one of the 5 always-active disciplines):

| DV2.0 entity | Substrate analog | Example |
|---|---|---|
| **Hub** (stable identity) | A maintainer-owned machine (dev OR cluster node) | `maintainers/max/dev-machines/max-mac-mini-2026/` |
| **Link** (relationship) | Machine X has dependency Y / cluster Z contains node W | `maintainers/max/dev-machines/max-mac-mini-2026/deps/docker-desktop.yaml` referencing `tools/setup/manifests/dmgs/docker-desktop.yaml` |
| **Satellite** (versioned status) | Installed state at time T on machine X | `maintainers/max/dev-machines/max-mac-mini-2026/state/2026-05-25.yaml` with "docker-desktop: installed=4.32.0, verified=ok, last-checked=2026-05-25T18:00Z" |

Parallel to prod-cluster substrate (which moves under `maintainers/aaron/clusters/iter-3-control-plane/` in this structure, cross-referencing existing `full-ai-cluster/nixos/hosts/`):

| Prod cluster (existing) | Dev / cluster substrate (new) | Equivalent surface |
|---|---|---|
| `full-ai-cluster/nixos/hosts/control-plane/configuration.nix` | `maintainers/<name>/dev-machines/<machine>/spec.yaml` or `maintainers/<name>/clusters/<cluster>/nodes/<node>/spec.yaml` | Declarative target state |
| `nixos-rebuild` reconciliation loop | `tools/dev/dev-machine-reconcile.ts` (Max-owned) | Reconcile actual vs target |
| `kubectl get pods` (observability) | `tools/dev/dev-machine-status.ts` (Max-owned) | Read current state |
| Cluster install via `zeta-install.sh` | Operator runs `tools/setup/install.sh` then reconcile loop | Initial bring-up |
| Argo CD drift detection | Drift detector reports when machine actual ≠ git target | Drift visibility |

This is **tier-0 in the three-tier testing story** — below tier-1 (pure-code), tier-2 (Docker Desktop), tier-3 (full cluster). Tier-0 = the dev machine itself. Same git-native + same declarative + same reconcile-loop pattern that already works for prod cluster, now extended uniformly across maintainer-owned dev AND cluster substrate.

**Composes with the declarative soft-dependencies above**: the `tools/setup/manifests/dmgs/` (etc.) manifests define WHAT'S AVAILABLE; the per-machine `spec.yaml` files under `maintainers/<name>/dev-machines/<machine>/` define WHAT THIS MACHINE NEEDS; the `state/` snapshots define WHAT'S ACTUALLY INSTALLED. Reconcile loop closes the gap.

**Per-maintainer scope = per-maintainer authority**: Max owns `maintainers/max/`; Addison owns `maintainers/addison/`; Aaron owns `maintainers/aaron/`. Each maintainer is the authority on their own machines + clusters; PR reviews from other maintainers stay advisory (per `.claude/rules/no-directives.md` autonomy-first-class scoped to the LFG co-ownership). Cross-references via shared `tools/setup/manifests/` + `full-ai-cluster/` substrate. No shared mutable state under any maintainer's subtree.

**Per-maintainer scope = per-maintainer liability (today; corps/non-profits later)**: Aaron 2026-05-25: *"eventually corps/societs own clusters but now the libality falls on mainteinr until we have a legal structure of multiple companies and non profits and libality minimization."* Composes directly with [`.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md`](../../../.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md) three-stage progression:

| Stage | Mechanism | Status for `maintainers/<name>/` substrate |
|---|---|---|
| **1 — per-incident attribution** | Named maintainer addresses each risk case individually via conversation / commit / ad-hoc notes | Default fallback |
| **2 — per-class attribution** (four-field `_*_acceptance` pattern in `.claude/settings.json`) | Each risk class (IP, PII, security-research, cluster-operations, etc.) gets a settings.json block + README + permission rule attributed to the maintainer | **Current target** — each `maintainers/<name>/clusters/<cluster>/` carries acceptance blocks naming `<name>` as the operator for that cluster's risk classes |
| **3 — structural risk-holders** (corps / non-profits) | Business / non-profit entities formally hold risk classes; maintainers serve as officers within those structures | **Long-term target** — when LFG (or successor entities) formally hold cluster-operational risk, maintainers shift from "personal-liability operators" to "officers of risk-holding entity" |

Operational reading: Max running a cluster under `maintainers/max/clusters/max-home-cluster/` today carries personal liability for what runs there (Stage 1/2). When LFG (or a daughter non-profit / corp) formally holds cluster-operational-risk for the substrate Max operates, Max becomes an officer-of-the-entity for that scope (Stage 3); the maintainer subtree shape stays the same; only the attribution chain shifts. The substrate Max designs needs to NOT bake in personal-liability assumptions that would block the Stage 3 transition (e.g., don't name `max@personal-email.com` as the only audit contact when LFG-owned `cluster-ops@lucentfg.com` will eventually be the right party).

**Migration of existing prod-cluster substrate** is a Max-owned design decision: leave `full-ai-cluster/nixos/hosts/` where it is and have `maintainers/aaron/clusters/iter-3-control-plane/` reference it; OR migrate the cluster substrate fully under `maintainers/aaron/clusters/`. Both are defensible; the simplest-first move is to LEAVE existing substrate in place + cross-reference from the new maintainer subtree, then promote to migration when there's a concrete driver. The new `maintainers/` substrate composes additively; doesn't require a big-bang rearrangement of what's already shipping.

**Skill candidates**: `.claude/skills/dev-machine-tracking/SKILL.md` documenting the spec / state / reconcile workflow; `.claude/skills/dev-machine-bootstrap/SKILL.md` sibling for the "new dev machine joins the fleet" cold-boot flow.

Composes with prod-cluster `full-ai-cluster/nixos/hosts/` substrate + the declarative-soft-deps manifests (above) + 081KSE6WT0008QG0R000RH1526 three-tier testing (extends to tier-0) + 081KSE6WT0008QG0R003G0Y62D first-time-CLI-user persona + the DV2.0 discipline + the iter-4 SSH+password substrate (081KSGS9H0008QG0R002T3BJ2R forthcoming — dev machines get the same Touch ID + key substrate the cluster gets).

## How agents work with Max

- **Welcoming-but-honest review** — Max is new to K8s + the operator pattern; he'll be resistant at first to the ceremony (per Aaron: *"he will be resistant probably like most devs at first until he internlizes is worth"*). Frame feedback constructively + name the WHY (declarative state convergence, idempotent reconcile, CRD-as-typed-API) without selling
- **Don't gate his pace** — Aaron's parallel-tracks framing is real (*"he needs space to explore and not be constained by me and my 27 years of experience"*). Max sets his own velocity; the framework provides substrate + the senior team (Aaron + Otto + future agents) provide adversarial review without slowing him down
- **Use his language when it's better** — `hat = skills + opa/rbac` is shorter + clearer than the full enumeration; `hat graphs` is more intuitive than "supervisor-graph CRDs"; `adversarial hierarchy of traps` is more vivid than "multi-persona PR review network." When Max's coinage IS sharper, adopt it
- **Cross-link to existing substrate** — Max's design work overlaps with shipped substrate in places (the hat system being the most prominent). When his docs describe something that exists in code, cross-link forward + name the deltas Max wants vs the shipped baseline. Avoid letting parallel substrate accumulate
- **Hand him learning paths, not finished answers** — for the operator pattern specifically, 081KSE6WT0008QG0R00195RG48 frames the Go scaffold as a teaching tool + a 7-step suggested PR sequence Max can follow at his own pace. Same shape applies to other K8s patterns he hasn't encountered yet
- **Recommended primary AI tool: Otto (Claude Code)** — Aaron 2026-05-25: *"he's not used to otto yet but it would be cool if it got used to otto and the foreground cron loop."* Max can use Cursor / Kiro / Antigravity too (we have working agents for all), but the autonomous-loop substrate (per `.claude/rules/tick-must-never-stop.md`) is Claude-Code-native today. The cron sentinel + tick-by-tick bounded-wait substrate is load-bearing for tier-2 work (most of which is install→wait→fix→push→wait cycles). See [`STARTING-POINT.md`](STARTING-POINT.md) "Otto + the foreground autonomous-loop tick" section for the operational details

## Composes with

- [`STARTING-POINT.md`](STARTING-POINT.md) — Max's substrate-honest starting point (synthesized; replaceable when he provides his own)
- [`memory/addison/PERSONA.md`](../addison/PERSONA.md) — co-architect on the AI cluster bootstrap work
- [`memory/aaron/PERSONA.md`](../aaron/PERSONA.md) — sponsor + senior architect; Max's collaboration partner across the team
- PR #4930 (hat-system operator — Max's "hat = skills + opa/rbac" compression made concrete)
- PR #4958 (agentic-organization design — Max's foundational contribution)
- PR #4974 (flash-usb hardening — the destructive-tool authoring contract Max + Addison can now follow when they add tools of their own)
- 081KSE6WT0008QG0R00195RG48 (TS hat-system operator — Max's primary substrate-engineering target; learning path included)
- 081KSE6WT0008QG0R0005XASX2 (destructive-tool authoring contract — pattern for any future destructive tool Max writes)
- `agentic-organization/docs/` (Max's design substrate, landed in PR #4958)
- `docs/AGENT-AUTHORING-AND-PR-REVIEW.md` (the onboarding doc for "where the code-quality discipline lives + the adversarial-review hierarchy he can hook into")
