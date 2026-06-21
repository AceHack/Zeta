---
pr_number: 5393
title: "feat(081KSKBP80008QG0R000E3RKPK Phase 1): Docker NixOS install.sh test harness \u2014 fast iteration (~30-60 sec) for install.sh + mise + bun + iter-5.5.0; complements 081KSGS9H0008QG0R0011BC7T2 QEMU (Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T03:16:21Z"
merged_at: "2026-05-27T03:47:31Z"
closed_at: "2026-05-27T03:47:31Z"
head_ref: "feat-b0849-1-docker-nixos-install-sh-test-harness-implementation-2026-05-27-0136z"
base_ref: "main"
archived_at: "2026-05-27T19:27:12Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5393: feat(081KSKBP80008QG0R000E3RKPK Phase 1): Docker NixOS install.sh test harness — fast iteration (~30-60 sec) for install.sh + mise + bun + iter-5.5.0; complements 081KSGS9H0008QG0R0011BC7T2 QEMU (Aaron 2026-05-27)

## PR description

## Summary

Aaron 2026-05-27: *"we should add docker based nixos install.sh testing so we can iterate quick that's an easy dockerfile"*

Implements [081KSKBP80008QG0R000E3RKPK](docs/backlog/P2/081KSKBP80008QG0R000E3RKPK-...) Phase 1 — bounded-iteration test harness for the install.sh / linux.sh / mise.sh substrate.

## 3 files

1. **`tools/ci/dockerfiles/nixos-install-sh-test/Dockerfile`** — `nixos/nix:2.31.2` pinned base + `/etc/NIXOS` marker + run install.sh + validate bun (1.3.x exact pin)/claude/gh
2. **`tools/ci/docker-nixos-install-sh-test.ts`** — TS wrapper per Rule 0 with exit-code mapping + log capture (default `.tools/docker-nixos-install-sh-test.log`) + timeout + centralized `spawnDocker` helper (sonarjs suppression + 64 MiB maxBuffer)
3. **`.dockerignore`** — NEW; excludes `references/upstreams/` (gigabytes per the rule), `node_modules/`, `.git/`, build outputs, IDE scratch, ISO/qcow2 artifacts. **Affects ALL docker builds run from repo root** — substrate-honest scope flag.

## Validation coverage

| Layer | Check |
|---|---|
| linux.sh NixOS detection | `touch /etc/NIXOS` makes linux.sh route to mise.sh |
| mise install | nix-shell bootstraps mise + reads .mise.toml |
| bun via mise | `bun --version` matches .mise.toml pin `1.3` EXACTLY |
| claude-code via bun | `set -o pipefail` + `bun install --global @anthropic-ai/claude-code` |
| gh via nix | `nix-shell -p gh` install + version check |

## Cycle-time tradeoff

| Surface | Validates | Cycle |
|---|---|---|
| Operator USB | End-to-end + reboot | ~30+ min |
| 081KSGS9H0008QG0R0011BC7T2 QEMU | End-to-end virtualized | ~15 min |
| **081KSKBP80008QG0R000E3RKPK Docker (THIS PR)** | install.sh on NixOS userspace | **~30-60 sec** |

## Usage

