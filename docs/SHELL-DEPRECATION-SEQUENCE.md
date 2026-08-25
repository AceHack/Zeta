# Shell deprecation sequence — ordered by measured key exposure

> **Umbrella:** `081M00VNHB3087G0R001WHTKTH`. This file is the artifact the umbrella's
> children consume: it says _which `.sh` converts first and why_, and the "why" is a
> number a reviewer can reproduce rather than a judgement they have to accept.

**Regenerate:**

```bash
bun run hygiene:measure-shell-key-exposure            # human report
bun run hygiene:measure-shell-key-exposure -- --markdown   # the table below
bun run hygiene:measure-shell-key-exposure -- --json       # for tooling
```

Paste the `--markdown` output between the `BEGIN/END GENERATED` markers below, then run
`npx prettier --write docs/SHELL-DEPRECATION-SEQUENCE.md` — prettier realigns table pipes,
so the embedded table matches the generator **cell-for-cell but not byte-for-byte**. Said
out loud because "generated" that silently drifts in whitespace is how a regeneration diff
gets waved through.

Source: `src/Core.TypeScript/hygiene/measure-shell-key-exposure.ts`
(pure core, fixture-tested in `measure-shell-key-exposure.test.ts`, run by the
`lint (bash retirement inventory + hygiene unit tests)` gate job).

## Why a measurement and not a list

The retained-shell allowlist in `check-bash-retirement-inventory.ts` categorises by
**why a script is still shell** — `setup/bootstrap`, `git hooks`, `nixos installer`,
`host-service wrappers`. That is a _retention_ question and it is answered well. Nothing
in that schema answers **what a script can reach**, so `setup/bootstrap` holds 22 of the
31 entries and `persona-keys/keyring.sh` shares a bucket with `install-zig.sh`. Ordered
by that schema, the deprecation converts the easy scripts first.

`docs/research/2026-08-14-shell-deprecation-sequenced-by-key-exposure-the-interpreter-is-the-identity-gap-not-the-shell.md`
§2.4 supplied a ranking by _reading_ the scripts. This file supplies one by parsing them.
Three of that ranking's rows did not survive the parse — see "Corrections", below.

## The measurement

Two independent axes, joined into one ordinal tier. Both are read off the script text.

**Material** — what class of thing the script touches:

| rank | material             | admitted by                                                        |
| ---- | -------------------- | ------------------------------------------------------------------ |
| 3    | `root-key`           | a BIP-39 seed / private key read, generated, or handled by path    |
| 2    | `stored-credential`  | a keystore or secret-manager operation, a credential file          |
| 1    | `execution-identity` | writes what _other_ code executes (plists, units, profiles, hooks) |
| 0    | `none`               | no key-bearing operation in the text                               |

**Channel** — how far the value travels:

| rank | channel     | meaning                                                                                 |
| ---- | ----------- | --------------------------------------------------------------------------------------- |
| 3    | `broadcast` | readable by unrelated processes: argv (`ps`), an exported env var, a generated env file |
| 2    | `on-disk`   | persisted to a keystore or a file                                                       |
| 1    | `confined`  | in-process only: `read -s`, a builtin, a pipe, stdin                                    |
| 0    | `none`      | —                                                                                       |

**The distinction the whole ranking turns on** is `ps(1)` visibility, and no line regex
has it:

```sh
printf '%s' "$SEED" | bun gen.ts          # printf is a BUILTIN — never in ps
security add-generic-password -w "$TOK"   # /usr/bin/security — in ps for its lifetime
env  TOKEN="$TOK" cmd                     # /usr/bin/env — the assignment IS argv
     TOKEN="$TOK" cmd                     # the SHELL sets it — not argv
```

So the measure is a lexer: it resolves quoting, comments, here-documents, command
separators and multi-line `$( )`, tracks which variables provably hold secrets, and only
then asks whether a tainted word reached a process that actually forks.

Taint is admitted by two **proven** routes (`read -s NAME`; `NAME=$(<secret source>)`)
and one **declared** route (the name is _spelled_ like a credential). Only proven taint
can raise a script to `broadcast`. Declared taint is reported and never convicts —
`gh secret set "$gh_secret"` puts the secret's _name_ in argv while the value arrives on
stdin, and treating spelling as proof mis-ranked `keyring.sh` on the first run.

## The sequence

Ranked by tier, then material, then channel, then distinct key-bearing finding kinds,
then ordinal path. No tie is broken by judgement.

