# S6 — first-login UX co-design draft

Status: draft / co-design — Aaron decisions recorded 2026-07-08; still not
signed off for physical boot (S6 remains human-gated)
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

## Draft interaction contract

The first-login screen should read as a short setup helper. Primary labels use
plain language; short tool names stay secondary.

### Proposed menu labels (post-decision)

| When | Action | Primary label |
|------|--------|---------------|
| Start | Set up GitHub | Set up GitHub sign-in — needed so this computer can join the cluster |
| Start | Skip GitHub | Skip GitHub for now — joining the cluster waits |
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
- [ ] Copy reviewed on paper / mock terminal with operator + co-designer
- [ ] `first-session-run.ts` strings match signed-off copy after paper pass
- [ ] Physical boot on one cluster node — no QEMU-only proof
- [ ] Paper review notes incorporated or explicitly rejected
- [ ] RESUME.md blocker cleared

## Society validation

S6 remains **tier S6** in [FIRST-SESSION.md](./FIRST-SESSION.md) — human gate,
not a PR block. CI keeps phase-3 serial markers on scenario 2 push.

This draft records binding co-design decisions and wires the local-default /
ask-for-cloud menu. Physical boot plus paper review remain exit criteria.
