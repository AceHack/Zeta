<!-- hardware-surface: class=snapshot; units=206; lines=188; body-sha256=cfc0474997f4a97a9f4b93f7c2ad51c29e7784cf2b2165f4a92ea19f513f0ac3; superseded-by=addison-re-audit; register=inventory/items/ -->

# Hardware inventory — Addison draft 2026-05-27

> **Provenance class: SNAPSHOT** — a human audit at a point in time. Not the register, not a live
> list. The unit/line counts are pinned in the header above and verified by
> `bun src/Core.TypeScript/inventory/reconcile-surfaces.ts` (081M00R59KS087G0R001W3837V): edit the
> body and the header moves with it, or the check goes red.
>
> **Do not bulk-import these rows into `inventory/items/`.** Addison is re-doing the audit (Aaron
> 2026-08-14); importing a superseded snapshot would hand her 206 rows to re-verify against her own
> fresh numbers, and every correction would become a diff against data that was never right.

Forwarded by Aaron 2026-05-27 from Addison's verification/audit pass. **Draft state** — operator note: *"the counts on the bitcoin miners are messed up there are more but it's close we can save it to lfg inventory somewhere we had started this with our amazon history in git."*

Composes with 081KSGS9H0008QG0R001VVEZQ9 (hardware-inventory-vs-cluster reconciliation). Promotes to canonical (`hardware.md`) after Addison + operator reconcile miner counts.

## Devices (Alexa-family)

- Amazon Echo Show 21
- Amazon Echo Show 15
- Amazon Echo Dot (5th Gen)
- Amazon Echo Spot
- Amazon Echo Show 5
- Amazon Echo Dot Max
- Amazon Echo Studio
- Amazon Echo Show 8
- Amazon Echo (4th Gen)
- Amazon Echo Dot (3rd Gen)
- Amazon Echo (1st Gen)

## Computers (mini-PCs, workstations, server-class)

- GMKtec NucBox Evo
- CWWK Magic P1 Pocket Mini PC
- Mini PC TD6 (Unbranded J4125)
- Mini PC TD5 (Unbranded N100)
- GMKtec NucBox K11 × 2
- Machenike Mini PC Ryzen 9 7940HS
- Beelink ME Mini N150
- Start9 Server One
- MINISFORUM MS-A2 Workstation (AMD Ryzen 9 9955HX)
- MINISFORUM MS-A1 Pro
- Beelink GTi15 Ultra × 2
- Beelink GTi14
- CanaKit Raspberry Pi Compute Module 5
- GMKtec Mini PC EVO X2
- Start9 Server Pure

## GPUs

- NVIDIA GeForce RTX 5090 × 1
- NVIDIA GeForce RTX 4090 × 1
- NVIDIA GeForce RTX 3090 (maybe) — uncertain provenance
- NVIDIA GeForce RTX 3090 × 3
- EVGA GeForce RTX 3060 × 3
- AMD Radeon RX 6700 XT × 5
- NVIDIA GeForce RTX 3080 Ti × 6
- Gigabyte GeForce RTX 3060 Ti Eagle OC × 4

## iPhones

- Apple iPhone 5s

## GL.iNet + networking hubs

- GL.iNet Dual Band Wi-Fi 7 Travel Router (GL-MT3000 / Beryl AX)
- GL.iNet Comet Pro Remote KVM (GL-RM10)
- Adaprox Fingerbot
- PoE Splitter
- ATX Power Control Board
- GL.iNet Flint 3 Wi-Fi 7 Router (GL-BE9300)
- GL.iNet Remote KVM (GL-KM1)

## Wi-Fi + networking adapters + switches

