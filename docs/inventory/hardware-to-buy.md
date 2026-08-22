# `hardware-to-buy.md` — procurement shortlist (the "no more buying willy nilly" surface)

The buy-side companion to the owned-inventory draft
([`hardware-2026-05-27-addison-draft.md`](hardware-2026-05-27-addison-draft.md)). Backs
[081KSGS9H0008QG0R001VVEZQ9](../backlog/P1/081KSGS9H0008QG0R001VVEZQ9-hardware-inventory-vs-cluster-reconciliation-gap-analysis-buying-decisions-aaron-2026-05-26.md)
("we will know what and how we need to expand so we are not buying willy nilly anymore").

**Prices are ballpark (verified via WebSearch 2026-05-31); confirm at purchase** — hardware
availability + price drift fast (per [`dep-pin-search-first-authority`](../../.claude/rules/dep-pin-search-first-authority.md)).
Operator decides purchases (budget gate); this is the list, not an order.

---

## 1. FPGA — open-bitstream, runtime-reconfigurable (~8–12 boards, ~a few thousand $)

**Operator intent (2026-05-31):** *"we were looking for open bitstream so we could modify config
at runtime… willing to spend a few thousand… maybe 8–12 we were going to buy."* (Re-saving the
list that was researched before but never landed — operator was going to buy and forgot.)

**The criterion rules the field:** *open bitstream* (you can generate/modify the config
programmatically + reload at runtime) is **fully** met only by Lattice ECP5/iCE40 (Project
Trellis / IceStorm) and Gowin (Project Apicula) — all driven by the open
**Yosys + nextpnr + openFPGALoader** toolchain. **Xilinx Artix-7 (Alchitry Au, Arty) is only
*partially* open** (Project X-Ray) and needs proprietary Vivado for the clean path — so it is
**deprioritized** despite bigger logic, unless we later need the Artix capacity. This is also the
right fabric for [081KR50HA0008QG0R003T5MZAC](../backlog/P1/081KRA5AR0008QG0R002X77BEB-toffoli-circuit-type-wire-map-formal-model.md)
(Toffoli-Z-set reversible ops — generate fabric config from circuits) and
[081KSE6WT0008QG0R002T0BFN4](../backlog/P3/081KSE6WT0008QG0R002T0BFN4-polyglot-accelerator-hardware-shape-coral-ncs-jetson-fpga-beyond-nvidia-only-2026-05-25.md)
(polyglot-accelerator hardware shape).

