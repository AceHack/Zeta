---
id: 081M00QP33F087G0R001JKB5QM
type: task
state: backlog
priority: P2
slug: switch-gpu-nodes-to-hardware-nvidia-open-true-shrink-the-una
title: "Switch GPU nodes to hardware.nvidia.open = true — shrink the unauditable ring-0 surface to GSP firmware only"
created: 2026-08-14T18:13:56.463Z
depends_on: []
composes_with: []
---

# Switch GPU nodes to hardware.nvidia.open = true — shrink the unauditable ring-0 surface to GSP firmware only

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00QP33F087G0R001JKB5QM-*.md` glob. -->
## Why

`full-ai-cluster/nixos/modules/gpu.nix:33` sets `open = lib.mkDefault false` — the closed
out-of-tree kernel module. NVIDIA's open kernel modules support Turing/Ampere/Ada/Hopper, report
performance parity, and became the default from the R560 driver release. The cards in hand
(RTX 4090 + RTX 3090, `docs/HARDWARE-CAPABILITY-MATRIX.md:26`) are both in scope.

Flipping this replaces an unreadable ring-0 blob with source. It does **not** remove the GSP
firmware blob or the CUDA userspace — both stay closed and NVIDIA-signed. The binding moves; it
does not disappear. That is the point: this is a cheap reduction of unauditable surface, not a
solution to the vendor binding.

## The work is the verification, not the change

The change is one line. What earns the flip:

1. Confirm the pinned `nvidiaPackages.production` version is >= R560.
2. Bench the BNN/inference workload before and after on one GPU worker. NVIDIA claims parity;
   Fedora has reported at least one Turing-specific regression (Runtime D3 with open kernel +
   GSP). Consumer Ampere/Ada is expected clean but has not been measured here.
3. Confirm CUDA, the container toolkit, and a GPU pod schedule unchanged.
4. Roll one node first, per the same sequencing the secure-boot work uses.

## Not claimed

This does not improve attestation. The module is not in the measured chain either way (the initrd
carries only `virtio_*`; the driver loads post-boot from the store). This is an auditability
change, not a trust-chain change.

## Anchor

`docs/research/2026-08-14-what-a-full-rewrite-cannot-remove-binding-dependencies-and-the-claims-they-cap.md` §3.3

---

## Status 2026-08-16 — gate built, flip NOT made, blocked on which-GPU-is-in-which-box

Item stays open. Step 1 is done and measured; the flag was deliberately not flipped.

### Step 1 — driver version: CONFIRMED, mechanically

`nvidiaPackages.production` at the pinned `nixpkgs` rev (`b77b3de8775677f84492abe84635f87b0e153f0f`,
`nixos-25.11`) is **580.142**, well past the R560 line. Read out of the pinned rev, not asserted:

```
nix eval --impure --raw --expr 'let f = builtins.getFlake "github:NixOS/nixpkgs/b77b3de…"; \
  p = import f { system = "x86_64-linux"; config.allowUnfree = true; }; in p.linuxPackages.nvidia_x11.version'
