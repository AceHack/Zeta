# Custom agent harness — account logins, Ace + Zeta CLIs, GitHub tokens not `gh`

*2026-08-26. Operational status: research-grade absorb of a current-state
audit; the live pointer is
[`docs/trajectories/own-ai-harness/RESUME.md`](../trajectories/own-ai-harness/RESUME.md).
GOVERNANCE.md §33.*

The harness is named **Harny** (Aaron 2026-08-26). Separate from Ace;
Ace will install it. In-tree CLI: `src/Core.TypeScript/harny/harny.ts`.

Aaron 2026-08-26 asked for an account of the harness that is supposed to
do full-duplex streaming and CLI/tooling **only by calling our CLIs**,
never platform CLIs; an overarching plan to run all paid agents on it
with **account logins** (API keys secondary); GitHub tokens instead of
`gh`; Ace closing over dependencies; Zeta closing over source control
and filesystem. Paid accounts in daily use: grok, claude, openai,
manus, gemini, codex, kiro.

## The shape (target)

```text
  account login (device-code / PKCE) ──► ~/.config/zeta/auth/<persona>/<provider>.json
                                              │
                                              ▼
  model (SSE today, four-corner duplex as the general shape)
                                              │
                    closed tools (JSON, no TTY, no bash)
                         ┌────────────┴────────────┐
                         ▼                         ▼
                   Ace CLIs                    Zeta CLIs
                 (dependencies)          (git / fs / forge)
                         │                         │
              setup-realize / pins         LibGit2Sharp + GitHub REST
```

Chat-completions is the **degenerate projection** of the four-corner
interface (`docs/research/2026-07-04-the-four-corner-interface-…`).
Full duplex is the general form; HTTP request/response is the 2-corner
fill.

## Where we are

Two stacks, not one.

**Stack A — production.** `loop-tick` + `persona-registry.ts` spawn
vendor CLIs that already hold Aaron's sessions:

| Persona | CLI today |
|---|---|
| Otto, Soraya, Tariq | `claude -p --permission-mode auto` |
| Vera / Codex | `codex --approval-mode full-auto` |
| Alexa / Kiro | `kiro-cli chat --trust-all-tools` |
| Lior | `agy -p --dangerously-skip-permissions` |
| Riven | `cursor-agent --print --model grok-*` |
| Grok peer-call | native `grok` CLI |

Those CLIs bring **their** tools (bash, git, gh, Read, …). The harness
cannot refuse what does not flow through it
(`docs/research/2026-08-13-lessons-belong-in-the-harness-not-in-rules-…`).

