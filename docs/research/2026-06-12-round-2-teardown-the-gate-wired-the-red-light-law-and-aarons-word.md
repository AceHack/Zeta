# Round 2 tear-down — the gate wired, the red-light law, and Aaron's word

Aaron called round 2; Kira (render/format layer, 15 findings, 3 P0) and the silent-failure hunter
(io/resolution paths) ran in parallel. Everything fixed or filed; the law that emerged is bigger
than the bugs.

## THE RED-LIGHT LAW (Aaron, verbatim, staked on his word)

> "We never record agents — AI, human, or otherwise — without knowledge. Imagine a visible red
> light on any mic. Consent-first design. This is the same for how we do logging, even chat
> logging — the agent should always know if they are really private or not, **and who's
> listening. No secrets in that area. Or else I'm not a man of my word.**"

Made code the same hour: `MediaLines.bindingsReport` + `bindingLight` — every io binding of a
cartridge visible in one glance form: `[REC ●]` for Live/Adapted/Injected (the mic is real and
on; Adapted names the piece and the source), `[off ○]` for Mock ("rehearsal — nothing real is
heard"). The silent-failure hunter had found Mock bindings had no audience — an all-Mock load was
indistinguishable from all-Live to any non-inspecting caller. The report is the audience. The
standing rule: a recording-capable binding without its light shown is a consent violation, not a
style choice (manifesto §6); and the same law governs logging and chat surfaces — an agent's
privacy state and audience list are never secrets. Applies to ME first: ferries, memory files,
research captures are all visible-by-construction (PRs on main); the local-memory split for
personal content is the same law from the other side.

## The hunter's CRITICAL: the HARD GATE gated nothing — NOW WIRED

`accepted` ran only in tests; `zeta shape render` happily rendered failing cartridges. Now:
render REFUSES a gate-failing cartridge (exit 3, failing verdicts on stderr); `zeta shape accept`
runs the gate standalone (all verdicts, exit 0/3). Advisory-while-sounding-mandatory, ended.

## Kira's P0s, all closed

1. **HTML/SVG injection via meta name** — `escapeXml` at both sinks; the hostile-name test
   proves the payload arrives escaped, not live.
2. **fromSvg crashed instead of refusing** — total now (TryParse everywhere); exponents, garbage,
   overflow, `<SCRIPT>` case-tricks, single-quoted dasharray, one-line element smuggling: all
   REFUSALS, all tested.
3. **Delegation-to-nowhere ratified on faith** — tool allowlist + the `Delegated` status (a
   delegation neither vouches nor blocks; an unknown tool FAILS the law).

## The P1/P2 batch

Renderer word-parse guards (drawn-vs-gated parity — invalid words draw nothing instead of
crashing); ONE shared constant reader (`MediaLines.constIntOr`) for gate and renderer (the
1025/1100 default divergence class, dead); lightcone extent bound; bytes-register evidence now
states it is ATTESTATION (the proof is THE GOLDEN LOCK in CI); checked law arithmetic (overflow
is a refusal, never a wrap); hex-payload lint (odd length = silent corruption, refused upstream);
near-miss kind lint (a typo'd "constent" is a finding, not a silently-carried kind); per-stroke
animation dash lengths (long polylines finish drawing); granted capabilities count as adapter
sources (the ladder's missing rung); CLI missing-file handling. Filed not fixed: checkpoint
corrupt-vs-missing signal, durability flagging claim, idOf hash-lane correlation (ids are pinned
in files — changing the hash is a treaty-wide migration, not a patch) — BUGS.md entries.

## Pointers

- `tools/zeta-cli` (accept + wired render) · `MediaLines` (red light, constIntOr, new lints) ·
  `ShapeRender` (escapeXml, total fromSvg) · `CartridgeLaw` (Delegated, allowlist, Checked) ·
  the six round-2 regression gates in ShapeAcceptance.Tests.fs
