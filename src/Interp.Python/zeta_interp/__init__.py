"""Zeta's model-interpretability lane: activation access for trained models."""

from zeta_interp.activations import (
    HOOK_RESID_POST,
    hook_point_names,
    patch_residual_stream,
    read_residual_stream,
    toy_hooked_model,
)

__all__ = [
    "HOOK_RESID_POST",
    "hook_point_names",
    "patch_residual_stream",
    "read_residual_stream",
    "toy_hooked_model",
]