> **"Modify config at runtime" — honest scope:** ECP5/Gowin open tooling gives fast **whole-
> bitstream reload** at runtime (compute a new config, load it over USB/SD/WiFi). The
> [ULX3S](https://www.crowdsupply.com/radiona/ulx3s) explicitly supports **OTA bitstream over
> WiFi + selecting bitstreams from SD card** — directly the "modify config at runtime" workflow.
> True *sub-region* dynamic partial reconfiguration (reconfigure part while the rest runs) is
> more limited on Lattice open tooling; if we need that specifically, flag it as a research item.

### Recommended BOM (~11 boards, ~$1,050; scale ULX3S 85F up to reach the few-thousand budget)

| Board | FPGA | ~LUTs | Open toolchain | Why | ~Unit | Qty | Subtotal |
|---|---|---|---|---|---|---|---|
| [ULX3S 85F](https://www.crowdsupply.com/radiona/ulx3s) | ECP5 LFE5U-85F | 84k | Trellis/Yosys/nextpnr (full) | **workhorse** — biggest open ECP5; WiFi+SD+display; OTA + SD runtime bitstream | ~$155 | 4 | ~$620 |
| ULX3S 12F | ECP5 LFE5U-12F | 12k | full | cheaper variant for distributed/edge nodes | ~$99 | 2 | ~$198 |
| [ColorLight 5A-75B](https://www.weigu.lu/other_projects/fpga/fpga_ecp5_5a75b/index.html) | ECP5 LFE5U-25 | 24k | Trellis (full) | dirt-cheap fleet (repurposed LED board); great for parallel experiments | ~$35 | 2 | ~$70 |
| [Tang Nano 20K](https://learn.lushaylabs.com/getting-setup-with-the-tang-nano-9k/) | Gowin GW2A | 20k | Apicula/Yosys/nextpnr (full) | **vendor diversity** (different silicon, different open project) — 081KRW63S0008QG0R0022SFKPM's diverse-failure-modes axis applied to FPGA | ~$40 | 2 | ~$80 |
| iCEBreaker | iCE40 UP5K | 5.3k | IceStorm (the *cleanest*/oldest fully-open) | reference baseline; smallest, most-trusted open flow | ~$70 | 1 | ~$70 |

**Total: ~11 boards, ~$1,038.** To use the full "few thousand" budget for more serious reversible-
ops logic, scale **ULX3S 85F to 6–8** (+$310–620) → ~$1.4–1.7k, still 8–12+ boards.

**Deprioritized (open-bitstream criterion not fully met):**
[Alchitry Au / Au+](https://alchitry.com/boards/au/) (Xilinx Artix-7, 33k logic cells, 256MB
DDR3, ~$300) — bigger + DDR3, but Vivado-dependent (X-Ray only partial). Buy *only* if a workload
needs the Artix capacity/DDR3 that ECP5 can't give; it breaks the open-toolchain story.

**One-time tooling (cheap, buy 2–3):** USB JTAG/SPI programmers if a board lacks onboard
(most above have onboard); ~$10–20 each.

---

## 2. Agent-native key storage (HSM / TPM) — backs 081KRW63S0008QG0R0022SFKPM custody design

Buys for the [agent-native key-custody design](../research/2026-05-31-agent-native-key-custody-design-otto-holds-key-aaron-cant-access-wont-lose-threshold-attestation-honest-debug-dump-limit.md)
([081KRW63S0008QG0R0022SFKPM](../backlog/P2/081KRW63S0008QG0R0022SFKPM-cryptographic-sovereignty-for-ais-n-of-m-hsm-key-management-mika-2026-05-18.md)).
The design needs **per-guard hardware roots** (HSM/TPM, key never leaves chip) under a **FROST
threshold coordinator** across guards. Diversity (multiple vendors / open + closed) is a *feature*
per 081KRW63S0008QG0R0022SFKPM's "diverse failure modes" axis.

### Tier 0 — already owned (use first, $0)

- **TPM 2.0** in the mini-PCs / Start9 servers (fTPM or discrete) — free per-machine sealing root;
  good enough to seal each guard's FROST *share*. **Start here for the PoC.**
- Hardware wallets already owned (Coldcard MK4/Q, Trezor, Ledger Nano S Plus, Jade Plus) — these
  are *Bitcoin-signing* devices; useful for the **wallet/financial** sharp-edge (081KRW63S0008QG0R002V20TYJ), less so
  for general agent key custody. Note as adjacent, not the primary custody hardware.

### Tier 1 — discrete HSMs (the buy list; one per guard, diversify vendors)

| Device | ~Price | On-chip crypto | Why buy | Note |
|---|---|---|---|---|
| [YubiHSM 2 (v2.4)](https://www.yubico.com/product/yubihsm-2/) | ~$650 | Ed25519, ECDSA, RSA, AES (on-chip) | "world's smallest HSM"; **HSM-resident ops** = key never in host RAM (the *today* mitigation for the debug-dump limit) | limited key storage ([CalyxOS Feb-2026](https://calyxos.org/news/2026/02/10/calyxos-hsm-signing/)); no in-firmware Shamir → threshold runs above it |
| [YubiHSM 2 FIPS](https://www.yubico.com/product/yubihsm-2-series/yubihsm-2-fips/) | ~$950 | same, FIPS-validated | if a guard needs compliance posture | optional |
| [Nitrokey NetHSM](https://www.nitrokey.com/products/nethsm) | ~$1.2k+ | network HSM | **fully open-source HSM** — the *auditable, no-backdoor-verifiable* guard (vendor-diversity vs Yubico) | one as the open anchor |

**Recommended Tier-1 buy:** **3× YubiHSM 2** (one per primary guard node/location, ~$1,950) +
**1× NetHSM** (~$1,200) for the open/auditable axis = **~$3,150** for a 4-guard hardware root.
Start smaller if validating: **2× YubiHSM 2** (~$1,300) is enough to prove HSM-resident FROST.

### Tier 2 — open measured-boot keys (research-then-buy, cheap)

- **Tillitis TKey** (~$60–80, open-source USB) — *derives* keys from measured firmware (no stored
  secret; key exists only when the *attested app* runs). Embodies the design's "attest, don't
  remember" inversion. **Buy 2 to experiment** with attestation-gated derivation. *Confirm 2026
  availability/specs before ordering (search was inconclusive).*

### Tier 3 — confidential computing ("Xbox-style", down the road, don't buy yet)

The Layer-4 full fix for the debug-dump limit (encrypted memory + measured boot). **Not a buy-now**
— note for later: one **AMD EPYC or Ryzen-PRO** node with **SEV-SNP** (PSP-rooted memory
encryption + attestation) as a confidential-compute guard. Consumer Ryzen often lacks full
SEV-SNP — verify the specific SKU before buying. (Inventory already has Ryzen 9 9955HX / 7940HS;
confirm whether either exposes SEV-SNP.)

### No-hardware note

The **FROST threshold coordinator** is *software* on existing nodes — nothing to buy; it sits
*above* the per-guard HSMs/TPMs.

---

## 3. Power monitoring — 20A smart energy monitor (Goldmate UPS)

**Operator intent (2026-06-09):** *"add a 20-amp smart energy monitor for monitoring Goldmate UPS power
usage."* The 2nd k8s cluster is now up (booted off the zflash USB) — this is to meter its UPS draw.

**Technical caution — most smart plugs are 15A, not 20A.** A NEMA 5-15 plug rated 15A/1875W is
*under-rated* for a 20A circuit. For a true 20A path you need either a **20A-rated inline outlet/plug**
(NEMA 5-20) **or** a **CT-clamp circuit monitor** (no plug rating limit — clamps the conductor). For a
**UPS specifically**, meter the **input** side (wall → monitor → UPS) so you measure real grid draw on a
clean sine wave; metering a UPS *output* can see modified-sine waveforms some plugs mis-read.

| Option | Type | ~Price (ballpark — **confirm at purchase**) | Notes |
|---|---|---|---|
| **Emporia Vue (Gen 3) + CT clamp** | Circuit-level, CT-clamp | ~$130–170 | **No 20A plug limit** (clamps the feed); local API + Home-Assistant friendly; best for whole-UPS metering |
| **Shelly EM / Pro EM + CT** | Circuit-level, CT-clamp | ~$40–90 | Local HTTP/MQTT API (no cloud needed), HA-native; great for self-hosted; 1–2 CT channels |
| **Legrand radiant Smart 20A Outlet (Netatmo)** | Hardwired 20A outlet, NEMA 5-20 | ~$50–70 | True 20A; replaces an existing outlet; app monitoring (cloud) |
| **Tuya/"kayesmart" WiFi 20A Plug (4400W) + power monitor** | Inline plug, 20A | ~$20–35 | Plug-and-play 20A; use **LocalTuya** for local/HA control (stock app is cloud) |
| ~~Govee / Emporia / Kasa smart plug~~ | Inline plug, **15A only** | ~$15–30 | **Under-rated for 20A — do not use on a 20A UPS feed** (listed to rule out) |

**Recommendation:** for a UPS, prefer a **CT-clamp circuit monitor** — **Shelly EM** (cheap, fully
local API, HA-native — best fit for a self-hosted cluster) or **Emporia Vue** (slightly pricier, easy
app + local). CT-clamp sidesteps the 20A plug-rating problem entirely and gives clean local telemetry
you can pull into cluster dashboards. If you'd rather plug-and-play, a **20A-rated inline** (Legrand
radiant or a Tuya 20A via LocalTuya) — **not** a 15A plug. **Avoid cloud-only** (stock Govee/Tuya app)
for a self-hosted setup; choose local-API (Shelly / Emporia / LocalTuya). Confirm 20A rating, NEMA plug
type, and the Goldmate's input connector before buying. *(Operator decides — budget gate; this is the
list, not an order.)*

---

## Quick decision summary

- **FPGA now:** ~$1,000–1,700, ~8–12 ECP5/Gowin/iCE40 open-bitstream boards (ULX3S-led). Skip Xilinx.
- **Key custody PoC now:** $0 — TPM 2.0 already in the machines; validate HSM-resident FROST.
- **Key custody hardware:** ~$1,300 (2× YubiHSM 2) to start → ~$3,150 (3× YubiHSM 2 + NetHSM) for a
  4-guard root; +~$150 for 2 Tillitis TKey to experiment.
- **Confidential compute:** later (one SEV-SNP node when the design reaches Layer 4).
- **Power monitoring now:** ~$40–90 — a **CT-clamp** monitor (Shelly EM, local API, or Emporia Vue) on
  the Goldmate UPS input; sidesteps the 20A plug-rating problem and gives local telemetry. Avoid 15A
  smart plugs on a 20A feed; avoid cloud-only apps for the self-hosted cluster.
