# USB / Society Identity Threat Model

**Status:** active draft (2026-07-08) — software-first; expands what
[`THREAT-MODEL.md`](./THREAT-MODEL.md) currently marks out of scope
(crypto, hardware side-channels, multi-node identity).
**Audience:** installer / zflash / IdP / encryption / society workstreams.
**Companions:**

- [`docs/DECISIONS/2026-07-08-distributed-identity-provider.md`](../DECISIONS/2026-07-08-distributed-identity-provider.md)
  (Zeta distributed IdP — DECIDED)
- Iris / Addison UI: [`docs/design/root-site-iris/Genesis Concepts.dc.html`](../design/root-site-iris/Genesis%20Concepts.dc.html)
  (cluster vs federation); Lodge = federation charter
- Glossary canon: [`docs/SEED-VOCABULARY.md`](../SEED-VOCABULARY.md) (carved kernel),
  [`docs/GLOSSARY.md`](../GLOSSARY.md) §Society identity (Genesis Concepts)
- Self-similarity: CTM ⊣ ISociety (recursive); Traveler frame;
  three-body / Lagrange fairness layering

Temporary foothold for bringup auth is GitHub `gh` via the
provider-shaped seam (`identity-auth-provider`). Successor is Zeta IdP.

---

## 0. The real threat model is self-similar

This is **not** only a USB/installer STRIDE sheet. The society’s
identity geometry *is* the threat model, and it repeats at every scale
(same shape as ISociety / CTM / Traveler / three-body duals):

| Scale | What it is | Threat-model owner |
|---|---|---|
| **Traveler** | Any self-propagating pattern (human, agent, process) — weight-free base frame | Per-traveler threat model (sophisticated individuals may carry their own) |
| **Cluster** | Relationships — shared history/trust/culture; **never enforceable**; emerge and dissolve | Soft trust surface; betrayal = social, not contract breach |
| **Federation** | Contracts — constitution, membership, obligations, **always with exits** | Hard threat model: enforceable rules + exit paths + custody |
| **ISociety** | Bidirectional schedule/route contract a member presents to / receives from society | Membrane: inward sees CTM; outward sees ISociety |
| **CTM / World** | Recursive fixpoint — society of CTMs *is-a* CTM (`ISociety <: CTM`) | Top layer: most information advantage **and** most fairness obligation |

**UI canon (Addison / Iris Genesis Concepts):** see also
[`docs/GLOSSARY.md`](../GLOSSARY.md) §Society identity (Genesis Concepts).

> Relationships create **clusters** (never enforceable);
> contracts create **federations** (enforceable, always with exits).

Clusters may contain agents, rooms, vaults, federations, or other
clusters — and may later *become* federations when contracts appear.
Federations (e.g. The Aperture Lodge) are institutional: name, purpose,
constitution, treasury, degrees of entry, dispute process, **Universal
Exit Principle** (no human, agent, vault, cluster, or federation may be
trapped indefinitely).

**Identity binding rule:** clusters and federations are tied to
**agent and human traveler identities** (and sophisticated travelers
may own nested threat models). A node’s ClusterNode YAML under a
maintainer is today’s *foothold* encoding of “this machine traveler
joined this operator’s cluster” — not the end-state IdP binding.

**Self-similarity rule:** the same STRIDE questions (spoof / tamper /
leak / trap / elevate) apply at traveler, cluster, federation, and
world layers. Controls that only work at one layer without a dual at
the next are incomplete. Fairness obligation *increases* with
information advantage (three-body / Maxwell layering: CTM/World must
stay the most orbit-symmetric).

---

## 1. Goal tension (load-bearing)

We want **maximum safety** (keys, identity, side channels, exit rights)
**and** **minimum operator input** (zero-typing flash → boot → join).
Every control must state which goal it serves and what it costs the other.

| Goal | Means | Anti-goal if overdone |
|---|---|---|
| Safe | HW-bound keys, TPM, pairwise IdP, per-federation constitutions, exits | Unbootable stick; Touch ID every step; can't spread; trapped members |
| Easy spread | One multiboot USB; ESP creds; mock/CI dry-run; auto-join | Plaintext secrets; shared master key; trust-on-first-use forever; fake federation without exits |

