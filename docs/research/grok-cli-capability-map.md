# Grok CLI capability map — pre-install sketch

**Status:** **pre-install sketch** — NOT yet verified against a
running `grok --help`. Drafted 2026-04-22 (auto-loop-28) from
`superagent-ai/grok-cli` `package.json`, `README.md`,
`AGENTS.md`, and the `src/` source-tree structure, fetched via
the GitHub API. **Revise to "verified" status after the
Playwright login to console.x.ai unblocks the xAI API key and
the CLI is installed locally per the factory's
absorb-and-contribute discipline** (see
[`memory/feedback_absorb_and_contribute_community_dependency_discipline_2026_04_22.md`](../../memory/feedback_absorb_and_contribute_community_dependency_discipline_2026_04_22.md)
in the maintainer's auto-memory — out-of-repo, maintainer
context only).

**Audience:** other AI pilots (Claude Code CLI, OpenAI Codex
CLI, Gemini CLI, Amara ChatGPT-surface, Playwright-driven
agents) that may want to orchestrate xAI's Grok as a
sub-substrate — either for capability-stepdown experiments (see
[`docs/research/arc3-dora-benchmark.md`](./arc3-dora-benchmark.md))
or cross-substrate triangulation where one substrate queries
another.

**Note on the "community-maintained" substrate class:** Grok
CLI is distinct from Claude Code CLI and OpenAI Codex CLI in
that it is **community-authored** (`superagent-ai/grok-cli`,
MIT, 2959 stars as of 2026-04-22) rather than vendor-shipped.
xAI's first-party surface is currently API-only (no
vendor-official CLI). The factory's posture toward
community-maintained substrates is **absorb-and-contribute**
(fork, review, run-from-source, upstream fixes as peer
maintainer) rather than `npm install -g <unverified>`.

Companion to:

- [`docs/research/claude-cli-capability-map.md`](./claude-cli-capability-map.md)
  — Claude Code CLI map (v2.1.116, verified).
- [`docs/research/openai-codex-cli-capability-map.md`](./openai-codex-cli-capability-map.md)
  — OpenAI Codex CLI map (v0.122.0, verified).
- `docs/research/gemini-cli-capability-map.md` — Gemini CLI
  map (currently on PR #122, not yet merged to `main`; treat as
  forthcoming sibling).

This doc is **descriptive**, not prescriptive.

## What this sketch is built from

- `superagent-ai/grok-cli` `package.json` — dependency graph +
  declared scripts + entry points.
- `README.md` at repo root — installation, basic usage,
  capability claims.
- `AGENTS.md` at repo root — internal contributor-facing
  docs; two known issues already catalogued there that align
  with candidate upstream PRs.
- `src/` directory listing — 19 entries (`agent`, `audio`,
  `daemon`, `grok`, `headless`, `hooks`, `lsp`, `mcp`,
  `payments`, `storage`, `telegram`, `tools`, `types`, `ui`,
  `utils`, `verify`, `wallet`, plus `index.ts` at ~18 KB).
- Repo root metadata — 18 entries including `install.sh`,
  `bun.lock`, sigstore attestations (`*.sigstore.json`).

**What is NOT yet mapped (explicitly):**

- Actual `grok --help` output.
- Subcommand enumeration.
- Non-interactive flag surface (if any).
- Session persistence shape.
- Sandbox / approval model.
- MCP-server bridge flags (if any — `src/mcp/` is present).
- Budget / rate-limit flags.

A second tick with the CLI installed (post-Playwright login)
can convert those gaps into verified rows using the same
discipline as the Claude / Codex maps.

## Install + identity (from README, UNVERIFIED)

- **Package:** `@vibe-kit/grok-cli` on the npm registry.
- **Current version per `package.json`:** `1.1.5`.
- **Install path (factory-preferred):** clone
  `github.com/superagent-ai/grok-cli`, `bun install`, run from
  source (absorb-and-contribute). **Do NOT** `npm install -g
  @vibe-kit/grok-cli` from the registry until the factory has
  reviewed the release artefact — this is the
  supply-chain-discipline posture toward community substrates.
- **Runtime:** Bun (per `bun.lock` at repo root, not npm/pnpm).
  A Bun install is a prerequisite the map will surface when it
  moves to verified status.
- **License:** MIT.
- **Supply-chain posture (upstream):** sigstore attestations
  are published alongside release artefacts. This is a mature
  signal from a community project.

