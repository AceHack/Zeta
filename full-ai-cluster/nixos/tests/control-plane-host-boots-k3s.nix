# full-ai-cluster/nixos/tests/control-plane-host-boots-k3s.nix
#
# WP20 — THE FAST, PRECISE ORACLE FOR THE REAL DEFECT. Boots the SAME
# `nixosConfigurations.control-plane` host the USB installer builds and asks
# the one question no test in this directory had ever asked: does k3s.service
# become active on the FULL host config, not just on the k3s-server.nix module
# in isolation?
#
# THE FINDING THIS TEST IS FOR
# -----------------------------
# Run 35717757526 (build-ai-cluster-iso.yml, scenario "WP11 installed-disk
# first-boot k3s verify") ran `nixos-install --flake .../full-ai-cluster#control-plane`
# for real, booted the INSTALLED disk with network, and k3s.service NEVER
# reached `active` in 4201s (the verify unit's own deadline). Every other VM
# test in this directory boots k3s-server.nix (or a couple of sibling modules)
# DIRECTLY -- none of them ever imports `hosts/control-plane/configuration.nix`
# whole, so none of them has ever exercised the FULL import graph: secure-boot,
# host-seal, tpm2-seal-prereqs, three AI-agent systemd services
# (otto/lior/vera), avahi, samba, docker, the k3s/longhorn/cilium-wireguard
# preflights, zeta-creds-restore/self-register/first-session, and injected-*.
# Every one of those is a candidate ordering-graph participant the smaller
# tests structurally cannot see.
#
# WHY THIS TEST DOES NOT COPY A MODULE LIST
# -------------------------------------------
# `imports = [ ../hosts/control-plane/configuration.nix ];` below is not a
# paraphrase of `flake.nix`'s `nixosConfigurations.control-plane` -- it is the
# exact same single-element module list `mkSystem` uses for that output
# (`flake.nix` line ~124-128: `modules = [ ./nixos/hosts/control-plane/configuration.nix ];`).
# `configuration.nix` itself pulls in `common.nix` (which pulls in every
# shared module) plus its own k3s-server/docker/local-storage/gpu-device-plugin/
# initial-password/operator-ssh-keys imports, so importing that one file IS
# importing the whole graph. There is no second copy of the list to drift.
#
# THE TWO DELIBERATE DEVIATIONS FROM `nixosConfigurations.control-plane`, AND
# WHY EACH ONE IS SAFE
# -----------------------------------------------------------------------------
#   1. `stateVersion` is not threaded through the flake's `inputs`/`specialArgs`
#      (nixosTest's node modules don't carry them). `common.nix` declares
#      `stateVersion ? "25.11"` with a Nix-level default, and the ORIGINAL
#      version of this file assumed that default would just apply, cosmetically,
#      leaving `system.stateVersion` at "25.11" instead of the flake's "26.05".
#      MEASURED WRONG (run 35741126744): `nixos/modules/tasks/swraid.nix`
#      forces `config.system.stateVersion` for its own compat check BEFORE
#      common.nix's `mkDefault stateVersion` line supplies a value, and
#      `pkgs.testers.nixosTest`'s `evalModules` call does not resolve an
#      absent, defaulted specialArg the way plain function application would
#      -- it throws `attribute 'stateVersion' missing`. Fixed below with an
#      explicit `_module.args.stateVersion = "26.05";` on `nodes.server`,
#      which both fixes the eval AND restores full fidelity (the real "26.05",
#      not the assumed-safe "25.11" fallback). Checked
#      (`grep -rl stateVersion nixos/modules/*.nix`): the only OTHER consumer
#      of the value once supplied is that same `system.stateVersion =
#      lib.mkDefault stateVersion;` line -- unrelated to k3s or systemd
#      ordering.
#   2. `virtualisation.{memorySize,cores,diskSize}` are VM-only options with no
#      hardware equivalent -- every other VM test in this directory sets them,
#      and this host boots MORE (avahi, samba, docker, k3s, three AI-agent
#      services, the full byte-lock toolchain closure) than any of them, so
#      it is sized at least as generously as the heaviest existing lane
#      (k3s-first-boot-roster.nix: 10240 MB / 4 cores / 32768 MB disk).
#
# WHY THIS TEST MUST BOOT THROUGH THE REAL BOOTLOADER (`useBootLoader` /
# `useEFIBoot`), AND WHY THE ORIGINAL VERSION OF THIS FILE WAS WRONG NOT TO
# ---------------------------------------------------------------------------
# MEASURED 2026-09-22 (architect-requested negative control, run 35742067241,
# claude/control-plane-host-vm-boot-repro WITHOUT the k3s.service fix): this
# test did NOT reproduce run 35717757526's finding. k3s.service reached
# `active` in 0.30s, with zero ordering-cycle evidence -- a clean pass, on the
# UNFIXED config, which is exactly the false-positive risk the architect
# warned about ("green because the test config differs from the ISO-installed
# system, not because of the fix").
#
# ROOT CAUSE OF THE GAP: `pkgs.testers.nixosTest`'s DEFAULT boot path
# (`virtualisation.useBootLoader = false`) boots the built `toplevel` directly
# via QEMU `-kernel`/`-initrd`, skipping UEFI firmware, the boot manager, and
# systemd-boot entirely. The REAL WP11 harness does not:
# `src/Core.TypeScript/ci/qemu-full-install-test.ts`'s
# `buildQemuK3sVerifyBootArgsPure` boots the installed qcow2 disk through
# real OVMF firmware (`-drive if=pflash,...OVMF_CODE...` /
# `...OVMF_VARS...`) with `bootindex=1` on the disk -- the same path a real
# machine's UEFI takes: firmware -> boot manager -> systemd-boot -> a REAL
# initrd mounting a REAL disk. The original version of this file's "NOT
# overridden, and why" section claimed `hardware-configuration.nix` and
# `boot.loader.*` were safely irrelevant under nixosTest's default path --
# true only in the sense that they evaluate without error, and exactly the
# wrong thing to accept once the goal is reproducing a boot-timing-sensitive
# defect. Fixed below: `virtualisation.useBootLoader = true;` and
# `virtualisation.useEFIBoot = true;` make this test build a real disk image
# and boot it through OVMF + systemd-boot, the same chain WP11 exercises --
# at real cost (a slower build and boot; see the COST section).
#
# WHAT IS DELIBERATELY *NOT* OVERRIDDEN, AND WHY
# -------------------------------------------------
#   * `hardware-configuration.nix` -- NOT replaced with a VM-specific stub.
#     The committed file (`hosts/control-plane/hardware-configuration.nix`) is
#     ITSELF already a QEMU-shaped placeholder (`lib.mkDefault` fileSystems on
#     `/dev/disk/by-label/{nixos,boot}`, virtio_pci/virtio_blk initrd modules)
#     kept so `nix flake check` passes pre-install, and it is now actually
#     EXERCISED (see the bootloader note above) rather than merely evaluated,
#     so it needs no VM-specific replacement.
#   * `boot.loader.*` (systemd-boot / EFI vars) -- `common.nix` already sets
#     `boot.loader.systemd-boot.enable = lib.mkDefault true;` and
#     `efi.canTouchEfiVariables = lib.mkDefault true;`, which is exactly what
#     `useBootLoader`/`useEFIBoot` need to find in place; nothing to add here.
#   * `/etc/zeta/*` installer-written fixtures (cluster-node-id, join-server,
#     cluster-segment, initial-hashedpassword, operator pubkeys, cred blobs)
#     -- NOT staged. Every module that reads one of these is gated by
#     `builtins.pathExists` at EVAL time (injected-hostname.nix,
#     injected-cluster-address.nix, injected-join-server.nix,
#     injected-server-join.nix, initial-password.nix's runtime activation
#     script, operator-ssh-keys.nix) or by a RUNTIME `ConditionPathExists`
#     (zeta-creds-restore.nix, zeta-first-boot-k3s-verify.nix). Absent-file is
#     their documented no-op branch, and absent-file is exactly what the real
#     failing install exercised too: run 35717757526 was a bare
#     `nixos-install --flake .../full-ai-cluster#control-plane` with no prior
#     `zeta-install.sh` run, so it carried NO `/etc/zeta` fixtures either.
#     Staging fake ones here would make this test MORE installed than the
#     install that actually broke. `zeta.hostSeal.boxRole = "prod-metal"` (set
#     in configuration.nix itself, not overridden here) matches that same real
#     run too.
#   * `networking.networkmanager.enable` / NetworkManager itself -- NOT
#     swapped for plain DHCP the way `k3s-first-boot-roster.nix` does. That
#     swap is exactly what would hide the thing under investigation: the
#     `zeta-first-boot-k3s-verify.nix` incident (081M33XMWME087G0R000825CCB,
#     run 35697298781) measured a *different* unit's `After=network-online.target`
#     ordering dependency apparently never settling "on this image's first
#     boot (QEMU user-mode NIC + NetworkManager)" within 75+ minutes. Whether
#     that generalizes to k3s.service's OWN identical upstream dependency
#     (`nixpkgs/nixos/modules/services/cluster/rancher/default.nix`:
#     `after = [ "firewall.service" "network-online.target" ];
#      wants = [ "firewall.service" "network-online.target" ];`, confirmed
#     against the pinned nixos-26.05 branch, commit 1e8bc658) is precisely
#     hypothesis (2) this test exists to check -- so NetworkManager stays on.
#
# THREE SUBTESTS, IN COST ORDER
# --------------------------------
#   a) `systemd-analyze verify` + `journalctl -b | grep -i 'ordering cycle'`
#      -- catches hypothesis (1) (a real ordering CYCLE that systemd breaks by
#      deleting a job). Needs no network; runs first and fails fast.
#   b) k3s.service reaches `active` within a bounded window -- THE regression
#      gate for the actual measured defect. On failure, prints
#      `systemctl list-jobs`, `systemctl show k3s -p After -p Requires -p Wants`,
#      `systemctl status network-online.target NetworkManager-wait-online.service`,
#      and the ordering/failure grep again (state may have moved on since (a)).
#   c) The node reaches `Ready` (Cilium up) -- needs the chart image, hence
#      internet. Weaker signal than (b) but closes the loop to "does the
#      REAL first-boot experience work", which is WP20's actual charter.
#
# REQUIRES INTERNET for subtest (c) (Cilium's ~1 image), same discipline as
# `k3s-first-boot-roster.nix` and `k3s-cluster-online.nix`:
#
#   cd full-ai-cluster
#   nix build .#checks.x86_64-linux.control-plane-host-boots-k3s -L --option sandbox false
#
# COST: heavier than k3s-first-boot-roster.nix -- this host's closure adds the
# full byte-lock toolchain (wabt/binaryen/emscripten/nodejs/zig/llvm/rustup/go/
# lua5), three AI-agent systemd services, avahi, samba and docker on top of
# everything the roster test already boots, AND (since the bootloader fix
# above) a real qcow2 disk image build plus an OVMF/systemd-boot boot instead
# of nixosTest's fast default path. Not wired per-PR for that reason; see
# `.github/workflows/control-plane-host-boots-k3s-vm.yml` (PRs scoped to this
# test's own inputs + daily cron + workflow_dispatch).
#
# WHAT IT IS NOT
# ----------------
#   * NOT a replacement for k3s-first-boot-roster.nix -- that test is the
#     detailed oracle for whether the ELEVEN-manifest roster converges
#     (root-application landing in particular). This test stops at "does k3s
#     even start, and does the node go Ready" on the FULL host config; it does
#     not assert anything about ArgoCD, SPIRE, cert-manager, or the rest of
#     the roster.
#   * NOT proof the real USB install path is fixed end-to-end -- it is the
#     fast, hermetic-as-possible proxy for the one link (k3s.service activation
#     on the full config) that a bare-metal install cannot cheaply re-run on
#     every PR.

