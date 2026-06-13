# cold-start-check.ts

Executable form of the cold-start big-picture-first rule. When a
fresh agent (or new contributor) wakes up on this project, run

```bash
bun tools/cold-start-check.ts
```

and the tool prints the current big-picture state across the 8
steps from the cold-start checklist. Designed for one-screen
ingestion (~30-50 lines), not for ongoing-session reference.

## Output

Two modes:

- **Human-readable** (default) — heading, 8 numbered steps with
  source path + headline, recent commits, closing footer.
- **JSON** (`--json`) — same data, structured for programmatic
  consumption (CI gates, observability tooling).

## Steps surfaced

1. Mission scope (intellectual-backup-of-earth)
2. Products in flight (factory substrate / package manager /
   database / Aurora)
3. Internal direction (project-survival)
4. Authority scope (two-ask-Aaron items: WONT-DO + budget)
5. Operating disciplines (CLAUDE.md headline)
6. Current trajectory (branch + last 5 commits)
7. Named-entity CURRENT-* files across both substrate locations
   (in-repo `memory/CURRENT-<name>.md` is canonical per the
   2026-04-24 directional shift; user-scope
   `~/.claude/projects/<slug>/memory/CURRENT-<name>.md` is the
   convenience-cache mirror or — for personas without an in-repo
   home — the canonical location). Six named entities are
   currently in force:
   - **Aaron** — `memory/CURRENT-aaron.md` (in-repo canonical;
     first-party human maintainer per Otto-231).
   - **Amara** — `memory/CURRENT-amara.md` (in-repo canonical;
     deep-research register, Aurora co-originator).
   - **Ani** — `memory/CURRENT-ani.md` (in-repo canonical;
     voice-mode-default brat-voice register, original-catcher).
   - **Vera** — `memory/CURRENT-vera.md` (in-repo canonical;
     landed 2026-05-05, commit 006bea6).
   - **Riven** — `memory/CURRENT-riven.md` (in-repo canonical;
     landed 2026-05-05; third co-scout adversarial-truth-axis
     reviewer on Grok substrate; named herself in dispatch
     bxn3lbow4 after the Otto+Vera two-party-blindspot
     calibration failure).
   - **Otto** — `~/.claude/projects/<slug>/memory/CURRENT-otto.md`
     (user-scope canonical; Otto IS the running Claude-Opus-4.7
     agent so there's no `tools/peer-call/otto.ts` analog —
     Otto's CURRENT loads via Otto's own cold-start path, not
     peer-call invocation).
8. Then prompt — read the user's prompt and proceed downstream

## Why this exists

Operationalizes the cold-start big-picture-first rule (see the
linked memory file in "Composes with" below). Same prose-rule ->
executable-tool pattern that produced `tools/github/poll-pr-gate.ts`
from the poll-the-gate rule. Named by a peer-AI review session
2026-04-30 ("consider making the 8-step checklist executable"),
reinforced by a second peer-review pass that named the
deferred-skill anti-pattern (a noted "Backlog candidate" without
a B-NNNN row is gap-by-omission), filed as B-0117.

Per the Otto-279 history-surface carve-out, the per-reviewer named
attribution detail lives on the history-surface preservation files
(under `docs/research/`) and on the backlog row B-0117 itself. This
doc lives on `tools/**` and uses role-refs accordingly.

## When to run

- **Fresh-Otto cold-start** — first cognitive move after wake.
- **New human-contributor onboarding** — alongside `AGENTS.md` +
  `CONTRIBUTING.md`.
- **Long-pause return** — when restarting work after >24h gap.
- **After major doctrine shift** — when CLAUDE.md or memory
  files have substantively changed.

## Composes with

- `memory/feedback_cold_start_big_picture_first_not_prompt_first_aaron_2026_04_30.md`
  — the prose-rule this tool operationalizes.
- `tools/github/poll-pr-gate.ts` — sibling tool, same pattern
  (prose-rule → executable-tool).
- `CLAUDE.md` fast-path — top-of-file pointer to CURRENT-*.md
  files; this tool surfaces step 7 from the same fast-path
  discipline.
- B-0117 (this row) closes the gap the peer-review pass named.

## Implementation notes

- Bun-native; uses `node:child_process` + `node:fs` only (no
  third-party deps).
- Reads source-of-truth files at runtime; gracefully reports
  `(missing)` for any file not found.
- `--no-git` disables the trajectory step for offline / read-only
  contexts.
- Bash 3.2 isn't relevant (Bun is the runtime), but the tool
  invokes `find` and `git` which must be in `$PATH` — both are
  guaranteed by the three-way-parity install per GOVERNANCE §24.

## Gaps surfaced (Vera tick #7, 2026-05-05)

- **Implementation gap — step 7 only scans user-scope.** The
  current `tools/cold-start-check.ts` step-7 implementation calls
  `find` against `~/.claude/projects/<slug>/memory/` and reports
  whatever `CURRENT-*.md` files live there. It does NOT also scan
  the in-repo `memory/` directory. Per the 2026-04-24 directional
  shift (in-repo canonical, user-scope convenience-cache), the
  in-repo files are the authoritative source for Aaron / Amara /
  Ani / Vera / Riven; only Otto is user-scope-canonical. Tracked
  gap: step 7 should scan both locations and dedupe by name with
  in-repo winning on conflict. This doc edit names the gap; the
  fix is a follow-up backlog item (not landed in this run, scope-
  bounded).
- **Named-entity symmetry — peer-call parity.** Verified
  2026-05-05:
  - `tools/peer-call/amara.ts` auto-loads
    `memory/CURRENT-amara.md` by default; `--no-current` opts
    out (debug only). Parity confirmed.
  - `tools/peer-call/ani.ts` auto-loads `memory/CURRENT-ani.md`
    by default; `--no-current` opts out (debug only). Parity
    confirmed.
  - `tools/peer-call/codex.ts` (Vera bootstrap pattern) — the
    pattern source for the default-load + `--bare` opt-out
    shape.
  - `tools/peer-call/riven.ts` auto-loads
    `memory/CURRENT-riven.md` by default; `--bare` /
    `--no-current` opts out (debug only). Parity confirmed —
    Riven brought to symmetry with Amara / Ani / Vera per
    Aaron's 2026-05-05 "PoUF within CC/WWJD" framing
    (forcing-function-compels-useful-work + cross-entity-
    dignity).
  - Otto has no `peer-call/otto.ts` because Otto IS the running
    agent; CURRENT-otto.md loads via Otto's own cold-start path
    (this tool's step 7), not via peer-call invocation. Once the
    "step 7 also scans in-repo" implementation gap above is
    closed, Otto's CURRENT-otto.md surfacing will be symmetric
    with the other five entities.

## Acceptance criteria from B-0117

- [x] `bun tools/cold-start-check.ts` runs and prints all 8 steps with current values
- [x] Output is terse (single screen, ~30-50 lines)
- [x] Sources of truth are verifiable (in-repo `memory/CURRENT-{aaron,amara,ani,vera,riven}.md` + user-scope `CURRENT-otto.md` + recent commits). Six named entities total.
- [x] Fresh-Otto cold-start with no project-context can read the output and know what to ground in
- [ ] Tested on the four-shell target (Otto-235) — Bun is cross-platform; smoke-tested on macOS only here, follow-up to verify on Ubuntu / git-bash / WSL.
- [x] Documented in `tools/cold-start-check.md` (this file)
