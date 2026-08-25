# `src/Interp.Python` — the model-interpretability lane

**What it is for:** reading and *writing* intermediate activations of a trained
model. Ollama's `/api/generate` returns text and `/api/embeddings` returns a
pooled vector; neither is a residual-stream activation, so neither can answer a
causal question. This lane is the aperture.

It closes the infrastructure dependency scoped in work-item
`081M0QD23P3087G0R002NQ8217` and named in
`docs/research/2026-08-23-measuring-latent-geometry-survey-falsifiable-clifford-experiment-and-the-gwt-verdict.md`
§2.2.

## Not a gate, and never a dependency of `zeta-core`

Its own `uv` project, on the `src/Arc.Python` precedent and for the same reason:
a resolution failure here must not be able to break
`uv sync --project src/Core.Python`. `interp-lane.yml` appears in no `needs:`
list; `gate (required)` neither waits for it nor sees it.

## Install

Opt-in, declared through `ace`:

```bash
ZETA_INSTALL_INTERP=1 bun src/Core.TypeScript/ace/setup-realize.ts from-uv-project
```

Or directly, with no `ace` on `PATH` — the tree stays self-sufficient:

```bash
uv sync --project src/Interp.Python --frozen
```

Without `ZETA_INSTALL_INTERP=1` the realizer skips loudly and costs one manifest
read. It is deliberately **not** wired to `ZETA_INSTALL_FULL`, which three
installer-test workflows already set.

## Platforms — one pin does not cover all of them

Sizes are the wheel `Content-Length`, measured 2026-08-25.

| Host | torch build | Wheel | Accelerator |
|---|---|---|---|
| macOS arm64 (`macos-26`, maintainer laptop) | `2.13.0` (PyPI) | 111.2 MB | CPU + **MPS** |
| `ubuntu-24.04` (x86_64) | `2.13.0+cpu` | 191.8 MB | CPU only |
| `ubuntu-24.04-arm` (aarch64) | `2.13.0+cpu` | 155.0 MB | CPU only |

The linux rows come from the PyTorch CPU index via `[tool.uv.sources]`. Without
that pin, linux x86_64 resolves the 526.6 MB default wheel **and** the whole
`nvidia-*` CUDA closure. macOS deliberately stays on PyPI because that wheel is
the one carrying the Metal/MPS backend.

**No runner in this repo's matrix has a GPU**, so CUDA would be dead weight.
`tests/test_activation_access.py::test_lock_has_no_cuda_bulk` fails if it
returns.

Windows is untested here. The lock contains win_amd64 wheels, but no workflow
exercises them, so treat it as unmetered rather than supported.

## The falsifier

```bash
uv run --project src/Interp.Python pytest src/Interp.Python/tests -q
```

Nine tests, all offline on randomly-initialised weights — no HuggingFace
download, no credentials. The load-bearing pair:

- `test_causal_write_changes_the_output` — patching the residual stream must
  move the logits. Verified to fail: making the write a no-op turns exactly this
  test red.
- `test_identity_patch_is_a_no_op` — its **negative control**. Re-injecting the
  activation the model just produced must reproduce the baseline. Without it,
  "the logits changed" would also pass under ordinary nondeterminism.

## What this does NOT claim

Plumbing only. Nothing here measures geometry, and `toy_hooked_model` is
randomly initialised — it models nothing. H1 stays `toy` until something
measures it on a real model. See
`.claude/rules/toy-is-free-metered-must-be-earned.md`.
