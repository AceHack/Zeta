# foreign-binaries.nix — FHS-compat loader for foreign dynamically-linked ELFs.
#
# WHY (081KZETP6AT, 2026-08-09). NixOS provides no `/lib64/ld-linux-x86-64.so.2`,
# so any prebuilt binary that is dynamically linked against the standard FHS
# loader cannot `execve()` — the kernel reports ENOENT and bash prints the
# famously misleading "cannot execute: required file not found" (the FILE is
# there; its INTERPRETER is not).
#
# That is exactly what broke first-boot provisioning: `mise` downloads prebuilt
# toolchains at runtime, and the dynamically-linked ones (bun, node, python,
# rust, java, dotnet) all failed to exec, while every statically-linked tool
# (go, zig, uv, shellcheck, k3d, kubectl, helm) installed fine. That split —
# by LINKAGE, not by network luck — is what proved the cause deterministic.
#
# The repo already knew this failure one level too shallow: `overlays/mise-pin.nix`
# runs `autoPatchelfHook` on the mise BINARY so it can run, but nothing patches
# what mise then FETCHES. The remedy was applied to the wrapper and not to what
# the wrapper fetches. This module closes that gap for the whole class — including
# the agent CLIs in `tools/setup/manifests/from-installer`, which are vendor
# prebuilt dynamic ELFs with the same problem.
#
# WHY nix-ld rather than nix-native toolchains — the decisive reason (Mateo):
# nix-native toolchains would NOT let us turn nix-ld off. They would cover
# bun/node/python/rust/java/dotnet (the lower-risk half — vendor release channels
# with published checksums) but NONE of the agent CLIs in
# `tools/setup/manifests/from-installer` (grok, cursor-agent, hermes, forge, agy),
# which are vendor prebuilt dynamic ELFs with no nixpkgs equivalent. Those need the
# loader regardless, so nix-native pays the full cost for a security delta of ~0.
# Secondary reason (Dejan): `.mise.toml` must stay the SINGLE version source across
# all four consumers (laptop, CI runner, devcontainer, cluster node) per GOVERNANCE
# §24 — nixpkgs already carries bun-1.3.3 vs the pinned 1.3.14, and byte-lock
# requires the fleet to run CI's compiler bytes.
#
# ⚠ THE LIST BELOW IS ADDITIVE — IT IS NOT THE WHOLE SURFACE (Mateo).
# nixpkgs' own `programs/nix-ld.nix` defines a base list inside its `config` block
# (zlib zstd stdenv.cc.cc curl openssl attr libssh bzip2 libxml2 acl libsodium
# util-linux xz systemd), and `libraries` is `listOf package`, so module definitions
# CONCATENATE. Effective exposure is ~22 libraries, not the count written here, and
# several entries below are already in that base and are exact no-ops. Reason about
# the UNION, not this file alone.
#
# ⚠ ADDITIONS GO HERE, each justified with the BINARY + SONAME that needed it.
# Never set `NIX_LD_LIBRARY_PATH` by hand in a shell profile or a systemd
# `Environment=` line — that bypasses the nixpkgs buildEnv entirely and is invisible
# to `nix eval`, which would make this file stop being the audit surface.
#
# Analysis + recommendation: Dejan (devops-engineer). Supply-chain review: Mateo
# (security-researcher). Predicate / blast-radius review: Kira. 2026-08-09.
{ pkgs, ... }:

{
  # nix-ld is arch-aware: it installs the stub at /lib64/ld-linux-x86-64.so.2 on
  # x86_64 and /lib/ld-linux-aarch64.so.1 on aarch64, so the Pi / installer-aarch64
  # path is covered by this same module.
  programs.nix-ld = {
    enable = true;
    libraries = with pkgs; [
      stdenv.cc.cc.lib # libstdc++ / libgcc_s — bun, node, dotnet
      zlib # node, java, dotnet, python
      openssl
      icu # .NET globalization. Do NOT substitute
      # DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 — that is a runtime
      # string-comparison behavior change and belongs to
      # .claude/rules/culture-invariant-by-default.md, not to a CI shortcut.
      krb5 # .NET networking (libgssapi_krb5)
      curl
      # NOTE: libxcrypt-legacy was dropped after review. Its stated justification
      # (libcrypt.so.1 for python-build-standalone) stopped being true in Python
      # 3.13 — PEP 594 removed `crypt`/`_crypt`, which is the only thing PBS links
      # it from — and `.mise.toml` pins python 3.14.6. Keeping a library for a
      # reason that expired is exactly the entry that survives a decade of
      # copy-paste. If something genuinely needs it, re-add it WITH the binary and
      # soname that failed (Mateo, PR #10196).
      libffi
      ncurses
      readline
      xz
      bzip2
      sqlite
      util-linux # libuuid
    ];
  };
}
