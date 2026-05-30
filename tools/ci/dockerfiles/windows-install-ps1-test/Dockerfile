# escape=`
# tools/ci/dockerfiles/windows-install-ps1-test/Dockerfile
#
# Slice 2c — Server-Core Docker test for tools/setup/install.ps1 (B-0857 Windows parity).
# Validates install.ps1's TOOL-INSTALL GRAPH (scoop -> git/mise -> .mise.toml runtimes -> claude)
# on a clean Windows Server Core userspace, then asserts via tools/ci/windows-install-ps1-smoke.ts
# --mode container. The user-mode scheduled task is NOT covered here — a Windows container has no
# interactive session; the desktop loop-smoke covers it. The smoke PRINTS that skip (not silent)
# per .claude/rules/automated-tests-are-the-shield-assert-dont-skip.md.
#
# Runs on the windows-2022 GitHub runner (process isolation; container OS must match the host).
# windows-latest moved to Server 2025, which REMOVED servercore:ltsc2022 — so the workflow pins
# runs-on: windows-2022. (WebSearch 2026-05-30: actions/runner-images + scoop.sh.)
#
# Base image pin per dep-pin-search-first-authority (WebSearch 2026-05-30 — https://scoop.sh/ +
# https://learn.microsoft.com/windows/package-manager/ + actions/runner-images). TODO(dep-pin):
# pin by sha256 digest at next maintenance (capture the resolved digest from a green CI run);
# the :ltsc2022 tag receives monthly servicing, so a digest gives content-addressed reproducibility.
FROM mcr.microsoft.com/windows/servercore:ltsc2022

# Server Core ships Windows PowerShell 5.1 (NOT pwsh 7). install.ps1 is #Requires 5.1 + 5.1-safe.
SHELL ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue';"]

WORKDIR C:\workspace

# COPY only the install-relevant subset (forward-slash dests are fine on Windows containers;
# avoids invalidating the build cache on unrelated repo changes).
COPY tools/setup C:/workspace/tools/setup
COPY tools/ci/windows-install-ps1-smoke.ts C:/workspace/tools/ci/windows-install-ps1-smoke.ts
COPY tools/persistence/windows C:/workspace/tools/persistence/windows
COPY .mise.toml C:/workspace/.mise.toml
COPY package.json C:/workspace/package.json

# Install graph + assert in ONE RUN so install.ps1's in-process PATH additions (scoop + mise
# shims) carry to the smoke. -SkipLoopRegister: no interactive session in a container -> the
# user-mode scheduled task isn't registered (desktop loop-smoke covers it). install.ps1 detects
# the admin context (ContainerAdministrator) + passes -RunAsAdmin to the scoop bootstrap.
# install.ps1 uses $ErrorActionPreference='Stop', so any install failure throws -> the build fails.
RUN & 'C:\workspace\tools\setup\install.ps1' -SkipLoopRegister; `
    mise exec -- bun 'C:\workspace\tools\ci\windows-install-ps1-smoke.ts' --mode container; `
    if ($LASTEXITCODE -ne 0) { throw "windows-install-ps1-smoke (container mode) failed (exit $LASTEXITCODE)" }

RUN Write-Host "Slice 2c — install.ps1 Server-Core Docker validation COMPLETE"
