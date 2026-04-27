---
name: Install-script language strategy — post-install TypeScript / pre-install bash + PowerShell / Python for AI-ML
description: Aaron 2026-04-27 confirms long-horizon plan for `tools/setup/` install machinery — pre-install scripts stay bash + PowerShell (must work where users are with nothing installed); post-install scripts will eventually migrate to TypeScript (declarative state, easier to test, type-safe); Python is good for AI/ML scripts eventually but is not the default for general post-install work; Python pickup in `../scratch` was the foundation Otto observed and added to .mise.toml — that was the correct read of the future declarative state.
type: project
---

# Install-script language strategy — pre/post-install split

## Verbatim quote (Aaron 2026-04-27)

After Otto landed PR #26's INSTALLED.md update changing the
Python row from "system default / pre-installed" to
"3.14 (mise-pinned)", Aaron responded:

> "cool, this is a you. I'm guessing you like python and saw
> that ../scratch already had it install and that's our future
> declarative state for all our dependences so you went ahead
> and got python early. lol our post install scripts will
> eventually be typescript but python is good too for AI/ML
> based scripts eventually. Regular kind of post isntall will
> all end up being typescript instead of bash. bash and windows
> powershell will be use only for pre install scripts cause we
> have to go to the users where they are, can't expect anyting
> installed. Good job on everything."

## What this gives the substrate

Three load-bearing decisions for `tools/setup/` and the
broader install machinery:

### 1. Pre-install stays bash + PowerShell

Pre-install scripts are the bootstrap layer: they run on a
fresh machine with NOTHING installed. Aaron's framing —
"we have to go to the users where they are, can't expect
anyting installed" — codifies the inescapable constraint:

- macOS / Linux: bash 3.2+ (the macOS default). Already the
  factory's compatibility target per Otto-235 (4-shell
  bash compatibility: macOS 3.2 / Ubuntu / git-bash / WSL).
- Windows: PowerShell. Pre-installed on every modern
  Windows box; nothing else can be assumed.

Pre-install scope: detect / install package managers (mise,
homebrew, scoop, etc.), install language runtimes that
nothing else depends on, set up the minimum environment
necessary to run a richer post-install pass. NO higher-level
tooling assumed.

### 2. Post-install migrates to TypeScript

Once a runtime exists (because pre-install ran), post-install
work — the larger, more complex configuration / artifact-
download / verification work — moves to TypeScript:

- Declarative state is easier to express in TypeScript than
  bash.
- Type-safety catches whole classes of bug (off-by-one,
  unhandled null, wrong-shape config) before they ship.
- Cross-platform behaviour is more uniform than bash
  (which has macOS 3.2 / Linux 4+/5 incompatibilities + WSL
  edge cases).
- Same runtime as the bun-TS migration Otto-215 already
  flagged (bun + TypeScript displacing bash for post-install
  scripts).

This composes cleanly with Otto-215's framing: "Bun-TS
post-install migration before substantive Windows work" —
the post-install→TypeScript decision IS the migration plan,
expressed as language strategy rather than as platform
sequencing.

### 3. Python for AI/ML eventually

Python is NOT the default for general post-install. Aaron
explicitly: *"python is good too for AI/ML based scripts
eventually. Regular kind of post isntall will all end up
being typescript instead of bash."*

Python's role is narrow: AI/ML-specific work where the
ecosystem (NumPy / PyTorch / HuggingFace / scikit-learn /
etc.) is unmatched. Calls for Python in install machinery
should pass the AI/ML test before being accepted; otherwise
TypeScript is the answer.

## Why Otto's Python pickup was correct

Aaron validated the move: *"that's our future declarative
state for all our dependences so you went ahead and got
python early."* The structural reasoning:

- `../scratch` is Aaron's reference workspace — the dir
  where future-state experiments live BEFORE they land in
  factory canonical paths.
- `.mise.toml` already pinned `python = "3.14"` (line 25),
  so the Python row in `docs/INSTALLED.md` showing
  "system default" was stale documentation, not a
  policy choice.
- The PR #26 review thread asked specifically whether the
  Python row should be updated to mise-managed. The
  affirmative answer was correct.

The corollary: future Otto reads of `../scratch` for
declarative-state hints are blessed; that workspace IS the
forward-looking factory state. (Same pattern as Otto reading
the Aaron-Amara conversation archive for upstream design
context — `docs/amara-full-conversation/` IS the
substrate.)

## Operational implications

1. **No more bash for new post-install work.** When new
   post-install machinery is needed, write it in TypeScript
   (run via bun) rather than bash. Existing bash post-
   install scripts get migrated opportunistically; no
   forced sweep.

2. **Pre-install scripts stay bash / PowerShell forever.**
   This is not a "we'll migrate later" — pre-install is
   structurally bash + PowerShell because of the no-runtime
   constraint. New pre-install work goes in those two
   languages.

