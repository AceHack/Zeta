---
id: 081KSGS9H0008QG0R003V23XNZ
priority: P1
status: open
title: iter-5 wifi-credentials injection via USB ESP — homelab persona MOSTLY HAS NO ETHERNET; cluster must "remember the wifi on setup"; analogous to iter-4.x pubkey injection but for NetworkManager profile (Aaron 2026-05-26)
effort: M
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R002T3BJ2R
composes_with:
  - 081KSGS9H0008QG0R002T3BJ2R
  - 081KSE6WT0008QG0R003G0Y62D
  - 081KSE6WT0008QG0R0029S1D5Z
  - 081KSE6WT0008QG0R0004AP0ZA
  - 081KSGS9H0008QG0R00153CQ8B
tags: [iter-5, wifi, networkmanager, zero-typing, homelab-persona, esp-injection, usb-installer, cluster-bringup, b0789-extension]
---

## Problem

The maintainer 2026-05-26 surfaced a load-bearing substrate gap during the iter-4.2 empirical test (PC1 first cluster bring-up):

> *"we won't have ethernet for most machines it needs to remember the wifi on setup"*

Today's substrate ([full-ai-cluster/nixos/modules/common.nix:31](full-ai-cluster/nixos/modules/common.nix#L31)) enables NetworkManager but bakes in **zero wifi credentials**. Result:

- **Ethernet works automatically** (DHCP, no config) — fine for one-off bench testing where operator has an ethernet cable
- **Wifi does NOT work automatically** — requires console-side `nmtui` / `nmcli` to set up first connection; defeats zero-typing discipline

For the homelab persona (per 081KSE6WT0008QG0R003G0Y62D broadening + 081KSGS9H0008QG0R00153CQ8B end-state), MOST cluster nodes are wifi-only mini-PCs with no ethernet jack populated. Without wifi-injection, iter-4.x doesn't bootstrap the homelab persona at all.

## Target

Extend the iter-4.x ESP-injection pattern to ALSO carry wifi credentials so first cluster boot connects to home wifi automatically — analogous to how iter-4.2 carries `zeta-authorized-keys.pub`.

Operator flow becomes (end-state):

```bash
# One-time setup (per operator Mac): create credentials file once
$ echo '{"ssid":"MyHomeWifi","password":"secret123"}' > ~/.zeta/wifi-credentials.json

# Per-USB flash (zero-typing same as iter-4.4 today):
$ zflash
[Touch ID]
# ... dd + inject pubkey + inject wifi-creds + eject

# Cluster boot: NetworkManager comes up with credentials persisted;
# DHCP via wifi; sshd accessible from operator Mac immediately
```

## Sub-targets (composing iters)

### Sub-target 1 — zflash extension: write zeta-wifi-credentials.json to ESP

Parallel to existing `zeta-authorized-keys.pub` injection. Additions to `full-ai-cluster/tools/zflash.ts`:

- Resolve credentials from (priority order):
  1. CLI flags `--wifi-ssid <ssid> --wifi-password <pw>` (one-off override)
  2. Env vars `ZETA_WIFI_SSID` / `ZETA_WIFI_PASSWORD`
  3. JSON file `~/.zeta/wifi-credentials.json` (`{"ssid": "...", "password": "..."}`)
  4. None → skip wifi injection (operator may have ethernet; not fatal)
- Write `zeta-wifi-credentials.json` to ESP via existing mountEsp path (single Touch ID covers all sudo calls per sudo timestamp window)
- Print substrate-honest disclosure: "iter-5: wrote wifi credentials (SSID=<ssid>, password=<redacted>) to ESP" — never print the password to stdout

### Sub-target 2 — zeta-install.sh extension: read ESP creds + write NetworkManager profile

Parallel to existing pubkey read. Additions to `full-ai-cluster/usb-nixos-installer/zeta-install.sh`:

- During install, before `nixos-install` completes, check if `zeta-wifi-credentials.json` exists on the boot USB's ESP
- If present, write a NetworkManager connection file to `/mnt/etc/NetworkManager/system-connections/zeta-wifi.nmconnection` with:
  ```ini
  [connection]
  id=zeta-wifi
  type=wifi
  autoconnect=true
  permissions=
  [wifi]
  ssid=<from json>
  mode=infrastructure
  [wifi-security]
  key-mgmt=wpa-psk
  psk=<from json>
  [ipv4]
  method=auto
  [ipv6]
  method=auto
  ```
- chmod 0600 the file (NetworkManager requires)
- Photo-friendly diagnostic on success: "iter-5: wifi credentials injected for SSID=<ssid> at /etc/NetworkManager/system-connections/zeta-wifi.nmconnection"
- On failure: dumpDiagnostics + fallback discipline (cluster still bootable; operator can use `nmtui` console-side as escape hatch)

### Sub-target 3 — NixOS config: NetworkManager `wireless` enable + nss-mdns publishing

Two related gaps surfaced by same test:

a) **NetworkManager wireless plugin enable** — verify `programs.nm-applet.enable` and wireless backend are correct for headless NetworkManager wifi connection (may need `networking.wireless.enable = false` to defer to NM, plus NetworkManager's wpa_supplicant module). Test on actual cluster hardware.

b) **mDNS publishing** — empirical 2026-05-26: `ssh zeta@control-plane.local` failed to resolve from operator Mac because NixOS install has NO Avahi configured. Add to `full-ai-cluster/nixos/modules/common.nix`:

```nix
services.avahi = {
  enable = true;
  publish = {
    enable = true;
    addresses = true;
    workstation = true;
    domain = true;
  };
  nssmdns4 = true;
};
```