<!-- BEGIN GENERATED: bun run hygiene:measure-shell-key-exposure -- --markdown -->
| # | script | tier | material | channel | witnesses (kind@lines) |
| --- | --- | --- | --- | --- | --- |
| 1 | `tools/setup/persona-keys/keyring.sh` | T4-root-key-confined | root-key | on-disk | `secure-interactive-read@100,114` `secret-store-remote@160,164` |
| 2 | `tools/setup/secret-clip.sh` | T3-credential-broadcast | stored-credential | broadcast | `clipboard-secret-read@54` `secure-interactive-read@64` `argv-secret@93` `keystore-write@93` `keystore-read@110` |
| 3 | `tools/setup/common/mise.sh` | T3-credential-broadcast | stored-credential | broadcast | `argv-secret@149` |
| 4 | `full-ai-cluster/usb-nixos-installer/zeta-install.sh` | T2-credential-confined | stored-credential | on-disk | `privileged-operation@768,785,786,791,+150` `key-file-touch@788,1302,1306,1884,+8` `secure-interactive-read@2091,2094,2179,2182` |
| 5 | `.gemini/service/install-lior-service.sh` | T1-execution-identity | execution-identity | on-disk | `execution-identity-write@5,6` `privileged-operation@6` |
| 6 | `tools/setup/host-loop-bootstrap.sh` | T1-execution-identity | execution-identity | on-disk | `execution-identity-write@71,189` `privileged-operation@253,255` |
| 7 | `tools/setup/common/profile-edit.sh` | T1-execution-identity | execution-identity | on-disk | `execution-identity-write@86` |
| 8 | `full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh` | T1-execution-identity | execution-identity | none | `privileged-operation@540` |
| 9 | `tools/setup/common/install-zig.sh` | T1-execution-identity | execution-identity | none | `privileged-operation@58,59,60` |
| 10 | `.gemini/service/lior-loop.sh` | T0-no-measured-key-contact | none | none | — |
| 11 | `githooks/pre-push` | T0-no-measured-key-contact | none | none | — |
| 12 | `scripts/hooks/commit-msg` | T0-no-measured-key-contact | none | none | — |
| 13 | `scripts/hooks/install-git-hooks.sh` | T0-no-measured-key-contact | none | none | — |
| 14 | `scripts/hooks/pre-push` | T0-no-measured-key-contact | none | none | — |
| 15 | `tools/installer/zeta-self-register.sh` | T0-no-measured-key-contact | none | none | — |
| 16 | `tools/setup/common/agda-cubical.sh` | T0-no-measured-key-contact | none | none | — |
| 17 | `tools/setup/common/curl-fetch.sh` | T0-no-measured-key-contact | none | none | — |
| 18 | `tools/setup/common/fd-limits.sh` | T0-no-measured-key-contact | none | none | — |
| 19 | `tools/setup/common/host-tier.sh` | T0-no-measured-key-contact | none | none | — |
| 20 | `tools/setup/common/install-rust-wasm32.sh` | T0-no-measured-key-contact | none | none | — |
| 21 | `tools/setup/common/shellenv.sh` | T0-no-measured-key-contact | none | none | — |
| 22 | `tools/setup/common/smoke-10-toolchains.sh` | T0-no-measured-key-contact | none | none | — |
| 23 | `tools/setup/common/smoke-13-toolchains.sh` | T0-no-measured-key-contact | none | none | — |
| 24 | `tools/setup/common/smoke-7-toolchains.sh` | T0-no-measured-key-contact | none | none | — |
| 25 | `tools/setup/common/tlaps.sh` | T0-no-measured-key-contact | none | none | — |
| 26 | `tools/setup/doctor.sh` | T0-no-measured-key-contact | none | none | — |
| 27 | `tools/setup/hsm/dkek-ceremony-preflight.sh` | T0-no-measured-key-contact | none | none | — |
| 28 | `tools/setup/install.sh` | T0-no-measured-key-contact | none | none | — |
| 29 | `tools/setup/linux.sh` | T0-no-measured-key-contact | none | none | — |
| 30 | `tools/setup/macos.sh` | T0-no-measured-key-contact | none | none | — |

<!-- END GENERATED -->

Re-measured `2026-08-25` against `EXPECTED_RETAINED_SHELL` (30 entries). The previous
measurement (`2026-08-22`, 31 entries) is superseded; the allowlist has **lost one** — see
below. The `2026-08-16` measurement (31 entries: 28 `.sh` plus three extensionless git hooks)
is superseded twice over.

**Row 3 is gone because the script is gone.** `tools/setup/op-token-setup.sh` was converted to
`tools/setup/op-token-setup.ts` and removed from the allowlist. Its `argv-secret@83` finding —
item 1 of "what the children should do with it" — was carried out rather than deferred: the
TypeScript writes through `security -i`, so the token crosses on **stdin** and the argv is the
constant `["security", "-i"]`. That property is now held by three falsifiers in
`tools/setup/op-token-setup.test.ts`, each shown to go red under a deliberate mutation, rather
than by a sentence in a file header. **`tools/setup/secret-clip.sh` still carries the identical
leak at line 93 and is still row 2** — the sibling was not swept along, and saying so is the
point of a generated table.

