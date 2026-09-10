"""Tiny optimizer witnesses and receipt refusals; never the registered full fit."""

import copy
import math
from decimal import Decimal, localcontext

import numpy as np
import pytest
import torch

from zeta_interp import rendered_signal_training as training
from zeta_interp.mess3_replay import Network, digest, initial_parameters


def test_zero_network_has_analytic_loss_and_gradient():
    parameters = torch.zeros(8, dtype=torch.float64, requires_grad=True)
    tokens = torch.tensor([[0, 1, 1]], dtype=torch.int64)
    loss = training._objective(parameters, tokens, 1)
    (gradient,) = torch.autograd.grad(loss, parameters)
    assert loss.item() == pytest.approx(math.log(2), abs=1e-15)
    torch.testing.assert_close(
        gradient,
        torch.tensor([0.0] * 6 + [0.5, -0.5], dtype=torch.float64),
        atol=1e-15,
        rtol=0,
    )


def test_recurrent_autograd_matches_independent_finite_differences():
    values = np.linspace(-0.4, 0.7, 16)
    rows = np.array([[0, 0, 1, 0], [1, 0, 1, 1]], dtype=np.int64)
    parameters = torch.tensor(values, dtype=torch.float64, requires_grad=True)
    loss = training._objective(parameters, torch.tensor(rows), 2)
    (gradient,) = torch.autograd.grad(loss, parameters)

    def numpy_loss(weights):
        network = Network(2, weights, 2)
        state = np.zeros((len(rows), 2))
        losses = []
        for index in range(rows.shape[1] - 1):
            state, probabilities = network.step(state, rows[:, index])
            losses.extend(
                -np.log(probabilities[np.arange(len(rows)), rows[:, index + 1]])
            )
        return float(np.mean(losses))

    assert loss.item() == pytest.approx(numpy_loss(values), abs=1e-14)
    estimates = []
    for index in range(len(values)):
        above, below = values.copy(), values.copy()
        above[index] += 1e-6
        below[index] -= 1e-6
        estimates.append((numpy_loss(above) - numpy_loss(below)) / 2e-6)
    np.testing.assert_allclose(gradient.numpy(), estimates, atol=2e-9, rtol=0)
    separate = [
        training._objective(parameters, torch.tensor(row[None]), 2).item()
        for row in rows
    ]
    assert loss.item() == pytest.approx(sum(separate) / len(separate), abs=1e-14)


def test_explicit_adam_matches_decimal_with_clipping_and_bias_correction():
    parameters = torch.tensor([0.3, -0.2, 0.4], dtype=torch.float64)
    first, second = torch.zeros_like(parameters), torch.zeros_like(parameters)
    gradients = ([3.0, 4.0, 1e-9], [-0.2, 0.1, 0.0], [1.0, -2.0, 0.03])
    beta1_power, beta2_power = 1.0, 1.0
    with localcontext() as context:
        context.prec = 70
        expected = [Decimal("0.3"), Decimal("-0.2"), Decimal("0.4")]
        m, v = [Decimal(0)] * 3, [Decimal(0)] * 3
        for step, gradient in enumerate(gradients, start=1):
            exact_gradient = [Decimal(str(value)) for value in gradient]
            norm = sum(value * value for value in exact_gradient).sqrt()
            exact_gradient = [value / max(Decimal(1), norm) for value in exact_gradient]
            for index, value in enumerate(exact_gradient):
                m[index] = Decimal("0.9") * m[index] + Decimal("0.1") * value
                v[index] = (
                    Decimal("0.999") * v[index] + Decimal("0.001") * value * value
                )
                expected[index] -= (
                    Decimal("0.003")
                    * m[index]
                    / (1 - Decimal("0.9") ** step)
                    / (
                        (v[index] / (1 - Decimal("0.999") ** step)).sqrt()
                        + Decimal("1e-8")
                    )
                )
            beta1_power *= 0.9
            beta2_power *= 0.999
            clipped = training._adam_step(
                parameters,
                torch.tensor(gradient, dtype=torch.float64),
                first,
                second,
                beta1_power,
                beta2_power,
            )
            assert clipped == (norm > 1)
            np.testing.assert_allclose(
                parameters.numpy(), list(map(float, expected)), atol=1e-15, rtol=0
            )


