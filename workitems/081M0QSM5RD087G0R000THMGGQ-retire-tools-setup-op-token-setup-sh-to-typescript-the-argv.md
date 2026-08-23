---
id: 081M0QSM5RD087G0R000THMGGQ
type: task
state: backlog
priority: P2
slug: retire-tools-setup-op-token-setup-sh-to-typescript-the-argv
title: "Retire the OP token shell setup entrypoint to TypeScript: the argv leak the shell carried is fixed by writing through security -i (stdin), and no-stdout/no-argv/no-env are now falsifiers rather than a header comment"
created: 2026-08-23T17:10:22.733Z
depends_on: []
composes_with: []
---

# Retire the OP token shell setup entrypoint to TypeScript: the argv leak the shell carried is fixed by writing through security -i (stdin), and no-stdout/no-argv/no-env are now falsifiers rather than a header comment

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QSM5RD087G0R000THMGGQ-*.md` glob. -->

**Parent:** `081M00VNHB3087G0R001WHTKTH` (umbrella — sequence the `.sh` deprecation by measured
key exposure). This is child #3 of `docs/SHELL-DEPRECATION-SEQUENCE.md`.

## Why (Aaron, 2026-08-22)

> _"rewrite .sh files into .ts files allows the developer to have one interface, the same
> interface for every operating system. One of the overarching goals of Zeta is to completely
> close over the OS, like an interpreter closing over a compiler, and make every OS look the
> same."_

So the conversion is an **OS-closure** move, not a language preference. A `.sh` file _is_ an
OS-specific interface — invoking it already commits the caller to a POSIX shell.

## What landed

- `tools/setup/op-token-setup.ts` replaces the retired shell entrypoint (deleted; removed
  from `EXPECTED_RETAINED_SHELL` and `RETAINED_SHELL_CATEGORY_BY_FILE`).
- `storeGenericPassword` added to `src/Core.TypeScript/secrets/keychain-macos.ts`: the write
  crosses on **stdin** via `security -i`, so the argv is the constant `["security", "-i"]`.
  This closes the `argv-secret@83` finding the sequence doc told any conversion to fix.
- Three falsifiers in `tools/setup/op-token-setup.test.ts` — no stdout/stderr, no argv, no
  environment variable — each shown red under a deliberate mutation, then restored.
- Teaching-shaped refusals (assumed / observed / believe-now) on every failure path.

## What it does NOT buy, stated so the claim stays honest

It does not remove `osascript` or `security`; it moves who spawns them. Three macOS-specific
calls remain and are named in the file header and in the OS-closure ledger:
`osascript` (secure prompt port), `security -i` (keystore port,
`081KVNRSGVR08QG0R003R3RNJX`), `pbpaste` (clipboard port). On Linux/Windows the command
**refuses and names the missing port** rather than silently no-op'ing.

## Measured, not assumed

`security -i` **exits 0 even when the command fails** (a write to a nonexistent keychain
returned status 0, empty stdout, empty stderr — verified against a throwaway keychain, never
the login keychain). Its exit status is therefore never read; success is decided by reading
the item back and comparing.

## Not swept along (deliberately)

`tools/setup/secret-clip.sh:93` carries the identical argv leak and is **not** converted here.
It stays allowlisted and stays row 2 of the sequence — a guarded, honest bash entry beats an
unguarded rewrite, and it is its own child of the umbrella.
