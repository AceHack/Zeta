# escape=`
# src/Core.TypeScript/ci/dockerfiles/windows-install-ps1-test/Dockerfile
#
# Slice 2c — Server-Core Docker test for tools/setup/install.ps1 (B-0857 Windows parity).
# Validates install.ps1's TOOL-INSTALL GRAPH (scoop -> git/mise -> .mise.toml runtimes ->
# manifests/from-bun-global) on a clean Windows Server Core userspace, then asserts via
# src/Core.TypeScript/ci/windows-install-ps1-smoke.ts --mode container. The user-mode scheduled task is NOT
# covered here — a Windows container has no interactive session; the desktop loop-smoke covers it.
# The smoke PRINTS that skip (not silent)
# per .claude/rules/automated-tests-are-the-shield-assert-dont-skip.md.
#
# Runs on the windows-2025 GitHub runner (process isolation; container OS must match the host).
# Base + runner are a MATCHED PAIR and move together: a newer base on an older runner can't run
# under process isolation. ltsc2025 (Windows Server 2025) pairs with runs-on: windows-2025.
#
# Pins per dep-pin-search-first-authority (WebSearch 2026-05-31):
#   base   — mcr.microsoft.com/windows/servercore:ltsc2025 (current LTSC; there is no 2026 LTSC,
#            and the repo publishes no `latest` tag). Refs:
#            https://hub.docker.com/r/microsoft/windows-servercore +
#            https://learn.microsoft.com/virtualization/windowscontainers/manage-containers/container-base-images
#   runner — windows-2025 (GA 2025-04-08; windows-latest already migrated to Server 2025).
#            Ref: https://github.com/actions/runner-images/issues/11742
# TODO(dep-pin): pin base by sha256 digest at next maintenance (capture from a green CI run);
# the :ltsc2025 tag receives monthly servicing, so a digest gives content-addressed reproducibility.
FROM mcr.microsoft.com/windows/servercore:ltsc2025

# Server Core ships Windows PowerShell 5.1 (NOT pwsh 7). install.ps1 is #Requires 5.1 + 5.1-safe.
SHELL ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue';"]

# Server Core deliberately OMITS the MSVC runtime (vcruntime140.dll etc.) that real Win10/11
# desktops ship. bun.exe needs it — without it `mise exec -- bun` dies with STATUS_DLL_NOT_FOUND
# (0xC0000135 / exit 3221225781), and install.ps1's own `bun install -g claude-code` step fails
# silently (PS 5.1 doesn't fault on a native non-zero exit). This is a SYSTEM runtime that a real
# desktop already has, so it's provisioned in the container harness here -- NOT in install.ps1,
# which is deliberately user-mode/no-admin. Single quotes only (the SHELL -Command wrapper collides
# with double-quoted strings in a RUN). Pin: aka.ms/vs/17/release/vc_redist.x64.exe = Microsoft's
# evergreen latest VC++ 2015-2022 x64 redist (WebSearch 2026-05-31;
# https://learn.microsoft.com/cpp/windows/latest-supported-vc-redist). Exit 1638/3010 = already-
# present / reboot-deferred, both success.
RUN Invoke-WebRequest -UseBasicParsing https://aka.ms/vs/17/release/vc_redist.x64.exe -OutFile C:\vc_redist.x64.exe; `
    $p = Start-Process C:\vc_redist.x64.exe -ArgumentList '/install','/quiet','/norestart' -Wait -PassThru; `
    if ($p.ExitCode -notin 0,1638,3010) { throw ('vc_redist failed with exit ' + $p.ExitCode) }; `
    Remove-Item C:\vc_redist.x64.exe

WORKDIR C:\workspace

# COPY only the install-relevant subset (forward-slash dests are fine on Windows containers;
# avoids invalidating the build cache on unrelated repo changes).
COPY tools/setup C:/workspace/tools/setup
COPY src/Core.TypeScript/ci/windows-install-ps1-smoke.ts C:/workspace/src/Core.TypeScript/ci/windows-install-ps1-smoke.ts
COPY src/Core.TypeScript/persistence/windows C:/workspace/src/Core.TypeScript/persistence/windows
COPY .mise.toml C:/workspace/.mise.toml
COPY package.json C:/workspace/package.json
COPY bun.lock C:/workspace/bun.lock

