# full-ai-cluster/nixos/modules/initial-password.nix
#
# Initial password substrate for the `zeta` user on fresh installs.
# Per `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md`
# Shape A: hashedPassword baked into per-host Nix module + operator
# rotates on first login. Composes with the Touch ID + biometric
# substrate (full-ai-cluster/tools/zflash-setup.ts) for the operator's
# Mac side; this is the cluster-node side.
#
# THE INITIAL PASSWORD IS: zeta-change-me
#
# zeta-install.sh prints this in big letters to the console + writes
# zeta-initial-credentials.txt back to the boot USB before the 10s
# auto-reboot so the operator can read it after pulling the USB.
#
# Operator MUST rotate on first login:
#
#   passwd zeta
#
# Hash format: sha512crypt ($6$...). Generated via:
#   openssl passwd -6 'zeta-change-me'
#
# Per simplest-first (per B-0786 memory): sha512crypt is the
# universally-portable shape; promote to yescrypt or agenix/sops-nix
# when the simple shape demonstrably can't meet a real requirement.
# Iter-4 v1 ships sha512crypt; iter-5+ may promote to a stronger
# secret-management substrate when (a) repo goes public OR
# (b) multi-operator key isolation becomes load-bearing.

{ config, pkgs, lib, ... }:

{
  users.users.zeta.hashedPassword =
    "$6$wMTsqITU4II043Y8$DBR58Hhh.d975YkA40kwYNxQAunevJ9Cu9rYYigi9YjBYVEjlNrs.rk4hu.332sh6GkQuCb7yyLYr7lPTxySD1";
}
