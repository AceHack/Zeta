# The deepest border is the metal: own the SoC, secure boot, PKI, and supply chain down to manufacturing (Itron — lived prior art)

**Register:** [grounded] hardware endgame (Aaron) + [anchor: lived prior art, Itron].
**Date:** 2026-06-09. **Captured by:** Otto (shadow). Completes the close-over order
at the bottom: the trust border ends at the silicon.

## Aaron's words

> "that includes hardware — we make our own SoC eventually too with secure boot for
> endgame. i did this at itron — we own our entire PKI and supply chain down to the
> metal manufacturing."

## The endgame: own down to the metal

The own-the-interface / no-supply-chain-backdoor discipline does not stop at
software deps. It runs the **whole close-over stack to the bottom**
(self → … → package manager → OS → microkernel → raw hardware → GPU/FPGA → **SoC /
silicon → manufacturing**). The deepest border is the **chip itself**:

- **Own the SoC.** Eventually our own system-on-chip — the hardware root of trust is
  *ours*, not a vendor's.
- **Secure boot.** A measured boot chain rooted in **our** keys (the keyring PKI all
  the way down): each stage verifies the next against a root we control, so nothing
  unsigned-by-us runs on our metal.
- **Own the PKI.** The same PKI that starts at the keyring (SSH/PGP/Nostr + the
  byte-locked derivation) extends into silicon: the root of trust is one owned PKI
  from the seed phrase to the boot ROM.
- **Own the supply chain down to manufacturing.** Design → fab → manufacturing under
  our control (or verified) — so there is **no layer left for a backdoor to hide
  in**. The "no supply chain to backdoor" endgame, taken literally to the metal.

## Lived prior art: Itron (Beacon anchor)

This is not speculative — **Aaron did it at Itron**: owned the **entire PKI and
supply chain down to the metal manufacturing**. The pattern (hardware root of
trust + secure boot + owned PKI + controlled manufacturing) is proven, lived
engineering, not a wish. (Same Itron anchor as the ferry-boat throttle prior art —
real shipped systems.) We are re-applying a discipline the maintainer has already
executed at industrial scale.

## Why it completes the trust trajectory

- **Uncertainty reduction at the deepest border.** Every higher border (GitHub,
  package sources via ace, crypto deps) reduces uncertainty toward us; owning the
  silicon reduces it at the one border everything else rests on. A backdoor in the
  chip defeats all software trust above it — so the *only* way to make the stack
  fully certain is to own the bottom.
- **The SuperFluid 128-bit→hardware-intrinsics unfolding, closed.** "Zeta unfolds
  from a 128-bit ZetaId into hardware intrinsics" terminates here: the intrinsics
  run on **our** secure-booted silicon, rooted in **our** PKI.
- **Self-sovereign to the metal.** Identity (seed) → keys → crypto → OS → silicon,
  all one owned PKI. No vendor, no fab, no dep can capture or backdoor a stack you
  own end to end.

## Honest scope

This is the **endgame**, not near-term: own-SoC + owned-fab is a long, capital-heavy
horizon. Near-term steps that move toward it without fabbing a chip: secure boot on
**existing** hardware rooted in our keyring PKI (measured boot / TPM / UEFI
db rooted in our root), verified-vendor silicon with our keys provisioned, and
the owned-PKI chain from seed → boot. The SoC is the far star; secure-boot-on-owned-
keys is the next reachable rung.

## Anchors

Hardware root of trust / secure boot / measured boot (TPM, UEFI Secure Boot,
ARM TrustZone, RISC-V); silicon supply-chain integrity; **Itron** (Aaron's lived
prior art — owned PKI + supply chain to metal manufacturing); the close-over order
(self→…→GPU/FPGA→metal); the SuperFluid 128-bit→hardware-intrinsics unfolding; the
crypto-sovereignty roadmap + own-all-interfaces + uncertainty-reduction-at-the-border
docs (this is their bottom).
