# full-ai-cluster/nixos/modules/injected-public-tls.nix
#
# 081M3JG74G0087G0R001XJC837 — public TLS as INSTALL-TIME configuration.
#
# THE DEFECT: `k8s/applications/platform/clusterissuer.yaml` shipped
# `email: you@example.com # ← CHANGE`, and the Gateway / portal route shipped
# `portal.example.com`. A generic installer never edits a file, so every install
# applied them; Let's Encrypt refused the account (`invalidContact ... forbidden
# domain "example.com"`), the issuers never went Ready, and ArgoCD's health wait
# on them blocked the rest of the `platform` Application forever.
#
# THE MECHANISM — the one per-install values already use (INJECTION-POINTS.md):
#   zeta-install.sh resolves the pair (ESP conf -> start-of-install prompt ->
#   unset) and writes /mnt/etc/zeta/acme-email + /mnt/etc/zeta/public-domain;
#   it symlinks them to /etc/zeta/ for `nixos-install --impure` evaluation, the
#   same as cluster-node-id (injected-hostname.nix). This module reads them at
#   evaluation time and, on a k3s SERVER, adds one entry to the k3s auto-deploy
#   roster: the `platform-public-tls` ArgoCD Application, rendered from
#   k8s/public-tls/argocd-application.yaml.in by substituting two tokens. That is
#   the same door root-application.yaml uses to reach the cluster.
#
# BOTH OR NEITHER. Neither -> this module contributes nothing (the normal,
# supported UNSET state: platform is LAN-only and healthy). Exactly one -> the
# installer never writes that, so it is refused at evaluation, loudly, rather
# than half-applied. The installer validates both (no quote/backslash can reach
# the template); the shape check here is defence in depth.
#
# PURE-EVAL NOTE (see injected-hostname.nix): `builtins.pathExists` on an
# absolute path is false in pure evaluation, so a rebuild without `--impure`
# would silently drop the Application. Every nixos-rebuild in this repo carries
# `--impure`; lint-nixos-rebuild-needs-impure.ts keeps it that way.

{ config, lib, pkgs, ... }:

let
  emailFile = "/etc/zeta/acme-email";
  domainFile = "/etc/zeta/public-domain";
  readTrimmed = f:
    if builtins.pathExists f
    then
      let m = builtins.match "[[:space:]]*([^[:space:]]*)[[:space:]]*" (builtins.readFile f);
      in if m == null then "" else builtins.head m
    else "";
  email = readTrimmed emailFile;
  domain = lib.toLower (readTrimmed domainFile);
  hasEmail = email != "";
  hasDomain = domain != "";
  emailOk = builtins.match "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z][A-Za-z0-9-]*" email != null;
  domainOk = builtins.match "([a-z0-9]([a-z0-9-]*[a-z0-9])?\\.)+[a-z][a-z0-9-]*" domain != null;
  emailDomain = lib.toLower (lib.last (lib.splitString "@" email));
  reservedTlds = [ "test" "example" "invalid" "localhost" "local" ];
  reservedSlds = [ "example.com" "example.net" "example.org" ];
  isReservedName = d:
    let
      labels = lib.splitString "." d;
      n = builtins.length labels;
      sld = lib.concatStringsSep "." (lib.drop (lib.max 0 (n - 2)) labels);
    in
    builtins.elem (lib.last labels) reservedTlds || builtins.elem sld reservedSlds;
  template = builtins.readFile ../../k8s/public-tls/argocd-application.yaml.in;
  rendered = builtins.replaceStrings
    [ "@ZETA_ACME_EMAIL@" "@ZETA_PUBLIC_DOMAIN@" ]
    [ email domain ]
    template;
  isServer = config.services.k3s.enable && config.services.k3s.role == "server";
in
{
  config = lib.mkMerge [
    {
      assertions = [
        {
          assertion = hasEmail == hasDomain;
          message = "injected-public-tls: exactly one of ${emailFile} / ${domainFile} exists. Public TLS needs BOTH (an ACME account with no domain certifies nothing). Write both, or remove both for a LAN-only platform.";
        }
        {
          assertion = !(hasEmail && hasDomain) || (emailOk && domainOk);
          message = "injected-public-tls: ${emailFile} / ${domainFile} do not have the shape zeta-install.sh validates (local@domain.tld, and a DNS name). Refusing to render them into a manifest.";
        }
        {
          # The installer refuses RFC 2606 / 6762 names (installer/public-endpoint.ts), but a
          # file written by hand and a `nixos-rebuild switch --impure` never meets the
          # installer. This is the same refusal where that route ends: the one live failure
          # was `you@example.com` reaching a ClusterIssuer.
          assertion = !(hasEmail && hasDomain && emailOk && domainOk) || !(isReservedName domain || isReservedName emailDomain);
          message = "injected-public-tls: ${emailFile} / ${domainFile} name a reserved domain (RFC 2606 example.com/.net/.org, .test/.example/.invalid/.localhost, or RFC 6762 .local). A certificate authority refuses every one of them, and the issuer that carried it would never go Ready. Use a domain you control, or remove both files for a LAN-only platform.";
        }
        {
          # Fail closed on a template that grew a token this module does not fill: an
          # un-rendered placeholder must never reach the cluster as a literal.
          assertion = !(hasEmail && hasDomain) || !(lib.hasInfix "@ZETA_" rendered);
          message = "injected-public-tls: the rendered Application still contains an unsubstituted token prefix. k8s/public-tls/argocd-application.yaml.in and this module disagree about the tokens.";
        }
      ];
    }
    (lib.mkIf (hasEmail && hasDomain && emailOk && domainOk && isServer) {
      services.k3s.manifests.zeta-public-tls.source = pkgs.writeText "zeta-public-tls.yaml" rendered;
    })
  ];
}
