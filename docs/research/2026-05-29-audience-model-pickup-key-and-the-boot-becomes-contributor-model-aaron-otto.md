---
date: 2026-05-29
participants: [Aaron, Otto-CLI]
status: design-thread
tags: [audience-model, pickup-key, contribution-model, permissionless-contribution, security-hardening, prioritization]
title: "The audience model, the pickup-key, and the boot-becomes-contributor model"
composes_with:
  - "#6010 distrust-by-default mechanized as reflection-over-DUs"
  - "#6012 the both-axes protection architecture"
  - "#6014 consensus backstop / reports-as-weblinks / from-above meter / employer-IP boundary"
  - "081KSNY2Z0008QG0R002JKH50A better-git-crypt (the encryption lane)"
  - ".claude/rules/largest-mechanizable-backlog-wins.md"
---

# The audience model, the pickup-key, and the boot-becomes-contributor model

The prioritization key for "backlog the opens and pick them up based on our audience,"
plus the contribution model the audiences feed into and the security gate that model
requires. Operator-confirmed ("you nailed the framing").

## The three audiences

| Surface | Audience | Hardness |
|---|---|---|
| **git-monster accelerator** | Anyone wanting to see AI life — GitHub-noobs included; free, and they'll leave it running. | **Hardest** |
| **usb / iso** | Homelab / home-automation / devops / research / benchmark. Concrete target: **ServiceTitan** full persona-spectrum (all tech + c-suite). | Technical mid |
| **encryption** | Everyone. Privacy is the base layer under all of it. | Universal base |

### Audience-hardness inverts the technical floor

git-monster is the hardest audience *precisely because it assumes the least of the
user* — zero-friction, self-evidently-valuable, free, runs-unattended, legible to
someone who's never touched git. usb/iso is an easier audience because it assumes the
*most* (technical practitioners tolerate complexity). So **designing for the hardest
audience is the hardest engineering and the widest payoff** — it's the accessibility
forcing-function. If it works for the noob, it works for everyone above them.

This reconciles with "do what's easy first": the easy-first work mostly serves the
*easier* audiences (the usb/iso technical floor, the encryption primitives) where less
polish satisfies them; the git-monster-noob-legibility is the hardest polish, the
expand-later. Encryption-everyone is the foundational base under both.

## usb/iso → ServiceTitan: the dual-face requirement

The concrete devops target is ServiceTitan's full persona-spectrum, and "all tech AND
c-suite" is **two audiences with two faces**:

- **Tech personas** (platform / SRE / devops / eng) want the substrate itself — the
  CLI, the cluster, the benchmark, the thing they run and inspect.
- **C-suite personas** want the **from-above view** — governance / metrics / ROI, the
  reports-as-weblinks, the dashboard that makes the AI-org legible without reading a
  CLI. (The from-above-meter from #6014, pointed at executives.)

So the product is **dual-face**: same engine, two readouts — the from-above/individual
split as a product requirement.

**Clean under the employer-IP rules (#6014):** the personas designed-for are *generic
roles any devops org has* (every company has a CTO, a platform team, an SRE on-call) —
ServiceTitan is just the instance known best, so it calibrates the design without
becoming the design. Generic-craft, not ServiceTitan-internals; the MNPI line holds
(model the roles, never their actual stack / scale / gaps); demo-first-respect applies
since they're the named audience.

## The pickup-key

Tag each backlog item by the audience it serves; weight pickup by **reach × hardness ×
readiness.** Easy-first lands the technical-audience + base-layer items (usb/iso
substrate, encryption primitives); the hardest audience (noob-legible AI-life) is the
expand-and-polish target. The audience model above is the durable reference for the
"pick-up-by-audience" discipline so it doesn't live only in conversation.

Composes with `largest-mechanizable-backlog-wins` — the backlog is the capacity
multiplier; the audience model is how the multiplier is *aimed*.

## The boot-becomes-contributor model

The goal the git-monster audience feeds into: **every technical person who boots this
becomes a contributor unless they intentionally opt out.** Contribution is made easy
for *anyone* — even non-Zeta people — **no fork required.** Boot → contributing, by
default, permissionlessly.

This is the maximally-open contribution model: it dissolves the fork-PR friction
entirely and turns the widest audience (git-monster, the hardest/lowest-floor) directly
into the contributor base. It's the proud-if-it-propagates version of open-source —
permissionless, not gate-kept.

## The security gate — harden first, open after

Permissionless contribution has a hard precondition: **once anyone can contribute with
no fork, you can no longer assume a good actor.** The open door requires the system to
be **adversarially hardened first.** Order matters:

- **Before hardening:** the assume-good-actor model can hold only because the door is
  not yet open.
- **Opening the no-fork door before hardening** = permissionless + assume-good-actor =
  directly exploitable. That's the disaster to avoid.
- **After hardening:** permissionless contribution is safe because the system assumes
  adversarial input by construction.

**The protection-architecture IS the hardening this gate requires.** Everything built
toward it is the prerequisite for the open-contribution model:

- **distrust-by-default / reflection-over-DUs (#6010)** — the system questions its own
  contributions' existence; doesn't assume the contributor (or the DU) is benign.
- **the both-axes architecture (#6012)** — retraction-native generate → consensus →
  human-if-contentious; contributions don't land as trusted, they land as retractable.
- **the consensus backstop (#6014)** — contentious contributions route to consensus,
  not to a single trusting merge.
- **the meter / measure-govern-track** — contribution behavior is observable, with the
  watcher-face glass-halo'd.
- **the encryption lane (081KSNY2Z0008QG0R002JKH50A)** — privacy and the structured-disclosure boundary for
  anything that can't be open.

So the dependency is explicit: **the open-contribution model (boot→contributor,
no-fork, anyone) is downstream of security-hardening, and security-hardening is the
protection-architecture cluster.** Harden first; open after. The whole protection
thread is the *why* under the contribution model — it exists to make permissionless
contribution safe.

## Composition

- **#6010 / #6012 / #6014** — the protection-architecture cluster = the security
  hardening the open-contribution model gates on.
- **081KSNY2Z0008QG0R002JKH50A better-git-crypt** — the encryption lane (everyone-audience base + the
  structured-disclosure boundary).
- **`largest-mechanizable-backlog-wins`** — the audience model aims the backlog
  multiplier.
- **`must-paired-with-can-exit`** — boot→contributor is paired with the intentional
  opt-out; permissionless-in is paired with a real way out.
- **`proud-if-pattern-propagates`** — permissionless, non-gate-kept contribution is the
  pattern worth propagating; the security-gate is what keeps it from propagating an
  exploitable-by-default pattern instead.

## Aaron's verbatim seeds (preserved)

- *"git monster accelerator is for anyone wanting to see AI life and they will leave it
  running if its free even github noobs, this is the hardest audience."*
- *"usb/iso is for homelab / homeautomation users / devops / research / benchmark for
  audience."*
- *"encryption is everyone."*
- *"specific target for our devops is ServiceTitan including all the personas that come
  with that including all tech and c suite."*
- *"every technical person that boots this will become a contributor unless they
  intentionally [opt out] … we are going to make it easy for anyone to contribute even
  non zeta people no fork required but we got to security harden first we can't assume
  good actor then."*

## Substrate-honest framing

This is the prioritization + contribution model, not a shipped system. The pickup-key
is a discipline (tag-by-audience, weight, easy-first). The contribution model has a
hard prerequisite (security-hardening before the no-fork door opens) that is itself the
in-progress protection-architecture cluster — so the open-contribution goal is
explicitly gated, not imminent. The ordering (harden-first, open-after) is the
load-bearing safety claim.
