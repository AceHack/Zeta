# infra/

Declarative desired-state for the Zeta AI cluster. Every machine,
every package, every Kubernetes workload reachable from this
directory. The flake at the repo root is the entry point.

```
infra/
├── nixos/
│   ├── modules/                  ← shared NixOS modules
│   │   ├── common.nix            ← baseline imported by every host
│   │   ├── k3s-server.nix        ← K3S control-plane role
│   │   ├── k3s-agent.nix         ← K3S worker role
│   │   └── gpu.nix               ← NVIDIA driver + container toolkit
│   └── hosts/                    ← per-machine configurations
│       ├── installer/            ← USB bootable ISO
│       ├── control-plane/        ← K3S server + ArgoCD bootstrap
│       ├── worker-gpu-01/        ← NVIDIA AI worker
│       └── worker-gpu-02/        ← NVIDIA AI worker
└── k8s/
    ├── bootstrap/                ← K3S auto-applies on first boot
    │   ├── argocd-namespace.yaml
    │   ├── argocd-install.yaml   ← pinned ArgoCD v2.13.2
    │   └── initial-orleans.yaml  ← scaled-to-0 Orleans skeleton
    └── applications/             ← ArgoCD watches recursively
        ├── root-application.yaml ← App-of-Apps root
        ├── orleans/              ← distributed-chron substrate
        ├── gitlab/               ← post-bootstrap Git host
        ├── argoworkflows/        ← DAG job scheduler
        └── argorollouts/         ← progressive delivery
```

## Bootstrap (start to running cluster)

### 1. Build the installer ISO

```bash
# From any machine with Nix installed (canonical AI-cluster installer
# substrate at full-ai-cluster/usb-nixos-installer/ — root-flake
# installer-iso package retired 2026-05-26 in USB cleanup PR 2):
cd full-ai-cluster && nix build .#installer-iso
# Output at result/iso/zeta-installer-*.iso
```

### 2. Write it to a USB stick

```bash
# macOS (recommended): zflash — Touch ID + random nonce + SSH key auto-inject
bun src/Core.TypeScript/zflash/cli.ts

# Linux / Windows fallback:
sudo dd if=result/iso/zeta-installer-*.iso of=/dev/sdX bs=4M status=progress conv=fsync
```

Replace `/dev/sdX` with the USB device (check with `lsblk`).

### 3. Boot the target machine on the USB

Console root access (no password, console-only — secure default).
Bring up the network:

```bash
nmtui
# or:
nmcli device wifi connect <SSID> password <PSK>
```

### 4. Clone Zeta + install

```bash
# Partition + mount /mnt as desired (parted / gptfdisk / cryptsetup
# / zfs / etc — all tools are on the stick).
git clone https://github.com/Lucent-Financial-Group/Zeta /mnt/etc/zeta

# Generate per-machine hardware config:
nixos-generate-config --root /mnt
cp /mnt/etc/nixos/hardware-configuration.nix \
   /mnt/etc/zeta/infra/nixos/hosts/<host>/hardware-configuration.nix

# Install:
nixos-install --flake /mnt/etc/zeta#<host>

# Reboot — done. K3S + ArgoCD + Orleans land automatically.
```

Where `<host>` is one of `control-plane`, `worker-gpu-01`, `worker-gpu-02`,
or any future host declared in `/flake.nix` <!-- STALE-REF: ../flake.nix --> `nixosConfigurations`.

## Bootstrap order (what the cluster does on first boot)

1. **Control-plane boots** → K3S server starts with embedded etcd
2. K3S applies `infra/k8s/bootstrap/argocd-namespace.yaml`
3. K3S applies `infra/k8s/bootstrap/argocd-install.yaml` — a `helm.cattle.io/v1`
   HelmChart CR — and K3S's Helm Controller installs argo-cd chart 7.7.10
   (ArgoCD v2.13.2) → ArgoCD pods come up
4. K3S applies `infra/k8s/bootstrap/initial-orleans.yaml` → Orleans namespace + skeleton StatefulSet
5. K3S applies `infra/k8s/applications/root-application.yaml` → App-of-Apps root.
   This one FAILS on its first attempt and that is expected: its
   `argoproj.io/v1alpha1` CRD ships with ArgoCD, so until step 3 finishes the
   API server has no such resource. K3S's addon controller retries every ~15 s
   and it applies once the CRDs land.