- Ubiquiti UACC-POE++-10G
- Morse Micro HaLow Link1 MMHL1EXT
- SONOFF Zigbee 3.0 USB Dongle Plus-E
- SMLIGHT SLZB-06p10 Zigbee 3.0 PoE Ethernet Adapter
- SMLIGHT SLZB-06M3 Zigbee/Thread EFR32MG24 Ethernet/USB/WiFi PoE Adapter
- SMLIGHT SLZB-06 Zigbee 3.0 PoE Ethernet/USB/WiFi Adapter
- SONOFF Zigbee 3.0 USB Dongle Plus-P
- PCIe Extender Quarter 4x
- Warmstor Switch Cord 45cm
- BrosTrend AC1L WiFi Adapter
- SONOFF Zigbee 3.0 USB Dongle (ZBDongle-E ver 1.2)
- TP-Link TL-SX105 5-Port 10G Multi-Gigabit Desktop Switch
- Ubiquiti Cloud Key Gen2 Plus (UCK-G2-SSD)
- Razer Thunderbolt 5 Dock Chroma
- Mobile Hotspot HMHSAT616
- Ubiquiti Dream Router (UDR)
- TP-Link TL-SX1008 8-Port 10G Multi-Gigabit Desktop Switch
- Ubiquiti UniFi Flex XG (USW-Flex-XG)
- TRENDnet TEG-S50g 5-Port Gigabit GREENnet Switch
- Ubiquiti USW-Pro-XG-8 PoE
- Netgear Nighthawk S8000
- Peplink Pepwave MAX BR1 (transcribed: "Room Rainor MAX60")
- Ubiquiti Pro 8-Port Gigabit Ethernet Switch (GS808E)
- Ubiquiti U7 Pro (U7-Pro-XG)
- Ubiquiti UniFi Express (UX)
- Helium Mobile Network Hotspot
- ExpressVPN Aircove AX1800
- Ubiquiti Cloud Gateway Ultra (UCG-Ultra)
- Helium Mobile Network Hotspot HMHSAOT06US
- Bitaxe Gamma 601 (White / Purple / Mini)
- GL.iNet AXT1800 Slate AX Nano
- Canaan Avalon Nano 3
- Flume Water Monitor Li Pro
- Canaan Avalon (transcribed: "Camar avanon")

## Docking stations / external GPU

- Minisforum DEG1 eGPU Docking Station
- Beelink EX Docking Station
- PCIe 4.0 eGPU for Mini PC

## Docking stations (no eGPU)

- Plugable Thunderbolt 4 Dock (TBT4-UDZ)
- iVANKY FusionDock Pro 3 (VCD13)
- Amazon Basics Thunderbolt 4 Docking Station
- Dell WD19TB / K20A Docking Station

## Power supply + UPS

- Ugreen 1200W DC UPS Battery Backup
- Amazon Basics Standby UPS 1500VA (ABMT1500)
- be quiet! Dark Power Pro 13
- Super Flower Leadex 1600W (SF-1600F14HT)
- ASUS ROG Thor 1600W Titanium
- DC Power Supply
- Goldmate UPS 2000VA

## Storage

- Crucial Micron 8GB DDR4 2666 UDIMM
- Ugreen NASync DXP480T Plus
- Ugreen NASync DXP4800 Plus
- Minisforum MS-A1 Pro Mini Server (with 4× 20TB IronWolf Pro HDDs)
- CineRAID 4-Bay SOHO RAID Enclosure (HFR2S43S2)
- Ubiquiti MicroSD Card 256GB
- Industrial Data Micro SD 128MB
- Shenzhen Weigish USB-C 6-in-1 Hard Drive Hub (HB0604)
- Crucial 48GB DDR5 5600MHz RAM
- Seeed Studio M.2 2280 NVMe SSD 1TB
- Western Digital WD Black 1TB HDD (WD1003FZEX)

## Hardware wallets

- Blockstream Jade Plus
- Coinkite Coldcard Q v1
- BitKey BK001 Black
- Ledger Nano S Plus
- Ellipal Titan 3
- Coldcard MK4
- Trezor Hardware Wallet

## Smart plugs

- TP-Link Tapo Mini Smart Wi-Fi Plug (P115)
- TP-Link Tapo Mini Smart Wi-Fi Plug (P110M)
- Amazon Basics Smart Plug (HPAAW5NBU4P)
- Keep Connect Router Rebooter (KC117)
- Emporia Smart Plug (EM501)
- Ioteket Energy Meter
- Cyneva A1 Link Wi-Fi 2.4

## Miners — **DRAFT; counts under-represented per operator**

> *"the counts on the bitcoin miners are messed up there are more but it's close"* — Aaron 2026-05-27

- Solar X Miner
- Goldshell Mini Doge III
- IceRiver ALPH AL1 LITE
- Gaim 3 M1
- HNT BTC Miner