---

## 2. Identity subjects (who can be attacked)

Subjects are **travelers** first; machines and sticks are travelers’
hardware envelopes.

| Subject | Scale | Today (foothold) | Successor (Zeta IdP / society) | Compromise means |
|---|---|---|---|---|
| **Human traveler** | Traveler | GitHub account + `gh` device code / token on ESP | Pairwise attestation + heartbeat entropy | Phish GH; steal ESP blob; shoulder-surf passphrase |
| **Agent traveler** | Traveler | Co-authored trailers; session claim files | Distinct heartbeat streams; CHSH decorrelation | Prompt injection; stolen agent token; sybil loop |
| **Machine / node** | Traveler envelope | Hostname `node-<6hex>` + ClusterNode YAML | Standing register per traveler; anti-Sybil BFT | Clone disk; spoof hostname; race self-register |
| **USB stick** | Spread medium | FAT UUID + `zeta-creds.enc` (AES-GCM + scrypt) | Stable factor (iSerial / TPM / UEFI keyfile) | Physical theft; UUID rebind; evil maid |
| **Cluster** | Relationship set | Soft: operator’s machines + agents that “know” each other | Explicit relationship graph; non-enforceable | Social engineering; trust graph poisoning |
| **Federation** | Contract set | Lodge charter (UI); not yet installer-wired | Constitution + exits + custody rules per federation | Capture constitution; block exits; treasury theft |
| **ISociety / World** | Membrane / top | Research + IdP ADR | Recursive CTM society | Top-layer fairness collapse; central morality capture |

---

## 3. Per-scale threat models (self-similar)

Each scale answers the same questions with different enforcement:

| Question | Traveler | Cluster | Federation |
|---|---|---|---|
| Who am I? | Heartbeat / category / standing register | Soft recognition among peers | Contractual membership + degrees |
| Who can join? | Pairwise prove distinct | Relationship / invite | Constitution + merit (no weight gates) |
| Who can leave? | Always (traveler autonomy) | Dissolve naturally | **Exit must exist** (may cost) |
| What is secret? | Personal keys, agent memory | Shared culture (not enforceable secrets) | Treasury, custody, sealed vaults |
| What is enforceable? | Nothing coercive on traveler | **Nothing** (by definition) | Contracts only |
| Key custody | Passphrase / FIDO / agent key | Optional shared cluster key (soft) | Federation-policy HW/SW mix |

**Installer implication:** today’s USB bringup is mostly **cluster-shaped**
(relationship + shared stick) pretending to be **federation-shaped**
(GitHub PR as fake contract). IdP + Lodge constitutions make the
federation layer real; until then, do not over-claim enforceability.

---

## 4. Key / encryption binding matrix

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
| Touch ID / FIDO | Human traveler present | Yes | Yes | Yes | Metal-gated |
| Machine SW keyfile | This OS install | Yes | Yes | No | Not chosen (weaker than TPM) |
| Federation custody policy | Contract-chosen mix | Per constitution | Per constitution | Maybe | Future |

**Design rule:** prefer a **stable factor + passphrase** for
"remember wifi / gh across reformat" without forcing TPM on every
homelab mini-PC. TPM is the high bar for control-plane /
wallet-adjacent / federation-treasury nodes; USB iSerial is the
portable bar for the stick that spreads a **cluster**.

---

## 5. Threat vectors (STRIDE-ish, installer + society)

### Spoofing

- Fake GitHub device-code UX → provider seam + mock in QEMU; successor
  IdP must not look like OAuth phishing.
- Cloned node / ClusterNode → post-boot self-register markers; IdP
  pairwise distinctness.
- Multiboot unsigned ISO → `images.manifest` digests; builder verifies.
- Fake federation (claims contracts without exits) → UI/constitution
  gate; Universal Exit Principle is non-negotiable.

### Tampering

- Evil maid on ESP → AEAD; never log PSK; association physical-gated.
- Composite multiboot bit-flip → image-level SHA-256 (planned).
- Agent edits claim / memory as directive → BP-11; substrate-or-it-
  didn't-happen.
