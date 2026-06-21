# Windows `install.ps1` + cross-edition test matrix — implementation plan

> **For agentic workers:** implement task-by-task; steps use `- [ ]` checkboxes.
> Discipline anchors: `.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md`
> (every test **asserts**, never skips-to-green), `.claude/rules/rule-0-no-sh-files.md`
> (TS for tooling; `.ps1` is the Windows install-graph analog of the `.sh` install-graph,
> which is the sanctioned exception), `.claude/rules/dep-pin-search-first-authority.md`
> (pin base images + tool versions, cite the source).

**Goal:** Give Zeta a user-mode, **declarative** Windows install entry (`install.ps1`) with
parity to `tools/setup/install.sh` → `macos.sh`, and a cross-Windows-edition test matrix that
**asserts** it works on **Windows Server** (free GitHub-hosted Docker) and **consumer desktop /
Win 11** (this laptop, loop-driven now + restricted self-hosted runner later).

**Architecture:** `install.ps1` mirrors `macos.sh`'s graph and stays **declarative + symmetric**
with the Unix manifests (operator 2026-05-30): a `manifests/windows` package manifest drives a
**scoop → winget → chocolatey** resolver (scoop primary: user-mode, no admin, AI-native;
winget/choco fallback). Language/runtime tools stay identical to Unix — mise (`.mise.toml`),
`manifests/dotnet-tools`, `manifests/uv-tools`, bun-global for claude — so the tool set is kept
**in sync and symmetric** across OSes. Loop registration reuses the already-shipped
`install-scheduled-task.ts` (schtasks ≈ launchd).

**Tech stack:** PowerShell 5.1+ (`install.ps1`), scoop/winget/choco (system pkgs), mise
(cross-platform runtimes), bun + TypeScript (test runners), Windows Server Core container
(`mcr.microsoft.com/windows/servercore`), GitHub Actions `windows-2022` (hosted, ephemeral).

---

## Symmetry principle (operator 2026-05-30)

> "declarative just like those systems … scoop, then winget, then chocolatey as the primary
> package source outside of like npm and such; we will use mise and all that just the same;
> keep the tools in sync and symmetric."

| Layer | Unix (apt/brew) | Windows | Symmetric? |
|---|---|---|---|
| System CLI tools | `manifests/apt`, `manifests/brew` | `manifests/windows` (scoop→winget→choco) | same manifest concept, per-OS source |
| Runtimes (dotnet/python/java/bun/uv) | `.mise.toml` via mise | `.mise.toml` via mise | **identical file** |
| dotnet global tools | `manifests/dotnet-tools` | `manifests/dotnet-tools` | **identical file** |
| uv Python tools | `manifests/uv-tools` | `manifests/uv-tools` | **identical file** |
| claude-code | `bun install --global` | `bun install --global` | **identical** |
| background loop | launchd LaunchAgent | schtasks (`install-scheduled-task.ts`) | parity, per-OS mechanism |

**Package-source priority (operator 2026-05-30): cross-platform first.** Prefer **mise** (runtimes
and CLI tools via its aqua / ubi / cargo / npm / pipx / go backends) and **npm / `bun --global`**
(node-ecosystem CLIs) — these install *identically* on every OS, so they maximize symmetry. Drop to
an OS-specific source (**scoop → winget → choco** on Windows; brew/apt on Unix) *only* for the
irreducible remainder no cross-platform source provides. So `manifests/windows` should stay
**minimal** — most tools belong in `.mise.toml` / a shared npm-global manifest (identical across
OSes). The symmetry test (Slice 2a Step 6) asserts `manifests/windows` covers the same logical
OS-specific tools as `manifests/brew`/`apt`, AND flags any tool that should have been promoted to
the cross-platform (mise/npm) layer.

---

## Coverage matrix (the shield — what asserts what)

