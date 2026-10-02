# SSH into the node from outside the LAN

> The home router forwards a port to a **device**, and every address the node answers on (its own IP and each Cilium LoadBalancer IP)
> shares **one MAC**, so the router can bind the forward to any of them and can change its mind. The node therefore answers `:22`
> on **every** one of those addresses, and the forward works whichever one the router picked. Access stays **key-only**.

## What is in place (GitOps, no ISO reinstall)

- `ssh-relay` Service (`full-ai-cluster/k8s/applications/cluster-hygiene/node-lan-hosts.yaml`): `externalIPs` = every LoadBalancer address in the
  cluster that does not already serve `:22`, kept current by the `discover` container. Its backend is the hostNetwork `node-lan-hosts` pod, whose `:22`
  **is the node's own sshd**. MEASURED before this: only the node's own address answered `:22`; `192.168.1.240` and `.250` timed out.
- sshd (NixOS): `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `PermitRootLogin prohibit-password`, `PubkeyAuthentication yes`.
  Measured 2026-10-02: 0 failed logins in 24 h.
- `apply` asserts a per-source rate limit in `nixos-fw` (best-effort): at most **9 new connections per minute** from any **non-private** source.
  Private (LAN) sources are exempt so scripted admin is never throttled. Verified to load on the real kernel (`recent` match).

## What you do

1. **Router (AT&T gateway → Firewall → NAT/Gaming → Custom service):** forward **TCP 22** (or any external port you prefer, e.g. 2222 → internal 22
   if the UI allows different external/internal ports) to the device **`node-5b2dfa`**.
2. **Keys:** sshd reads two places (`AuthorizedKeysFile %h/.ssh/authorized_keys /etc/ssh/authorized_keys.d/%u`). MEASURED 2026-10-02:
   `/etc/ssh/authorized_keys.d/zeta` is NixOS-generated, read-only, and holds 2 `ssh-rsa` keys. To authorize another device **now**, from a machine that
   can already log in: `ssh-copy-id zeta@192.168.1.79` (it appends to `~zeta/.ssh/authorized_keys`, which survives restarts). The **durable** place for
   a key is the installer: `full-ai-cluster/nixos/modules/operator-authorized-keys.nix` (`users.users.zeta.openssh.authorizedKeys.keys`).
3. **Connect:** `ssh zeta@ssh.flowdent.net` (DNS-only A record → the router's public IP), or `ssh zeta@<public-ip>`.

## Honest limits

- The public IP is **residential**; if the ISP changes it the `ssh.` record (and every other `A` record) goes stale — update them together.
- An internet-facing sshd will be scanned constantly. Key-only auth makes guessing futile; the rate limit only keeps the noise down. Do not enable
  password auth. Consider moving the external port off 22 and/or a VPN (headscale is deployed in-cluster but is not reachable from outside today).
- Source addresses seen by sshd may be the node's own when traffic arrives through Cilium's NAT, in which case the per-source limit cannot tell clients apart.

## Pointers

- `docs/ops/CLOUDFLARE-DNS01-CERTS.md`, `docs/ops/GITLAB-REGISTRY-PULLS.md` — the sibling node-edge runbooks.
- `src/Core.TypeScript/cluster/node-lan-hosts-relay.test.ts` — the falsifiers (the `ssh-relay` cases, and the firewall rules in `node-lan-hosts.test.ts`).
