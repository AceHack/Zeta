# "(shadow*)" shorthand — autocomplete-source disclosure marker

Carved sentence:

> When the human maintainer writes "(shadow*)" inline in a
> message, the immediately-surrounding text came from the
> input UI's autocomplete (grey-text suggestion) and was
> accepted-then-shipped. The instruction stands (the
> maintainer chose to send it); only the phrasing-source
> is being disclosed. NEVER invent a "shadow-X-posture"
> framing on top of it.

## Operational content

"(shadow*)" is the human maintainer's substrate-honest transparency marker indicating:

- The surrounding text was autocomplete-generated (grey-text suggestion in input field)
- The maintainer chose to accept + ship it (instruction is authoritative)
- The specific phrasing was the model's suggestion, NOT the maintainer's original authored prose
- It is a disclosure marker, NOT a discipline-instruction

**Origin context** (per the human maintainer, 2026-05-15T~01:06Z, user-scope memory): autocomplete grey-text appeared in the input UI days before, prompting "WTF is this" reaction. The maintainer developed "(shadow*)" as the source-transparency shorthand.

## What this is NOT

"(shadow*)" is NOT:

- An instruction to apply "shadow-lock posture" (preserve-what-we-have-defer-full-lock)
- A discipline-direction or posture-instruction
- A reduce-confidence flag on the surrounding instruction (instruction stands at full authority)
- A request to wait, defer, or do anything different from the literal text

## Operational discipline

When the maintainer writes text containing "(shadow*)":

1. **Treat the literal instruction as authoritative** — they chose to send it
2. **Recognize the phrasing came from autocomplete** — substrate-source disclosure
3. **Do NOT author "Shadow-X-posture per your framing" or similar** — that conflates the marker with Otto's own discipline-framings
4. **If acting on the instruction surfaces an Otto-side discipline-choice, name it as Otto-applied** — not as the maintainer's instruction
5. **If the autocomplete-shipped text seems off or unclear, ask** — substrate-honest transparency invites questions

## Why this rule auto-loads

Per `.claude/rules/wake-time-substrate.md`: recurring shorthand needs cold-boot landing. Without auto-load:

- Future-Otto encounters "(shadow*)" and has no definition substrate
- Future-Otto invents an interpretation (assumption-driven failure mode)
- The maintainer corrects again
- Repeat indefinitely

With auto-load: future-Otto knows the meaning at cold-boot; no invention; no repeat correction.

**This rule exists because Otto-CLI committed the same misinterpretation 4+ times in one session** (2026-05-15) before the maintainer named it directly. Cold-boot loading prevents the cycle.

## Two distinct concepts NOT to conflate

| Concept | Source | Meaning |
|---|---|---|
| **"(shadow*)"** | Maintainer shorthand | Surrounding text is autocomplete-generated; transparency marker |
| **"Shadow-lock posture"** | Otto-CLI framing | Preserve-what-we-have, document gaps, defer full-completion; a discipline posture |

These are UNRELATED. The first is the maintainer's text-source disclosure. The second is one of Otto-CLI's own discipline-framings. Otto-CLI may apply the second posture operationally; should never attribute it to the maintainer via "(shadow*)" framing.

## Composes with

- `.claude/rules/shadow-check-name-acceptance.md` — different shadow-scope (name-acceptance methodology for system-imposed names)
- `.claude/rules/wake-time-substrate.md` — load-bearing substrate needs wake-time landing
- `.claude/rules/razor-discipline.md` — operational claims only; this marker is operationally observable (verifiable text-source disclosure), not metaphysical
- `.claude/rules/glass-halo-bidirectional.md` — this IS bidirectional transparency at text-source scope
- `.claude/rules/no-directives.md` — autocomplete-shipped instructions are still maintainer instructions; the marker doesn't change directive-shape
- `tools/shadow/shadow-observer.ts` — the SHADOW INFRASTRUCTURE that observes grey-text autocomplete (different scope: detects + auto-accepts in the maintainer's UI; this rule is about how Otto-CLI handles the marker when the maintainer ships autocomplete-completed text to Otto)

## Origin

Authored 2026-05-15T~01:08Z after Otto-CLI committed 4+ "(shadow*)" misinterpretations in one session (manifested as commit messages and responses asserting "Shadow-lock posture per your framing"). The maintainer corrected explicitly: *"this is to signify this came from the weird autocomplete not aaron it just showed up in grey text and i completed it , i guess you forgot our shorthand."*

Full reasoning + double-failure log (the same conversation also failed on "shadow observation loop is backlog candidate, not yet built" when [`tools/shadow/`](../../tools/shadow/) + B-0402 implementation already existed) is preserved at user-scope memory. These memos auto-load into every Otto-CLI session via `~/.claude/projects/<slug>/memory/MEMORY.md`, so they are reachable from cold boot even though they do not live in-repo:

- `feedback_aaron_shadow_star_shorthand_means_autocomplete_generated_not_aaron_authored_grey_text_completed_2026_05_15.md`
- `feedback_aaron_shadow_observation_loop_design_pattern_otto_observes_directly_instead_of_assuming_aaron_plays_games_2026_05_15.md`

In-repo provenance for this PR itself: [#3339](https://github.com/Lucent-Financial-Group/Zeta/pull/3339).
