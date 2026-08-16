<!-- hardware-surface: class=wishlist; owned=false -->

# `hardware-to-buy.md` — procurement shortlist (the "no more buying willy nilly" surface)

> **Provenance class: WISHLIST — hardware we do NOT own.** Kept in `docs/inventory/` because the buy
> decision is driven by the owned inventory, but it must never be reconciled into the register or
> counted as an asset. Declared explicitly so it cannot be mistaken for one
> (081M00R59KS087G0R001W3837V).

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

> **2026-08-14 — that flag is now RESOLVED, and it changes the recommended part.** Aaron:
> *"we want **fpga for reversibility research** … open bitstream runtime modifiable with **0 down
> time of the bitstream itself**."* Zero-downtime = **partial reconfiguration (PR)**. Findings,
> checked 2026-08-14 (full survey:
> [`2026-08-14-open-source-hsm-and-fido-devices-we-can-fabricate-and-modify-plus-research-fpga-class.md`](../research/2026-08-14-open-source-hsm-and-fido-devices-we-can-fabricate-and-modify-plus-research-fpga-class.md) §5):
>
> - **iCE40 has NO true PR** — only warm boot / multiboot (up to 4 whole images, selected on
>   reset, via `icemulti`). Whole-device reload ⇒ downtime. Best bitstream openness, wrong tool.
> - **ECP5 DOES have PR, and it is documented.** Project Trellis §Partial Bitstreams:
>   *"LSC_WRITE_ADDRESS can be used to make partial bitstreams. Combined with background
>   reconfiguration and the ability to reload frames glitchlessly; **partial reconfiguration is
>   possible on ECP5**."* Needs the `BACKGROUND_RECONFIG` sysCONFIG option, then JTAG `0x79`
>   (no data) + `0x74 0x00` before the partial data.
> - **The frame addressing is fully documented ONLY for the 45k device** — so for PR the part is
>   **`LFE5U-45F`, not the 85F this BOM leads with.** ⇒ new row below.
> - **No turnkey flow exists**: `nextpnr` has no reconfigurable-partition feature. Building a
>   partial bitstream means constraining a region, extracting frames, driving `LSC_WRITE_ADDRESS`
>   ourselves. Spike, with real risk of failure: **`081M00VJM9C087G0R000G60B3V`**.
> - **Xilinx stays deprioritized** — but note `openXC7` is now alive (`nextpnr-xilinx` pushed
>   2026-08-14, Kintex-7 support, NLnet-funded). Open-flow PR there is still demo-grade.
>
> *Reversibility = reversible computing* (Landauer / Bennett / Fredkin–Toffoli), evidenced by
> Aaron's own 2026-05-28 Turn 18, not assumed. Pairs with backlog
> `081KR50HA0008QG0R0028HNZH0` (Toffoli vs AND/OR differential) and
> `src/Core.TypeScript/algebra/key-erasure-meter.ts` (the erasure side of the same physics).

### Recommended BOM (~11 boards, ~$1,050; scale ULX3S 85F up to reach the few-thousand budget)

> **⚠ PRICES BELOW ARE STALE — reverified 2026-08-14 on Crowd Supply:** ULX3S **12F is now \$155**
> (was ~\$99) and **85F is now \$275** (was ~\$155). Both **in stock**, \$8 US shipping. The 45F
> variant is **not** currently listed on Crowd Supply. Recompute before ordering — the "~\$1,038"
> total no longer holds; the same 11 boards are now roughly **\$1,700**.

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

### 1b. Class B add-on — the **partial-reconfiguration** boards (buy these if 0-downtime is the goal)

Added 2026-08-14. This does **not** replace the BOM above; it adds the parts that satisfy the
*zero-downtime* half of the criterion, which the BOM above does not. Prices verified where a
source is named; **confirm at purchase**.