6. ArgoCD reads root Application → discovers child Apps via include glob
7. ArgoCD reconciles `orleans/`, `gitlab/`, `argoworkflows/`, `argorollouts/` in parallel
8. **Workers boot** → K3S agents join via `serverAddr = https://control-plane.zeta.local:6443` (scheme is required; NixOS `services.k3s.serverAddr` accepts only `https://`)
9. Pods schedule onto workers based on `zeta.io/gpu=nvidia` node labels

After step 9 the cluster is self-managing. Every subsequent change
lands by committing to this repo.

Steps 2–7 above were **measured**, not assumed, on 2026-08-18: a real K3S
v1.31.4+k3s1 server was booted with exactly the four manifests
`services.k3s.manifests` declares, and reached `zeta-root  Synced  Healthy`
with all seven child Applications discovered. Run
`bun infra/k8s/tests/validate-bootstrap.ts` before touching that set —
the same boot against the **previous** `argocd-install.yaml` produced
`ApplyManifestFailed: the server could not find the requested resource`
retried forever, zero ArgoCD pods, and no reconciliation at all.

### Not yet witnessed by anything

Steps 1, 8 and 9 are `unmetered` — implemented, documented, never falsified.
No CI job evaluates the root flake's `nixosConfigurations`, so the per-host
NixOS configs (including the `hardware-configuration.nix` stubs whose stated
purpose is "so `nix flake check` succeeds in CI") are checked by hand or not
at all; and there is **no root `flake.lock`** despite this flake's own header
claiming "the flake.lock pins the entire universe", so two installs of the
same commit on different days do not resolve the same nixpkgs. Neither is
fixed here. Both are real, and neither is a reason to trust steps 1/8/9 the
way steps 2–7 can now be trusted.

## Add a new workload

```bash
mkdir infra/k8s/applications/<name>/
$EDITOR infra/k8s/applications/<name>/Application.yaml
git add . && git commit -m "feat(infra): add <name>" && git push
# ArgoCD picks it up on next sync (~3 min)
```

## Add a new host

1. `mkdir infra/nixos/hosts/<host>/`
2. Author `configuration.nix` (copy from an existing worker as template)
3. Add a `nixosConfigurations.<host>` entry to `flake.nix`
4. Boot the machine on the USB, generate hardware config, install

## Update ArgoCD / Orleans / GitLab / Argo Workflows / Argo Rollouts

Bump the `targetRevision` in the corresponding `Application.yaml` and
commit. ArgoCD reconciles automatically.

## Secrets

Tokens, passwords, and certs use `sops-nix` or `agenix` (TBD —
follow-up PR). Until then:

- **K3S cluster token** must be present at the correct per-role path
  on every node before K3S starts:
  - Server nodes: `/var/lib/rancher/k3s/server/token`
  - Agent nodes:  `/var/lib/rancher/k3s/agent/token`

  Generate once on the first server (`openssl rand -hex 32`) and
  distribute the SAME value to all server + agent nodes. K3S refuses
  to start if the token is missing.
- GitLab initial root password: create the `gitlab-initial-root-password`
  Secret in the `gitlab` namespace before its Application syncs
- SSH keys: add to `users.users.zeta.openssh.authorizedKeys.keys`
  in each host's `configuration.nix`

**Never commit plaintext credentials to this repo.**

## devShell — admin from your workstation

```bash
nix develop
# Brings up a shell with kubectl, helm, k9s, argocd, jq, yq, sops, age, etc.
```

## Design

Every text file in this directory is the desired state. The flake
is the source of truth: the cluster reconciles toward what's
declared here, and drift gets corrected on the next sync cycle.
Nothing about the cluster's bootstrap lives outside this repo.

Post-bootstrap workloads (anything that lands after GitLab is
running) migrate to the self-hosted GitLab — but the bootstrap
path itself stays here, so a full cluster rebuild is always
reproducible from this one repo.
