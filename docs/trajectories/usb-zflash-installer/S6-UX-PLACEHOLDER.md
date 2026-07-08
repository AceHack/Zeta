# S6 — first-login UX co-design draft

Status: paper/mock review **accepted** (Aaron 2026-07-08) — still not signed off
for physical boot (S6 remains human-gated)
Last refreshed: 2026-07-08
Parent: [FIRST-SESSION.md](./FIRST-SESSION.md)

## Purpose

Slice 4 (QEMU phase-3 serial proof) is green on main. **S6** is the human
first-login experience: menu copy, pacing, and feel on physical metal. This
draft makes the copy concrete enough to review and wire into the TypeScript
first-session conductor, but it does **not** claim physical boot is done and it
does **not** clear S6.

## Related substrate (Otto / observe arc)

| Surface | Role |
|---------|------|
| `src/Core.TypeScript/observe/first-session.ts` | Menu oracle + setup loop (implementation) |
| `src/Core.TypeScript/observe/first-session-run.ts` | Post-login CLI conductor |
| `docs/research/2026-06-07-tensor-capability-vector-is-the-build-compass-first-ray-trace-proof-amara.md` | Capability-vector / “physics engine” north star (conceptual; Otto ferry) |
| `memory/ani/conversations/2026-05-22-aaron-ani-grok-text-mode-pt3-fpga-landauer-limit-physics-grounding-*.md` | Landauer / FPGA physics-engineering pathway notes |

The physics-engine work is **orthogonal** to S6 copy — it informs observe’s
long-horizon capability model; S6 only needs menu strings, flow order, and
operator-facing tone.

## Binding decisions (Aaron 2026-07-08)

1. **Wording does not matter yet.** Pick whatever gets the point across; iterate.
   Prefer plain language over "adventure" framing. Tech-nerd precision is not the
   optimization target.
2. **Local is the default after GitHub.** Optional cloud helpers appear **only
   after** the operator asks for cloud setup (`offer_cloud_helpers`). Do not dump
   Claude / Codex / Gemini on the first screen.
3. **Audience:** feel like a regular-person tool — optimize for non-tech (often
   neurodivergent) minds that work well with AI even when they do not have
   traditional tech skills. Tone lives in the screen itself, not only in a
   hidden style guide.
4. **GitHub is required for now** as the **first target** for cluster join /
   self-register. It is **not** the only future provider: other clouds and a
   true local-only path are planned; do not hard-code "GitHub forever" into the
   product story — only into today's first-boot path.
5. **Paper/mock flow accepted** (Aaron 2026-07-08 evening): GitHub → local → done
   is the happy path; cloud only after ask. One small add: if they **skip GitHub**,
   tell them how to continue later (local console or SSH) so they are not stuck.
6. **Longer-term surface (not S6 exit criteria):** eventually boot into our own
   UI/UX, not just the command line — **desktop app first** (over NixOS), then
   eventually our **microkernel** for everything. CLI first-login is the current
   substrate; the interaction contract should stay portable to that UI later.

## Draft interaction contract

The first-login screen should read as a short setup helper. Primary labels use
plain language; short tool names stay secondary.

### Proposed menu labels (post-decision)

| When | Action | Primary label |
|------|--------|---------------|
| Start | Set up GitHub | Set up GitHub sign-in — needed so this computer can join the cluster |
| Start | Skip GitHub | Skip GitHub for now — finish later on this computer (local) or over SSH |
| After GitHub | Stay local (default) | Stay on this computer (local) — recommended |
| After GitHub | Ask for cloud | Show optional cloud helpers |
| After GitHub | Finish | Finish first login |
| After ask-cloud | Per-vendor setup / skip | Claude / Codex / Gemini (optional) |
| After ask-cloud | Skip all cloud | Skip all optional cloud helpers; stay local |

### Default path

1. Set up GitHub sign-in (`gh`) — first target today.
2. Stay local (recommended).
3. Done.

Cloud helpers are a deliberate second beat, not part of the happy path.

### Skip-GitHub continue-later (required copy)

If the operator skips GitHub, the menu reason **and** a short post-choice note
must say they can finish later:

- on this computer (local console / re-run first-login helper), or
- over SSH, then join the cluster once GitHub is ready.

Do not leave "skipped" as a dead end with no next step.

### Tone (on-screen)

Speak like a calm helper for a regular person:

- Short sentences.
- No shame if someone skips.
- "This computer" / "join the cluster" over jargon when possible.
- Secondary `(gh)` / hat names only where a scanner who already knows the stack
  benefits.

### LLM chooser vs numbered menu

Numbered menu remains the default on first physical boot. Offer the LLM chooser
only with explicit `--llm` (or a later signed-off review). Same action list;
model failure falls back to the oracle recommendation.

## Exit criteria (before signing off S6)

- [x] Open questions answered by operator (2026-07-08)
- [x] Copy reviewed on paper / mock terminal with operator (flow accepted; skip-gh
  continue-later added)
- [ ] Physical boot on one cluster node — no QEMU-only proof (operator: not ready yet)
- [ ] Paper review notes incorporated or explicitly rejected (skip-gh note landed;
  further tweaks welcome)
- [ ] RESUME.md blocker cleared (after physical boot)

## Longer-term (out of S6 scope — track, do not block)

1. Desktop app UI/UX over NixOS (first non-CLI surface).
2. Eventually microkernel-native UI for everything.
3. Keep first-login **interaction contract** (gh-first today, local default, cloud
   after ask, skip-with-continue-later) portable across CLI → desktop → microkernel.

## Society validation

S6 remains **tier S6** in [FIRST-SESSION.md](./FIRST-SESSION.md) — human gate,
not a PR block. CI keeps phase-3 serial markers on scenario 2 push.

Paper/mock review accepted the flow. Physical boot remains the remaining S6 gate.
