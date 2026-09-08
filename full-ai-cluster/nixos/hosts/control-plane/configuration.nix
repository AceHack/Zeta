# full-ai-cluster/nixos/hosts/control-plane/configuration.nix
#
# K3S server + ArgoCD bootstrap. Cilium CNI takes over from flannel.
# No GPU on this host — control-plane stays lean.

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
    ../../modules/k3s-server.nix
    ../../modules/docker.nix
    ../../modules/local-storage.nix
    # CLUSTER-SCOPED, declared here because only a SERVER can apply it.
    # `services.k3s.manifests` writes to /var/lib/rancher/k3s/server/manifests and the
    # k3s deploy controller submits them — an agent writes the files and nothing reads
    # them. This DaemonSet used to be declared ONLY on worker-gpu (role = "agent"), so
    # it was never applied and GPUs were never advertised to the scheduler
    # (081M1XXA0FC087G0R002F92ZQC). The DaemonSet already carries
    # `nodeSelector: zeta.io/gpu: <vendor>`, so declaring it from a GPU-less control
    # plane is correct: the scheduler places it on the nodes that have the hardware.
    ../../modules/gpu-device-plugin.nix
    # Iter-4 credential substrate (per B-0789):
    ../../modules/initial-password.nix      # zeta user has known initial password (rotate on first login)
    ../../modules/operator-ssh-keys.nix     # operator pubkey(s) injected by zeta-install.sh from USB
  ];

  networking.hostName = "control-plane";

  # The CLUSTER's GPU vendor mix, not this host's. The control plane needs no GPU to
  # declare the plugin; it needs only to be the node that can apply a manifest.
  zeta.gpu-device-plugin = {
    enable = true;
    vendors = [ "nvidia" ];
  };

  # B-0850 Phase 3 refactor: enable AI agent systemd services on
  # control-plane. Operator framing 2026-05-27:
  #   "we should have three systemd agents and the cluster running on
  #   bootup"
  #   "the mutual repair is critical too because of you can see your
  #   own future self boot script failures"
  #
  # The parameterized zeta-ai-agent.nix module supports ≥3 vendor-
  # diverse personas (otto/alexa/riven/vera/lior); each opt-in
  # independently. Currently only otto enabled — alexa/riven/vera/
  # lior enable as B-0850 Phase 3 sub-rows (3a-3d) ship per-vendor
  # install + login flows for each. Target state at pc-two is ≥3
  # personas enabled for mutual-repair + self-modification-safety
  # BFT margin.
  #
  # Services deliberately run OUTSIDE k8s as systemd units (not as
  # k8s pods) so they can repair cluster issues from outside the
  # failure domain ("control plane outside the control plane"
  # architectural pattern). Operator can disable any persona via
  # `systemctl disable zeta-<persona>` per NCI HC-8 revocable consent.
  zeta.aiAgents.enable.otto = true;
  zeta.aiAgents.enable.lior = true;     # B-0850.3d SHIPPED (Gemini CLI 2nd vendor)
  zeta.aiAgents.enable.vera = true;     # B-0850.3c SHIPPED (Codex 3rd vendor — hits ≥3 BFT floor: Anthropic + Google + OpenAI)
  # zeta.aiAgents.enable.alexa = true;  # B-0850.3a pending (Kiro/Qwen)
  # zeta.aiAgents.enable.riven = true;  # B-0850.3b pending (Grok)

  # Static IP recommended so worker nodes have a stable serverAddr.
  # Per-site override here:
  #   networking.interfaces.eth0.ipv4.addresses = [{
  #     address = "192.168.1.10";
  #     prefixLength = 24;
  #   }];
  #   networking.defaultGateway = "192.168.1.1";
  #   networking.nameservers = [ "1.1.1.1" "9.9.9.9" ];
}
