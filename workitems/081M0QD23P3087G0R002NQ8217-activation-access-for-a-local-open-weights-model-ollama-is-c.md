---
id: 081M0QD23P3087G0R002NQ8217
type: task
state: in-progress
priority: P2
slug: activation-access-for-a-local-open-weights-model-ollama-is-c
title: "Activation access for a local open-weights model - Ollama is completion-only, PyTorch/nnsight/TransformerLens is the real requirement (blocks activation patching and rotor tests)"
created: 2026-08-23T13:30:47.875Z
depends_on: []
composes_with: []
---

# Activation access for a local open-weights model - Ollama is completion-only, PyTorch/nnsight/TransformerLens is the real requirement (blocks activation patching and rotor tests)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QD23P3087G0R002NQ8217-*.md` glob. -->

## 2026-08-25 — the toolchain is declared; the aperture is open on a TOY model

**Done (`081M0WVEGRT087G0R002PCMCV3`).** The infrastructure dependency this item
scoped is no longer missing.

- `src/Interp.Python` — its own locked `uv` project (the `src/Arc.Python`
  precedent), pinning `torch==2.13.0`, `transformer-lens==3.8.0`,
  `nnsight==0.7.0`. `uv.lock` is committed with a sha256 per wheel.
- Declared **through `ace`**: `tools/setup/manifests/from-uv-project` ->
  `src/Core.TypeScript/ace/setup-realizers/from-uv-project.ts`, a new realizer
  class (the 18th) for *locked* uv projects via `uv sync --frozen`. Opt-in on
  `ZETA_INSTALL_INTERP=1`, `tier=standard`.
- Falsifier: `src/Interp.Python/tests/test_activation_access.py`, 9 tests,
  offline. Residual streams read at every layer, a **causal write** that moves
  the logits, and a negative control proving the movement is caused by the
  patch. Verified to fail: making the write a no-op turns exactly the causal
  test red.
- Lane CI: `.github/workflows/interp-lane.yml` — path-filtered, no `needs:`,
  not a gate.

**NOT done — this item stays open, deliberately.** The title says "for a local
**open-weights** model", and what is proven is activation access on a
randomly-initialised toy transformer. That is genuinely less than the item asks.
Specifically still open:

1. Loading real open-weights (e.g. `qwen2.5`, already pinned locally for the
   heartbeat lane) through `HookedTransformer.from_pretrained` or `nnsight`.
   This needs a HuggingFace download; the falsifier deliberately avoids one so
   it can run on every runner without credentials, so the real-model path is
   currently **unmetered**.
2. Deciding where real-model weights live and are cached (a GB-scale artifact
   the repo has no home for yet).
3. GPU/MPS execution. Every CI runner is CPU-only; macOS arm64 gets MPS from
   the PyPI wheel but nothing exercises it.

So T2-C and T3 are **unblocked at the toolchain layer** and still blocked on (1).
Closing this item on the toolchain alone would be rounding up.