{ pkgs }:

pkgs.testers.nixosTest {
  name = "control-plane-host-boots-k3s";

  nodes.server =
    { config, pkgs, lib, ... }:
    {
      # MEASURED 2026-09-22 (run 35741126744): `pkgs.testers.nixosTest`'s own
      # `evalModules` call does not thread arbitrary specialArgs, so
      # `common.nix`'s `{ ..., stateVersion ? "25.11", ... }` default was
      # expected to cover the gap (see the file header's deviation-2 note) --
      # it did NOT. The actual failure is `error: attribute 'stateVersion'
      # missing` at `lib/modules.nix:729` (`config._module.args.${name}`),
      # surfaced through `nixos/modules/tasks/swraid.nix` forcing
      # `config.system.stateVersion` (an upstream stateVersion-gated
      # compat check) before `common.nix`'s own `mkDefault stateVersion`
      # line ever gets to apply ITS default -- so the lazy-arg-default path
      # the header assumed never fires. Setting `_module.args.stateVersion`
      # directly is the documented, unconditional way to answer any such
      # lookup regardless of which module forces it first; using "26.05"
      # (rather than the "25.11" the header originally assumed) also
      # restores full fidelity with `flake.nix`'s real specialArgs.
      _module.args.stateVersion = "26.05";

      # THE REAL HOST CONFIG, whole -- see the file header for why this one
      # line is "reuse the flake's own definition" rather than a paraphrase.
      imports = [
        ../hosts/control-plane/configuration.nix
      ];

      # Same overlay `mkSystem` applies to every `nixosConfigurations.*`
      # output (flake.nix line ~94) -- pins `mise` to the version
      # tools/setup/linux.sh expects. Included for fidelity; irrelevant to
      # the ordering question but cheap and it keeps this host's closure
      # identical to what the installer actually builds.
      nixpkgs.overlays = [ (import ../overlays/mise-pin.nix) ];

      # NAT internet via the qemu user-mode NIC, for subtest (c)'s Cilium
      # pull. Needs `--option sandbox false` at build time. NetworkManager
      # (enabled by common.nix, imported above) manages the interface --
      # deliberately NOT overridden to plain DHCP; see the file header.
      virtualisation.memorySize = 10240;
      virtualisation.cores = 4;
      virtualisation.diskSize = 40960;

      # THE FIDELITY FIX -- see the file header's "WHY THIS TEST MUST BOOT
      # THROUGH THE REAL BOOTLOADER" section. Without these two, nixosTest
      # boots the built toplevel directly via `-kernel`/`-initrd`, skipping
      # UEFI/OVMF and systemd-boot entirely -- measured (run 35742067241) to
      # make this test unable to reproduce run 35717757526's finding at all
      # (k3s.service went active in 0.30s). `useBootLoader` builds a real
      # disk image and boots it through the loader `common.nix` already
      # configures (`boot.loader.systemd-boot.enable` /
      # `efi.canTouchEfiVariables`, both `lib.mkDefault true`);
      # `useEFIBoot` is what makes that loader OVMF/UEFI rather than BIOS/
      # GRUB-legacy, matching `buildQemuK3sVerifyBootArgsPure`'s
      # `-drive if=pflash,...OVMF_CODE/OVMF_VARS...` exactly.
      virtualisation.useBootLoader = true;
      virtualisation.useEFIBoot = true;
    };

  testScript = ''
    start_all()
    server.wait_for_unit("multi-user.target", timeout=600)

    # -- SUBTEST (a): no systemd ordering cycle, on the FULL host config ----
    # Cheap, needs no network, and fails fast if hypothesis (1) is right: a
    # cycle somewhere in the full import graph that no smaller VM test could
    # ever see (they none of them import more than 2-3 of these modules at
    # once). `systemd-analyze verify` re-checks the unit graph statically;
    # the journal grep catches a cycle systemd already broke by deleting a
    # job during THIS boot, which `verify` alone would not show (verify
    # re-derives the graph fresh -- it can be clean while the actual boot's
    # transaction still lost a job to a cycle it hit before some unit was
    # masked/reordered by the very act of booting).
    with subtest("no systemd ordering cycle on the full control-plane host config"):
        verify_out = server.succeed(
            "systemd-analyze verify default.target 2>&1 || true"
        )
        print("=== systemd-analyze verify default.target ===")
        print(verify_out)

        cycle_lines = server.succeed(
            "journalctl -b --no-pager | grep -i 'ordering cycle' || true"
        )
        deleted_lines = server.succeed(
            "journalctl -b --no-pager | grep -i 'deleted to break ordering cycle' || true"
        )
        print("=== journalctl -b | grep -i 'ordering cycle' ===")
        print(cycle_lines or "(none)")
        print("=== journalctl -b | grep -i 'deleted to break ordering cycle' ===")
        print(deleted_lines or "(none)")

        assert not cycle_lines.strip() and not deleted_lines.strip(), (
            "systemd found and broke an ordering cycle on this boot -- see the "
            "journal excerpts above for which unit's start job was deleted. "
            "This is hypothesis (1): a cycle in the full control-plane import "
            "graph that no smaller VM test in this directory could see. Fix "
            "the cycle (break it explicitly with a Before=/After= that does "
            "not loop) rather than letting systemd pick which job to drop."
        )

    # -- SUBTEST (b): k3s.service becomes active -- THE regression gate -----
    # Run 35717757526 measured this NEVER happening in 4201s on the real
    # installed disk. Bounded well below that so a genuine regression fails
    # this lane in well under the 90 min job timeout rather than burning the
    # whole budget confirming what run 35717757526 already showed once.
    with subtest("k3s.service reaches active on the full host config"):
        try:
            server.wait_for_unit("k3s.service", timeout=900)
        except Exception:
            # Diagnostics BEFORE re-raising -- exactly the set the work
            # package asks for, plus the cycle grep again (state may have
            # moved since subtest (a) ran, early in boot).
            print("=== systemctl list-jobs ===")
            print(server.succeed("systemctl list-jobs --no-pager || true"))
            print("=== systemctl show k3s -p After -p Requires -p Wants -p ActiveState -p SubState -p Result ===")
            print(server.succeed(
                "systemctl show k3s.service -p After -p Requires -p Wants "
                "-p ActiveState -p SubState -p Result || true"
            ))
            print("=== systemctl status network-online.target NetworkManager-wait-online.service ===")
            print(server.succeed(
                "systemctl status network-online.target "
                "NetworkManager-wait-online.service --no-pager || true"
            ))
            print("=== journalctl -b | grep -iE 'cycle|deleted|failed' ===")
            print(server.succeed(
                "journalctl -b --no-pager | grep -iE 'cycle|deleted|failed' || true"
            ))
            print("=== journalctl -u k3s.service -b --no-pager (full) ===")
            print(server.succeed("journalctl -u k3s.service -b --no-pager || true"))
            print("=== systemctl status k3s.service ===")
            print(server.succeed("systemctl status k3s.service --no-pager || true"))
            raise

        print("=== systemctl show k3s -p After -p Requires -p Wants (on success, for the record) ===")
        print(server.succeed(
            "systemctl show k3s.service -p After -p Requires -p Wants || true"
        ))

    # -- SUBTEST (c): the node reaches Ready (Cilium up) ---------------------
    # Needs internet (Cilium's image). Weaker per-line signal than (b) but
    # this is WP20's actual charter: does the real first-boot experience
    # work, not merely does the unit flip to "active".
    with subtest("node reaches Ready (Cilium installs) on the full host config"):
        kc = "KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl"
        server.wait_for_file("/etc/rancher/k3s/k3s.yaml", timeout=300)
        server.wait_until_succeeds(
            f"{kc} -n kube-system get pods -l k8s-app=cilium "
            f"--no-headers 2>/dev/null | grep -q ' Running '",
            timeout=1800,
        )
        server.wait_until_succeeds(
            f"{kc} wait --for=condition=Ready node --all --timeout=30s",
            timeout=1800,
        )
        print(server.succeed(f"{kc} get nodes -o wide || true"))
        print(server.succeed(f"{kc} -n kube-system get pods -o wide || true"))
  '';
}
