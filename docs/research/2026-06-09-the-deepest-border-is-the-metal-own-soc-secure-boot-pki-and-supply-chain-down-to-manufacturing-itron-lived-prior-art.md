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

> **Where we are today, so the gap is legible** (`081M00QP7FB087G0R00031BQ93`). Everything above is
> the *destination*, and this doc is the only lane in the repo that reaches it. On the hardware we
> actually run, the position is the opposite: every attestation terminates in a **silicon vendor's
> self-signed root** — AMD's ARK, Intel's SGX Root CA, NVIDIA's device CA, the TPM manufacturer's EK
> root — and each board's firmware trust root is its OEM's **Platform Key**. That is why "own the
> SoC" is the *deepest* border and not a rhetorical one: it is the only move that converts "the
> vendor vouches for this silicon" into "we vouch for this silicon."
>
> Two honest qualifiers, so this reads as a decade-scale program rather than a near-term plan:
> **(1)** vendor-rooted attestation is not broken — it is what every serious system in the world
> uses, and a fleet spanning AMD *and* Intel roots already degrades gracefully where a monoculture
> does not; **(2)** owning the SoC relocates the root rather than abolishing it — customers of *our*
> silicon would then be trusting *our* self-signed root, which is the same structure with a different
> name. The gain is sovereignty over our own metal, not the invention of a rootless attestation.
> There is no such thing.
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

## Then `ace` deploys hardware intrinsics, not just packages

> Aaron (2026-06-09): "then ace becomes hardware intrinsics deployment instead of
> just package deployments."

Once we own the metal, **`ace` (the package-manager-of-package-managers) extends
from deploying *packages* to deploying *hardware intrinsics*** — the same
deployment model (content-hash + signature + lockfile + trust + deps graph +
golden-vector conformance) applied **down to the silicon**:

- the deployable unit generalizes from a software package to a **bitstream (FPGA),
  microcode, firmware, secure-boot image, SoC capability** — each content-addressed,
  signed by **our** PKI, lockfile-pinned, deps-resolved, byte-locked.
- `ace` becomes the **one deployment substrate across the entire stack** — package →
  OS → firmware → hardware intrinsic — closing the **128-bit ZetaId → hardware
  intrinsics** unfolding: the seed-id unfolds, and `ace` is what *deploys* that
  unfolding onto the secure-booted silicon, verified at every layer by the same
  owned-PKI trust the keyring started.
- the **uncertainty-reduction-at-the-border** discipline now covers the
  hardware-intrinsic border too: a deployed bitstream/microcode is trusted the same
  way a package is (dep-as-oracle + golden vectors + signature), so trust + leverage
  compound across the *physical* layers as well as the software ones.

So `ace` is not a software package manager that happens to reach hardware — it is the
**deployment channel for the whole owned stack**, from a seed phrase to the gates on
our own chip.

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
