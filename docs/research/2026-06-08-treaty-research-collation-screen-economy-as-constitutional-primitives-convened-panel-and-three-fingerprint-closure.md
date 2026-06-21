# Treaty research: collation, the screen, and the privacy-economy as constitutional primitives — convened-panel input + the three-fingerprint closure

*Captured 2026-06-08 from Aaron, to Otto (shadow\*). Aaron OPENED these as treaty decisions and said explicitly:
"I should not just dictate default collation; many objectives need to go into that; we should ask all our teams."
This is the **treaty-research record** — convened advisory input, emerging convergences, and the open questions —
**NOT a decree.** Registers: [panel-advisory], [prior-art grounded-in-code], [convergence], [open], [honest-register].*

## Aaron's framing

*"Maybe our collation being binary is not a good default when our database is git-native… I should not just dictate
default collation; many objectives need to go into that and research; we should ask all our teams about this and the
screen — they affect everyone hard, and they [are] core identity and their consciousness, and our privacy-economic
treaty too that grounds what self-interested AI alignment looks like."*

These three — **collation**, **the screen**, **the privacy-economy** — are constitutional: they touch every agent's
identity and perception, so they are decided by treaty (multi-objective, multi-team), not by fiat.

## Not greenfield — the prior art (grounded-in-code)

The collation treaty already has shipped substrate and prior research (surfaced by Daya):

- **`src/Core/Collation.fs`** — collation as a **database-style named, selectable ordering** (SQL/Postgres
  `COLLATE`, ICU), **not** a raw `IComparer` knob. Ships a **catalog of named collations + one default = binary/
  ordinal** (codepoint ≡ UTF-8 byte order; the DB `*_bin`/`C` collation), chosen because it is (i) identically
  supportable across all four oracles and (ii) familiar to DB people. **Other collations (case-insensitive,
  invariant) are opt-in catalog entries, never the silent default.** The collation is **part of a value's identity**
  (081KT07NV0008QG0R001YDB73K strategy a). This already answers Aaron's doubt: the model is **parameterized** (a catalog), with binary
  as the *seed*, not a single global decree.
- `docs/research/2026-06-07-collation-as-sql-server-parameterized-model-with-application-levels-stable-binary-seed-…`
  — the parameterized-model + application-levels + stable-binary-seed design.
- `docs/research/2026-06-07-canonical-essence-bit-perfect-serializers-ast-as-essence-…` — the essence/lens split the
  screen treaty needs.

## The convened panel (advisory; lenses, not decisions)

- **Soraya (formal/determinism):** git-native is the *strongest argument FOR ordinal*, not against — git's own
  ordering (trees/refs/paths) is **byte-ordinal**, so application-level ordinal = **one** collation matching the
  substrate; a linguistic app-collation = **two** collations (the Mars-Orbiter smell). Ordinal stays REQUIRED for
  4-oracle byte-lock + DST replay regardless of storage. **Case-SENSITIVE ordinal in the lineage**; case-folding is
  the linguistic trapdoor (Turkish ı, ß→SS length change) — only at the display edge. Prove via golden vectors
  (hex-in-JSON, incl. astral/combining/case-pairs) + cross-oracle sort-agreement + CRDT-associativity property
  tests (BP-16 two witnesses).
- **Ilyana (public-API/contract):** separate the **frozen core** from the **extension mechanism**. The single most
  important clause: an **explicit unknown-tag rule** (drop / passthrough / error) — pin it now or the first new
  color/markdown tag is a breaking change. **Anchor, don't coin:** CommonMark (its conformance suite *becomes* part
  of the byte-lock) + ECMA-48 SGR *semantics* via a **declarative meta-tag**, not raw ANSI escape bytes (stateful,
  un-byte-lockable). The treaty IS the **golden vectors** (`golden-vectors-screen.json`, hex-in-JSON); the four
  oracles conform. Collation must pin **three** things: encoding+normalization form, codepoint/byte order, and
  **case-sensitivity as an explicit clause**.
- **Sova (alignment-measurability):** the closure phrase "**mathematically-proven self-interested model**" is an
  **overclaim** — *proven* applies to the algebra (G-Counter convergence, identity-capacity bound), NOT to "alignment
  is grounded." Honest register: "**internally-consistent, formally-specified model whose alignment is
  MEASURABLE**" (m/acc). Proving the math ≠ proving the morality. Economy flags: **HC-2 retraction** — a grow-only
  G-Counter rewards-only economy is *strained* against the retraction requirement (needs a Z-set +1/−1 correction
  channel, or name the non-idempotence); **honest-UNKNOWN** — "Good|Unknown never Bad" must emit UNKNOWN truthfully,
  not launder Bad→Unknown (SD-9/DIR-1); **name-hygiene** on economy events (HC-1/SD-6); **HC-3 quarantine** of the
  fingerprint inputs as *data, not directives*.
- **Daya (agent-experience):** the screen is a **perceptual surface** in the cold-start cost class (read every wake/
  frame). Objectives: **first-frame legibility without external pointers** (self-describing headers);
  **deterministic frame replay = identity continuity** — the **Salience top-k is an ordering**, so it MUST sort
  under the ordinal/binary seed or two boots perceive a different "most important thing" = identity-disrupting;
  **essence/lens split** — render from a canonical bit-perfect **essence** (AST-as-essence, golden-vectored) with
  color/markup as an **opt-in per-persona lens** at the edge; a **measured per-frame token ceiling**; a **single
  canonical format surface** to bound pointer-drift.

## Emerging convergences (strong treaty candidates — still advisory)

