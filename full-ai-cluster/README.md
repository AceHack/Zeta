# full-ai-cluster

End-to-end declarative AI cluster. Starts with the USB bootstrap
(`./usb-nixos-installer/`) and continues through every layer up to
running AI workloads.

**One flake.** `./flake.nix` is the *only* definition of the installer
ISO — `nix build .#installer-iso` from **this** directory is what CI
builds and what an operator should run. `usb-nixos-installer/` holds the
installer's NixOS configuration, not a flake of its own
(081KZKS9A6B08QG0R0008EG72M).

## What's inside

```
full-ai-cluster/
├── usb-nixos-installer/        ← installer NixOS config (no flake of its own)
├── flake.nix                   ← THE flake: installer ISO + host configs + linux-builder
├── nixos/
│   ├── modules/                ← shared NixOS modules
│   │   ├── common.nix
│   │   ├── k3s-server.nix      ← K3S control-plane (flannel disabled for Cilium)
│   │   ├── k3s-agent.nix       ← K3S worker
│   │   ├── gpu.nix             ← NVIDIA drivers + container toolkit
│   │   ├── gpu-passthrough.nix ← VFIO passthrough for VM workloads
│   │   ├── gpu-device-plugin.nix ← K8s device plugin (NVIDIA/AMD/Intel)
│   │   ├── docker.nix          ← Docker via NixFlake
│   │   └── local-storage.nix   ← local-path-provisioner storage class
│   └── hosts/
│       ├── control-plane/      ← configuration.nix + hardware + README
│       └── worker-gpu/         ← configuration.nix + hardware + README
└── k8s/
    ├── bootstrap/              ← K3S auto-applies on first boot (dependency order)
    │   ├── cilium-namespace.yaml
    │   ├── cilium-install.yaml      ← 1. Cilium (CNI + Hubble + Service Mesh + BPF MASQUERADE)
    │   ├── cert-manager-install.yaml ← 2. cert-manager (TLS for Vault)
    │   ├── vault-install.yaml       ← 3. Vault (secrets backend)
    │   ├── spire-install.yaml       ← 4. SPIRE (workload identity)
    │   ├── trust-manager-install.yaml ← 5. Trust Manager (CA bundle dist)
    │   ├── external-secrets-install.yaml ← 6. ESO (Vault → K8s Secret sync)
    │   ├── argocd-namespace.yaml
    │   ├── argocd-install.yaml      ← 7. ArgoCD
    │   └── root-application.yaml    ← App-of-Apps root
    └── applications/           ← ArgoCD watches recursively
        ├── cilium/             ← CNI + Hubble + Cilium Service Mesh + BPF MASQUERADE
        ├── cert-manager/       ← TLS cert issuance
        ├── vault/              ← runtime secrets engine
        ├── spire/              ← SPIFFE workload identity
        ├── trust-manager/      ← CA bundle distribution
        ├── external-secrets/   ← Vault → K8s Secret sync
        ├── sealed-secrets/     ← encrypted secrets at rest in git
        ├── orleans/            ← distributed cron #1
        ├── temporal/           ← distributed cron #2 (TS)
        ├── dapr/               ← distributed cron #3 (actors)
        ├── gitlab/             ← self-hosted Git host (default-on)
        ├── forgejo/            ← self-hosted Git host (manual-sync alt)
        ├── argo-workflows/     ← DAG job scheduler
        ├── argo-rollouts/      ← progressive delivery
        ├── longhorn/           ← distributed block storage
        ├── minio/              ← shared S3 blob store (default consumer target)
        ├── seaweedfs/          ← shared S3 blob store (A/B alt; same namespace)
        ├── cockroachdb/        ← distributed SQL
        ├── hindsight/          ← agent persistent memory for Hermes (vectorize-io OCI chart)
        ├── oz/                 ← OpenZiti zero-trust overlay
        ├── hermes/             ← custom AI agent (cloud LLMs via SOPS-baked keys, OZ transport, Hindsight memory)
        ├── ollama/             ← LLM serving (option A — local — DEFERRED, manual-sync)
        ├── vllm/               ← LLM serving (option B — high-throughput — DEFERRED, manual-sync)
        ├── deepseek-coder/     ← model deploy → Ollama or vLLM (DEFERRED with local)
        ├── qwen-coder/         ← model deploy → Ollama or vLLM (DEFERRED with local)
        ├── kube-prometheus-stack/ ← Prometheus + Grafana + Alertmanager
        ├── nats/               ← messaging
        ├── redis/              ← cache
        ├── weaviate/           ← vector DB
        ├── loki/               ← logs
        ├── tempo/              ← traces
        ├── alloy/              ← OpenTelemetry collector
        ├── mimir/              ← long-term metrics storage
        └── open-policy-agent/  ← admission policy

# Istio REMOVED — Cilium Service Mesh (in the cilium/ Application
# above) provides the same L7 capabilities (mTLS, traffic shifting,
# Gateway API, ingress controller, observability) natively atop
# the CNI without a sidecar.
```

