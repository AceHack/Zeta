---
id: 081M24HZCYN087G0R002MT55TV
type: task
state: backlog
priority: P2
slug: retire-the-last-curl-pipe-sh-on-the-install-path-pin-rustup
title: "Retire the last curl-pipe-sh on the install path: pin rustup-init by sha256 and classify the remaining stray shell scripts"
created: 2026-09-10T02:22:31.381Z
depends_on: []
composes_with: []
---

# Retire the last curl-pipe-sh on the install path: pin rustup-init by sha256 and classify the remaining stray shell scripts

Maintainer, 2026-09-10: _"those stray .sh files we need to clean those up too and
make them first class part of ace package manager and our install.sh and all
oses"_, and separately _"we are building tools and harnesses that will only allow
for tool calls through our CLI, not bash or 3rd party commands that we don't wrap
in our own cli"_.

## 1. The rustup pipe-to-shell — DONE in this change

`tools/setup/common/install-rust-wasm32.sh:32` was

```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | \
  sh -s -- -y --default-toolchain "$RUST_VERSION" --no-modify-path
```

the last live `downloadThenRun` on the install path, and `install.sh` is consumed
three ways (dev laptops, CI runners, devcontainer images; GOVERNANCE.md §24), so
whatever that URL served executed on all three with nothing in the repo able to
notice a change.

**It now goes through the mechanism PR #17200 adopted for Ollama**, extended
rather than duplicated:

| piece         | file                                                                               |
| ------------- | ---------------------------------------------------------------------------------- |
| the pin       | `tools/setup/rustup-pin.json` — rustup **1.29.1**, four platforms                  |
| the mechanism | `src/Core.TypeScript/ace/{pinned-artifact,install-pinned-artifact}.ts`             |
| the refresher | `src/Core.TypeScript/ace/refresh-rustup-pin.ts` (`--check` is the drift falsifier) |
| the proof     | `.github/workflows/verify-rustup-pin.yml` on a real `ubuntu-24.04` runner          |

**The verification happens BEFORE execution, and that ordering is the property.**
`installPinnedArtifact` fetches, compares SHA-256, and only then marks the file
executable and runs it. A pipe runs the bytes as its _first_ act, so no check it
could perform afterwards would be a check at all. Falsified rather than asserted:
`pinned-artifact.test.ts` proves wrong bytes leave `madeExecutable` and `ran`
empty, and two mutants (digest check disabled; platform selection replaced by
`artifacts[0]`) were both killed.

Two capabilities Ollama did not need, and why they are refusals rather than
options:

- **`artifacts` is a LIST.** One digest cannot describe four platform builds, so
  digest inheritance from `entry.contentAddress` is offered only to a
  single-artifact pin and a multi-platform pin sharing one digest is REFUSED.
- **`kind: "run-installer"`.** rustup-init is an executable, not a tarball.
  `runArgs` on an `archive` is refused rather than ignored, and a `--run-arg`
  handed to an archive is refused before the fetch.

**Fail-closed, and it is not an increase in blast radius:** the call site already
ran under `set -euo pipefail`, so the old `curl | sh` aborted `install.sh` on a
network failure too. What is refused is a _fallback_ to the unpinned installer.

