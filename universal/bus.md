# universal/bus — Universal Bus Interface (the INTERFACE; /bus is the DATA)

> **Universal Bus Interface** — a universal SHAPE applicable to all `/travelers` and all `/persona`.
> The **interface to the bus**: ZetaId-keyed message routing over Reticulum (the cell bus; git-native bus,
> Category.Bus). This is the **interface** (the shape — how you publish/subscribe/route); the **actual data**
> lives at root **`/bus`**. Interface ⇄ data split: `universal/bus` = the interface, `/bus` = the data.

A candidate **bit + compiler oracle** surface (bit-perfect + compiler-invariant = collaboration-grade).
See [`universal/README.md`](README.md) and [`/bus`](../bus/README.md).

## Noninterference contract (manifesto §13)

- **Declared channel:** ZetaId-keyed publish/subscribe over Reticulum — the bus IS the door; no side rails.
- **Metered at the membrane:** every message booked to the room's ledger on cross (ΔU with the payload —
  uncertainty travels in the message, never ambiently).
- **Forbidden ambient leak:** out-of-bus signaling between travelers/personas (shared files as covert
  channels, ambient clocks, unthrottled spawn). If it didn't cross the bus, it didn't happen.
