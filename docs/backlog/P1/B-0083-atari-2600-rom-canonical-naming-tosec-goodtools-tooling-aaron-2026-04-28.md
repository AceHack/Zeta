---
id: B-0083
priority: P1
status: open
title: Atari 2600 ROM canonical-naming + safe-vs-unsafe folder split + TOSEC/Good-Tools-style hash-lookup tooling
tier: factory-tooling
effort: M
ask: maintainer Aaron 2026-04-28 (autonomous-loop ROM-drop + canonical-naming request)
created: 2026-04-28
last_updated: 2026-04-28
tags: [aaron-2026-04-28, roms, atari-2600, tosec, good-tools, canonical-naming, datfile, license-safety, gitignore-already-protects, high-priority-after-0-0-0, scheduled-after-0-0-0]
---

# B-0083 — Atari 2600 ROM canonical-naming + tooling

## Source

Aaron 2026-04-28T18:55Z verbatim:

> *"I just put a bunch of messy roms int your Atari 2600 folder, can you
> organize them connonicaly for easy finding, feel free to spend some
> time doing research, these folders should be ignored and not checked
> in but you can reference any of them you want in readmes as games you
> can test out locally, we don't want to distribute atari roms, we can
> manually selelct check in any that won't get us in trouble for sharing
> on github for any that's follow those rules and licenses. we maybe need
> different non git ignored folder for those special ones that are safe.
> Please name them all connonically and probably does not need to be
> zipped, there are tools that can help you likely with naming them, like
> to tosec and good tools, i don't know if they run on mac but you can
> look at their source to figure out how it workds it's proabaly some
> database file you can check agants sha or md5s or sometime based on the
> latest list. Lets make sure we can replicate that functionalty here on
> list updates if that's how it works, we can backlog this but hight
> priortiy right after the 0/0/0 starting point"*

## Schedule

**Scheduled trigger**: 0/0/0 AceHack-LFG hard-reset complete (the
hard-reset chain is the gating dependency; see PR #677 5-disciplines
and pull-queue work).

## Ownership rationale (Aaron verbatim 2026-04-28T18:58Z)

> *"basically some roms i own becasue i bought the same i can share
> with you locally but we can't check into git, only certain ones are
> license safe or it's expired or whatever. those can get checked in,
> the more realish games will only be on local maintainers computers
> and each will likely have their own set."*

This articulates the established personal-use vs distribution legal
boundary:

- **Aaron owns the ROMs (bought them)** → personal-use copies are
  legal between him and the local agent on his machine.
- **Distribution via git** would create a redistribution path → only
  license-cleared ROMs (public domain, homebrew with permissive
  license, copyright-expired, explicit-license-commercial) can ship
  in the tracked `roms-safe/` folder.
- **Per-maintainer local ROM sets**: the gitignored `roms/` folder
  is local to each maintainer's machine. Each maintainer will have
  their own set based on what they personally own.
- **The safe folder is the SHARED canonical surface**: only ROMs that
  every maintainer can legally use (regardless of what they personally
  own) live in `roms-safe/`.

This split is exactly what the existing `roms/.gitignore` +
`roms/atari/2600/README.md` license-safety-gate enforces. B-0083
operationalizes the split by adding the safe-folder + the tooling.

## Current state (verified 2026-04-28T18:53Z)

- **3461 files** in `roms/atari/2600/` — mix of `.bin` and `.zip`,
  some Good-Tools-style canonical names (`Title (Year) (Publisher)
  [!]`), some uncanonical (`Jammed.bin`, `seantsc.bin`).
- **`roms/.gitignore` already fully protects** with depth-limited
  pattern (`*` + `!*/` + `!/README.md` + `!/*/README.md` +
  `!/*/*/README.md`). The 3461 ROMs are NOT at risk of accidental
  commit. README.md is the only tracked file. **No emergency action
  required.**
