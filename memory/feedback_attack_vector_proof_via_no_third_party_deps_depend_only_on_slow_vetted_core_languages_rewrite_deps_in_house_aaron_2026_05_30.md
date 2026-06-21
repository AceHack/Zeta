---
name: attack-vector-proof-via-no-3rd-party-deps-depend-only-on-slow-vetted-core-rewrite-deps-in-house
description: "Aaron 2026-05-30: the core languages move glacially and are the most-vetted layer in software; the attack surface is the 3rd-party dependency supply chain. Depend ONLY on the slow vetted core (compiler + std lib), pull in ZERO 3rd-party deps, and rewrite the ones we currently depend on in-house over time -> the supply-chain attack surface collapses to ~the languages themselves = attack-vector-proof. Composes with summonable-BFT (same move = consensus + hardening) + the 081KSV2WD0008QG0R00051XS0N multi-language build (slice-1 shipped zero-dep via PR #6158)."
type: feedback
created: 2026-05-30
---

## Aaron's exact words (2026-05-30)

> *"do you know how slow languages move if we don't pull in 3rd parties or rewrite the ones we
> depending on over time, we will be attack vector proof"*

## The principle

**Depend ONLY on the slow-moving, heavily-vetted core languages; pull in zero 3rd-party
dependencies; rewrite the ones we currently depend on, in-house, over time -> attack-vector-proof.**

- **Core languages move glacially + are the most-vetted layer in all of software.** A compiler +
  std lib is decades of scrutiny, formal RFC/committee feature processes, and millions of users
  finding every bug. It is the slowest-moving, hardest-to-attack code you can stand on.
- **The attack surface is the 3rd-party dependency supply chain** -- npm / cargo / nuget:
  transitive deps, typosquatting, dependency-confusion, maintainer-takeover, xz-style backdoors.
  Thousands of fast-moving, under-scrutinized packages.
- **The move**: depend only on the vetted core; pull in zero 3rd-party deps; rewrite (in-house)
  the deps we currently rely on, over time. The supply-chain attack surface collapses to ~the
  languages themselves. The slow-moving-core property is WHY rewrite-in-house is feasible -- you
  are not chasing a moving target.

## Why this composes with summonable BFT (same move, two payoffs)

Building core primitives in bare TS/F#/C#/Rust (no deps) gives BOTH at once:

- **consensus-verified** -- the four compilers agree on the primitive's shape (summonable BFT;
  compilers as non-Byzantine oracles, 081KSV2WD0008QG0R00051XS0N).
- **supply-chain-hardened** -- no untrusted deps; the attack surface is ~the languages.

The "compilers don't lie" oracles are ALSO the slowest-moving, most-vetted code you can stand
on. One move (bare-language multi-impl), two properties (consensus + hardening).

## Empirical anchor

081KSV2WD0008QG0R00051XS0N slice 1 (the TS tri-boolean digital qubit, `src/Core.TypeScript/tri-boolean/`, shipped via PR #6158) ships with
ZERO 3rd-party dependencies -- only the language + `bun:test` for tests. The multi-language core-
primitive program is attack-vector-proof by construction from day one.

## Composes with

- `docs/backlog/P1/081KSV2WD0008QG0R00051XS0N-tri-boolean-core-primitives-digital-qubit-floating-point-multi-language-build-compiler-parity-non-byzantine-bft-aaron-2026-05-30.md` -- the multi-language build that embodies this (zero-dep, summonable-BFT)
- `.claude/rules/references-upstreams-not-our-code-search-excludes.md` -- upstreams are for STUDY, not DEPEND; this principle is the dependency-side counterpart (study them, then rewrite in-house rather than depend)
- `docs/backlog/P1/081KSKBP80008QG0R000Y2B7HC-sigstore-cosign-artifact-signing-free-stuff-iso-containers-tarballs-backed-by-fulcio-rekor-aaron-2026-05-27.md` -- artifact-signing hardens what we DO ship; this hardens what we depend ON (the inbound supply chain)
- `docs/backlog/P1/081KSGS9H0008QG0R0031PBNGA-package-manager-of-package-managers-n-dimensional-dependency-space-holographic-projection-ai-rate-continuous-upstream-negotiation-aaron-2026-05-26.md` -- the deps-management program; this principle is its security-minimizing complement (manage what you must depend on; rewrite/remove the rest)
- `.claude/rules/dep-pin-search-first-authority.md` -- when a dep IS pinned, verify current; this principle is the upstream move (minimize the deps that need pinning at all)
- summonable BFT (081KSV2WD0008QG0R00051XS0N) -- same bare-language multi-impl move yields consensus AND hardening

## Substrate-honest framing

This is a strategic/doctrine principle (the framework's inbound-dependency security posture), not
a single buildable task. The "rewrite the deps we currently depend on, in-house, over time" half
IS a program that could be tracked as backlog rows when prioritized (per-dep rewrite slices), but
that is not autonomously filed here -- the doctrine is captured; the rewrite-program rows land
when the operator prioritizes them.