| Surface | Editions | Covers | Does NOT cover | Where |
|---|---|---|---|---|
| Server-Core Docker | Windows Server | scoop/winget resolve, system tools, mise runtime pins, claude install | user-mode scheduled task (no interactive session in a container) | `windows-2022` hosted runner (free, ephemeral, fork-PR-safe) |
| Desktop loop-smoke | Win 10/11 client | full graph **incl.** `ZetaOttoLoop` registration + per-minute auto-fire | nothing additional — complete check | this laptop, loop-driven, `origin/main`-only |
| Restricted self-hosted runner (later) | Win 10/11 client | same as loop-smoke, PR-gated | n/a | this laptop, `workflow_dispatch`/main-push only, **never** fork `pull_request` |

Neither surface pretends to cover the other (shield-honesty): the container's loop-task gap is a
documented *printed* skip-with-reason, never a silent green.

---

## File structure

- Create: `tools/setup/manifests/windows` — declarative system-tool manifest (scoop-primary, optional `winget=`/`choco=` ID overrides).
- Create: `tools/setup/install.ps1` — Windows install-graph entry; parses `manifests/windows` + resolves scoop→winget→choco; then mise + dotnet-tools + uv-tools + claude + loop register. Idempotent.
- Modify: `tools/setup/install.sh` — MINGW/MSYS detection in the `*)` arm → route to `install.ps1` (parity with the NixOS-live routing stub; `exit 2`).
- Create: `tools/ci/windows-install-ps1-smoke.ts` (+ `.test.ts`) — assertion smoke reused by loop (desktop) + Docker (container).
- Create: `tools/ci/manifest-symmetry.test.ts` — asserts `manifests/windows` covers the same logical tools as `manifests/brew`/`apt`.
- Create: `tools/ci/dockerfiles/windows-install-ps1-test/Dockerfile`, `tools/ci/docker-windows-install-ps1-test.ts`, `.github/workflows/docker-windows-install-ps1-test.yml`.
- Modify: `tools/persistence/windows/otto-loop-wrapper.ps1` — gated desktop-smoke step.
- Modify: `tools/persistence/windows/README.md` — document `install.ps1` + coverage matrix.

---

## Slice 2a — declarative `install.ps1` + `manifests/windows` (build first)

**Files:** Create `tools/setup/manifests/windows`, `tools/setup/install.ps1`; Modify `tools/setup/install.sh`.

- [ ] **Step 1 — Manifest** `tools/setup/manifests/windows` (declarative, symmetric with `manifests/brew`):

```
# tools/setup/manifests/windows — declarative Windows system CLI tools.
# Resolver priority: scoop -> winget -> chocolatey (operator 2026-05-30). scoop is
# primary (user-mode, no admin). Format per line:  <scoop-id> [winget=<id>] [choco=<id>]
# winget/choco overrides optional (default to <scoop-id>). `#` comments + blank lines ignored.
# Runtimes/lang tools are NOT here — they live in .mise.toml / manifests/dotnet-tools /
# manifests/uv-tools (identical to Unix). Keep this in sync with manifests/brew + manifests/apt.
git    winget=Git.Git    choco=git
```

- [ ] **Step 2 — `install.ps1`** parses the manifest + resolves per priority (mirrors `macos.sh`'s brew-manifest loop; strips `#` comments + trims, like the awk in `macos.sh`):