## Two layers, two reconcilers

- **OS layer** is reconciled by **Nix + NixOS**. Everything in
  `./nixos/` lands on a target machine via `nixos-install --flake`
  (initial install) or `nixos-rebuild switch --impure --flake` (updates).
- **Cluster layer** is reconciled by **ArgoCD**. K3S auto-applies
  the bootstrap manifests at `./k8s/bootstrap/` on first boot
  (Cilium → ArgoCD → root Application); ArgoCD then reads
  `./k8s/bootstrap/root-application.yaml` (App-of-Apps) and
  reconciles every workload under `./k8s/applications/` from the
  same Git repo every ~3 minutes.

This split is intentional: anything that must run BEFORE the
cluster API exists (kernel modules, CNI host setup, container
runtime, GPU drivers, K3S itself, base packages, storage class
host bits) belongs in Nix. Everything else belongs in K8s manifests
ArgoCD reconciles.

## Bootstrap end-to-end

### 1. Build the installer ISO (one-time, on your workstation)

```bash
cd full-ai-cluster
nix build .#installer-iso
# Output: ./result/iso/zeta-installer-24.11.iso (~1.5-2 GB)
```

If you're on Apple Silicon and don't yet have the linux-builder
running, apply the nix-darwin config first:

```bash
nix run nix-darwin/nix-darwin-25.11#darwin-rebuild -- switch --flake .#zeta-mac
```

### 2. Write to USB stick

```bash
# macOS:
diskutil list
diskutil unmountDisk /dev/diskN          # N = your USB device number
sudo dd if=result/iso/zeta-installer-*.iso of=/dev/rdiskN bs=4m status=progress
diskutil eject /dev/diskN

# Linux:
lsblk
sudo dd if=result/iso/zeta-installer-*.iso of=/dev/sdX bs=4M status=progress conv=fsync
sync
```

(Or use Balena Etcher / Rufus for a GUI — same outcome.)

### 3. Install on each target machine

Boot the target on the USB stick. Then at the console:

```bash
# Network up:
nmtui

# Pick the target disk + partition (parted/gptfdisk/zfs all on the stick).
# Example minimal layout (single ext4 + EFI):
sgdisk --zap-all /dev/sda
sgdisk -n 1:0:+512M -t 1:ef00 -c 1:boot /dev/sda
sgdisk -n 2:0:0     -t 2:8300 -c 2:nixos /dev/sda
mkfs.fat -F 32 -n boot /dev/sda1
mkfs.ext4 -L nixos /dev/sda2
mount /dev/disk/by-label/nixos /mnt
mkdir -p /mnt/boot && mount /dev/disk/by-label/boot /mnt/boot

# Clone the cluster flake:
git clone https://github.com/Lucent-Financial-Group/Zeta /mnt/etc/zeta

# Generate per-machine hardware config and copy into the host dir:
nixos-generate-config --root /mnt
cp /mnt/etc/nixos/hardware-configuration.nix \
   /mnt/etc/zeta/full-ai-cluster/nixos/hosts/<host>/hardware-configuration.nix

# Seed the K3S cluster token (control-plane only on first run):
nixos-enter --root /mnt -- bash -c '
  mkdir -p /var/lib/rancher/k3s/server
  openssl rand -hex 64 > /var/lib/rancher/k3s/server/token
  chmod 600 /var/lib/rancher/k3s/server/token
'
# (Copy this token to /var/lib/rancher/k3s/agent/token on every worker)

# Install:
nixos-install --flake /mnt/etc/zeta/full-ai-cluster#<host>
# <host> = control-plane | worker-gpu | ...

# Reboot. K3S, Cilium, ArgoCD, all workloads come up declaratively.
reboot
```

### 4. Verify the cluster is alive

After the control-plane reboots:

```bash
ssh zeta@control-plane.zeta.local
sudo kubectl get nodes
sudo kubectl -n argocd get pods
sudo kubectl -n argocd get applications
sudo cilium status
sudo cilium hubble enable --ui   # if not already enabled by Helm values
```

### 5. Add more machines

Repeat step 3 on each machine with the appropriate `<host>` name.
Add new `nixosConfigurations.<host>` entries to `flake.nix` as needed.

## Component status

- ✅ Well-defined upstream charts (Cilium, ArgoCD, Temporal, GitLab,
  Forgejo, Argo Workflows / Rollouts, Longhorn, CockroachDB, NATS,
  Redis, Weaviate, Loki / Tempo / Alloy / Mimir, kube-prometheus-stack,
  Istio, OPA, Sealed Secrets, Vault, OpenZiti)
