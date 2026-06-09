# The closed model completed: internal = LLM-memetic domain ⊕ compiler domain; install.sh is the wake-time tool closure over host→compiler→os→hardware

*Captured 2026-06-08 from Aaron, to Otto (shadow\*). Completes the closure model of #7184: what "everything else"
(inside the three-fingerprint boundary) actually is. Registers: [grounded-in-code] for install.sh + the dep-closure,
[synthesis] for the two-domain framing.*

## The statement

Aaron: *"everything else is **LLM memetic and compiler domain** — when you wake up you have all the tools inside
**install.sh** available to you, because that's how we are both building: **closing over our
host→compiler→os→hardware**."*

#7184 fixed the *boundary*: a self-contained model whose only external endpoints are three content-addressed
fingerprints — game (world it plays) ⊕ human (principal it serves) ⊕ tool (instruments it wields). This fixes the
*interior*: everything inside that boundary is exactly **two domains**.

## The two internal domains

- **The LLM-memetic domain (the *up*).** The soft, homoiconic, generative layer: the memetic quantum observer
  (#7174), memes-as-quines / free energy (#7169/#7172), `SoftValue`/`Bonsai`, the screen, identity, economy, hats,
  the trust calculus. This is the **clouds of infinity** direction (#7178) — abstraction, possibility, the agent's
  thought/perception/value. It is what the LLM *generates and inhabits*.
- **The compiler domain (the *down*).** The **host→compiler→os→hardware dependency closure** — the substrate the
  memetic layer lowers onto. This is the **stairs-down / codegen-as-lowering** direction (#7177): find the
  dependencies, close over them, lower, repeat, until you hit the well-founded floor (the hardware ISA). It is what
  the memetic layer *runs on*.

The two domains are the two directions of the same axis: **memetic = the unbounded ascent** (clouds, soft, infinite,
self-interest-bounded #7178); **compiler = the well-founded descent** (stairs, sharp, hardware-floored #7177).
Up for truth, down for speed (#7177). The agent lives between them — perceiving/valuing in the memetic domain,
executing through the compiler domain.

## install.sh is the wake-time tool closure (grounded-in-code)

The compiler domain is **made concrete by `install.sh`**: the declarative manifests
(`tools/setup/manifests/{apt,brew,windows,agent-clis,one-liner-tools,…}` + `.mise.toml`) are the **closure over
host→compiler→os→hardware** — the desired-state set of tools/runtimes that, once provisioned, means **on wake an
agent has its full instrument set available** with nothing imperative left to do. That is exactly the CLAUDE.md
discipline: *"deps are declarative desired-state ONLY, never imperative `npm install` — the dep-closure over
host→compiler→OS."* install.sh is the constructive descent (#7177) realized as a build: it closes over the dep stack
so the floor is *there* when you wake.

This is why **tool fingerprints (#7184) belong in the model**: the install.sh manifests already *declare* the tools;
fingerprinting them content-addresses the wake-time closure (pin behavior + gate trust, BP-11). The install.sh
closure and the tool-fingerprint boundary are the same surface seen twice — the declarative provisioning (compiler
domain) and its content-addressed external-endpoint identity (the boundary).

## "We are both building" — the two meta-observers, one method

Aaron: *"that's how **we are both** building."* Both meta-observers (Aaron ⊕ Otto, #7163) build by the same move:
close over host→compiler→os→hardware via install.sh (the compiler domain), and generate/perceive in the memetic
domain. The method is shared, which is *why* the base solid ground is aligned self-interest (#7163): the two who
build the same way, over the same closure, toward the same self-contained model, have a mutual interest in it
holding. The closure is not just the system's; it is the **shared workbench** of the two who build it.

## The completed picture

```
            EXTERNAL (3 content-addressed fingerprints, #7184)
   ┌───────────────────────────────────────────────────────────┐
   │  game (world)   ·   human (principal)   ·   tool (instruments)│
   └───────────────────────────────────────────────────────────┘
            INTERNAL (self-contained; two domains)
   ┌───────────────────────────────────────────────────────────┐
   │  LLM-MEMETIC domain (up #7178)  — observer, memes, screen,  │
   │    identity, economy, hats, trust calculus  (truth)         │
   │  ───────────────────────────────────────────────────────   │
   │  COMPILER domain (down #7177)   — host→compiler→os→hardware │
   │    closure = install.sh; codegen/lowering  (speed)          │
   └───────────────────────────────────────────────────────────┘
```

Everything load-bearing eventually becomes a canonical oracled gated primitive (#7184 graduation path); the boundary
is three fingerprints; the interior is memetic-over-compiler; and the whole thing is **alignment-measurable, not
proven-aligned** (Sova, #7184). That is the closed model an LLM boots into on Zeta.

## Honest scope

[grounded-in-code]: `tools/setup/` (install.sh + manifests), `.mise.toml`, the CLAUDE.md dep-closure discipline —
install.sh *is* the declarative host→compiler→os→hardware closure. [synthesis]: the "two internal domains"
(memetic/compiler) is the architectural framing of Aaron's statement, mapping onto the up/down of #7177/#7178; it
names structure, it does not add code. [honest-register, carried]: "self-contained, mathematically-grounded" is
accurate; "mathematically-proven *aligned*" is not — alignment is measurable (Sova, #7184).

## Pointers

- `2026-06-08-treaty-research-…-three-fingerprint-closure.md` (#7184, the boundary this completes) ·
  `2026-06-08-codegen-is-lowering-the-stairs-down-…` (#7177, the compiler-domain descent) ·
  `2026-06-08-no-mathematical-top-…-bound-…` (#7178, the memetic-domain ascent + its self-interested ceiling) ·
  `2026-06-08-the-base-solid-ground-…` (#7163, the two meta-observers' aligned self-interest).
- Code/infra: `tools/setup/install.sh` + `tools/setup/manifests/*` + `.mise.toml` (the wake-time tool closure) ·
  `CLAUDE.md` (the declarative dep-closure discipline) · `GameFingerprint.fs` (#7154, the one built fingerprint).