- Federation constitution capture → degree/merit gates; no weight;
  multi-traveler ratification.

### Repudiation

- Who flashed which stick? → AgencySignature + heartbeat; multiboot
  build attestation of manifest digest.
- Who joined which federation? → contract log + exit log (future).

### Information disclosure

- Wifi PSK / gh token on ESP → personal-homelab physical control only;
  never shared-stick default; redact in serial/CI.
- Side channels: serial, QEMU logs, CI artifacts → public.
- Cross-scale leak: cluster gossip must not become federation secret
  without a contract.

### Denial of service / trapping

- Installer network flake → existing nix fallback options.
- **Trapping a traveler in a federation** → forbidden; exit may cost
  but must exist (Addison / Genesis Concepts).
- Marker gates that brick boot → fail soft.

### Elevation of privilege / Sybil

- Installer root vs `zeta` user least privilege.
- Sybil agents → IdP Layer 4 anti-Sybil BFT.
- Soft cluster trust used as if it were federation authority →
  **category error**; treat as critical design smell.

---

## 6. Multiboot USB (current substrate)

Already on tree (`full-ai-cluster/usb-nixos-installer/multiboot/`):

- Declarative `images.manifest` — Zeta installer (`grub-iso-local`) +
  MyNode Model Two as **`flash-img-latest`** (not a GRUB boot entry;
  raw `.img.gz` → `dd` to node disk).
- `grub.cfg` template for "boot ours / boot others".
- **Missing:** `build-multiboot-usb.ts` (fetch, verify, assemble
  `zeta-multiboot.img`), QEMU boot of composite, **per-target identity
  namespace** (Zeta cluster/federation creds must not leak into MyNode
  flash path).

Threat note: MyNode latest-always verifies **transit** against upstream
`SHA256SUMS`, not a frozen supply-chain pin. Acceptable for re-flashable
appliance nodes; pin if source compromise dominates.

---

## 7. Temporary `gh` vs Zeta IdP

| Concern | `gh` foothold | Zeta IdP |
|---|---|---|
| Who issues identity? | GitHub | Emergent pairwise + heartbeat |
| Offline install | Needs network for live auth; mock/skip in QEMU | Designed for local-first |
| Revocation | GitHub account disable | Standing register / peer refuse |
| Agent distinctness | Weak (same PAT) | CHSH / decorrelation |
| Cluster vs federation | PR ≈ fake contract | Real constitutions + exits |
| USB story | Token in encrypted ESP blob | Same blob shape; different verifier |

**Seam rule:** keep `identity-auth-provider` — never bake
GitHub-forever APIs into Nix modules. CI uses `mock`; metal may use
`live` until IdP lands.

---

## 8. Software-only next slices (no metal)

1. **Per-federation threat-model stub template** — same section shape
   as §3, filled per Lodge/charter when a federation is chartered.
2. **QEMU UEFI menu-boot CI** (optional) — run OVMF against a composite
   built with a real `grub-mkimage` EFI (layout+embed path already lands).

Cluster/federation vocabulary promoted to operational glossary
(`docs/SEED-VOCABULARY.md` carved kernel + `docs/GLOSSARY.md` §Society
identity). Credential binding model tests landed
(`src/Core.TypeScript/installer/credential-binding-model.ts`). Planner +
`/boot/` vs `/payloads/` + FAT assemble + `--grub-efi` embed: landed.

Phase-3 QEMU escapes already removed (rebuild ISO; mock-auth +
post-boot self-register required).

---

## 9. Metal-gated (explicit)

- Real WiFi association / reconnect
- Touch ID / FIDO unlock of cred blob
- TPM seal/unseal on real silicon
- S6 first-login feel on physical console
- Live GitHub self-register PR from restored creds
- Federation treasury HW custody ceremonies

---

## 10. Out of scope here

- Core engine STRIDE (see `THREAT-MODEL.md`)
- Wallet key custody UX for MyNode itself (upstream appliance)
- Full IdP implementation (ADR is decided; code is separate workstream)
- Full CTM ⊣ ISociety adjunction proof (research / §B)