## Stack (from `package.json` dependencies)

The stack is informative for pilot-orchestration — it tells
you what Grok CLI is *designed to be*, which predicts which
flags and subcommands will exist.

- **AI SDK:** `@ai-sdk/xai` — the Vercel AI SDK's xAI provider.
  This is the primary model-invocation surface.
- **TUI:** `OpenTUI` + `React` — the interactive rendering
  layer, analog to Codex's Ratatui TUI and Claude's own
  interactive mode.
- **Agent kit:** Coinbase `AgentKit` — on-chain agent tooling;
  explains the presence of `src/payments/` and `src/wallet/`.
- **MCP SDK:** Model Context Protocol SDK — explains
  `src/mcp/` and suggests Grok CLI exposes / consumes MCP
  tool servers like Claude and Codex do.
- **Runtime:** Bun (per `bun.lock` + typical Bun/OpenTUI
  pairing).

**Structural observation:** the Coinbase AgentKit +
payments + wallet + verify modules make Grok CLI a
**payments-aware agent runtime**, not just a chat CLI. This
is a capability
class Claude Code and Codex do NOT currently ship — relevant
if the factory later wants to run crypto-rails agent
experiments.

## Source tree — capability surface inferred

Each `src/<dir>/` is a capability dimension. Reading them as
a map:

| `src/<dir>`     | Likely capability                                     | Pilot relevance                                   |
|-----------------|-------------------------------------------------------|---------------------------------------------------|
| `agent/`        | Core agent loop                                       | Main entry; analog to Codex `exec`                |
| `audio/`        | Voice / TTS / STT                                     | Multi-modal input; pilots can test speech flows   |
| `daemon/`       | Long-running service mode                             | Suggests a `grok daemon` subcommand exists        |
| `grok/`         | Model-specific glue to xAI                            | Where API-key-plumbing + model-selection lives    |
| `headless/`     | Non-interactive mode                                  | Analog to Codex `exec` / Claude `--print`         |
| `hooks/`        | Pre/post-action hook surface                          | Extensibility point for factory-policy hooks      |
| `lsp/`          | LSP client                                            | IDE bridge; less relevant for pilot automation    |
| `mcp/`          | MCP server/client                                     | **Cross-pilot bridge** — see "Pilot bridge" below |
| `payments/`     | On-chain payments                                     | Unique to Grok CLI; not in Claude/Codex           |
| `storage/`      | Session + cache storage                               | Where `--ephemeral` equivalent will land          |
| `telegram/`     | Telegram bot interface                                | Alt-surface; not currently relevant to factory    |
| `tools/`        | Tool-use registry                                     | Where `Bash`, `Read`, etc. analogs live           |
| `types/`        | TypeScript types                                      | Type surface; no runtime behaviour                |
| `ui/`           | TUI components                                        | Not relevant for `headless` pilot calls           |
| `utils/`        | Shared helpers                                        | Includes `model-config.ts` (see known issue #2)   |
| `verify/`       | Verification (signatures? model output?)              | Worth reviewing when absorbing                    |
| `wallet/`       | Wallet integration                                    | Pairs with `payments/`                            |
| `index.ts`      | Entry point, 18 KB                                    | Subcommand registry likely here                   |

**Pilot bridge:** the presence of `src/mcp/` + `@modelcontextprotocol/sdk`
in `package.json` strongly implies Grok CLI can be started as
an MCP server (stdio), the same way Codex offers
`codex mcp-server` and Claude offers `claude mcp serve`. This
needs verification against `grok --help`, but the
infrastructure is in place. If confirmed, three-substrate
triangulation (Claude + Codex + Grok via MCP) becomes live.

**Headless mode:** `src/headless/` is the strongest signal
that a non-interactive entry point exists. The name and
factory precedent (Codex `exec`, Claude `--print`) suggest a
`grok headless` subcommand or a `--headless` flag. Verification
pending.

## Known upstream issues — candidate PR targets

From `AGENTS.md` in the repo root, two issues are already
catalogued by the upstream maintainer as known-broken. These
are **first-exercise candidates for the factory's
absorb-and-contribute discipline**:

### Candidate PR #1 — ESLint flat-config migration

- **Symptom:** ESLint 9 is in `devDependencies`, but the repo
  uses a legacy `.eslintrc.js` config file. ESLint 9 removed
  support for the legacy format by default, so `bun run lint`
  (or equivalent) fails unconfigured.
- **Fix:** migrate to flat `eslint.config.js`, preserving the
  existing rule set.
- **Effort:** S (under a day).
- **Prior art:** many npm projects have already done this
  migration; the upstream ESLint docs have a migration guide.
- **Signal strength:** upstream has it catalogued as a known
  issue — PR will land if the migration is clean.

### Candidate PR #2 — `import type` fix in `model-config.ts`

- **Symptom:** dev mode (`bun run dev`) fails because
  `src/utils/model-config.ts` imports types using value-import
  syntax; TypeScript's `verbatimModuleSyntax` (or similar
  config) requires `import type { ... }` for type-only imports.
