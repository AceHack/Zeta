---
id: 081KSKBP80008QG0R002VRN56K
priority: P1
status: open
title: zeta-install.sh → `ace install zeta` migration trajectory — declarative `package.json`-style Ace manifest in Zeta repo (like `../scratch` and `../SQLSharp` already do); composes with 081KR2E4K0008QG0R002YE3MMD Ace CLI + 081KSGS9H0008QG0R0031PBNGA meta-PM + 081KSGS9H0008QG0R003A37Z65 ArgoCD-maximization + 081KSE6WT0008QG0R000YYH3DY distributable-POC pattern (Aaron 2026-05-27)
effort: L
ask: aaron 2026-05-27
created: 2026-05-27
last_updated: 2026-05-27
depends_on:
  - 081KR2E4K0008QG0R002YE3MMD
composes_with:
  - 081KSGS9H0008QG0R0031PBNGA
  - 081KSGS9H0008QG0R003A37Z65
  - 081KSE6WT0008QG0R000YYH3DY
  - 081KSGS9H0008QG0R00367G209
  - 081KSGS9H0008QG0R0018ES3R4
  - 081KSE6WT0008QG0R000JSJ3SR
  - 081KQZVQW0008QG0R000ZHEN62
  - 081KSKBP80008QG0R003AX2A69
  - 081KSKBP80008QG0R000Y2B7HC
tags: [ace-package-manager, zeta-on-ace, declarative-install, migration-trajectory, package-json, bunfig, install-graph, zeta-install-sh-replacement, scratch-sqlsharp-pattern, bootstrap-substrate]
---

## Operator framing (Aaron 2026-05-27)

> *"are we still using zeta-install instead of install.sh can we move closer to that?"*
>
> (clarification) *"not zeta-install rename i mean using ace package manager that is the start like ../scratch and ../SQLSharp"*
>
> *"we just spoke about this earlier i thihnk you backloged some stuff"*

Aaron is naming the trajectory from imperative-bash-installer (`zeta-install.sh`) toward declarative-package-manager-driven install (`ace install zeta`). Reference projects already operating this way in adjacent directories on the operator's machine:

- `../scratch/` — has `package.json` + `bun.lock` + `bunfig.toml`; `bun` + Bun-as-package-manager toolchain
- `../SQLSharp/` — has `package.json` + `bunfig.toml` + `Directory.Build.props` + `global.json` + `tsconfig.json`; multi-toolchain declarative manifest

The substrate-engineering shape: Zeta should have an equivalent declarative manifest (Ace package shape) so `ace install zeta` is the canonical install path, with `zeta-install.sh` becoming a thin bootstrap (or eventually retiring entirely).

## What "backlogged some stuff" refers to

Aaron's memory is correct about the BROADER Ace cluster being backlogged. The specific "zeta installs itself via ace install zeta" migration was NOT yet filed as its own row. Existing cluster substrate this row composes with:

- **081KR2E4K0008QG0R002YE3MMD** (parent) — Ace DLC package manager CLI; status: in-progress; provides `ace install <pkg>` primitive
- **081KSGS9H0008QG0R0031PBNGA** — Ace as package-manager-of-package-managers; N-D dependency space; generate+join paradigm
- **081KSGS9H0008QG0R003A37Z65** — Architectural principle: maximize ArgoCD scope; minimize NixOS native lock-in (this migration IS that principle applied to install scope)
- **081KSE6WT0008QG0R000YYH3DY** — k8s-local-stack as Ace's distributable POC; hats-as-negotiated-fork-structure
- **081KSGS9H0008QG0R00367G209** — Zeta as dependency-graph + variable-passing layer on top of Helm
- **081KSGS9H0008QG0R0018ES3R4** — diamond-resolution-namespace-cardinality (multi-tenant 3rd dimension of dep-resolution)
- **081KSE6WT0008QG0R000JSJ3SR** — industry-sharp-categories + per-persona ontology + Ace negotiation
- **081KQZVQW0008QG0R000ZHEN62** — original Ace lineage row
- `docs/agendas/ace-package-manager/AGENDA.md` — 13-stage lifecycle (OPERATOR-SELF-CLAIMED 2026-05-22)
- `docs/trajectories/ace-package-manager-skill-crystallization-pipeline/RESUME.md`

