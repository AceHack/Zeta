namespace Zeta.Core

/// Optics — the **lensable** and **prismable (fingerprintable)** focus interfaces (Aaron 2026-06-10:
/// "save the lensable and prismable (fingerprintable) interfaces in code so we don't lose them").
///
/// Two kinds of focus, chosen by the shape of the whole (see
/// docs/research/2026-06-10-forcing-lensability-*):
///   • LENS  — a part that is ALWAYS present: a *product* factor (`whole ≅ part × rest`).
///   • PRISM — a part that MAY be present: a *sum* case. Prism = **fingerprint**: `Match` identifies
///             whether the whole is this case and extracts it; `Build` injects it back. The
///             fingerprinting ties our rainbow-table / content-derived-identity primitives
///             (`GameFingerprint`, `StructureFingerprint`): `Match` = fingerprint-then-lookup.
///
/// Pure interfaces, no classes (the interfaces-free / classes-earned meta-rule). Optics compose.
module Optics =

    /// A **LENS** onto a part that is always present (a product factor). Lawful iff:
    ///   get-put: `Set (Get w) w = w` · put-get: `Get (Set p w) = p` · put-put: last write wins.
    /// `PolarityFilter` (a color/component read) is a lens at the meaning layer.
    type ILens<'whole, 'part> =
        abstract Get: 'whole -> 'part
        abstract Set: 'part -> 'whole -> 'whole

    /// A **PRISM** onto a part that may be present (a sum case) — the **fingerprintable** optic.
    /// `Match` is the fingerprint (is the whole this case? → extract it); `Build` reconstructs the
    /// whole from the part. Lawful iff:
    ///   build-match: `Match (Build p) = Some p` · match-build: `Match w = Some p ⇒ Build p = w`.
    /// Ties the rainbow-table fingerprinting primitive: `Match` = content-fingerprint → case lookup.
    /// The rainbow table has a HARD form (exact crypto reversal — the hash→preimage hacking/decrypting
    /// use) AND a SOFT form (Aaron 2026-06-10): approximate / similarity fingerprinting — perceptual
    /// hash / locality-sensitive lookup → nearest case, not exact. So `Match` is either exact
    /// (hard / CMYK-solid) or fuzzy (soft / RGB) — same soft-vs-solid duality as the encoding.
    type IPrism<'whole, 'part> =
        abstract Match: 'whole -> 'part option
        abstract Build: 'part -> 'whole

    /// Build a lens from a getter + setter (the common constructor).
    let lens (get: 'whole -> 'part) (set: 'part -> 'whole -> 'whole) : ILens<'whole, 'part> =
        { new ILens<'whole, 'part> with
            member _.Get(w) = get w
            member _.Set p w = set p w }

    /// Build a prism from a matcher (fingerprint) + builder.
    let prism (matcher: 'whole -> 'part option) (build: 'part -> 'whole) : IPrism<'whole, 'part> =
        { new IPrism<'whole, 'part> with
            member _.Match(w) = matcher w
            member _.Build p = build p }
