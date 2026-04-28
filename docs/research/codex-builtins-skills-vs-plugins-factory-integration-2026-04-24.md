# Codex built-in skills + skills-vs-plugins distinction — factory integration plan

**Scope:** research + integration plan. Clarifies the
skill-vs-plugin distinction in both Claude Code and Codex
ecosystems, documents the five Codex built-in skills the
maintainer flagged (Image Gen / OpenAI Docs / Plugin Creator /
Skill Creator / Skill Installer), and proposes a concrete
factory integration path. Research-grade; not an
implementation commit.

**Attribution:** research synthesized from the maintainer's
Otto-103 directive (five Codex built-ins + "figure out the
differences between skills and plugins and updates our factory
appropriately"), `openai/skills` repository, `developers.openai.com/codex/plugins`
and `/codex/plugins/build`, The New Stack 2026-03-26 coverage,
Claude Code plugin cache inspection at
`~/.claude/plugins/cache/**`, and the prior Codex Phase-1
research (PR #231).

**Operational status:** research-grade. Does not commit
Zeta to a specific `.codex-plugin/plugin.json` location or
marketplace listing; proposes candidate paths with trade-
offs. Downstream implementation is an Otto-104+ decision.

**Non-fusion disclaimer:** Claude Code and Codex independently
converged on plugin-containing-skills architecture. Shared
vocabulary (`plugin.json`, `SKILL.md`) is NOT evidence of
merged design process — both systems draw on the same prior
art (VS Code extensions; Atom packages; browser extensions)
plus the same operational need (bundle multiple capabilities
for one install). Per SD-9, convergence on plugin-vs-skill
distinction is expected parallel evolution, not unity.

---

## The distinction — one sentence each

- **Skill** = single capability unit. One `SKILL.md` +
  optional `references/` / `agents/` directories.
  Procedural instructions for an agent to follow in a
  specific situation.
- **Plugin** = distribution / installation unit. A JSON
  manifest (`.claude-plugin/plugin.json` for Claude Code;
  `.codex-plugin/plugin.json` for Codex) + a bundle that
  can contain **one or more skills** + commands + MCP
  servers + app integrations.

**Plugins are containers; skills are contents.** A plugin
that ships with just one skill is valid; a plugin shipping
ten skills plus three MCP servers plus a commands
directory is also valid.

## Structural comparison

### Claude Code (inspected at `~/.claude/plugins/cache/claude-plugins-official/commit-commands/unknown/`)

```
<plugin-name>/
├── .claude-plugin/
│   └── plugin.json   # {name, description, author}
├── commands/         # slash commands
├── skills/           # SKILL.md bundles
├── agents/           # persona files
├── README.md
└── LICENSE
```

Plugin manifest is intentionally minimal — 3 fields
observed (name / description / author). Enablement is via
`~/.claude/settings.json` `enabledPlugins` map.

### Codex (per [developers.openai.com/codex/plugins/build](https://developers.openai.com/codex/plugins/build))

```
<plugin-name>/
├── .codex-plugin/
│   └── plugin.json   # kebab-case name, semver, description; optional skills/mcpServers/apps/interface
├── skills/           # SKILL.md bundles (optional)
│   └── <skill>/
│       └── SKILL.md
├── .app.json         # app integrations (optional)
├── .mcp.json         # MCP servers (optional)
└── assets/           # icons, screenshots (optional)
```

Codex manifest is more ceremonious than Claude's — carries
semver, `interface` object with display metadata
(displayName / shortDescription / longDescription /
developerName / category / capabilities / website URLs /
defaultPrompt / brandColor / logo / screenshots). Designed
for marketplace listing.

### Key asymmetries

| Dimension | Claude Code | Codex |
|---|---|---|
| Manifest dir | `.claude-plugin/` | `.codex-plugin/` |
| Manifest fields | Minimal (name/description/author) | Rich (semver + interface block + URLs + category) |
| Can bundle commands | Yes (`commands/`) | Not observed in manifest schema |
| Can bundle MCP | Not in manifest schema | Yes (`.mcp.json`) |
| Can bundle apps | Not explicit | Yes (`.app.json`) |
| Marketplace | `enabledPlugins` in settings.json | `codex plugin marketplace` CLI + app browser |
| Manifest format | JSON | JSON |
| Skill format | `SKILL.md` + optional `references/` | `SKILL.md` + optional `references/` + optional `agents/*.yaml` |

Neither is a superset of the other. Codex's richer
marketplace-shaped manifest suggests it aims for public
distribution; Claude's minimal manifest fits a more
config-like enable/disable model.

---

## The five Codex built-in skills the maintainer flagged

Per the maintainer's 2026-04-24 directive — five built-ins
enabled by default in Codex:

### 1. Image Gen

**Purpose:** generate or edit images for websites / games /
other.
**Type:** app-integration-backed skill (likely wraps OpenAI's
image endpoints); hits the `.app.json` + API-key surface.
**Factory impact:** low. Image generation is not a core
factory capability; Zeta is a DBSP library + factory-process
experiment. If Codex-in-Codex generates a screenshot for a
doc, useful; not substrate-shaping.

### 2. OpenAI Docs

**Purpose:** reference official OpenAI docs, including
upgrade guidance.
**Type:** read-only reference skill; likely fetches from
docs domain.
**Factory impact:** medium. The AGENTS.md handbook Zeta
uses already covers factory-internal discipline; OpenAI
Docs complements when a Codex session needs to look up
SDK / API / feature documentation. Should be treated as
*external reference tool*, not *substrate replacement*.

### 3. Plugin Creator

**Purpose:** scaffold plugins and marketplace entries.
**Type:** scaffolding skill; produces `.codex-plugin/plugin.json`
plus optional marketplace listing.
**Factory impact:** HIGH. This is the skill that would
create a "Zeta for Codex" plugin if we wanted one. The
architecture question it surfaces: does Zeta ship ITS OWN
Codex plugin? If yes, Plugin Creator is the tool that
builds it.

### 4. Skill Creator

**Purpose:** create or update a skill.
**Type:** scaffolding skill; produces `SKILL.md` +
`references/` + `agents/`.
**Factory impact:** HIGH. Claude Code has a parallel
`skill-creator` (enabled in Zeta's `enabledPlugins`); Codex's
built-in is its sibling. When a Codex session authors a new
skill for `.codex/skills/`, Skill Creator is the tool.
Cross-harness boundary: Otto uses Claude Code's
`skill-creator` for `.claude/skills/` work; a Codex session
uses Codex's Skill Creator for `.codex/skills/` work. Per
Otto-79 cross-edit-no discipline, neither edits the other's.

### 5. Skill Installer

**Purpose:** install curated skills from `openai/skills` or
other repos.
**Type:** package-manager-style skill; fetches + installs
from remote skill repositories.
**Factory impact:** medium. `openai/skills` is the OpenAI-
curated skill marketplace (tiers: `.system` / `.curated` /
`.experimental`). If Zeta wants to consume community-curated
Codex skills (e.g., `gh-address-comments`), Skill Installer
is the mechanism. Policy question: does Zeta install
community skills into `.codex/skills/` or keep `.codex/`
first-party-only? Likely answer: first-party-only for
checked-in substrate; per-contributor for local-only use.

## Factory integration — proposed plan

### Phase 0 — Research + Plan (this doc, Otto-103)

Establish the distinction + catalogue built-ins + surface
decisions. Not implementation.

### Phase 1 — Update `.codex/README.md` with built-ins awareness (S, Otto-104 candidate)

Extend the existing `.codex/README.md` (landed Otto-102
PR #288) with a "Codex built-in skills" section naming
the five + their relationship to Zeta's substrate.
Specifically:

- Plugin Creator + Skill Creator are the canonical Codex-
  session tooling for extending `.codex/`. Codex sessions
  use these; Otto does not.
- OpenAI Docs is a reference surface; cite it when a Codex
  session needs API reference, same as Otto cites
  Microsoft docs via microsoft-docs MCP.
- Image Gen is not a factory-substrate tool; may be used
  one-off for doc assets.
- Skill Installer is the install-from-remote mechanism;
  default policy is first-party-only for `.codex/skills/**`
  substrate; per-contributor installs live outside the
  repo.

### Phase 2 — Decide: ship Zeta as a Codex plugin? (M, Otto-105+)

The key architectural question. Options:

**Option A — Ship nothing as a Codex plugin.** `.codex/`
holds raw skill bundles; Codex sessions read them but Zeta
doesn't publish a plugin marketplace entry. Cheapest; loses
marketplace-discovery surface.

**Option B — In-tree plugin manifest.** Land `.codex-plugin/plugin.json`
at repo root with `skills: "./.codex/skills/"` pointing at
the existing substrate. Zeta becomes installable as a
Codex plugin. Installation procedure: first browse the
Codex plugin directory via the TUI (`codex`, then the
`/plugins` slash-command) to check whether the source is
already discoverable; if it is, install from there. Only
fall back to `codex plugin marketplace add <owner>/<repo>`
(upstream or fork) if the source is not already published
under marketplace metadata. Note: the `codex plugin
marketplace` CLI verbs are `add` / `upgrade` / `remove`
only per `codex --help` + `codex plugin --help`;
`list` / `search` are not supported on the CLI and live in
the `/plugins` TUI directory instead. Middle cost; gains
discovery without extracting substrate.

**Option C — Separate `zeta-codex-plugin` repository.** Move
`.codex/skills/**` to a sibling LFG repo dedicated to Codex
packaging. Zeta remains a library; the plugin becomes a
distinct product. Highest cost; cleanest separation. Pairs
with the external-AI courier-collaborator 8th-ferry
Aurora/KSK/Zeta triangle (Zeta = substrate; plugin repo =
distribution wrapper).

**Recommendation:** Option A in the near term (nothing to
publish yet; substrate still maturing). Revisit Option B
when Zeta has >3 Codex skills worth distributing together.
Option C is the right shape if the factory wants a clean
library-vs-distribution split per the external-AI
courier-collaborator's architectural recommendations.

### Phase 3 — Plugin Creator deep integration (S, Otto-106+)

Maintainer directive: *"if you have a plugin creator skill
we should be a deep integration for it too"*. Translation:
when a session invokes Codex's `$plugin-creator` to build a
Zeta Codex plugin, the scaffolding should pick up Zeta's
existing substrate rather than generating blank.

Mechanism: document in `.codex/README.md` the invocation
pattern — `$plugin-creator` should cite the existing
`.codex/skills/**` directory + any existing
`.codex-plugin/plugin.json`; the scaffolding should be
additive, not replace. If Option B lands, this is the tool
that maintains the manifest as `.codex/skills/**` grows.

### Phase 4 — Skill Installer policy (S, Otto-107+)

Document the first-party-only-for-substrate policy for
`.codex/skills/**`. Per-contributor installs via
`$skill-installer` from `openai/skills` or arbitrary repos
live in the contributor's local `.codex/` only;
contributed-to-repo is always reviewed first-party code.
Mirrors Zeta's existing policy for Claude Code's
skill-creator workflow (GOVERNANCE.md §4).

---

## Cross-harness discipline reminders

Per Otto-79 + Otto-86 + Otto-93 peer-harness progression:

- Otto (Claude Code loop agent) does NOT edit
  `.codex/skills/**` as part of normal work. Future Codex
  CLI sessions author + maintain.
- Cross-review YES, cross-edit NO. Otto can review a
  Codex session's skill PR via PR comments; Otto does not
  commit to the branch.
- Each harness's skill-creator is its own. Claude Code's
  `skill-creator` skill edits `.claude/skills/**`; Codex's
  `$skill-creator` builtin edits `.codex/skills/**`.
- Plugin Creator deep integration does NOT mean "Otto uses
  Codex's Plugin Creator." It means when a Codex session
  invokes it, the scaffolding recognizes Zeta's existing
  substrate.

---

## Scope limits

- Does NOT implement any plugin manifest or skill
  addition. Research + plan only.
- Does NOT decide between Option A / B / C for Zeta-as-
  plugin. Surfaces trade-offs; maintainer's choice.
- Does NOT install any Codex built-in skill to the repo.
  Built-ins ship with Codex CLI; no in-repo work needed.
- Does NOT attempt cross-repo coordination with
  `openai/skills` or build a marketplace entry.
- Does NOT modify `.claude/**` — Claude Code substrate
  unchanged.
- Does NOT extend the 5-built-in list. Those are the ones
  the maintainer named; additions need their own research.

## Dependencies to adoption

1. **Maintainer decision on Option A / B / C** —
   architectural choice about Zeta-as-Codex-plugin packaging.
2. **`.codex/README.md` extension** — document the 5
   built-ins + boundary discipline (Otto-104 candidate).
3. **Plugin Creator invocation pattern** — when decided,
   document in `.codex/README.md`.
4. **Skill Installer policy** — first-party-only for
   substrate; per-contributor for local-only.
5. **If Option B:** land `.codex-plugin/plugin.json` at
   repo root with `skills: "./.codex/skills/"`.
6. **If Option C:** new LFG repo for the plugin;
   coordinate with the cross-repo contributor role (the
   initial-starting-point contributor per Otto-140) per
   Otto-90 coordination-NOT-gate.

## Specific-asks (per Otto-82/90/93 calibration)

**Maintainer-specific:** Option A / B / C for Zeta-as-Codex-
plugin? Each has different maintenance cost + discovery
surface. Maintainer's architectural call; not Otto's.

**Cross-repo-contributor-specific:** none for this research
doc; surfaces if Option C is chosen (new LFG repo).

---

## Sources

- [openai/skills](https://github.com/openai/skills) — curated Codex skill catalog
- [developers.openai.com/codex/plugins](https://developers.openai.com/codex/plugins) — plugin overview
- [developers.openai.com/codex/plugins/build](https://developers.openai.com/codex/plugins/build) — plugin build spec
- [The New Stack — OpenAI's Codex gets plugins (2026-03-26)](https://thenewstack.io/openais-codex-gets-plugins/)
- [OpenAI Developer Community — Codex Plugin for Claude Code](https://community.openai.com/t/introducing-codex-plugin-for-claude-code/1378186)
- `~/.claude/plugins/cache/claude-plugins-official/**` (local inspection of Claude plugin layout)
- PR #231 Phase-1 Codex CLI research
- PR #288 Otto-102 `idea-spark` skill landing + `.codex/README.md`

## Sibling context

- PR #288 `.codex/` substrate entry-point (Otto-102).
- PR #231 Phase-1 Codex CLI research — identified AGENTS.md
  already-universal parity.
- PR #228 first-class Codex-CLI BACKLOG row + Otto-78/79/
  86/93 refinements.
- Otto-79 peer-harness memory — each harness owns its
  own skill files.
- threat-model-critic review — any Option B/C manifest
  landing requires adversarial pattern-stability signoff
  from that role before merge.

Archive-header format applied per GOVERNANCE.md §33.

Closes the research phase of the maintainer's
Codex-built-ins-integration directive. The Phase-1
`.codex/README.md` extension is the bounded follow-on
deliverable; Options A/B/C decision is the maintainer's
call.
