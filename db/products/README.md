# products/ — products (named offerings), at root; symlink-views of canonical interfaces/shapes

`products/` holds **products** — named, shippable offerings. A product is usually a **symlink-view** of a
canonical node elsewhere (the canonical/symlink **DAG**: one canonical home, many views; multi-parent), so a
product *is* the thing it points at, just surfaced under a product name.

- **`products/glomotion` → `universal/gamepad`** (symlink). The **glomotion** product IS the
  `universal/gamepad` (glowing motion gamepad) interface, surfaced as a product. Canonical home =
  `universal/gamepad`; `products/glomotion` is the product view (reachable from both — multi-parent DAG).

Symlinks (git mode 120000) are the DAG edges; the canonical target is the single source of truth, so a
product never forks its definition — it points.

## Pointers

- `universal/gamepad.md` — the canonical interface `products/glomotion` points to.
- `universal/README.md` — the universal-interface/shape family.
- `same/README.md` — the canonical/symlink-DAG + `_-x-y-_` sameness convention.
