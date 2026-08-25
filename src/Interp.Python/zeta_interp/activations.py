"""Residual-stream reads and causal writes — the aperture Ollama does not have.

Ollama's `/api/generate` returns text and `/api/embeddings` returns a POOLED
representation. Neither is an intermediate activation, so neither can answer a
causal question ("does the model's computation *respect* this structure?").
Everything here operates on the residual stream at a named layer, which is what
H1 in docs/research/2026-08-23-measuring-latent-geometry-*.md is stated over.

Nothing in this module is `metered` in the sense of
`.claude/rules/toy-is-free-metered-must-be-earned.md`. It is plumbing: it moves
tensors, it makes no claim about geometry. `toy_hooked_model` is named `toy`
because it is randomly initialised and models nothing at all.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import torch
from transformer_lens import HookedTransformer, HookedTransformerConfig

#: The read point H1 is stated over: the residual stream AFTER a block's write.
HOOK_RESID_POST = "resid_post"


def resid_key(layer: int, point: str = HOOK_RESID_POST) -> str:
    """TransformerLens cache key for a residual-stream point at `layer`."""
    return f"blocks.{layer}.hook_{point}"


def toy_hooked_model(
    *,
    n_layers: int = 2,
    d_model: int = 32,
    n_heads: int = 4,
    d_vocab: int = 50,
    n_ctx: int = 16,
    seed: int = 4,
) -> HookedTransformer:
    """A tiny RANDOMLY-INITIALISED hooked transformer.

    Deliberately not a pretrained model: this exists so the activation-access
    machinery can be exercised with NO network call and no HuggingFace
    credentials, which is what lets the falsifier run on every CI runner.

    `seed=4` is the repo's common seed (S=4).
    """
    torch.manual_seed(seed)
    cfg = HookedTransformerConfig(
        n_layers=n_layers,
        d_model=d_model,
        n_ctx=n_ctx,
        n_heads=n_heads,
        d_head=d_model // n_heads,
        d_mlp=d_model * 2,
        act_fn="gelu",
        d_vocab=d_vocab,
    )
    return HookedTransformer(cfg)


def hook_point_names(model: HookedTransformer, tokens: torch.Tensor) -> list[str]:
    """Every activation name the model exposes for `tokens`."""
    _, cache = model.run_with_cache(tokens)
    return list(cache.keys())


def read_residual_stream(
    model: HookedTransformer,
    tokens: torch.Tensor,
    layer: int,
    point: str = HOOK_RESID_POST,
) -> torch.Tensor:
    """Read the residual stream at `layer` — shape (batch, pos, d_model)."""
    key = resid_key(layer, point)
    _, cache = model.run_with_cache(tokens)
    if key not in cache:
        # A missing key must be LOUD. Returning zeros or None here would make a
        # broken layer index look like a model with no signal at that layer —
        # the vacuity shape this repo refuses.
        raise KeyError(
            f"no activation {key!r}; available: {sorted(cache.keys())[:8]}..."
        )
    return cache[key]


def patch_residual_stream(
    model: HookedTransformer,
    tokens: torch.Tensor,
    layer: int,
    replacement: torch.Tensor,
    point: str = HOOK_RESID_POST,
) -> torch.Tensor:
    """CAUSAL WRITE: overwrite the residual stream at `layer`, return new logits.

    This is the half a completion API can never provide. Reading activations
    supports only correlational claims; H1's "respect" clause is an
    interventional claim and needs this.
    """
    key = resid_key(layer, point)

    def hook(_activation: torch.Tensor, hook: object) -> torch.Tensor:
        return replacement

    # Spelled out to match TransformerLens' invariant `list` parameter exactly;
    # a narrower element type does not type-check against it.
    fwd_hooks: list[tuple[str | Callable[..., Any], Callable[..., Any]]] = [(key, hook)]
    return model.run_with_hooks(tokens, fwd_hooks=fwd_hooks)
