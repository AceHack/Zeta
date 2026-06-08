# CHIP-8 as a first-class toolchain: Octo built from source, declaratively managed by ace

*Captured 2026-06-08 from Aaron's direction (shadow*). A spec to route to Dejan (devops / the one install script,
GOVERNANCE §24) and the **ace** repo owner (the TS package manager). Otto does not own `install.sh` or ace — this
is the design + routing, not a unilateral change.*

## Aaron's direction

> "I like having the source and the tools to build chip-8 from source as part of our toolchain and managed by the
> ace package manager declaratively … this way we support chip8 as easily as we support our 4 langs — our
> install.sh just sets it up."
>
> Plus (fairness): "people will think we cheated if we make the game and do the learning — better to use someone
> else's game for the *appearance of fairness*; writing our own for *testing* is fine."

## Why this is the right shape

A from-source CHIP-8 build toolchain (the **Octo** assembler: `.8o` → `.ch8`) turns the **chip8Archive** (CC0,
source-only `.8o`) into buildable, *legitimately third-party* games — which is exactly what the learning demo
needs for credibility (we don't author the game we learn on). It also makes CHIP-8 a first-class target handled
the same way as the four language oracles: declared once, bootstrapped by `install.sh`, reproducible.

## Components (proposed, to be owned by Dejan + ace)

1. **Octo as a managed tool dependency (ace, declarative).** Octo is **MIT** (John Earnest,
   `github.com/JohnEarnest/Octo`); there's a CLI (`octo-cli`, Node) that compiles `.8o` → `.ch8`. Declare it in
   ace's tool manifest like any pinned toolchain dep (version-pinned, hash-checked) — the same posture as the
   4-lang toolchains.
2. **`install.sh` bootstraps it** (Dejan, GOVERNANCE §24 — the one install script, consumed by dev laptops / CI /
   devcontainer). After install, `octo-cli` (or a vendored build) is on PATH so `.8o` builds work everywhere.
3. **Sources to prior-art** (`references/prior-art/`, reference-not-copy): the Octo source (MIT) and the
   chip8Archive (CC0). A build step compiles the CC0 `.8o` games → `.ch8` *on demand* (not committed binaries —
   built artifacts, like the 4-lang build outputs).
4. **Provenance/signatures**: built `.ch8` games get a `MANIFEST`-style signature row (sha256+crc32, the
   No-Intro/Redump/TOSEC convention already adopted in `roms/chip8/MANIFEST.md`) so a built game is reproducible
   and tamper-evident.

## Split of concerns (so it lands cleanly)

- **Test fixtures** (DONE, #7112): authored-by-us CC0 ROMs + Mikolay MIT — for unit tests. Our own is fine here.
- **Learning-demo games** (this spec): third-party CC0 (chip8Archive) built from source via the Octo toolchain —
  for fairness. Distinct purpose, distinct provenance.

## Open questions for Dejan / ace

- Vendor a pinned Octo build vs. `npm`-install `octo-cli` at bootstrap? (CI determinism + offline = lean vendored.)
- Where do built games live — `roms/chip8/built/` (gitignored, built by install/CI) with only signatures committed?
- ace cross-repo: ace is the separate TS repo; the declaration lives there, `install.sh` consumes it.

## Pointers

- `roms/chip8/` (#7112) — the committed test-fixture precedent + signature manifest convention.
- `docs/PRIOR-ART-LIST.md` — ROM-DB tools + chip8Archive (CC0) anchors.
- GOVERNANCE §24 (one install script, Dejan) · §23 (upstream-contribution workflow).