- **`roms/atari/2600/README.md` already documents the license-safety
  gate**: PD / homebrew-with-permissive-license / official-test-ROMs /
  commercially-released-as-free / explicit-license-commercial = SAFE;
  uncertain provenance defaults to FORBIDDEN.

## Why high-priority + scheduled-after-0/0/0

Aaron's explicit verbatim: *"we can backlog this but hight priortiy
right after the 0/0/0 starting point"*. Decoded:

- Priority: P1 (high)
- Trigger: AceHack-main and LFG-main reach 0/0/0 (per the hard-reset
  audit already in flight; see PR #677's 5-disciplines memory + the
  pull-queue work this session).
- NOT before 0/0/0 — the substrate cleanup is the blocking
  dependency.

## Background research (TOSEC + Good Tools)

### TOSEC ("The Old School Emulation Center")

- Datfile format: XML, one `<datafile>` per platform.
- Each `<game>` entry has `<rom>` children with `name`, `size`,
  `crc`, `md5`, `sha1` attributes.
- Canonical naming convention (TOSEC Naming Convention 2015 / TNC15):
  `Title version (Demo) (Date)(Publisher)(System)(Video)(Country)(Language)(Copyright)(Devstatus)[Cracked][Trainer][Hacked][Modified][Pirated][Bad][Verified][More Info]`
- Datfiles available from: <https://www.tosecdev.org/> + GitHub
  mirrors (e.g. `TheTOSECteam` org).
- Atari 2600 platform-slug: `Atari 2600 (TOSEC)`.

### Good Tools (a.k.a. GoodSets)

- Created by Cowering. Discontinued ~2011 but datfiles remain
  authoritative for older ROM-set hash matching.
- Atari 2600 set: `GoodA26` (typically `GoodA26 v3.27` or similar).
- Naming convention: `Title (Year) (Publisher) [code]` where code is
  `[!]` (verified good), `[a1]` (alternate), `[b1]` (bad dump),
  `[h1]` (hack), `[o1]` (overdump), `[t1]` (trainer), `[T+ENG]`
  (English translation), etc.
- Source for GoodA26: search GitHub for `GoodTools-A26` mirrors;
  the original distribution was `GoodA26.zip` containing the EXE
  + datfile.

### Algorithm (replicated in factory tooling)

1. **For each file in `roms/atari/2600/`**:
   - Extract: if `.zip`, get the inner ROM bytes.
   - Compute SHA1 + MD5 + CRC32 of the ROM bytes.
2. **Lookup in datfile**:
   - Match by SHA1 first (most discriminating).
   - Fall back to MD5 → CRC32 if SHA1 absent.
   - If no match: file is unrecognized; flag for manual review.
3. **Rename to canonical form**:
   - Use TOSEC TNC15 OR Good-Tools convention (pick one as
     factory standard; recommend TOSEC for ongoing maintenance
     since GoodTools is discontinued).
4. **Classify license-safety**:
   - Match against the README's permitted classes (PD, homebrew,
     official-test, commercially-released-as-free, explicit-license).
   - The TOSEC `<game>` element's `<description>` and
     `<comment>` fields sometimes carry license metadata; if not,
     fall back to a curated allowlist (e.g.
     `tools/roms/manifests/atari-2600-homebrew-allowlist` (no-extension manifest per the `tools/setup/manifests/uv-tools` convention)).
5. **Move to safe vs unsafe folder**:
   - Safe: a NEW non-gitignored tracked folder
     (`roms-safe/atari/2600/` or similar).
   - Unsafe: stays in `roms/atari/2600/` (gitignored).
6. **README cross-references**:
   - Update `roms/atari/2600/README.md` to list the safe ROMs
     by canonical name with a one-line summary + license citation.
   - Optional: list the unsafe ROMs available locally (filenames
     only, no distribution) so future-Otto knows what's available
     for testing.

## Tooling design — dependency-first as bridge; build-our-own as end goal (Aaron 2026-04-28T18:59Z + 19:00Z)

