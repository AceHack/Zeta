# Open-source HSM / FIDO devices we can fabricate and modify — and the research-FPGA class

**Date:** 2026-08-14 · **Register:** Beacon (outward-facing; every liveness claim carries dated evidence)
**Author:** the shadow (Otto's shadow-work role) · **Status:** survey; recommendations split by use case

Aaron 2026-08-14:

> "are there any **open source HSM and/or FIDO compatible devices you can get printed by yourself** and we
> can **modify the hardware design** of the open source?"

and, mid-survey:

> "okay we want **fpga for reversibility research** we should add to our **hardware wish list** for when we
> buy more fpga hardware **this will likely be soon**, and we already have a wishlist of **open bitstream
> runtime modifiable with 0 down time of the bitstream itself**."

Those are **two device classes** and they select nearly disjoint hardware. This doc keeps them apart:

- **Class A — security token / HSM.** Small, fixed-function. The fabric (if any) is a means to an end.
- **Class B — research FPGA.** Open bitstream + **partial reconfiguration** (the standard term for
  "runtime modifiable with zero downtime"). Sized for reversible-logic experiments.

Two requirements run through both, and they are **not** the same requirement:

- **(a) fabricable by us** — we can have the PCB made and assembled;
- **(b) modifiable design** — the *hardware* design is open enough to change, not just the firmware.

---

## 0. Method, and one owned error

Every liveness claim below is **checked**, not inferred (`anchor-to-human-prior-art`: an anchor must be
checked, not merely cited). Sources of truth used, in order of preference:

1. GitHub REST API `pushed_at` / `archived` / `license.spdx_id` — machine-read, not scraped prose.
2. Shopify `products.json` feeds — the merchant's own inventory flag.
3. Vendor spec text fetched directly (W3C, Project Trellis, vendor READMEs).
4. Web search — used only where 1–3 are unavailable, and labelled as such.

**Owned error, recorded because it is the whole reason for that ordering.** My first read of the
Tillitis shop, via a page-summarising fetch, reported **"TKey — Sold out"** for all three products. That
was **wrong**. The authoritative Shopify feed at `shop.tillitis.se/products.json`, pulled 2026-08-14,
returns `available: true` for TK-1, TK-1U and TP-1. The rendered page carries a sold-out *badge template*
that a prose summariser picked up as state. **Look, don't infer** — and prefer the machine feed over the
rendering of it.

### Corrections to the brief I was given

| Brief said | Actual, checked 2026-08-14 |
|---|---|
| YubiHSM 2 carries **FIPS 140-2 Level 3** | The **YubiHSM 2 FIPS** SKU is **FIPS 140-3 Overall Level 3**, CMVP cert **#5302**, valid **2026-06-03**. Newer standard. **And the non-FIPS `YubiHSM 2` ($650) has no validation at all** — the inventory's "3× YubiHSM 2" buys the unvalidated SKU. |
| PR #10685 "just landed" | **It landed mid-survey.** Open at first check (`mergedAt: null`), **merged 2026-08-14T19:27:16Z** — recorded rather than silently corrected, because a check that was honest went stale inside an hour, which is the same liveness lesson this doc is about. It **is** merged doctrine now, and §1 extends it. |
| SoloKeys "had business trouble, may have stalled" | **Shop is live and every SKU is in stock** ($34–$50). But the *hardware* repo `solokeys/solo2-hw` last pushed **2022-04-18**, is **incomplete by its own README**, and is **not openly licensed**. The company is fine; the *open-hardware* claim is what is stalled. |
| Nitrokey 3 firmware open, hardware unclear | **Nitrokey 3 hardware is the most completely published of the MCU keys**: KiCad schematic **+ `.kicad_pcb` layout + production gerbers**, **CERN-OHL-S-2.0**, pushed **2026-04-24**. More open than Solo 2's. |
| TKey is "the only candidate with no proprietary link anywhere" | **Too strong.** Design, toolchain and firmware are open end-to-end — *verified*. But the **iCE40 UP5K die is proprietary Lattice silicon** and the **CH552 USB MCU is a proprietary WCH part** (its firmware is open, in-repo, built with SDCC). No retail device escapes proprietary *dies*. The correct claim is **"no proprietary tooling and no proprietary design"**, which is still unique in this field. |
| CrypTech "may be dormant or dead" | **Confirmed dormant.** Corrected only in that the evidence is sharper than "may be" — see §3. |

---

## 1. The central finding: integrity is self-rootable, authenticity is not — but the vendor is a *parameter*

This is the load-bearing result and it is not a footnote.

A self-fabricated device has **no manufacturer CA**. Nothing can prove "this is a genuine X." That sounds
fatal and mostly is not, because **integrity and authenticity are separable properties and only
authenticity structurally needs a third party.**

TKey is the worked case. Its measured boot computes

```
CDI = BLAKE2s(UDS ‖ USS ‖ BLAKE2s(app))
```

so the key that exists on the device is a **function of the code that is running**. Load different code,
get a different identity — no signature, no CA, no network. That is **integrity, self-rooted, with no
vendor in the loop.** Fabricate the board yourself and this property is *unchanged*, because it is
arithmetic, not attestation.

What a self-build loses is the answer to *"is this a genuine TKey and not a clone?"* — and that is the
one question that structurally requires someone other than you to vouch.

**The sharpening, and it came from Tillitis' own tooling.** `tkey-verification`'s README says:

> *"If your TKey wasn't provisioned by Tillitis, and instead by another 'vendor' like your IT department,
> you will need to run **their** version of the `tkey-verification` program instead of this one."*

The **vendor role is a parameter of the design, not a fixed party.** The UDS is generated air-gapped at
provisioning and Tillitis never stores it (`data/uds.hex` is a build input, locked into FPGA NVCM
afterwards). Self-fabrication therefore does not *delete* the vendor root — it **relocates it to us.**

So the honest statement is one notch sharper than "you lose attestation":

> Self-fabrication costs **third-party** attestation, not attestation. Integrity stays self-rooted.
> Authenticity stays rooted — in **our** key, in a log **we** publish. What is lost is the property that
> a **stranger** can verify without trusting us.

That maps exactly onto PR #10685's finding — *every attestation terminates in some vendor's self-signed
key* — with one addition it does not yet make: **that vendor can be us, and for a self-built device it
must be.** Tillitis' own path even publishes to a **Sigsum** transparency log, which is the shape this
repo already wants: the root is unavoidable, so make it *witnessed* instead of pretending it is absent.

Tillitis states the limit of its own tool, and it should be quoted rather than softened:

> *"The verification of this identity does not prove that the TKey hasn't been tampered with, only that
> the identity of an app running on it is the same."*

### The hard constraint that cuts the other way

Aaron chose YubiKeys because *"that's the one OpenAI suggests for their high security clearance program
for the more dangerous models, they require it soon for access to more secure models."*

**A self-built key cannot serve that purpose, and no amount of design cleverness changes it.** The gate
is not technical, it is a **certification and registry** gate:

- FIDO Alliance **Authenticator Functional Certification: $6,000 (member) / $9,000 (non-member)**;
  Level 1+ and above **$9,000 / $13,500** — plus Alliance membership. Per certified implementation.
- Without certification there is no **FIDO Metadata Service (MDS)** entry, so a relying party that checks
  attestation against MDS has nothing to match, and *by design* rejects.
- **Enterprise attestation** programs are stricter still — they pin specific AAGUIDs.

**But the split is the useful result, and the other half is genuinely permissive.** Verified directly
against the W3C spec text (`https://www.w3.org/TR/webauthn-3/`):

> `attestation`, of type DOMString, **defaulting to `"none"`** … *"This is the default, and unknown values
> fall back to the behavior of this value."*

So: **most ordinary relying parties accept a self-built authenticator fine** — the default asks for no
attestation at all. (Status note: WebAuthn **Level 2** is the W3C Recommendation; **Level 3** is a
Candidate Recommendation, held at CR at least until 2026-06-23, and carries the same default.)

**Conclusion for procurement:** self-fabricated hardware is **additive, never a replacement**. Keep the
YubiKeys for the attestation-gated relying parties. Build our own for the substrate we control.

---

## 2. The second honest caveat: open ≠ secure

A YubiHSM 2 FIPS carries **FIPS 140-3 Overall Level 3** (cert #5302). A self-built FPGA board carries
**nothing**: no tamper mesh, no epoxy, no side-channel countermeasures, no certification, no
fault-injection hardening.

TKey's own threat model is admirably blunt about where its line is, and it applies *a fortiori* to
anything we fabricate:

- **In scope:** software attacks from the USB host against firmware/FPGA design, and timing attacks.
- **Out of scope:** *"All physical and electrical attacks applied to the board"* — including reading the
  external flash, **glitching**, and **EM leakage** from both CPU and MCU.
- Tamper evidence is *a transparent glued case that shows marks if opened*. That is evidence, not resistance.
- A named residual: *"It's possible to change the configuration of the Lattice iCE40 UltraPlus FPGA while
  the power is on"* (warm-boot attack reaching EBR/SPRAM).

OpenSK states its own equivalent in one line: *"this project is proof-of-concept and a research platform,
and it is NOT meant for daily usage,"* with cryptographic side-channel resistance explicitly incomplete.

**This is why the recommendation is per-use-case and not general.** The threat model for a decentralized
PKI experiment (adversary: a remote attacker with no physical access; failure: a bad experiment) is not
the threat model for custody of value (adversary: a funded attacker who will buy the device, glitch it,
and decap it; failure: irreversible loss). Giving one answer for both would be dishonest.

Against Aaron's stated target — *"as mathematically safe as coinbase or other custody system"* — **every
device in this survey falls short, and the FPGA ones fall short by the widest margin.** Institutional
custody is not one device; it is HSMs with physical certification, geographically split quorums,
insurance, and audited procedure. What we *can* match is the **math** (threshold signing, FROST); what we
cannot match with a self-built board is the **physical** and **procedural** half.

### The dual-use observation worth recording

The **same mechanism** appears as Class B's headline feature and Class A's named threat: iCE40 warm-boot
reconfiguration is *"runtime bitstream reload"* on the research board and *"warm boot attack"* in the
TKey threat model. Per `dual-use-detection-is-neutral-oracle-decides`, the mechanism is neutral and the
context decides — but a device that is *both* (a token built on a reconfigurable fabric) inherits the
attack along with the feature. That is a real cost of the FPGA-token approach, not a wash.

---

## 3. Class A — comparison table (all liveness checked 2026-08-14)

| Device | What is open | Toolchain open? | Fabricable by us? | Modifiable how | Attestation story | Certification | Price / availability | Liveness (evidence) |
|---|---|---|---|---|---|---|---|---|
| **Tillitis TKey (TK1)** | **PCB + gateware + firmware + case**. `tk1-pcba` = full KiCad project (`tk1.kicad_pcb`, all sheets, STEP case, gerbers in releases) under **CERN-OHL-S-2.0**; `tillitis-key1` gateware+fw under **BSD-2-Clause** (relicensed from GPL-2.0 on 2025-10-29) | **YES, fully** — verified in `hw/application_fpga/Makefile`: `yosys` → `nextpnr-ice40` → `icebram`/`icepack`/`icetime` (Project IceStorm), `tillitis-iceprog`. **No vendor tool anywhere.** Tillitis even forks `icestorm` + `nextpnr` | **Yes** — schematic + layout + gerbers + BOM; iCE40UP5K-SG48I ≈ **$11** and in stock at DigiKey | **Verilog gateware** (PicoRV32 SoC, TRNG, UDS, touch-sense cores) + firmware + PCB. This is the only entry where "modify the hardware design" means *change the logic*, not *change the board around a fixed chip* | **Self-rootable integrity** (CDI measured boot). Vendor genuineness is a **parameter** — `tkey-verification` + Sigsum log; a self-build runs *our* vendor instance | **None.** `tkey-fido2` is **WIP**, not certified | **880 SEK ≈ $92.5** (TKey or TKey Unlocked); **TP1 programmer 500 SEK ≈ $53**. **All three in stock** (`products.json`, SEK→USD 0.10516 on 2026-08-14) | **Very live.** `tillitis-key1` pushed 2026-07-21; org has ~20 repos pushed in the last 90 days incl. `tkey-fido2` (2026-07-10), `tkey-pq-device-signer` (ML-DSA, 2026-06-17), `tkey-boot-verifier` (2026-07-16). `tk1-pcba` last pushed 2024-09-20 — **stable, not stale** (hardware does not churn) |
| **TKey "Castor"** | next-gen gateware/firmware generation; **runs on existing Bellatrix hardware** | same | n/a (firmware generation) | adds flash persistence + two preloaded device apps; the FIDO2 app targets it | same | none | free (software); needs **TKey Unlocked + TP1** to flash | alpha announced 2025-06-02; a tagged version under audit; **not GA** |
| **OpenSK** (nRF52840) | **firmware only** (Rust, Apache-2.0). Hardware is Nordic's stock dongle | n/a (Rust/Tock, open) | **No PCB to fab** — you buy a dongle. Cheapest working device by far | firmware only; **the hardware design is not yours to modify** | none by default; self-signed batch key optional | **`2.0` branch is FIDO certified** on the nRF52840 dongle; **`develop` is not** | **nRF52840-Dongle $10.00, 4,328 in stock** (DigiKey) + a 3D-printed case | **Live** — pushed 2026-08-06. But self-described **"proof-of-concept … NOT meant for daily usage"** |
| **SoloKeys Solo 2** (LPC55S69) | firmware (Apache-2.0, Trussed). **Hardware: partial** — `solo2-hw` has KiCad for the *module* PCB only, *"not … the cavity PCBs, or NFC antenna"*, *"only provided as a reference"* | vendor MCU; firmware toolchain open | **Not cleanly** — incomplete design files, **no OSHW licence** (`NOASSERTION`) | firmware yes; **hardware effectively no** | LPC55S69 has secure boot + PUF; Hacker SKUs are unlocked (⇒ no secure boot) | FIDO certified product line | **In stock**: Solo 2 Hacker **$35**, Solo 2C **$34**, NFC variants **$46** (`products.json`) | **Split**: firmware pushed 2026-07-16; **`solo2-hw` pushed 2022-04-18**. UK entity SOLOKEY LTD. dissolved 2025-04-29; US shop trading normally |
| **Nitrokey 3A/3C NFC** (LPC55S69) | firmware (Apache-2.0, Trussed) **and hardware: schematic + `.kicad_pcb` + gerbers**, **CERN-OHL-S-2.0** | vendor MCU; firmware toolchain open | **Yes** — the most completely published MCU-key design here | firmware + board layout; **the MCU is a fixed proprietary die** | LPC55S69 secure boot / PUF; vendor-rooted | FIDO certified; LPC55S6x claims CC EAL6+ at the *chip* level | ~**€59 ≈ $68** (3A NFC) | **Live** — firmware 2026-08-06; **hardware repos pushed 2026-04-24** |
| **Nitrokey HSM 2** | **claim does not extend to the security core** — wraps the **CardContact SmartCard-HSM**; open *"up until the smartcard software"*, SE firmware proprietary | no | no | no | vendor-rooted (smartcard) | SE-level certs | ~$100–150 (unverified) | product live; **openness claim materially weaker than marketing implies** |
| **Nitrokey NetHSM** | **system software EUPL-1.2**, genuinely open (`Nitrokey/nethsm`, pushed 2026-07-14) | n/a (appliance) | no (appliance) | software only | vendor/appliance-rooted | none claimed | **repo inventory says ~$1,200 — I could not confirm it.** One industry source puts NetHSM *"less than €10,000"*. **Treat the $1.2k line as unverified** | **Live** |
| **CrypTech Alpha** (Artix-7) | design + Verilog cores open; the original open-HSM project | **No** — Artix-7 wants **Vivado**; `prjxray` is partial | in principle; nobody is shipping | RTL | n/a | none | **not purchasable** | **DORMANT.** Last news **2020-09-21** (v4.0). `git.cryptech.is` repos show idle **5–11 years**. 2019 report: *"progress … has slowed considerably due to a serious slow-down in funding"*; first commercial partner Diamond Key Security *"closed its doors"* |
| **CrypTkey** (secworks) | CrypTech HSM as a TKey device app **on ULX3S ECP5-85** | yes (Trellis flow) | yes (board is COTS) | RTL + firmware | inherits TKey's | none | board only | **Stub.** BSD-2-Clause, pushed 2025-02-25, README: **"Just started. Not completed. Does. Not. Work."** — *but it is by Joachim Strömbergson, author of both CrypTech's and TKey's cores.* The design intent is exactly our Class A×B crossover |
| **pico-fido / pico-hsm** (RP2040/RP2350/ESP32) | **firmware, AGPL-3.0**; hardware = a $4 Pico | n/a | **cheapest possible self-build** | firmware only | none; no SE | none | Pico ~$4–8, ubiquitous | **Live** — pico-fido pushed 2026-08-11 (1.4k★), pico-hsm 2026-07-28. **No secure element: keys sit in ordinary flash.** Fine for a lab, wrong for value |
| **CanoKey** (STM32) | firmware Apache-2.0 (`canokey-core` pushed 2026-08-14) | n/a | partially | firmware | none/limited | some SKUs FIDO certified | ~$25–40 | core **live**; `canokey-stm32` pushed 2025-02-22 |
| **OpenTitan** (Earl Grey) | **Apache-2.0 RTL** — a real silicon RoT | Verilator/open sim; FPGA targets exist | **RTL yes; silicon no** | RTL is genuinely modifiable | strong, but **vendor-rooted at the fuse/CA** | commercial-grade | commercial silicon via **zeroRISC + Nuvoton (+ Winbond)** — early-access, not retail; **Earl Grey 2** upstreaming through H2-2026/H1-2027 (adds CHERI + PQC) | **Very live** — pushed 2026-08-14; *"shipping in production"* (Google OSS blog, 2026-03) |
| **Caliptra** | **Apache-2.0 RTL**, OCP datacenter RoT IP | open sim | **RTL yes; silicon no** | RTL | integrator-rooted | n/a (IP) | n/a | **Very live** — `caliptra-rtl` and `-sw` both pushed **2026-08-14** |
| **TROPIC01** (Tropic Square) | **open-architecture secure element** — auditable design, RISC-V based; sister company to SatoshiLabs/Trezor | n/a (fixed die) | **buy the chip, fab your board** | board yes; **die no** | vendor-rooted (Tropic Square) | tamper-resistant SE class | **GA since 2025-02-24**, full production, distribution incl. DigiKey | **Live** — repo pushed 2026-08-14. **The brief missed this one and it matters**: it is the only *purchasable* part that combines a real secure element with a published architecture |
| **Precursor** (bunnie Huang, XC7S50) | open hardware + Xous OS; designed around *evidence-based trust* | **No** — Spartan-7 wants Vivado | buy it | FPGA gateware + open hardware | none; the design's whole thesis is **user-verifiable** rather than vendor-attested | none | **$512**, Crowd Supply, orders ship **2026-08-31** | **Live** |

**On OpenTitan and Caliptra, stated plainly so it cannot be misread:** modifying the RTL is completely
real and completely free. **Taping it out is an ASIC run — six to seven figures, and 12+ months.** "Open
silicon" here means *the source of a chip someone else fabs*. The practical modifiable target for us is
**FPGA emulation of that RTL**, which is Class B hardware, not a device we can hold.

---

## 4. What "fabricate a TKey ourselves" actually costs

The design files are complete enough that this is an ordinary PCB job, not a research project:

- `hw/tk1.kicad_pcb` + all schematic sheets, KiCad 7, CI-built with **KiBot**; gerbers, BOM and position
  files published per release. Case STEP files for **both 3D-printed and injection-moulded** variants.
- Licence **CERN-OHL-S-2.0** — a real open-hardware licence that *explicitly permits modification*, with
  reciprocity (share modified designs alike). This is the licence difference that separates TKey and
  Nitrokey 3 from Solo 2's unlicensed "reference only".
- Key parts in stock: **iCE40UP5K-SG48I ≈ $11** (DigiKey), CH552 USB MCU (pennies), SPI flash, USB-C.
- 4-layer, fine-pitch QFN + BGA-adjacent work ⇒ **assembly service, not hand-soldering**.

**Order-of-magnitude only, and flagged as unverified:** a small turnkey PCBA run (fab + parts + assembly,
qty 5–10) at a low-cost assembler is plausibly **$40–120/unit at qty 10**, dominated by setup. **Get a
real quote before quoting this to anyone** — the survey did not price an actual job.

**Against buying: at $92.5 a finished TKey, self-fabrication is never the cheaper path at our volumes.**
The reason to fab is **because you changed the design** — a different fabric, added cores, a different
form factor, our own UDS provisioning. If the design is unchanged, buy it.

**And there is a cheaper first step that gets 90% of the modifiability:** **TKey Unlocked + TP1
programmer ≈ $145** lets you flash **your own gateware and your own UDS** onto a factory-built board. The
stock TKey has its bitstream locked in NVCM and **cannot** be modified. Fab only when the *board* must
change.

---

## 5. Class B — research FPGA: open bitstream **and** zero-downtime partial reconfiguration

### 5.1 Which "reversibility"? — evidenced, not assumed

I was told not to guess between *reversible computing* and *reverse engineering*. **I did not have to
guess: the repo already contains Aaron saying which.** In
`docs/research/2026-05-28-kestrel-7th-ferry-…-fpga-landauer-limit-reversible-computing-plus-runtime-rewritable-open-bitstream-self-rewriting-…md`,
Turn 18 is Aaron's own framing — FPGAs as substrate where *"reversible computation is achievable for most
operations"* and the cost of irreversibility is **Landauer's kT ln 2 per bit erased**. Turn 20 is the
runtime half in his words:

> *"specifically i have some that allow bitstream rewriting at runtime and the format is open so it can
> self rewrite too on order."*

So the reading is **reversible computing** (Landauer 1961; Bennett 1973; Fredkin–Toffoli conservative
logic 1982), and it is **evidenced by Aaron's own prior statement**, not inferred by me. It also already
has a backlog row: **`081KR50HA0008QG0R0028HNZH0`** — *"VHDL/Verilog Toffoli gate network for Z-set
join"*, requiring **both** a reversible (Toffoli) and an irreversible (AND/OR) implementation of the same
join, same interface — i.e. a **differential energy measurement**, which is the only way this becomes
`metered` rather than `toy`.

**The other half of the same physics, already in-repo:** `src/Core.TypeScript/algebra/key-erasure-meter.ts`.
Landauer's bound is a statement about **erasure**, so a key-erasure meter and reversible logic are the
same physics approached from opposite ends. If a Toffoli-vs-AND/OR energy delta is ever measured on real
fabric, it is a falsifier for both.

*(Reverse engineering is the other plausible reading and is not excluded — Class B hardware serves it
too, via `prjxray`-style bitstream work. If that was the intent, say so and the board choice barely
changes.)*

### 5.2 The frontier, honestly: **nobody has both, and the middle candidate is real**

| Fabric | Bitstream openness | Partial reconfiguration (zero downtime) | Size | Verdict |
|---|---|---|---|---|
| **Lattice iCE40 UP5K** | **Complete** — Project IceStorm, the oldest and most trusted open flow | **No true PR.** Only **warm boot / multiboot**: up to 4 whole images in flash, selected on reset (`icemulti`). Whole-device reload ⇒ *downtime*. Community work describes a bootloader giving *"an illusion of partial reconfiguration"* | 5.3k LUT | Best openness, **wrong tool for PR** |
| **Lattice ECP5** | **Complete** — Project Trellis (`prjtrellis` pushed 2026-08-09) | **YES, and documented.** Project Trellis §Partial Bitstreams: *"LSC_WRITE_ADDRESS can be used to make partial bitstreams. Combined with background reconfiguration and the ability to reload frames glitchlessly; **partial reconfiguration is possible on ECP5**."* Requires `BACKGROUND_RECONFIG` sysCONFIG, then JTAG `0x79` (no data) and `0x74 0x00` before the partial data | 12k–84k LUT | **The middle candidate, and it wins** |
| **Xilinx 7-series** (Artix/Spartan/Kintex) | **Partial** — `prjxray` (f4pga repo idle since 2025-06; **openXC7's fork pushed 2026-08-08**) | Vendor DFX is mature; **open-flow PR is demo-grade** | large | Real PR, weakest openness |
| **Gowin** | Project Apicula (pushed 2026-08-12) | not established | 20k | vendor diversity only |

**The decisive detail, and it changes what we should buy.** Project Trellis documents ECP5 frame
addressing **only for the 45k device**:

> *"It has only been fully documented for the **45k** device."*

Our existing wish list leads with the **85F**. For partial reconfiguration specifically, **the documented
part is `LFE5U-45F`, not `LFE5U-85F`.** That is a concrete, checkable correction to the buy list, and it
is cheap to act on.

**Do not oversell it.** What exists is a documented *mechanism*, not a turnkey flow: there is **no
`nextpnr` "reconfigurable partition" feature**. Building a partial bitstream means constraining a region,
extracting its frames, and driving `LSC_WRITE_ADDRESS` ourselves. That is a **spike with real risk of
failure** — minted as `081M00VJM9C087G0R000G60B3V` — not a purchase that delivers the capability.

**On openXC7:** genuinely alive (`nextpnr-xilinx` pushed 2026-08-14, `prjxray` fork 2026-08-08, Kintex-7
support, NLnet-funded). But **Xilinx PR through the open flow is demonstration-grade**, and the vendor
path needs Vivado, which fails the open-bitstream criterion the wish list was built on. **The existing
"skip Xilinx" call stands** — with the note that openXC7 is now the strongest reason to revisit it later.

### 5.3 The structural match Aaron may not have noticed

Partial reconfiguration **is** the hardware instance of the update pattern he described for `ace` —
*"0 energy minimal survivor state and 0 down type update state transitions … for easy update patch."*
Same property, one level down: **swap the implementation while the thing keeps running.** The FPGA work
and the `ace` update-path work are two scales of one idea, which means a result at either scale is
evidence about the other.

*(Deliberate restraint: PR #10687 found that **"time crystal" already carries four incompatible referents
across five files** in this repo. This doc cites the **property** — zero-downtime partial reconfiguration —
and does not add a fifth use of that phrase.)*

### 5.4 Concrete Class-B buy list — see `docs/inventory/hardware-to-buy.md` §1

Extended there rather than duplicated here, per the existing wish list. Headline part numbers:
**Colorlight i9 (`LFE5U-45F-6BG381`, 44k LUT, ~$40–60)** as the PR-documented workhorse;
**ULX3S 85F ($275, in stock)** for capacity; **iCEBreaker (UP5K)** as the trusted-flow baseline.

---

## 6. Recommendation, split by use case

### (1) Investor-facing PoC

**Buy 2× TKey Unlocked + 1× TP1 programmer ≈ $238** and demonstrate the property nobody else in the room
can demonstrate: **a device whose identity is a function of the code it is running, verified with an
entirely open toolchain, on hardware whose full design we hold.**

- Do **not** fabricate for this. A fabbed board demos identically and costs weeks.
- Do **not** claim "no vendor anywhere." Claim **"no proprietary tooling and no proprietary design, on
  silicon we did not fab"** — which is true, checkable, and still the strongest claim available.
- The demo that lands: change one line of the device app, watch the public key change, **without a CA**.
- Contrast it with the YubiKey honestly on the same table: theirs is certified and ours is not, and ours
  is auditable and theirs is not. Both true. A pitch that only says the second half is the one diligence
  catches.

### (2) Decentralized PKI / post-internet-mesh survivability

**This is the use case where self-fabrication is genuinely the right answer**, because the failure it
guards against is *the vendor and its CA are gone or captured*.

- **TKey is the only candidate that survives that scenario**, because we hold PCB, gateware, firmware and
  toolchain — an entire device reconstructible from a git clone and a PCB house.
- **Become our own vendor**: generate our own UDS, run our own `tkey-verification` instance, publish to a
  transparency log. Minted as **`081M00VJGAV087G0R00393F6X5`**.
- Accept explicitly: **no stranger can verify our devices.** In a mesh where the relying parties are *us*,
  that is not a defect — it is the correct trust topology, and it is the same argument as
  `itron-hub-patent-boundary`: the mediating third party is what we are trying not to need.
- Watch **TROPIC01** as the upgrade path: a purchasable secure element with a published architecture is
  strictly better than an FPGA for key storage, and it does not reintroduce a hub.

### (3) Actual custody of value

**Do not use anything in this survey as the primary root. Not one candidate is close to the stated bar.**

- **Buy YubiHSM 2 FIPS ($950), not YubiHSM 2 ($650).** Only the FIPS SKU carries the validation (140-3
  Overall Level 3, cert #5302, 2026-06-03) — and physical certification is precisely the property custody
  needs and the property a self-build cannot have.
- Keep the existing FROST/threshold design **above** the HSMs: the math is where we can genuinely match
  institutional custody. The physical and procedural halves we cannot, and saying so is the honest register.
- **pico-hsm is disqualified here** — no secure element, keys in ordinary flash. Excellent lab tool,
  wrong tool for value.
- A self-built device may hold a **witness or attestation-only** key, never a spending key.

**Standing constraints, restated because they bind all three:** no agent holds a signing key; no key
material is ever printed or logged; and *nothing operator-run, only operator-approved via biometric* — the
agent may execute setup (seed/CA/key generation), the human approves each sensitive gate.

---

## 7. Open questions

1. **Which "reversibility"?** Evidenced as reversible computing (§5.1) from Aaron's own 2026-05-28 turn.
   If reverse engineering was meant instead, correct it — the board choice barely changes.
2. **Does the ECP5 PR mechanism actually work end-to-end on a 45F?** Nobody in this survey has shown a
   working zero-downtime region swap through the open flow. That is the spike.
3. **Real PCBA quote** for a TKey clone at qty 10 — §4's range is unverified.
4. **NetHSM price** — the repo's ~$1,200 could not be confirmed.
5. **Is a TKey-derived device on ECP5 worth it** (the `CrypTkey` shape), given warm-boot/PR reconfiguration
   is a threat-model liability on a token (§2)?

## Anchors (Beacon)

- **Landauer, R.** (1961) *Irreversibility and heat generation in the computing process*, IBM J. Res. Dev. — `kT ln 2`.
- **Bennett, C. H.** (1973) *Logical reversibility of computation*, IBM J. Res. Dev.
- **Fredkin, E. & Toffoli, T.** (1982) *Conservative logic*, Int. J. Theor. Phys. — the reversible gate set.
- **TCG DICE** — the measured-boot / CDI construction TKey implements.
- **W3C Web Authentication, Level 2** (Recommendation) and **Level 3** (CR) — `attestation` defaults to `"none"`.
- **Project IceStorm / Project Trellis / nextpnr / Yosys** — Clifford Wolf, David Shah, gatecat et al.; the open FPGA flows this entire survey rests on.
- **Huang, A. "bunnie"** — *Can We Build Trustable Hardware?* / IRIS — the argument that **user-verifiable** beats **vendor-attested**, which is the intellectual root of §1.
- **Hirschman, A. O.** (1970) *Exit, Voice, and Loyalty* — why a chosen root differs from an imposed one.

## Pointers

- `docs/inventory/hardware-to-buy.md` — Tier 2 (TKey) and §1 (research FPGA) updated by this survey.
- PR #10685 (**merged 2026-08-14T19:27Z**, mid-survey) — vendor-root naming; §1 here extends it with *the vendor can be us*.
- `docs/research/2026-05-28-kestrel-7th-ferry-…-fpga-landauer-limit-reversible-computing-…md` — Aaron's own Turns 18/20/22.
- `docs/backlog/P1/081KR50HA0008QG0R0028HNZH0-3-fpga-vhdl-toffoli-synthesis-design.md` — the reversible/irreversible differential.
- `src/Core.TypeScript/algebra/key-erasure-meter.ts` — the erasure side of the same physics.
- `workitems/081M00VJGAV087G0R00393F6X5-*` — become-our-own-vendor provisioning.
- `workitems/081M00VJM9C087G0R000G60B3V-*` — ECP5 partial-reconfiguration spike.