```powershell
#Requires -Version 5.1
# tools/setup/install.ps1 — Windows user-mode, DECLARATIVE install-graph entry (parity with
# tools/setup/install.sh -> macos.sh). System pkgs: scoop -> winget -> choco (operator 2026-05-30).
# Runtimes via mise/.mise.toml; dotnet/uv tools + claude identical to Unix. Idempotent.
[CmdletBinding()] param([switch]$SkipLoopRegister)
Set-StrictMode -Version Latest; $ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
function Have($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }

# 1. scoop (user-mode; no admin). Download-then-exec (NOT pipe-to-shell) — mirrors macos.sh's
# Homebrew 081KQ8P5D0008QG0R001DMK8JD pattern: fetch to a temp .ps1, verify non-empty, run the local file.
if (-not (Have scoop)) {
  $scoopTmp = Join-Path $env:TEMP "scoop-install-$([guid]::NewGuid()).ps1"
  try {
    Invoke-RestMethod -Uri https://get.scoop.sh -OutFile $scoopTmp
    if (-not (Test-Path $scoopTmp) -or (Get-Item $scoopTmp).Length -eq 0) { throw "scoop installer empty; refusing to run" }
    & $scoopTmp
  } finally { Remove-Item $scoopTmp -Force -ErrorAction SilentlyContinue }
}

# 2. system tools from manifests/windows (scoop -> winget -> choco)
foreach ($raw in Get-Content "$RepoRoot\tools\setup\manifests\windows") {
  $line = ($raw -replace '#.*$','').Trim(); if (-not $line) { continue }
  $parts = $line -split '\s+'; $scoopId = $parts[0]
  $winget = ($parts | Where-Object { $_ -like 'winget=*' }) -replace 'winget=',''
  $choco  = ($parts | Where-Object { $_ -like 'choco=*'  }) -replace 'choco=',''
  $wid = if ($winget) { $winget } else { $scoopId }   # if/else (5.1-safe; NOT the 7+ ?: ternary)
  $cid = if ($choco)  { $choco }  else { $scoopId }
  if     (Have scoop)  { scoop install $scoopId }
  elseif (Have winget) { winget install --id $wid --silent --accept-package-agreements --accept-source-agreements }
  elseif (Have choco)  { choco install $cid -y }
  else   { throw "no package source (scoop/winget/choco) available for $scoopId" }
}

# 3. runtimes + lang tools — IDENTICAL to Unix (symmetric)
& mise install                                              # .mise.toml: dotnet/python/java/bun/uv
& bun install --global '@anthropic-ai/claude-code'          # claude-code
# (dotnet-tools / uv-tools manifests applied here too, mirroring common/dotnet-tools.sh etc.)

# 4. register the per-minute loop unless skipped
if (-not $SkipLoopRegister) { & bun "$RepoRoot\tools\persistence\windows\install-scheduled-task.ts" --register }
```

- [ ] **Step 3 — Pin/verify** scoop install URL (`get.scoop.sh`) + winget/choco IDs per `dep-pin-search-first-authority.md`; cite in comments. (mise/bun/dotnet pins inherited from `.mise.toml` — no second pin.)
- [ ] **Step 4 — `install.sh` Windows-routing stub**: `*)` arm detects `MINGW*`/`MSYS*`/`CYGWIN*` from `uname -s` → "run `pwsh tools/setup/install.ps1`" + `exit 2` (parity with NixOS-live guard). Non-Windows-unknown keeps `exit 1`.
- [ ] **Step 5 — Manual run** on this laptop: `pwsh tools/setup/install.ps1 -SkipLoopRegister` twice → idempotent, exit 0 both times.
- [ ] **Step 6 — Symmetry test** `tools/ci/manifest-symmetry.test.ts` (TDD): assert every logical tool in `manifests/brew`/`apt` has a counterpart in `manifests/windows` (allowlist OS-specific exceptions). Fails loud on drift — keeps the OSes "in sync and symmetric."
- [ ] **Step 7 — Commit** `feat(setup): declarative install.ps1 + manifests/windows (scoop->winget->choco)`.

## Slice 2b — desktop loop-smoke (the "smoke now" path)

**Files:** Create `tools/ci/windows-install-ps1-smoke.ts` + `.test.ts`; Modify `otto-loop-wrapper.ps1`.

