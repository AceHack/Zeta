# Ace is also a one-liner bootstrap register: install without a PM, or install the PM itself (Aaron, 2026-06-07)

Extends the Ace-external-state-closure captures (#6939/#6941). Aaron:

> *"Ace is a one-liner register too — for install without a package manager, or the install of the package
> manager itself."*

## The kernel: Ace bootstraps its own host

Beyond being the unified pointer map over the whole dependency space (#6939/#6941), Ace is a **one-liner
register** — a `curl`-style single command that can:

- **install a tool directly, with NO package manager present** (zero-dependency entry; the host has nothing
  yet), and
- **install a package manager itself** (npm/cargo/nix/etc.) — or install **Ace**.

This solves the **chicken-and-egg / bootstrap problem**: a closure needs a host to express ("viruses need a
host," 081KTHTPPCD), but how does the host get there with no PM to install it? Answer: **the one-liner register
installs the host.** Ace is both the closure's pointer map *and* the bootstrap that lays down the substrate the
pointers resolve against.

## Why it completes the closure

- **Zero-to-one entry.** The unified dep map (#6939) assumes *something* can resolve pointers; the one-liner is
  the **zero-dependency seed** that gets you to that something from a bare machine. `curl … | sh`-shaped, but
  declarative/content-addressed (a *register* of one-liners, not ad-hoc scripts).
- **Self-bootstrapping (081KSKBP80008QG0R000F4311E).** This is the 081KSKBP80008QG0R000F4311E lane — "one-liner curl-install repository for fast-moving
  tools." Ace-installs-Ace and Ace-installs-the-PMs makes the whole external-state closure **self-installing**:
  the closure can reconstitute its own host from a single command.
- **The host the virus needs, delivered.** 081KTHTPPCD: a ZetaId/closure only expresses given a host. The
  one-liner register is **how the host arrives** — so the seed-plus-host story is complete end to end (bare
  metal → one-liner → host/PMs → Ace pointer map → resolved environment).
- **Tiered install, fault-aware (#6937).** Install-without-a-PM (the bootstrap one-liner) is the *most stable
  craton* (it must work on a bare machine, change rarely); installing PMs is the next tier; app deps are the
  active margin. The one-liner is the bedrock the rest of the dep map stands on.

## Honest scope / peel

- Design/in-flight (081KSKBP80008QG0R000F4311E + the Ace lane, otto-windows); the one-liner register is the documented intent, not
  fully built.
- **Security bound (load-bearing):** a `curl | sh` bootstrap is a supply-chain/admission surface — it must be
  content-addressed + verified (signature/hash), respect source terms (#6926), and be consent/policy-gated
  (never auto-execute an untrusted register entry; cf. the persisted-seed admission discipline, 081KTHTPPCD).
  The convenience of one-liner install does not relax verification.
- The claim is bootstrap + self-install, not "magically safe install"; the keeper is *zero-dependency entry that
  can lay down the host (incl. PMs and Ace itself)*, verified.

## Ties

- **Ace external-state closure / one dep map (#6939) + pointers span all layers (#6941)** — this is the
  *bootstrap* that lays down the host those pointers resolve against.
- **081KSKBP80008QG0R000F4311E** (one-liner curl-install repository for fast-moving tools) — the lane this names.
- **Viruses-need-a-host (081KTHTPPCD)** — the one-liner is how the host gets installed; completes seed+host.
- **Self-boot capability** (the `self-boot` skill / fresh-instance bootstrap) — the human/CLI analogue: bring up
  a working substrate from near-nothing.
- **Tectonic faults (#6937)** — the bootstrap one-liner is the bedrock craton under the dep map.

## Beacon anchors

- **`curl … | sh` bootstrap installers** (rustup, nvm, Homebrew, Nix install scripts — zero-PM entry) — the
  pattern, here made a *content-addressed verified register* rather than ad-hoc. · **Bootstrapping / chicken-and-
  egg** (how a toolchain installs itself from nothing; the bootstrap problem). · **Supply-chain integrity**
  (SLSA, signed/hashed install artifacts — the security bound). · **Self-hosting / self-installing systems**
  (a system that lays down its own substrate). Honest novelty: none in curl-installers; the contribution is
  **folding the bootstrap one-liner into the Ace closure** — Ace is both the unified dependency *pointer map*
  and the *zero-dependency register* that installs the host (PMs, and Ace itself), making the external-state
  closure self-installing from bare metal, under content-address + verification.
