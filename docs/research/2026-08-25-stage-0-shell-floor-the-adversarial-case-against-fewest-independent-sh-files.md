# Stage-0 shell floor — the adversarial case against "fewest independent `.sh` files"

> **Work-item:** `081M0X297C1087G0R000HG6ZK2`
> **Reviewer:** Aminata (threat-model critic), adversarial role, no coordination with the
> concurrent reducer.
> **Measured against:** `origin/main` @ `07aa44b3f1545c18c4dd9df29d8ba411f56d5485`, 2026-08-25,
> in an isolated worktree. The shared checkout was at `49a16f6acc` when this task started —
> **already ~1 day and several hundred commits stale**, which is why every number below was
> re-measured rather than inherited.

The premise under review (Aaron, 2026-08-25):

> *"we should have an ongoing minimization function to this surface so we have the absolute
> minimal number of independent `.sh` files that hold up under adversarial review"*

He asked for the result to hold up under adversarial review. This is that review. **The
verdict is that the objective as literally stated — minimize the count of independent `.sh`
files — is the wrong quantity, it is already gameable in four distinct ways, and the repo
already ships a strictly better minimization function that nobody appears to be citing.**
The floor derived below is **27 files**, and the honest reduction available is **3**, none of
which is a merge.

---

## 0. The measured start was wrong in three ways

The handed-down measurement was "36 tracked `.sh`; 22 under `tools/setup/`; 14 independent /
8 sourced." Re-measured:

| quantity | handed down | measured | note |
|---|---|---|---|
| tracked `.sh` | 36 | **35** | `git ls-files '*.sh' \| wc -l` |
| under `tools/setup/` | 22 | **21** | `git ls-files 'tools/setup/*.sh'` |
| live retained shell surface | — | **30** | the repo's own tool, below |

The 35 conflates **three populations that must not be added together**:

1. **6 archived copies** under `docs/recovered-orphan-branches-2026-05/` — recovered orphan
   branches, i.e. *other agents' preserved memory*. Deleting them "reduces the count" and
   destroys memory (manifesto §5). They are not stage-0 anything.
2. **2 files that are not shell at all.** `db/common/host-tier.sh` and
   `db/tools/setup/common/sync-prior-art.sh` are **Markdown knowledge-graph stubs** that
   happen to carry a `.sh` suffix. Contents of the first, in full:
   ```
   # host-tier.sh/

   **Carved sentence:** [A provisional carved sentence explaining what host-tier.sh is about]
   ```
   A count keyed on the extension is measuring filenames, not shell.
3. **3 real shell scripts the `.sh` count MISSES**: `scripts/hooks/commit-msg`,
   `scripts/hooks/pre-push`, `githooks/pre-push` — all `#!/usr/bin/env bash`, all tracked,
   none matching `*.sh`.

**Control that could have come out the other way:** a scoped `rg` for shell shebangs in
non-`.sh` tracked files. Had it returned nothing, the extension would have been a faithful
proxy and this section would not exist. It returned three files. (A first attempt — a
per-file `head` loop over all 46,661 tracked files — timed out at 120 s and produced *no*
output; treating that empty output as "none found" would have been a check that did not run
reading as a check that passed. It is recorded here because it nearly was.)

---

## 1. The minimization function already exists, and it is better than a count

**`src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts`**, enforced in CI at
`.github/workflows/gate.yml:1095` via `bun run hygiene:check-bash-retirement-inventory`
(`package.json:41`, with `--enforce`).

Run against the measured tree:

```
retained_non_lean_shell: 30
expected_retained: 30
unexpected: 0
missing_retained: 0
- setup/bootstrap: 21   - git hooks: 4   - host-service wrappers: 2   - nixos installer: 3
OK: retained non-Lean shell surface matches repo-wide setup/bootstrap/... allowlist.
```

It is **not** a count-minimizer. It is a **ratchet with typed justifications**: every retained
shell file must be named in `EXPECTED_RETAINED_SHELL` *and* categorised in
`RETAINED_SHELL_CATEGORY_BY_FILE`, the list must be unique and sorted, and a new `.sh`
anywhere in the repo fails CI until someone writes down *why it must be shell*. It already
excludes `db/` and `docs/recovered-orphan-branches-` by prefix — the repo's own tool already
knows the three-population problem from §0.

Its governing comment states the correct operation explicitly:

> *"`ensure-rust-components.sh` was allowlisted here by #10991 as INTERIM scaffolding to
> unbreak a red main, never as an end state. It is gone — rustfmt/clippy/wasm32 are declared
> on the rust entry in `.mise.toml`, so the retirement discipline **REMOVED a shell file
> instead of permanently allowlisting one**."*

That is minimization by **eliminating the need**. Not by merging files. The distinction is the
whole finding.

And a **second, sharper** metric already exists: `measure-shell-key-exposure.ts`, whose
generated output is `docs/SHELL-DEPRECATION-SEQUENCE.md` — it ranks every retained script by
*what key material it can reach and how far the value travels*, tier `T0`–`T4`. Its own
framing anticipates the objection to counting:

> *"Nothing in that schema answers **what a script can reach**, so `setup/bootstrap` holds 22
> of the 31 entries and `persona-keys/keyring.sh` shares a bucket with `install-zig.sh`.
> Ordered by that schema, the deprecation converts the easy scripts first."*

Substituting a file *count* for either of these is a strict downgrade: it replaces a
justification-carrying ratchet and an exposure-ranked ordering with a scalar that cannot
distinguish `keyring.sh` from `smoke-7-toolchains.sh`.

---

## 2. The derived floor — 27 files that must stay independent

Derivation rule, and it is not "is it sourced by another `.sh`":

> A file is **independently required** if merging it into any other file would (a) cross an
> availability boundary, (b) cross a privilege boundary, (c) couple two failure domains that
> must fail separately, (d) corrupt a measurement the file takes of its own execution context,
> or (e) destroy an export the caller depends on.

The handed-down "sourced vs independent" heuristic fails because a **subprocess-spawned**
script is not an independent entry point either, and a **sourced** script is the *least*
mergeable kind of all — it exports functions into its caller's shell, which is a thing no
compiled replacement can do.

Precise call graph, from actual `source`/`.` directives and actual spawn lines (comment
mentions excluded — the loose grep matched 158 "references" to `install.sh`, almost all prose):

**Sourced (in-process; exports into caller):**
`common/host-tier.sh` ← `linux.sh:49`, `macos.sh:98`, `common/mise.sh:48`, `common/shellenv.sh:53` ·
`common/curl-fetch.sh` ← `linux.sh:38`, `macos.sh:39` ·
`common/fd-limits.sh` ← `doctor.sh:203`

**Spawned as subprocess:**
`macos.sh`/`linux.sh` ← `install.sh:139,146,152` · `install.ps1` ← `install.sh:244` (exec) ·
`host-loop-bootstrap.sh` ← `install.sh:267` · `scripts/hooks/install-git-hooks.sh` ←
`install.sh:284` · `common/mise.sh` ← `linux.sh:647`, `macos.sh:214` · `common/shellenv.sh` ←
`linux.sh:674`, `macos.sh:234` · `common/profile-edit.sh` ← `linux.sh:675`, `macos.sh:235` ·
`common/install-zig.sh` ← `linux.sh:688` · `common/install-rust-wasm32.sh` ← `linux.sh:690`

**Invoked from a bun realizer (above the bun boundary):** `common/agda-cubical.sh`,
`common/tlaps.sh`

**Invoked by nothing in-repo (operator-initiated entry points):** `doctor.sh`,
`secret-clip.sh`, `persona-keys/keyring.sh` (called from `onboard.ts`),
`hsm/dkek-ceremony-preflight.sh`, the three `smoke-N-toolchains.sh`

### The floor, per file

**Class A — below the bun availability boundary (cannot be TypeScript at all).** The boundary
is exact and it is `macos.sh:214` / `linux.sh:647`: `bun` arrives only when `common/mise.sh`
completes. `macos.sh:25-27` states it as a runtime assertion — *"error: bun required for setup
realizers — ensure common/mise.sh ran first"*.