- [ ] **Step 1 — TDD assertion helpers** (`.test.ts` first): `assertCommandOnPath(name)`, `assertMiseRuntime(name, semverPrefix)`, `assertLoopTaskHealthy(queryXml, verOutput)` (parses `schtasks /Query /XML` + `/V` → asserts `<Duration>` present AND `Next Run Time != N/A`). Run → fails (unimplemented).
- [ ] **Step 2 — Implement** so tests pass. `--mode desktop` asserts full set incl. loop-task; `--mode container` asserts everything **except** loop-task (printed skip + reason — not silent). Exit non-zero on any failed assert.
- [ ] **Step 3 — Wire the loop**: in `otto-loop-wrapper.ps1`, gated `if ($env:ZETA_RUN_DESKTOP_SMOKE)` runs `bun ...windows-install-ps1-smoke.ts --mode desktop`, writes `desktop-smoke.json`, folds pass/fail into the heartbeat disposition. Best-effort, never fails the tick, default off.
- [ ] **Step 4 — Verify live**: enable env, one tick, confirm all-pass JSON + (break a check → asserts fail → restore).
- [ ] **Step 5 — Commit** `feat(ci): windows install.ps1 desktop loop-smoke (asserts loop-task health)`.

## Slice 2c — Server-Core Docker test (free hosted CI)

**Files:** Dockerfile, `docker-windows-install-ps1-test.ts`, workflow.

- [ ] **Step 1 — Dockerfile** mirroring the NixOS one: `FROM mcr.microsoft.com/windows/servercore:ltsc2022@sha256:<pinned>` (WebSearch + pin by digest); install bun; `COPY tools/setup tools/persistence tools/ci .mise.toml package.json`; `RUN pwsh install.ps1 -SkipLoopRegister`; assertion `RUN`s via `windows-install-ps1-smoke.ts --mode container`. Build fails on any miss.
- [ ] **Step 2 — Orchestrator** `docker-windows-install-ps1-test.ts` (+ `.test.ts` for arg helpers), mirroring `docker-nixos-install-sh-test.ts`.
- [ ] **Step 3 — Workflow** `runs-on: windows-2022`, `push`/`pull_request` (hosted = ephemeral = fork-PR-safe). Document the no-interactive-session/no-loop-task gap inline.
- [ ] **Step 4 — Iterate** to green-by-assertion (break a check → build fails → restore).
- [ ] **Step 5 — Commit** `feat(ci): Server-Core Docker test for install.ps1 (asserts tool-install graph)`.

## Slice 2d — restricted self-hosted runner (LATER, your go)

- [ ] **Step 1 — Doc** the registration + hard guard: runner labeled `windows-desktop`; desktop-CI workflow triggers **only** `workflow_dispatch` + main-repo `push`; **never** fork `pull_request` (GitHub's public-repo self-hosted footgun). Note: ServiceTitan is pro-OSS — this guard is about the GitHub fork-PR *mechanic*, not company stance; still respects the AV/EDR/NAC boundary.
- [ ] **Step 2 — Hold** for explicit authorization before registering anything.

---

## Self-review

- **Spec coverage:** declarative + scoop→winget→choco + symmetric (2a, symmetry principle) ✓; approach 1 / both mechanisms (2b now, 2d later) ✓; Server coverage (2c) ✓; install.ps1 exists before its tests (2a first) ✓.
- **Shield rule:** every test asserts + fails loud; container loop-task gap is a documented printed skip ✓; symmetry test fails on tool drift ✓.
- **Symmetry:** runtimes/dotnet/uv/claude use the *identical* Unix files; only `manifests/windows` is net-new; symmetry test guards drift ✓.
- **Public-repo/corporate constraint:** Server on ephemeral hosted runner; desktop on `origin/main`-only loop; self-hosted gated + fork-PR-excluded ✓.
- **Rule-0:** `.ps1` = sanctioned Windows install-graph analog; all tooling/tests `.ts` ✓.

## Execution handoff

Inline execution, slice by slice, checkpoint-commit after each slice (review 2a before 2b/2c
build on it). Slice 2d holds for explicit go.
