# `roms/chip8/` — committed CHIP-8 test-fixture signatures

Signature manifest for the committed CHIP-8 ROMs (the unit-test fixtures). **Signatures are text (hex), diffable,
DST-replayable, human-auditable** — the same discipline as the golden vectors (`no-binary-in-proof-lineage`):
a ROM's bytes are binary (a non-verification test *input*, allowed), but its *signature* is text and tracked here.

Convention follows the **No-Intro / Redump / TOSEC DAT** standard (per-ROM `size` + `crc32` + a strong hash);
we use **SHA-256** as the canonical strong signature (stronger than the DAT-legacy MD5/SHA-1) and keep `crc32`
for cross-checking against those databases. See `docs/PRIOR-ART-LIST.md` (ROM-verification databases).

| file | size (bytes) | crc32 | sha256 | provenance | license |
|---|---|---|---|---|---|
| `zeta-arith.ch8` | 10 | `ec8dfc2f` | `0f372e55432c6101b6f326d9224f0491e44df6bb9330c783393ccc2288d677be` | authored by Zeta (the `arith` test fixture) | CC0 / public-domain (ours) |
| `zeta-selfloop.ch8` | 2 | `392d622c` | `08da7c45cb204377e7e42249cda5713fa865116ddbb4cb5a1949b2e5b438a6ab` | authored by Zeta (`1200` self-loop = a fixed-point fixture) | CC0 / public-domain (ours) |
| `zeta-draw-h.ch8` | 15 | `ee8154fc` | `0d792e6a2513a5dee719732c83274597d33e3ddfb3ada3ec1a54443aaa107d4c` | authored by Zeta (draws an "H" sprite — a visible-output fixture) | CC0 / public-domain (ours) |
| `mikolay-delay-timer-test.ch8` | 58 | `9fdb8801` | `0983138a1ac1f7ec16ccb935c9e9ebfe6fb0abbd89a4938a8c8c743df555f4f6` | Matthew Mikolay, *Delay Timer Test* (2010), `github.com/mattmikolay/chip-8` | MIT (see `THIRD-PARTY-LICENSES.md`) |
| `mikolay-random-number-test.ch8` | 34 | `6efd1f32` | `58ad441bd9acd280e8be79d6528ddc5b5cfc41874a28a458ec2299ef853e395d` | Matthew Mikolay, *Random Number Test* (2010), `github.com/mattmikolay/chip-8` | MIT (see `THIRD-PARTY-LICENSES.md`) |

## Verification

`SoftEmu`/`Chip8` unit tests load these by SHA-256 — the test fails if a ROM's bytes drift from its signature
here (tamper-evident fixtures). Recompute a signature with:

```bash
shasum -a 256 roms/chip8/<file>.ch8
python3 -c "import zlib,sys;print('%08x'%(zlib.crc32(open(sys.argv[1],'rb').read())&0xffffffff))" roms/chip8/<file>.ch8
```

## Excluded (did NOT pass the license-verification gate)

- **IBM Logo.ch8** — original author unknown, license unconfirmed, plus the IBM trademark. Stays in
  `references/prior-art/` (reference-not-copy), not committed.
- **All commercial-game clones** (Brix/Pong/Tetris/Invaders/Blinky/Breakout/…) — derivative of copyrighted
  titles, not public-domain. Reference-only.
