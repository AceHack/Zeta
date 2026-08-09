# The society is ONE thread — four tick sources, auto-heal by redundancy

**Source:** Aaron (streamed, 2026-08-09), ferried by Otto (shadow*).
**Status:** design direction — captures the target topology. Parts exist today; parts do not.
Anchored to real substrate below so the "exists vs planned" line stays honest.

---

## The carved statement

> *"we already have this running on github actions/workflows for free now, we want to
> integrate and enhance this to work so our society is one thread."*
>
> *"we can have 3 or 4 linux services outside k8s to host our society without any k8s at all,
> this can grow over time to a k8s replacement but for now its just for tick sources without
> k8s, we will have tick sources in k8s too, we also have browser tab tick sources too that
> vera has been working on all day today to harden into close to full zeta node."*
>
> *"we want to notice failure fast and also have auto heal built in … so it can auto heal the
> transient stuff like our free github agents society does too. These are just mostly cron/tick
> sources for our free agent society and our zetadb."*

Two claims, and the second is the load-bearing one:

1. **Tick sources are plural and heterogeneous** — GitHub Actions, bare Linux services, k8s
   pods, browser tabs.
2. **They are not four systems. They are one society with four substrates.** The integration
   work is what makes "one thread" true rather than aspirational.

## The four tick sources, and what actually exists

| # | Substrate | Exists today | Anchor |
|---|---|---|---|
| 1 | **GitHub Actions** (free) | **YES — running** | `.github/workflows/agent-heartbeat.yml` — cron `*/15 * * * *`, matrix over personas, resets the heartbeat branch from `main` so *staleness is impossible by construction*, runs an observe tick against a local Ollama model. Siblings: `inventory-heartbeat.yml`, `tick-metrics.yml`. |
| 2 | **Bare Linux services** (3–4, no k8s) | **NO — planned** | Intended to host the society with no k8s at all, and to *grow into a k8s replacement over time*. Today it is explicitly scoped to tick sources only. |
| 3 | **k8s pods** | **PARTIAL** | `full-ai-cluster/nixos/modules/zeta-ai-agent.nix` — per-persona systemd units (otto/alexa/riven/vera/lior), opt-in per persona. Cluster nodes exist; the in-cluster agent harness does not yet run the society. |
| 4 | **Browser tabs** (Vera) | **PARTIAL — substantial** | `src/Core.TypeScript/browser-node/` (32 files): service-worker runtime + registration + channel, tab coordinator, multitab fixture, BroadcastChannel, IndexedDB checkpoint, room checkpoint, lifecycle host, PWA build, runtime probe. Being hardened toward "close to a full Zeta node." |

Note what #4 already implies: a browser tab with a service worker, IndexedDB checkpointing and
cross-tab coordination is not a toy client — it has persistence, lifecycle, and coordination.
That is most of what "node" means here.

## Auto-heal by redundancy, not by cleverness

The redundancy shape Aaron named is **3 outside k8s + 3 inside k8s**, running *the same free
agent stack*. The mechanism is deliberately dumb: if a tick source dies, others keep ticking, and
the dead one rejoins. This is the property the GitHub-Actions half already demonstrates in
production, and the reason it is the reference implementation rather than the legacy one.

Two disciplines make redundancy safe here, both already carved:

- **Idempotency (#6 / manifesto §12).** N tick sources ticking the same society must equal one
  tick's *effect*, or redundancy manufactures duplicates instead of resilience. This is the same
  reason Z-set merge takes counting-with-retraction and buys effectively-once at the application
  layer via dedup keys, rather than baking idempotence into the algebra.
- **Local time never enters the shared fold.** Four substrates with wildly different clocks —
  a GitHub runner, a NixOS node, a browser tab that was suspended for six hours — MUST NOT let
  local wall-clock filter what enters the shared belief fold, or they diverge by construction.
  A browser tab is the sharpest case: tab suspension makes its local clock arbitrarily wrong.

## "Notice failure fast" is the other half of auto-heal

Auto-heal without detection degrades silently: the system keeps limping and reports green.
That failure mode is not hypothetical here — it was just paid for (081KZETP6AT). A first-boot
`install.sh` failure was non-fatal by design (correct for the artifact) but **nothing asserted on
it**, so a fully-provisioned node and a node with no toolchain at all both reported "passed."
A *deterministic* failure read as "a rare transient blip" for weeks.

The rule that came out of it, and that the tick-source fleet should inherit:

> **Grace in the artifact, strict in the test.** Retry/auto-heal absorbs transients; the
> assertion fires only on genuine exhaustion. A retry that recovers stays green; a retry that
> exhausts must shout. An auto-heal layer with no acceptance assertion is a silent-failure
> generator.

## What "one thread" requires (the actual integration work)

Four substrates are one society only if they share these. Each is a design question, not a
settled answer:

1. **One identity space** — a tick from a browser tab and a tick from a k8s pod must be the same
   persona acting, not two look-alikes. (`writer-actor-routing-model`: persona = owner / what
   remains; actor = clone/loop / what acts; a bus address is not identity.)
2. **One fold** — ticks converge into the same commutative belief fold regardless of origin.
3. **One ledger** — work claimed by one substrate is not re-done by another (idempotency keys).
4. **One liveness signal** — "the society is alive" must not be per-substrate, or three dead
   substrates plus one alive reads as healthy.

## Dependency note (why the USB work is upstream of this)

Tick sources #2 and #3 both require a cluster node that can provision itself. Until 081KZETP6AT
(NixOS has no FHS loader ⇒ mise's prebuilt toolchains cannot `execve`) was fixed, neither could
run the agent stack at all — the node came up with no `bun`, no runtimes, no agent CLIs. That fix
(`programs.nix-ld`, PR #10196) is therefore a precondition for half the topology above, which is
the honest reason the USB trajectory blocks the society topology rather than being adjacent to it.

## Pointers

- `.github/workflows/agent-heartbeat.yml` — the working reference implementation (#1).
- `src/Core.TypeScript/browser-node/` — Vera's browser node (#4).
- `full-ai-cluster/nixos/modules/zeta-ai-agent.nix` — per-persona systemd units (#3).
- `full-ai-cluster/usb-nixos-installer/nixos/modules/foreign-binaries.nix` — the nix-ld
  precondition (#2/#3).
- `.claude/rules/local-time-never-enters-the-shared-fold.md` — the four-clock hazard.
- `.claude/rules/dv2-data-split-discipline-activated.md` §6 idempotency — the redundancy guard.
- `docs/writer-actor-routing-model.md` — persona vs actor, why a routing address is not identity.
- Workitems: `081KZETP6AT` (nix-ld root cause), `081KZKV16YF` (from-installer hash pin — the
  vendor CLIs every tick source substrate installs).