3. **Python proposals get AI/ML-test-gated.** When Python
   shows up as a proposed install-script language, the
   reviewer asks: is this AI/ML work? If no, redirect to
   TypeScript. If yes (e.g. embedding-generation scripts,
   model-fine-tuning helpers, eval-harness work), Python
   is fine.

4. **PowerShell-expert capability skill should be
   acknowledged.** Per the available-skills list,
   `powershell-expert` already exists for the Windows
   branch of pre-install scripts. The pre/post-install
   split blesses that skill's continued operational
   relevance — it's not a stub, it's the canonical
   Windows-pre-install authority.

5. **`.mise.toml` is the source of truth for declarative
   pins.** Documentation rows in `docs/INSTALLED.md`
   should reflect mise-managed state when `.mise.toml`
   pins something, NOT system-default fallback. Otto's
   PR #26 fix is the canonical pattern for that
   discipline.

## Composes with prior

- **Otto-215** — Bun-TS post-install migration before
  substantive Windows work. Otto-215 framed the decision
  as platform-sequencing; this Otto-NN frames it as the
  underlying language strategy. Same decision, two views.
- **Otto-235** — bash compatibility target (4-shell:
  macOS 3.2 / Ubuntu / git-bash / WSL). Pre-install scope
  is exactly where this discipline applies; post-install
  TypeScript drops the macOS-3.2 burden (TypeScript
  doesn't care about bash version).
- **Otto-247** — Version currency always WebSearch.
  Applies to Python pin (3.14), TypeScript runtime version,
  PowerShell version targets — when documenting any of
  them, WebSearch first.
- **Otto-249** — Standard GitHub runners free for public
  repos. Composes with the cross-platform CI strategy:
  bash on Ubuntu runners (free), TypeScript on any runner
  (free), PowerShell on Windows runners (free for public
  repos per Otto-249).
- **Otto-323** — dependency symbiosis discipline. The
  post-install→TypeScript decision means depending on the
  bun + TypeScript ecosystem MORE; Otto-346 dependency-
  symbiosis-IS-human-anchoring framing applies — we
  contribute back to bun + TS upstream where appropriate.
- **`.claude/skills/powershell-expert/SKILL.md`** — the
  Windows-pre-install authority skill; this Otto-NN
  blesses its continued relevance.
- **`.claude/skills/typescript-expert/SKILL.md`** — the
  TypeScript-idioms skill; will see increased use as
  post-install migration proceeds.
- **`.claude/skills/python-expert/SKILL.md`** — narrow
  scope confirmed: Python = AI/ML, not general post-
  install. Skill's "narrow Python surface" framing
  remains correct.
- **`.claude/skills/bash-expert/SKILL.md`** — pre-install
  authority; not deprecated, just scoped to pre-install
  + existing legacy bash scripts.

## What this DOES NOT claim

- Does NOT claim immediate sweep of existing bash
  post-install scripts. Migration is opportunistic.
- Does NOT forbid Python for non-AI/ML work today;
  it's a long-horizon target preference, not a hard rule.
- Does NOT pin a specific TypeScript runtime
  (bun vs deno vs node) — bun is the working assumption
  per Otto-215, but the language-strategy decision is
  TypeScript-the-language, not bun-the-runtime.
- Does NOT specify when migration starts — sequenced
  AFTER more load-bearing work (Aurora integration, factory
  demo, sync stabilization).
- Does NOT make `../scratch` an automatic absorb-source —
  it's a declarative-state hint surface, not a substrate
  to copy from blindly. Each absorption still gets
  reviewed.

## Aaron's "Good job on everything" — the validation half

The closing "Good job on everything" is positive feedback on
the substrate-cluster work that landed during this session:

- Otto-354 ZETASPACE per-decision recompute discipline
- Otto-355 BLOCKED-with-green-CI-investigate-threads-first
  wake-time discipline
- Otto-356 Mirror vs Beacon-safe register-discipline
- Otto-357 NO DIRECTIVES — Aaron makes autonomy first-class
- Otto-358 LIVE-LOCK term too broad — narrow to CS-standard
- Otto-359 Otto uniquely positioned to clean Aaron's Mirror
  language from substrate
- PR #26 9-thread-resolution + auto-merge

Validation pattern: Aaron's positive feedback comes after a
substrate-cluster lands, not during. Per Otto-339 (words
shift weights), positive validation IS the substrate-shift
that confirms the cluster's load-bearing role. The cluster
is now operationally settled.

## Key triggers for retrieval

- Install-script language strategy — pre vs post split
- Pre-install: bash + PowerShell (where users are, nothing
  installed)
- Post-install: TypeScript (bun-runtime; declarative state)
- Python: AI/ML scripts only, not general post-install
- `../scratch` as future-declarative-state hint surface
- `.mise.toml` python pin (3.14) authoritative
- Aaron 2026-04-27: "post install scripts will eventually
  be typescript" + "bash and windows powershell will be use
  only for pre install scripts"
- Composes Otto-215 + Otto-235 + Otto-247 + Otto-323 +
  Otto-346
- Aaron's "Good job on everything" closing — substrate
  cluster validation
