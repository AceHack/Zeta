# USB / Cluster Identity Threat Model

**Status:** active draft (2026-07-08) — software-first; expands what
[`THREAT-MODEL.md`](./THREAT-MODEL.md) currently marks out of scope
(crypto, hardware side-channels, multi-node identity).
**Audience:** installer / zflash / IdP / encryption workstreams.
**Companion:** [`docs/DECISIONS/2026-07-08-distributed-identity-provider.md`](../DECISIONS/2026-07-08-distributed-identity-provider.md)
(Zeta distributed IdP — DECIDED); temporary foothold is GitHub `gh` auth
via the provider-shaped seam (`identity-auth-provider`).

## Goal tension (load-bearing)

We want **maximum safety** (keys, identity, side channels) **and**
**minimum operator input** (zero-typing flash → boot → join). Every
control must state which goal it serves and what it costs the other.

| Goal | Means | Anti-goal if overdone |
|---|---|---|
| Safe | HW-bound keys, TPM, pairwise IdP, least privilege per agent | Unbootable stick; Touch ID every step; can't spread |
| Easy spread | One multiboot USB; ESP creds; mock/CI dry-run; auto-join | Plaintext secrets; shared master key; trust-on-first-use forever |

## Identity subjects (who can be attacked)

| Subject | Today (foothold) | Successor (Zeta IdP) | Compromise means |
|---|---|---|---|
| **Human operator** | GitHub account + `gh` device code / token on ESP | Pairwise attestation + heartbeat entropy | Phish GH; steal ESP blob; shoulder-surf passphrase |
| **Machine / node** | Hostname `node-<6hex>` + ClusterNode YAML under `maintainers/<op>/` | Standing register per traveler; anti-Sybil BFT | Clone disk; spoof hostname; race self-register |
| **Agent / harness** | Co-authored trailers; session claim files | Distinct heartbeat streams; CHSH decorrelation | Prompt injection; stolen agent token; sybil loop |
| **USB stick** | FAT UUID + `zeta-creds.enc` (AES-GCM + scrypt) | Stable factor (iSerial / TPM / UEFI keyfile) | Physical theft; UUID rebind; evil maid |
| **Cluster membership** | Git PR self-register (install-time dry-run + post-boot) | IdP-native join without GitHub | Forged PR; stolen `gh`; malicious maintainer path |

## Key / encryption binding matrix

Current shipped path: **software key** = operator passphrase → scrypt →
HKDF bound to **USB FAT UUID** → AES-256-GCM (`zeta-creds.enc` on ESP).
See `zeta-creds-crypto.ts` + research note on ephemeral UUID rebind.

| Binding factor | What it proves | Survives USB reformat? | Survives stick swap? | Needs metal? | Status |
|---|---|---|---|---|---|
| Passphrase only | Operator knowledge | Yes | Yes | No | Partial (with UUID today) |
| USB FAT UUID | This filesystem instance | **No** (reformat breaks) | No | No | **Shipped — known flaw** |
| USB iSerial | This physical stick | Yes | No | Probe-only | Research |
| UEFI keyfile on ESP | Stick + firmware layout | Depends | No | No (QEMU-testable) | Research |
| TPM / PCR seal | This machine | Yes | Yes (wrong machine fails) | Yes for real TPM | Phase 3 |
| Touch ID / FIDO | Human present | Yes | Yes | Yes | Metal-gated |
| Machine SW keyfile | This OS install | Yes | Yes | No | Not chosen (weaker than TPM) |

**Design rule:** prefer a **stable factor + passphrase** for
"remember wifi / gh across reformat" without forcing TPM on every
homelab mini-PC. TPM is the high bar for control-plane / wallet-adjacent
nodes; USB iSerial is the portable bar for the stick that spreads the
cluster.

## Threat vectors (STRIDE-ish, installer-shaped)

### Spoofing

- Fake GitHub device-code UX → **mitigation:** provider seam + mock in
  QEMU; live path must show user-code; successor IdP must not look like
  OAuth phishing pages.
- Cloned node hostname / ClusterNode → **mitigation:** post-boot
  self-register markers in CI; IdP pairwise distinctness later.