| Board | FPGA part | LUTs | Why this one, specifically | ~Unit | Qty | Source / status |
|---|---|---|---|---|---|---|
| **Colorlight i9 (v7.2)** | **`LFE5U-45F-6BG381`** | 44k | **The PR-documented device.** Project Trellis documents ECP5 frame addressing *only* for the 45k part — this is the cheapest way to hold one. 8 MB SDRAM, 8 MB SPI flash, dual Ethernet PHY | ~$40–60 | **3** | Amazon / AliExpress; open flow (yosys + prjtrellis + nextpnr). Price unverified — search-sourced |
| Colorlight i9 ext board | — | — | breakout for the i9 module (JTAG + headers); needed to drive JTAG PR sequences | ~$15–25 | 2 | same listings |
| **ULX3S 85F** | `LFE5U-85F-6BG381C` | 84k | capacity workhorse for the Toffoli/Clifford payload once PR is proven on 45F; WiFi + SD OTA whole-bitstream reload | **$275** | 2 | **In stock**, Crowd Supply, verified 2026-08-14 |
| ULX3S 12F | `LFE5U-12F` | 12k | cheap second ECP5 for the *host* side of a PR experiment | **$155** | 1 | **In stock**, verified 2026-08-14 |
| iCEBreaker (or any UP5K) | `iCE40UP5K-SG48I` | 5.3k | **trusted-flow baseline** — the cleanest open bitstream; also the exact part in the TKey, so Class A and Class B share a fabric | ~$70 | 1 | chip alone ≈ **$11**, in stock DigiKey |
| USB-JTAG (FT2232H / openFPGALoader-supported) | — | — | PR needs **JTAG-level control** (`0x79` / `0x74 0x00` before partial data); onboard USB-serial is not enough | ~$15–25 | 2 | generic |

**Suggested first purchase (~$900–1,000):** 3× Colorlight i9 + 2× ext board + 2× ULX3S 85F +
1× UP5K board + 2× JTAG adapters. Rationale: the i9s are what the **spike** actually needs (cheap,
and the only documented PR target); the 85Fs are what the **payload** needs once it works; the
UP5K is the known-good control.

**What each buys, plainly:**

- **i9/45F** → the *only* device where zero-downtime PR is documented well enough to attempt.
- **85F** → logic capacity for reversible-gate networks; **no PR advantage** (undocumented frames).
- **UP5K** → the most trusted open flow, as a control that the toolchain itself is not the bug;
  doubles as the TKey fabric for Class A work.
- **JTAG adapters** → without JTAG-level access the PR sequence cannot be issued at all.

**Do not buy for PR:** Xilinx Artix-7 boards (Vivado dependence; `openXC7` PR is demo-grade),
Gowin (no established PR), any iCE40 (warm boot ≠ PR).

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

> **2026-08-14 correction — the FIPS row matters more than this table implied.** Verified on
> Yubico's own store: **YubiHSM 2 v2.4 = $650** and **YubiHSM 2 FIPS 140-3 v2.4 = $950**. The
> **non-FIPS SKU carries no validation at all**; only the FIPS SKU is validated, and it is now
> **FIPS 140-3 Overall Level 3, CMVP cert #5302, valid 2026-06-03** (not 140-2, as previously
> recorded). For **custody of value** — Aaron's *"as mathematically safe as coinbase"* bar —
> physical certification is exactly the property being bought, so **buy the FIPS SKU there**.
> The non-FIPS SKU remains fine for development and for non-custody guard roots.
>
> Also unverified: the **NetHSM ~$1,200** figure below could not be confirmed. One industry
> source puts NetHSM at *"less than €10,000"*. **Confirm with Nitrokey before budgeting.**

**Recommended Tier-1 buy:** **3× YubiHSM 2** (one per primary guard node/location, ~$1,950) +
**1× NetHSM** (~$1,200) for the open/auditable axis = **~$3,150** for a 4-guard hardware root.
Start smaller if validating: **2× YubiHSM 2** (~$1,300) is enough to prove HSM-resident FROST.

### Tier 2 — open measured-boot keys (research-then-buy, cheap)

**Verified 2026-08-14** (the earlier "search was inconclusive" note is now discharged — full
survey: [`2026-08-14-open-source-hsm-and-fido-devices-…`](../research/2026-08-14-open-source-hsm-and-fido-devices-we-can-fabricate-and-modify-plus-research-fpga-class.md)):

| Item | SKU | Price | Availability |
|---|---|---|---|
| **Tillitis TKey** | TK-1 | **880 SEK ≈ $92.5** | **In stock** — `shop.tillitis.se/products.json`, `available: true` |
| **Tillitis TKey Unlocked** | TK-1U | **880 SEK ≈ $92.5** | **In stock** |
| **TKey Programmer Board (TP1)** | TP-1 | **500 SEK ≈ $53** | **In stock** |