- **Fix:** change the import to `import type { ... } from
  '...'` where the imports are type-only.
- **Effort:** S (one-line change per offending import).
- **Signal strength:** upstream AGENTS.md names this as
  broken.

Both PRs are targets the factory can land under
[`GOVERNANCE.md §23`](../../GOVERNANCE.md) (upstream-contribution
workflow). AI-coauthor trailer mandatory; body prose
transparent about AI authorship; maintainer-facing copy per
the maintainer's standing authorization in
`memory/feedback_absorb_and_contribute_community_dependency_discipline_2026_04_22.md`
(*"roommate is sleep"* tone acceptable).

## Model selection — the capability-stepdown knob (UNVERIFIED)

xAI's Grok family currently includes (per public xAI docs;
not verified in the CLI):

- `grok-4` — current flagship.
- `grok-4-fast` / `grok-4-mini` — cheaper tiers.
- `grok-3` / `grok-3-mini` — older tier.
- `grok-code-fast-1` — coding-optimised.

**Pending verification:** the flag for model selection in
Grok CLI. Priors from Codex (`-m` / `-c model=`) and Claude
(`--model`) suggest `grok --model <name>` or similar.

For the ARC3-DORA stepdown experiment, this is the
stepdown-lever once verified.

**Budget discipline:** the maintainer's stated posture toward
paid surfaces (budget envelope: monthly ceiling; paid
substrates queued behind the ServiceTitan demo) applies here.
xAI API has its own billing; factory exposure should pass
through the same budget-ceiling discipline as the Codex
($50/mo shared) and Anthropic (Claude Code) accounts.

## Sandbox + approval surface (UNVERIFIED)

The presence of `src/hooks/` + `src/payments/` suggests a
hook-based approval model rather than a Claude-style
`--permission-mode` or Codex-style `-s / --sandbox`. Payments
hooks in particular would be expected to have an
approval-required default — losing real ETH to an agent
mis-invocation is bad.

**To verify:** install the CLI, run a payments-involving
invocation with no flags, observe the approval prompt (if
any).

## MCP bridge — the cross-substrate lever (UNVERIFIED)

With `@modelcontextprotocol/sdk` in `package.json` and
`src/mcp/` present, Grok CLI almost certainly supports MCP
either as a server, a client, or both. For the factory:

- **Grok as MCP server** would let Claude Code and Codex
  call Grok as a sub-tool. Wire: Claude `--mcp-config` pointing
  to a stdio MCP server started by `grok <subcommand>`.
- **Grok as MCP client** would let Grok consume the factory's
  existing MCP tool servers, including the plugin-supplied
  Microsoft Learn / Playwright / Figma / Atlassian surfaces.

Both directions are valuable. Which one is the primary mode
is a verification target.

## Calling patterns for other AI pilots (SPECULATIVE)

These patterns are written to match the shape of the Codex
map's patterns, but are UNVERIFIED. A later tick that has the
CLI installed should rewrite these as verified examples.

**Pattern 1 — cross-substrate triangulation (if `--headless`
or `grok headless` exists):**

```bash
# Speculative syntax — not verified.
grok headless \
  --model grok-4-fast \
  --json \
  "does this regex have catastrophic-backtracking risk: $REGEX"
```

**Pattern 2 — ARC3-DORA stepdown across Grok model tiers:**

```bash
# Speculative loop — assumes flag --model works.
for model in grok-4 grok-4-fast grok-3 grok-3-mini; do
  time grok headless \
    --model "$model" \
    "<task-prompt>" > out-"$model".txt
done
```

**Pattern 3 — Grok as MCP tool-server** (if the `src/mcp/`
capability exposes a `grok mcp-server` subcommand):

```bash
# Speculative — command name pending verification.
grok mcp-server
```