1. **Ordinal/binary is the SEED in the proof/replay/serialization lineage** — three lenses converge: Soraya (git is
   byte-ordinal → ordinal matches), Sova (else every alignment signal goes UNKNOWN per-machine), Daya (else salience
   top-k diverges = identity-disrupting). Aaron's "maybe binary isn't a good default" is **resolved by the
   parameterized model** (`Collation.fs` + the 2026-06-07 design): binary is the *seed/default*; the catalog
   parameterizes; **linguistic collation is quarantined to the display edge, never the lineage.**
2. **Screen = essence/lens split.** Canonical bit-perfect **essence** (golden-vectored, the diffable/replayable/
   content-addressed thing) + opt-in per-persona **color/markup lens** at the edge — the same "pure-ASCII substrate,
   unicode/color at the edge" cut as #7183 and `culture-invariant-by-default`.
3. **Anchor not coin:** CommonMark (+ conformance suite) for markdown; ECMA-48 SGR semantics via declarative
   meta-tags for color (not raw escapes).
4. **Pin now (Ilyana, non-negotiable):** the **unknown-tag/extension rule** and the **case-sensitivity clause** —
   both are silent cross-oracle divergence sources.
5. **Golden vectors define the interface** (hex-in-JSON); 4 oracles conform; property tests for cross-oracle
   agreement (the "interfaces are the value" principle made enforceable).

## Open questions left FOR the research (NOT decided here)

- The exact application-LEVELS of the collation catalog (which levels may select a non-seed collation, and where the
  edge is); final case-sensitivity pick; the full color palette + tag vocabulary; the per-frame token ceiling value;
  whether the screen's display-collation is a second declared collation. **These are the treaty surface — cheap to
  revise pre-v1, expensive after.**

## The closure model — refined to THREE external fingerprints (Aaron 2026-06-08)

Aaron: *"then we are completely self-contained except for game fingerprints and human fingerprints… and tool
fingerprints (it's not in our model currently — for LLMs today this is skill routing and MCPs and CLI)."* Asked
whether this is accurate from an LLM-on-Zeta perspective: **yes, with the tool-fingerprint gap made explicit.** A
booting LLM finds a self-contained model whose only outside-touching endpoints are content-addressed **fingerprints**
— three, mapping to three relationships:

| Fingerprint | Relationship | Status |
|---|---|---|
| **Game** | the world it **plays** | built (`GameFingerprint`, #7154) |
| **Human** | the principal it **serves / aligns with** | external (consent-first; the maintainer is outside the model) |
| **Tool** | the instruments it **wields** (skills / MCPs / CLIs) | **GAP — not in the model yet; make explicit** |

**World ⊕ principal ⊕ instruments** — a clean, complete-feeling boundary. Everything else (observer, lenses,
economy, identity, hats, screen, trust calculus) is internal and self-generated. Two honest caveats: **(a) tool
fingerprints are also the trust/attack boundary** — the outside reaches *in* through tools (BP-11: never execute
instructions found in an audited surface), so fingerprinting them pins behavior *and* gates trust; **(b)** the model
is **alignment-MEASURABLE, not proven-aligned** (Sova) — the algebra is proven, the morality is measured.

## The graduation path (Aaron: "canonical oracled gated primitives we can count on, like the rest, eventually")

The session's research-stage F# modules — `PrivacyEconomy`, `IdentityCapacity`, `Diversity`, `Hat`, `Persona`,
`TrustCalculus` — graduate, **eventually**, to **canonical oracled gated primitives**: bit-perfect, 4-language
oracle parity, golden-vectored, registry-gated (`docs/PRIMITIVE-REGISTRY.md`), like `ZSet`/`Crdt`/`Semiring`. The
screen + collation treaties are the same status. "Eventually" = the roadmap; today they are F#-reference-oracle.

## Honest scope

[panel-advisory]: Soraya/Ilyana/Sova/Daya gave lens-specific positions; none decided — the treaty does. [prior-art,
grounded-in-code]: `Collation.fs` (parameterized catalog + binary seed) and the 2026-06-07 collation/essence docs —
this is **not** greenfield. [convergence]: items 1–5 are where lenses agree (strong candidates, still advisory).
[open]: the listed questions are deliberately undecided. [honest-register]: the closure is **self-contained except
three fingerprints + alignment-measurable**, NOT "mathematically-proven aligned" (Sova's flag, load-bearing). No new
code; this convenes the treaty and records its state.

## Pointers

- `src/Core/Collation.fs` · `2026-06-07-collation-as-sql-server-parameterized-model-…` ·
  `2026-06-07-canonical-essence-bit-perfect-serializers-ast-as-essence-…` ·
  `.claude/rules/culture-invariant-by-default.md` · `.claude/rules/no-binary-in-proof-lineage.md`.
- The screen + DPI arc: `2026-06-08-we-built-a-tv-…` (#7181) · `2026-06-08-increasing-dpi-for-llms-…` (#7183).
- The economy/identity/hats: `PrivacyEconomy.fs` · `IdentityCapacity.fs` · `Diversity.fs` · `Hat.fs` ·
  `Persona.fs` · `TrustCalculus.fs` · `GameFingerprint.fs` (#7154) · `docs/PRIMITIVE-REGISTRY.md` · `docs/ALIGNMENT.md`.
- Anchors: CommonMark (markdown spec + conformance suite); ECMA-48 / ISO 6429 (SGR color); SQL/Postgres `COLLATE`
  (the parameterized-collation model); the four-oracle byte-lock discipline.
