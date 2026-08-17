---
id: 081M05X126V087G0R0014GR9KQ
type: task
state: done
priority: P2
slug: declare-rust-components-wasm32-target-in-mise-toml-retire-en
title: "Declare rust components + wasm32 target in .mise.toml — retire ensure-rust-components.sh and the manual comment"
created: 2026-08-16T18:23:31.035Z
completed: 2026-08-17T00:58:51.571Z
depends_on: []
composes_with: []
---

# Declare rust components + wasm32 target in .mise.toml — retire ensure-rust-components.sh and the manual comment

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M05X126V087G0R0014GR9KQ-*.md` glob. -->

## The gap is currently papered twice, two different ways

Rust itself is declared — `.mise.toml` `rust = "1.87.0"`. What is **not** declared is
everything the toolchain needs to be usable, and it is handled by two different
non-mechanisms:

1. **A comment as an instruction.** `.mise.toml` (three lines above the pin):
   `# After 'mise install', run: rustup target add wasm32-unknown-unknown`.
   A comment is not a mechanism — nothing enforces it, nothing fails when it is
   skipped, and `tools/setup/common/install-rust-wasm32.sh` exists to do by script
   what the comment asks a human to do by hand.
2. **A bespoke shell script.** `tools/setup/common/ensure-rust-components.sh`
   (landed 2026-08-16, `c32c27ea6`) runs `rustup component add rustfmt clippy`
   after `mise install`, from `tools/setup/common/mise.sh:196`.

Aaron 2026-08-16: *"is this the right way to install rust? it seems like its sneaking
in there? should this be an ace dependency instead?"* — and on the fallback branch:
*"if it does not this is what ace is made for, declarative dependencies of any kind
desired state."*

## The deciding fact — established, not assumed

**mise's `core:rust` backend DOES accept `components`, `targets` and `profile` as
tool options**, on the version this repo pins.

Checked empirically rather than cited (mise 2026.6.14; repo pins
`min_version = "2026.6.12"`, CI runs 2026.6.12). A scratch config declaring a
deliberately bogus component was passed straight through to rustup, which rejected it
**by name** — proving the option is honoured rather than silently ignored:

```toml
[tools]
rust = { version = "1.87.0", components = ["definitely-not-a-real-component"], targets = ["wasm32-unknown-unknown"] }
```

```
mise rust@1.87.0              [2/4] install
info: syncing channel updates for 1.87.0-aarch64-apple-darwin
error: component 'definitely-not-a-real-component' for target 'aarch64-apple-darwin' is unavailable for download for channel '1.87.0'
mise ERROR rustup failed
mise ERROR Failed to install core:rust@1.87.0
```

`mise config get tools.rust` also round-trips the parsed options. The negative
control matters here: had mise ignored unknown options, the install would have
**succeeded** — the test can fail, so it is a check.

## The change

```toml
rust = { version = "1.87.0", components = ["rustfmt", "clippy"], targets = ["wasm32-unknown-unknown"] }
```

then:

- delete `tools/setup/common/ensure-rust-components.sh` and its call at
  `tools/setup/common/mise.sh:196`;
- delete the stale `# After 'mise install', run: rustup target add …` comment;
- reduce or retire `tools/setup/common/install-rust-wasm32.sh` (it also covers the
  no-mise / cluster-bootstrap path — check before deleting, it may still be load-bearing there);
- drop the `ensure-rust-components.sh` entry from `EXPECTED_RETAINED_SHELL` in
  `src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts`. That entry
  (PR #10991) is **scaffolding to unblock a red main**, not an end state — its
  stated reason should not be allowed to harden into a justification for keeping
  the script.

Net effect: the bash-retirement discipline **removes** a shell file instead of
allowlisting one, and `mise install` becomes genuinely sufficient — one declaration
covering toolchain + components + targets.

## Guard rails when doing it

- `.mise.toml` changes carry a `threat-model-critic` reviewer floor (GOVERNANCE §20)
  and are three-way-parity surfaces (GOVERNANCE §24) — dev laptop, CI, devcontainer.
- Changing `.mise.toml` rotates the `install-v2-*` / `full-verify-v2-*` cache keys
  (they hash `.mise.toml`), so expect one cold run per job.
- The `1.87.0-*` glob in those cache path lists is version-pinned. A rust version
  bump must move the glob too; a stale glob degrades to a CDN fetch (see
  `.github/workflows/gate.yml` header).
- Keep the offline property: after the change, the CDN-down falsifier must still
  pass (blackhole `static.rust-lang.org` in `/etc/hosts`, verify the block by
  curling the failing URL, then run `tools/setup/install.sh`). The pattern is in
  probe runs 31962065113 / 31962487520.

## Prior context

- `tools/setup/common/mise.sh` (RUSTUP_TOOLCHAIN comment) — why the exact toolchain
  selection matters for an offline install.
- PR #10987 — cached `~/.rustup/toolchains/1.87.0-*` so the offline path has
  something to be offline *with*.
- PR #10991 — the interim allowlist entry this work-item retires.
