---
id: 081M0QRP9MW087G0R003P83T6D
type: task
state: backlog
priority: P2
slug: arc-rung-d-recorded-session-replay-in-the-twitch-ai-arena-ar
title: "ARC rung D - recorded-session replay in the twitch-ai arena: ARC on the published page, offline, no key, no third-party request"
created: 2026-08-23T16:54:03.676Z
depends_on: ["081M0QRP9JY087G0R00146V04J"]
composes_with: []
---

# ARC rung D - recorded-session replay in the twitch-ai arena: ARC on the published page, offline, no key, no third-party request

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QRP9MW087G0R003P83T6D-*.md` glob. -->

**Register: `proposed`.** Design: `docs/design/2026-08-23-arc-agi-3-integration-design-chip8-chip9-atari-and-the-arena.md` §3.1.

The arena is a static Vite app on GitHub Pages. It cannot reach a visitor's `localhost`, and per the
Lior handoff §B4 the page must stay self-contained (no CDN, no third-party request — the Google
Fonts `<link>` the handoff flagged at `src/apps/twitch-ai/index.html:7` has since been removed;
checked at `6b3b739d2`, no `fonts.googleapis` reference remains).

So the published surface **replays a recorded ARC session from a committed JSON artifact** — exactly
the shape that makes `db/emus/chip8/orbits/*.orbit.json` drawable with no runtime. No network, no
key. Because `ArcEnvelope` is text by construction (rung B), a recording IS a golden vector and this
falls out nearly free.

Interaction stays in the local dev lane; the public page shows a true replay and says so.