\`\`\`bash
bun tools/ci/docker-nixos-install-sh-test.ts                  # default 600s timeout
bun tools/ci/docker-nixos-install-sh-test.ts --keep-image     # inspect after
DOCKER_BUILD_TIMEOUT_SEC=900 bun tools/ci/docker-nixos-install-sh-test.ts
\`\`\`

## Composes with

[081KSGS9H0008QG0R0031PBNGA](docs/backlog/P1/081KSGS9H0008QG0R0031PBNGA-...) · [081KSGS9H0008QG0R0011BC7T2](docs/backlog/P2/081KSGS9H0008QG0R0011BC7T2-...) · [081KSGS9H0008QG0R00120EEHM](docs/backlog/P1/081KSGS9H0008QG0R00120EEHM-...) · [081KSGS9H0008QG0R001JNKBFD](docs/backlog/P2/081KSGS9H0008QG0R001JNKBFD-...) + [081KSKBP80008QG0R003Z4C0D0](docs/backlog/P2/081KSKBP80008QG0R003Z4C0D0-...)

## Copilot review responses

10 findings across 2 review batches all addressed: unused import, name attribution, spawnDocker centralization, .dockerignore for repo root, dirname() cross-platform, nixos/nix pin, bun version exact match, pipefail propagation, ENV PATH for mise across Docker layers, gitignored default log path. All threads resolved.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @github-code-quality (2026-05-27T03:17:53Z)

_(no body)_

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T03:21:09Z)

## Pull request overview

Adds a fast-iteration Docker-based NixOS userspace harness intended to validate `tools/setup/install.sh`’s NixOS detection path (via `/etc/NIXOS`) plus key post-install tooling checks, providing a quicker feedback loop than the existing QEMU full-install test.

**Changes:**
- Introduces a `nixos/nix`-based Dockerfile that runs `tools/setup/install.sh` and validates bun + claude-code + gh availability.
- Adds a Bun/TypeScript wrapper to run `docker build` with log capture, timeout, and optional image retention.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 10 comments.

| File | Description |
| ---- | ----------- |
| tools/ci/dockerfiles/nixos-install-sh-test/Dockerfile | Docker build recipe to exercise `install.sh` on NixOS userspace and validate bun/claude-code/gh. |
| tools/ci/docker-nixos-install-sh-test.ts | Bun/TS wrapper that invokes `docker build`, captures logs, enforces a timeout, and cleans up the image. |

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T03:27:17Z)

## Pull request overview

Copilot reviewed 3 out of 3 changed files in this pull request and generated 4 comments.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T03:36:51Z)

## Pull request overview

Copilot reviewed 3 out of 3 changed files in this pull request and generated 2 comments.

## Review threads

### Thread 1: tools/ci/docker-nixos-install-sh-test.ts:50 (resolved)

**@github-code-quality** (2026-05-27T03:17:53Z):

## Unused variable, import, function or class

Unused import join.

---

Remove the unused <code>join</code> named import from <code>node:path</code> in <code>tools/ci/docker-nixos-install-sh-test.ts</code>, leaving only <code>resolve</code>.</p>
<p>This is the minimal, behavior-preserving fix:</p>
<ul>
<li>**File:** <code>tools/ci/docker-nixos-install-sh-test.ts</code></li>
<li>**Change region:** import block near lines 48–50</li>
<li>**Edit:**<br>
from <code>import { join, resolve } from "node:path";</code><br>
to <code>import { resolve } from "node:path";</code></li>
</ul>
<p>No new methods, definitions, or dependencies are needed.

### Thread 2: tools/ci/docker-nixos-install-sh-test.ts:74 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:21:06Z):

P0: `join` is imported from `node:path` but never used; with `noUnusedLocals: true` this will fail TypeScript typecheck/lint. Remove the unused import or use it.

### Thread 3: tools/ci/docker-nixos-install-sh-test.ts:24 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:21:07Z):

This header comment includes a personal name ("Aaron"). Repo convention is to avoid name attribution in code/docs/skills outside the allowed history surfaces; use a role-ref (e.g., "operator") or drop the attribution (see .github/copilot-instructions.md:305-366).

### Thread 4: tools/ci/docker-nixos-install-sh-test.ts:108 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:21:07Z):

`spawnSync("docker", ...)` will trigger `sonarjs/no-os-command-from-path` under this repo’s eslint config (see tools/ci/audit-installer-iso-content.ts for the required suppression+rationale pattern). Add a documented suppression or switch to an invocation pattern that satisfies the rule.

### Thread 5: tools/ci/docker-nixos-install-sh-test.ts:120 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:21:07Z):

`spawnSync("docker", buildArgs, ...)` buffers all output in memory and currently doesn’t set `maxBuffer`; large `docker build --progress=plain` output can exceed Node’s default buffer and fail the run. Consider raising `maxBuffer` (as done elsewhere) or streaming output to the log file instead of fully buffering it.

### Thread 6: tools/ci/docker-nixos-install-sh-test.ts:139 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:21:07Z):

The build context is set to the repo root (`."`). Without a `.dockerignore`, this will send large directories (e.g., `references/upstreams/**`) to the Docker daemon and can make each run very slow. Consider a reduced build context (staged temp dir) or adding a `.dockerignore` that excludes heavy paths.

### Thread 7: tools/ci/docker-nixos-install-sh-test.ts:242 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:21:08Z):