# EVERY WORKSPACE package.json NAMED IN THE ROOT `workspaces` ARRAY MUST BE COPIED HERE.
# install.ps1:351 runs `bun install --frozen-lockfile`, and bun resolves the root
# manifest's workspace list against the build context. Copying package.json + bun.lock
# without the workspace manifests leaves bun with a lockfile that references a workspace
# the context does not contain, and it fails closed:
#   error: Workspace not found "src/apps/twitch-ai"
# That is exactly what happened when #14303 regenerated bun.lock for the twitch-ai
# workspace (added by #14200/#14253/#14292): the lockfile fix was correct and unblocked
# every OTHER lane, and this one turned red instead, because the Dockerfile's
# "COPY only the install-relevant subset" set was silently no longer sufficient.
#
# So this list is COUPLED to package.json's `workspaces` array and a new workspace breaks
# this lane until a matching COPY lands. The coupling is checked, not trusted --
# windows-dockerfile-workspaces.test.ts derives the expected set from package.json and
# fails when the two disagree, so the next workspace is caught at lint time rather than
# 435 seconds into a Windows container build.
COPY src/apps/twitch-ai/package.json C:/workspace/src/apps/twitch-ai/package.json

# mise's GitHub-API token (the shield's rate-limit fix; sibling to the 4 Unix shields in #6273).
# install.ps1 runs `mise install`, which calls the GitHub API to resolve .mise.toml runtime versions
# from GitHub releases. UNAUTHENTICATED that API is 60 req/hr -> a cold cluster build exhausts it and
# mise gets HTTP 403 (the exact failure the Unix macOS shield hit). AUTHENTICATED it's 5000 req/hr.
#
# WHY MISE_GITHUB_TOKEN (not GITHUB_TOKEN): mise's auth precedence is MISE_GITHUB_TOKEN >
# GITHUB_API_TOKEN > GITHUB_TOKEN. Unix mise.sh auto-PROMOTES GITHUB_TOKEN -> MISE_GITHUB_TOKEN;
# install.ps1 has NO such promotion, so the shield sets the highest-precedence var DIRECTLY.
#
# WHY --build-arg (not BuildKit --mount=type=secret like the Unix shields): the windows-2025 runner
# uses the LEGACY docker builder (see the driver's NOTE), which has no BuildKit secret mounts. ARG
# is the only build-time channel on the classic builder; declared here it is exposed to the install
# RUN below as the $env:MISE_GITHUB_TOKEN build env var (core ARG-to-RUN-env behavior, cross-platform),
# which `mise install` (a child of the RUN's powershell) inherits. It is NOT promoted to a persistent
# ENV (that would bake it into every layer + `docker inspect` Config.Env) — ARG scope keeps it to the
# build only. LEAK MITIGATION: (1) the value is the per-run ephemeral GitHub Actions GITHUB_TOKEN
# (dead the moment the job ends); (2) the driver `docker rmi -f`s this image in cleanup() — its
# `docker history` (where ARG values surface) is discarded in the same job, never pushed; (3) the
# driver REDACTS the value to *** in the build command it logs, and GHA auto-masks GITHUB_TOKEN.
# Empty (local runs without the env var) -> mise stays unauthenticated, identical to prior behavior.
ARG MISE_GITHUB_TOKEN

# Install graph + assert in ONE RUN so install.ps1's in-process PATH additions carry to the smoke.
# Calling bun DIRECTLY is intentional: it proves the installer publishes mise runtime bins instead
# of requiring every later caller to know about `mise exec`. -SkipLoopRegister: no interactive
# session in a container -> the
# user-mode scheduled task isn't registered (desktop loop-smoke covers it). install.ps1 detects
# the admin context (ContainerAdministrator) + passes -RunAsAdmin to the scoop bootstrap.
# install.ps1 uses $ErrorActionPreference='Stop', so any install failure throws -> the build fails.
#
# Propagate the smoke's exit code with `exit $LASTEXITCODE` (NOT a `throw "..."`): the SHELL above
# wraps this whole RUN in powershell -Command "...", and a double-quoted throw message collides
# with that outer quoting (PS then mis-parses the message as commands). exit-code propagation is
# quote-free and the smoke already prints its own FAIL diagnostics. (Server-Core local build
# 2026-05-31: install.ps1 succeeded end-to-end; the quoting bug + missing VC++ runtime were the
# last blockers.)
RUN & 'C:\workspace\tools\setup\install.ps1' -SkipLoopRegister; `
    bun 'C:\workspace\src\Core.TypeScript\ci\windows-install-ps1-smoke.ts' --mode container; `
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

RUN Write-Host "Slice 2c — install.ps1 Server-Core Docker validation COMPLETE"
