---
id: B-0740
priority: P2
status: open
created: 2026-05-25
last_updated: 2026-05-25
title: ACE Package Manager — PM-of-PMs umbrella; declarative multi-package-manager convergence (apt + brew + cask + choco + winget + dotnet-tools + workloads + uv-tools + bun-global + windows-powershell + vsconfig + nix + mise + …); build-time-vs-runtime deps distinction; package ontology categorization; Windows .ps1 entry; integrate ../scratch April-2026 cross-platform-bootstrap patterns; documents the manual-DMG/cask gap on macOS
domain: ops-tooling
ferried_by: aaron
owners: [aaron, max, addison]
composes_with:
  - B-0737
  - B-0738
  - B-0739
  - B-0731
related_substrate:
  - tools/setup/install.sh
  - tools/setup/macos.sh
  - tools/setup/linux.sh
  - tools/setup/manifests/
tags: [ace-package-manager, ace-pm, pm-of-pms, declarative-deps, multi-package-manager-convergence, build-time-vs-runtime-deps, package-ontology, dmg-cask-gap, windows-ps1, scratch-pattern-integration, cross-platform-bootstrap, hat-ontology-composes]
---

# B-0740 — ACE Package Manager (PM-of-PMs)

## Carved blade

> **ACE Package Manager is the package manager of package managers** — a declarative-convergence + ontology-categorization layer that unifies brew + apt + cask + choco + winget + dotnet-tools + workloads + uv-tools + bun-global + windows-powershell + vsconfig + nix + mise + everything else into a single substrate where: (a) each PACKAGE has an explicit ONTOLOGY CATEGORY (build-time vs runtime, cli vs library vs daemon, dev vs prod, fleet-shared vs personal); (b) each TARGET (Mac dev laptop / Linux dev laptop / Windows dev laptop / CI runner / devcontainer / cluster node / etc.) declaratively lists which categories it needs; (c) each PACKAGE MANAGER is a backend that ACE PM dispatches to. The current Zeta substrate has the skeleton (`tools/setup/install.sh` + `macos.sh` + `linux.sh` + thin manifests) but lacks categories, profiles, casks (the DMG gap on Mac), Windows `.ps1`, build-time-vs-runtime split, and explicit ontology — all of which ALREADY EXIST in Aaron's April-2026 `../scratch/` cross-platform-bootstrap experiment + need integration. `.sh` is the install-graph language per Rule 0 (meets the developer where they live); `.ps1` is the missing Windows equivalent.

## Origin

Aaron 2026-05-25, after B-0737 + B-0738 + B-0739 shipped:

> *"also i had to install some dmg stuff manually i think and it depends on roslyn 2 maybe for build not sure how much it matters when we download iso so iso vs builld time deps tracking to our dev deps use like install.sh and delcarative dependencies like many different package managers we converge them that's also part of ace pacake manger the package manager of package manager and the ontology catagorization point of packages themself, .sh is to meet the devleoper where they live we need .ps1 for windows but we don't have yet ../scratch has these patterns. we have some too."*

Naming substrate-anchor: **ACE Package Manager** was first surfaced in the 2026-05-25 Mika voice conversation (segment 1) as `ACE Package Manager: Hat Ontology Agreement` runbook — see [`memory/persona/mika/conversations/2026-05-25-aaron-mika-grok-runbooks-as-executable-reality-...md`](../../../memory/persona/mika/conversations/2026-05-25-aaron-mika-grok-runbooks-as-executable-reality-hat-ontology-top-down-vs-bottom-up-play-doh-leverage-class-universal-protocol-markdown-plus-runme-plus-continue-with-mcp-wrap-ai-agency-stack-crystal-ball-plus-runbook-plus-glass-halo.md). The hat-ontology row B-0731 also lives inside the ACE PM scope. This row carves out the **dep + install + ontology substrate** sub-area of ACE PM as its own backlog item.

## Reconnaissance — `../scratch/` April-2026 experiment

Aaron's `../scratch/` directory (outside the Zeta repo; sibling of it) contains a cross-platform-bootstrap harness with patterns this row proposes integrating into Zeta. Snapshot:

### `../scratch/declarative/` (per-package-manager declarative manifests)