This row is the OPERATIONAL bridge between "Ace exists as a CLI" (081KR2E4K0008QG0R002YE3MMD) + "Ace as meta-architecture" (081KSGS9H0008QG0R0031PBNGA) and "Ace can install Zeta itself" (this row). Without it, the Ace cluster builds primitives but doesn't dogfood them at the bootstrap scope.

## Reference shape from `../scratch` and `../SQLSharp`

What those projects ship that Zeta should mirror:

```json
{
  "name": "...",
  "private": true,
  "type": "module",
  "packageManager": "bun@1.3.12",
  "engines": { "bun": ">=1.3.12" },
  "scripts": {
    "setup:powershell": "...",
    "test:docker": "bun run scripts/test/...",
    "lint:typescript": "bunx eslint scripts/**/*.ts",
    "typecheck:typescript": "tsc --noEmit"
  }
}
```

Plus:

- `bun.lock` — pinned dependency lockfile
- `bunfig.toml` — Bun configuration
- `Directory.Build.props` / `global.json` — .NET coordination (SQLSharp only; not all manifests need this)

The declarative manifest names: package name + package manager + engine constraints + scripts (commands). Install is then `bun install` (for deps) + `bun run <script>` (for operations).

## Migration trajectory (5 phases)

### Phase 0 — Inventory + manifest design (THIS ROW; smallest substrate slice)

- Document existing `zeta-install.sh` step-by-step state-machine
- Identify which steps are pure-Nix (delegate to flake), which are imperative-bash (translate to Ace package scripts), which are operator-prompted (translate to Ace manifest options)
- Design Zeta's Ace manifest shape (likely `ace.yaml` or `ace-package.json` or similar)
- Identify dependency on 081KR2E4K0008QG0R002YE3MMD features (which CLI commands must exist for the manifest to work)
- File sub-row plan for Phase 1+

### Phase 1 — Add manifest stub to Zeta repo

- `package.json` at Zeta repo root with `"packageManager": "bun@...", "engines": { "bun": ">=..." }, "scripts": { ... }` (mirrors `../scratch` shape)
- `bunfig.toml` for Bun-specific config
- `bun.lock` pinned
- Initial scripts: `test`, `lint`, `typecheck`, `bootstrap` (calling existing tools)
- Does NOT replace `zeta-install.sh` yet; coexists as declarative-substrate marker

### Phase 2 — `ace.yaml` (or equivalent) Ace-package manifest

- Defines Zeta as an Ace package (name, version, dependencies, install-steps, post-install)
- Install-steps reference the existing `zeta-install.sh` step-state-machine but EXPRESSED DECLARATIVELY
- 081KR2E4K0008QG0R002YE3MMD CLI must support whatever this manifest needs

### Phase 3 — `ace install zeta` works from a fresh USB

- Live USB boots → Ace CLI present in live overlay → `ace install zeta` runs the declarative install
- Existing `zeta-install.sh` becomes a thin bootstrap that does `curl ... | ace install zeta` OR `nix run github:.../ace -- install zeta`
- Composes with 081KSKBP80008QG0R003AX2A69 (cred persistence) + 081KSKBP80008QG0R000Y2B7HC (sigstore verify of the Ace-fetched manifest)

### Phase 4 — `zeta-install.sh` retires

- All install logic now in declarative manifests + Ace CLI
- `zeta-install.sh` either deleted OR reduced to "exec ace install zeta with these env vars"
- Per Rule 0 (`.claude/rules/rule-0-no-sh-files.md`) — preserves the install-graph carve-out shape, just shrinks it

