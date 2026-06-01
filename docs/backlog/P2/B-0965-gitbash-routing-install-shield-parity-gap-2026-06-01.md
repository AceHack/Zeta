---
id: B-0965
priority: P2
status: open
title: "git-bash routing install-shield — the one unshielded install surface (parity gap)"
created: 2026-06-01
last_updated: 2026-06-01
depends_on: [B-0857]
classification: buildable-now
decomposition: atomic
owners: [devops-engineer]
type: chore
---

# B-0965 — git-bash routing install-shield (parity gap)

## The gap (operator-surfaced 2026-06-01)

The operator asked whether the WSL and git-bash install surfaces are at parity
with the mac / ubuntu / nixos / regular-windows shields. Audit result:

**5 install shields exist and are at parity, all exercising the real install
end-to-end:**

| Shield workflow | Surface |
|---|---|
| `docker-ubuntu-install-sh-test` | `install.sh`, bare Ubuntu (Docker) |
| `docker-nixos-install-sh-test` | `install.sh`, NixOS userspace (Docker) |
| `macos-install-sh-test` | `install.sh`, real macOS |
| `docker-windows-install-ps1-test` | `install.ps1`, Windows Server Core (Docker) |
| `wsl-install-sh-test` | `install.sh`, real WSL2 Ubuntu on a Windows host (B-0857) |

**git-bash is the one unshielded surface.** git-bash is not a separate installer
— `tools/setup/install.sh` (lines ~161-172) detects `MINGW*|MSYS*|CYGWIN*`,
`cygpath`-converts the MSYS path (`/c/Users/…` → `C:\Users\…`), and `exec`s
`tools/setup/install.ps1` via PowerShell. So the git-bash one-liner is a thin
**router** to the same Windows installer the `docker-windows-install-ps1-test`
shield already covers.

The **target** (`install.ps1`) is shielded; the **routing branch itself** — the
`MINGW*|MSYS*|CYGWIN*` detect → `cygpath` conversion → `exec` PowerShell handoff
— is **not**. No shield runs `install.sh` under git-bash. Per
`.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md`, that is
exactly a hole that *reads as covered*: a regression in the routing branch (or in
`cygpath` handling, or the relative `install.ps1` path it execs) would silently
break the git-bash one-liner and no shield would catch it.

## Acceptance

- [ ] New `wsl-install-sh-test`-sibling workflow `gitbash-install-routing-test`
      on `runs-on: windows-2025` (git-bash ships pre-installed via Git for
      Windows on the GitHub Windows runner — no provisioner needed).
- [ ] Runs the `install.sh` entry under **git-bash** (`bash tools/setup/install.sh`
      or the curl one-liner) and **asserts** it routes to `install.ps1`: the
      `MINGW*|MSYS*|CYGWIN*` branch is taken, `cygpath` converts the path, and
      PowerShell is invoked with the native-Windows `-File` path.
- [ ] **Scoped to the handoff**, NOT a full re-run of `install.ps1` (the
      `docker-windows-install-ps1-test` shield already exercises the full Windows
      install). E.g. a dry-run / a `ZETA_INSTALL_ROUTE_ONLY`-style guard that
      stops after the route decision + path conversion, or assert the exact
      PowerShell command line that *would* run. Avoid duplicating the windows-ps1
      shield's cost.
- [ ] The test **asserts** the positive (routing happened with the converted
      path) — it must fail if the branch is skipped or `cygpath` is absent/wrong,
      not pass-by-skip (the shield-rule discriminator).
- [ ] Workflow follows the `wsl-install-sh-test` security pattern: runner pinned
      (`windows-2025`, not `-latest`); any third-party actions SHA-pinned with a
      trailing `# vX.Y.Z`; `permissions: contents: read`; concurrency
      cancel-in-progress for PRs; no `github.event.*` interpolated into `run:`.
- [ ] `paths:` trigger on `tools/setup/**` + `.mise.toml` + the workflow file
      (same as the other install shields).

## Why P2 (not P1)

The surface is narrow (one routing branch + a path conversion + an exec) and the
*install work* it delegates to is already shielded. But it IS a real user-facing
entry point (the documented Windows one-liner under git-bash) currently riding on
trust-by-construction, and the shield rule treats false-coverage as worse than a
known gap. Closing it brings install-shield coverage to 6/6 surfaces.

## Composes with

- `.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md` — the shield
  discipline this gap is measured against (assert, don't skip-to-green)
- B-0857 — Windows parity lane (declarative agent/peer CLIs); the `wsl-install-sh-test`
  shield is the sibling pattern this row mirrors
- `tools/setup/install.sh` (the `MINGW*|MSYS*|CYGWIN*` routing branch) +
  `tools/setup/install.ps1` (the routed-to target)
- `.github/workflows/wsl-install-sh-test.yml` — the workflow template to copy
- GOVERNANCE.md §24 (the one install script consumed multiple ways) + §23
  (GitHub Actions workflow ownership)
