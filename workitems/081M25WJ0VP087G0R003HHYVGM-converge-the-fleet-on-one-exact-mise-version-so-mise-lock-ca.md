---
id: 081M25WJ0VP087G0R003HHYVGM
type: task
state: backlog
priority: P2
slug: converge-the-fleet-on-one-exact-mise-version-so-mise-lock-ca
title: "Converge the fleet on one exact mise version so mise.lock can run in locked mode"
created: 2026-09-10T14:46:41.782Z
depends_on: []
composes_with: []
---

# Converge the fleet on one exact mise version so `mise.lock` can run in locked mode

Split out of **081M24MADR2087G0R001FCD8K6** (`mise.lock` committed, PR #17231). That PR
shipped the lockfiles and deliberately did NOT set `locked = true`, because locked mode was
measured to break the fleet. This is the work that makes it safe.

## The measurement, 2026-09-10

A mise lockfile is not readable across mise versions under locked mode. Measured on this
repository's own configs, on both versions the fleet actually runs:

| lockfile written by | mise 2026.6.12 resolves        | mise 2026.8.14 resolves                      |
| ------------------- | ------------------------------ | -------------------------------------------- |
| **2026.6.12**       | all 25 tools                   | **FAILS** `node@24`, `npm:markdownlint-cli2` |
| **2026.8.14**       | **FAILS** `node@24`, `npm:...` | all 25 tools                                 |

2026.8.14 writes and matches a `specifiers = ["24"]` field; 2026.6.12 does not write it and
matches by version prefix. Neither reads the other's answer for a **fuzzy** pin (`node = "24"`,
`bun = "1.3"`, `java = "26"`) or an `npm:` entry, and `mise install` then refuses with
`<tool> is not in the lockfile` and installs nothing.

**Exact pins are unaffected** — which is why a two-tool cross-version compatibility check
passed and hid this. Any re-test must use a fuzzy pin, or it measures nothing.

## Why the fleet runs two versions

| installer                 | mise                                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `tools/setup/linux.sh`    | `MISE_PIN_VERSION="2026.6.12"` — exact                                                                                                     |
| `tools/setup/install.ps1` | `$MisePinVersion = '2026.6.12'` — exact                                                                                                    |
| `tools/setup/macos.sh`    | `MISE_MIN_VERSION="2026.6.12"` — a **floor**: _"macOS installs mise via Homebrew, whose formula advances in place; accept newer versions"_ |

The divergence is deliberate and predates this work. `install.ps1` already carries a standing
note that Windows had drifted to 2026.8.14 and was pinned back down, and that _"whether the
fleet should move UP to a mise that enforces the trust policy is a separate and still-open
question"_. This row is that question, now with a second reason to answer it.

## What blocks it

macOS installs mise via Homebrew, which does not offer version pinning the way `scoop
install mise@<v>` and the pinned Linux tarball do. Options, none of them evaluated yet:

1. Install mise on macOS the same way Linux does — the pinned release tarball with its
   committed SHA-256 — and stop using the Homebrew formula for it.
2. Move the whole fleet **up** to the newer mise and pin it there (which also decides the
   still-open aube trust-policy question `install.ps1` names).
3. Something else. This row does not prejudge it.

## Done when

`src/Core.TypeScript/hygiene/audit-mise-lock-coverage.ts` says so. `checkLockedModeSafety()`
is bidirectional: it refuses `locked = true` while the three installers disagree, and it
**REQUIRES** `locked = true` the moment they agree. So the moment the pins converge, the
`cross-verify (mise-lock-coverage)` leg goes red until the lockfile is re-locked on that
version and `locked = true` is declared. The audit asks for this work; it cannot be forgotten.

## What locked mode buys, so the value is on the record

Measured, not assumed:

- a platform ABSENT from the lockfile makes `mise install` exit 1 with
  `No lockfile URL found ... (--locked mode)` and install **nothing**;
- a tool declared in `.mise.toml` but absent from the lockfile exits 1, so a pin bumped
  without a re-lock cannot merge quietly;
- **without it, a missing platform row is silently refilled from upstream and the lockfile
  rewrites itself.** A digest we HAVE is enforced today; a digest we LACK is not demanded.
  That gap is what this row closes.

## Adjacent, not blocking

Seven tools have no lockable artifact at all under any mise version — `dotnet`
(dotnet-install script), `rust` (rustup), `npm:*`, `pipx:*` — and `1password-cli` locks a URL
with no checksum. Locked mode passes those through rather than failing, so converging the
mise version does not close them. They are named with reasons in `UNLOCKABLE_BACKENDS`, and
closing them is separate work per ecosystem.
