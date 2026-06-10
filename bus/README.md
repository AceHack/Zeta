# bus/ — the bus DATA, at root (interface lives at universal/bus)

`bus/` holds the **actual bus data** — the ZetaId-keyed messages routed over the cell bus (Reticulum;
git-native bus, `Category.Bus` = cross-machine agent comms, #6219). A root-level folder.

**Data ⇄ interface split (Aaron, 2026-06-10):** `/bus` is the **actual data**; **`universal/bus`** is the
**interface** (the shape — how you publish/subscribe/route). The same split applies generally:
`universal/<x>` = the interface, `/<x>` = the data it carries.

- **`/bus`** — the messages (the bus traffic; ZetaId-keyed, commutative uncertainty-ledger entries, the
  Z-set/Rx stream). The data.
- **`universal/bus`** — the Universal Bus Interface (the shape; bit+compiler oracle surface).

## Pointers

- `universal/bus.md` — the interface.
- `network/` (Reticulum transport) · `dns/` (ZetaId → destination) · the git-native bus spec (#6219).
