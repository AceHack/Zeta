---
id: 081M05E39F7087G0R002F00H6Q
type: bug
state: backlog
priority: P2
slug: smoke-13-toolchains-sh-is-unwired-from-ci-while-claiming-gat
title: "smoke-13-toolchains.sh is unwired from CI while claiming gate.yml runs it — oracles 8-13 have no functional smoke gate"
created: 2026-08-16T14:02:35.367Z
depends_on: []
composes_with: []
---

# smoke-13-toolchains.sh is unwired from CI while claiming gate.yml runs it — oracles 8-13 have no functional smoke gate

**Policy call for Aaron.** Wiring this script into `full-verify` would make an
existing required check newly capable of failing, which is the line the shadow does
not cross unilaterally. The stale-comment half was fixed in the PR that filed this;
the wiring half is left here.

## Demonstrated

`tools/setup/common/smoke-13-toolchains.sh` claimed in its own header:

> The old script is kept for backward compat; gate.yml references this one.

It does not. `gate.yml`'s full-verify job runs:

```
- name: Smoke check (all 7 toolchains functional)
  run: CI=true ./tools/setup/common/smoke-7-toolchains.sh
```

and a grep across `.github/workflows/` finds **no** invocation of `smoke-13` or
`smoke-10` anywhere. So the comprehensive 13-toolchain smoke check — the one that
would catch a present-but-broken oracle — has never run in CI.

Consequence: oracles **8-13** (qdk, eprover, the wasm triad wat2wasm/wasm-opt/emcc,
zig wasm32-freestanding, rust wasm32-unknown-unknown, llvm `llc`) have **no functional
smoke gate in CI**. The byte-lock jobs that consume those substrates would fail on
their own if a substrate broke, so this is a missing *early, named* signal rather than
a hole in correctness — a broken toolchain surfaces as a confusing byte-lock failure
instead of `FAIL: emcc required in CI`.

## Also fixed in the filing PR (not a policy call)

Inside the same script, the zig `wasm32-freestanding` **functional** check was the
only check in the file that could not fail under `CI=true`:

```
zig build-exe ... 2>/dev/null \
  && wasm-validate ... 2>/dev/null \
  && echo "  zig wasm32-freestanding: OK" \
  || echo "  WARNING: zig wasm32-freestanding compilation failed"
```

Every one of its eight siblings escalates its WARNING to `exit 1` when `CI=true`; this
one returned 0. The zig *presence* check did fail closed in CI, which is what made the
asymmetry easy to miss — the substrate could be **present and broken** and still pass
"All 13 toolchains functional". Converted to an `if/else` that escalates in CI like the
rest. Zero blast radius today precisely because the script is unwired.

## The decision

Wire `smoke-13` into full-verify, or keep `smoke-7` and accept that oracles 8-13 are
covered only by their downstream byte-lock jobs. Note full-verify's install step is
titled "Install toolchain (all 7 languages + E-prover)", so `smoke-7` may be the honest
match for what that job actually installs — in which case the right move is to leave the
wiring alone and let this work-item record *why* the bigger script exists unwired,
rather than to grow the install.

## Anchors

- `.claude/rules/toy-is-free-metered-must-be-earned.md` — an unrun check is `unmetered`.
- The `zflash-harness-lint` rename precedent in `.github/workflows/zflash-harness-lint.yml`:
  *"A green check that implies more than it tested is worse than no check."* Same defect
  class, applied there to a workflow name and here to a script's own header.