| file | why independent |
|---|---|
| `tools/setup/install.sh` | The universal entry. Routes on `uname -s` + NixOS discriminators before any tool exists. Its exit-2 routing guard is a documented contract CI depends on. |
| `tools/setup/macos.sh` | Platform bootstrap. See §4. |
| `tools/setup/linux.sh` | Platform bootstrap. See §4. |
| `tools/setup/install.ps1` | Different interpreter. Not mergeable in any language. |
| `tools/setup/common/mise.sh` | **The boundary itself.** Installs the runtimes that make every later choice possible. |
| `tools/setup/common/host-tier.sh` | **Sourced by four callers**; exports `zeta_tier_allows`, `zeta_tier_of_line`, `zeta_strip_tier` and `ZETA_HOST_TIER*` into each. Merging = 4× duplication of tier policy. `SHELL-DEPRECATION-SEQUENCE.md` §4: *"`source`d libraries and cannot become binaries — a compiled program cannot export functions into its parent shell."* |
| `tools/setup/common/curl-fetch.sh` | Sourced by two callers; the same structural argument. Also the supply-chain policy chokepoint — §3, F2. |
| `tools/setup/common/shellenv.sh` | Generates the managed PATH file *and* is the CI parity hook writing `$GITHUB_ENV`/`$GITHUB_PATH`. Runs after bun, so technically convertible; the generated artefact is shell either way. Low-value conversion, non-zero risk. |
| `tools/setup/common/profile-edit.sh` | Writes the user's shell profile — `execution-identity` material (T1). Isolating what edits a login profile is worth a file. |
| `tools/setup/common/install-zig.sh` | **Privileged.** Three executed `sudo` (`rm -rf`, `mv`, `ln -sf`) into `/usr/local`. §5, P0. |
| `tools/setup/common/install-rust-wasm32.sh` | **Pipe-to-shell of a remote installer.** §3, F2. Must stay separately auditable. |
| `tools/setup/common/fd-limits.sh` | Pure sourced library, function-only, **zero executed privilege** — all 11 `sudo` are inside *printed* heredocs. §5, P0-adjacent. |

**Class B — independent failure domains.**

| file | why independent |
|---|---|
| `tools/setup/doctor.sh` | **Must work when the thing it diagnoses is broken.** Header: *"Read-only; never mutates."* Every dependency is probed and degraded — no `bun` → warn+skip (lines 72, 193, 252), no `mise` → warn+skip (163). Merging it into `install.sh` (which runs `set -euo pipefail` and mutates) means a diagnostic run mutates the machine, and a toolchain broken enough to need the doctor aborts before diagnosing. This is the cleanest shared-fate violation in the set. |
| `tools/setup/hsm/dkek-ceremony-preflight.sh` | **Measures its own execution context; a merge corrupts the measurement.** See below — the sharpest single finding. |
| `tools/setup/host-loop-bootstrap.sh` | Provisions launchd cells, writes `~/Library/LaunchAgents` plists (T1 execution-identity, `execution-identity-write@71,189`). Already invoked non-fatally (`\|\| { echo "Warning: ..." }`) precisely so cell provisioning failure does not fail the install. That is a deliberate fate split; merging deletes it. |
| `scripts/hooks/install-git-hooks.sh` | Same non-fatal invocation contract at `install.sh:284`. |
| `tools/setup/persona-keys/keyring.sh` | The highest-value material in the repo (T4-root-key). Genuinely in-process shell: `read -s`, `umask 077`, shred-on-exit trap. `SHELL-DEPRECATION-SEQUENCE.md` §3: *"correct as written and still ranks first… its rank is material, not defect."* |
| `tools/setup/secret-clip.sh` | T3, and carries a **known, self-declared argv leak** — §3, F3. It must remain individually addressable until fixed. |
| `githooks/pre-push`, `scripts/hooks/pre-push`, `scripts/hooks/commit-msg` | Git hook invocation boundaries. Git decides the filename; the count cannot be reduced by fiat. |
| `.gemini/service/install-lior-service.sh`, `.gemini/service/lior-loop.sh` | Host-service wrappers, separate lifecycle. |
| `full-ai-cluster/usb-nixos-installer/zeta-install.sh`, `zeta-first-boot.sh`, `tools/installer/zeta-self-register.sh` | OS-installer edge, runs before there is a system. `zeta-install.sh` alone carries 195 `sudo` and 150+ `privileged-operation` witnesses. |

**Floor = 27.**

### The DKEK preflight is the sharpest case, and it generalises

`tools/setup/hsm/dkek-ceremony-preflight.sh` decides whether a host is safe to hold a
SmartCard-HSM DKEK share password. Its seven facts are **properties of the session it is
running in**:

```sh
if [ -t 1 ]; then printf 'stdout_tty=yes\n'; else printf 'stdout_tty=no\n'; fi   # :176
_core="$(ulimit -c 2>/dev/null || echo unknown)"                                  # :158
if [ -n "${HISTFILE:-}" ]; then printf 'histfile=set\n'; ...                      # :198
case " $* " in *" --password "*| ... ) printf 'password_in_argv=yes\n' ;;         # :180-181
```

Merge it into any script that pipes, tees, or redirects its output and `stdout_tty` flips to
`no` — the preflight then REFUSES permanently. The predictable "fix" is to relax the check,
at which point a **fail-closed security gate silently becomes fail-open**. Its own header
says the property that is at stake:

> *"FAIL-CLOSED IS LOAD-BEARING: a condition this script cannot MEASURE is reported as
> `unknown` and refuses, because a check that did not run must never read as a check that
> passed."*

Worse, `password_in_argv` inspects `"$@"` — **the merged script's argv, not the ceremony's**.
The check would keep returning `no` while measuring the wrong process. That is not a
degradation; it is a check that reports PASS about something it never looked at.

**The general rule this yields:** *a script that measures properties of its own execution
context cannot be merged into a script with a different execution context.* This is the
noninterference discipline (§13) stated for file layout — the preflight's ambient inputs are
its declared channel, and a merge is an undeclared change to that channel.

---

## 3. Ranked findings

### P0 — a shipped-defence claim is ornamental: the fetch policy has three bypasses, one of which is a pipe-to-shell

`common/curl-fetch.sh` centralises download retry policy. Its header claims the surface is
closed:

> *"**All upstream-installer call sites** (Homebrew, mise, elan) now use the download-to-temp
> + verify + exec pattern via `curl_fetch`. The former `curl_fetch_stream` function (streamed
> pipe-to-shell, no retries) was removed by 081KQ8P5D0008QG0R001DMK8JD — **no call sites
> remain**."*

Measured. `curl_fetch` has exactly **two** call sites:

```
tools/setup/linux.sh:595:  curl_fetch --output "${MISE_TMP}/${MISE_TARBALL}" "${MISE_URL}"
tools/setup/macos.sh:62:   curl_fetch --output "${HOMEBREW_INSTALLER_TMP}" \
```

And **three** fetches bypass it:

```
tools/setup/common/install-rust-wasm32.sh:32:  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | \
tools/setup/common/install-rust-wasm32.sh:33:    sh -s -- -y --default-toolchain "$RUST_VERSION" --no-modify-path
tools/setup/common/install-zig.sh:52:  curl -fsSL "$ZIG_URL" -o "$TMP_DIR/$ZIG_TAR"
tools/setup/host-loop-bootstrap.sh:103: (a pipe-to-shell in an error MESSAGE — not executed)
```

The narrow claim ("the *function* `curl_fetch_stream` has no call sites") is true. The
doctrine — *all upstream-installer call sites use download-to-temp + verify + exec* — is
**false**: `install-rust-wasm32.sh` pipes a remote installer straight into `sh`, which is
precisely the pattern `081KQ8P5D0008QG0R001DMK8JD` was raised to remove. It is not a
regression of that work; it is a site that work never reached, described by a header sentence
that reads as though it did.

**The asymmetry that makes this a finding rather than a nit:** `install.ps1`'s own header
holds the *stronger* policy on the Windows path —

> *"scoop -- https://get.scoop.sh (canonical; **download-then-exec, NOT pipe-to-shell**)"*

So Windows refuses pipe-to-shell by documented policy while the Unix path still does it. A
"fewest files" merge that folded `install-rust-wasm32.sh` into `linux.sh` would move the
pipe-to-shell *inside* the platform bootstrap and make it materially harder to find.

**Control:** I looked for `curl_fetch` adoption and for bare `curl` separately. Had bare curl
returned only the two call sites inside `curl-fetch.sh` itself, the claim would have been
accurate and this finding would not exist.

### P0 — `install-zig.sh`: unverified tarball → three executed `sudo` into `/usr/local`

```sh
ZIG_VERSION="${1:-0.13.0}"                       # :21  attacker-influenced? only by caller
ZIG_INSTALL_DIR="/usr/local/zig-${ZIG_VERSION}"  # :22
curl -fsSL "$ZIG_URL" -o "$TMP_DIR/$ZIG_TAR"     # :52  no retry policy, NO CHECKSUM
tar -xf "$TMP_DIR/$ZIG_TAR" -C "$TMP_DIR"        # :53
sudo rm -rf "$ZIG_INSTALL_DIR"                   # :58
sudo mv "$ZIG_EXTRACTED" "$ZIG_INSTALL_DIR"      # :59
sudo ln -sf "$ZIG_INSTALL_DIR/zig" "$ZIG_LINK"   # :60  -> /usr/local/bin/zig
```