Reconciliation note: operator + Addison to update miner counts in next audit pass. Current list under-represents actual miner inventory.

## Other / TBD

- Vidpro All-in-One Card Reader
- PC-F4 2502 EXCH:W F 232205 VER 1
- Blink Sync Module 2 (BSM000203U)
- Hette N35 L00184
- Polycom OBi200 Google Voice Adapter
- 8-Way Coaxial Splitter (CMC2008H)
- HSD K.Y TDESK-07
- Steam Link (Model 1003)
- Ezlo Plus Smart Home Hub (Z-A-TW-PL-US-450)
- Intertec 60W 6-Port Charger
- Home Assistant Connect ZBT-1
- NVIDIA Shield TV Pro (P2897)
- Meshtastic LoRa Antenna (transcribed: "Mediatek Lora Antenna Scheaffer")
- NVIDIA Shield TV (659 SKU)
- Hubitat Elevation C-8 Pro
- Phoscon ConBee II / ConBee XXV
- GeoPulse GP100 V2.0
- Zooz 800 Series Z-Wave Long Range USB Stick (ZST39 LR)
- Corsair RGB Hub
- StarTech DKT30CSDHPD USB-C Multiport Adapter
- Corsair Memory RW FON 19
- Mad Catz Memory Cube
- Sterling Home Hub
- Amazon Smart Air Quality Monitor (P3A7EN)
- ROG AP12S ARGB Fan
- Mind Explorer Light 3.0 Sound Synergy ZXR
- HyFix Spatial Intelligence M8W 200
- Heltec WiFi LoRa 32 (transcribed: "Hette LoRa 3.2 w.F.BLE")
- HDMI Switcher 5x1 4K@60Hz HDR HDCP
- WeatherXM WG1200
- PEED Nano KVM
- Sky Portable Weather Station (SKY 100)
- VistaCam 1203
- NVIDIA Jetson Orin Nano Developer Kit (P3766)
- Seeed Studio SenseCAP Indicator D1
- Cell Master / Phone Farm (has 20 phones, Cell Hasher)
- ASUS ROG Zenith II Supreme FX Extreme Alpha Motherboard
- G.Skill Trident Z NEO 128GB (F4-3600C18Q-128GTZN)
- Power Supply Tester
- Umbrel Home Server (U130122)
- Vantec CD/DVD Player/Burner (NST-540S3-BK)
- PCIe Extender Full 16x
- PCIe Extender Half 8x
- Drone Xtreme Fliers
- Home Assistant Green (Nabu Casa NC Green 1175)
- Home Assistant Connect Z-Wave (Nabu Casa NC ZWA 9734 ZWA2)
- Home Assistant Yellow PoE Kit (Nabu Casa Yellow Kit POE)
- PCIe 1x to PCIe 16x Extender Riser
- PCIe 1x X6 Riser Card
- LilyGo T-Deck Plus
- LilyGo T-Echo MRF52840 Board 868MHz
- LilyGo T-Display-S3 H577
- HomeSeer Z-Net Pro
- Rail Kit CPZ Rail 03
- Blink Mini Camera (BCM00100U)
- Rabbit r1
- A131 Home Phone
- VTech Home Phone
- Home Assistant Voice Satellite (NabuCasa NCVK9727)
- HOOBS Smart Home Hub (H5LFI)
- HomeSeer Smart Stick G8 800 Series Z-Wave USB
- LilyGo T-Beam 915MHz
- HomeSeer SmartStick ZB 2 A4HLG291
- HID OMNIKEY 5022CL Smart Card Reader
- HomeSeer Z-Net Z-Wave Interface G8
- Kinect for Windows Hub 1637
- CyberPower Remote Management Card 205 (RMCARD205)
- Western Digital WD Elements 1TB Portable HDD (WDBUZG0010BBK-04)

## Provenance

- Source: Addison's draft audit (forwarded by Aaron 2026-05-27)
- Operator caveat: bitcoin miner counts under-represented; replace at next audit
- Format: human-readable markdown; reconciliation against 081KSGS9H0008QG0R0037H3W4T cluster-nodes/ TBD per 081KSGS9H0008QG0R001VVEZQ9 substrate
- Next: operator + Addison reconcile + promote to canonical `hardware.md` (drop `-draft.md` suffix) after miner count fix
