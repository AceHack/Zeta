# What a full rewrite cannot remove — binding dependencies, and the claims they quietly cap

**Agent:** Otto (shadow)
**Status:** RESEARCH — survey + analysis. No code, config, or boot path changed by this PR.
**Surveyed commit:** `620a1729cb5f6a5826e7da2cb8ee2b140295eb4a` (`origin/main`, 2026-08-14), own clone.
**Work-items minted:** `081M00QP33F087G0R001JKB5QM` · `081M00QP7FB087G0R00031BQ93` · `081M00QP7G7087G0R002PZB5T2`

---

## 0. The question, reframed

Aaron, 2026-08-14:

> "we are rewriting everything and all AI will be zeta code / ai generated eventually, some human
> written code but few and far between, i'm not worried about legacy, the only legacy we may look
> into is games."

He is right about *application* legacy. Midori's failure mode — a beautiful managed OS that could
not carry Win32 forward — does not transfer, because Zeta has no installed base to carry. But
"no legacy" and "no binding dependency" are different claims. This document asks the second one:

> **What does the stack depend on that we cannot rewrite, cannot replace, and cannot verify — and
> what does each of those cost us?**

The test applied to every row: **could a determined rewrite remove this dependency in a year?**
If yes, it is *rewritable* or *replaceable* and does not belong on the short list. If no, it is
**binding**, and the interesting question becomes what it costs and what it caps.

Every row is marked **CHECKED** (I read the file, fetched the source, or read the spec myself
during this survey) or **INFERRED** (reasoned from checked facts, not directly observed) or
**UNMEASURED** (needs a probe on real hardware that I did not run and will not run).

---

## 1. The short list — answer first

After rewriting every line of application code, these are the things Zeta still will not control.
Six items. Everything else on the long table is rewritable or replaceable at a nameable cost.

1. **The OEM Platform Key in each machine's UEFI firmware.** Only the vendor can authorize its
   replacement. Every node is permanently bound to the OEM that shipped its board. *(CHECKED —
   UEFI authenticated-variable semantics, restated below.)*
2. **The GPU's GSP firmware and CUDA userspace.** NVIDIA-signed, unreadable, unreplaceable. Even
   NVIDIA's *open* kernel module requires the closed GSP blob. *(CHECKED against NVIDIA's own
   documentation.)*
3. **The silicon vendor as the root of every attestation.** AMD ARK, Intel PCS/PCK, NVIDIA NRAS,
   and the TPM manufacturer's EK chain. Every hardware attestation Zeta could offer terminates in
   a self-signed vendor root. *(CHECKED.)*