Aaron verbatim 18:59Z: *"TOSEC/Good we can pull as dependences too and
use the same consume goodcitizen staces as all of our other dependencies
i just don't know if these are cross platform."*

Aaron sharpened verbatim 19:00Z: *"build-our-own as last resort. our
good citizen is because our end goal is we build all of our dependncies
but still contribute back our enhancements and such"*

The trajectory (per
`memory/feedback_absorb_and_contribute_community_dependency_discipline_2026_04_22.md`
end-goal sharpening):

1. **Bridge phase**: pull TOSEC/Good Tools (or cross-platform
   equivalent) as a dependency. Use the established consume-good-
   citizen pattern. Contribute back enhancements while we use it.
2. **Build-our-own phase** (eventual): factory builds its own
   datfile-driven ROM-namer. This is the end goal, not a fallback.
3. **Contribution-back continues** even after build-our-own lands —
   peer-maintainer status survives our own implementation.

For B-0083 specifically, we're at step 1 (bridge phase). The
preferred immediate path is dependency-first; build-our-own is
explicitly the trajectory direction, not a panic-fallback.

### Cross-platform tool research (preliminary, expand on pickup)

- **TOSEC reference tools** (`clrmamepro`, `tosec-cli`):
  - `clrmamepro` is Windows-only (no Mac/Linux build).
  - `tosec-cli` is .NET Framework — Mac-via-mono possible but flaky.
  - **Likely NOT directly usable on Mac.**
- **GoodTools** (Cowering):
  - Windows-only EXE distributions, discontinued ~2011.
  - **Not cross-platform.**
- **RomVault** (`https://github.com/gjefferyes/RomVault`, .NET 6+, cross-platform):
  - Confirmed Mac/Linux support via dotnet runtime.
  - Mature ROM-management tool, datfile-driven.
  - **Strong candidate for primary dependency.**
- **Romulus** (Java, cross-platform JVM):
  - JVM-based, runs on Mac.
  - Older project; less active.
- **retool** (`https://github.com/unexpectedpanda/retool`, Python, cross-platform):
  - Active Python project for ROM filtering by datfile.
  - Routed through factory uv-managed pipx (NEVER raw `pip install` — see
    `docs/DECISIONS/2026-04-27-uv-canonical-python-tool-manager.md` for
    the canonical Python-tool-manager decision); Mac-friendly.
  - **Strong candidate for scripting integration.**
- **Mednafen toolchain** + custom datfile-parsing scripts.

### Recommended approach (pickup-time decision tree)

1. **Try RomVault first** (managed via mise / dotnet pin per
   the existing dependency-consumption pattern). If it works
   cross-platform and we can drive it headlessly, this is
   the cleanest path.
2. **Fall back to retool** (Python tool, routed through
   factory uv-managed pipx — NEVER raw `pip install`) if
   RomVault doesn't headless-script cleanly.
3. **Fall back to build-our-own** (pure-Python in `tools/roms/`)
   ONLY if neither above tool fits the factory shape. This is
   the last resort — the algorithm is straightforward
   (SHA1/MD5/CRC32 lookup against datfile XML) but maintaining
   our own datfile-parser is ongoing-work we'd rather not own.

### Datfile-as-dependency

Either path needs the actual TOSEC + GoodA26 datfiles. Approach:

1. Pin the datfile version in our dependency-manifest (similar
   to how `.mise.toml` pins runtime versions).
2. Download from canonical sources (TOSECdev.org / archived
   GoodSets mirrors).
3. Refresh on a cadence (similar to budget-snapshot-cadence) —
   when TOSEC publishes a new datfile, re-pin + re-run.
4. Verify via SHA256 of the datfile itself per the
   pin-with-checksum pattern (Otto-247 + the threading-lineage
   citing-discipline).

### Build-our-own fallback (only if dependency path fails)

- **Live in `tools/roms/`** (new factory tooling subdirectory).
- Pure-Python or pure-bash; no external runtime beyond what
  `.mise.toml` already pins.
