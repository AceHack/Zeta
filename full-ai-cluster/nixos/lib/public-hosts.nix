# full-ai-cluster/nixos/lib/public-hosts.nix
#
# PURE helper behind modules/injected-public-hosts.nix: which public names the NODE's OWN
# resolver must answer locally, and with what address. A function of its arguments only, so
# nixos/tests/injected-public-hosts-eval-test.nix can evaluate it on cases the real hosts
# never present (a domain is present on exactly one install in the field).
#
# WHY THE NODE NEEDS ANY OF THIS (MEASURED 2026-10-02, node-5b2dfa). The kubelet and containerd
# resolve names through the HOST resolver, not CoreDNS. `registry.<domain>` / `gitlab.<domain>` are
# public names, so the node resolved them to the PUBLIC IP (66.10.240.234), which it can reach only by
# hairpinning through the home router. That router has no reliable hairpin, so every image pull from
# the in-cluster registry failed with `dial tcp 66.10.240.234:443: i/o timeout`. Pods were fine
# (CoreDNS answers them in-cluster); only the node-side pull path was broken.
#
# WHY LOOPBACK AND NOT THE GATEWAY'S LoadBalancer ADDRESS (the obvious spelling). The Gateway's address
# is cluster STATE, not install-time configuration: Cilium LB-IPAM hands it out in Service-creation
# order (measured: .240 public gateway, .241 zeta-gateway, .242 gmod, .250 gitlab-lan pinned), and
# nothing pins it. A static /etc/hosts line naming an address that is wrong is worse than no line,
# because glibc and Go's resolver take the FIRST matching entry, so it would shadow the correct
# runtime answer instead of being corrected by it (the same first-match hazard k3s-server.nix records
# for `control-plane`). 127.0.0.1 cannot be wrong: the `node-lan-hosts` DaemonSet
# (k8s/applications/cluster-hygiene/node-lan-hosts.yaml, hostNetwork, on every node) listens on the
# node's :443 and relays it to whatever address the Gateway currently has -- discovered at runtime, so
# it follows a changed address with no edit here. For every name but the API hostnames (which its
# SNI-routing edge terminates itself) TLS is passed through, SNI intact, and still terminates at the
# Gateway; gitlab./registry. are not API names.
#
# THE COST, STATED: these two names depend on that relay being up. With it absent, the node cannot
# reach them at all -- where before it could, on a LAN whose router DOES hairpin. The relay ships in the
# base GitOps set (cluster-hygiene), and src/Core.TypeScript/cluster/installer-parity.test.ts pins
# that it still listens on :443 on the host network, so removing it breaks a test instead of a node.
#
# ONLY these two names. The kubelet pulls from the registry and GitLab serves its token endpoint
# (`/jwt/auth`); nothing the kubelet does needs `git.<domain>` or `portal.<domain>`, and
# `api.<domain>` / `api-staging.<domain>` are deliberately NOT pinned: until a production cutover
# they point at another host, and pinning them would silently reroute node-side callers.
{ lib }:

let
  # Same shape injected-public-tls.nix validates (a DNS name with an alphabetic TLD).
  domainOk = domain:
    builtins.match "([a-z0-9]([a-z0-9-]*[a-z0-9])?\\.)+[a-z][a-z0-9-]*" domain != null;

  # The names the kubelet/containerd need, as <label>.<domain>.
  labels = [ "gitlab" "registry" ];

  # The node's address for those names. Loopback: see above.
  relayAddress = "127.0.0.1";
in
{
  inherit domainOk labels relayAddress;

  # `networking.hosts` fragment for <domain> ("" or malformed -> nothing: injected-public-tls.nix
  # already refuses a malformed domain loudly, so this stays silent rather than say it twice).
  hostsFor = domain:
    if domain != "" && domainOk domain
    then { ${relayAddress} = map (label: "${label}.${domain}") labels; }
    else { };
}