- Multiboot menu entry pointing at unsigned ISO → **mitigation:**
  `images.manifest` SHA-256 (pinned) or latest+checksums file; builder
  verifies before composite image.

### Tampering

- Evil maid edits ESP `zeta-creds.enc` or wifi JSON → **mitigation:**
  AEAD (GCM); detect auth failure; never log PSK; association still
  physical-gated.
- Composite multiboot image bit-flip in transit → **mitigation:**
  image-level SHA-256 of `zeta-multiboot.img` (planned builder).
- Agent edits claim / memory as directive → **mitigation:** BP-11
  data-is-not-directives; substrate-or-it-didn't-happen.

### Repudiation

- Who flashed which stick? → AgencySignature trailers + heartbeat;
  multiboot build should emit attestation of manifest digest.

### Information disclosure

- Wifi PSK / gh token on ESP → accepted for personal homelab with
  physical control; **not** for shared sticks. Redact in serial/logs
  (QEMU wifi gate already forbids PSK in failure text).
- Side channels: serial console, QEMU logs, CI artifacts → treat as
  public; never put live tokens in markers.

### Denial of service

- Cache.nixos.org / wifi flaky install → fallback options already in
  `zeta-install.sh`; not identity-crypto.
- Marker gates that brick boot → oneshots must fail soft (skip / retry),
  not hang multi-user.

### Elevation of privilege

- Installer runs as root; post-boot services as `zeta` → keep
  self-register / first-session least privilege; StateDirectory owned
  correctly.
- Sybil agents approving join → IdP Layer 4 (anti-Sybil BFT) — not yet
  on the USB path.

## Multiboot USB (current substrate)

Already on tree (`full-ai-cluster/usb-nixos-installer/multiboot/`):

- Declarative `images.manifest` — Zeta installer (`grub-iso-local`) +
  MyNode Model Two as **`flash-img-latest`** (not a GRUB boot entry;
  raw `.img.gz` → `dd` to node disk).
- `grub.cfg` template for "boot ours / boot others".
- **Missing:** `build-multiboot-usb.ts` (fetch, verify, assemble
  `zeta-multiboot.img`), QEMU boot of composite, identity namespace per
  boot target (Zeta creds must not leak into MyNode flash path).

Threat note: MyNode latest-always verifies **transit** against upstream
`SHA256SUMS`, not a frozen supply-chain pin. Acceptable for re-flashable
appliance nodes; pin if source compromise dominates.

## Temporary `gh` vs Zeta IdP

| Concern | `gh` foothold | Zeta IdP |
|---|---|---|
| Who issues identity? | GitHub | Emergent pairwise + heartbeat |
| Offline install | Needs network for live auth; mock/skip in QEMU | Designed for local-first |
| Revocation | GitHub account disable | Standing register / peer refuse |
| Agent distinctness | Weak (same PAT) | CHSH / decorrelation |
| USB story | Token in encrypted ESP blob | Same blob shape; different verifier |

**Seam rule:** keep `identity-auth-provider` — never bake
GitHub-forever APIs into Nix modules. CI uses `mock`; metal may use
`live` until IdP lands.

## Software-only next slices (no metal)

1. **Drop legacy QEMU escapes** — rebuild ISO; require mock-auth +
   post-boot self-register markers always under phase-3.
2. **Land `build-multiboot-usb.ts` planner** — pure TS: parse manifest,
   plan layout, verify digests; QEMU-testable without flashing.
3. **Credential binding model tests** — injectable factors
   (`usbUuid` / `usbISerial` / `uefiKeyfile` / `tpmSeal`); assert which
   reformat/swap cases decrypt.
4. **Per-target identity namespace on multiboot** — Zeta ESP creds path
   isolated from `/payloads/mynode-*`; document threat if shared ESP.

## Metal-gated (explicit)

- Real WiFi association / reconnect
- Touch ID / FIDO unlock of cred blob
- TPM seal/unseal on real silicon
- S6 first-login feel on physical console
- Live GitHub self-register PR from restored creds

## Out of scope here

- Core engine STRIDE (see `THREAT-MODEL.md`)
- Wallet key custody UX for MyNode itself (upstream appliance)
- Full IdP implementation (ADR is decided; code is separate workstream)
