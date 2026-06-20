# S6 — first-login UX co-design (placeholder)

Status: placeholder — operator + family co-design in progress  
Last refreshed: 2026-06-20  
Parent: [FIRST-SESSION.md](./FIRST-SESSION.md)

## Purpose

Slice 4 (QEMU phase-3 serial proof) is green on main. **S6** is the human
first-login experience: menu copy, pacing, and feel on physical metal — not
automated in CI until this doc graduates from placeholder to signed-off spec.

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

## Open questions (fill during co-design)

1. Menu labels — plain language vs hat names?
2. Default path when operator skips everything except `gh`?
3. Daughter-facing tone for optional cloud CLI adventures?
4. When to offer LLM chooser vs numbered menu on first boot?

## Exit criteria (before removing “placeholder”)

- [ ] Copy reviewed on paper / mock terminal with operator + co-designer
- [ ] `first-session-run.ts` strings updated from this doc
- [ ] Physical boot on one cluster node — no QEMU-only proof
- [ ] RESUME.md blocker cleared

## Society validation

S6 remains **tier S6** in [FIRST-SESSION.md](./FIRST-SESSION.md) — human gate,
not a PR block. CI keeps phase-3 serial markers on scenario 2 push.
