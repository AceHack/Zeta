# Multi-repo refactor — candidate shapes for the factory / library / research split

**Date:** 2026-04-23
**Status:** Research doc — preparing the consultation the human maintainer's
2026-04-20 framing requires before big packaging decisions
land (per the per-user memory rule on factory-reuse packaging
decisions requiring maintainer consultation).
**Triggered by:** The human maintainer 2026-04-23: *"we can even wait on the
demo until we have refactored into our multi repo shape, you
remember that right? That seems very structural and like we
should do it sooner rather than later, but it's up to you."*
**Request:** The human maintainer's review of the options + trade-offs below,
toward a decision on the split shape.

## Why this matters

The current `Lucent-Financial-Group/Zeta` monorepo mixes three
distinct concerns:

1. **The software factory** — generic AI-agent operating
   substrate (`.claude/`, `AGENTS.md`, `CLAUDE.md`,
   `GOVERNANCE.md`, generic docs, tools). Potentially reusable
   by any project adopting the factory.
2. **The Zeta library** — F# implementation of DBSP plus
   operators, sketches, CRDTs, runtime, storage, wire formats.
   A specific project that happens to *host* the factory
   today.
3. **Research + Aurora thread** — cross-disciplinary research
   docs, alignment contract, Aurora collaboration with Amara.
   Partially Zeta-specific, partially generic-factory, partially
   its own product.

As the factory grows more mature and the intention that it be
reusable-beyond-Zeta solidifies (the constraint lives in the
per-user memory layer at `~/.claude/projects/<slug>/memory/`,
not in-repo), the cost of keeping these mixed in one repo
grows:

- External adopters can't adopt the factory without also
  taking Zeta's F# library as a dep
- Factory updates are entangled with Zeta releases
- Aurora's collaborator model (Amara + future collaborators)
  doesn't compose cleanly with Zeta's reviewer roster

The question is **what split shape** to adopt, not whether
to split.

## Prior art

Patterns I surveyed before writing candidates:

### AI-agent-factory patterns

- **Claude Code plugin system** — the plugin mechanism Zeta
  already uses. Plugins ship `.claude/` content via
  marketplace / GitHub.
- **Anthropic skills packaging** — skills are shipped as
  markdown files with frontmatter under `.claude/skills/`,
  distributable per-project or via plugins.
- **OpenAI Agents SDK** — session / agent scaffolding
  pattern; apps adopt the SDK as a dependency.
- **Microsoft Semantic Kernel** — skills as C# / Python
  packages, shared via standard package registries.

### Template / overlay patterns

- **GitHub template repositories** — clone-and-customize;
  no update flow.
- **Cookiecutter / Yeoman** — templating engines with
  project-specific placeholders; generate-once.
- **Nix flakes** — inputs + outputs with pinned hashes;
  update flow exists but friction high.

### Monorepo tools

- **Nx / Turborepo / Lerna / pnpm workspaces** — single
  repo with multiple packages; good internal dev experience,
  external consumers take the published packages.
- **Bazel workspaces** — similar pattern, heavier tooling.
- **.NET solution files** — multiple projects in one repo
  with central package management (Directory.Packages.props).
  Zeta currently uses this at the library level.

### OSS project splits that worked

- **VS Code** (core + extensions ecosystem) — core is one
  repo, extensions are N repos distributed via the
  marketplace. Template for factory-as-core, adopters-as-
  extensions.
- **Rust** (compiler + cargo + crates.io) — primary
  implementation is one repo, the registry is separate
  infrastructure, consumer projects are thousands of repos.
- **Kubernetes** (many-repo after being one-repo) — split
  was painful but the end state is durable.

### OSS project splits that failed

- **Early Android** — AOSP monorepo had multiple aspects
  that would have been better separate; manifest tooling
  (`repo` tool) papered over but never resolved.
- **Eclipse** — plugin sprawl without coherent discipline
  eventually became a cautionary tale.

**Lesson from prior art:** split when you have a clear
consumer boundary and enforce it with tooling; monorepo when
everything co-evolves tightly. Zeta + factory is at the
*transition point* — factory has its own consumers emerging
(Aurora, potentially ServiceTitan's internal work, future
adopters), which is the structural signal to split.

## Current Zeta monorepo inventory

Classifying current top-level dirs by where they'd go after a
split:

