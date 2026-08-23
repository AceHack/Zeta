---
id: 081M0QSP0CF087G0R0007895QZ
type: bug
state: backlog
priority: P2
slug: bun-is-pinned-to-a-floating-minor-bun-1-3-so-the-resolver-ca
title: "bun is pinned to a floating minor (bun = 1.3) so the resolver can change under an untouched tree"
created: 2026-08-23T17:11:22.767Z
depends_on: []
composes_with: []
---

# bun is pinned to a floating minor (bun = 1.3) so the resolver can change under an untouched tree

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QSP0CF087G0R0007895QZ-*.md` glob. -->

## The evidence

`.mise.toml:77` reads `bun = "1.3"` — a floating minor, so `mise install` resolves to
whatever `1.3.x` is newest at the moment each machine or runner installs.

A lockfile is a **byte-exact artifact of the resolver that wrote it**. Pinning the
resolver loosely means the tooling that judges the lockfile can change under a tree
nobody touched, and the failure surfaces as an unrelated commit "breaking" CI.

**This is not hypothetical — it was measured on 2026-08-23 at `origin/main` `a3b7f458c`:**

| resolver | command | verdict |
|---|---|---|
| bun **1.3.13** | `bun install --frozen-lockfile --dry-run` | **passes** |
| bun **1.3.14** | `bun install --frozen-lockfile` | **fails** — `error: lockfile had changes, but lockfile is frozen` |

Two agents, one commit, opposite conclusions, because they were running different
resolvers. That divergence cost real diagnosis time: it made a genuine lockfile
omission (#14292 registered the `twitch-ai` workspace without regenerating `bun.lock`,
healed by #14303) look unreproducible, and it made a correct local "it passes" report
misleading rather than wrong.

## Why this is a bug and not a preference

The same discipline is already carved elsewhere in this repo: `dep-pin-search-first`
pins `1password-cli = "2.34.1"` **exactly**, and `.mise.toml` records the `mise
ls-remote` date that justified it. `bun` is the outlier, and it is the one tool whose
version decides whether every other check can even start — every job that installs TS
deps runs `bun install --frozen-lockfile` first, which is why one omission surfaced as
seven identical failures across unrelated PRs and then on `main` itself.

## What "done" looks like

- `bun` pinned to an exact patch version, with the `mise ls-remote` date recorded in a
  comment beside it, matching the `1password-cli` precedent.
- A check that **fails when any `.mise.toml` tool is pinned to a floating range**, so
  the class is closed rather than this one instance fixed. Prove it discriminates —
  loosen a pin locally, confirm red, restore.
- Deliberate exceptions (if any tool genuinely wants a range) named explicitly in the
  file with the reason, so an exception is a decision rather than an oversight.

## Not in scope

Bumping any tool's version. This is about **how** versions are pinned, not which ones.
A pin change with fleet blast radius deserves its own review, which is exactly why it
was filed rather than bundled into the #14305 hotfix.

## Pointers

- `.mise.toml:77` — the floating pin · `.mise.toml` `1password-cli` — the exact-pin precedent
- #14292 (the omission) · #14303 (the heal) · #14305 (closed duplicate; carries the measurement)
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the check is the falsifier this needs
