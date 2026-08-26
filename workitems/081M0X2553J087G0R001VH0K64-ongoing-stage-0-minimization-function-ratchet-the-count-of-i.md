---
id: 081M0X2553J087G0R001VH0K64
type: task
state: backlog
priority: P2
slug: ongoing-stage-0-minimization-function-ratchet-the-count-of-i
title: "Ongoing stage-0 minimization function: ratchet the count of INDEPENDENT shell entry points (graph roots, not file count), with a byte-guard that refuses concatenation cheats"
created: 2026-08-25T18:15:39.890Z
depends_on: []
composes_with: [081M00VNHB3087G0R001WHTKTH]
---

# Ongoing stage-0 minimization function

`mise` installs `bun`, so whatever installs `mise` cannot be written in `bun`.
Stage-0 shell is ESSENTIAL complexity (Brooks) and nothing here argues with it.
What is ACCIDENTAL is the number of **doors**.

## What is measured, and why that cut

> An **independent stage-0 entry point** is an allowlisted shell-family file that
> no other allowlisted shell-family file invokes -- a root of the stage-0 shell
> invocation graph -- unless it declares itself a door with a header marker.

A shell file that only another stage-0 script invokes costs nothing new: it sits
one hop behind a door that is already documented, already cold-tested, already on
someone's map. A file something outside the graph must NAME is what costs.

Three properties follow, and each is the reason this cut was chosen over
`git ls-files '*.sh' | wc -l`:

1. **It fixes the naive `is it sourced?` heuristic.** `tools/setup/macos.sh` is
   SPAWNED by `install.sh`, never sourced, and is still not an entry point --
   `install.sh` is the only thing that names it. Sourcing is one invocation form;
   the graph edge is what matters. Pinned by a test that dies under the naive rule.
2. **It creates ZERO pressure to merge bootstrap-ordered splits.** `mise.sh` before
   `shellenv.sh` before `profile-edit.sh` are all INTERNAL, so they are free. The
   metric cannot reward merging them because merging them does not move it. That is
   structural, not a promise.
3. **It resists concatenation.** `cat a.sh b.sh > ab.sh` on two internal files moves
   the number by 0. On two doors it moves it by 1 -- and the byte-guard refuses that
   trade unless the surface actually shrank.

Measured at `07aa44b3f1`: **18 independent, 12 internal, 21 invocation edges,
453975 bytes.** Extension-blind: three of the 18 (`githooks/pre-push`,
`scripts/hooks/commit-msg`, `scripts/hooks/pre-push`) carry no `.sh` suffix, so any
`*.sh` glob under-reports the surface by three. The allowlist, not a glob, is the
denominator -- reused from `check-bash-retirement-inventory.ts`, never re-derived.

## The one assertion, and why it needs no verification

A script may declare itself a door:

    # zeta-stage0-entrypoint: <reason>

`tools/setup/install.sh` needs it -- `zeta-install.sh` re-enters it on the NixOS
live-USB path, which would file the repo's primary documented door as "internal".
The declaration is an assertion, and assertions are normally refused here, but this
one can only ever make the ratcheted number WORSE for whoever writes it. An
assertion whose sole effect is to raise your own bill is self-enforcing.

## Ratchet, not report

`independent` may never rise; when it falls, `bytes` may not rise.

Chosen over report-only because report-only has already failed here: the retained
shell allowlist has been enforced on set-equality since #8216 and the surface still
grew to 30 entries, because nothing ever pushed the number DOWN. A number that only
reports gets read once and then furnished.

Wedge risk is real and answered by an escape hatch with a ledger: a genuinely-new
door is recorded in `exceptions` with a reason and passes. The second clause fires
only on the exact signature "fewer doors, more bytes" -- ordinary work that grows a
script while the door count holds is untouched, verified by a test that goes red if
that carve-out is removed.

**Wired into `cross-verify`, not `lint (bash retirement inventory ...)`.** That job
is not in `gate-required.needs`, so everything it runs blocks nothing -- the existing
shell allowlist has been advisory the whole time it was read as a guard. A ratchet
that cannot fail a merge is a number, not a ratchet.

## Honest limits of the measure

- **Variable-indirected invocation is invisible.** `githooks/pre-push` runs
  `bash "$FLOOR_HOOK"`; the parser sees a variable, not a path. Direction is safe --
  the target reads as independent, which over-counts.
- **No cross-language caller detection.** TypeScript, nix, plists and workflows all
  name shell scripts and most of those mentions are prose -- measured, not assumed:
  of the TS files referencing `macos.sh`, `curl-fetch.sh` and `mise.sh`, every hit
  was a comment. A regex-built cross-language detector would give a fuzzy
  denominator, which is worse than no number. So a script whose only caller is a bun
  realizer counts as independent. Over-counting creates pressure to reduce, never
  permission to grow.
- **The allowlist is inherited.** If `EXPECTED_RETAINED_SHELL` is wrong, this is
  wrong the same way. That is deliberate: one denominator, not two.

## The reduction proposal (18 -> 12 if all land)

| # | change | doors | confidence |
|---|---|---|---|
| R1a | delete `smoke-10-toolchains.sh` | -1 | HIGH |
| R1b | fold `smoke-7` into `smoke-13` | -1 | LOW -- see below |
| R2 | move `agda-cubical.sh` + `tlaps.sh` into their realizers | -2 | MEDIUM-HIGH |
| R3 | retire the duplicate Lior launchd pair | -2 | LOW -- needs the operator |
| R4 | one pre-push hook, not two | -1 | LOW -- needs a decision first |
| R5 | port `doctor.sh` to TypeScript | -1 | HIGH on class, MEDIUM on effort |