def test_tiny_four_pass_fit_revisits_rows_in_order():
    rows = np.array([[0, 1, 1], [1, 0, 1], [1, 1, 0], [0, 0, 0]], dtype=np.int64)
    initial = initial_parameters(2, 41, 2)
    actual, trace, _ = training._fit(rows, initial, 2, 8, 2, tuple(range(1, 9)))
    parameters = torch.tensor(initial, dtype=torch.float64, requires_grad=True)
    optimizer = torch.optim.Adam([parameters], lr=0.003, foreach=False, fused=False)
    losses = []
    for step in range(8):
        optimizer.zero_grad()
        start = 2 * (step % 2)
        loss = training._objective(parameters, torch.tensor(rows[start : start + 2]), 2)
        loss.backward()
        assert parameters.grad is not None
        norm = torch.linalg.vector_norm(parameters.grad).item()
        parameters.grad.mul_(1 / max(1, norm))
        optimizer.step()
        losses.append(loss.item())
    np.testing.assert_allclose(actual, parameters.detach().numpy(), atol=1e-14, rtol=0)
    assert [row["Step"] for row in trace] == list(range(1, 9))
    np.testing.assert_allclose(
        [row["LossNats"] for row in trace], losses, atol=1e-14, rtol=0
    )


@pytest.fixture
def receipt():
    initial = initial_parameters(8, 41, 2)
    return {
        "Seed": 41,
        "Hidden": 8,
        "Status": "complete",
        "Failure": "",
        "InitialParameters": initial,
        "Parameters": initial.copy(),
        "InitialSha256": digest(initial),
        "TrainedSha256": digest(initial),
        "TrainingTrace": [{"Step": step, "LossNats": 0.0} for step in (1, 512, 1024)],
        "TrainedTokens": 524288,
    }


@pytest.fixture
def corpus():
    return np.zeros((4096, 33), dtype=np.int64)


@pytest.mark.parametrize(
    "key,value",
    [
        ("Seed", 53),
        ("Hidden", 16),
        ("Alphabet", 3),
        ("Status", "failed"),
        ("Failure", "failed optimizer"),
        ("TrainedTokens", 524287),
        ("Config", {"Steps": 512}),
        ("InitialSha256", "changed"),
        ("TrainedSha256", "changed"),
        ("InitialParameters", [0.0]),
        ("Parameters", [float("nan")] * 106),
        ("TrainingTrace", []),
        (
            "TrainingTrace",
            [{"Step": step, "LossNats": float("nan")} for step in (1, 512, 1024)],
        ),
    ],
)
def test_refuses_changed_model_before_training(
    corpus, receipt, monkeypatch, key, value
):
    monkeypatch.setattr(
        training, "_fit", lambda *args: pytest.fail("must refuse before fitting")
    )
    receipt[key] = value
    with pytest.raises(ValueError):
        training.retrain(corpus, receipt)


def test_refuses_changed_initialization_even_with_matching_edited_hash(corpus, receipt):
    receipt["InitialParameters"][0] += 1e-9
    receipt["InitialSha256"] = digest(receipt["InitialParameters"])
    with pytest.raises(ValueError, match="initialization"):
        training.retrain(corpus, receipt)


@pytest.mark.parametrize(
    "invalid",
    [
        None,
        [[0, 1]],
        np.zeros((4095, 33)),
        np.zeros((4096, 32)),
        np.full((4096, 33), 2),
        np.zeros((4096, 33)),
    ],
)
def test_refuses_invalid_corpus_without_coercing_symbols(invalid, receipt):
    with pytest.raises(ValueError, match="corpus"):
        training.retrain(invalid, receipt)


def test_numerical_mismatch_is_retained_and_threads_are_restored(
    corpus, receipt, monkeypatch
):
    before = copy.deepcopy(receipt)
    thread_count = torch.get_num_threads()
    initial = np.asarray(receipt["InitialParameters"])
    final = initial.copy()
    final[0] += 2e-8

    def tiny_stub(rows, weights, hidden, steps, batch, trace_steps):
        assert torch.get_num_threads() == 1
        assert rows is corpus
        np.testing.assert_array_equal(weights, initial)
        assert (hidden, steps, batch, trace_steps) == (8, 1024, 16, (1, 512, 1024))
        return final, [{"Step": step, "LossNats": 3e-8} for step in trace_steps], 7

    monkeypatch.setattr(training, "_fit", tiny_stub)
    result = training.retrain(corpus, receipt)
    assert result["status"] == "mismatch"
    assert result["maximum_parameter_error"] == pytest.approx(2e-8)
    assert result["maximum_trace_error"] == 3e-8
    assert result["parameter_comparisons"] == 106
    assert result["trace_comparisons"] == 3
    assert result["target_visits"] == 524288
    assert result["clipped_updates"] == 7
    assert receipt == before
    assert torch.get_num_threads() == thread_count


def test_threads_are_restored_if_independent_fit_fails(corpus, receipt, monkeypatch):
    thread_count = torch.get_num_threads()

    def failure(*args):
        raise ValueError("tiny failure witness")

    monkeypatch.setattr(training, "_fit", failure)
    with pytest.raises(ValueError, match="tiny failure"):
        training.retrain(corpus, receipt)
    assert torch.get_num_threads() == thread_count
