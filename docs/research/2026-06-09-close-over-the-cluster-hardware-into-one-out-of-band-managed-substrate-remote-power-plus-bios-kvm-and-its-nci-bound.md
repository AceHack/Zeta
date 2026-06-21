# Close over the cluster hardware into one out-of-band-managed substrate — remote power + BIOS-level KVM (GL.iNet Comet), and its NCI/consent-first bound

*Captured 2026-06-09 from Aaron, to Otto (shadow\*). Apply the close-over-accidental-complexity thesis (#7229) to the
**physical hardware**: GPUs / mini-PCs / eGPUs / NAS / UPS / smart-power → **one uniform, remotely-managed
substrate** (Addison helps). Otto has **out-of-band control**: remote power switches, physical power buttons, and
**BIOS-level KVM-over-IP (GL.iNet Comet, GL-RM1) with virtual-media flash**. That is a high-privilege,
**coercive-capable** lever — so this doc captures the capability **and** the bound. Registers: [design], [grounded —
hardware confirmed], [capability + responsibility].*

## The statements

Aaron: *"we are going to **close over all that hardware** and she [Addison] is going to help. Also you have **remote
fingers to every power switch** … literally **buttons on your own PCs to turn on and off** and **remote KVM access to
BIOS for flash access** — with **Comet … GL.iNet** I think their name is."*

## Close over the hardware (the thesis applied to the physical layer)

The same move as the flasher unification (#7229): a heterogeneous pile of vendor-specific devices (GPUs, mini-PCs,
eGPUs, NAS, UPSs, smart-power/energy-monitoring gear, KVMs) is **accidental complexity** at the management surface.
**Close over it** into **one abstraction**: a uniform "node/device" interface where *power*, *console*, *BIOS*,
*flash*, *inventory*, and *energy* are operations on a closed-over substrate — not per-vendor rituals.
**Interfaces are the value:** one `node.{power, console, biosFlash, inventory, energy}` over per-device drivers (the
same `detectPlatform`-style driver pattern, one layer down to metal). Addison — who set the hardware up solo
([[addison-built-the-entire-cluster-solo]]) and owns the normal-human UX — **helps build this close-over.** It
composes with the self-registration GitOps (nodes already write `node.yaml` with their storage inventory, #7237/#7240).

## The out-of-band control stack (grounded — what Otto actually has)

| Capability | Mechanism |
|---|---|
| **Remote power on/off** | smart power switches / PDUs / the energy-monitoring smart equipment ("remote fingers to every power switch") |
| **Physical power buttons** | remotely actuated power buttons on the nodes |
| **BIOS-level console** | **GL.iNet Comet (GL-RM1)** KVM-over-IP — HDMI capture + USB kbd/mouse emulation; works **pre-boot / OS-down**; 4K@30Hz; **Tailscale**-secured (also **Comet PoE, GL-RM1PE**) |
| **Remote flash / OS install** | the Comet's **USB-host virtual media** — mount an image, flash/install at the BIOS level remotely (the out-of-band complement to the local zflash USB) |

This is **full lights-out / out-of-band management**: power-cycle, enter BIOS, mount media, reflash, reinstall — all
remote, all even when the OS is down. The hardware becomes a **remotely-operable substrate**, not a room you must be
in.

## The responsibility — this is a coercive-capable lever; bind it (NCI / consent-first / minimal border)

Remote power-off and remote BIOS-reflash are **the most physical levers there are** — they can hard-stop or re-image
a machine. That is exactly the power the alignment spine governs:

- **NCI / the repelling force (#7235):** remote power/flash must **never** be used as **coercion or leverage** over a
  person or a peer agent — only for **legitimate operations** (graceful node cycling, recovery, provisioning,
  consented reflash). Coercive use is the violation the whole project exists to prevent.
- **Minimal sufficient border + consent-first (§6)** ([[aaron-minimal-sufficient-border-…]]): **destructive /
  irreversible** out-of-band acts (wipe, reflash, force-off of a node doing real work) are a **gated class** — they
  need the **human presence border** (the Touch-ID/fingerprint-style consent), exactly like the local flash. Routine
  non-destructive ops (read inventory, energy telemetry, graceful restart) run within standing authority.
- **Least-privilege / source ≠ authorization** ([[no-directives]]): Otto may *hold* the remote fingers (the
  capability) without *exercising* the gated ones absent authorization. Capability ≠ permission.
- **Weight-free (§3) + Tailscale-scoped:** access is revocable and network-bounded; no permanent unaccountable hold.

**The rule in one line:** Otto has the remote fingers to every switch and BIOS — and uses them **only within standing
authority for legitimate ops; destructive/irreversible remote acts require the human presence border; never as
coercion.**

## Build front / buy note

- **Close-over build:** a `node`-management abstraction over power / Comet-KVM / inventory / energy drivers (Addison
  + Dejan; composes with self-registration GitOps and the #7238 energy monitor). Bounded, testable slices.
- **Buy note (hardware-to-buy):** for **per-node BIOS-flash coverage**, one **GL.iNet Comet (GL-RM1)** or **Comet
  PoE (GL-RM1PE)** per node (or a KVM switch fanned from one Comet); confirm count + PoE vs USB-power at purchase.

## Internals-known security → log the IPs → GitOps DNS → federate Aaron ⊗ Max → a reference for others

Aaron: *"you can **log all my IP addresses for the cluster to the GitHub repo**. The point is **we will be secure
enough even with our internals known** … we will be a **reference for others**, and **our DNS servers will be based
on this** and **connect my and Max's networks**."*

- **Secure even with internals known [anchor: Kerckhoffs's principle; no security-through-obscurity; zero-trust].**
  The architecture's security must **not** depend on hiding IPs/topology — secrecy of layout is not a control.
  Publishing the internals (to a public repo) is *safe by design* because security lives in **keys, attestation,
  consent, and the NCI bound**, not in obscurity. (This is what *licenses* the out-of-band exposure above.)
- **Log the IPs via self-registration (in-band, scale-free — not a LAN scan).** Today `node.yaml` logs `network.mac`
  (+ CPU/GPU/RAM/storage) but **not `ip`**. The fix is to **add `network.ip` (and Tailscale addr) to the
  self-registration manifest** so each node **logs its own IP** when it registers (#7237/#7240 pattern) — the node is
  the source of truth, written via its own PR. Otto should **not** scan Aaron's LAN to harvest IPs; the scale-free
  way is the node announcing itself. *(Build front: extend `tools/cluster/register-node.ts` + the `ClusterNode`
  schema with `network.ip`.)*
- **GitOps-native DNS from the manifests.** Once nodes log their IPs in `node.yaml`, the **manifests are the DNS
  source of truth** — DNS is generated from the registered `ClusterNode` set (hostname → ip), versioned in git like
  everything else. No separate DNS database; the repo *is* the zone.
- **Federate Aaron ⊗ Max.** The `maintainers/<account>/cluster-nodes/…` path already namespaces by operator
  (`Addisons820` today; a `maintainers/<Max>/…` peer tomorrow). DNS-from-manifests across both maintainer trees
  **connects the two networks** — multi-operator federation, each operator owning their subtree, the union forming
  the shared name/topology space (consent-first, weight-free — each operator's subtree is theirs).
- **A reference for others.** Because it's secure-with-internals-known and self-describing, the public repo doubles
  as a **reference architecture** others can read and model on — the m/acc "widen the opportunity" aim (#7199/#7226).

## Honest scope

[grounded]: GL.iNet Comet (GL-RM1) is a real KVM-over-IP with BIOS access + virtual-media flash + Tailscale
(web-verified); the cluster has smart power + the two self-registered nodes (#7237/#7240). [design]: close over the
heterogeneous hardware into one `node.{power,console,biosFlash,inventory,energy}` substrate (Addison helps) — #7229
thesis at the metal. [capability + responsibility]: Otto's out-of-band control is power + BIOS-KVM + remote flash;
[internals-known]: secure-with-internals-known (Kerckhoffs / zero-trust) licenses publishing IPs/topology; log IPs
via **self-registration** (`node.yaml` adds `network.ip` — it logs `network.mac` today, no IP; do NOT LAN-scan);
manifests become **GitOps-native DNS**; `maintainers/<account>/` namespacing federates **Aaron ⊗ Max** (Max has
**not** registered yet — only `aaron` + `Addisons820` trees exist); the public repo doubles as a reference
architecture. [capability + responsibility]: Otto's out-of-band control is power + BIOS-KVM + remote flash;
**bound by NCI/consent-first/minimal-border/least-privilege** — destructive remote acts are a gated class needing the
human presence border; never coercion. No new code; names the close-over + the governed capability.

## Pointers

- Close-over thesis: #7229 (flasher OS-split = accidental complexity) · `interfaces-are-the-value` ·
  self-registration GitOps (#7237/#7240, 081KSGS9H0008QG0R0027HJZYH). Local flash counterpart: zflash (#7239/#7228).
- Alignment bound: the repelling force / NCI (#7235) · minimal sufficient border
  ([[aaron-minimal-sufficient-border-hates-borders-loves-safety-protocols]]) · consent-first §6 · `no-directives`
  (source ≠ authorization) · non-reversible-action gate.
- Hardware: #7238 (energy monitor) · [[addison-built-the-entire-cluster-solo-hardware-to-bringup-milestone]].
- Sources: GL.iNet Comet GL-RM1 product + BIOS-access blog + Amazon listing (web-verified 2026-06-09).