4. **PKCS#11 as a standard.** No mechanism composes a FROST partial; the absence is structural,
   not a vendor gap. *(Already on file, CHECKED by Nazar 2026-08-14 against PKCS#11 v3.1.)*
5. **The cryptographic hardness assumptions themselves.** Discrete log for Ed25519/Schnorr/FROST;
   collision resistance for SHA-2/BLAKE3; the lattice assumptions behind ML-KEM/ML-DSA. Not code,
   so not rewritable in any sense. *(CHECKED that these are what the stack rests on; the
   assumptions are mathematics, not a dependency we chose.)*
6. **The frontier model doing the rewriting.** "All AI will be Zeta code" is a statement about the
   *output*. The *generator* is a rented cloud model. Local serving is written and explicitly
   deferred. *(CHECKED — `full-ai-cluster/README.md:204`.)*

Items 1–3 are hardware-vendor bindings. Item 4 is a standards binding. Item 5 is not a dependency
at all in the usual sense — it is the floor under the whole thing, and it belongs on the list
precisely because inventories of "what we use" never surface it. Item 6 is the one Aaron's framing
assumes away, and it is the largest.

**The pattern across 1, 2, and 3:** the deepest bindings are all *silicon vendors as roots of
trust*. That is the same shape as the Microsoft-CA-in-`db` tension already named in the secure-boot
work — but deeper, and unnamed until now.

---

## 2. The table

| Dependency | Verdict | What it costs | What it caps | Evidence |
|---|---|---|---|---|
| **OEM UEFI Platform Key** | **BINDING** | Permanent per-machine vendor tie; one manual firmware ceremony per node that no desired-state system can perform | "Ownership of the boot chain" is ownership of `db`/`KEK`, never of `PK` provenance | CHECKED — systemd `loader.conf` setup-mode requirement, restated in `2026-08-14-nixos-secure-boot-lanzaboote-*.md` §3.2 |
| **NVIDIA GSP firmware + CUDA userspace** | **BINDING** | The compute substrate under every BNN/inference workload is unreadable; no compute-competitive alternative exists | Any claim that the *computation* is auditable end-to-end | CHECKED — NVIDIA open-gpu-kernel-modules docs: open modules "must be used with GSP firmware ... from a corresponding driver release" |
| **Silicon vendor as attestation root** (AMD ARK / Intel PCK / NVIDIA NRAS / TPM EK) | **BINDING** | Every attestation Zeta issues has a centralized verifier at its root | Invariant 3 "attest, don't remember" (L3/L5 of the sovereign-keys ladder); §1 scale-free at the hardware layer | CHECKED — AMD KDS ARK→ASK→VCEK chain; Intel TDX PCK certs via Intel provisioning |
| **PKCS#11 (the standard)** | **BINDING** | ~$650/guard of HSM buys L1 at-rest sealing, not L2 use-without-extract | Ladder rung L2 as written; `usesWithoutExtract: true` has no inhabitant | CHECKED (Nazar, 2026-08-14, against PKCS#11 v3.1) |
| **Crypto hardness assumptions** | **BINDING** | Not purchasable, not rewritable; only hedgeable via agility | FROST, ZetaId, Merkle/BLAKE3 receipts, the whole signature lineage | CHECKED that `@noble/{curves,hashes,ciphers,post-quantum}` are the primitives in `package.json` |
| **Frontier model weights + inference service** | **BINDING today, replaceable at a capability cost** | Open-weight substitution is available and already scaffolded; the cost is the capability gap, not engineering | "We are rewriting everything" — the rewriter is rented | CHECKED — `full-ai-cluster/README.md:60-63,204`: ollama/vLLM/deepseek-coder/qwen-coder all `DEFERRED`, "we only care about cloud right now" |
| **Microsoft UEFI CA in `db`** | **CONDITIONALLY BINDING** — binding on nodes with a discrete GPU, avoidable elsewhere | Either an external centralized authority in the boot path, or risk the GOP option ROM not loading | Only the GPU nodes. Also *buys back* the shim-signed rescue path — the trade is symmetric | CHECKED — already correctly named in `2026-08-14-nixos-secure-boot-lanzaboote-*.md` §6.3 |
| **The Linux kernel** | **REPLACEABLE in principle, BINDING in practice** | Multi-quarter, and it takes containerd, Cilium/eBPF, iSCSI/Longhorn, and the GPU driver with it | The unikernel lane, for cluster nodes | CHECKED — already costed honestly in the same doc §8 |
| **NVIDIA proprietary *kernel module*** | **REPLACEABLE — cheaply** | `hardware.nvidia.open = true`. NVIDIA reports performance parity since R560 and defaults to open for Turing+ | Nothing, once switched. Currently `= false` by default | CHECKED — `full-ai-cluster/nixos/modules/gpu.nix:33` |
| **`MODULE_SIG=no` / no lockdown LSM** | **REPLACEABLE at real cost** | A custom kernel build with `SYSTEM_TRUSTED_KEYS`, maintained forever against nixpkgs | Extending the measured chain past the UKI | CHECKED — nixpkgs `nixos-25.11` `common-config.nix:820-823`, fetched during this survey |
| **k3s / containerd / Cilium CNI** | **REPLACEABLE at meaningful cost** | 147 files with a k8s `apiVersion:`, 151 files referencing k3s, plus Cilium's eBPF takeover of flannel + kube-proxy | Nothing claimed; a deliberate choice | CHECKED — counts run in this survey; `k3s-server.nix:50-52` |
| **.NET 10 / bun / Node / Rust / Zig / Go / JVM** | **REPLACEABLE** | Each oracle is one of N; losing one degrades the byte-lock quorum, it does not break the system | Nothing — this is what multi-oracle is *for* | CHECKED — `global.json`, `package.json`, `.mise.toml` |
| **`@noble/*` libraries** | **REPLACEABLE** | Audited, small, pure-TS; several drop-in alternatives per primitive | Nothing. The *algorithms* bind (row 5); the *library* does not | CHECKED — `package.json:68-71` |
| **GitHub** | **REPLACEABLE — already ported** | `src/Core.TypeScript/forge-host/` has `github/` and `gitlab/` behind one `registry.ts` | Nothing. Evidence the port discipline works | CHECKED |

---

## 3. The GPU lead — verified, and it does not say what it looked like it said

Aaron's lead: *"Can a node with a proprietary GPU driver ever reach measured/attested boot, or does
that driver permanently cap the rung?"*

**It does not cap it. The premise is wrong, and the real cap is one layer lower and worse.**

### 3.1 What is true

**CHECKED.** nixpkgs `nixos-25.11`, `pkgs/os-specific/linux/kernel/common-config.nix:820-823`,
fetched fresh during this survey (not restated from the prior doc):

```nix
MODULE_SIG = no; # r13y, generates a random key during build and bakes it in
# Depends on MODULE_SIG and only really helps when you sign your modules
# and enforce signatures which we don't do by default.
SECURITY_LOCKDOWN_LSM = no;
```

**CHECKED.** `full-ai-cluster/nixos/modules/gpu.nix:33` — `open = lib.mkDefault false`. The
proprietary out-of-tree module is what loads today.

So the prior finding stands: Secure Boot does not force module signing on this stack, and the
NVIDIA module loads unchanged. That much of the lead is confirmed.

### 3.2 Why the driver does not cap measured boot

Three facts, taken together:

- **CHECKED.** The NVIDIA module is not in the initrd. `worker-gpu/hardware-configuration.nix:16`
  sets `boot.initrd.kernelModules = [ "virtio_pci" "virtio_blk" ]`; `gpu.nix` adds no initrd
  modules. The driver loads post-boot from the store.
- **INFERRED** (from how measured boot works, not observed on a node): measured boot extends PCRs
  with firmware, bootloader, and the UKI's sections. A module loaded afterward from the root
  filesystem is not in that measurement — for or against.
- **CHECKED.** Signing an out-of-tree proprietary NVIDIA module and loading it under Secure Boot
  with lockdown enforced is routine on Ubuntu, Debian, and Fedora via MOK enrollment. It is not
  structurally forbidden.

**Conclusion: a node with a proprietary GPU driver can reach measured and attested boot.** The
driver is neither in the measured chain nor an obstacle to extending it. Writing "we can never
reach attested boot on a node with a proprietary GPU driver" into a roadmap would have been wrong,
and I am glad it was flagged as a lead rather than a fact.

What *does* stop the chain at the UKI is `MODULE_SIG = no` + no lockdown + no IMA — and that stops
it for **everything**, not for NVIDIA. It is a nixpkgs reproducibility decision, escapable with a
custom kernel build carrying `SYSTEM_TRUSTED_KEYS` (NixOS has no shim, so the MOK route other
distros use is unavailable; the key must be embedded at kernel build time). Costly and permanent
maintenance, but not binding. Work-item `081M00QP7G7087G0R002PZB5T2`.

### 3.3 The real cap, one layer lower

**CHECKED.** NVIDIA's open kernel modules "must be used with GSP firmware and user-space NVIDIA
GPU driver components from a corresponding driver release," and depend on the GSP first introduced
in Turing. The open module supports Turing/Ampere/Ada/Hopper and NVIDIA reports performance parity
from R560, where it became the default.

So `open = true` swaps a closed kernel module for source we can read — a real reduction of the
unauditable ring-0 surface, apparently free, and NVIDIA's own recommendation for the hardware in
hand. It does **not** remove the GSP firmware blob or the CUDA userspace. Both stay closed,
NVIDIA-signed, and unreplaceable.

**CHECKED.** The GPUs in hand are RTX 4090 and RTX 3090 (`docs/HARDWARE-CAPABILITY-MATRIX.md:26`,
Aaron 2026-06-11). NVIDIA's confidential-computing / GPU-attestation mode exists on H100, H200,
B200, GB200 — Hopper and Blackwell datacenter parts. **Not GeForce.**

**Therefore, the honest architectural fact, which is the one worth writing down before more
hardware is bought:**

> The node can be attested. The GPU cannot. On GeForce hardware there is no mechanism — at any
> price short of replacing the cards with datacenter parts — to prove what code ran on the GPU or
> that the VRAM was not read. And on the datacenter parts that *do* support it, the attestation is
> verified against **NVIDIA's own remote attestation service**, which is a centralized authority
> at the root of a decentralized system.

That is a stronger and more useful finding than the one that was suspected, and it reverses the
direction: the problem is not the driver on the host, it is the device itself, and buying the
"solution" buys a vendor dependency instead.

### 3.4 The nouveau / NVK / AMD question, answered

- **nouveau / NVK:** NVK is a Vulkan driver. There is no usable CUDA on the nouveau stack. For a
  BNN/inference workload this is not a performance cost, it is a **capability** absence — the
  workload does not run. Not an option.
- **AMD in-tree (`amdgpu` + ROCm):** the kernel driver is in-tree and open, which is a genuine
  improvement on the ring-0 auditability axis. But `amdgpu` still loads signed AMD firmware blobs
  (the same class of dependency as GSP), and the ROCm userspace is its own large stack. The
  binding moves from NVIDIA to AMD; it does not disappear. **INFERRED** — I did not benchmark, and
  the repo has no AMD hardware (`gpu.nix` header: "AMD ROCm + Intel oneAPI live in sibling modules
  (TODO when first AMD/Intel cards land)").

**No available GPU vendor gives an auditable compute path.** That is not a Zeta problem and not a
solvable one; it is the state of the industry, and the right move is to state it rather than
design around it.

---

## 4. The rows that needed scaling rather than judging

### 4.1 k3s — deliberate, and larger than "the join"

Aaron's framing — *"k3s's join is the join, don't invent our own"* — is a correct and well-anchored
decision about the *join*. Scaling the claim: **CHECKED**, 151 files reference k3s and 147 YAML
files carry a k8s `apiVersion:`. The CNI is Cilium, which replaces flannel *and* kube-proxy *and*
network-policy (`k3s-server.nix:50-52`) — so the networking layer is eBPF, i.e. a second, deeper
Linux-kernel binding underneath the first.

Verdict: **replaceable at meaningful cost, not binding.** The dependency is broad but shallow —
it is manifests and a join protocol, not algebra. Nothing in `src/Core*` depends on Kubernetes.
It does not belong on the short list, and calling it binding would make the list useless. But the
honest note is that it drags eBPF along, which raises the Linux-kernel row's real cost.

### 4.2 The runtimes — the multi-oracle design already paid for this

.NET 10.0.302, bun 1.3, Node 24, Rust 1.87, Zig 0.13, Go 1.26, Java 26, Python 3.14 — all
declaratively pinned in `.mise.toml` / `global.json`. **CHECKED.**

This row is the one where the architecture already did the work. The byte-lock story rests on
*agreement between independent oracles*, explicitly not on any one runtime
(`docs/PRIMITIVE-REGISTRY.md:24`). Losing .NET would cost two of four oracles and would hurt; it
would not invalidate a single golden vector. **Not binding, and the reason it is not binding is a
deliberate design property rather than luck.** Worth saying, because it is the template for what
"we handled this" looks like.

### 4.3 The crypto primitives — the libraries are not the dependency

`@noble/ciphers`, `@noble/curves`, `@noble/hashes`, `@noble/post-quantum` are all pinned at
`package.json:68-71`. **CHECKED.** These are small, audited, pure-TS, and each has drop-in
alternatives. Replaceable in days.

The binding is one level up and is not a package: **the hardness assumptions**. If discrete log
falls, FROST falls, and so does every identity and every signature in the lineage — no rewrite
touches that. The mitigation that exists is the one already partly taken: `@noble/post-quantum` is
in the tree, so algorithm agility is a live capability rather than a hope.

### 4.4 Entropy — an unmeasured cell, reported as unmeasured

Under §13 noninterference, "entropy enters only through declared, metered channels." The CPU's
`RDRAND` is neither declared nor meterable nor verifiable.

**CHECKED but inconclusive:** nixpkgs sets `RANDOM_TRUST_CPU` only `whenOlder "6.2"`
(`common-config.nix:815-817`), so on the 25.11 kernel the effective value comes from the upstream
defconfig, which I did not read. Whether RDRAND is credited for initial seeding on these nodes is
**UNMEASURED** — it needs `zcat /proc/config.gz | grep RANDOM_TRUST` on a real node, which I did
not run.

I am recording this as an open cell rather than guessing, because guessing here is exactly the
failure mode the brief called out.

#### 4.4a Cell closed 2026-08-17 — and the probe above would have answered it wrongly

Measured under `081M00QP7G7087G0R002PZB5T2`. **RDRAND is credited for the initial seed on these
nodes, unconditionally.** The cell resolves to *trusted*, not to *unknown*.

The correction that matters more than the answer: **`CONFIG_RANDOM_TRUST_CPU` does not exist in this
kernel.** Occurrences of `RANDOM_TRUST` in upstream `drivers/char/Kconfig` — v6.0: 2, v6.1: 2,
**v6.2: 0**, v6.6: 0, v6.12: 0. It was removed in 6.2, which is exactly the boundary nixpkgs'
`whenOlder "6.2"` encodes; that expression is a shim for kernels we do not run, not a live setting.
The behaviour stayed: `drivers/char/random.c` v6.12 has `static bool trust_cpu __initdata = true;`
with `early_param("random.trust_cpu", …)` as the only override, and the evaluated `kernelParams` for
all three cluster hosts set neither `random.trust_cpu=` nor `random.trust_bootloader=`.

So `zcat /proc/config.gz | grep RANDOM_TRUST` on a 6.12 node prints **nothing** and exits non-zero —
an empty result that reads as "not enabled" while the true state is "enabled and not expressible in
the config at all". A check that did not run, looking like one that passed. Do not run it; it
answers the opposite of the truth.

For §5.3 below this sharpens the ceiling from *un-metered* to **on by default and not switchable
from desired-state Nix config** — only from the kernel command line. Full measurement, method, and
the deliberate decision **not** to set `random.trust_cpu=0`:
`workitems/081M00QP7G7087G0R002PZB5T2-*.md` §6.

---

## 5. Which existing claims these quietly cap

This is the part that matters most. Each entry names a claim we make elsewhere and the ceiling a
binding dependency puts on it.

### 5.1 "Attest, don't remember" (invariant 3, sovereign-keys ladder L3/L5)

**Capped by:** the silicon vendor as attestation root.

The ladder's L3 gates guard cooperation on a workload attestation, and L5 has guards proving
"unmodified firmware on an unbreached enclosure" via remote-attestation heartbeats. Every
mechanism that can deliver those roots in a vendor's self-signed key: **CHECKED** — AMD SEV-SNP
reports chain VCEK → ASK → ARK with certificates from AMD's KDS; Intel TDX quotes chain to PCK
certificates from Intel's provisioning service; NVIDIA GPU attestation verifies via NRAS; TPM
attestation trusts the TPM manufacturer's EK certificate.

**The ceiling:** a decentralized system's strongest identity claim is *"AMD says this is genuine
AMD silicon running this measurement."* That is not nothing — it is a real and useful claim — but
it is not vendor-independent, and the design language around L3/L5 currently reads as though it
were. AMD is the least-bad of the four (VCEK derivation is deterministic, so certificates can be
cached and verification done offline — the *root key* is still AMD's). This is the same shape as
the Microsoft-CA tension in `db`, one layer deeper and, until now, unnamed.

**Recommended:** state the vendor root inline wherever an attestation claim appears, the way §6.3
of the secure-boot doc states the Microsoft-CA trade. Work-item `081M00QP7FB087G0R00031BQ93`.

### 5.2 "Secure Boot guarantees the kernel that booted is the one we signed"

**Capped by:** `MODULE_SIG = no` + no lockdown LSM + no IMA.

The secure-boot doc already states this honestly in §6.1 ("the chain of trust ends at the UKI ...
root can `insmod` anything"). I found nothing overstated. Recording it here so the *cap* is on one
list with the others: **any node attestation covers boot, not runtime.** The GPU driver is on the
unmeasured side of that line, along with everything else in userspace.

**Measured 2026-08-17 (`081M00QP7G7087G0R002PZB5T2`) — the cap is wider than "modules", and the
premise needed a correction.** Read out of the generated kernel config the cluster's own flake
resolves to (`/nix/store/4dq737q0ip6v1py1cqz6g9fw6kfnmkd4-linux-config-6.12.90`, shared by
`control-plane`, `worker-gpu` and `installer`):

- `CONFIG_KEXEC=y`, `CONFIG_KEXEC_FILE=y`, **`CONFIG_KEXEC_SIG` not set.** Root does not merely load
  a module into the signed kernel — root can **replace the running kernel** with an arbitrary
  unsigned image via `kexec`: no signature check, no reboot, no ESP write, no firmware interaction.
  "The kernel that booted is the one we signed" stays true and stops mattering one `kexec` later.
  The legacy `kexec_load` syscall is unrestricted regardless, because that restriction is a
  *lockdown* behaviour and lockdown is not compiled.
- `INTEGRITY_PLATFORM_KEYRING` and `LOAD_UEFI_KEYS` are **absent from the config entirely** (not
  `n` — never offered), because `INTEGRITY_SIGNATURE` and `SYSTEM_BLACKLIST_KEYRING` are off. So
  §3.2's "escapable with a custom kernel build carrying `SYSTEM_TRUSTED_KEYS`" is right but
  under-priced: four more symbols must come on before `LOAD_UEFI_KEYS` is even reachable.
- **The premise:** there is no UKI today. `lanzaboote` is not imported by any host
  (`081M00KTH58087G0R00120WT6F` is unshipped), so the chain does not *end* at the UKI — it does not
  start. This cap is a property of a **proposed** configuration.

Method, the full symbol table, and the observed-vs-documented split:
`workitems/081M00QP7G7087G0R002PZB5T2-*.md`. No boot was measured; none can be from a macOS host
with no TPM.

### 5.3 §13 noninterference — "entropy only through declared, metered channels"

**Capped by:** CPU RDRAND and the kernel CSPRNG.

The rule's own load-bearing guards are about `Task.Run` and ambient clocks — application-level
leaks, which is the right place for a rule to bite. But the floor underneath is a hardware entropy
source we cannot declare, meter, or audit. **The discipline is sound at every layer it can reach,
and cannot reach the bottom one.** Not a flaw in the rule; a ceiling worth writing next to it.
Measurement pending (§4.4).

### 5.4 §1 scale-free — "no central point of control/coordination/failure"

**Capped by:** OEM Platform Keys, and the vendor attestation roots.

At the software layer §1 holds and the design defends it well — per-node self-generated Secure
Boot keys with no fleet CA and no escrow (secure-boot doc §4.2) is exactly right. But every node's
firmware trust root is held by its board vendor, and every hardware attestation is verified against
a chip vendor. **§1 is a software-layer guarantee. It does not and cannot extend to the metal.**
The `own-soc` research lane (`2026-06-09-the-deepest-border-is-the-metal-*`) is the only thing
that would move this, and it is a decade-scale program.

### 5.5 "We are rewriting everything"

**Capped by:** the model doing the writing.

`full-ai-cluster/README.md:60-63` has manifests for ollama, vLLM, deepseek-coder, and qwen-coder,
all marked `DEFERRED`, with line 204 explaining: *"we only care about cloud right now."* **CHECKED.**

That is a defensible sequencing call, not an oversight. But it means the sentence "all AI will be
Zeta code / AI generated" currently describes output produced by a model Zeta neither runs, hosts,
inspects, nor could reproduce. The rewrite removes application legacy; it does not remove the
dependency on the rewriter.

The mitigation is real and already scaffolded — open-weight models exist and the manifests are
written. The cost is not engineering; it is the **capability gap** between a frontier model and
what a 4090/3090 pair can serve. That is the honest price, and it is worth naming as a price
rather than leaving it implicit in "deferred."

**This belongs on the roadmap as a dependency with a cost, not as a phase that will happen later.**

### 5.6 Ladder rung L2 — "use-without-extract for the signing op"

**Capped by:** PKCS#11's structure. Already CHECKED and correctly written up by Nazar; I am
listing it here only so the short list is complete. Buying HSMs at ~$650/guard delivers L1 with
better hardware, not L2.

---

## 6. What I did not check

Stated plainly, because an unmarked gap is worse than a marked one.

- **No hardware was touched.** No node was probed, no PCR read, no `bootctl status` run, no GPU
  benchmarked. Every hardware claim here is from a specification, a vendor document, or a file in
  the repo.
- **`RANDOM_TRUST_CPU`'s effective value** on the 25.11 kernel (§4.4). Needs a node.
- **`hardware.nvidia.open = true` in practice** on a 3090/4090 with our CUDA workload. NVIDIA
  claims parity; Fedora has reported at least one Turing-specific regression (Runtime D3). Needs a
  bench run before the flip. This is the whole content of work-item `081M00QP33F087G0R001JKB5QM`
  — the change is one line, the verification is the work.
- **Whether nixpkgs' kernel enables `INTEGRITY_PLATFORM_KEYRING` / `LOAD_UEFI_KEYS`.** They do not
  appear in `common-config.nix`; whether the defconfig provides them decides how expensive §3.2's
  custom-kernel route actually is. Not read.
- **The AMD/ROCm performance comparison** for the BNN workload (§3.3). No AMD hardware exists in
  the repo or on the bench.
- **`tools/setup/persona-keys/`, `infra/`, `full-ai-cluster/`, `src/Core.TypeScript/algebra/`** —
  read only, per the coordination constraint. Nothing in those trees was edited.

---

## 7. What I am *not* claiming

- Not claiming k3s, the runtimes, or `@noble` are binding. They are not, and inflating them would
  make the short list worthless.
- Not claiming the GPU driver caps attested boot. It does not (§3.2). The lead was a lead, and it
  was wrong in a way that mattered.
- Not proposing to drop NVIDIA, switch to AMD, or buy datacenter GPUs. Each of those trades one
  vendor binding for another; the analysis says name the ceiling, not chase an exit that does not
  exist.
- Not resolving the Microsoft-CA-in-`db` tension. It was correctly named as an unresolved trade and
  it stays unresolved here.

---

## 8. Sources

**Read in-repo at `620a1729c`:** `docs/research/2026-08-14-nixos-secure-boot-lanzaboote-declarative-desired-state-with-one-firmware-ceremony.md`
· `docs/research/2026-08-14-agent-sovereign-keys-incremental-ladder-L0-to-L6-destruction-not-leakage.md`
· `full-ai-cluster/nixos/modules/{gpu,k3s-server,k3s-agent}.nix`
· `full-ai-cluster/nixos/hosts/{worker-gpu,control-plane}/hardware-configuration.nix`
· `full-ai-cluster/README.md` · `docs/HARDWARE-CAPABILITY-MATRIX.md` · `docs/PRIMITIVE-REGISTRY.md`
· `package.json` · `global.json` · `.mise.toml` · `src/Core.TypeScript/forge-host/`

**Fetched upstream during this survey:** `NixOS/nixpkgs` branch `nixos-25.11`,
`pkgs/os-specific/linux/kernel/common-config.nix` (lines 815–823 read directly).

**Vendor / standards documentation consulted:** NVIDIA open-gpu-kernel-modules documentation and
driver-installation guide (GSP firmware requirement, Turing+ support, R560 transition); NVIDIA
confidential-computing documentation (H100/H200/B200/GB200 scope, NRAS); AMD SEV-SNP attestation
(ARK→ASK→VCEK via KDS); Intel TDX attestation (PCK certificates); distribution guides for signing
out-of-tree NVIDIA modules under Secure Boot with MOK (Ubuntu/Debian/Fedora).

**Prior anchors already in the tree:** UEFI Secure Boot authenticated-variable semantics via
systemd `man/loader.conf.xml`; PKCS#11 v3.1 (Nazar's check, 2026-08-14); Goguen–Meseguer 1982
(noninterference, via `.claude/rules/dv2-data-split-discipline-activated.md` §7).