**The former row 26 is gone because the script is gone.**
`tools/setup/common/sync-prior-art.sh` was converted to
`tools/setup/common/sync-prior-art.ts` and removed from the allowlist. It sat at
`T0-no-measured-key-contact` — no credential contact to carry out or defer — so the conversion
was a straight portability and honesty win rather than a security fix: the `.sh` reported a
partial sync and a clean sync in the same shape, and `--name typo` exited 0 having done
nothing. The replacement refuses both, and additionally validates by construction that no
manifest row can write outside the gitignored `references/prior-art/` tree, which the `.sh`
took on trust. Nine occurrences of "upstream" naming went with it; these are prior-art
references, not upstreams. Falsifiers in `tools/setup/common/sync-prior-art.test.ts`, each
shown to go red under a deliberate mutation.

Worth stating because the ordering question was escalated to the maintainer and settled:
**this script is optional and on-demand, and nothing invokes it automatically**, so a
`bun`-executed replacement cannot break a cold clone. `.claude/rules/clone-at-tag-stays-sufficient.md`
is untouched. A future caller inside a bootstrap path would be the change that needs
re-litigating.

## What the children should do with it

1. **`tools/setup/secret-clip.sh:93` — fix the argv leak before, or as part of, any
   conversion.** (`op-token-setup.sh:83` was the other half of this item and is **done**:
   converted 2026-08-22, argv now secret-free, guarded by falsifiers.) Both call
   `security add-generic-password … -U -w "$VALUE"`, and `security(1)` is an external
   binary, so the credential is in `ps` output for the life of the call. `-w` without an
   operand makes `security` prompt instead; the point-of-use helper
   `src/Core.TypeScript/secrets/credential.ts` is the typed replacement. This is a
   one-line class of fix that does not need a compiled binary, a signature, or a policy —
   which is why it outranks work that does.

   **Correction from carrying it out (2026-08-22):** the recommended `-w`-with-no-operand form
   does _not_ fit a programmatic caller. `add-generic-password` requires the target keychain as
   a **positional** argument, `security` refuses `-w` placed after it, and the prompt is a
   `readpassphrase` on `/dev/tty` rather than a stdin read — so "prompt instead" means "a human
   is at a terminal", which an agent-driven capture is not. The form that works is `security -i`
   (interactive mode reads _commands_ from stdin and builds their argv in its own address
   space). It carries a cost that had to be **measured, not assumed**: `security -i` **exits 0
   even when the command fails** — a write to a nonexistent keychain returned status 0 with
   empty stdout and empty stderr. So that transport's exit status carries no information and is
   never read; success is decided by reading the item back. Verified against a throwaway
   keychain, never the login keychain.

2. **`tools/setup/common/mise.sh:149` is not a toolchain script for this purpose.** It
   runs `env -u GITHUB_TOKEN MISE_GITHUB_TOKEN="$GITHUB_TOKEN" mise install`. The `env(1)`
   form puts the token value in argv; the bare `MISE_GITHUB_TOKEN="$GITHUB_TOKEN" mise …`
   prefix would not, because the shell performs that assignment itself. Dropping `env` and
   moving `-u GITHUB_TOKEN` into the surrounding scope removes the exposure without
   changing behaviour. **Honest bound on consequence:** in CI this is the ephemeral
   Actions `GITHUB_TOKEN` on a single-tenant runner, so the loss is small; on a developer
   or agent machine the same line runs with whatever `GITHUB_TOKEN` is in scope.
3. **`keyring.sh` (081M00VN3GR087G0R003WXE8R8) is correct as written and still ranks
   first.** It handles the highest-value material in the repo and the measure confirms its
   own header claim: the seed reaches `bun` through a pipe from `printf`, a builtin, so it
   never enters argv. Its rank is _material_, not defect. A regression test in
   `measure-shell-key-exposure.test.ts` fails if that ever changes.
4. **`curl-fetch.sh` and `host-tier.sh` are `source`d libraries and cannot become
   binaries** — a compiled program cannot export functions into its parent shell. They
   measure T0; they are also structurally unconvertible. Both facts point the same way.
5. **T0 is not "safe", it is "no key-bearing operation in the text".** See the limits.

## Corrections to the prior hand-ranking

The §2.4 ranking in the research note was produced by reading. Three rows did not survive
the parse, and each correction is in the same direction: reading under-rates argv.