There is **no SHA256 verification** of the downloaded tarball and no `curl_fetch`. The
contents are then moved into `/usr/local` under `sudo` and symlinked onto the default PATH.
Compare `macos.sh:64-67`, which at least refuses an empty download before executing it, and
explicitly reasons about the absent upstream SHA256. `install-zig.sh` does neither.

**Stated honestly:** I did **not** find an exploitable path-injection here. `${1:-0.13.0}`
defends the empty-argument case and `"$ZIG_INSTALL_DIR"` is quoted, so no word-splitting
occurs. The finding is *unverified-artifact-to-privileged-install*, not command injection.
This is the highest-severity **merge** constraint in the set: any consolidation that pulls
unprivileged code into this file, or this file into a larger one, widens what runs adjacent to
`sudo rm -rf`.

### P1 — `secret-clip.sh` puts a credential on `security(1)`'s argv, and the repo knows

`tools/setup/secret-clip.sh:95`:

```sh
security add-generic-password -a "$USER" -s "$NAME" -U -w "$SECRET"
```

`security(1)` is an external binary, so `$SECRET` is in `ps` output for the life of the call.
This is not a discovery — it is **self-declared** in the allowlist and in the generated
sequence doc:

> *"`tools/setup/secret-clip.sh` still carries the identical leak at line 93 and is still row
> 2 — the sibling was not swept along, and saying so is the point of a generated table."*

The sibling `op-token-setup.sh` had the identical defect and was **fixed by conversion to
TypeScript** (`security -i`, value on stdin, three falsifiers). That is the model. I record it
here because it is the strongest available evidence for the §6 argument: the conversion
removed a shell file *and* closed a credential exposure. A merge would have done neither.