| Current location | Generic factory? | Zeta-specific? | Aurora-specific? |
|---|:---:|:---:|:---:|
| `.claude/agents/` | ~80% | ~20% (Zeta-specific personas) | — |
| `.claude/skills/` | ~70% | ~30% (algebra/openspec skills) | — |
| `.claude/commands/` | 100% | — | — |
| `AGENTS.md`, `CLAUDE.md`, `GOVERNANCE.md` | 100% | — | — |
| `docs/ALIGNMENT.md`, `docs/AGENT-BEST-PRACTICES.md`, `docs/AUTONOMOUS-LOOP.md` | 100% | — | — |
| `docs/ARCHITECTURE.md`, `docs/MATH-SPEC-TESTS.md`, `docs/VISION.md` | — | 100% | — |
| `docs/aurora/` (lands via PR #144) | — | — | 100% |
| `docs/research/` | ~50% | ~50% | — |
| `memory/*.md` | ~40% | ~50% | ~10% |
| `src/`, `tests/`, `bench/` | — | 100% | — |
| `samples/` | ~10% (tools-only) | ~90% | — |
| `openspec/` | — | 100% | — |
| `tools/setup/` | 100% | — | — |
| `tools/audit/` | ~80% | ~20% | — |
| `tools/tla/`, `tools/alloy/`, `tools/Z3Verify/` | — | 100% | — |
| `.github/workflows/` | ~60% | ~40% | — |

The split is real — there's clear separation but also
genuine overlap at the boundaries.

## Candidate architectures

Five candidates evaluated honestly. None is strictly better
than the others; the right choice depends on what we optimise
for.

### A. Template-repo pattern

**Shape:**

- `zeta-factory` — public template repo. Contains `.claude/`
  (generic subset), generic governance docs, tooling.
- `zeta` — current repo, minus what moved out. Adopters
  of the factory clone `zeta-factory` as a starting
  point for their own repo.
- No ongoing mechanism for factory updates to flow to
  adopters.

**Pros:**

- **Zero friction** to adopt — `git clone` + rename is all
  it takes.
- Familiar pattern; GitHub has native "Use this template"
  button.
- Clean separation; no submodule / package tooling to
  maintain.

**Cons:**

- **No update propagation.** A factory-level improvement
  (new skill, fixed governance rule) doesn't reach adopters
  automatically. They diverge.
- No way to measure adoption or coordinate breaking changes.
- Adopters end up modifying factory-generic content for
  project-specific needs, losing the genericity.

**Effort to land:** S-M (extract, document the flow).

### B. Git-submodule pattern

**Shape:**

- `zeta-factory` — contains the factory substrate.
- `zeta` embeds `zeta-factory` as a git submodule in
  `.factory/` or similar.
- Adopters embed the submodule the same way.
- Updates propagate via `git submodule update --remote`.

**Pros:**

- **Updates flow** without re-adoption.
- Factory version is explicit in each adopter's repo.
- No package registry required.

**Cons:**

- **Submodule UX is rough.** Every adopter needs to
  remember `--recursive` on clone, update rituals, handle
  detached-HEAD state.
- Tools (agents, CI) need submodule awareness.
- Merge-conflict resolution across submodule boundaries is
  painful.

**Effort to land:** M (extract, wire submodule, update
tooling, document).

### C. Plugin / package pattern (NPM-like)

**Shape:**

- `zeta-factory` publishes versioned releases as Claude Code
  plugin packages + NuGet / npm packages for generic tools.
- `zeta` declares factory version in manifest.
- Adopters declare their preferred factory version.
- Updates are explicit version bumps.

**Pros:**

- **Familiar dependency pattern** — like any SDK.
- Explicit versioning; adopters choose when to upgrade.
- Reuses existing package registries (no new infrastructure).
- Works well with Claude Code's own plugin marketplace.

**Cons:**

- Requires publishing discipline + release cadence.
- Skills + governance rules don't fit neatly into package
  shapes (they're markdown, not code).
- Update cadence is slower than co-development — adopters
  may be months behind the current factory thinking.

**Effort to land:** L (publishing infrastructure + release
process + versioning discipline + marketplace setup).

### D. Formalised monorepo with namespaced boundaries

**Shape:**

- **Stay monorepo**, but formalise top-level boundaries:
  `factory/` (all generic), `library/` (Zeta), `research/`
  (cross-cutting), `aurora/` (Aurora thread).
- Enforce boundaries via tooling (lint rules, CI checks).
- No external extraction; adopters copy the `factory/`
  directory contents.

**Pros:**

- **Cheapest move** — no new repos, no new infrastructure.
- Enforced boundaries improve readability even for current
  maintainer.
- Leaves the door open to extract later if needed; this is
  a useful intermediate step.

**Cons:**

- Doesn't actually enable the reuse direction — adopters
  still take everything.
- Aurora's collaborator model (Amara + future) still
  awkward inside Zeta's repo.
- Punts the real decision without resolving it.

**Effort to land:** S (reorganise, add lint rules).

### E. Overlay pattern with published-package fallback

**Shape:**

- `zeta-factory` — published both as a **reference
  implementation** (a repo with all the factory substrate)
  AND as **overlay-able components** (tool CLIs, skill
  packs, governance-rule sets published as packages).
- `zeta` consumes the overlay via a lightweight tool
  (`factory-apply` or similar) that copies generic content
  + layers Zeta-specific overlays on top.
- Adopters run `factory-apply --from=zeta-factory` to
  initialize; subsequent `factory-apply --update` brings
  down new substrate while preserving their overlay
  customizations.

**Pros:**

- **Best of both worlds** — updates flow, but adopters can
  customize; no submodule friction; familiar per-package
  adoption.
- Aurora can also be a consumer (apply the generic factory
  overlay; add Aurora-specific layer).
- Composes with existing plugin ecosystems — tool CLIs
  become plugins; skill packs become packages.

**Cons:**

- **Requires building the `factory-apply` tool** — no OSS
  tool we can just adopt.
- Overlay merge semantics need definition (what happens
  when adopter modifies a file the factory also updates?).
- More novel than adopters expect — higher initial learning
  curve.

**Effort to land:** L-XL (tool + discipline + migration).

## Comparison matrix

| Axis | A template | B submodule | C package | D monorepo | E overlay |
|---|:---:|:---:|:---:|:---:|:---:|
| Ease to land | S-M | M | L | S | L-XL |
| Update flow to adopters | ✗ | ✓ | ✓ | — | ✓✓ |
| Adopter learning curve | low | medium | low | low | medium |
| Preserves customization | — | — | ✓ | ✓ | ✓✓ |
| Mature tooling exists | ✓ | ✓ | ✓ | ✓ | ✗ |
| Suits Aurora's collaborator model | — | — | ✓ | — | ✓ |
| Current-maintainer-to-solo-adopter friction | low | medium | low | — | medium |

## My recommendation

**Phase 1: D (monorepo formalisation) now.** Reorganise the
current monorepo into `factory/` and `library/` top-level
directories. Enforce boundaries via CI lint. This costs
little, improves current maintainer's mental model, and
creates the clean boundary that makes a future extraction
cheap.

**Phase 2: A (template-repo) when first adopter appears.**
Extract `factory/` into its own repo, mark it as a GitHub
template. Current adopter experience at that point: "Use
this template → clone → start." No update-flow tooling
until we have real adopters asking for it.

**Phase 3: E (overlay pattern) when adopter count > 3.**
When there are enough adopters that update-flow friction is
real, invest in the `factory-apply` tool and overlay
discipline. Before that, the tool is premature and adopters
can manually cherry-pick factory improvements.

**Why this sequencing:**

- Phase 1 is cheap, clearly valuable, unblocks future
  choices without committing to any.
- Phase 2 is the standard OSS playbook — most adopters
  expect this pattern and don't need more.
- Phase 3 requires both the tool investment AND the
  adopter base to justify it; skipping directly to E now
  is premature optimization.

**Aurora-specific consideration:** Under this sequencing,
Aurora lives in the current `zeta` repo through Phase 1.
When Phase 2 happens, Aurora might get its own repo at the
same time (`zeta-aurora`) consuming the factory template.
Amara's deep-research workflow benefits from a dedicated
repo she can read end-to-end without Zeta-library noise.

## Alternative reasonable paths

If the human maintainer disagrees with my sequencing, the most reasonable
alternates:

- **D → C directly.** Skip template-repo; invest in
  plugin/package distribution when ready. Fits if we expect
  adopters to prefer explicit version-pinning.
- **E directly (skip D).** Commit to overlay now if we're
  confident the tool investment pays off. Fits if there's
  a specific near-term adopter the human maintainer knows about.
- **D permanently.** Never extract; always monorepo. Fits
  if the factory-reuse-beyond-Zeta goal is de-prioritised
  or delayed substantially.

## Questions for the human maintainer

1. **Sequencing preference** — D-then-A-then-E, or something
   else? Your call; I'm flexible on this.
2. **When to trigger Phase 2** — "first adopter appears"
   is vague. Could be "ServiceTitan team expresses
   interest," "Amara wants Aurora in its own repo," or
   "someone files a factory-curious GitHub issue." Which
   trigger is the right one?
3. **Aurora's repo timing** — extract `zeta-aurora` at
   Phase 1 (early), Phase 2 (concurrent with factory), or
   later (wait for Aurora to mature)?
4. **Naming** — `zeta-factory` is generic-descriptive
   but Zeta-branded. Future adopters might prefer a more
   neutral name. Options: `agent-factory`, `ai-factory`,
   `glass-halo-factory` (from Zeta's internal framing),
   or keep `zeta-factory` as the reference name with
   adopters free to rename.
5. **The 13 open PRs** — do we pause new PRs until
   Phase 1 extraction lands (so the new structure ships
   together) or continue shipping into current paths and
   let the extraction move them? I'd prefer the latter —
   the moves are mechanical git mv operations once the
   target layout is decided.

## Composes with

- Per-user memory (not in-repo; lives under
  `~/.claude/projects/<slug>/memory/`) — the rules that
  required this research doc before any shaping move
  lands, and the underlying constraint that the factory
  should be reusable beyond Zeta. Open-source and
  LFG-is-demo-facing posture also tracked there.
- `docs/aurora/collaborators.md` (lands via PR #144;
  Aurora collaborator model influences where
  `zeta-aurora` lives)
- `docs/HUMAN-BACKLOG.md` — HB items that may change
  structure once the split lands
- `README.md` performance-design table (stays with the
  library after extraction)