After this lands, `ssh zeta@control-plane.local` from any LAN device (Mac, Linux, etc.) resolves via mDNS without IP discovery step.

### Sub-target 4 — multi-node hostname selection

The iter-5 "what happens when there's a 2nd node?" question Aaron asked. Three options previously surfaced:

1. **Pre-bake per-USB** (RECOMMENDED): `bun tools/zflash.ts --host worker-gpu-1` → zflash writes `zeta-hostname.txt` to ESP; `zeta-install.sh` reads it + passes to `nixos-install --flake .../#$HOST`
2. Prompt on first boot via console (defeats zero-typing)
3. Auto-detect by MAC/serial pattern (risky)

Option 1 composes with sub-targets 1+2 cleanly — adds a 3rd ESP file (`zeta-hostname.txt`) to the inject set.

### Sub-target 5 — cluster join token / control-plane address injection

For worker nodes (`worker-gpu-1` joining `control-plane`), iter-5 also needs:

- Bootstrap join token (k3s / kubeadm / Talos / whatever cluster substrate the workers join)
- Control-plane address (probably auto-discoverable via mDNS once sub-target 3 is in)

This sub-target is downstream of cluster-orchestration-substrate selection (081KSE6WT0008QG0R002275NDE simplest-first plugin sequence likely informs the choice). Track separately when that lands.

## Acceptance

- [ ] **Sub-target 1**: zflash writes `zeta-wifi-credentials.json` to ESP when credentials are resolvable; logs SSID + redacted-password disclosure
- [ ] **Sub-target 2**: `zeta-install.sh` reads ESP creds + writes NetworkManager profile to `/mnt/etc/NetworkManager/system-connections/zeta-wifi.nmconnection` with chmod 0600
- [ ] **Sub-target 3a**: NixOS config verified to bring up wifi via NetworkManager on cluster hardware boot
- [ ] **Sub-target 3b**: Avahi enabled so `<hostname>.local` resolves from LAN
- [ ] **Sub-target 4**: `bun tools/zflash.ts --host <hostname>` writes `zeta-hostname.txt` to ESP; install selects right per-host config
- [ ] **Empirical validation**: wifi-only mini-PC boots, joins wifi via injected credentials, accessible via `ssh zeta@<hostname>.local` from operator Mac with NO console intervention
- [ ] **Sub-target 5** (deferred): cluster join substrate for workers (downstream of 081KSE6WT0008QG0R002275NDE)

## Composes with substrate

- **081KSGS9H0008QG0R002T3BJ2R** (iter-4 SSH+password substrate; depends_on; iter-5 extends the ESP-injection pattern this row builds on)
- **081KSGS9H0008QG0R002T3BJ2R** (iter-3 USB install; depends_on through 081KSGS9H0008QG0R002T3BJ2R)
- **081KSE6WT0008QG0R003G0Y62D** (first-time-CLI-user persona broadened to homelab; this row is load-bearing for homelab specifically)
- **081KSE6WT0008QG0R0029S1D5Z** (Comet Pro IP-KVM; composes; remote-first install still needs network reachability after install)
- **081KSE6WT0008QG0R0004AP0ZA** (commodity hardware reference; wifi-only mini-PCs are common in the curated list)
- **081KSGS9H0008QG0R00153CQ8B** (zero-dev-machines cluster-native architecture end-state; iter-5 wifi-injection is load-bearing for the homelab persona target)
- `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` (composes; wifi credentials on USB ESP = plaintext credential class; may want `_wifi_credentials_acceptance` block if cluster goes beyond personal homelab into shared-substrate scope)

## Security framing

Wifi password on USB ESP is **plaintext** to anyone who can read the partition. Acceptance:

- **Homelab persona scope**: physical-USB-control assumption (same as iter-4.2 pubkey — the USB carries operator authority temporarily; physically secured during transit)
- **Maintainer persona scope**: same assumption (the Mac that runs zflash also has the wifi credentials in keychain; no additional exposure)
- **NOT acceptable for**: shared infrastructure, multi-tenant deployments, anywhere the USB transits hostile territory

Future hardening (out-of-scope this row): encrypted credentials with Touch ID gate at boot; per-cluster ephemeral credentials; etc. For now, plaintext + physical-control + first-boot-consumption (the cred file can optionally be wiped from ESP after consume).

## Out of scope (for this row; tracked elsewhere)

- Cluster orchestration substrate (k3s vs Talos vs whatever) — tracked under 081KSE6WT0008QG0R002275NDE
- Worker join token / control-plane discovery — sub-target 5; deferred
- Encrypted credentials / Touch ID gate — future hardening
- WPA-Enterprise / 802.1X / corporate wifi — not homelab scope

## Origin

The maintainer 2026-05-26 during the iter-4.2 PC1 empirical test surfaced the substrate gap when his first cluster node booted but couldn't be reached:

1. *"we need to move this forward also is this node up and running and working?"* — asks for node health verification (SSH fails to resolve `control-plane.local`)
2. *"does it reconnect to wifi after reboot?"* — sharp question; surfaces the missing piece
3. *"we won't have ethernet for most machines it needs to remember the wifi on setup"* — names the load-bearing requirement explicitly

This row captures + scopes the iter-5 substrate work. Composes directly with iter-4.x (#5080 → #5083 → #5086 → #5088 → #5091 → #5093 → #5099) — same ESP-injection pattern, different payload (wifi credentials + hostname).

Per maintainer's broader 2026-05-26 *"going for right not fast"* discipline + the *"ferry commands by reading and typing avoid like the plague"* discipline — iter-5 wifi-injection is load-bearing for keeping zero-typing as the homelab persona's default operator experience.