| Subdir | Manifests |
|---|---|
| `debian/apt/` | `bootstrap.apt` + `min.apt` + `all.apt` + `cli.apt` + `native-build.apt` + `database.apt` + `quality.apt` + `runner.apt` |
| `unix/brew/` | `*.Brewfile` per category |
| `macos/brew/` | `*.Brewfile` per category (macOS-specific brews on top of unix) |
| `macos/cask/` | `*.Caskfile` — **the DMG/installer gap on macOS** (cask is what installs apps that ship as .dmg/.pkg) |
| `dotnet/tools/` | `*.dotnet-tools` per category |
| `dotnet/workloads/` | `*.dotnet-workloads` per category |
| `python/tools/` | `*.uv-tools` per category |
| `bun/global/` | `*.bun-global` per category |
| `windows/choco/` | `*.choco` per category |
| `windows/powershell/` | `*.psd1` per category |
| `windows/vs/` | `*.vsconfig` (Visual Studio component selection) |

### `../scratch/scripts/setup/` (entrypoints + per-platform paths)

- `scripts/setup/ubuntu/bootstrap.sh` (Linux entrypoint)
- `scripts/setup/ubuntu/wsl.sh` (WSL-specific extras)
- `scripts/setup/macos/bootstrap.sh` (Mac entrypoint)
- **`scripts/setup/windows/bootstrap.ps1` (the Windows .ps1 Zeta doesn't have yet!)**
- `scripts/setup/PLATFORM_PARITY.md` (cross-platform parity inventory)
- `scripts/setup/DEPENDENCIES.md` (category intent documentation)

### Profile + category model

- `BOOTSTRAP_MODE=minimum` (default fast path) | `BOOTSTRAP_MODE=all` (broader toolchain)
- `BOOTSTRAP_CATEGORIES="quality database"` orthogonal category additions on top of either profile
- Categories: `cli` / `native-build` / `database` / `quality` / `runner` (Linux-runner-style extras)

### Idempotency + tests

- Bootstrap is idempotent; tests run it twice
- Second run updates without re-downloading
- Compact mode opts in for cache/temp cleanup
- `scripts/test/run-shellcheck.ts` + `scripts/test/run-script-boundary-lint.ts`

## Gap analysis — Zeta current vs ACE PM target

| Substrate area | Zeta today | Scratch April-2026 | ACE PM target |
|---|---|---|---|
| Platform entrypoints | `install.sh` + `macos.sh` + `linux.sh` | Same shape + `windows/bootstrap.ps1` | Add Windows entry (composes with B-0739) |
| Per-PM manifests | `manifests/{apt,brew,dotnet-tools,uv-tools,verifiers}` (5 PMs) | 11 PMs as listed above | Lift the additional 6 PMs (cask, choco, windows-powershell, vsconfig, bun-global, dotnet-workloads) |
| Categories | None | 5 (`cli` / `native-build` / `database` / `quality` / `runner`) | Lift categories + add ACE PM-specific (e.g., `build-time` / `runtime`) |
| Profiles | None | 2 (`minimum` / `all`) | Lift profiles + add ACE PM-specific (e.g., `cluster-node` / `dev-laptop` / `ci-runner`) |
| Cask / DMG | None (the manual-DMG gap Aaron named) | `declarative/macos/cask/*.Caskfile` | Lift cask substrate + integrate into macos.sh |
| Build-time vs runtime | Implicit (none distinguished) | Implicit (categories serve this in part) | Make EXPLICIT — first-class field on every package declaration |
| Package ontology | None | None (category-level only) | NEW substrate-engineering target: structured ontology per package (what KIND; what FOR; constraints) |
| Platform parity inventory | None | `PLATFORM_PARITY.md` | Lift |
| Dependency intent docs | None | `DEPENDENCIES.md` | Lift |
| Idempotency tests | CI gate runs install.sh twice (per install.sh header) | Same | Already there |
| Shellenv fanout | `common/shellenv.sh` (one managed file) | One managed file + fanout to multiple shell rc files | Lift fanout pattern |
| `.ps1` substrate | None | `scripts/setup/windows/bootstrap.ps1` + `*.psd1` manifests | Lift; aligns with B-0739 Path B PowerShell-native |
| Brewfile-Ruby composition | Manifest is plain list | Brewfile uses Ruby evaluation for category composition (no list duplication) | Lift |

## What ACE PM IS (substrate-engineering target)

### Layer 1 — Declarative package manifests (per-PM, per-category, per-profile)

- Each package declared once, in its native PM format (Brewfile / apt / cask / choco / etc.)
- Manifests organized by category × platform × PM
- Categories orthogonal + composable
- Profiles aggregate categories

### Layer 2 — Build-time vs runtime distinction (NEW substrate-engineering target)

- Every package carries an explicit attribute: `build-time` (needed to BUILD code/ISO/binary) vs `runtime` (needed to RUN at flash/install/dev time) vs `both`
- Critical because: when you DOWNLOAD the ISO from CI workflow, you skip build-time deps. When you BUILD locally, you need them.
- Aaron's Roslyn example: Roslyn is `build-time` for the C# compiler chain; if you only consume artifacts (download the ISO), you don't need it
- This is what makes ISO-builds shipable to operators without forcing them to install the full build toolchain

### Layer 3 — Package ontology categorization (NEW substrate-engineering target)

- Each package gets a structured ontology entry beyond "category"
- Fields proposed (substrate-honest scoping; design pass needed):
  - `kind`: `cli-tool` / `library` / `daemon` / `editor-plugin` / `font` / `vm-image` / `language-runtime` / `compiler` / `verifier` / `package-manager-itself`
  - `purpose`: free-text intent ("Lean theorem prover for B-XXX work"; "TLA+ specs for B-YYY verification")
  - `scope`: `fleet-shared` (everyone needs) / `personal` (per-operator preference) / `per-machine-role` (only on certain node types)
  - `lifecycle`: `build-time` / `runtime` / `both` / `dev-only` / `prod-runtime`
  - `installable-via`: list of PMs that can supply it (brew, cask, mise, nix, dotnet-tool, etc.)
  - `composes_with`: backlog rows that depend on this package
- Enables substrate queries: "which packages are needed to flash the Mac variant?" / "what does the Windows runtime-only profile look like?" / "which packages are pure dev experience, not shipped to cluster nodes?"

### Layer 4 — PM-of-PMs dispatch logic

- ACE PM as the unifying frontend
- Reads ontology + target manifest
- Dispatches to the right backend PM(s) for each package
- Handles conflict resolution (same package available via multiple PMs — pick one; e.g., bun via mise vs npm vs system package)
- Tracks installed state per-target across PM boundaries

### Layer 5 — Cross-platform parity tracking

- `PLATFORM_PARITY.md` (lifted from scratch + extended)
- Lists every category × every platform × current status (shipped / partial / missing)
- Source of truth for "which platforms are first-class for which categories"

### Layer 6 — Hat ontology integration (B-0731 composes here)

- Hats per B-0731 are roles + authority + delegation
- Package categories per ACE PM are dependencies + capabilities
- A hat declares what packages it needs to operate
- ACE PM ensures the wearing-agent has the packages installed before allowing the hat-binding
- Closes the loop: "this agent wants hat X; ACE PM verifies the package substrate; hat binding succeeds"

## Aaron's specific gaps surfaced today

### Gap 1 — Manual DMG installs (Determinate Systems Nix Installer + cask substrate missing)

Aaron 2026-05-25: *"i had to install some dmg stuff manually i think"* → clarified same day: *"it was someting for nix deterministic someting we had to install the dmg"* → **Determinate Systems Nix Installer for macOS** (the DMG/pkg from <https://determinate.systems/posts/determinate-nix-installer/>).

Substrate-honest analysis:

- **Nix CANNOT be installed via Homebrew/mise cleanly** because Nix needs a multi-user daemon (`nix-daemon`) + `/nix` volume mount + system-launchd configuration. The Determinate Systems installer is the canonical Mac install path (officially supported; substantially cleaner than the official Nix installer; handles the macOS APFS volume creation + launchd setup).
- **Our CI already uses Determinate Systems Nix** via `DeterminateSystems/nix-installer-action@ef8a14...` in `.github/workflows/build-installer-iso.yml` + `build-ai-cluster-iso.yml` (both on `ubuntu-24.04` runners; same installer also targets macOS).
- **Local dev gap**: `tools/setup/macos.sh` doesn't invoke the Determinate Systems installer. CI does it transparently; local dev requires manual DMG/pkg download. That's why Aaron had to install it by hand.

Concrete ACE PM-style ontology entry (illustrative; design pass needed for the actual schema):

```yaml
package: determinate-nix
kind: package-manager-itself   # Nix is a PM; this is "PM of PM" recursion
purpose: Deterministic build substrate; powers full-ai-cluster/flake.nix + cluster ISO build + reproducible dev envs
scope: fleet-shared            # every dev machine needs it (build-time consumers do)
lifecycle: build-time          # ISO-download path skips; only builders + zeta-install runners need it
installable-via:
  - determinate-systems-installer  # canonical; same as CI
  - upstream-nix-installer         # fallback (not preferred)
NOT-installable-via:
  - homebrew   # would conflict with /nix paths + daemon
  - mise       # not in mise plugin ecosystem
platform: [macos, linux, wsl2]   # NOT native Windows
manual-fallback-url: https://determinate.systems/posts/determinate-nix-installer/
```

Scratch's `declarative/macos/cask/*.Caskfile` handles the **GUI-app DMG** side (VS Code Insiders, JetBrains Rider, Wireshark, OBS, Docker Desktop, Postman). Lifting cask fills the GUI-app side. Determinate Systems Nix is the **system-PM-itself non-cask** side that needs its own `installable-via` dispatch (Layer 4 PM-of-PMs logic).

Layer 2 build-time-vs-runtime classification immediately applies to Nix: cluster operators who download + flash the ISO (B-0737 happy path) don't need Nix locally; only builders + zeta-install.sh runners need it (and zeta-install runs from the USB stick, not from the operator's host machine).

### Gap 2 — ISO build-time vs runtime deps (Roslyn example)

Aaron 2026-05-25: *"depends on roslyn 2 maybe for build not sure how much it matters when we download iso so iso vs builld time deps tracking to our dev deps"*

Roslyn is C# compiler — needed at BUILD time. If you download the ISO from CI artifact (per B-0737 happy path), you don't need Roslyn locally. If you BUILD locally, you do. The build-time-vs-runtime attribute on packages makes this explicit + lets ACE PM ship slimmer install profiles for runtime-only operators (e.g., cluster-bringer-uppers who just need to flash + boot).

### Gap 3 — Windows `.ps1` entry missing

Aaron 2026-05-25: *"we need .ps1 for windows but we don't have yet"*

Scratch has `scripts/setup/windows/bootstrap.ps1`. Lifting + adapting composes with B-0739 (zflash Windows variant) — same Windows substrate surface; same `.ps1` paradigm; same `tools/setup/` integration point.

### Gap 4 — Declarative convergence ("many different package managers we converge them")

Aaron 2026-05-25: *"delcarative dependencies like many different package managers we converge them that's also part of ace pacake manger"*

Scratch covers 11 PMs; we have 5; gap is real. The 6 missing (cask, choco, windows-powershell, vsconfig, bun-global, dotnet-workloads) are the convergence work.

### Gap 5 — Package ontology categorization

Aaron 2026-05-25: *"the ontology catagorization point of packages themself"*

New substrate-engineering target. Scratch's category-only model is insufficient; Layer 3 above sketches the fuller ontology.

### Gap 6 — `.sh` meets developers where they live; `.ps1` is the Windows-equivalent

Aaron 2026-05-25: *".sh is to meet the devleoper where they live we need .ps1 for windows"*

This is the Rule 0 (`.claude/rules/rule-0-no-sh-files.md`) install-graph carve-out generalized: bash for Unix install-graph + PowerShell for Windows install-graph. Both are "meet the developer where they live" — devs already know these languages from their platform; substrate-honest to use them at the install-script layer.

## Scope items (each independently shippable)

### Scope item 1 — Lift the cask substrate (Mac DMG gap)

- Lift `declarative/macos/cask/*.Caskfile` from scratch into `tools/setup/manifests/cask/` (or similar)
- Update `macos.sh` to invoke `brew bundle --file=...Caskfile` after brew packages
- Initial Caskfile contents from scratch + add any Aaron-named manual-install apps
- Acceptance: at least 3 currently-manually-installed Mac apps now install via `macos.sh` automatically

### Scope item 2 — Lift the category + profile decomposition

- Restructure `tools/setup/manifests/` into `tools/setup/manifests/<platform>/<pm>/<category>.<ext>` matching scratch's pattern
- Add `BOOTSTRAP_MODE=minimum|all` and `BOOTSTRAP_CATEGORIES` env handling to `install.sh`
- Lift the 5 categories: `cli` / `native-build` / `database` / `quality` / `runner`
- Add ACE PM-specific categories: `build-time` / `runtime` / `cluster-node` / `dev-laptop` (substrate-engineering design pass)
- Acceptance: install.sh respects mode + categories; minimum profile installs fewer packages; CI runs both modes

### Scope item 3 — Build-time vs runtime deps distinction

- Add `lifecycle` field to package ontology (Layer 3 substrate)
- Tag every existing package as `build-time` / `runtime` / `both` / `dev-only` / `prod-runtime`
- Surface "what would I install if I just wanted to flash + boot?" as a queryable
- Acceptance: query exists; matches B-0737 zflash happy path (only runtime deps; skip Roslyn, etc.)

### Scope item 4 — Package ontology substrate (full Layer 3)

- Document the ontology schema (`kind` / `purpose` / `scope` / `lifecycle` / `installable-via` / `composes_with`)
- Encode existing packages with ontology entries (likely incremental; start with critical-path packages)
- Compose with B-0731 hat-ontology (hats declare required packages; ACE PM validates)
- Acceptance: schema documented; at least 20 critical packages have ontology entries

### Scope item 5 — Lift Windows .ps1 entry + manifests

- Lift `scripts/setup/windows/bootstrap.ps1` from scratch into `tools/setup/windows.ps1`
- Lift `declarative/windows/{choco,powershell,vs}/*` manifests into `tools/setup/manifests/windows/`
- Wire `install.sh` to detect Windows-via-WSL2 (per B-0739 Path A) + Windows-native (per B-0739 Path B) + route appropriately
- Acceptance: Windows operator can run `tools/setup/windows.ps1` and get the dev toolchain installed; composes with B-0739

### Scope item 6 — Platform parity inventory

- Lift `scripts/setup/PLATFORM_PARITY.md` from scratch into `docs/PLATFORM-PARITY.md`
- Extend with ACE PM ontology + scope items 1-5 + B-0738 + B-0739
- Acceptance: doc exists; covers Mac + Linux + Windows × every category × current shipped status

### Scope item 7 — Dependency intent docs

- Lift `scripts/setup/DEPENDENCIES.md` from scratch into `docs/DEPENDENCIES.md`
- Extend with ACE PM ontology
- Acceptance: doc exists; cross-references PLATFORM_PARITY + ontology entries

### Scope item 8 — PM-of-PMs dispatch logic (substantial)

- Substrate-engineering work: build ACE PM as TS service that reads ontology + target manifest + dispatches to the right backend PM(s)
- Conflict resolution (same package via multiple PMs)
- Installed-state tracking across PM boundaries
- Acceptance: at least one worked example: `bun tools/ace-pm/install.ts --target=mac-dev-laptop --profile=minimum` installs the right set; idempotent

## What's NOT in scope (deferred)

- **Nix flake unification** — Zeta has nix flakes for the cluster ISO (`full-ai-cluster/flake.nix`); ACE PM should eventually wrap nix as a backend PM, but that's a future scope item
- **Container-based dev environments** (devcontainer integration beyond what `tools/setup/install.sh` already does) — future scope
- **Multi-OS testing CI matrix** — ACE PM dispatch should be tested on all platforms; current CI is Mac+Linux only; Windows CI is a separate scope
- **GUI front-end for ACE PM** — substrate is markdown-first per the universal protocol (B-0733); GUI when there's demand
- **Marketplace / discovery** — ACE PM as discovery surface for new packages is product-shape; substrate-engineering first

## Composes with .claude/rules/

- `.claude/rules/rule-0-no-sh-files.md` — `.sh` install-graph exception preserved; `.ps1` is the Windows analog Aaron explicitly named ("meet the developer where they live")
- `.claude/rules/honor-those-that-came-before.md` — `../scratch` April-2026 substrate is Aaron's own prior art; lifting + adapting honors the work
- `.claude/rules/default-to-both.md` — multiple PMs per category both first-class; multiple platforms both first-class; build-time AND runtime both first-class
- `.claude/rules/bandwidth-served-falsifier.md` — declarative convergence serves coordination-bandwidth (one source of truth per package; not N PM-specific manifests to keep in sync by hand)
- `.claude/rules/glass-halo-bidirectional.md` — ontology entries are queryable substrate; observable + auditable
- `.claude/rules/dv2-data-split-discipline-activated.md` — DV2.0 hub-satellite partition naturally maps: package-identity = hub; per-PM install metadata = satellites; per-platform availability = satellites
- `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md` — "ACE PM" / "PM of PMs" / "ontology categorization" are compressed naming with concrete substrate-engineering anchors (scratch patterns + this row's scope decomposition); razor does NOT cut as metaphysical

## Composes with backlog substrate

- B-0737 (zflash Mac) — runtime-only deps profile (Layer 2) supports zflash-without-build-toolchain operator path
- B-0738 (zflash Linux) — Linux PM substrate (apt + brew + cask-equivalent on Linux is hard since cask is Mac-only; needs design)
- B-0739 (zflash Windows) — Path B PowerShell-native + Windows manifests align with scope item 5
- B-0731 (hat ontology) — hat-declares-required-packages composes with ACE PM ontology
- B-0728 (destructive-tool authoring contract) — ACE PM install operations are destructive (modify system); inherit the contract
- B-0732 (leverage-class safety substrate) — Layer 1 provenance chain captures ACE PM install operations
- B-0688 / B-0694 / B-0547 / B-0706 (Roslyn-touching rows) — these rows depend on Roslyn; ontology entries flag them as `build-time` consumers
- Mika 2026-05-25 conversation segment 1 — original ACE PM naming surfaced as `ACE Package Manager: Hat Ontology Agreement`

## Integration path with `../scratch/`

`../scratch/` is OUTSIDE Zeta — Aaron's own prior-art experiment from April 2026. Substrate-honest treatment:

- NOT cloned into Zeta verbatim (would create a giant code dump)
- NOT included in `references/upstreams/` (that's for OTHER repos; this is Aaron's own work)
- Lift patterns + manifests + scripts surgically per scope item
- Each lifted piece carries `Source: ../scratch/...` attribution in its header
- Aaron's authorship recognized via commit `Co-Authored-By: Aaron <…>` (not Claude only)
- After lift complete, scratch can stay as Aaron's working notes OR be archived; that's Aaron's call

## Substrate-honest framing

This row PROPOSES the ACE PM substrate scope. It does NOT:

- Implement any of scope items 1-8 (each is independently shippable; substantial work each)
- Force a particular ontology schema (Layer 3 needs a design pass with structured-types review)
- Auto-integrate scratch patterns (per scope item; each lift is its own PR with attribution)
- Compete with Mika's product-team-handoff candidates from B-0736 (Thoughtcatcher etc.) — ACE PM is a DIFFERENT product surface in the same family; Aaron's product team picks names + IP-checks per their process
- Bypass B-0732 leverage-class safety substrate (ACE PM dispatch is destructive at install time; inherits the contract)

P2 priority — ACE PM is foundational ops substrate that:
- Gates cleaner cross-platform onboarding (B-0738 + B-0739 depend on it for their full operator-onboarding scope)
- Composes with the hat-ontology + agency-stack work (B-0731 + B-0733 + B-0735)
- Surfaces Aaron's manual-DMG-install + Roslyn-build-time gaps as substrate-tracked items
- Enables runtime-only profiles that make ISO-download paths leaner for operators

Per `.claude/rules/no-directives.md`: operator-substrate-honest scoping; Aaron + Max + Addison retain authority over which scope items ship when + which platforms get first-class treatment.