**No rolling exception is needed** (`tools/setup/manifests/from-url-rolling-exceptions`,
PR #17183). `static.rust-lang.org/rustup/archive/<version>/…` is version-addressed:
a new rustup release leaves this pin **stale, not broken**. `sh.rustup.rs` is the
rolling alias, which is exactly why it is not what we pin.

**Honest limit on provenance**, weaker than the Ollama pin's and stated so nobody
reads it as equal: rustup has ONE distribution channel. The `.sha256` sidecar is
served from the same origin as the binary, so agreeing with it detects a corrupted
transfer and would NOT detect a compromised origin, and `rust-lang/rustup`'s GitHub
releases carry no `rustup-init` assets to cross-check against (measured 2026-09-10:
the API has no release for tag `1.29.1` at all).

**Toolchain version is NOT copied into the pin.** `1.99.0-beta.3` lives once, in
`.mise.toml`, and reaches the mechanism as `--run-arg=--default-toolchain
--run-arg=$RUST_VERSION`. A pin that disagreed with `.mise.toml` would be worse
than no pin.

## 2. The falsifier — extended, not duplicated

`src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts` governed WHICH
shell files exist and nothing about what they contain. It now also refuses a
**remote fetch piped into an interpreter**, across the retained shell surface _and_
every `.github/workflows/*.yml`. No new entrypoint, no new gate step, no
linter-coverage ledger row: it runs inside `lint (bash retirement inventory +
hygiene unit tests)` exactly as before.

**Proven to fail on the pre-fix tree**, not merely to pass on the fixed one:

```
$ git show origin/main:tools/setup/common/install-rust-wasm32.sh > <the file>
$ bun …/check-bash-retirement-inventory.ts --enforce   # rc=1
remote_pipe_to_interpreter: 1
- tools/setup/common/install-rust-wasm32.sh:32: curl … https://sh.rustup.rs | sh -s -- …
$ # with the fix                                        rc=0
```

**Why a lexer and not a grep.** Measured on the tree: a naive line grep finds
SEVEN sites and SIX are prose — three workflow comments _describing_ the installer
#17200 removed, an `echo "…curl … | bash"` in a human-facing error message, and two
`linux.sh` comments explaining why `curl mise.run | sh` is not used. A check that
cannot tell a mention from a call is one that gets deleted. And the seventh — the
real one — is invisible to a one-line grep anyway, because the `|` is followed by
a `\` continuation with `sh` on the next physical line. Both halves are
regression-tested, and three mutants (no continuation join; masking disabled;
workflows excluded from the scan) were each killed.

The refusal **prints the replacement** — pin file + `install-pinned-artifact.ts`,
or a `from-url` row — because a linter that only says "no" gets worked around.

Stated blind spots: `eval`, a variable command name, a fetch inside a called
script, and `sh -c "$(curl …)"` command substitution are not matched today.

## 3. Classification of the eight stray scripts — evidence per row

`full-ai-cluster/nixos/modules/*.sh` and everything under
`docs/recovered-orphan-branches-2026-05/` were out of scope by construction (NixOS
module scripts; other agents' preserved memory).

| script                                                   | verdict                                      | evidence                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/hooks/install-git-hooks.sh`                     | **MUST STAY SHELL**                          | Invoked at `tools/setup/install.sh:304` and `flake.nix:235` — the devShell `shellHook`, which is a Nix string evaluated by bash with no bun guaranteed. It symlinks `scripts/hooks/{pre-push,commit-msg}` into `.git/hooks/`, and a Git hook shim is a shell invocation boundary. Already categorised `git hooks`.       |
| `full-ai-cluster/usb-nixos-installer/zeta-install.sh`    | **MUST STAY SHELL**                          | The live-USB OS installer. `tools/setup/install.sh` _points operators at it_ (lines 25/46/55/162–167) rather than the reverse, and it runs before there is an installed system — no bun, no repo toolchain. 195 `sudo` sites. Already `nixos installer`.                                                                 |
| `full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh` | **MUST STAY SHELL**                          | `systemd` `zeta-first-boot.service` runs it on tty1 from the ISO, gated on `/etc/zeta-firstboot-enabled`, before networking is up (it launches `nmtui` when there is none). An `ExecStart` cannot wait for a toolchain that the ISO closure does not carry. Already `nixos installer`.                                   |
| `tools/installer/zeta-self-register.sh`                  | **MUST STAY SHELL**                          | `full-ai-cluster/nixos/modules/zeta-self-register.nix:92` names it as the `ExecStart` of a first-boot oneshot; `common.nix:139` imports that module. Same OS-boot edge. Already `nixos installer`.                                                                                                                       |
| `.gemini/service/lior-loop.sh`                           | **DEAD as a mechanism — do not delete here** | Self-declared: _"SHIM — … exists for backward compatibility only"_; it `exec`s `bun …/loop-tick.ts`. Its ONE reference is `.gemini/service/com.lucent.zeta.lior.plist`, which hard-codes an absolute path into the **shared checkout** — a path a fresh clone does not have. Nothing in CI, TS, nix or shell invokes it. |
| `.gemini/service/install-lior-service.sh`                | **DEAD — do not delete here**                | Seven lines that `cp` that plist to `~/Library/LaunchAgents` and `launchctl load` it. Zero callers anywhere in the tree; the sanctioned path is `bun src/Core.TypeScript/service/service-manager-cli.ts install --persona lior`, which the shim's own header names.                                                      |
| `db/common/host-tier.sh`                                 | **DEAD — not shell at all**                  | 108 bytes of MARKDOWN (`# host-tier.sh/` + _"[A provisional carved sentence …]"_), auto-vivified by #8807 at a code-extension path. It is not a copy of `tools/setup/common/host-tier.sh` — that one is 166 lines of real bash.                                                                                          |
| `db/tools/setup/common/sync-prior-art.sh`                | **DEAD — not shell at all**                  | Same shape, 118 bytes, same auto-vivify defect. The real thing is `tools/setup/common/sync-prior-art.ts`, already TypeScript.                                                                                                                                                                                            |

**Nothing is deleted in this change, deliberately.** Removal of the four DEAD rows
is already filed as **081M00VNHBY087G0R0024W93JY** ("Delete rather than port the
vestigial shell surfaces…"), and re-filing it here would be a second ledger for one
subject. This row supplies the missing half that item needs: the evidence, measured
2026-09-10.

**One finding worth carrying to that item.** The inventory's
`INACTIVE_SHELL_INVENTORY_PREFIXES` excludes all of `db/` by prefix, so the two
markdown stubs are invisible to it — not because they were judged, but because a
directory was skipped. That is the right _outcome_ today (they are not shell) reached
for the wrong _reason_, and it means a genuine `.sh` landing under `db/` would also
go unseen. Left as-is here rather than narrowed, because narrowing it is a change to
what that check governs and belongs with the deletion, not with a pin.

## 4. What is NOT done

- The four `from-*` OS-native manifests (`brew`, `brew-cask`, `apt`, `windows`)
  are still realized by shell loops rather than by `ace` — the gap
  `tools/setup/manifests/README.md` already names. Untouched.
- `darwin/x86_64` and `darwin/arm64` rows in the rustup pin are declared and
  digest-measured but **not exercised by any live call site** (`macos.sh` does not
  call `install-rust-wasm32.sh`; macOS gets rust from `.mise.toml`). Recorded in the
  pin's `_platformCoverage` so their presence is not read as coverage.
- The verify lane installs with `--default-toolchain none`: it proves the
  INSTALLER, which is all the pin covers, not rustup's own signature-checked
  toolchain fetch.

## 5. The kubeconform attestation outage — evaluated, and the answer is NOT this mechanism

Added on the coordinator's ask 2026-09-10: `github:yannh/kubeconform@0.7.0` fails
`mise install` when GitHub's `trust-metadata-api` returns 503, taking down both ARM
lanes (gate `build-and-test (windows-11-arm)` and
`live kind ArgoCD health (ubuntu-24.04-arm)`, run 34427150482) while their x86
siblings pass. Same defect class as the rustup pipe: a third party's _availability_
on the critical path of `install.sh`.

**Verdict: `from-url` does not fit, and neither does the pin mechanism this PR
extends.** Four measured reasons —

1. `from-url` is one URL for all hosts with no platform axis, no extraction and no
   PATH placement; kubeconform ships **eight** platform archives each containing a
   binary.
2. `install-pinned-artifact.ts` has the platform axis and archive extraction, but its
   rim is POSIX-only (`sudo` elevator, `PATH.split(":")`, hardcoded `tar --zstd`) and
   the **gate** lane that fails is `windows-11-arm`. A Unix-only migration would leave
   the blocking failure standing and fragment the tool graph.
3. kubeconform's version is already pinned **twice** — `.mise.full.toml` and
   `gate.yml:1055`'s `go install …@v0.7.0`. A third mechanism widens the drift surface.
4. It fixes one exposure out of at least four: the same failing log shows
   `golangci-lint`, `uv` and `actionlint` performing the same attestation call.
   `github_attestations = true` is a GLOBAL default and `aqua.github_attestations` is
   true too, so the exposure follows the **setting**, not the backend.

The bigger finding, and the real fix, is filed as **081M24MADR2087G0R001FCD8K6**:
there is **no `mise.lock` in this repo and `locked = false`**, so no mise-managed tool
has a committed digest at all — the `[2/3] checksum` mise prints is verified against a
checksum fetched from upstream at install time. `mise lock` produces exactly the
committed per-platform `sha256` text this PR's pin gives rustup (verified by running
it; `windows-arm64` supported explicitly), and only once that lands does turning the
attestation call off stop being a bypass and start being a relocation of the check.

### What IS fixed here: the misleading second failure

Six `if: always()` teardown steps in `.github/workflows/k8s-argocd-health-test.yml` ran
`bun …-down.ts` with no toolchain installed and died with `bun: command not found`,
exit 127 — so the job showed two reds and the **last** one, the one a reader sees
first, was a missing bun rather than the 503 five steps earlier. Each now exits 0 on
exactly one condition (`bun` absent ⇒ the install never completed ⇒ no cluster was ever
created) with a `::notice` naming the real failure. A genuine teardown failure — bun
present, `kind-down.ts` non-zero — still goes red; nothing in the guard touches that
path. No retry budget was extended anywhere.