**R1a (HIGH).** Three generations of one script coexist. `smoke-10`'s own header:
"Replaces smoke-7-toolchains.sh. The old script is kept for backward compat";
`smoke-13`'s: "Replaces smoke-10-toolchains.sh". Control run: `rg` over
`.github/workflows/` returns exactly one hit, `gate.yml:3258`, and it names
`smoke-7`. Nothing anywhere invokes `smoke-10`. Historical accretion; delete.

**R1b (LOW -- flagged).** Repointing `gate.yml:3258` at `smoke-13` makes full-verify
newly capable of failing on six toolchains CI does not install (`smoke-13`'s own
header says so). The sequencing is already owned by `081M05E39F7`. Route it there;
do not do it blind from here.

**R2 (MEDIUM-HIGH).** Their only invoker is
`src/Core.TypeScript/ace/setup-realizers/from-agda-cubical.ts`, which runs under bun
-- `linux.sh:25` refuses to proceed without it. bun exists when they run, so they
have no bootstrap defence; they are shell wearing a bootstrap costume. Control run:
`rg -g '*.nix' -g '*.plist' -g '*.service'` for both names returns rc=1, zero
matches, so no OS-level surface invokes them pre-bun. Residual uncertainty: both are
`curl`/`tar`/`git` orchestration that TS can do, but neither has been read
line-by-line here for a shell-specific dependency.

**R3 (LOW -- flagged).** Two launchd definitions for one agent already coexist:
`.gemini/launchd/com.zeta.lior-loop.plist` points at `.gemini/bin/lior-loop-tick.ts`
(TypeScript, already ported) and `.gemini/service/com.lucent.zeta.lior.plist` points
at `.gemini/service/lior-loop.sh`. `install-lior-service.sh` is seven lines that
`cp` a plist and `launchctl load` it -- not stage-0 by any reading. The reduction is
to keep the TS pair and retire the shell pair. **Which definition is actually loaded
on the operator's machine is not knowable from the repo**; do not delete on a guess.

**R4 (LOW -- flagged).** Two pre-push hooks, wired by two mutually-exclusive
mechanisms: `AGENTS.md:45` instructs `git config core.hooksPath githooks`, while
`install-git-hooks.sh` symlinks `scripts/hooks/pre-push` into `.git/hooks/`. If both
are configured, hooksPath wins and the symlink is dead. `githooks/pre-push`'s entire
non-delegating body is a PATH export and one `bun run preflight:quick`. Folding it
into the floor hook is a -1, but **which mechanism is canonical is an open decision,
not a fact I can read**, and merging before deciding would pick the answer by
accident.

**R5 (HIGH on class).** `doctor.sh` is 268 lines of `command -v` + warnings that run
after install completes; bun is present. Control run: no nix/plist/service surface
invokes it. Not stage-0. Effort is the largest of the diagnostic ports.

## NOT proposed -- defended as essential

These are named so a later pass does not re-litigate them:

- `tools/setup/install.sh` -- the door itself. A human runs it on a bare OS.
- `macos.sh` / `linux.sh` / `mise.sh` / `shellenv.sh` / `host-tier.sh` /
  `curl-fetch.sh` / `profile-edit.sh` / `fd-limits.sh` / `install-zig.sh` /
  `install-rust-wasm32.sh` / `host-loop-bootstrap.sh` / `install-git-hooks.sh` --
  all INTERNAL, all pre-bun or one hop behind a door. The metric does not ask for
  them, which is the metric working. `install-zig.sh` and `install-rust-wasm32.sh`
  are post-mise and could become realizers, but that is a bytes win, not a doors
  win, and it is not what was asked for here.
- `zeta-install.sh` + `zeta-first-boot.sh` -- NixOS live-USB and first boot. Nothing
  of ours exists yet. Textbook stage-0.
- `zeta-self-register.sh` -- a first-boot systemd oneshot invoked by
  `zeta-self-register.nix`. OS edge.
- `keyring.sh` -- `read -s`, umask-077 and a shred-on-exit trap are in-process shell
  SEMANTICS, and the seed reaches `bun` through a pipe from a builtin so it never
  enters argv (measured in `docs/SHELL-DEPRECATION-SEQUENCE.md`). This is the one
  place where "it must be shell" is a property rather than a habit.
- `dkek-ceremony-preflight.sh` -- gates whether a PKCS#11 ceremony may proceed, so
  it cannot depend on the tooling it gates.
- `scripts/hooks/commit-msg` -- git invokes it directly; git is stage-0-available.
- `secret-clip.sh` -- carries a known argv leak at line 93 and is a PORT candidate
  owned by `081M00VNHB3087G0R001WHTKTH`, not a MERGE candidate. Not this item's.

## Falsifiers

`measure-stage0-independence.test.ts`: 32 tests. Four of them fix live false
positives found while building the parser -- a URL on a continuation line
(`macos.sh:62`), a single-quoted profile line being written rather than run
(`profile-edit.sh:31`), an `&&` inside a double-quoted error message
(`zeta-install.sh:3286`), and heredoc bodies that print script names. False edges
are the dangerous direction: they make a door look internal.

13 mutants, 13 killed. Each guard has a mutant that removes it and a test that goes
red: quote-aware segment splitting, single-quote stripping, continuation joining,
heredoc stripping, `sudo`/`env` wrapper transparency, the byte-guard, the
rise-comparison boundary, the graph-vs-`is-it-sourced` classifier, the
entrypoint-marker header window, head-position invocation matching, the exceptions
allowance, and both halves of the stale-baseline signal.

Five end-to-end controls against the real tree, each of which could have come out
the other way: baseline 17 fails loudly; the same with a recorded exception passes;
baseline 19 demands the new baseline; baseline 19 with tiny bytes trips the
concatenation guard by name; and a byte-only change with the door count held passes.
