---
id: 081M00VMWTB087G0R0026XSWT6
type: bug
state: backlog
priority: P1
slug: delete-the-ambient-op-token-hoist-config-zeta-secrets-env-sh
title: "Delete the ambient OP token hoist: ~/.config/zeta/secrets-env.sh puts an 852-byte 1Password service-account token into every shell environment, inherited across exec regardless of code identity — no signature or ACL can gate it (13 noninterference)"
created: 2026-08-14T19:23:11.563Z
depends_on: []
composes_with: []
---

# Delete the ambient OP token hoist: ~/.config/zeta/secrets-env.sh puts an 852-byte 1Password service-account token into every shell environment, inherited across exec regardless of code identity — no signature or ACL can gate it (13 noninterference)

## State (2026-08-14)

**Repo side: CLOSED.** Operator side: one command, below.

## What was live

Line 83 of the retired OP token shell setup entrypoint wrote
`~/.config/zeta/secrets-env.sh`:

```
export OP_SERVICE_ACCOUNT_TOKEN="$(security find-generic-password -s zeta-op-service-account -w 2>/dev/null)"
```

`tools/setup/common/shellenv.sh:111` emitted the line that sourced it from the
user profile. Net effect: an 852-byte 1Password service-account token in the
environment of every interactive shell and every process descended from one.

The script's own header argued the file "holds only the FETCH command, never the
token value." That is true and beside the point: after the fetch runs, the VALUE
is in the environment.

## Why it outranks everything else in the custody stack

An environment variable crosses `exec` **regardless of the child's code
identity**. A code signature, a keychain ACL, an IMA appraisal and a TPM seal
each bind a secret to a _caller_; an inherited variable has already escaped the
question of who the caller is. So this is the one exposure on the machine that no
amount of signing work can reach — and the cheapest to fix, because the fix is
deletion rather than compilation.

`.claude/rules/dv2-data-split-discipline-activated.md` §13 noninterference
(Goguen & Meseguer 1982) stated for credentials: entropy entering through an
ambient channel instead of a declared, metered one.

## Blast radius, measured rather than assumed

- **Who is affected:** every interactive shell on this machine and every agent
  session descended from one. `launchd`-started cells are NOT affected — their
  plists set explicit `EnvironmentVariables` with no `OP_*` key.
- **What they observe:** nothing. That is the property that made it survive.
- **In-repo consumers of `OP_SERVICE_ACCOUNT_TOKEN`: zero.** `rg` over the tree
  finds the variable only in the two files that create the hoist and in the
  research note that documents it. The only consumer is the `op` CLI reading its
  own environment, ad hoc. So removal breaks no code path — this was a
  convenience channel carrying the machine's highest-value shared credential.
- **Action:** re-run `bun tools/setup/op-token-setup.ts` and open a new shell.
- **SLA:** repo side landed same day. Operator side is one command whenever
  convenient; already-running shells keep the token until they exit.

## The fix

| file                                                              | change                                                                                                                                                            |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/setup/common/shellenv.sh`                                  | no longer emits the `. secrets-env.sh` line; the block now explains why the line must not come back                                                               |
| `tools/setup/op-token-setup.ts`                                   | replaced the shell entrypoint, no longer writes `secrets-env.sh`, **removes** an existing one when the operator runs it, and prints the point-of-use form instead |
| `src/Core.TypeScript/secrets/credential.ts`                       | the replacement: `withCredential` (fetch, hand to one callback, drop — never touches `process.env`) and `spawnWithCredential`                                     |
| `src/Core.TypeScript/secrets/keychain-macos.ts`                   | in-process Security.framework read; `SecKeychainSetUserInteractionAllowed(false)` makes a prompt structurally impossible                                          |
| `src/Core.TypeScript/hygiene/lint-no-ambient-credential-hoist.ts` | CI guard against re-introduction                                                                                                                                  |

## The one place a credential still reaches an environment, and why

`spawnWithCredential(service, envVar, argv)`. The `op` CLI takes its token from
`OP_SERVICE_ACCOUNT_TOKEN` in its own environment; that is `op`'s interface, we
do not control it, and there is no stdin or fd form. So a credential must enter
_some_ environment for `op` to run at all.

The distinction that makes it acceptable:

|              | hoist                             | `spawnWithCredential`                                |
| ------------ | --------------------------------- | ---------------------------------------------------- |
| who exports  | the parent shell                  | nobody — the parent's `process.env` is never written |
| who inherits | every descendant, for the session | one child, for one `exec`                            |
| lifetime     | until the shell exits             | until the child exits                                |
| legibility   | ambient                           | `grep` finds every crossing                          |

`buildChildEnv` is split out as a pure function so "the parent is not mutated"
is a test that runs in CI without a credential present.

## The guard, and proof it can fail

`bun run hygiene:no-ambient-credential-hoist` — wired into `gate.yml`'s
`lint (bash retirement inventory + hygiene unit tests)` job.

Four rules: sourcing a credential env file; `export NAME=$(<keystore fetch>)`;
a fetch written into `$GITHUB_ENV`; `process.env.<CREDENTIAL> =` in TypeScript.

It is not vacuous, and the strongest evidence is that **its first run against
unmodified `main` reported exactly the two live sites** (`shellenv.sh:111`,
`op-token-setup.sh:83`) and exited 1. Three planted mutants were then caught and
the tree returned to exit 0. It also refuses to pass when it scans fewer files
than its floor — the failure mode that let `lint:markdown` lint zero files and
report success for months (#10712).

## Operator step (biometric-gated; the agent does not run it)

```bash
bun tools/setup/op-token-setup.ts --clipboard   # or with no flag for the secure dialog
bash tools/setup/common/shellenv.sh              # regenerate the profile fragment
exec $SHELL -l                                   # or: unset OP_SERVICE_ACCOUNT_TOKEN
```

Nothing on the machine was mutated by the agent that filed this. The token stays
encrypted in the Keychain throughout; only the fetch-and-export wiring goes away.

## Pointers

- `docs/research/2026-08-14-shell-deprecation-sequenced-by-key-exposure-the-interpreter-is-the-identity-gap-not-the-shell.md` §2.2 — the measurement
- `081M00VN3FX087G0R0006ZGRWG` — the `security(1)` deputy, the sibling finding
- `081M01028VF087G0R001W0VD0B` — the ACL re-store ceremony that unblocks the reader port