*(SEK→USD 0.10516 on 2026-08-14. Ships to USA. Price was ~$60–80 in the old note; it is ~$92.5.)*

- **Buy the *Unlocked* variant, not the stock TKey.** The end-user TKey has its FPGA bitstream
  **locked in NVCM and cannot be modified**. Only TKey Unlocked is user-programmable, and it
  **requires the TP1 programmer**. ⇒ **2× TKey Unlocked + 1× TP1 ≈ $238.**
- *Derives* keys from measured firmware: `CDI = BLAKE2s(UDS ‖ USS ‖ BLAKE2s(app))`. No stored
  secret; the key exists only while the *attested app* runs — the "attest, don't remember" inversion.
- **The one device in this list whose hardware design we can actually modify.** PCB (KiCad +
  layout + gerbers, **CERN-OHL-S-2.0**), Verilog gateware and firmware (**BSD-2-Clause** since
  2025-10-29), and a **fully open toolchain** — verified in the Makefile: yosys → nextpnr-ice40 →
  icestorm, **no vendor tool anywhere**. Honest limit: the iCE40 UP5K die and the CH552 USB MCU
  are still proprietary *silicon*; what is open is the design and the tooling.
- **Liveness:** very live — `tillitis-key1` pushed 2026-07-21; ~20 org repos pushed in the last
  90 days, including a **WIP FIDO2 app** and an **ML-DSA (post-quantum) signer**.
