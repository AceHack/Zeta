# full-ai-cluster/nixos/hosts/worker-gpu/configuration.nix
#
# Worker template. Per physical worker, duplicate this file under
# nixos/hosts/worker-gpu-NN/, add a per-host hardware-configuration,
# and add a nixosConfigurations.worker-gpu-NN entry to flake.nix.
#
# This template runs: NVIDIA GPU + container-toolkit + K8s device
# plugin + Docker + local storage. VFIO passthrough OFF by default
# (enable per-host).

{ config, pkgs, lib, ... }:

{
  # ── Seal / rotation role ────────────────────────────────────────
  #
  # DECLARED, not inferred. `host-seal-profile.nix` defaults every host to
  # `undeclared`, which is a deliberate no-op: no pcscd, no YubiHSM udev, no
  # packages, no assertions. That default is why the entire hardware-consent
  # path has been DARK on every real host -- not unwired to the ceremonies,
  # switched off one level below them.
  #
  # `prod-metal` is the role that matches the standing constraint (Aaron
  # 2026-09-08): the hardware should be "completely controlled by the AI and
  # the code after bootup", with human intervention only through declared
  # remote interfaces. Read what the role actually selects, from
  # `host-seal-model.nix`:
  #
  #   automaticRotationRequired = true    <- rotation must be machine-driven
  #   fidoRotationAllowed       = false   <- a forgotten YubiKey cannot rotate
  #   biometricRotationAllowed  = false   <- NO fingerprint, no body at console
  #   enablePcscd               = true    <- the smartcard reader stack comes up
  #   enableYubiHsmUdev         = true    <- the HSM is addressable
  #
  # The two `false`s are the point as much as the two `true`s. `developer`
  # would enable FIDO and biometric userspace, which is exactly the console
  # presence this cluster is designed not to need.
  #
  # THE MODULE ASKS FOR A MEASUREMENT FIRST -- "flip the role on a real host
  # after measuring hardware" -- and one now exists:
  # `docs/research/2026-09-08-first-real-hsm-hardware-capture-two-vendors-attached.md`
  # records two readers on this box, both with cards present: a Yubico
  # YubiKey FIDO+CCID, and an Identiv uTrust Token Flex carrying a
  # SmartCard-HSM v4.1 already provisioned with a `zeta-test-token`. Two
  # vendors, present and initialised.
  #
  # HONEST LIMIT: that capture was taken on macOS, on the box that is about to
  # be reformatted into this host. It establishes that the DEVICES exist and
  # are provisioned; it does not establish that NixOS enumerates them, because
  # nothing has ever booted this configuration. It also found the two OS
  # surfaces disagreeing -- `opensc-tool -l` saw both readers while
  # `security list-smartcards` reported none -- so a probe on this side must
  # not treat one silent surface as absence.
  #
  # Declaring the role does not assert the hardware is present at build time;
  # it brings up the stack that can SEE it. With `undeclared`, a device in the
  # reader could not be reached no matter what any probe reported.
  zeta.hostSeal.boxRole = "prod-metal";

  imports = [
    ./hardware-configuration.nix
    ../../modules/common.nix
    ../../modules/k3s-agent.nix
    ../../modules/gpu.nix
    ../../modules/gpu-passthrough.nix
    ../../modules/docker.nix
    ../../modules/local-storage.nix
  ];

  networking.hostName = "worker-gpu";

  # Cluster join target. Override per-site.
  services.k3s.serverAddr = "https://control-plane:6443";

  # The GPU device plugin is declared on the CONTROL PLANE, not here. It installs via
  # `services.k3s.manifests`, which only a k3s SERVER applies — declared on this
  # role="agent" node the files were written and nothing read them, so GPUs were never
  # advertised to the scheduler (081M1XXA0FC087G0R002F92ZQC). This node still provides
  # the hardware-level half: drivers, the containerd runtime, and the `zeta.io/gpu`
  # label the DaemonSet's nodeSelector targets.

  # VFIO passthrough disabled by default. Enable + list PCI IDs
  # per-host when you want a GPU bound to vfio-pci for VM workloads.
  zeta.gpu-passthrough = {
    enable = false;
    pciIds = [ ];   # e.g. [ "10de:2204" "10de:1aef" ]
  };

  # Per-host node labels — let the scheduler target hardware specs.
  services.k3s.extraFlags = lib.mkAfter [
    # "--node-label=zeta.io/gpu-model=rtx-4090"
    # "--node-label=zeta.io/gpu-count=2"
  ];

  users.users.zeta.openssh.authorizedKeys.keys = [
    # "ssh-ed25519 AAAAC3Nz... aaron@zeta"
  ];
}
