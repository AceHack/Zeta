# Emulator ROMs are ZetaId pointers; multiple signature databases are the resolver oracles (reference-not-copy) (Aaron, 2026-06-07)

Extends the Dark Hall emulator (#6986) + the ZetaId-pointer-to-external-content discipline (#6925). Aaron:

> *"emulator ROMs can be ZetaId pointers too, and there are multiple different signature databases for them."*

## The kernel: a ROM is a pointer (by signature), never stored content

A ROM is copyrighted — so, exactly like song lyrics (#6925/#6924), **Zeta points to a ROM, it does not store
it.** The pointer is the ROM's **signature** (hash/CRC) from a **signature database**:

- **ROM = a ZetaId pointer keyed by signature.** A `rom:<platform>/<title>` noun resolves to a content-address
  (CRC32/SHA from a DAT). The DarkHall cell (#6986) runs the ROM the *user supplies* (their legally-owned copy),
  verified against the signature — the repo holds the pointer + the verification, **never the ROM bytes**
  (reference-not-copy; no-binary-in-proof-lineage).
- **Multiple signature databases = multiple resolver oracles.** ROM identity has several authorities —
  **No-Intro**, **Redump**, **TOSEC**, **MAME** DATs — each a signature DB (CRC/MD5/SHA per ROM). These are the
  *resolver oracles* for the `rom:` scheme, exactly as **MusicBrainz + AcoustID** are for songs (#6925): pick a
  DB (or cross-check across them), resolve a ROM to its content-address, verify the user's file matches. The
  "multiple DBs" map onto the multi-oracle / pluggable-resolver model (#6916/#6925) — and onto the 4-oracle
  cross-check habit.

## It's already partly built (the foundation exists)

`tools/roms` (081KQ8P5D0008QG0R001590WJ3) already treats **DAT signature files as pinned dependencies**: `fetch-datfile.ts` reads a
pinned manifest (`tools/roms/manifests/datfiles.json`), downloads the DAT, and **verifies its SHA-256 against
the pin** — per-platform (incl. **atari-2600**), with `canonicalize` + `split-by-license`. So the
*signature-DB-as-dependency* half is real: the DAT is a pinned, verified dep; the ROM resolves against it. This
capture names the next step — a `rom:` ZetaId-pointer scheme over those DATs feeding the DarkHall cell.

## Why this is the right (and IP-safe) shape

- **Reference-not-copy (#6925) for ROMs.** The repo/closure never contains copyrighted ROM bytes — only the
  pointer (signature) + the verification. The user brings their own legally-owned ROM; Ace resolves/verifies it
  by signature. (Same posture as lyrics #6924/#6925; the DarkHall slice itself ships **no ROMs** — clean-room
  CPU only, #6986.)
- **Signature DBs are content-addressing in the wild.** A DAT entry *is* a content-address (CRC/SHA → identity)
  — Zeta's exact content-addressing (#6925) meets ROM preservation's existing practice. Multiple DBs = multiple
  oracles (cross-verify, like the 4-oracle golden vectors); disagreements are surfaced, not hidden.
- **Pinned + verified = reproducible + DST-able.** The DAT is pinned (SHA-256), so resolution is deterministic
  and the DarkHall run (deterministic, #6986/#6958) over a signature-verified ROM is fully replayable.

## Honest scope / peel

- **Design + partial build.** `tools/roms` (DAT-as-pinned-dep, SHA-256-verified, per-platform) exists; the
  `rom:` ZetaId-pointer scheme + DarkHall-resolves-ROM-by-signature wiring is the next step. No ROMs are or will
  be stored in-repo (the whole point).
- **Legality is the user's:** Ace resolves/verifies a ROM the *user provides* (their legal copy); Zeta does not
  distribute ROMs. The pointer + signature DB identify; they don't grant rights. (Crawler/source-terms
  discipline #6926 applies to fetching DATs from their sources.)
- **DB disagreement is real** — No-Intro/Redump/TOSEC/MAME can name/hash differently (regions, dumps, revisions);
  "the ROM" is oracle-relative. Surface the chosen oracle + cross-check; don't assume one canonical signature.

## Ties

- **ZetaId pointer to external copyrighted content / reference-not-copy (#6925) + MusicBrainz/AcoustID** — ROMs
  are the same pattern; signature DBs = the AcoustID/MusicBrainz analogue (multiple oracles).
- **DarkHall cell + deterministic emulator (#6986)** — runs the resolved, signature-verified ROM; deterministic
  ⇒ replayable (#6958).
- **tools/roms (081KQ8P5D0008QG0R001590WJ3) — datfile-as-dependency, pinned + SHA-256-verified, per-platform (atari-2600)** — the
  existing foundation.
- **Uniform pointer / resolver schemes (#6916) + Ace ensure (#6959)** — `rom:` is another resolver scheme; `ace
  ensure rom:atari-2600/<title>` resolves+verifies (user-supplied).
- **No-binary-in-proof-lineage** — only the pointer/signature, never ROM bytes, in-repo.

## Beacon anchors

- **ROM signature databases / DAT files** — **No-Intro**, **Redump**, **TOSEC**, **MAME** (CRC32/MD5/SHA-1 per
  ROM; the preservation community's content-addressed identity registries). · **Content addressing** (CRC/SHA →
  identity; #6925). · **Reference-not-copy / right-to-own-your-media** (point to the user's legal copy; don't
  redistribute, #6924/#6925). · **MusicBrainz/AcoustID** (the songs analogue — multiple identity oracles,
  #6925). Honest novelty: none — it applies the ZetaId-pointer / reference-not-copy discipline (#6925) to ROMs:
  a ROM is a **pointer keyed by signature**, resolved against **multiple signature-DB oracles** (No-Intro/
  Redump/TOSEC/MAME, already handled as pinned deps in `tools/roms`), verified against the user's own copy, and
  run in the DarkHall cell (#6986) — never stored in-repo.
