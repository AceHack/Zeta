---
id: 081KZMGZTB508QG0R003F8AXYQ
type: bug
state: backlog
priority: P2
slug: ksk-n-of-m-gate-accepts-signers-not-on-the-roster-and-verifi
title: "KSK N-of-M gate accepts signers not on the roster and verifies no signatures"
created: 2026-08-10T00:26:01.957Z
depends_on: []
composes_with: []
---

# KSK N-of-M gate accepts signers not on the roster and verifies no signatures

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZMGZTB508QG0R003F8AXYQ-*.md` glob. -->


## Where this came from

Aaron 2026-08-09: *"we need to get that n-of-m cryptography algo on this with quantum
resistance — we have lattices and other quantum-resistant algo."* Surveying what exists before
designing turned up a gate that **looks complete and currently authorizes on trust.**

## What exists — an honest inventory

| piece | file | status |
|---|---|---|
| N-of-M **threshold logic** | `src/Core/Consent/KskAuthorization.fs` | **real** — scope match, distinct-signer count, duplicate detection, `Result`-typed |
| **signature verification** | same | **absent, and stated so**: *"full signature verification (crypto) deferred to follow-up slice; this is threshold logic only"* |
| **roster membership check** | same | **absent, and not stated** — see below |
| post-quantum algorithm | `src/Core/Crypto.fs` | `PqLattice // future … not yet implemented` — an enum case with workitem `081KSNY2Z0008QG0R002JKH50A` |
| Shamir secret sharing | `src/Core/Shamir.fs` | **toy field** — `Prime = 257`, `int` arrays. Fine for demonstration, not a basis for a security gate |

## The unstated gap (the actual bug)

`checkKskAuthorization` uses `config.Signers` **only for its `.Length`**:

```fsharp
let uniqueSigners = req.Signatures |> List.map fst |> List.distinct
let provided = uniqueSigners.Length
if provided < required then ... InsufficientSigners
elif provided > config.Signers.Length then ... DuplicateSigners
else Ok (Authorized (provided, required))
```

**Nothing checks that a signer in the request is on the configured roster.** A request carrying
`Threshold` distinct signers that are *entirely unknown identities* reaches `Authorized`, so
long as the count does not exceed the roster size. Combined with the deferred signature
verification, the gate currently answers *"were enough distinct names supplied?"* — not
*"did enough authorized parties consent?"*

The deferred-verification note is honest and was declared. **The membership gap was not**, and
it is the more surprising of the two: a reader sees `config.Signers` referenced and reasonably
assumes the roster is enforced.

## Why it matters more than it looks

This is the **emergency bypass of the consent gate** for the KSK — the kinetic safeguard. It is
the highest-authority path in the system and the one an attacker most wants. It is also the
mechanism Aaron proposes to reuse for **k-of-n on discriminated-union / workflow changes**,
where its job would be preventing a single party from widening the action space. Reused as-is,
it would not prevent that.

## Done when

1. **Roster membership enforced** — every signer in the request must appear in `config.Signers`;
   an unknown signer is a distinct, explaining result (not folded into `DuplicateSigners`).
2. **Signatures actually verified** against the signer's key over the request's scope + payload,
   closing the declared deferral.
3. **The algorithm is decided and stated.** For a gate that must outlive 2038-era grants, the PQ
   question is not premature — but `PqLattice` is currently a name, not an implementation, and
   `Shamir.fs`'s GF(257) is not a candidate. Prefer a standardised scheme (ML-DSA / FIPS 204,
   or SLH-DSA / FIPS 205 for hash-based conservatism) over a bespoke lattice construction.
4. **Tests that fail before the fix** — an unknown-signer request must be rejected, and a
   request with valid names but invalid signatures must be rejected.

*Note on the E8/adinkra lattice work in-tree: that is a **coding-theory** lattice (Construction A
over extended Hamming), not a cryptographic hardness assumption. The two are different uses of
the word and must not be conflated when choosing a PQ scheme.*
