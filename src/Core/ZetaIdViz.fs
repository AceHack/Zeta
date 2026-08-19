namespace Zeta.Core

open Zeta.Core.FSharp.ZetaId

/// ZetaIdViz — **every ZetaId category gets a way to be SEEN** (Aaron 2026-06-11: "every zetaid
/// category should have a way to visualize it — they are all generators anyway").
///
/// "They are all generators anyway" is the design: a ZetaId is already a deterministic mint, so its
/// visualization is just ONE MORE GENERATOR — `glyphOf` derives an 8×8 identicon-style glyph from the
/// id's own bits (mirror-symmetric: the left half comes from the bits, the right half is the mirror —
/// the BoundaryLight `mirror` move, which is also why every glyph reads as a "face"), and the
/// CATEGORY picks the CHIP-9 plane color — so WHAT KIND of thing an id is, is visible at a glance
/// (safety/jurisdiction at a glance, extended to identity), and WHICH thing it is, is the pattern.
///
/// Deterministic end-to-end: same id ⇒ same glyph ⇒ same pixels on every node (the glyph is registered
/// in GeneratorRegistry as `zetaid.glyph` v2 — referenceable by its own ZetaId, shape A and proud.
/// The version bump is what makes the pixel change non-silent: the registry's own contract is that
/// "bumping a version = a new id", and v1's pixels are not v2's. #12533 changed the pixels while
/// leaving the version at 1, so for one commit a registered generator's id claimed output it no
/// longer produced).
/// Anchors: identicons (Park's visual hash, 2007 — gravatar lineage); our mirror/glyph primitives.
[<RequireQualifiedAccess>]
module ZetaIdViz =

    /// The CHIP-9 color mask for a category — the at-a-glance channel. Total over the registered
    /// categories; Extended/unknown render white (7: "all channels — tell me more").
    let colorOf (c: Category) : byte =
        match c with
        | Category.Observation -> 6uy // cyan — what crosses in (the shadow register)
        | Category.Emission -> 1uy // red — what goes out
        | Category.Workflow -> 2uy // green — work in motion
        | Category.Heartbeat -> 5uy // magenta — the pulse
        | Category.Batch -> 3uy // yellow — bulk transport
        | Category.FrictionTelemetry -> 1uy // red family — friction runs hot
        | Category.Bus -> 4uy // blue — the wire
        | Category.Spawn -> 2uy // green family — new life
        | Category.WorkItem -> 3uy // yellow family — the board
        | Category.ContentAddress -> 6uy // cyan family — content is observed, not commanded
        | _ -> 7uy // Extended / future: white until they earn a channel

    /// Fold a 128-bit id down to the 32 bits the glyph can actually carry.
    ///
    /// WHY THIS EXISTS (fixed 2026-08-19). `glyphOf` used to read `id >>> (row * 4)` for rows 0..7,
    /// i.e. **bits 0-31 only** — it discarded 96 of 128 bits. On the Observation layout that is not
    /// a generic truncation, it is a specific one: `BitLayout` puts `Randomness` at offset 0 width
    /// 32 (`GeneratedBitLayout.RandomnessOffset = 0<bit>`), so the picture was derived from the
    /// **nonce and nothing else**. Two ids differing in timestamp, category, authority, persona,
    /// location — every semantically meaningful field — drew the *identical* glyph. The header's
    /// claim that "WHICH thing it is, is the pattern" was true only of the random field.
    ///
    /// THE FIRST REPAIR (2026-08-19, #12533) XOR-ed the four 32-bit lanes. It removed the
    /// truncation and it was **not sufficient**, because XOR over GF(2) is LINEAR: two ids collide
    /// iff `fold(a XOR b) = 0`, so the colliding deltas form a 96-dimensional subspace — and since
    /// every ZetaId field is a contiguous bit-range, that subspace is **aligned with the field
    /// boundaries**. Any two bit positions exactly 32 apart cancel exactly. Measured on the landed
    /// XOR fold (081M0DYG9X9087G0R002JK171Z):
    ///   - two ids identical in EVERY field but timestamp, `1 + 2^32` ms apart (49.7 days + 1 ms),
    ///     drew a byte-identical glyph. 16 of 16 tested deltas of that shape collided.
    ///   - an **Observation** and an **Emission** — different `Category` — drew a byte-identical
    ///     glyph when the category delta was cancelled by a single timestamp bit (global bit 97,
    ///     which is inside the 48-bit Timestamp field).
    /// Those are structured, constructible, field-aligned collisions on an identity surface; they
    /// are not the pigeonhole residual below, and no birthday argument covers them.
    ///
    /// The fold is therefore `fmix64`, which avalanches: a single input bit flip changes ~half the
    /// output bits and no delta cancels by construction. The rationale offered for preferring XOR —
    /// "a hash would need a fourth byte-lock" — does not hold on the facts: `hash.fmix64` is
    /// already a registered generator with an IR row and an existing four-oracle byte-lock at
    /// `tests/cross-verification/fmix64`. It stays O(1) and allocation-free (five shifts, two
    /// multiplies, no array). The mirror-symmetric 8x8 "face" (BoundaryLight `mirror`, and the
    /// reason a glyph reads as a face) is untouched.
    ///
    /// THE RESIDUAL IS REAL AND IS DECLARED, NOT PAPERED OVER. An 8x8 mirror-symmetric bitmap holds
    /// 32 bits, so this removes the *truncation* and cannot remove the *pigeonhole*: 2^96 ids still
    /// share each glyph. The birthday number wants stating precisely, because ~2^16 is the wrong
    /// statistic: `sqrt(2^32) = 65,536` is not the expected first collision. Expected first
    /// collision is `sqrt(pi*2^32/2) ~= 82,137` and the 50% point is `~= 77,163`. **Measured** over
    /// the pre-fix implementation: first collisions at 77,994 and 78,231 over two independent
    /// draws, and **zero** collisions at n = 65,536 (P(>=1) there is 39.3%, not ~1).
    /// What changes with the avalanche fold is that a collision is a 1-in-2^32 digest clash with
    /// no structure behind it — not a cancellation you can construct from the field layout.
    /// **Nothing may treat this glyph as an identity.** It is a recognition aid; `ZetaId` itself
    /// is the identity.
    /// (Widening it means dropping the mirror — which doubles capacity to 64 bits and costs the
    /// face. That is a design call, not a defect fix: 081M0DNCXZK087G0R003DEY5KF.)
    /// MurmurHash3's `fmix64` avalanche finaliser — Austin Appleby, public domain (smhasher
    /// `MurmurHash3.cpp`). Registered as `hash.fmix64` in `GeneratorIrRegistry` and ALREADY
    /// byte-locked across the oracles at `tests/cross-verification/fmix64`, so using it here costs
    /// no new cross-language lock. Arithmetic wraps mod 2^64 — that is the spec, not an oversight.
    let private fmix64 (k: uint64) : uint64 =
        let mutable x = k
        x <- x ^^^ (x >>> 33)
        x <- x * 0xff51afd7ed558ccdUL
        x <- x ^^^ (x >>> 33)
        x <- x * 0xc4ceb9fe1a85ec53UL
        x <- x ^^^ (x >>> 33)
        x

    let internal foldTo32 (id: System.UInt128) : uint32 =
        let mask64 = System.UInt128(0UL, 0xFFFFFFFFFFFFFFFFUL)
        let lo = uint64 (id &&& mask64)
        let hi = uint64 ((id >>> 64) &&& mask64)
        // golden-ratio odd constant breaks fmix64's 0 -> 0 fixed point for the all-zero id
        let m = fmix64 (lo ^^^ fmix64 (hi ^^^ 0x9E3779B97F4A7C15UL))
        uint32 (m ^^^ (m >>> 32))

    /// The number of distinct glyphs this generator can draw. Stated so a caller can check the
    /// bound instead of assuming the picture identifies an id. See `foldTo32`.
    let GlyphSpaceBits = 32

    /// The glyph: 8 rows of 8 bits, mirror-symmetric, derived from ALL 128 bits of the id folded to
    /// 32 (4 bits per row → the left half; the right half mirrors). Deterministic; the id IS the
    /// picture — up to the declared 32-bit glyph space, which is `GlyphSpaceBits`.
    let glyphOf (id: System.UInt128) : byte[] =
        let folded = foldTo32 id
        [| for row in 0..7 ->
               let nibble = byte ((folded >>> (row * 4)) &&& 0xFu) &&& 0xFuy
               // left half = the nibble; right half = its bit-reverse (the mirror)
               let mutable rev = 0uy
               for b in 0..3 do
                   if nibble &&& (1uy <<< b) <> 0uy then rev <- rev ||| (1uy <<< (3 - b))
               (nibble <<< 4) ||| rev |]

    /// Render an id + category as MediaLines entries (a `glyph` row + a `palette` row) — the artifact
    /// form every surface (board, card, TV) consumes; the filetype refers to THIS generator by its
    /// registered ZetaId.
    let toMediaLines (name: string) (category: Category) (id: System.UInt128) : MediaLines.Entry list =
        let hex = glyphOf id |> Array.map (sprintf "%02x") |> String.concat ""
        [ { Kind = "glyph"; Name = name; Fields = [ hex ] }
          { Kind = "palette"; Name = name; Fields = [ string (colorOf category) ] } ]
