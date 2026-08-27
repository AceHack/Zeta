# Trajectory — Harny (custom agent harness)

Status: active — workstream (current-focus)
Last refreshed: 2026-08-27
Type: workstream (current-focus)
Current blocker: five of seven paid LLM accounts have no native `AuthProvider`; production `loop-tick` still spawnSyncs vendor CLIs. Token **import** from those CLIs is now a shipped fallback.
Next concrete action: wire our own device-code where the vendor publishes it (Grok auth.x.ai, Kiro `--use-device-flow`) — `081M100RH29087G0R0031HHGJ0` — in parallel with ForgeHost without `gh`
Evidence links: umbrella `081M100RB97087G0R0008EAAY7` · `src/Core.TypeScript/model-backend/` · `docs/ROADMAP.md` item 1 (NO GIT CLI)

## Why this exists

Aaron 2026-08-26: this is our **custom agent harness**. Run **all** paid
agents on it, with **account logins** (API keys secondary). Prefer **device
login** (RFC 8628) for GitHub and any vendor that has it — that is the
remote / no-local-browser path. If they have no device grant, use the next
smoothest account OAuth (paste-code on any phone/laptop, not a browser on
the agent machine). If we cannot reverse their login, **use their CLI once
and import the token**. GitHub tokens instead of `gh`. Tools only via **our**
CLIs: Ace = deps, Zeta = source control + filesystem.

Daily identities we already pay for: grok, claude, openai, manus, gemini,
codex, kiro.

**Observe is the controller; Harny is not a second one.**
`src/Core.TypeScript/observe/observe.ts` is already the external harness
around vendor executors (`kiro-executor.ts`, `subscription-executor.ts`):
pure `World → NextAction`, Xbox `grammar-16.ts` (ADR 2026-05-31).
Meijer μF/νF: World snapshot is μ (fold); standing query/webhook is ν
(unfold); Bonsai stores the μ generator of a ν process. Reservoir
computing (Jaeger 2001 / Maass 2002): DU grammar + workflows are
**walls**; `observe()` is the **readout** — do not train the reservoir
by giving the model a bag of polls. Cheap forge observe is a World
channel (`forgeState`), not a tool the LLM picks.

## Where we are (honest)

The harness **library** is real. The fleet **runtime** is still vendor CLIs.

