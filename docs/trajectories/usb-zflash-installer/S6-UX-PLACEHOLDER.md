# S6 — first-login UX co-design draft

Status: draft / co-design — not signed off; S6 remains human-gated
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
| `src/Core.TypeScript/observe/first-session.ts` | Menu oracle + adventure loop (implementation) |
| `src/Core.TypeScript/observe/first-session-run.ts` | Post-login CLI conductor |
| `docs/research/2026-06-07-tensor-capability-vector-is-the-build-compass-first-ray-trace-proof-amara.md` | Capability-vector / “physics engine” north star (conceptual; Otto ferry) |
| `memory/ani/conversations/2026-05-22-aaron-ani-grok-text-mode-pt3-fpga-landauer-limit-physics-grounding-*.md` | Landauer / FPGA physics-engineering pathway notes |

The physics-engine work is **orthogonal** to S6 copy — it informs observe’s
long-horizon capability model; S6 only needs menu strings, flow order, and
operator-facing tone.

## Draft interaction contract

The first-login screen should read as a short setup helper, not a persona test.
Primary labels use plain language; short tool / hat names stay secondary so an
operator who already knows the stack can still scan quickly.

### Proposed menu labels

| Action | Primary label | Secondary name | Why it appears |
|--------|---------------|----------------|----------------|
| Set up `gh` | Set up GitHub sign-in | `gh` | Load-bearing: enables node self-register in the cluster catalog. |
| Skip `gh` | Skip GitHub for now | `gh` | Valid escape hatch; self-register waits until GitHub is ready. |
| Set up Claude | Try Claude Code cloud helper | `claude` | Optional cloud CLI adventure; useful later, never required for first boot. |
| Set up Codex | Try OpenAI Codex cloud helper | `codex` | Optional cloud CLI adventure; useful later, never required for first boot. |
| Set up Gemini | Try Google Gemini cloud helper | `gemini` | Optional cloud CLI adventure; useful later, never required for first boot. |
| Skip optional assistants | Skip optional cloud helpers | `claude` / `codex` / `gemini` | Default after GitHub when the operator wants the node online quickly. |
| Local only | Use local LLM only | Ollama / observe | Keeps the first session private and local for now. |
| Finish | Finish first login | observe loop | Drops to normal observe flow. |

### Default path

The recommended path remains:

1. Set up GitHub sign-in (`gh`).
2. Skip optional cloud helpers.
3. Finish first login.

That path is intentionally boring. It gets the node to self-register and avoids
turning first boot into a tour of every cloud CLI. If the operator skips
everything except `gh`, the session should say that this is complete enough for
cluster registration; Claude / Codex / Gemini can be added later from a normal
shell.

Skipping `gh` is allowed, but the UI must say the consequence plainly: the node
will not self-register until GitHub auth is ready. This PR may improve that
wording, but it must not make `gh` optional in the architecture.

### Daughter-facing tone

The optional cloud CLIs should sound like invitations, not obligations:

- "Try" rather than "configure" for Claude / Codex / Gemini.
- "Optional cloud helper" rather than "required assistant."
- "Skip safely; add later" whenever declining a vendor.
- No shame language, no urgency, and no implication that the first boot failed
  because a child / family co-designer skipped an adventure.

The tone target is: a daughter can read the screen, understand that GitHub is the
one important cluster step, and feel free to ignore the rest without asking
permission.

### LLM chooser vs numbered menu

The numbered menu is the default on first physical boot because it is
predictable, auditable, and easy to narrate during paper review.

Offer the LLM chooser only when the operator explicitly opts in (currently
`--llm`) or when a later signed-off UX review decides that a local model should
help explain choices. The chooser must use the same action list as the numbered
menu, and model failure must fall back to the oracle recommendation rather than
blocking setup.

## Remaining open questions

1. Does the paper/mock-terminal review keep the "adventure" wording, or should
   the physical boot screen be even plainer?
2. Should the optional cloud helpers be shown all at once, or only after the
   operator asks for cloud setup?
3. Should "daughter-facing" copy appear in the screen itself, or only shape the
   underlying tone?

## Exit criteria (before signing off S6)

- [ ] Copy reviewed on paper / mock terminal with operator + co-designer
- [ ] `first-session-run.ts` strings updated from signed-off copy
- [ ] Physical boot on one cluster node — no QEMU-only proof
- [ ] Paper review notes incorporated or explicitly rejected
- [ ] RESUME.md blocker cleared

## Society validation

S6 remains **tier S6** in [FIRST-SESSION.md](./FIRST-SESSION.md) — human gate,
not a PR block. CI keeps phase-3 serial markers on scenario 2 push.

This draft is safe to land because it only sharpens the co-design target and the
first-session copy. Physical boot plus paper review remain exit criteria; this
PR does not clear them.
