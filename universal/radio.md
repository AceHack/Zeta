# universal/radio — Universal Radio Interface

> **Universal Radio Interface** — a universal SHAPE applicable to all `/travelers` and all `/persona`.
> Radio transport — Reticulum RF/LoRa (the over-the-air carrier).

A candidate **bit + compiler oracle** surface (bit-perfect + compiler-invariant = collaboration-grade).
See [`universal/README.md`](README.md) for the full family + honest scope.

## Noninterference contract (manifesto §13)

- **Declared channel:** the Reticulum RF/LoRa carrier — the air gap is the membrane made physical.
- **Metered at the membrane:** every over-the-air frame metered on RX; RF noise enters as *declared*
  channel noise (part of the link budget), never as ambient state.
- **Forbidden ambient leak:** any second radio path not in the link registry (the spectrum is wide; the
  declared carrier is narrow — everything else is quarantined out).