| §2.4 row                           | claim                                                             | measured                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1 `~/.config/zeta/secrets-env.sh` | "the ambient hoist — convert first"                               | **already gone.** `op-token-setup.sh` now _deletes_ the file, `shellenv.sh:106-122` no longer emits the source line, and `lint-no-ambient-credential-hoist.ts` guards it on every PR. The work-item `081M00VMWTB087G0R0026XSWT6` is still in `workitems/` (backlog state) although the code fix has landed — a state drift the umbrella should close. |
| #3 `op-token-setup.sh`             | "token is passed in-process, **never argv**"                      | **false at line 83.** `security add-generic-password -a "$USER" -s "$SERVICE" -U -w "$TOKEN"`; `$TOKEN` is proven-tainted (captured from `pbpaste`/`osascript … hidden answer`) and `security` forks. **Fixed 2026-08-22** by the conversion; the claim is now a test rather than a header sentence.                                                  |
| #9 `mise.sh`                       | grouped with "no credential access measured … **last, or never**" | **T3-credential-broadcast.** `mise.sh:149` puts a GitHub token in `env(1)`'s argv.                                                                                                                                                                                                                                                                    |

The first correction is the important one methodologically: the top of a hand-ranking had
been fixed for two days and nobody re-derived it. A generated table cannot go stale
silently — regenerating is the check.

## What this cannot see

Stated because an unstated blind spot reads as coverage.

- **Anything a child process does.** `bun gen.ts`, `mise`, `gh`, `op` are opaque. In
  particular the `security(1)` **identity-laundering** defect (research note §3.1b — the
  keychain sees `/usr/bin/security` as the caller, not your binary) is invisible here by
  construction, and it is tracked separately as `081M00VN3FX087G0R0006ZGRWG`.
- **Indirection through a variable.** `"$TOOL" --flag "$SECRET"` is recorded as
  `opaque-dispatch`; the command is not resolved, so no rule keyed on a command name fires.
- **`source`d files.** Taint is not propagated across a `source`; the edge is recorded as
  `sourced-library-edge` and each file is scored alone. A secret set in `curl-fetch.sh` and
  used in `macos.sh` would be missed.
- **`eval`.** Recorded, never resolved.
- **Ambient authentication.** `gh auth status` / a cached `op signin` use a credential the
  script never names, so `zeta-self-register.sh` measures T0 despite running `gh` against a
  live token. "No key material in the text" is the claim; "handles no credential" is not.
- **Consequence.** Tier is exposure _shape_, not blast radius. An ephemeral CI token and a
  maintainer's 1Password service account both read `stored-credential`.
- **The machine.** This parses text. It does not check whether any of these credentials
  exist — and per the research note §2.3 the FROST shares do not, yet. This is
  pre-positioning, not incident response.

## The policy seam

`tierOf(material, channel)` is the only place an opinion lives, and it is one function.
The default puts material first, so `keyring.sh` (root key, confined) outranks
`secret-clip.sh` (credential, broadcast). A **channel-first** reading — "fix what is
leaking now, whatever it is leaking" — puts rows 2-4 above row 1 and is equally defensible;
it is a one-function swap and no measurement changes. The facts are reported separately
from the ordering on purpose: detection is dual-use, the oracle decides
(`.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`).

## Pointers

- `src/Core.TypeScript/hygiene/measure-shell-key-exposure.ts` — the measure (+ `.test.ts`)
- `src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts` — the allowlist that
  supplies the denominator; `081M00VVBAN087G0R000XC5MN7` wires this exposure axis into it
- `src/Core.TypeScript/hygiene/lint-no-ambient-credential-hoist.ts` — the guard that keeps
  the §2.4 #1 exposure from coming back
- `src/Core.TypeScript/secrets/credential.ts` — `withCredential` / `spawnWithCredential`,
  the point-of-use replacement the argv fixes should target
- `src/Core.TypeScript/secrets/keychain-macos.ts` §WRITE — `storeGenericPassword`, the
  argv-free write the first conversion produced; `tools/setup/op-token-setup.ts` is its caller
- `docs/research/2026-08-22-closing-over-the-os-is-the-point-of-bash-retirement-carbon-on-windows-and-linux-is-the-anchor.md`
  — why the retirement is an OS-closure programme rather than a language preference, and the
  ledger of what each conversion leaves unclosed
- `docs/research/2026-08-14-shell-deprecation-sequenced-by-key-exposure-the-interpreter-is-the-identity-gap-not-the-shell.md`
  — the note this operationalises; its §0.2 correction (the interpreter, not the `.sh`, is
  the identity gap) still stands and is not weakened by anything here
- Beacon: Denning & Denning 1977 (information-flow certification) · Goguen & Meseguer 1982
  (noninterference) · Hardy 1988 (the confused deputy) · POSIX.1-2017 §2.9.1/§2.14
  (builtin vs external)
