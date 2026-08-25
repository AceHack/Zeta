"""THE FALSIFIER for work-item 081M0QD23P3087G0R002NQ8217.

A dependency nothing verifies is the vacuity class: three pins in a pyproject
prove only that a resolver ran. What had to be shown is that the ACTIVATION
APERTURE actually opens — that this lane can read a residual stream and, more
importantly, WRITE one and have the model's output change because of it.

Every test here can fail. The pair that matters is
`test_causal_write_changes_the_output` with `test_identity_patch_is_a_no_op` as
its negative control: without the control, a "logits changed" assertion would
also pass under ordinary nondeterminism, which would make it a check that
cannot fail for the stated reason.

All of this runs OFFLINE on randomly-initialised weights. No HuggingFace
download, no credentials, no GPU.
"""

from __future__ import annotations

import tomllib
from pathlib import Path

import pytest
import torch

from zeta_interp import (
    hook_point_names,
    patch_residual_stream,
    read_residual_stream,
    toy_hooked_model,
)
from zeta_interp.activations import resid_key

N_LAYERS = 2
D_MODEL = 32
SEQ = 8
D_VOCAB = 50

#: A model this small still exposes embed/pos-embed + ~18 points per block. The
#: floor is a LIVENESS guard: if TransformerLens ever stops instrumenting the
#: internals, `run_with_cache` still returns *something* and every shape
#: assertion below would keep passing against a near-empty cache.
MIN_HOOK_POINTS = 30


@pytest.fixture(scope="module")
def model():
    return toy_hooked_model(n_layers=N_LAYERS, d_model=D_MODEL, d_vocab=D_VOCAB)


@pytest.fixture(scope="module")
def tokens() -> torch.Tensor:
    torch.manual_seed(4)
    return torch.randint(0, D_VOCAB, (1, SEQ))


def test_reads_a_hidden_state_with_the_declared_shape(model, tokens) -> None:
    """The minimum claim: a residual-stream tensor, right shape, right dtype."""
    resid = read_residual_stream(model, tokens, layer=N_LAYERS - 1)
    assert resid.shape == (1, SEQ, D_MODEL)
    assert resid.dtype == torch.float32
    # An all-zero tensor is what a silently-broken hook returns.
    assert torch.any(resid != 0)


def test_every_layer_is_addressable(model, tokens) -> None:
    for layer in range(N_LAYERS):
        assert read_residual_stream(model, tokens, layer=layer).shape == (
            1,
            SEQ,
            D_MODEL,
        )


def test_the_model_exposes_a_full_hook_surface(model, tokens) -> None:
    names = hook_point_names(model, tokens)
    assert len(names) >= MIN_HOOK_POINTS, f"only {len(names)} hook points: {names}"
    for layer in range(N_LAYERS):
        assert resid_key(layer) in names
    # Attention patterns are what a completion API most conspicuously cannot show.
    assert any(n.endswith("hook_pattern") for n in names)


def test_a_bad_layer_index_is_loud(model, tokens) -> None:
    """Absence must raise, never return an empty tensor."""
    with pytest.raises(KeyError):
        read_residual_stream(model, tokens, layer=99)


def test_causal_write_changes_the_output(model, tokens) -> None:
    """THE POINT OF THE WHOLE LANE: intervention, not just observation."""
    baseline = model(tokens)
    resid = read_residual_stream(model, tokens, layer=0)
    patched = patch_residual_stream(model, tokens, layer=0, replacement=resid * -1.0)
    assert not torch.allclose(baseline, patched), (
        "patching the residual stream did not move the logits — the write is a no-op"
    )


def test_identity_patch_is_a_no_op(model, tokens) -> None:
    """NEGATIVE CONTROL for the test above.

    Re-injecting the activation the model just produced must reproduce the
    baseline exactly. If this fails, the run is nondeterministic and the
    'changed' assertion above proves nothing about causality.
    """
    baseline = model(tokens)
    resid = read_residual_stream(model, tokens, layer=0)
    patched = patch_residual_stream(model, tokens, layer=0, replacement=resid)
    assert torch.allclose(baseline, patched, atol=1e-6)


def test_nnsight_can_trace_a_module() -> None:
    """nnsight is the second aperture — it wraps arbitrary torch modules."""
    import nnsight

    torch.manual_seed(4)
    inner = torch.nn.Linear(D_MODEL, D_MODEL)
    net = nnsight.NNsight(torch.nn.Sequential(inner, torch.nn.ReLU()))
    x = torch.randn(1, D_MODEL)
    with net.trace(x):
        hidden = net[0].output.save()
    assert hidden.shape == (1, D_MODEL)
    assert torch.allclose(hidden, inner(x), atol=1e-6)


def test_lock_has_no_cuda_bulk() -> None:
    """The COST guard, checked rather than trusted.

    The `[tool.uv.sources]` CPU-index pin is the only thing keeping the linux
    resolution off the default PyPI wheel and its multi-GB `nvidia-*` closure.
    Delete that block and this test fails — which is what makes the pin a
    decision the repo enforces rather than a comment someone wrote once.
    """
    lock = (Path(__file__).resolve().parents[1] / "uv.lock").read_text(encoding="utf-8")
    names = [
        line.split('"')[1] for line in lock.splitlines() if line.startswith("name = ")
    ]
    bulk = [
        n for n in names if n.startswith("nvidia-") or n in {"triton", "pytorch-triton"}
    ]
    assert bulk == [], f"CUDA bulk re-entered the lock: {bulk}"


def test_linux_resolves_the_cpu_wheel() -> None:
    """The other half: linux must actually be pinned to the +cpu build."""
    project = Path(__file__).resolve().parents[1]
    pyproject = tomllib.loads((project / "pyproject.toml").read_text(encoding="utf-8"))
    sources = pyproject["tool"]["uv"]["sources"]["torch"]
    assert any(s.get("index") == "pytorch-cpu" for s in sources)
    lock = (project / "uv.lock").read_text(encoding="utf-8")
    assert "2.13.0+cpu" in lock, "linux torch is not pinned to the CPU build"