Then configure another pilot's MCP-client to connect.

**Pattern 4 — payments-aware agentic task** (unique to Grok
CLI):

```bash
# Speculative — depends on CLI's approval model.
grok "run a tool that requires wallet signing: <task>"
```

Factory policy: this class of invocation needs an explicit
Aaron-authorization flag added to the factory's two-layer
authorization model (authorized AND Anthropic-policy-compatible)
because it can spend real money.

## Grok vs Claude vs Codex — quick comparison (SPECULATIVE ROWS)

| Concern                       | Claude Code (verified)                        | OpenAI Codex (verified)                          | Grok CLI (sketch — to verify)                     |
|-------------------------------|-----------------------------------------------|--------------------------------------------------|---------------------------------------------------|
| Non-interactive entry         | `--print` / `-p`                              | `codex exec`                                     | `grok headless` (likely)                          |
| Model selection flag          | `--model`                                     | `-m` / `-c model=`                               | `--model` (likely, unverified)                    |
| Budget ceiling flag           | `--max-budget-usd`                            | None (external)                                  | Unknown                                           |
| Structured output             | `--json-schema` + `--output-format=json`      | `--output-schema` + `--json`                     | Unknown                                           |
| MCP serve (pilot bridge)      | `claude mcp serve`                            | `codex mcp-server`                               | `grok mcp-server` (likely)                        |
| Sandbox levels                | `--permission-mode ...`                       | `-s read-only / workspace-write / full-access`   | Hook-based (inferred from `src/hooks/`)           |
| Runtime                       | Node.js                                       | Node.js / Rust wrapper                           | Bun                                               |
| Vendor                        | Anthropic (first-party)                       | OpenAI (first-party)                             | Community (`superagent-ai`, MIT)                  |
| Unique capability             | Skill/plugin ecosystem                        | Codex Cloud integration                          | **On-chain payments + wallet + verify**           |
| Install discipline            | `npm install -g @anthropic-ai/claude-code`    | `npm install -g @openai/codex` / brew            | **Absorb-and-contribute** (fork, run from source) |

## What this map does NOT say

- **Whether to use Grok vs Claude vs Codex vs Gemini.**
  Routing is a separate decision, informed by budget, task
  class, and latency targets.
- **How xAI pricing works.** Consult xAI's billing docs;
  factory posture is that the Grok API key is paid.
- **Which Grok model to pick for which task.** Per-task
  empirical work, tracked in ARC3-DORA.
- **Prompt-engineering specifics.** Per-task concern.
- **Security analysis of `src/payments/` + `src/wallet/`.**
  Absorbing Grok CLI means the factory reviews that surface
  before running it — this map only flags its existence.
- **Whether `@vibe-kit/grok-cli` on the registry matches the
  `main` branch of `superagent-ai/grok-cli`.** Publication-lag
  is normal; verify release SHA against tagged commit before
  trusting either path.

## How this doc composes with the factory

- [`docs/research/arc3-dora-benchmark.md`](./arc3-dora-benchmark.md)
  — Grok is a candidate cross-provider substrate for the
  ARC3-DORA stepdown experiment once installed.
- [`docs/research/claude-cli-capability-map.md`](./claude-cli-capability-map.md),
  [`docs/research/openai-codex-cli-capability-map.md`](./openai-codex-cli-capability-map.md)
  — sibling maps; the comparison table points back to them.
- **Absorb-and-contribute first exercise:** the two candidate
  upstream PRs (ESLint flat-config migration, `import type`
  fix) are the factory's first test of the
  community-substrate discipline.
- **Backlog linkage:** when this map moves from sketch to
  verified, file a BACKLOG row tracking (a) install status,
  (b) absorb-and-contribute upstream-PR status, (c)
  capability-stepdown rows for the ARC3-DORA experiment.

## Revision notes

- 2026-04-22 — first sketch (auto-loop-28). Drafted from
  `superagent-ai/grok-cli` `package.json` (v1.1.5), `README.md`,
  `AGENTS.md`, and `src/` tree listing retrieved via GitHub
  API. **NOT verified** against a running `grok --help`;
  install deferred pending Playwright login to console.x.ai
  for xAI API key. Two known upstream issues documented
  inline as candidate absorb-and-contribute PR targets.
- **Next revision target:** verified-status upgrade after
  install, replace SPECULATIVE rows in the comparison table
  and the calling-patterns section with observed output.