**Stack B — our harness library** (`src/Core.TypeScript/model-backend/`).
Live for **ChatGPT subscription** (summon + closed `fs_*`/`db_*`,
2026-07-04) and **GitHub device login** (PRs #9549–#9551). Not what
`loop-tick` calls.

### Per-provider matrix

| Provider | Account login (ours) | Streaming | Tools on our harness | Fleet |
|---|---|---|---|---|
| openai / ChatGPT | wired (`openai-auth.ts`) | SSE `/codex/responses` | closed `ZETA_TOOLS` live | Vera still uses Codex CLI |
| codex | same ChatGPT account | Codex CLI stream | vendor tools | Vera/codex cells |
| github | wired (`github-auth.ts`) | n/a | n/a | factory still `spawnSync gh` |
| claude | none | vendor | vendor / observe `bash -c` | Otto/Soraya/Tariq |
| grok | none | vendor / Cursor | vendor | this session |
| gemini | none | vendor | vendor | Lior (`agy`) |
| kiro | none | vendor | `--trust-all-tools` | Alexa |
| manus | wired account API key (`harny login manus --from-file`) | async remote task | Manus **cloud** skills — no local Ace/Zeta tools | remote-only adapter; not in `loop-tick` |

Installer already **declares** some vendor cred paths
(`zeta-creds-manifest.ts`: gh-cli, claude, gemini, codex) so USB restore
can bake them. That is inheritance of vendor sessions, not our login.

### Ace (dependencies)

Shipped: DLC `ace.ts` (install/verify/list/sign/registry/lockfile),
`setup-realize.ts` (host toolchains, dogfooded by linux/macos setup +
several CI jobs), pinned Ollama/SMT artifacts (replaces `curl|sh` on
those two).

Not shipped: meta-PM (`ace-cli.ts` is a toy graph), `ace pull`, brew/apt
as Ace verbs, CLI-wide `--json` (only `list` on the real CLI), wrapping
npm/cargo/gh.

Agents still type `bun` / `mise` / `brew` / `curl`.

### Zeta (source control + filesystem)

Shipped: `zeta` F# exe over **LibGit2Sharp** (no `git` binary) + MCP
porcelain (`zeta_status/log/branch/checkout/commit/push/fetch`);
`github-login-cli.ts`; `ZetaExec` file seam in tests; DagFs as the
tree algebra; `ZetaFsDeltaLog` as the own-format `IDeltaLog`;
`ZetaFsDualFold` as the +1 `I` / −1 generator-reinterpret contract.

LibGit2Sharp is the hexagonal **v1** adapter, not the destination.
The git replacement is dual DBSP Z-set folds over our Merkle DAG
(workitem `081M108RYNT087G0R001JSRNZE`): forward integrate, generator
updates that reinterpret retained history as a new `−1/+1` entry,
`ZSetMerkle` snapshot. See
`docs/research/2026-08-26-zetafs-dual-fold-git-replacement.md`.

Not the factory path: `GitHubAdapter` / `rest-push` / poll-pr-gate /
heartbeat flush all `spawnSync("gh")`. `push-with-retry` and
`changed-files` still exec `git`. `clis/Verbs.fs` (`sim mea cut …`) is
a different product (algebra verbs), mostly stubs.

ROADMAP item 1 **NO GIT CLI** is unmet.

### Full duplex

`duplex-transport.ts` (in-process queues), `web-socket-endpoint.ts`,
`multiplexed-duplex-transport.ts` exist and are tested. Vendor APIs we
talk to are still half-duplex HTTP/SSE. Interrupt between turns, not
mid-token, until a provider's wire can carry the feedback corners.

## Gaps (ranked)

1. Production loops do not call `summon` / `runToolLoop`.
2. Four local LLM providers have no native `AuthProvider` (claude / grok / gemini / kiro). Manus is wired as an **account API key** (no extra per-call billing) but is **remote-only** — it may never fit the full local tool loop.
3. GitHub **login** is ours; GitHub **work** is still `gh`.
4. Closed tool surface is not Ace+Zeta and is not what the fleet uses.
5. Token store is per-provider, not per-persona (manifest says
   `personaScoped: true` for the AIs).
6. Ace/Zeta CLIs are not an AI-friendly contract (JSON-out, structured
   errors, no TTY) across every verb.
7. Full duplex does not wrap vendor streams.
8. Dogfood ledger did not track "paid agents on our harness" until
   Tier 0 (same day as this absorb).

## Roadmap

Umbrella `081M100RB97087G0R0008EAAY7`.

| Phase | Workitem | Dogfood signal |
|---|---|---|
| 0 | roster + `zeta-login` / `harny` CLI (this change) | `harny list --json` is the declared set |
| 0b | Manus account API key, remote-only | `harny login manus --from-file`; no local tools |
| 1 | AuthProviders for claude/grok/gemini/kiro | `081M100RH29087G0R0031HHGJ0` |
| 1b | ForgeHost HTTP + stored token, no `gh` | `081M100RB9Z087G0R000GWY1MM` |
| 2 | Closed tools = Ace + Zeta verbs | `081M100RH3Q087G0R0018X4RSJ` |
| 3 | `loop-tick` default `mux-duplex` (local vendors) | `081M100RH30087G0R003YXHQ12` |
| B5 | Ace pre-bootstrap (published binary **or** from-source seed) | `081M102M6X5087G0R001VWNYS2` |
| B6 | Extract **Harny** as first isolated published package | `081M102M6Y2087G0R000407SW3` |

Account login is primary for every local vendor that can do OAuth.
Manus is the honest exception: their account login **is** an API key
with no extra per-call cost, and the agent always runs on their cloud.
Do not pretend that is a local Harny loop. API keys stay secondary for
everyone else (`XAI_API_KEY`, Gemini headless docs).

## Login ladder (remote / no-local-browser first)

Aaron 2026-08-26: device login when the vendor has it; otherwise some other
account login (OAuth-like); smoothest for remote machines and machines
without browsers; a browser **on the agent machine** is last-resort.

| Rank | Flow | Local browser? | What it is |
|---|---|---|---|
| 0 | `device-code` (RFC 8628) | no | Print URL + short code; approve on a phone. GitHub, OpenAI/Codex (ours, live). Grok (`auth.x.ai` OIDC `device_authorization_endpoint`; `grok login --device-auth`). Kiro (`kiro-cli login --use-device-flow`). |
| 1 | `paste-code` | no | PKCE/auth-code; user opens URL on any device and pastes the code back. Claude Code `--no-browser`. Anthropic has **no** RFC 8628 yet (claude-code#22992). |
| 2 | `vendor-cli-import` | no | Run **their** CLI login once, then `zeta-login import`. Used when we do not have (or should not mint) their client_id. |
| 3 | `pkce-localhost` | **yes** | Loopback callback. Gemini CLI default; Grok default `grok login`. Harder on SSH/VMs. |
| 4 | `api-key` | no | Secondary for local vendors (`XAI_API_KEY`, Gemini headless). **Primary** for Manus: account login *is* the key, no extra per-call billing, remote-only. |

## Vendor-CLI import (no reverse engineering)

Shipped: `import-vendor-session.ts` + `zeta-login import <id>`. Parses:

| Vendor | File |
|---|---|
| Codex / OpenAI | `~/.codex/auth.json` (`tokens.access_token`) |
| Claude | `~/.claude/.credentials.json` (`claudeAiOauth`) |
| Grok | `~/.grok/auth.json` |
| Gemini | `~/.gemini/oauth_creds.json` |
| GitHub | `~/.config/gh/hosts.yml` (`oauth_token`) |
| Kiro | `~/.aws/sso/cache/kiro-auth-token.json` |

This is the same move other open harnesses use when they cannot speak a
vendor's OAuth: **Meridian / OCP** wrap `claude` rather than intercepting
OAuth; **OpenCode** plugins do Codex/Gemini OAuth or device-code;
**@vymalo/opencode-oauth2** lists five grants including RFC 8628;
**Grok Build** itself documents `--device-auth` for SSH.

## Slice 0 (landed with this absorb)

`src/Core.TypeScript/model-backend/provider-roster.ts` is the data.
Adding a provider is a roster edit, not a new CLI. `harny` /
`zeta-login` run device flow for `github` and `openai`/`codex`; Manus
stores an account key from `--from-file` and never prints it; anything
else fails closed with `{ error: "no-auth-provider", try: "zeta-login import <id>", next: "081M100RH29087G0R0031HHGJ0" }`.

## Manus is remote-only (may never fit the full loop)

Aaron 2026-08-26: Manus always runs **on their cloud**, never as a local
process on the agent machine. So Harny can hold the account key and
create remote tasks (`manus-task.ts`), but it cannot give Manus Ace or
Zeta verbs, cannot index the local tree for it, and cannot make it a
`loop-tick` cell. If the integration cannot be tight, Manus stays an
adapter, not a Harny-resident agent. That is a fit question, not a
login-gap.

## Indexing is a harness verb (not a full-tree grep)

`harny search` dispatches to `src/Core.TypeScript/search/inverted/` —
the git-native inverted index. An index that is stale **refuses**
rather than claiming absence. This is how Harny avoids the monorepo
full-search tax even before the extract.

## Phase B — published artifacts, after Phase A dogfood

Ace is the bootstrap. Harny is an Ace package, not Ace itself.

1. **Pre-bootstrap** (`081M102M6X5087G0R001VWNYS2`): a published Ace
   binary + pinned one-liner, **or** the smallest toolchain that can
   build Ace from source. `git clone` at a tag still builds without Ace
   on PATH (`.claude/rules/clone-at-tag-stays-sufficient.md`). Ace must
   never become an appointed hub.
2. **Harny extract** (`081M102M6Y2087G0R000407SW3`): first isolated
   published package. Ace installs it. Harny *references* Ace/Zeta as
   packages instead of copying `src/Core.TypeScript/**`. Peer repos
   (Zeta / Forge / Ace / Harny), not submodules — the 2026-04-22 ADR
   cycle cannot be a DAG. Minimize toolchain (Harny: bun/node only) so
   CI cache is per-package, not the whole monorepo.
3. **Later, inside Ace:** Futamura compiler-compiler (`Cogen.fs` /
   `MixCogen.fs` already in-tree). Third bootstrap: Ace stops needing a
   host compiler. Vision register: `docs/VISION.md` §compiler ladder;
   still an **ASPIRATION** for machine-code, **SHIPPED** as mix/cogen
   in F#. Beacon: Futamura 1971, 3rd projection.

This Phase B *is* the start of dogfooding the repo-split design: extract
the thing we are already running, do not invent a fourth factory.