- **Vendor root — the interesting exception, and a reason to actually buy these** (CHECKED
  2026-08-14, from #10685): TKey **splits** the two claims a TPM or SEV-SNP fuses into one.
  *(a) "this app is unmodified"* is **self-rooted** — `CDI = BLAKE2s(UDS ‖ USS ‖ BLAKE2s(program))`,
  so tampering with the app changes the derived key and you detect it by **key continuity** (same
  app ⇒ same key as last time). No vendor is consulted, and Tillitis states it does not retain a
  copy of the UDS. *(b) "this is a genuine TKey, not a clone"* is **vendor-rooted** — that is what
  the vendor-supplied `tkey-verification` tool checks, against Tillitis's production signing.
  So the vendor cap that applies to every other device on this list binds TKey's *authenticity*
  claim but **not** its *integrity* claim. With an open FPGA bitstream and open firmware, that is
  the closest purchasable thing to a vendor-independent measured-boot root.
  - **Extension (2026-08-14 survey):** that vendor is a **parameter, not a fixed party.**
    `tkey-verification`'s README: *"If your TKey wasn't provisioned by Tillitis, and instead by
    another 'vendor' like your IT department, you will need to run **their** version."* So a
    self-provisioned or self-fabricated TKey does not *lose* the authenticity root — it
    **relocates** it to us. What is lost is that a **stranger** can verify without trusting us.
- Follow-on: **`081M00VJGAV087G0R00393F6X5`** — become our own vendor (own UDS, own
  `tkey-verification` instance). Self-fabrication costs **third-party** attestation, not integrity.

**Also worth a small buy (added 2026-08-14):**

- **nRF52840 Dongle + OpenSK** — **$10.00, 4,328 in stock at DigiKey.** Cheapest working FIDO2
  device; the `2.0` branch is **FIDO certified**. Caveat in OpenSK's own words: *"proof-of-concept
  … NOT meant for daily usage."* Buy 2 as a cheap FIDO2 reference, not as a credential.
- **Nitrokey 3A NFC (~€59 ≈ $68)** — **the most completely published MCU-key hardware**
  (schematic + `.kicad_pcb` + gerbers, CERN-OHL-S-2.0, pushed 2026-04-24) *and* FIDO certified.
  The one device that is both certifiable-grade and board-modifiable. Vendor-diversity axis.
- **TROPIC01 (Tropic Square)** — *watch, don't buy yet.* Open-**architecture** secure element, GA
  since 2025-02, distributed via DigiKey. The only purchasable part combining a real SE with a
  published architecture; the natural upgrade over an FPGA for actual key storage.

**Ruled out on evidence:** **CrypTech Alpha** — dormant (last news 2020-09-21; `git.cryptech.is`
repos idle 5–11 years; funding collapse; commercial partner closed). **Solo 2 hardware** — repo
last pushed 2022-04-18, incomplete by its own README (*"not … the cavity PCBs, or NFC antenna"*),
**no OSHW licence**; the *keys* are fine to buy ($34–46, in stock), the *design* is not modifiable.
**pico-hsm/pico-fido** — excellent lab tools, **no secure element** (keys in ordinary flash);
never for value.

### Tier 3 — confidential computing ("Xbox-style", down the road, don't buy yet)

The Layer-4 full fix for the debug-dump limit (encrypted memory + measured boot). **Not a buy-now**
— note for later: one **AMD EPYC or Ryzen-PRO** node with **SEV-SNP** (PSP-rooted memory
encryption + attestation) as a confidential-compute guard. Consumer Ryzen often lacks full
SEV-SNP — verify the specific SKU before buying. (Inventory already has Ryzen 9 9955HX / 7940HS;
confirm whether either exposes SEV-SNP.)

**Vendor root, before this becomes a purchase (root: AMD ARK).** SEV-SNP attestation reports chain
VCEK → ASK → **ARK, AMD's self-signed root**, with certificates distributed by AMD's KDS. Buying this
node buys a real capability *and* takes on AMD as the root of every attestation that node makes. Two
consequences for the buy decision, neither of which argues against buying:

- **AMD is the friendliest of the options on verification.** VCEK derivation is deterministic from
  chip ID + TCB version, so certificates cache and verification runs **offline** — no per-attestation
  call to AMD. Prefer that mode from day one; it removes an availability and surveillance dependency
  (though not the root itself).
- **If a second confidential-compute guard is ever bought, buy Intel TDX, not a second AMD box.**
  Two SEV-SNP guards share one root and fail together; an AMD-rooted guard plus an Intel-rooted guard
  are genuinely decorrelated. Same reasoning as the Tier-1 YubiHSM + NetHSM split above — which is
  already the right instinct, applied one layer down to the attestation root.

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

- **FPGA now:** ~$1,700 for the original ~11-board BOM at **reverified 2026-08-14 prices**
  (ULX3S 12F $155 / 85F $275, both in stock). Skip Xilinx.
- **FPGA for 0-downtime (Class B, new 2026-08-14):** ~$900–1,000 — **3× Colorlight i9
  (`LFE5U-45F`)** + ext boards + 2× ULX3S 85F + a UP5K control + 2× JTAG adapters. **The 45F is
  the part, not the 85F** — Project Trellis documents ECP5 partial-bitstream frame addressing
  only for the 45k device. See §1b; spike `081M00VJM9C087G0R000G60B3V`.
- **Key custody PoC now:** $0 — TPM 2.0 already in the machines; validate HSM-resident FROST.
- **Key custody hardware:** ~$1,300 (2× YubiHSM 2) to start → ~$3,150 (3× YubiHSM 2 + NetHSM) for a
  4-guard root. **For real custody use the FIPS SKU ($950 ea.), not the $650 one** — only the
  FIPS SKU is validated (140-3 L3, cert #5302).
- **Open/fabricable tokens (reverified 2026-08-14):** **2× TKey Unlocked + 1× TP1 ≈ $238** (the
  *Unlocked* variant, not the stock TKey — the stock one's bitstream is NVCM-locked). Optional:
  2× nRF52840 Dongle @ $10 for OpenSK; 1× Nitrokey 3A NFC ≈ $68 for the certified-and-open axis.
  **Self-built hardware cannot replace the YubiKeys** for attestation-gated relying parties
  (FIDO certification is $6,000–$13,500 per implementation; no cert ⇒ no MDS entry ⇒ rejected).
  It is additive.
- **Confidential compute:** later (one SEV-SNP node when the design reaches Layer 4).
- **Power monitoring now:** ~$40–90 — a **CT-clamp** monitor (Shelly EM, local API, or Emporia Vue) on
  the Goldmate UPS input; sidesteps the 20A plug-rating problem and gives local telemetry. Avoid 15A
  smart plugs on a 20A feed; avoid cloud-only apps for the self-hosted cluster.