(Minor drift worth naming: both the allowlist comment and the generated table say `@93`; in
the measured tree it is line 95. The generator reads the current file, so the table is
regenerated-stale by two lines. Cosmetic, but "generated" that drifts is how a regeneration
diff gets waved through — the doc's own words.)

### P1 — two of the three toolchain smoke checks are dead, and the newest one claims CI runs it

The three `smoke-N-toolchains.sh` files are a **succession chain**, by their own headers:

- `smoke-10:22` — *"Replaces smoke-7-toolchains.sh (added WASM triad…)"*
- `smoke-13:25` — *"Replaces smoke-10-toolchains.sh (added zig, rustup wasm32, llvm triad)"*

Measured against the workflows:

```
$ rg -n 'smoke-[0-9]+-toolchains' .github/
.github/workflows/gate.yml:3245:        run: CI=true ./tools/setup/common/smoke-7-toolchains.sh
```

**Only `smoke-7` runs.** The two successors — the ones covering oracles 8–13 — are invoked by
nothing. `smoke-13` claims in its own header that `gate.yml` runs it; that is false and is
already filed as work-item `081M05E39F7087G0R002F00H6Q`
(*"smoke-13-toolchains.sh is unwired from CI while claiming gate.yml runs it — oracles 8-13
have no functional smoke gate"*).

**Control:** `rg` returned exactly one hit, and a positive control (`rg -c 'runs-on'
gate.yml` → 33) confirms the tool was searching the right tree. A zero result here would have
meant something different — that even smoke-7 was unwired — and I would have had to say so.

This is the exact place a naive minimizer does damage. "Three near-duplicate smoke scripts →
merge to one" scores **−2 files** and leaves every real defect in place: two dead checks, one
false coverage claim, and oracles 8–13 ungated. Worse, after the merge the unwired code lives
inside a file that CI *does* invoke, so it *looks* covered. The count improved and the
vacuity got harder to see.

The correct action is **delete `smoke-7` and `smoke-10`, wire `smoke-13`** — which also scores
−2 files, but for the right reason and with the coverage gap closed instead of buried.

### P2 — `fd-limits.sh` would be misread by any privilege-aware count

`grep -c sudo` ranks `fd-limits.sh` third-most-privileged in the live tree (11 hits). It
executes **zero**. Every occurrence is inside a heredoc that is printed:

> *"NOT APPLIED AUTOMATICALLY. Raising system limits needs root… this file only DETECTS and
> PRINTS the exact command. A human applies it."* (`fd-limits.sh:36-37`)

Same for `doctor.sh` (12 hits, zero executed — lines 212 and 248 are remediation text, plus
the sourced `zeta_fd_remedy` output) and `install.sh` (1 hit, inside the NixOS-live heredoc at
line 169). **Executed-privilege ranking in the live setup tree is therefore:
`zeta-install.sh` ≫ `linux.sh` (3 executed apt/dpkg operations via the `$SUDO` variable at
:262, :309, :376, correctly emptied when `id -u` is 0) ≈ `install-zig.sh` (3, and the only
`sudo rm -rf`) > everything else at 0.** Any metric built on textual `sudo` counts will drive work at the wrong files — and if
someone "reduces privileged surface" by merging `fd-limits.sh` into `doctor.sh`, printed
remedies sit one edit away from being executed.

---

## 4. Platform divergence: argue both sides, then commit

**The case that `linux.sh`/`macos.sh`/`install.ps1` are duplication.** They share a visible
skeleton: system packages from a manifest → mise → `common/mise.sh` → realizers →
`shellenv.sh` → `profile-edit.sh`. Both Unix files source `curl-fetch.sh` and `host-tier.sh`;
both spawn the same three commons in the same order (`macos.sh:214,234,235` vs
`linux.sh:647,674,675`). The tier-filter parse is duplicated — `macos.sh:91-94` reimplements
the awk comment-stripper that `host-tier.sh:105-108` already provides, and `host-tier.sh:89-90`
admits it: *"NOT used for manifests/brew: brew entries carry version pins… so macos.sh keeps
its own line-wise parse."* That is real, nameable duplication.

**The case that the split is essential.** Measure the bodies, not the skeletons:

| | `macos.sh` | `linux.sh` |
|---|---|---|
| total LOC | 235 | **695** |
| system-package section | ~80 (brew + casks) | **353** (`:76`–`:429`, apt/dpkg) |

The 353-line apt section is not a longer version of the brew section — it is `dpkg` lock
contention, `timeout` signal propagation to the right process in the `sudo apt-get` → `dpkg`
chain, and recovery from *"you must manually run 'sudo dpkg --configure -a'"* with `rc=100`
(`linux.sh:330,343,354`). **None of that has a macOS analogue**, because Homebrew has no
dpkg-state machine. Meanwhile `macos.sh` carries Xcode CLT bootstrapping and
`brew shellenv` eval for two possible prefixes — no Linux analogue. And `install.ps1` is a
different interpreter with a *different* strictness posture, deliberately: *"Deliberately NO
`Set-StrictMode`… scoop reads `$LASTEXITCODE` before any native command has set it."*

**Commit: keep the three-way split.** The shared skeleton is ~40 lines of ordering; the
divergent bodies are ~430 lines of irreducible OS-specific failure recovery. Merging to a
single file with `case "$os"` arms produces one 900-line script where every reader pays for
both package managers and a first-boot failure on either OS is debugged through the other's
code. The correct reduction here is the *opposite* direction: move `macos.sh`'s duplicated awk
parse into `host-tier.sh` — which reduces **duplicated lines** while **increasing** the file
count by zero and the "independent `.sh`" count by zero. A count-based metric is blind to it.

---

## 5. Privilege boundaries — the P0 class

Aaron's standing rule (2026-08-24): *privileged operations are committed, reviewed, tested
code — never ad-hoc.* Applied to merges, the rule yields a hard constraint:

> **A merge may never move code across a privilege boundary in either direction.** Pulling
> unprivileged code *into* a `sudo`-executing script widens the blast radius; pulling
> privileged code *into* a general script means every future edit to that file is an edit to
> privileged code.

Concrete prohibitions from the measured tree:

1. **`install-zig.sh` must not absorb, or be absorbed by, anything.** Three executed `sudo`,
   one of them `rm -rf` on a variable path. Any line added to this file is a line adjacent to
   `sudo`.
2. **`fd-limits.sh` must not merge into `doctor.sh`.** Zero-privilege printer merging into a
   zero-privilege reporter *sounds* free; it converts a file whose entire contract is "prints,
   never executes" into a section of a file with no such contract.
3. **`dkek-ceremony-preflight.sh` must not merge into anything** — §2, and additionally it is
   the gate *in front of* a privileged human ceremony. A gate that shares fate with the thing
   it gates is not a gate.
4. **`doctor.sh` must not merge into `install.sh`.** `install.sh` executes the privileged
   `linux.sh`/`macos.sh` graph; `doctor.sh` is contractually read-only. Merging makes
   "diagnose" and "mutate the machine" the same invocation.

I found **no** currently-proposed merge that widens privilege, because I deliberately did not
look for the reducer's work. These are the constraints any proposal must clear.

---

## 6. How the metric gets gamed

"Minimize the number of independent `.sh` files" is satisfiable without improving anything:

| # | attack | cost | effect on the count | effect on reality |
|---|---|---|---|---|
| 1 | **Concatenation.** `cat *.sh > setup.sh`, dispatch on `$1`. | minutes | 21 → **1** | strictly worse: one failure domain, one privilege domain, `doctor.sh` shares fate with `install.sh`, the preflight's `[ -t 1 ]` is corrupted. |
| 2 | **Rename off the extension.** `git mv foo.sh foo`. | seconds | −1 per file | **zero.** Already true in-tree: `githooks/pre-push`, `scripts/hooks/{pre-push,commit-msg}` are shell and invisible to a `*.sh` count. |
| 3 | **Delete the archive.** Drop `docs/recovered-orphan-branches-2026-05/`. | minutes | −6 | destroys other agents' preserved memory (manifesto §5) and changes no executable surface. |
| 4 | **Inline into a non-`.sh` carrier.** Move bodies into `run:` blocks in `gate.yml`, a `.mise.toml` task, or a heredoc inside a `.ts` file. | hours | −N | **worse than neutral:** the shell still runs, but leaves `shellcheck`, leaves the retirement inventory, and leaves `measure-shell-key-exposure.ts`'s parser. The exposure ranking goes blind. |

Attack 4 is the dangerous one, because it looks like modernisation. Note that a **count** metric
*rewards* it while both existing metrics *punish* it (the inventory would report
`missing_retained`; the exposure measure would lose a row it used to score).

**The ratchet failure mode.** A monotonically-decreasing count creates pressure to do the wrong
thing when legitimate stage-0 work arrives. Someone needing a new pre-bun bootstrap step faces
a metric that says "adding a file is a regression," and the cheapest way to comply is to append
to an existing script — which is attack 1 performed one function at a time. The existing
inventory has exactly the right shape here: it does not forbid growth, it forbids
**unjustified** growth, and it makes the justification a typed, reviewed, sorted entry.

**What the metric must measure instead.** Four quantities, none of which is a file count, all of
which already have machinery in-repo or are cheap to add:

1. **Retained-shell entries whose category justification no longer holds** — already computed
   by `check-bash-retirement-inventory.ts`; the drift is the metric.
2. **Total stage-0 LOC below the bun boundary** — resistant to all four attacks (concatenation
   and renaming leave it unchanged; deleting the archive leaves it unchanged; inlining into
   `gate.yml` *increases* the measured surface if the measure follows the code rather than the
   extension).
3. **Executed-privilege lines** — `sudo`/`doas`/setuid lines that actually execute, which
   requires the lexer `measure-shell-key-exposure.ts` already has, not a `grep -c`.
4. **Exposure-tier-weighted count** — Σ over retained scripts of `tier`, so retiring
   `secret-clip.sh` (T3) scores far above retiring `smoke-10` (T0). This is the axis
   `081M00VVBAN087G0R000XC5MN7` is already chartered to wire into the inventory.

A useful composite is **"stage-0 LOC below the bun boundary, weighted by exposure tier."**
Concatenation moves it zero. Renaming moves it zero. Deleting archives moves it zero. Only
*eliminating the need for shell* moves it — which is the operation the repo has already
performed twice (`ensure-rust-components.sh` by declaring in `.mise.toml`;
`sync-prior-art.sh` and `op-token-setup.sh` by conversion to TypeScript).

---

## 7. Verdict: the objective should change

**"Fewest independent `.sh` files" is the wrong objective.** Not directionally wrong — the
surface *should* shrink — but wrong as the *quantity*, for four reasons, in descending order of
force:

1. **It is trivially gameable in four ways**, one of which (renaming) is already silently true
   in-tree, and one of which (inlining into non-shell carriers) makes things actively worse
   while scoring as progress.
2. **It cannot distinguish the cases that matter.** `keyring.sh` (T4 root-key) and
   `smoke-10-toolchains.sh` (T0, dead code) each count as exactly 1. The repo's own generated
   sequence doc identified this failure and built a replacement for it three days before this
   review.
3. **The largest single object in the surface is already a monolith and the metric approves.**
   `full-ai-cluster/usb-nixos-installer/zeta-install.sh` is **3,771 LOC — 41% of the 9,189 LOC
   of live retained shell** — carrying 195 `sudo`. It counts as **one file**. Any metric under
   which that object is the best-behaved element of the set is measuring the wrong thing. A
   file-count minimizer would happily merge four 60-line commons and never look at it.
4. **The genuine reductions available are not merges.** From this review: delete `smoke-7` and
   `smoke-10` (superseded, one of them the only one CI runs — so wire `smoke-13` first);
   convert `agda-cubical.sh` and `tlaps.sh`, which are invoked *by a bun realizer*
   (`src/Core.TypeScript/ace/setup-realizers/from-agda-cubical.ts:5`) and therefore run with
   bun already available — they are above the boundary and retained by habit, not necessity;
   convert `secret-clip.sh`, which closes a live credential exposure. **That is −3 to −5 files
   with every one of them a deletion or a conversion, and zero merges.**

**The recommended objective:**

> Minimize **stage-0 shell LOC that executes below the bun availability boundary, weighted by
> measured key-exposure tier** — under the standing constraint that the retained set stays a
> justified allowlist, and that no reduction merges across an availability, privilege, failure,
> or measurement-context boundary.

The floor of **27** is not a target to drive to zero. It is the set for which a merge has been
shown to break something specific and nameable. Files leave that set by **retirement** —
eliminating the need, as `.mise.toml` did for `ensure-rust-components.sh` — never by being
folded into a neighbour.

**One concession to the reducer, stated plainly:** the surface does contain slack, and I found
it — three superseded or above-boundary scripts, plus a duplicated awk parse between
`macos.sh` and `host-tier.sh`. A minimization function is warranted. It is the *file count*,
not the impulse, that this review rejects.

---

## What I could not verify

Stated because an unstated blind spot reads as coverage.

- **No script was executed.** Every claim about bootstrap ordering is read from call sites and
  script text, not from a cold-boot run. I could not test a bare-OS first boot from this
  worktree, so "`bun` is unavailable before `common/mise.sh`" rests on `macos.sh:214`,
  `linux.sh:647`, and the runtime assertion at `macos.sh:25-27` — strong, but inferred.
- **`install.ps1` was skimmed, not audited.** I read its header and parameter block. The
  platform-divergence verdict rests on LOC and on the two Unix files read in full; the
  PowerShell body could contain duplication I did not see.
- **`zeta-install.sh` (3,771 LOC) was not read.** Its 195 `sudo` and its LOC share are counted,
  not reviewed. It is the largest privileged object in the repo and is out of scope here; it
  deserves its own pass.
- **`linux.sh` was read structurally** (section headers, source/spawn lines, sudo sites), not
  line-by-line across its 353-line apt section.
- **I did not confirm that `gate.yml:3245`'s job is a *required* check.** If it is not, even
  `smoke-7` is weaker coverage than the P1 finding assumes — the finding would get worse, not
  better.
- **The reducer's proposal was not read**, by instruction. Every merge I argue against is one I
  constructed myself from the call graph. If it proposes something I did not anticipate, this
  document does not address it.

## Pointers

- `src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts` — the existing ratchet (CI: `gate.yml:1095`)
- `src/Core.TypeScript/hygiene/measure-shell-key-exposure.ts` — the exposure measure
- `docs/SHELL-DEPRECATION-SEQUENCE.md` — its generated output; the correct ordering
- `workitems/081M05E39F7087G0R002F00H6Q-*` — smoke-13 unwired from CI (P1 above, already filed)
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — a metric without a falsifier is a toy
- `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` — why the exposure measure reports facts and leaves the ordering to a one-function policy seam
- Beacon: Saltzer & Schroeder 1975 (least privilege, economy of mechanism, **separation of privilege** — the principle the floor instantiates); Goguen & Meseguer 1982 (noninterference, applied here to execution context); Hardy 1988 (the confused deputy — what the DKEK preflight becomes if merged)
