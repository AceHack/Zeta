---
id: 081M24D4APR087G0R001QRQ071
type: bug
state: backlog
priority: P2
slug: close-five-npm-pnpm-advisory-alerts-qs-6-16-0-in-both-site-l
title: "close five npm/pnpm advisory alerts: qs 6.16.0 in both site lockfiles and smol-toml past its override floor"
created: 2026-09-10T00:57:50.040Z
depends_on: []
composes_with: []
---

# close five npm/pnpm advisory alerts: qs 6.16.0 in both site lockfiles and smol-toml past its override floor

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M24D4APR087G0R001QRQ071-*.md` glob. -->

## What was open

Five Dependabot alerts across three manifests, all with a published patched
version:

| alert   | package          | manifest                              | vulnerable | patched |
| ------- | ---------------- | ------------------------------------- | ---------- | ------- |
| 70      | smol-toml (high) | package-lock.json                     | <= 1.7.0   | 1.7.1   |
| 27 / 28 | qs               | src/Renderers/website/pnpm-lock.yaml  | < 6.16.0   | 6.16.0  |
| 21 / 22 | qs               | demo/identity-dla-site/pnpm-lock.yaml | < 6.16.0   | 6.16.0  |

The four qs alerts were explicitly deferred by PR #17124 as "a different
ecosystem and a separate change". This is that change.

## What the alert text did not name

The `smol-toml` alert says "a dependency is out of date". What was actually
wrong is that OUR OWN override was holding it there, and holding it BELOW what
its consumer asked for.

- `markdownlint-cli2@0.23.2` declares an EXACT `smol-toml: 1.7.0`.
- The root `overrides` block has said `"smol-toml": "1.6.1"` since 2026-04-21
  (commit `8f61566942`), with no recorded reason anywhere in the tree.
- So for four and a half months the override silently DOWNGRADED the tool the
  markdown gate runs on -- which is the exact failure PR #17124 recorded as a
  wrong turn and rejected, already committed and standing.
- And 1.6.1 is on the wrong side of CVE-2026-85730.

## Measured, with a control

CVE-2026-85730 is an infinite loop, so the falsifier is a timeout and the
control is the version we were shipping:

```
# subject -- the version this tree installed, pinned there by our own override
timeout 15 bun -e "(await import(...smol-toml@1.6.1...)).parse(\"a=[1 #\")"
  -> rc=124   (never returned; CPU pinned)

# after -- the patched version
timeout 25 bun -e "(await import(...smol-toml@1.7.1...)).parse(\"a=[1 #\")"
  -> threw TomlError: cannot find end of structure
  -> parse("a = [1, 2] # trailing") still yields {"a":[1,2]}
```

Both site fixes were checked on DISK, not in the lockfile: after
`pnpm install --frozen-lockfile`, `node_modules/.pnpm/` holds `qs@6.16.0` in
both sites. `pnpm run check` and `vite build` pass for the website;
`identity-dla-pages-build.ts` -- the entry the deploy itself runs -- passes for
the demo site.

## The falsifier, so the class cannot come back quietly

`src/Core.TypeScript/hygiene/lint-overrides-take-effect.ts`, wired into the
`build-graph-completeness` gate job beside the other premise checks. An
`overrides` entry is a security control written as a version string; nothing
checked that it took effect. It refuses three measured shapes:

1. **Lockfile drift** -- any lockfile resolving the package to something other
   than the declared version, including a SPLIT resolution behind an alias key.
2. **A nested key** (`a>b`) -- bun ignores nested overrides while npm honours
   them, so npm shows a fix bun never installs. PR #17124 hit this live.
3. **A range** rather than a pin -- a range lets a resolver pick the low end,
   which is where the advisory lives.

UNKNOWN is not a pass: a missing lockfile exits 2 and names the file.

Mutation-checked end to end, not just in unit tests: reverting the override to
1.6.1 gives rc=1 on both lockfiles; rewriting bun.lock alone to 1.6.1 gives
rc=1 naming only bun.lock; the unmutated tree gives rc=0.

## Not touched, and why

- Alerts 29 / 69, `accelerate` (pip): no patched version exists. Nothing to do
  that is not a dismissal.
- Alert 15 / `quantum-circuit`: the maintainer ruled it stays, and its premise
  is already enforced by `lint-mathjs-dismissal-premise.ts`.
- `demo/identity-dla-site/patches/wouter@3.7.1.patch` is committed but no
  `pnpm.patchedDependencies` field references it, so pnpm never applies it.
  Out of scope here; noted because it is a dead file that looks live.

Zero dismissals. Every alert above is closed by a version change that the
installed tree carries.
