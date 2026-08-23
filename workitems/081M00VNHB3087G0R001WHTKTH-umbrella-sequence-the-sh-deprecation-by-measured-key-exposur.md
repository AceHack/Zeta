---
id: 081M00VNHB3087G0R001WHTKTH
type: task
state: backlog
priority: P2
slug: umbrella-sequence-the-sh-deprecation-by-measured-key-exposur
title: "Umbrella: sequence the .sh deprecation by measured key exposure, not convenience — 28 executable shell scripts (36 paths minus 2 markdown stubs and 6 archive), credential-touching first, sourced libraries never convertible, smoke/CI scripts last"
created: 2026-08-14T19:23:32.579Z
depends_on: []
composes_with: []
---

# Umbrella: sequence the .sh deprecation by measured key exposure, not convenience — 28 executable shell scripts (36 paths minus 2 markdown stubs and 6 archive), credential-touching first, sourced libraries never convertible, smoke/CI scripts last

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00VNHB3087G0R001WHTKTH-*.md` glob. -->

## The sequence lives in `docs/SHELL-DEPRECATION-SEQUENCE.md`

Generated, not asserted. Regenerate with
`bun run hygiene:measure-shell-key-exposure -- --markdown`; the measure is
`src/Core.TypeScript/hygiene/measure-shell-key-exposure.ts` (pure function over script
text, fixture-tested, run by the `lint (bash retirement inventory + hygiene unit tests)`
gate job).

Counts in this item's title are confirmed: `git ls-files '*.sh'` → 36, minus 2 markdown
carved-sentence stubs under `db/` and 6 frozen archive files under
`docs/recovered-orphan-branches-2026-05/` → **28 executable `.sh`**, which is
`EXPECTED_RETAINED_SHELL`'s 31 minus the three extensionless git hooks. The allowlist,
not a glob, is the correct denominator.

## Order (measured 2026-08-16)

| tier                         | n   | scripts                                                                                                            |
| ---------------------------- | --- | ------------------------------------------------------------------------------------------------------------------ |
| T4 root-key, confined        | 1   | `tools/setup/persona-keys/keyring.sh`                                                                              |
| T3 credential, **broadcast** | 3   | `tools/setup/secret-clip.sh` · the retired OP token shell setup entrypoint · `tools/setup/common/mise.sh`          |
| T2 credential, on-disk       | 1   | `full-ai-cluster/usb-nixos-installer/zeta-install.sh`                                                              |
| T1 execution-identity        | 5   | `install-lior-service.sh` · `host-loop-bootstrap.sh` · `profile-edit.sh` · `zeta-first-boot.sh` · `install-zig.sh` |
| T0 no measured key contact   | 21  | the toolchain installers, smoke tests, git hooks, sourced libraries                                                |

## What the measurement changed

- **`secret-clip.sh:93` and `op-token-setup.sh:83` put a credential in `/usr/bin/security`'s
  argv** (`ps`-visible). The prior hand-ranking stated op-token-setup's token was "passed
  in-process, never argv"; that is false at line 83. Fixable without any binary, signature
  or policy — which is why it now outranks work that needs all three.
- **`tools/setup/common/mise.sh:149` moved from "last, or never" to T3.**
  `env -u GITHUB_TOKEN MISE_GITHUB_TOKEN="$GITHUB_TOKEN" mise install` — the `env(1)` form
  makes the assignment argv; the bare shell prefix would not.
- **`keyring.sh` is confirmed correct**, not merely assumed: the seed reaches `bun` through
  a pipe from `printf` (a builtin), so it never enters argv. A regression test fails if that
  changes.
- **The prior ranking's #1 no longer exists.** The ambient hoist
  (`~/.config/zeta/secrets-env.sh`) is removed from both `op-token-setup.sh` and
  `shellenv.sh` and is CI-guarded by `lint-no-ambient-credential-hoist.ts` — but
  `081M00VMWTB087G0R0026XSWT6` is still in `workitems/` as `backlog`. **Child action:
  close it**; the code landed.

## Children

| zetaid                                                      | relation to this sequence                                                                                              |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `081M00VVBAN087G0R000XC5MN7`                                | wire this exposure axis into the CI-enforced allowlist — consume `measureScriptExposure`, do not re-derive it          |
| `081M00VN3FX087G0R0006ZGRWG`                                | `security(1)` identity laundering — the measure cannot see past a child process, so this is the half it does not cover |
| `081M00VMWTB087G0R0026XSWT6`                                | ambient hoist — **fix has landed; close the item**                                                                     |
| `081M00VN3GR087G0R003WXE8R8`                                | convert `keyring.sh` — rank 1 on material, and already argv-clean                                                      |
| `081M00VNHBY087G0R0024W93JY`                                | delete-not-port the vestigial surfaces — all T0 or T1                                                                  |
| `081M00VN9P1087G0R000FYTTVS` · `081M00VN9PX087G0R003W8F47T` | unaffected by the ordering                                                                                             |
