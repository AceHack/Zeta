# Consumer-router port forwarding is ambiguous when one node answers for many LB IPs

Measured on the owner's node (node-5b2dfa), 2026-10-02.

## Finding

- The cluster announces several LoadBalancer IPs from one NIC via Cilium L2 announcements:
  `192.168.1.240` (`zeta-public-gateway`, :80/:443), `.241`, `.242`, and `.250` (the GitLab-only LAN
  gateway `gitlab-lan`).
- The owner's consumer router offers a **"pick a device"** menu for port forwards: you choose a
  device, not an IP. One physical node = one device = one MAC, but it answers for all those IPs, so
  the router's forward is not tied to the intended address.
- Observed result: the forward for :80 reached `.250`, whose hostname-less Gateway answers **every
  Host** with GitLab's 302/HTML. Let's Encrypt's HTTP-01 fetch of `/.well-known/acme-challenge/<token>`
  then failed with `Error reading HTTP response body: reader size limit exceeded`.
- `git.flowdent.net` and `portal.flowdent.net` did get certificates; `gitlab-tls` and
  `gitlab-registry-tls` were stuck in cert-manager's issuance backoff (~1 h after one failed order).
  Why the first two succeeded is not established here.

## Consequences

- HTTP-01 depends on a router behaviour the install cannot control or verify. Port forwarding is
  not a dependable path on this class of router.
- The reliable path is DNS-01, which needs no inbound connectivity: see
  [`CLOUDFLARE-DNS01-CERTS.md`](CLOUDFLARE-DNS01-CERTS.md) (opt-in, HTTP-01 stays the default).