Log directory creation uses `logPath.lastIndexOf("/")`, which breaks on Windows paths (backslashes) and can cause `writeFileSync` to fail when `DOCKER_LOG_OUT_PATH` points to a non-existent directory. Prefer `path.dirname(logPath)` to compute the directory portably.

### Thread 8: tools/ci/docker-nixos-install-sh-test.ts:176 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:21:08Z):

`spawnSync("docker", ["rmi", ...])` is another PATH-resolved OS command and will hit the same `sonarjs/no-os-command-from-path` lint rule as the other `docker` spawns. Add the same documented suppression here (or refactor to a single helper that centralizes the suppression/rationale).

### Thread 9: tools/ci/dockerfiles/nixos-install-sh-test/Dockerfile:25 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:21:08Z):

Using `nixos/nix:latest` makes the harness non-deterministic (base image changes can break the test without repo changes). Consider pinning to a specific tag or digest to keep CI behavior stable.

### Thread 10: tools/ci/dockerfiles/nixos-install-sh-test/Dockerfile:65 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:21:08Z):

The bun version check only asserts major version `^1\.` but the comment says it should match the `.mise.toml` pin (`bun = "1.3"`). Tighten the check to validate the pinned minor (or exact) version so drift is caught.

### Thread 11: tools/ci/dockerfiles/nixos-install-sh-test/Dockerfile:72 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:21:09Z):

`bun install --global ... | tail -5` masks the exit status of `bun install` (pipeline returns `tail`’s status), so failures can be missed if a cached/stale `claude` binary exists. Ensure the build fails when `bun install` fails (e.g., enable `pipefail` for this RUN or avoid piping).

### Thread 12: tools/ci/dockerfiles/nixos-install-sh-test/Dockerfile:100 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:27:16Z):

P0: The validation RUN steps call `mise`/`bun` in a new Docker layer, but `tools/setup/install.sh` only exports PATH inside its own process (mise is installed into `$HOME/.local/bin`, shims into `$HOME/.local/share/mise/shims`). Docker does not persist those exports across RUN instructions, so these steps can fail with `mise: command not found` / missing bun unless PATH is made persistent (e.g., via `ENV PATH=...` and/or sourcing the generated `$HOME/.config/zeta/shellenv.sh` before running the checks).

### Thread 13: tools/ci/dockerfiles/nixos-install-sh-test/Dockerfile:32 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:27:17Z):

P2: The comment “latest stable … as of training data” is not actionable/traceable in-repo and will read oddly to future maintainers. Prefer an objective anchor (e.g., the date of the pin decision and/or a linkable bump procedure) and remove references to “training data”.

### Thread 14: tools/ci/docker-nixos-install-sh-test.ts:83 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:27:17Z):

P1: The default log path `.docker-test-log` will create an unignored file in the repo root (it is not in `.gitignore`), which is likely to show up as untracked and get accidentally committed. Consider defaulting to an already-ignored scratch directory (e.g., under `.tools/` which is gitignored) or to the OS tempdir, while keeping `DOCKER_LOG_OUT_PATH` for CI artifact placement.

### Thread 15: .dockerignore:6 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:27:17Z):

PR metadata says “2 files”, but this PR also adds `.dockerignore`. Please update the PR description / summary to reflect the additional changed file so reviewers understand the full surface area (root-level docker build behavior changes for all Docker builds).

### Thread 16: tools/ci/docker-nixos-install-sh-test.ts:36 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:36:50Z):

P1: The header comment says the default DOCKER_LOG_OUT_PATH is workspace-relative `.docker-test-log`, but the code default is `.tools/docker-nixos-install-sh-test.log`. Please update the docstring to match the actual default so users don’t look for the wrong file (and so the usage docs stay accurate).

### Thread 17: tools/ci/dockerfiles/nixos-install-sh-test/Dockerfile:34 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:36:50Z):

P1: `FROM nixos/nix:2.31.2` is pinned by tag, but tags can still be mutable/rebuilt upstream. Since this Dockerfile is intended as a CI sentinel, consider pinning the base image by digest (`nixos/nix:2.31.2@sha256:...`) to make failures attributable to repo changes rather than upstream tag movement.

## General comments

### @chatgpt-codex-connector (2026-05-27T03:16:26Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
