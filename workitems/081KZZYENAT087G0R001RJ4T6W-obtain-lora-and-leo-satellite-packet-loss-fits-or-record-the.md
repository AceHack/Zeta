---
id: 081KZZYENAT087G0R001RJ4T6W
type: task
state: backlog
priority: P2
slug: obtain-lora-and-leo-satellite-packet-loss-fits-or-record-the
title: "Obtain LoRa and LEO-satellite packet-loss fits, or record them as unavailable"
created: 2026-08-14T10:52:58.586Z
depends_on: []
composes_with: []
---

# Obtain LoRa and LEO-satellite packet-loss fits, or record them as unavailable

Split out of `081KZYP23HG087G0R000117H0K` on close, 2026-08-14. That item landed a **cited**
802.11 calibration (`CALIBRATION.wifi2022`). It did **not** land LoRa or LEO fits, and this
records that as an open gap rather than letting the Wi-Fi point quietly stand in for regimes it
does not describe.

## Status: UNRESOLVED, deliberately

Searches surfaced the right literature and **no fitted numeric two-state parameters**:

- Ferre, *Collision and Packet Loss Analysis in a LoRaWAN Network*, EUSIPCO 2017
- the LoRa multi-floor measurement study, arXiv:1909.03900 — reports PDR/RSSI, not a GE fit
- T. Wang et al., *Packet Loss Modeling and Forward Erasure Correction for LEO Satellite
  Networks*, IEEE Trans. Comm. 2026 — states outright that "existing packet loss models fail to
  capture the unique dynamics of LEO networks"; **paywalled**
- the CCSDS erasure-coding line

**Do not fill these from memory or extrapolate them from the 802.11 fit.** The correct output of
this item may well be "no public two-state fit exists for these regimes", and that is a result.

## Why it matters here

`udp-lossy-transport.ts` names LoRa/BLE as the XOR-7/8 code's intended home, and every goodput
number backing that guidance is measured on a synthetic channel or on an indoor Wi-Fi fit. Until
this lands, LoRa and LEO claims carry "…under this synthetic channel".

## Pointers

- `src/Core.TypeScript/discovery/udp-lossy-transport.chaos.ts` — `CALIBRATION`, where a fit lands
- `docs/research/2026-08-14-the-chaos-harness-loss-model-was-anti-correlated-not-uniform-*.md` §3