# => 580.142
```

### The measured closure delta

The upstream nixpkgs `nvidia.nix` module under `nixos/modules/hardware/video/` at that rev makes
exactly one substitution:
`boot.extraModulePackages = if open then [ nvidia_x11.open ] else [ nvidia_x11.bin ]`.
Evaluated against **this repo's own** `gpu.nix`, both ways:

| `hardware.nvidia.open` | package in `boot.extraModulePackages` | `meta.unfree` | license | on cache.nixos.org |
|---|---|---|---|---|
| `false` (today) | `nvidia-x11-580.142-6.12.90` (`bin` output) | **true** | `unfreeRedistributable` | **no — 404** |
| `true` | `nvidia-open-6.12.90-580.142` | **false** | `GPL-2.0-or-later` + `MIT` | yes, NarSize **23,949,280 B**, 0 refs |

So the number is: **the unfree package count in `boot.extraModulePackages` goes 1 → 0** — the whole
of that surface, not a fraction of it — and the replacement is source-built from
`NVIDIA/open-gpu-kernel-modules` at tag `580.142`, whose source nar is **126,145,240 B** of readable
code standing where an opaque prebuilt `.ko` was.

A second, unlooked-for gain: the closed `bin` output is **not in the public binary cache** (404),
while the open module **is** (200). The flip moves the ring-0 artifact from vendor-blob-at-install
to a hash-locked, publicly-reproducible build.

**What does NOT leave, so the claim stays bounded.** `nvidia-x11-580.142-6.12.90` (the `out`
userspace: libGL, libnvidia-*) stays unfree and stays in the closure. The GSP firmware output is
also still unfree and also not cached (404) — and GSP is loaded *today* regardless, since
`hardware.nvidia.gsp.enable` already defaults true for driver >= 555. `nvidia-settings`,
`nvidia-persistenced`, `nvidia-container-toolkit` and the whole `cuda*` set are untouched: the
`allowUnfreePredicate` in `gpu.nix` is unchanged by this work. The binding moves; it does not
disappear — exactly as the "Not claimed" section above says.

### Why the flip did not happen: no host in this repo has a known GPU

All four GPU host configurations — `full-ai-cluster/nixos/hosts/worker-gpu`,
`.../worker-template`, `infra/nixos/hosts/worker-gpu-01`, `worker-gpu-02` — carry a **PLACEHOLDER**
`hardware-configuration.nix`, and every `--node-label=zeta.io/gpu-model=…` line in them is commented
out. Nothing in the repo says which card is in which box.

The three inventory surfaces do not close the gap either:

- `inventory/items/` (the audited register) — **one** GPU: an RTX 4090.
- `docs/HARDWARE-CAPABILITY-MATRIX.md` — prose, no per-node binding.
- `docs/inventory/hardware-2026-05-27-addison-draft.md` — 19 NVIDIA cards
  (5090 ×1, 4090 ×1, 3090 ×4 incl. one "uncertain provenance", 3080 Ti ×6, 3060 Ti ×4, 3060 ×3)
  plus 5 AMD RX 6700 XT = the 24 GPUs the sibling item counts. **Every NVIDIA card on that list is
  Ampere or newer**, i.e. nothing pre-Turing appears anywhere in the fleet — which is genuinely good
  news for this item. But the draft is self-flagged unreliable, Addison is **redoing** it
  (`081M00R59KS087G0R001W3837V`), and it maps cards to *the house*, never to *a node*. "Probably no
  pre-Turing card exists" is not "this node's cards are Turing+".

This item is therefore **blocked on `081M00R59KS087G0R001W3837V`** — or, more cheaply, on one
operator running the preflight below on one node. It does not need the whole register reconciled;
it needs one node's silicon named. (Not duplicating that item's work here.)

### The correction the roster forces: `open = false` is not the safe default

The RTX 5090 on the roster is Blackwell, and NVIDIA ships **no proprietary kernel module** for
Blackwell — the open modules are required there. So on a node holding that card, today's
`open = lib.mkDefault false` is not the conservative setting, it is the **broken** one. The flag is
wrong in both directions depending on hardware nobody has recorded, which is the actual finding.

### What shipped instead of the flip

1. `tools/nvidia-open-preflight.ts` — run on a candidate node while the **closed** module is still
   loaded; gates on driver-reported CUDA compute capability **>= 7.5**. Capability rather than a
   PCI-ID table because NVIDIA device IDs are not ordered by architecture, so any local table rots
   silently; 7.5 rather than 7 because **Volta is 7.0/7.2 and has no GSP** — the one case a
   `major >= 7` shortcut passes and the open module then cannot bind.
2. `{full-ai-cluster,infra}/nixos/modules/nvidia-open-guard.nix` — two gates.
   **Eval time:** `open = true` without `zeta.gpu.openModulePreflight.passed` (and non-empty
   `.evidence`) fails the build, so the flip cannot land in review unattested.
   **Boot time:** a oneshot unit verifies every NVIDIA display-class PCI function actually has a
   driver bound (`vfio-pci` accepted as deliberate passthrough), catching a wrong-generation node
   even if the attestation was wrong or a card was swapped later.
3. Both `gpu.nix` files keep `open = lib.mkDefault false`, with the stale comment
   ("works on RTX 20-series and newer", silent on Blackwell) replaced by the measured position.

The preflight was first written as `nvidia-open-preflight.sh` under `tools/`, and the bash-retirement
inventory guard rejected it. It was **rewritten in TypeScript rather than allowlisted**, because
the allowlist's stated bar is "runs before Bun is available", and that is factually not this
script's situation: `full-ai-cluster/usb-nixos-installer/zeta-install.sh` Step 6.95a runs
`tools/setup/install.sh` on the pre-cloned repo, which routes NixOS to mise and provisions the
`.mise.toml`-pinned bun for the `zeta` user. The preflight is an operator diagnostic run long after
that, so bun is present and no allowlist entry would have been truthful. The one thing here that
genuinely must run bun-free — the boot-time driver-bound check — is inline systemd shell inside
`nvidia-open-guard.nix` depending on nothing but coreutils, which is the right side of that line.

### Still unexercised — do not read this item as verified

Steps 2, 3 and 4 above are untouched. **No GPU ran any of this.** Not benchmarked, no CUDA check,
no container-toolkit check, no GPU pod scheduled, no node rolled. The boot-time guard has never
executed on real hardware. What *is* verified is the eval behaviour (all four gate states, both
module trees) and the preflight's decision logic against stubbed rosters, including a mutation run
proving the 7.5 threshold test can go red.