| Layer | State | Evidence |
|---|---|---|
| Hexagonal `AuthProvider` | port complete | `auth-provider.ts` — device-code + PKCE + refresh |
| OpenAI / Codex account | ✅ wired | `openai-auth.ts`, live summon 2026-07-04 |
| GitHub account | ✅ wired | `github-auth.ts` + `github-login-cli.ts` (PRs #9549–#9551). Token for forge work: store then env, never `gh auth token`. `GitHubAdapter` list/get/create PR is REST. |
| Claude / Grok / Gemini / Kiro | ○ declared | roster only; no AuthProvider |
| Manus | ✅ account API key, remote-only | `harny login manus --from-file` → store; `manus-task.ts` still Keychain at the edge until it reads the store |
| Full-duplex four-corner | ◐ library | `duplex-transport.ts` + WS mux; vendor APIs still SSE/HTTP |
| Closed tools | ◐ library | `ZETA_TOOLS` = `fs_*`/`db_*` in-memory; fleet uses bash/gh/git |
| Ace (deps) | ◐ dogfooded for setup | `ace.ts` + `setup-realize.ts`; agents still call bun/mise/brew |
| Zeta CLI (sc/fs) | ◐ library | LibGit2Sharp `zeta` is v1; `ZetaFsDualFold` + `ZetaFsDeltaLog` + `DagFs` is the destination (own Merkle, not git packfiles). Factory still `git`/`gh`. `081M108RYNT087G0R001JSRNZE` |
| Indexing | ◐ in-tree | `harny search` → `search/inverted` (refuses on stale empty) |
| loop-tick | ○ vendor default | `persona-registry.ts` harness.command = claude/codex/kiro-cli/agy/cursor-agent |

Login ladder (remote-first): `device-code` > `paste-code` > `vendor-cli-import`
> `pkce-localhost` > `api-key`. Encoded in `login-ladder.ts`.

Slice 0: roster + `harny list|status|login|token|search` (`zeta-login` is
the same login surface). Wired native device login: `github`,
`openai`/`codex`. Wired account API key: `manus` (`--from-file`, remote-only).

Slice 0b: `harny import <provider>` copies a session the **vendor CLI**
already minted (`~/.grok/auth.json`, `~/.codex/auth.json`, Claude creds,
Gemini `oauth_creds.json`, gh `hosts.yml`, Kiro SSO cache). No reverse
engineering of their OAuth client_id.

```text
bun src/Core.TypeScript/harny/harny.ts list --json
bun src/Core.TypeScript/harny/harny.ts login github
bun src/Core.TypeScript/harny/harny.ts login openai
bun src/Core.TypeScript/harny/harny.ts login manus --from-file ./manus.key
bun src/Core.TypeScript/harny/harny.ts search landauer
# remote box, vendor already logged in:
grok login --device-auth          # their CLI, phone-approve
bun src/Core.TypeScript/harny/harny.ts import grok
```

## Roadmap

### Phase A — dogfood Harny in this monorepo (now)

1. **Native device/OAuth for remaining local vendors** — `081M100RH29087G0R0031HHGJ0`
2. **ForgeHost without `gh`** — `081M100RB9Z087G0R000GWY1MM`
   (cheap merge-observe is one GraphQL DU, not N polls —
   `081M107N9P4087G0R0002G5SR0`)
3. **Closed tools = Ace + Zeta + Forge DU verbs on the Xbox ActionGrid** —
   `081M100RH3Q087G0R0018X4RSJ` · `081M107N9PZ087G0R0006X16SJ`
   Git/fs through ZetaFS is ROADMAP item 1: dual Z-set folds
   (`+1` `I` forward, `−1` generator-reinterpret of retained history)
   over DagFs Merkle — not LibGit2Sharp-as-the-store.
   `081M108RYNT087G0R001JSRNZE`.
   Full −1 of the view is **erasing**; `SoftValue.widen` is **non-erasing**
   of support; negate alone is Bennett-free (`081M10BD9BM087G0R001SGDRXT`).
4. **loop-tick default `mux-duplex`** (Manus stays a remote task, not this loop) — `081M100RH30087G0R003YXHQ12`
   Self-prediction of the tick uses the no-`app` Kleisli close:
   `FourCornerTrace` on VALUE, ISR `>=>` on interrupts, DoP=1 ferry,
   `SchedulerZeta.predict` / `Chip8Observer.predict`. Consistent-with,
   not one type. `081M10AZ6KS087G0R0000SSFMH`.

Phase A done when a Riven/Otto/Vera cell completes a **local** tool-using
turn on Harny with a stored account token, no vendor CLI, no `gh`.
Manus is a **remote-only** adapter (`harny login manus --from-file`):
account API key with no extra per-call billing, but no local Ace/Zeta
tools — it may never fit the full loop.

### Phase B — split into published artifacts (after A)

Ace is the bootstrap. Harny is an Ace package, not Ace itself.

1. **Ace pre-bootstrap** — `081M102M6X5087G0R001VWNYS2`
   - published Ace binary + pinned one-line installer, **or**
   - pre-bootstrap (minimal toolchain to build Ace from source)
   - `git clone` at a tag still builds without Ace on PATH
   - later: Futamura compiler-compiler *inside Ace* (`Cogen.fs` /
     `MixCogen.fs`) as a third bootstrap so Ace stops needing a host
     compiler
2. **Harny as the first extract** — `081M102M6Y2087G0R000407SW3`
   - isolated package, small CI, indexing included (`search/inverted`)
   - Ace *installs* Harny; Harny *references* Ace/Zeta as packages
   - peer repos (Zeta / Forge / Ace / Harny), not submodules — the
     2026-04-22 ADR cycle cannot be a DAG
   - minimize toolchain per package (Harny: bun/node only)
   - cuts the monorepo cache tax
3. **More granular splits after Harny** — `081M10AAVAT087G0R0027M0GV5`
   - Data Vault 2.0 by change rate *and* toolchain closure (round 3)
   - dozens of peer repos expected; dogfood in-tree, then extract
   - DUs expand to DynamicValue + SoftValue (`DuExpand`) so a local
     verb is a global Bayesian/Z-set effect
   - cutover is ADR 2026-08-26 (gated; no repo created from a chat)

Phase B dogfoods the repo-split design by extracting the thing we are
already running, not by inventing a fourth factory. The concert is
**local actions → global effects**.

## Pointers

- Research absorb: `docs/research/2026-08-26-own-harness-account-logins-ace-zeta-clis-not-platform.md`
- ZetaFS dual fold: `docs/research/2026-08-26-zetafs-dual-fold-git-replacement.md` · `src/Core/ZetaFsDualFold.fs`
- Erasing vs widen: `docs/research/2026-08-26-full-minus-erasing-widen-nonerasing.md` · `src/Core/RetractionReading.fs`
- No-`app` needle: `docs/research/2026-08-26-no-app-kleisli-isr-fourcornertrace-self-predict.md` · `IntrCtx.fs` · `IsrLift.fs` · `SchedulerZeta.fs`
- Dogfood ledger Tier 0: `docs/trajectories/dogfooding-the-whole-stack/RESUME.md`
- Repo split ADR: `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`
- Cutover sequence: `docs/DECISIONS/2026-08-26-multi-repo-and-hat-credential-cutover-sequence.md`
- DU expand / local→global: `docs/research/2026-08-26-du-expand-dynamicvalue-softvalue-granular-repo-splits.md` · `src/Core/DuExpand.fs`
- Clone-at-tag: `.claude/rules/clone-at-tag-stays-sufficient.md`
- Index: `src/Core.TypeScript/search/inverted/`
- CLI: `src/Core.TypeScript/harny/harny.ts`
- Cheap forge verbs: `docs/research/2026-08-26-cheap-forge-verbs-du-observe-not-adhoc-poll.md`
- Observe controller: `src/Core.TypeScript/observe/observe.ts` · `grammar-16.ts`
- UAG / Xbox grid: `src/Core/ActionGrid.fs`
- Reservoir walls: `docs/research/2026-05-28-aaron-workflow-as-reservoir-computing-*`
- μF/νF: `docs/research/2026-08-11-rename-as-rolling-migration-*`
