# zs (ZetaShell, FSI-like interpreter) + zc (ZetaCell, CLI/durable daemon); the IDL also in 4-tree/3-tree(+soft) form (Aaron, 2026-06-07)

Extends the Zeta IDL vision (#6955). Aaron:

> *"We should also define it in 4-color-theorem banana-split zips, and 3-color plus uncertainty for soft. For
> the zs ZetaShell (cell) — an interpreter like FSI — and zc ZetaCell for regular CLI and long-running durable
> mode in non-interactive mode."*

Two concrete pieces: the IDL's structural representation, and the cell's two runtime surfaces.

## 1. The IDL also in the banana-split representation (4-tree exact / 3-tree+soft generator)

The Zeta IDL (spec-in-DynamicValue, #6955) should be expressible in the **universal N-tree banana-split**
decomposition (#6922/#6931), not only as flat DynamicValue:

- **4-tree zip (CMYK, exact/lossless)** — the *file* form of the IDL: the spec decomposed into 4 zipped
  orthogonal trees (structure / labels / order / content), exact and material. The on-disk, byte-locked spec.
- **3-tree + uncertainty (RGB generator, soft)** — the *generator* form: 3 carried trees + the 4th recovered by
  Bayesian inference / `SoftValue` (the host-invariant K supplied by the host). The compressed, soft, "ship the
  generator" form of the spec — for constrained channels and for *soft* specs (interfaces with irreducible
  residual). 
- So the IDL gets both modes #6922 already names: **exact (4-tree/CMYK)** for the canonical stored spec and
  **soft generator (3-tree/RGB + SoftValue)** for transmission/regeneration. The IDL *is* a file → it decomposes
  the same way every file does. (Still the #6922 *conjecture* — routed to Soraya — applied to the IDL.)

## 2. The cell's two runtime surfaces: zs (interactive) and zc (durable CLI/daemon)

The triple-aspect **cell** (runs the control plane) gets two CLIs — the same cell, two modes:

| Tool | Name | Mode | Model |
|---|---|---|---|
| **`zs`** | **ZetaShell** (the cell) | **interactive interpreter / REPL** | like **FSI** (F# Interactive) — live, exploratory: type IDL/DynamicValue/yin-yang expressions, evaluate, inspect |
| **`zc`** | **ZetaCell** | **regular CLI + long-running durable, non-interactive** | a one-shot CLI *and* a persistent daemon/service mode (the observe-loop, durable agent, runs unattended) |

- **`zs` = the cell as a live interpreter.** FSI is the reference: a REPL where you evaluate against the live
  substrate (the IDL, DynamicValue, the YinYang engine). Interactive, ephemeral session — explore, prototype,
  inspect the spec/capabilities/resources.
- **`zc` = the cell as CLI + durable runtime.** Non-interactive: scriptable one-shot commands *and* a
  long-running durable mode (the cell as a persistent agent/service — the observe loop, the durable-rotational
  heartbeat agent #6935, running on the k8s-on-real-hardware cluster #6949). This is the *durable* side; `zs` is
  the *interactive/ephemeral* side — the same interactive/non-interactive ⊕ ephemeral/durable cut as #6935.
- Both are the **cell**; the split is interaction mode, not identity. (zs = read-eval-print the spec live; zc =
  run the spec durably.)

## Honest scope / peel

- **Design + naming, not built.** zs/zc are proposed CLI surfaces; the IDL-in-4-tree/3-tree rests on the #6922
  banana-split *conjecture* (unproven; routed to Soraya). 
- **Naming flag (light):** `zs` / `zc` are short two-letter commands — possible PATH collisions (e.g. other
  `zs`/`zc` tools) — route to `naming-expert` + check before claiming the binary names publicly (cf. the
  NVIDIA-ACE flag). Internal use fine; public binary names gated.
- No claim the 4-tree IDL or zs/zc exist yet; this scopes them. The interactive-vs-durable split is real
  (#6935) and gives zs/zc a principled basis.

## Ties

- **Zeta IDL / spec-as-asset (#6955, workitem 081KTJAEMZW)** — this is its representation (4-tree/3-tree) + its
  runtime surfaces (zs/zc).
- **Universal N-tree banana split / CMYK-RGB (#6922/#6931)** — the IDL's exact(4)/soft-generator(3+uncertainty)
  forms.
- **The cell** (triple-aspect, runs the control plane) — zs/zc are its interactive/durable CLIs.
- **Durable vs ephemeral / interactive vs non-interactive (#6935)** — zs (interactive/ephemeral) vs zc
  (durable/non-interactive) is that cut as tooling.
- **Observe loop / durable agent / k8s-on-hardware (#6949)** — zc's long-running daemon mode.
- **FSI** — the model for zs.

## Beacon anchors

- **FSI — F# Interactive** (the REPL model for `zs`) + REPL lineage (Lisp REPL, `ghci`, `python -i`,
  `dotnet fsi`). · **CLI + daemon dual-mode** (a binary that runs one-shot or as a long-running service —
  `redis-server`/`redis-cli`, `dockerd`/`docker`). · **CMYK(4) exact / RGB(3)+inference soft** banana-split
  (#6922; subtractive/additive color, the file/generator forms). · IDL lineage (#6955). Honest novelty: none —
  it scopes two cell runtime surfaces (**zs** interactive-interpreter like FSI, **zc** durable CLI/daemon —
  the interactive/durable cut #6935 as tooling) and applies the 4-tree-exact / 3-tree+soft-generator
  representation (#6922) to the Zeta IDL spec; design + naming, gated and conjecture-bounded.