### Phase 5 — Zeta as distributable Ace POC (compose with 081KSE6WT0008QG0R000YYH3DY)

- Zeta becomes the second canonical "Ace distributes this" example (k8s-local-stack is 081KSE6WT0008QG0R000YYH3DY's named first POC)
- Validates Ace's distributability at substrate-engineering scope; dogfooding loop closes

## Sub-rows to file when implementing

- 081KSKBP80008QG0R002VRN56K.1 — `zeta-install.sh` step-state-machine inventory + declarative-conversion gap analysis
- 081KSKBP80008QG0R002VRN56K.2 — `package.json` + `bunfig.toml` + `bun.lock` stub at Zeta repo root (Phase 1 ship)
- 081KSKBP80008QG0R002VRN56K.3 — Ace manifest schema design (collaborate with 081KR2E4K0008QG0R002YE3MMD implementation; what's the manifest shape?)
- 081KSKBP80008QG0R002VRN56K.4 — `ace.yaml` (or equivalent) for Zeta at repo root
- 081KSKBP80008QG0R002VRN56K.5 — live-USB Ace bootstrap (Ace CLI present before zeta install runs)
- 081KSKBP80008QG0R002VRN56K.6 — `ace install zeta` smoke test against fresh USB + fresh PC
- 081KSKBP80008QG0R002VRN56K.7 — `zeta-install.sh` reduction to thin-bootstrap wrapper
- 081KSKBP80008QG0R002VRN56K.8 — `zeta-install.sh` full retirement (substrate-honest about Rule 0 carve-out shrink)
- 081KSKBP80008QG0R002VRN56K.9 — substrate landing memo + Ace agenda update + 081KSE6WT0008QG0R000YYH3DY-style "Zeta is Ace POC #2" note

Order suggestion: 0 → 1 → 2 (foundational; Phase 0 + Phase 1 = smallest substrate slice; closes the loop with operator); 3 → 4 (schema + manifest); 5 → 6 (end-to-end USB test); 7 → 8 (zeta-install.sh retirement); 9 (substrate landing).

## What this is NOT

- NOT a Rule 0 violation — install-graph carve-out preserved; Phase 4 may eventually delete `zeta-install.sh` but only AFTER `ace install zeta` is the canonical entrypoint
- NOT a 081KR2E4K0008QG0R002YE3MMD replacement — this row consumes 081KR2E4K0008QG0R002YE3MMD's CLI primitive; doesn't compete with it
- NOT a near-term operational change to current `zeta-install.sh` — that file continues working through Phases 0-3
- NOT a commitment to a specific manifest schema today — Phase 0 designs it; Phase 1+ implements

## Composes with

- **081KR2E4K0008QG0R002YE3MMD** (parent dep) — provides `ace install <pkg>` primitive this row consumes
- **081KSGS9H0008QG0R0031PBNGA** — meta-PM architecture; this row dogfoods at bootstrap scope
- **081KSGS9H0008QG0R003A37Z65** — minimize NixOS native lock-in; declarative-Ace-manifest reduces NixOS-specific surface
- **081KSE6WT0008QG0R000YYH3DY** — Ace's distributable POC pattern; Zeta becomes POC #2
- **081KSGS9H0008QG0R00367G209** — Zeta-as-dependency-graph-on-Helm; this row extends the dependency-graph thinking to install-graph
- **081KSGS9H0008QG0R0018ES3R4** — diamond-resolution-namespace-cardinality; multi-tenant install dimensions
- **081KSE6WT0008QG0R000JSJ3SR** — industry-sharp-categories + Ace negotiation; manifest schema design surface
- **081KQZVQW0008QG0R000ZHEN62** — original Ace lineage
- **081KSKBP80008QG0R003AX2A69** — cred persistence; composes at first-boot scope (Ace-driven install respects the same cred-persistence flow)
- **081KSKBP80008QG0R000Y2B7HC** — sigstore artifact signing; composes at manifest-fetch scope (Ace verifies the manifest's signature before installing)
- `docs/agendas/ace-package-manager/AGENDA.md` — operator-self-claimed 13-stage lifecycle
- `docs/trajectories/ace-package-manager-skill-crystallization-pipeline/RESUME.md`
- `.claude/rules/rule-0-no-sh-files.md` — install-graph carve-out preserved

## Composes with substrate

- `../scratch/` reference pattern (operator-machine sibling project; declarative Bun-based manifest)
- `../SQLSharp/` reference pattern (operator-machine sibling project; multi-toolchain declarative manifest)
- Memory: `user_trinity_of_repos_emerged_zeta_forge_ace_three_in_one.md` (Aaron's prior framing of Zeta + Forge + Ace as related)
- Memory: `feedback_ts_dependencies_as_interface_di_pattern_sqlsharp_anchor_aaron_2026_05_01.md` (SQLSharp anchor for TS-DI pattern)

## Why P1

- Operator explicitly named the trajectory + the reference shape (`../scratch`, `../SQLSharp`)
- Composes with substantial existing Ace cluster substrate (081KR2E4K0008QG0R002YE3MMD + 0824 + 0816 + 0742 + 0777 + 0821 + 0822 + 0247)
- Bounded scope (Phase 0 + Phase 1 is the smallest substrate slice; can ship in 1-2 rounds)
- Dogfooding: closes the "Ace exists as CLI" → "Ace installs Zeta itself" loop
- Self-sustaining cluster substrate (081KSKBP80008QG0R003AX2A69 family) composes naturally on top of Ace-driven install

## Substrate-honest framing

This row is the OPERATIONAL bridge between existing Ace primitives + Aaron's named trajectory. It does NOT:

- Re-engineer Ace itself (081KR2E4K0008QG0R002YE3MMD + 081KSGS9H0008QG0R0031PBNGA do that)
- Commit to a specific manifest schema today (Phase 0 designs it deliberately)
- Force migration on a specific timeline (Phases 0-1 are the immediate slice; later phases ship as Ace + Zeta substrate matures)

It DOES:

- Name the trajectory explicitly so future-Otto cold-boots see the migration as substrate-engineering target
- Provide Phase 0/Phase 1 as smallest concrete substrate (manifest stub like `../scratch`)
- Compose with the broader Ace cluster (this is a USE of Ace, not a competing architecture)
- Honor Aaron's "we just spoke about this earlier" via explicit composes_with chain back to the prior substrate

## Full reasoning

Aaron 2026-05-27 conversation arc (verbatim):

1. *"are we still using zeta-install instead of install.sh can we move closer to that?"* (question)
2. *"not zeta-install rename i mean using ace package manager that is the start like ../scratch and ../SQLSharp"* (clarification)
3. *"we just spoke about this earlier i thihnk you backloged some stuff"* (reference to broader Ace cluster substrate)

Substrate-inventory pass (per `.claude/rules/verify-existing-substrate-before-authoring.md`):

- Topic: zeta install via ace / ace install zeta / declarative install manifest / scratch + SQLSharp pattern
- Searched: docs/backlog/ (081KR2E4K0008QG0R002YE3MMD / 0742 / 0777 / 0816 / 0821 / 0822 / 0824 / 0247 = existing Ace cluster); docs/agendas/ace-package-manager/ (13-stage lifecycle); docs/trajectories/ace-package-manager-skill-crystallization-pipeline/; memory/ (Trinity-of-repos + TS-DI-SQLSharp-anchor)
- Found: existing Ace cluster covers the architecture + the CLI but does NOT explicitly name "Zeta installs itself via Ace" migration
- Conclusion: this row is the OPERATIONAL bridge; composes with existing substrate; not redundant; bounded scope
