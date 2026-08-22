# Shell deprecation, sequenced by key exposure — the interpreter is the identity gap, not the shell

Sequencing note. The direction of travel is already Aaron's:

> **Aaron 2026-08-14:** *"we are trying to deprecate all .sh files eventually into our own clis"*

This note does **not** propose that. It supplies the ordering, because the security survey
(PR #10683) established that the fleet has **no per-cell code identity to bind a key to**, and
the remedy — a signed artifact per unit of execution — is already planned for unrelated reasons.
Ordered by convenience, the credential-touching scripts convert whenever. Ordered by exposure,
they convert first.

Everything numeric below was **run**, on this machine, today. Where a claim could not be measured
here it is marked as such rather than asserted.

---

## 0. Corrections and owned errors — measured, not inherited

I was asked to verify rather than infer, and to say so explicitly when I correct the brief. Three
things in it did not survive contact with the machine, and two of those make the underlying concern
**stronger**, not weaker. Two further entries are errors of my own: one that reached Aaron's screen
(§0.4) and one I caught mid-measurement (§0.5).

### 0.1 The cells do not run a `.sh` wrapper. They do not run at all

The brief states: *"every agent cell on this machine runs an unsigned `.sh` wrapper driving
`bun`."* That was true when the survey's inherited premise was written. It is not true now.

```
$ /usr/libexec/PlistBuddy -c "Print :ProgramArguments" ~/Library/LaunchAgents/com.lucent.zeta.otto.plist
Array { /Users/acehack/.zeta/clones/otto/tools/kiro/kiro-loop-wrapper.sh }

$ ls ~/.zeta/clones/otto/tools/kiro/
ls: /Users/acehack/.zeta/clones/otto/tools/kiro/: No such file or directory     # identical for vera, lior, alexa
```

`tools/kiro/kiro-loop-wrapper.sh` was **deleted from `main` on 2026-06-13** by PR #8088
(*"refactor: port service wrappers from shell to TypeScript"*). Each cell runs
`git reset --hard origin/main` on provision, so the file left every clone. The four plists still
name it:

```
$ launchctl list | grep zeta
-  78  com.lucent.zeta.alexa
-  78  com.lucent.zeta.vera
-  78  com.lucent.zeta.lior
-  78  com.lucent.zeta.otto
-   0  com.lucent.zeta.kiro-loop
```

`78` is `EX_CONFIG` (`sysexits.h:114`) — launchd could not spawn the program. No PID. The four
`launchd-stderr.log` files are zero-length, last written **2026-06-11**. (The same exit code was
independently recorded for otto in `docs/research/2026-08-14-ace-as-universal-zetaid-pointer-resolver-…`;
this note reproduces it for all four and supplies the cause.)

**This is a live availability finding, not only a security one:** four of the five cells on this
box have been dead for two months because a refactor removed the file their installed plists name,
and nothing noticed. The provisioner that writes those plists still emits the dead path today —
`tools/setup/host-loop-bootstrap.sh:142`.

### 0.2 Removing the `.sh` created no code identity — which is the whole point

The one **live** cell shows what the port actually produced:

```
$ /usr/libexec/PlistBuddy -c "Print :ProgramArguments" ~/Library/LaunchAgents/com.lucent.zeta.kiro-loop.plist
Array {
    /Users/acehack/.local/share/mise/installs/bun/1.3/bin/bun
    /Users/acehack/Documents/src/repos/Zeta/src/Core.TypeScript/service/loop-tick.ts
    --persona
    kiro
}
```

`src/Core.TypeScript/service/templates/launchd.plist` and `templates/systemd.service` both emit
this shape: `{{BUN_PATH}} …/loop-tick.ts --persona {{PERSONA}}`. **No shell anywhere.**

And the code identity is unchanged:

```
$ codesign -dv --verbose=2 $(which bun)
Authority=Developer ID Application: Jarred Sumner (7FRXF46ZSN)
TeamIdentifier=7FRXF46ZSN
```

So the shell **has already been deprecated out of the cell entry path**, and it bought exactly
zero isolation. The `.ts` file is data read by an interpreter; the executing identity is `bun`'s.

> **The correction that matters:** *the `.sh` was never the identity gap. The **interpreter** is.*
> Shell → TypeScript-run-by-bun is a **legibility and portability** win, which is why it was done,
> and it is **security-neutral by construction**. Only `bun build --compile` + a signature we
> control changes the identity. A deprecation programme that stops at "no more `.sh`" will report
> success having moved the security needle not at all.

### 0.3 The cells do not share *one* code identity — the credential-touching layer has at least five, and two are unsigned scripts

The brief says all four cells share one identity (bun's). At the *launcher* layer, true. But the
launcher touches no credentials. `loop-tick.ts` contains no keychain, token or `security` call;
it `spawnSync`s the persona's harness CLI (`persona-registry.ts`), and **that** child reads the
credentials. Measured on this machine:

| harness | persona(s) | binary kind | code identity |
|---|---|---|---|
| `claude` | otto, soraya, tariq | Mach-O arm64 | Developer ID: **Anthropic PBC (Q6L2SF6YDW)** |
| `agy` | lior | Mach-O arm64 | Developer ID: **Google LLC (EQHXZ8M8AV)** |
| `kiro-cli` | kiro | Mach-O universal | Developer ID: **AMZN Mobile LLC (94KV3E626L)** |
| `codex` | codex | `#!/usr/bin/env node` **script** | **none** |
| `cursor-agent` | riven | **bash script** | **none** |
| `op` | (token use) | Mach-O arm64 | Developer ID: **AgileBits Inc. (2BUA8C4S2C)** |
| `gh` | (git/PR) | Mach-O arm64 | **ad-hoc only** (Homebrew), no Developer ID |
| `bun` | all launchers | Mach-O arm64 | Developer ID: **Jarred Sumner (7FRXF46ZSN)** |

Two consequences the single-identity framing hides:

1. **`cursor-agent` is still a shell script**, and it is on the *credential* path, not the launcher
   path. It is not in this repo, so no amount of in-repo `.sh` deprecation reaches it.
2. **Per-cell binding is unreachable at the harness layer regardless of what we compile.** Any ACL
   permissive enough for otto to work must trust `Q6L2SF6YDW` — shared with every Claude Code user
   on earth, and with soraya and tariq. Compiling *our* launcher does not change who reads the key.

Also note every harness is invoked with its gate disabled — `--permission-mode auto`,
`--trust-all-tools`, `--approval-mode full-auto`, `--dangerously-skip-permissions`
(`persona-registry.ts:52-105`). A cell's effective exposure is not its entry point's; it is the
whole uid's.

### 0.4 An error I made that reached the human — a modal dialog I should never have caused

While measuring §3.1, I created a throwaway keychain, bound an item's ACL to a compiled binary,
and then **deliberately attempted a read from an untrusted caller to see whether the ACL would
deny.** macOS answered that attempt the way it always does: with a **GUI dialog asking for a
keychain password.** The password was one I had generated for the test; Aaron had never seen it and
could not have known it. He got a modal prompt on his screen, from an agent, asking for a
credential that did not exist for him. He screenshotted it and asked what it was.

That is a real failure, not a cosmetic one, and it is mine. The generalisable rule:

> **An autonomous agent must never park an interactive credential dialog in front of the human.**
> If an operation *would* prompt, "this path requires interactive auth" is the finding — record it;
> do not attempt it and leave it hanging. And a **denial is a perfectly good result**: the ACL gate
> firing is the property under test, not an obstacle to route around.

What I did right and what I did wrong, stated separately so the correction is usable:

- **Right:** the keychain was created by me, in a temp path, with a password I generated, unlocked
  programmatically. `login.keychain-db` and the System keychain were never modified.
- **Wrong:** I bound the ACL with `-T <binary>` and no `-A`, then invoked the *untrusted* path. That
  combination can only end in a prompt. The safe form is to make the prompt impossible (`-A`, or an
  ACL that already lists every caller under test) and to read the denial off the ACL dump — which is
  exactly where the `cdhash` evidence in §3.1 actually came from, with no dialog required.

**Cleanup, confirmed rather than assumed** (the probe **completed**; it did not abort):
`security delete-keychain` was run at the time, and re-verified after the report —
`security list-keychains` returns only `login.keychain-db` and `System.keychain`, no `shdep-test`
keychain exists anywhere, no stray `security(1)` or `SecurityAgent` process remains, and the entire
`/tmp/shdep-probe` working directory (including the compiled probe binaries) has been removed. No
capture file on disk ever held key material: the two non-empty ones were `exit=44 len=0` (14 bytes)
and `rc=0` (5 bytes).

**On reads of the real login keychain:** the §2.1 measurements read credential *lengths* into a
process and printed only lengths — no value was printed, logged, or written to disk. Those numbers
are in the record now and will not be re-run.

### 0.5 An error I made and corrected mid-measurement

My first determinism test reported that `bun build --compile` was **not** reproducible: two builds
of byte-identical source differed. It was my artifact. Only 33 bytes of 63,446,114 differed, and
the payload byte sat inside the embedded string `/$bunfs/root/rb3` vs `/$bunfs/root/rb4` — **the
`--outfile` basename is compiled into the binary**, and I had used different names. Re-run with the
same basename in two different directories:

```
9afe0b8bbef764153fb269406a57f6e44cf57cae8221ba4b6cfd2adf2efb2551  d1/zeta-cell
9afe0b8bbef764153fb269406a57f6e44cf57cae8221ba4b6cfd2adf2efb2551  d2/zeta-cell
CDHash=437c4b94ced40f451f552e2fd48915a759002866   (identical, both)
```

Recorded because the wrong version would have killed the plan on a false premise, and because the
caveat is real and load-bearing: **the output filename is a build input.** Rename the artifact,
change the cdhash, break every ACL that names it.

---

## 1. Enumerate and classify — the total is the least useful number

### 1.0 Prior art I should have found first: the inventory already exists and is CI-enforced

I hand-rolled an enumeration before checking whether one existed. It does, it is enforced on every
PR (`gate.yml` → `lint (bash retirement inventory + hygiene unit tests)`), and the tool is
`src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts`. It reports **31 retained shell
entrypoints**, zero drift, with a categorized allowlist:

| existing category | n |
|---|---|
| `setup/bootstrap` | **22** |
| `git hooks` | 4 |
| `nixos installer` | 3 |
| `host-service wrappers` | 2 |

Two things follow, and the second is the whole point of this note.

**(a) My glob undercounted by three.** `git ls-files '*.sh'` misses the extensionless shell files:
`githooks/pre-push`, `scripts/hooks/pre-push`, `scripts/hooks/commit-msg`. With those, my 28
executable scripts and the allowlist's 31 agree exactly. **The allowlist is the correct
denominator; use it, not a glob.** (My independent count is still worth something: it is what
established that 2 of the 36 glob hits are markdown stubs and 6 are frozen archive — the allowlist
correctly excludes all 8 already.)

**(b) The existing category schema has no exposure dimension, and that is exactly the gap.**
`setup/bootstrap` holds **22 of the 31** — and inside that one bucket sit
`persona-keys/keyring.sh` (BIP-39 seed → every key type), `op-token-setup.sh` (writes the
1Password token to the keychain) and `secret-clip.sh` (arbitrary keychain read/write) **alongside**
`install-zig.sh`, `agda-cubical.sh` and the three toolchain smoke tests.

> The categories answer *"why is this still shell?"* — a **retention** question, and they answer it
> well. Nothing in the schema answers *"what can it reach?"* So the artifact that governs the
> deprecation programme is, structurally, ordered by bootstrap convenience.

This note's deliverable is therefore narrower and more actionable than a fresh inventory: **add an
exposure dimension to the allowlist that already exists.** Not a new list — a second axis on the
current one, so `keyring.sh` and `install-zig.sh` stop sharing a bucket.

### 1.1 The classification

`git ls-files '*.sh'` returns **36** paths. `references/prior-art/` is excluded throughout
(gitignored, gigabytes; a naive recursive search there is a multi-hour runaway — CLAUDE.md
conventions). Of the 36:

- **2 are not shell scripts at all.** `db/common/host-tier.sh` and
  `db/tools/setup/common/sync-prior-art.sh` are markdown carved-sentence stubs whose *directory*
  is named `<script>.sh/`. 108 and 118 bytes. They match the glob and execute nothing.
- **6 are frozen archive** under `docs/recovered-orphan-branches-2026-05/` — recovered history,
  on no execution path. Includes the deleted `tools/kiro/kiro-loop-wrapper.sh` and
  `tools/riven/riven-cursor-terminal-loop.sh`.

**28 executable shell scripts remain.** Classified by what they actually are:

| class | n | files |
|---|---|---|
| **cell entry point** | **0 in repo** | none — see §0.1/§0.2. The class is empty on `main`; the four installed plists name a path that no longer exists, and the live one execs `bun` directly. `.gemini/service/lior-loop.sh` is a self-declared *shim* (`# SHIM — … backward compatibility only`) that `exec`s `bun loop-tick.ts`. |
| **credential-touching** | **3** | `tools/setup/op-token-setup.sh` (writes the 1Password service-account token to the login keychain, writes the `secrets-env.sh` hoist), `tools/setup/secret-clip.sh` (generic clipboard→keychain add/read/delete), `tools/setup/persona-keys/keyring.sh` (BIP-39 seed → every key type; sinks to Vault or a GitHub secret) |
| **install / setup** | 17 | `tools/setup/install.sh` (the entry point, 115 inbound refs), `macos.sh`, `linux.sh`, `common/mise.sh`, `common/shellenv.sh`, `common/curl-fetch.sh`, `common/host-tier.sh`, `common/profile-edit.sh`, `common/fd-limits.sh`, `common/agda-cubical.sh`, `common/tlaps.sh`, `common/install-zig.sh`, `common/install-rust-wasm32.sh`, `common/sync-prior-art.sh`, `doctor.sh`, `tools/installer/zeta-self-register.sh`, `scripts/hooks/install-git-hooks.sh` |
| **node provisioning (privileged)** | 3 | `full-ai-cluster/usb-nixos-installer/zeta-install.sh` (1979 lines, greedy N-disk installer), `zeta-first-boot.sh`, `tools/setup/host-loop-bootstrap.sh` (writes launchd plists; still emits the dead path) |
| **CI-only smoke** | 3 | `common/smoke-7-toolchains.sh`, `smoke-10-toolchains.sh`, `smoke-13-toolchains.sh` |
| **vestigial / shim** | 2 | `.gemini/service/lior-loop.sh` (self-declared shim, 3 refs), `.gemini/service/install-lior-service.sh` (2 refs; `cp` + `launchctl load` of a plist) |
| **git hooks** *(extensionless — missed by my glob, caught by the allowlist, §1.0)* | 3 | `githooks/pre-push` (37 ln), `scripts/hooks/pre-push` (136 ln), `scripts/hooks/commit-msg` (39 ln). No credential access in their own text — but they execute **in the developer's interactive shell**, which per §2.2 already carries the OP token in its environment |

**Why the classification carries the weight.** `smoke-13-toolchains.sh` runs on an ephemeral GitHub
runner with a scoped `GITHUB_TOKEN` and no persistent keychain; `keyring.sh` handles a BIP-39 seed
on a machine with a live 1Password service account. A single "28 shell scripts remain" number
prices those the same, and would let a deprecation programme retire the smoke scripts first because
they are 63 lines.

Two structural facts that constrain any conversion order:

- **The install chain is pre-`bun` by construction.** `common/mise.sh` is what *installs* bun;
  `macos.sh:25` errors out if bun is absent. A `bun`-run CLI cannot bootstrap bun. (A
  `--compile`d, self-contained binary *can* — it has no bun dependency — but it must then be
  distributed as a prebuilt artifact, which is a release-engineering problem, not a port.)
- **Sourced libraries cannot become binaries at all.** `macos.sh:39` / `linux.sh:38`
  `source common/curl-fetch.sh`; `macos.sh:98` sources `common/host-tier.sh`. A compiled binary
  cannot export functions into its parent shell. These are shell **by requirement**, not by habit.

---

## 2. Key exposure — measured, and the ranking that falls out

### 2.1 The baseline, reproduced and extended

The survey's baseline (`security find-generic-password -s zeta-op-service-account -w` → 852 bytes,
no prompt) reproduces, and is wider than one item. Probe run from an ordinary `bun` process as
`acehack`; **lengths only, no value ever read into a log**:

```
READ-OK  zeta-op-service-account              len=852
READ-OK  zeta-op-aaron                        len=852
READ-OK  zeta-op-ca                           len=852
READ-OK  gh:github.com                        len=74
READ-OK  Claude Code-credentials              len=9295
READ-OK  /Users/acehack/.ssh/id_ed25519       bytes=432
READ-OK  /Users/acehack/.config/gh/hosts.yml  bytes=110
```

The login keychain holds **236 items**. Credential-bearing service names include
`zeta-op-service-account`, `zeta-op-aaron`, `zeta-op-ca`, `zeta-op-ca-standby`,
`zeta-op-lucent-standby`, `zeta-op-personal-standby`, `zeta-manus-api-key`, `gh:github.com`,
`gemini`, `cursor-access-token`, `cursor-refresh-token`, `kirocli:odic:token`, and **13 distinct
`Claude Code-credentials*` entries**. Every one is `acehack`-readable with no prompt.

### 2.2 The highest-exposure surface is a `.sh` file that is not in the repo

```
$ ls -l ~/.config/zeta/secrets-env.sh
-rw-------@ 1 acehack staff 272 Jun 21 14:52
$ head -3 ~/.config/zeta/secrets-env.sh
# Zeta managed agent secrets — Keychain-FETCH lines (NOT secrets). mode 600.
# Written by tools/setup/op-token-setup.sh
export OP_SERVICE_ACCOUNT_TOKEN="$(security find-generic-password -s zeta-op-service-account -w 2>/dev/null)"
$ [ -n "$OP_SERVICE_ACCOUNT_TOKEN" ] && echo "PRESENT len=${#OP_SERVICE_ACCOUNT_TOKEN}"
PRESENT len=852
```

The token is **already in this agent session's environment**. `shellenv.sh:111` writes the
`. ~/.config/zeta/secrets-env.sh` line into the user profile, so every interactive shell and every
descendant process inherits it.

That matters more than any signature question, because **an environment variable crosses `exec`
regardless of the child's code identity.** A perfectly signed, perfectly ACL'd binary that is
`exec`'d from such a shell already has the token before it makes a single keychain call. No code
signature, no keychain ACL, and no IMA policy can gate a variable that was inherited.

This is §13 noninterference stated for credentials: the token enters through an **ambient** channel
rather than a declared, metered one. It is the one genuinely un-signable surface here, and it is
the cheapest thing on this list to fix — the fix is to stop hoisting and read at point of use.

Honest boundary on how far the ambient leak reaches: the launchd plists set **explicit**
`EnvironmentVariables` with no `OP_*` key, so launchd-started cells do **not** inherit it; they would
have to read the keychain. The ambient hoist is a **human-shell and agent-session** exposure, and
this session is a live instance of it.

### 2.3 The caveat that governs the urgency argument

**There are no FROST shares on disk.** `~/.zeta/` contains `agents/`, `artifacts/`, `backups/`,
`clones/` and nothing matching `*share*` or `*frost*`; `~/.config/zeta/` likewise. There are no
code-signing identities either — `security find-identity -v -p codesigning` returns **`0 valid
identities found`**, so the fleet cannot presently sign anything with a Developer ID.

So this is **pre-positioning ahead of the risk, not incident response.** The custody stack (FROST,
DKG, reshare, ROAST, seal tiers) is built and tested and is holding no share. Overstating this
would be the failure mode: the honest claim is *"the sovereign keys are not provisioned yet, and
the order in which we convert should be fixed before they are,"* not *"agent keys are exposed."*
What **is** exposed today is one 1Password service account (three tokens plus standbys), a GitHub
token, thirteen Claude credential blobs, and an SSH private key — all shared, all `acehack`-owned,
and all legitimately needed by the cells as currently designed.

### 2.4 The ranking

Exposure is scored on what the script can reach **as measured**, not on line count or age.

| # | script | what it reaches (evidence) | code identity today | convert |
|---|---|---|---|---|
| **1** | `~/.config/zeta/secrets-env.sh` *(generated, untracked — written by `op-token-setup.sh:83`)* | Hoists the 852-byte OP service-account token into **every shell's environment**; measured present in this session (`len=852`) | `/bin/bash` (sourced) | **first — and the fix is deletion, not compilation.** Read at point of use. A binary cannot fix an inherited env var. |
| **2** | `tools/setup/persona-keys/keyring.sh` | BIP-39 seed → Ed25519/secp256k1/age/nostr; the only script that ever holds *root* key material. Sinks to Vault or `gh secret set`. Its own header states the seed must never hit argv or stdout | `/bin/bash` | **first compile.** Highest consequence per invocation; already biometric-adjacent (`--publish` moved to a biometric-gated `publish.ts`), so the gate exists to bind to |
| **3** | `tools/setup/op-token-setup.sh` | `security add-generic-password` of the OP token (`:72`); **writes surface #1** (`:83`); token is passed in-process, never argv | `/bin/bash` | second. Converting this is what lets #1 be deleted |
| **4** | `tools/setup/secret-clip.sh` | Generic `add`/`find`/`delete-generic-password` over **any** service name (`:93,:110,:118`) — an arbitrary-keychain-item read/write tool | `/bin/bash` | third |
| **5** | `tools/setup/host-loop-bootstrap.sh` | Writes the launchd plists that define what every cell executes. Reaches no secret; **defines the code identity of everything that does.** Currently emits a dead path (§0.1) | `/bin/bash` | fourth — the identity-defining surface, and it is also broken today |
| **6** | `full-ai-cluster/usb-nixos-installer/zeta-install.sh` (1979 ln) + `zeta-first-boot.sh` | Root-privileged N-disk node provisioning; runs before any of this exists | `/bin/bash` (pre-boot) | later — and see §3.2, the Linux path wants a different artifact anyway |
| **7** | `tools/setup/install.sh` + `macos.sh` / `linux.sh` / `common/mise.sh` | Installs toolchains, edits the profile. Privileged, but **pre-`bun` by construction** — cannot be a bun CLI without a prebuilt-binary distribution story | `/bin/bash` | later, and only with a release pipeline |
| **8** | `common/curl-fetch.sh`, `common/host-tier.sh` | `source`d function libraries (`macos.sh:39,98`, `linux.sh:38`) | `/bin/bash` | **never — cannot be compiled.** A binary cannot export functions to its parent shell |
| **9** | smoke-{7,10,13}-toolchains, `install-git-hooks.sh`, `install-zig.sh`, `install-rust-wasm32.sh`, `agda-cubical.sh`, `tlaps.sh`, `sync-prior-art.sh`, `fd-limits.sh`, `profile-edit.sh`, `doctor.sh`, `zeta-self-register.sh` | No credential access measured. Smoke scripts run only on ephemeral CI runners (`.github/workflows/*: run: ./tools/setup/install.sh`) with a scoped `GITHUB_TOKEN` | `/bin/bash` | **last**, or never. Converting these first would be convenience order |
| **10** | `.gemini/service/lior-loop.sh`, `install-lior-service.sh`, the 6 archive scripts, the 2 `db/` markdown stubs | Nothing. Shims and frozen history | n/a | **delete, do not port** |

Note rows 1 and 5 carry no secret of their own and still rank above four scripts that do. The rule
the ranking encodes: **a surface that determines what other code may reach outranks a surface that
reaches something once.**

---

## 3. Feasibility — three questions, answered by running them

### 3.1 Does `bun build --compile` produce a codesignable Mach-O on Apple Silicon? — **Yes**

Bun 1.3.14, M2 Ultra, macOS 15:

```
$ bun build --compile probe.ts --outfile probe-bin      # 63,446,114 bytes
$ file probe-bin
probe-bin: Mach-O 64-bit executable arm64
$ codesign -dv --verbose=2 probe-bin
CodeDirectory v=20400 flags=0x20002(adhoc,linker-signed)  Identifier=a.out
```

It arrives **already ad-hoc linker-signed**, with identifier `a.out`. Re-signing with a chosen
identifier and the hardened runtime works, and the binary still runs:

```
$ codesign --force --sign - --options runtime --identifier com.lucent.zeta.probe probe-signed
probe-signed: replacing existing signature
$ codesign --verify --strict --verbose=2 probe-signed
probe-signed: valid on disk
probe-signed: satisfies its Designated Requirement
$ ./probe-signed
zeta-probe ok
$ codesign -dvvv probe-signed | grep -E 'Identifier|CDHash'
Identifier=com.lucent.zeta.probe
CDHash=1bfc156e2add68e2d3ec0baf735382a1aa5545d9
```

`--sign -` is **ad-hoc**: it creates and holds no key material, which is why it was the form used
here (see §5.2). Three results with practical teeth:

- **`spctl --assess --type execute` → `rejected`.** Expected — Gatekeeper wants Developer ID plus
  notarization. It is **not a blocker for locally built cell binaries**: the binary executed
  normally, because a locally produced file carries no `com.apple.quarantine` xattr. It *would*
  block a downloaded prebuilt artifact, which is exactly the distribution path §2.4 row 7 needs.
  So: fine for build-on-node, gating for ship-a-binary.
- **The build is byte-reproducible** given the same source and the same `--outfile` basename
  (§0.5). Two builds in different directories → identical sha256 and identical CDHash.
- **The cdhash is the identity a macOS ACL actually records.** Measured directly, in a throwaway
  keychain created and deleted for the test:

```
$ security add-generic-password -a probe -s shdep-acl-probe -w "NOT-A-REAL-SECRET-…" \
      -T /tmp/shdep-probe/zeta-reach  shdep-test.keychain
$ security dump-keychain -a shdep-test.keychain | grep -A2 'applications ('
        applications (1):
            0: /tmp/shdep-probe/zeta-reach (OK)
                requirement: cdhash H"6835db1d8e3b23d65c8e6d37d41c0771f7c407cb"
```

A `bun --compile` binary **is** accepted as a keychain trusted application, and for an ad-hoc
signature the recorded requirement is a **cdhash pin**. So reproducibility is not a nicety: it is
the property that decides whether an ad-hoc-signed ACL survives a rebuild. (With a real Developer
ID the requirement would instead be `identifier … and anchor …`, stable across rebuilds — which is
the argument for Aaron obtaining one, and the reason §5.2 stops there.)

**Two negative results from the same experiment, and they are the valuable ones.**

**(a) The ACL denies, and on macOS the denial is a *prompt*, which on an unattended cell is a
wedge.** With the item bound to the binary only, an untrusted caller did not get `EACCES` — it got
a GUI password dialog and hung past a 12-second guard. That is the survey's Option-1 objection
reproduced by measurement: on a 60-second-interval unattended launchd cell, an ACL miss is not a
denial, it is a stuck cell. **The denial itself is the correct behaviour and the property under
test** — the defect is macOS's *form* of denial, not the gate. It is also the finding that should
have been read off the ACL dump instead of provoked; see §0.4, where provoking it put a dialog in
front of Aaron.

**(b) `security(1)` launders the caller's identity — the ACL denies the *trusted binary itself*.**
Re-bound to the rebuilt binary's cdhash and run from that binary:

```
$ ./zeta-reach                 # trusted app; reads via Bun.spawnSync(["security", …])
exit=44 len=0                  # 44 → errSecInteractionNotAllowed; DENIED
```

The process asking the keychain is `/usr/bin/security`, Apple-signed, not on the ACL. So the
repo's actual read mechanism defeats the binding in *both* directions. Every credential read
currently goes this way, in shell **and in TypeScript** —
`tools/setup/manus-smoke-test.ts:16` is `execFileSync("security", ["find-generic-password", …])`,
the same defect already ported. **L2 on macOS requires replacing `security(1)` subprocess calls with
in-process Security.framework calls**, at four sites: `op-token-setup.sh` (4), `secret-clip.sh` (3),
`manus-smoke-test.ts` (1), `shellenv.sh` (1, in a generated string).

Corollary worth stating plainly: **porting shell → TypeScript does not fix this.** `spawnSync` and
`$( )` launder identity identically.

### 3.2 Linux: what is the artifact, and what does IMA need? — **not measured here; no Linux node reachable from this session**

Stated as documentation plus repo evidence, and flagged as unverified rather than dressed up:

- **Artifact.** `bun build --compile --target=bun-linux-x64` produces a self-contained ELF. IMA
  appraisal wants an **X.509-rooted signature over file content stored in the `security.ima`
  extended attribute**, validated against a key in the `.ima` keyring (`evmctl ima_sign`).
- **The xattr objection weakens for a compiled binary, and that is the real change.** The survey
  ruled IMA out largely because xattrs do not survive `git`, and cells rewrite their tree with
  `git reset --hard origin/main` every cycle — so every `.ts` file would need re-signing on every
  sync, which puts the IMA signing key on the node being protected. A **compiled binary is not in
  git**: it is a build/release output, so it can be signed **once, off-node, at release time**, and
  the key never lands on the protected machine. This is the single strongest security argument for
  compilation, and it is a Linux argument, not a macOS one.
- **TPM 2.0 is available on the x86 fleet** — AMD fTPM in the PSP on consumer Ryzen, Intel PTT on
  Intel client parts. Aaron 2026-08-14: *"microsoft made this standard in all hardware a long time
  ago so it's something we can count on in most consumer systems."* Windows 11 has required TPM 2.0
  since 2021 and firmware TPM has been a Windows-certification requirement since ~2016. So the L3
  rung is **not hardware-blocked** on Linux nodes.
- **Two caveats that must ride with that.** fTPM commonly ships *disabled in BIOS* — a per-node
  physical ceremony, and nobody has run the probe on a Linux node
  (`tools/setup/persona-keys/frost-hardware-probe.ts` checks `/dev/tpmrm0`, `/dev/tpm0`,
  `/sys/class/tpm`; one line, unrun). And fTPM ≠ discrete TPM: *faulTPM* (TU Berlin,
  arXiv:2304.14717; AMD-SB-4005) extracts the chip-unique secret via ~$200 of voltage fault
  injection on the SVI2 bus. That needs physical board access, so against the stated threat model —
  a confused agent, not a soldering iron — fTPM is adequate; it should simply never be described as
  equivalent.
- **The asymmetry is real and should not be smoothed over.** **Apple Silicon has no TPM 2.0**
  (confirmed by the probe on the Mac Studio: `TPM 2.0: Not found`). The Secure Enclave is not a
  substitute: it is reachable only through the Keychain (`kSecAttrTokenIDSecureEnclave`), is
  **P-256 only**, exposes no AES key-wrapping primitive of the required shape, and cannot do
  Ed25519 FROST partials (`frost-partial-signer.ts:110-113`, `frost-share-adapter.ts:705-709`). So
  the ladder tops out differently per platform: **Linux nodes can reach L3; the Mac reaches L2 at
  best, and L2 on the Mac has the prompt-wedge and identity-laundering defects measured in §3.1.**

### 3.3 What breaks when a `.sh` becomes a compiled binary — the actual instances

Not a checklist of hypotheticals; these are the occurrences found by search.

| breakage | instances found | consequence |
|---|---|---|
| **`source`ing** — a binary cannot export functions to its parent shell | `macos.sh:39` and `linux.sh:38` `source common/curl-fetch.sh`; `macos.sh:98` `. common/host-tier.sh` | `curl-fetch.sh` and `host-tier.sh` are **not convertible**. Row 8 of §2.4 |
| **Profile injection** — the whole product is text sourced by a shell | `shellenv.sh:111` writes `. ~/.config/zeta/secrets-env.sh` into the profile | `shellenv.sh` can be *generated by* a binary but its output is irreducibly shell |
| **launchd plists naming a script path** | 4 installed plists name `…/tools/kiro/kiro-loop-wrapper.sh`; `host-loop-bootstrap.sh:142` still emits it | Already broken (§0.1). Any rename during conversion breaks plists the same way — and cdhash-pinned ACLs additionally break on the **filename** change (§0.5) |
| **`$0` / `BASH_SOURCE` self-location** | 16 of the 28 scripts; heaviest `doctor.sh` (3), `mise.sh`/`profile-edit.sh`/`sync-prior-art.sh`/`keyring.sh`/`host-loop-bootstrap.sh` (2 each). `keyring.sh:33-34` derives `REPO` from `BASH_SOURCE` | Mostly mechanical (`import.meta.dir` / `process.execPath`), but a `--compile`d binary is **relocatable and single-file**, so "the repo is three levels up from me" stops being true. Each of the 16 needs an explicit root, not a derived one |
| **Bootstrap ordering** | `common/mise.sh` installs bun; `macos.sh:25` hard-errors without it | The install chain cannot become bun CLIs run from source. It can become **prebuilt** binaries — which then hit `spctl` (§3.1) and need notarization |
| **Identity laundering via subprocess** | `op-token-setup.sh` ×4, `secret-clip.sh` ×3, `manus-smoke-test.ts` ×1, `shellenv.sh` ×1 | Survives the port and silently voids any ACL (§3.1b). **This is the one that must be fixed in the same change as the compilation, or the compilation buys nothing** |
| **CI invocation by path** | `.github/workflows/{git-hotspot-cadence,memory-index-duplicate-lint,ci-cache-paths-lint,k8s-argocd-health-test,low-memory}.yml`: `run: ./tools/setup/install.sh` | 5 workflows call `install.sh` by path. A compiled replacement must either keep the path or land with the workflow edits |

Not found: any script that greps its own text, and no `curl | bash` of an in-repo script (the
`curl | sh` instances are third-party installers — mise, Determinate Nix — inside `linux.sh`, a
separate and already-tracked concern, `081KQ8P5D0008QG0R001DMK8JD`).

---

## 4. The sequence

Ordered by measured exposure, with the enabling work named where it exists.

1. **Delete the ambient hoist.** `~/.config/zeta/secrets-env.sh` and the `shellenv.sh:111` line that
   installs it. Read the token at point of use. This is the largest exposure reduction available and
   it requires no signing, no binary, and no new mechanism. It is also the only item here that a
   signed binary **cannot** fix.
2. **Convert `keyring.sh` → a compiled, signed `zeta-keyring` binary**, replacing its `security(1)`
   and key-handling paths with in-process calls. Highest consequence per invocation; already sits
   behind a biometric gate for publish.
3. **Convert `op-token-setup.sh`**, which is what makes step 1 permanent, then `secret-clip.sh`.
   Both must move off `security(1)` subprocesses in the same change (§3.1b) or the conversion is
   cosmetic.
4. **Fix and convert `host-loop-bootstrap.sh`.** It is broken today (§0.1) and it is the surface
   that decides every cell's code identity. Emitting `{{BUN_PATH}} loop-tick.ts` restores the four
   dead cells; emitting a per-cell compiled binary is the actual L2 prerequisite.
5. **Linux node artifacts** (`zeta-install.sh`, `zeta-first-boot.sh`) — but only after the off-node
   release-signing question in §3.2 is answered, because that is where the genuine security win is.
6. **Never**: `curl-fetch.sh`, `host-tier.sh` (sourced libraries). **Delete, do not port**:
   the two `.gemini/service` scripts, the 6 archive scripts, the 2 `db/` markdown stubs.
7. **Last**: the smoke and toolchain-installer scripts. They are the easiest and they are worth the
   least. Doing them first is exactly the convenience ordering this note exists to displace.

---

## 5. Two boundaries this note does not cross

### 5.1 A signed per-cell binary is necessary, not sufficient — and here is the measurement

The isolation property does **not** follow from the binary. Proven directly: the reachability probe
was recompiled with `bun build --compile`, ad-hoc signed with its own identifier
(`com.lucent.zeta.reach`) and its own cdhash, and re-run.

```
--- via COMPILED + SIGNED binary (own cdhash, own identifier) ---
READ-OK  zeta-op-service-account  len=852
READ-OK  zeta-op-aaron            len=852
READ-OK  zeta-op-ca               len=852
READ-OK  gh:github.com            len=74
READ-OK  Claude Code-credentials  len=9295
READ-OK  ~/.ssh/id_ed25519        bytes=432
```

Byte-for-byte identical to the shell result. **Compiling and signing changed the identity and
changed nothing about access.** It creates the *noun* a policy can name; the policy is separate
work, tracked as the L1/L2/L3 ladder in
`docs/research/2026-08-14-code-bound-key-access-preliminary-integration-agent-to-agent-isolation-on-one-machine.md`.
This note feeds that ladder its missing precondition and claims nothing beyond it.

**Three words that must not blur — and a parallel finding says they currently do.** At the L0/L1
tiers there is **no attestation happening at all**; what exists is at-rest chip-binding. So keep
these separate everywhere downstream of this note:

| term | what it is | what this note delivers |
|---|---|---|
| **code identity** | a cryptographically nameable executing artifact — a cdhash, or an identifier under a signing cert | **this is the only thing a signed per-cell binary creates**, and §3.1 measured that it works |
| **custody** | a key held such that only that identity can *use* it — a keychain ACL, an IMA policy, a PCR seal | not delivered here; the L2/L3 ladder. §5.1's probe shows custody is absent today |
| **attestation** | a *third party* being able to verify which code holds the key — needs a vendor/hardware root and a remote verifier | not delivered here, and not delivered by the ladder's lower rungs either. Chip-binding at rest is **custody, not attestation** |

Stating it as a claim ladder: *"we compiled and signed it"* buys **identity**. *"only it can read
the key"* would be **custody** and is unbuilt. *"we can prove to someone else that it is what read
the key"* would be **attestation** and needs a root we do not have. Collapsing the three is how a
signed binary gets reported as an isolation guarantee.

And per §0.3, even a fully signed launcher does not reach the harness CLI that actually reads the
credentials. The per-cell binary is a floor, not a ceiling.

### 5.2 Signing keys are Aaron's to hold

No signing key was generated, proposed, or designed for here. Every signature in this note is
**ad-hoc** (`codesign --sign -`) — a hash-only signature with no certificate and no key material,
chosen precisely so the feasibility question could be settled without creating a key. The machine
currently holds **`0 valid identities found`** for code signing; obtaining a Developer ID is a
human decision with a human's name on the certificate.

Aaron's standing constraint governs the shape of anything built from this:

> *"nothing operator-run, only operator-approved via biometric"* — the agent executes the setup, the
> human approves each sensitive gate.

So: an agent may run the build, produce the unsigned/ad-hoc artifact, and stage it. The
Developer-ID signing step is a biometric-gated operator action. No flow in which an agent holds the
code-signing key. No key material printed or logged — every measurement above reports a **length**.

---

## 6. Anchors (Beacon)

- **Apple code signing / cdhash / Designated Requirements** — *Code Signing Guide* and
  `codesign(1)`; `SecTrustedApplicationCreateFromPath` deprecated at macOS 10.15 and still the only
  way to place a program on a keychain item's ACL. The `requirement: cdhash H"…"` line in §3.1 is
  this API's on-disk form.
- **IMA/EVM** — Reiner Sailer, Xiaolan Zhang, Trent Jaeger, Leendert van Doorn, *"Design and
  Implementation of a TCG-based Integrity Measurement Architecture"* (USENIX Security 2004); Linux
  `Documentation/security/IMA-templates.rst`; Mimi Zohar's `ima-evm-utils` (`evmctl`).
- **TPM 2.0 / PCR sealing** — TCG *TPM 2.0 Library Specification*. Attack bound: Hans Niklas Jacob
  et al., *"faulTPM: Exposing AMD fTPMs' Deepest Secrets"* (arXiv:2304.14717, 2023); AMD-SB-4005.
- **Reproducible builds** — the Reproducible Builds project (Lamb & Zacchiroli, *"Reproducible
  Builds: Increasing the Integrity of Software Supply Chains"*, IEEE Software 2022). §0.5's
  filename-is-a-build-input caveat is the ordinary form of this.
- **Confused deputy** — Norm Hardy, *"The Confused Deputy"* (ACM SIGOPS OSR 22(4), 1988). §3.1b is
  a textbook instance: `security(1)` is a deputy exercising *its* authority on behalf of a caller
  whose authority the keychain never sees. The capability answer is Dennis & Van Horn (1966) and
  Wulf et al., **HYDRA** (CACM 1974) — an unforgeable token naming both object and rights, which is
  the shape a key-access policy needs.
- **Isolation by proof rather than measurement** — Galen Hunt & James Larus, *"Singularity:
  Rethinking the Software Stack"* (ACM SIGOPS OSR 41(2), 2007); Midori via Joe Duffy's retrospective.
  Named by Aaron 2026-08-14 as the third way; a design lineage to borrow the manifest half from, not
  an option to adopt.
- **Noninterference** — Goguen & Meseguer (1982), *"Security Policies and Security Models"*. §2.2 is
  that property violated for credentials: an ambient channel rather than a declared, metered one.

## 7. Work-items minted

| zetaid | what |
|---|---|
| `081M00VNHB3087G0R001WHTKTH` | **umbrella** — sequence the `.sh` deprecation by measured key exposure, not convenience |
| `081M00VVBAN087G0R000XC5MN7` | **task** — add an exposure dimension to the existing CI-enforced bash-retirement allowlist (§1.0); the schema categorizes by *why still shell*, never by *what it reaches* |
| `081M00VMS1E087G0R0001SCSAH` | **bug, P1** — four of five cells dead since 2026-06-13; plists name a deleted path, `host-loop-bootstrap.sh:142` still emits it |
| `081M00VMWTB087G0R0026XSWT6` | **bug, P1** — delete the ambient OP-token hoist (`secrets-env.sh`); §13 noninterference |
| `081M00VN3FX087G0R0006ZGRWG` | **bug, P1** — `security(1)` subprocess calls launder caller identity; 9 sites; without this fix L2 buys nothing |
| `081M00VN3GR087G0R003WXE8R8` | **task** — convert `keyring.sh` to a compiled, signed CLI; signing stays a biometric-gated operator action |
| `081M00VN9P1087G0R000FYTTVS` | **task** — run the Linux TPM 2.0 probe on an x86 node; the L3 premise is documented, not verified |
| `081M00VN9PX087G0R003W8F47T` | **task** — agent probes must never surface an interactive credential dialog (§0.4, owned) |
| `081M00VNHBY087G0R0024W93JY` | **task, P3** — delete rather than port the vestigial shell surfaces; reclassify the two `db/` markdown stubs |

## 8. Pointers

- `docs/research/2026-08-14-code-bound-key-access-preliminary-integration-agent-to-agent-isolation-on-one-machine.md` — the L1/L2/L3 ladder this feeds
- `docs/research/2026-08-14-what-can-be-the-enforcer-five-options-priced-on-consumer-silicon-and-the-code-identity-that-does-not-exist.md` (PR #10683) — the survey that named the missing identity
- `docs/research/2026-08-14-nixos-secure-boot-lanzaboote-declarative-desired-state-with-one-firmware-ceremony.md` — the boot half; the chain stops at the UKI
- `src/Core.TypeScript/service/templates/launchd.plist` · `templates/systemd.service` — the current, shell-free cell entry shape
- `src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts` — the existing CI-enforced allowlist (31 retained, 4 categories); §1.0
- `src/Core.TypeScript/service/persona-registry.ts:52-105` — the harness table behind §0.3
- `tools/setup/host-loop-bootstrap.sh:142` — the dead path still being emitted
- `tools/setup/persona-keys/frost-hardware-probe.ts` — the one-line Linux TPM check nobody has run
- [`dv2-data-split-discipline-activated.md`](../../.claude/rules/dv2-data-split-discipline-activated.md) §7 noninterference — the discipline §2.2 violates
- [`toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md) — every number here was run; the unmeasured Linux claims in §3.2 are labelled as such