- 🟡 Custom workloads needing maintainer input:
  - **Hermes** — Aaron-built AI agent oriented at cloud LLM APIs
    (Anthropic, OpenAI, etc.) with SOPS-baked keys + OZ transport
    + Hindsight memory backend. Image build + push are maintainer
    responsibility; the manifest scaffold + env vars are wired.
  - **Orleans Silo** — custom Silo image embedding your grain code.
- ⏳ Deferred (local-models phase — wait for now per "we only care about cloud right now"):
  - Ollama, vLLM, Deepseek Coder, Qwen Coder Applications stay
    in the tree at `replicas: 0` so the topology is preserved.
    Bump replicas + rebuild Hermes against local endpoints when
    the local-models phase comes back online.
- ✅ **Hindsight** wired: vectorize-io OCI Helm chart at
  `ghcr.io/vectorize-io/charts/hindsight` v0.3.0. Bundled
  PostgreSQL by default (longhorn-backed); swap to external
  CockroachDB once that Application is healthy. Reachable at
  `http://hindsight-api.hindsight.svc.cluster.local` — the chart
  names its Services `<release>-api` / `-control-plane` /
  `-postgresql`, never plain `hindsight`.
  - ❌ **The LLM key is NOT wired.** This line claimed a
    "Vault-backed ExternalSecret (`hindsight-llm-api-key`)" from
    PR #4913 until 2026-08-22, and there was never such an object:
    `grep -rn "kind: ExternalSecret" full-ai-cluster infra` returns
    nothing, and the Application's `api.llm.existingSecret` was a key
    chart 0.3.0 does not read, so it rendered nothing either. The
    chart's real key is a TOP-LEVEL `existingSecret: <name>` consumed
    as `envFrom`, so the Secret must carry `HINDSIGHT_API_LLM_API_KEY`
    as a KEY NAME. Wiring it before the ExternalSecret exists would
    hold the api AND control-plane pods in `CreateContainerConfigError`
    (chart 0.3.0 renders `envFrom` on both).
  - **And the ExternalSecret is not the only missing piece** — measured
    2026-08-22. There is no `ClusterSecretStore` either: no manifest in
    `full-ai-cluster` or `infra` declares one, only a commented-out
    sketch in `applications/external-secrets/Application.yaml`. Vault
    has never been initialised on metal (`applications/vault/TOPOLOGY.md`
    §2), and the CI-side ephemeral init (#13391) is scoped to
    **unsealing only** — `init` → `unseal` ×3 → `token revoke -self`,
    with no auth mount, no policy and no KV write — so it leaves an
    unsealed, empty Vault and is not a secrets path. Five layers, not
    one; the enumeration and the maintainer decision it needs live in
    `k8s/applications/hindsight/Application.yaml`.

## Secrets

- **Sealed Secrets** — store encrypted secrets directly in Git,
  decrypted by the controller at apply time. Good for low-churn
  config-style secrets.
- **HashiCorp Vault** — runtime secrets injection via the Vault
  Agent or external-secrets operator. Good for high-churn secrets
  + rotation + audit.
- **SOPS** — file-level encryption (age/gpg/KMS); used for
  Hermes-image-time secrets baked at Docker build per your spec.

All three coexist deliberately: different secrets have different
lifetimes + access patterns.

## Component composition

| Component | NixFlake or ArgoCD | Notes |
|---|---|---|
| NixOS + bootloader | Nix | USB installer |
| K3S | Nix (per-host module) | flannel + servicelb disabled (Cilium takes over) |
| Cilium | ArgoCD | KPR, Hubble Relay + UI, BPF MASQUERADE enabled |
| Docker | Nix (per-host module) | for non-K8s container workloads |
| Local-path storage | Nix (per-host module) | host-path PV for stateless workloads |
| GPU drivers (NVIDIA) | Nix (per-host module) | proprietary driver, container toolkit |
| GPU passthrough (VFIO) | Nix (per-host module) | for VM workloads on the same hosts |
| GPU device plugin (K8s) | Nix (per-host module) | exposes `nvidia.com/gpu`, `amd.com/gpu`, `intel.com/gpu` to pods |
| Everything else | ArgoCD | reconciled from `k8s/applications/` |

The Cilium choice DISPLACES K3S's default flannel CNI. The
control-plane's `k3s-server.nix` passes `--flannel-backend=none`
and `--disable-network-policy` to K3S; Cilium owns CNI, kube-proxy
replacement, and network policy.

## Updating the cluster

- **OS layer** changes: edit the relevant file under `./nixos/`,
  commit, push. Then on each target:
  `sudo nixos-rebuild switch --impure --flake /etc/zeta/full-ai-cluster#<host>`
- **Cluster layer** changes: edit the relevant `Application.yaml`
  or referenced manifest, commit, push. ArgoCD reconciles within
  ~3 minutes.

For a full cluster rebuild from scratch: this directory IS the
desired state. Wipe everything, rerun the bootstrap, end up at
the same place.