- Algorithm:
  1. Download TOSEC datfile (XML) from versioned URL.
  2. Parse XML, build `dict[sha1] = (canonical_name,
     license_class, ...)`.
  3. For each file in `roms/atari/2600/`, compute SHA1, lookup,
     rename + move per classification.
  4. Refresh-on-demand: re-pull datfile, re-run against folder.
- **Schedule via existing GHA cadence** (similar to
  budget-snapshot-cadence pattern) for periodic datfile refresh.

### Good-citizen contribution path

Per `memory/feedback_absorb_and_contribute_community_dependency_discipline_2026_04_22.md`:
when we use TOSEC/RomVault/retool, we contribute back. Specifically:

- Bug reports for Mac-specific issues we hit.
- Documentation improvements if their docs missed something.
- New datfile entries we generate (e.g. for safe-folder homebrew
  ROMs Aaron classifies).
- Financial support (small-donor tier) if the project accepts it
  per Aaron's funding posture (`feedback_absorb_and_contribute_*`).

## Folder structure proposal

```
roms/                              (gitignored, bulk)
├── .gitignore                     (existing depth-limited rule)
├── README.md                      (existing top-level protocol)
└── atari/2600/                    (existing — 3461 ROMs gitignored)
    └── README.md                  (existing safety-gate)

roms-safe/                         (NEW, tracked — license-verified ROMs)
├── README.md                      (NEW — explains the split + cites licenses)
└── atari/2600/                    (NEW)
    ├── README.md                  (NEW — per-ROM citations)
    └── *.bin                      (NEW — only ROMs cleared by license)
```

## Acceptance criteria

- [ ] All 3461 files in `roms/atari/2600/` renamed to canonical
  form (TOSEC or Good-Tools — pick one) where matchable.
- [ ] Unmatchable files flagged in a manual-review list.
- [ ] License-classification applied per the README's gate.
- [ ] License-cleared ROMs moved to `roms-safe/atari/2600/`
  with per-ROM license citation.
- [ ] License-uncertain ROMs stay in `roms/atari/2600/`
  (gitignored, never distributed).
- [ ] Tooling lives in `tools/roms/` and refreshes on TOSEC
  datfile updates (manual-trigger workflow at minimum;
  scheduled cron optional).
- [ ] `roms/atari/2600/README.md` updated to reference the
  safe ROMs as "games you can test out locally" per Aaron's
  framing.
- [ ] Otto-247 version-currency: WebSearch for the latest
  TOSEC Atari 2600 datfile version before asserting which
  one to use.

## Composes with

- `roms/.gitignore` — already protects against accidental commit.
- `roms/README.md` + `roms/atari/2600/README.md` — already
  document the license-safety gate.
- B-0061 (monolith-to-per-row migration) — adjacent factory-
  hygiene class.
- Otto-247 version-currency — for datfile version handling.
- Otto-275-YET — Aaron's explicit log-don't-implement signal
  ("we can backlog this").
- The 0/0/0 hard-reset work in flight (PR #677 5-disciplines
  + the pull-queue audit) — gating dependency.

## Future-Otto pickup notes

When 0/0/0 lands:

1. Re-read this row + `roms/README.md` + `roms/atari/2600/README.md`.
2. Run an Otto-247 WebSearch for "TOSEC Atari 2600 datfile latest 2026"
   to get the current version.
3. Pick TOSEC (recommended for active maintenance) over Good Tools.
4. Build the tooling in `tools/roms/` (Python likely; bash for shell-
   integration; either is acceptable per existing factory polyglot
   discipline).
5. Apply per the algorithm in this row.
6. Spot-check 5-10 ROM renames before mass-applying (per the
   5-pre-flight-disciplines verify-substrate-state pattern).
7. Cross-CLI verify (Otto-347) on the license-classification logic
   — getting that wrong has legal blast radius.
