# full-ai-cluster/nixos/modules/login-banner.nix
#
# iter-5.2.2 (B-0792): NixOS getty login-banner customization so the
# hostname (+ primary IP + ssh-from-Mac hint) is visible BEFORE the
# operator logs in at the console.
#
# Problem the maintainer 2026-05-26 surfaced: *"i mean i see a login
# but no hostname until after i login can you update to show hostname
# before i login"* — NixOS default getty shows just "login:" without
# the hostname when the hostname is generic/default. Even when
# `networking.hostName` is set, the getty issue file doesn't
# necessarily display it prominently.
#
# Fix: configure `services.getty.greetingLine` + `services.getty.helpLine`
# so the pre-login console shows:
#
#   ╭────────────────────────────────────────────────────╮
#   │  ZETA CLUSTER NODE                                 │
#   │  Hostname:  <hostname>                             │
#   │  SSH from operator Mac:                            │
#   │    ssh zeta@<hostname>.local                       │
#   │  Console login:                                    │
#   │    user:     zeta                                  │
#   │    password: zeta-change-me (rotate after first)   │
#   ╰────────────────────────────────────────────────────╯
#   <hostname> login:
#
# Photo-friendly per the maintainer's 2026-05-26 *"whenever i have
# to ferry commands by reading and typing i'm going to avoid it
# like the plague and try to get like pictures and auto run and
# short commands pre built in"* discipline.

{ config, lib, ... }:

let
  hostName = config.networking.hostName;
in
{
  # services.getty.greetingLine: printed once before login prompt.
  # services.getty.helpLine: printed after greeting; conventionally
  # the multi-line block goes here so each VT shows the same banner.
  # \\n in literal NixOS string becomes "\n" in /etc/issue, which
  # agetty expands to the system hostname at runtime.
  services.getty.greetingLine = "<<< Welcome to ${hostName} (Zeta cluster node) >>>";
  services.getty.helpLine = ''


      ╭─────────────────────────────────────────────────────────╮
      │  ZETA CLUSTER NODE                                      │
      │                                                         │
      │  Hostname:  ${hostName}                                 │
      │                                                         │
      │  SSH from operator Mac (zero-typing if pubkey injected):│
      │    ssh zeta@${hostName}.local                           │
      │                                                         │
      │  Console login (if needed for diagnostics):             │
      │    user:     zeta                                       │
      │    password: zeta-change-me  (rotate after first login) │
      ╰─────────────────────────────────────────────────────────╯

  '';
}
