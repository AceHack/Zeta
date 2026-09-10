"""Independent autograd replay of the frozen rendered-signal seed-41 fit.

The only data input is the already decoded corpus. This module does not sample
the source law, access emulator state, or select hyperparameters. The caller
validates the containing experiment configuration and preserves this source
before calling ``retrain``. Numerical disagreement is returned as a receipt.
"""

from __future__ import annotations

import math

import numpy as np
import torch

from zeta_interp.mess3_replay import digest, initial_parameters

CONFIG = {"Steps": 1024, "Batch": 16, "SequenceSteps": 32, "LearningRate": 0.003}
TRACE_STEPS = (1, 512, 1024)
TOLERANCE = 1e-8


def _objective(parameters, tokens, hidden):
    """Mean conditional loss, with a fresh state for each batch row."""
    recurrent_end = hidden * hidden
    input_end = recurrent_end + 2 * hidden
    bias_end = input_end + hidden
    output_end = bias_end + 2 * hidden
    recurrent = parameters[:recurrent_end].reshape(hidden, hidden)
    inputs = parameters[recurrent_end:input_end].reshape(hidden, 2)
    hidden_bias = parameters[input_end:bias_end]
    output = parameters[bias_end:output_end].reshape(2, hidden)
    output_bias = parameters[output_end:]
    state = torch.zeros((len(tokens), hidden), dtype=torch.float64, device="cpu")
    logits = []
    for column in tokens[:, :-1].T:
        state = torch.tanh(state @ recurrent.T + inputs[:, column].T + hidden_bias)
        logits.append(state @ output.T + output_bias)
    return torch.nn.functional.cross_entropy(
        torch.stack(logits, dim=1).reshape(-1, 2), tokens[:, 1:].reshape(-1)
    )


def _adam_step(parameters, gradient, first, second, beta1_power, beta2_power):
    """Explicit bias-corrected Adam; no optimizer-library or fused update."""
    norm_squared = 0.0
    for value in gradient.detach().tolist():
        norm_squared += value * value
    if not math.isfinite(norm_squared):
        raise ValueError("nonfinite autograd gradient norm")
    norm = math.sqrt(norm_squared)
    clipped = gradient.detach() * (1.0 / max(1.0, norm))
    with torch.no_grad():
        first.copy_(0.9 * first + 0.1 * clipped)
        second.copy_(0.999 * second + (0.001 * clipped) * clipped)
        parameters.sub_(
            CONFIG["LearningRate"]
            * (first / (1.0 - beta1_power))
            / (torch.sqrt(second / (1.0 - beta2_power)) + 1e-8)
        )
    if not torch.isfinite(parameters).all().item():
        raise ValueError("nonfinite independent optimizer parameters")
    return norm > 1.0


def _fit(corpus, initial, hidden, steps, batch_size, trace_steps):
    """Private bounded kernel; small dimensions support hand-fixture tests."""
    if (
        not 1 <= steps <= 1024
        or not 1 <= batch_size <= 16
        or not 1 <= hidden <= 8
        or len(corpus) < batch_size
        or len(corpus) % batch_size
    ):
        raise ValueError("invalid bounded optimizer fixture")
    parameters = torch.tensor(
        initial, dtype=torch.float64, device="cpu", requires_grad=True
    )
    tokens = torch.tensor(corpus, dtype=torch.int64, device="cpu")
    first, second = torch.zeros_like(parameters), torch.zeros_like(parameters)
    beta1_power, beta2_power = 1.0, 1.0
    trace, clipped_updates = [], 0
    for index in range(steps):
        start = (index * batch_size) % len(corpus)
        loss = _objective(parameters, tokens[start : start + batch_size], hidden)
        loss_value = loss.item()
        if not math.isfinite(loss_value):
            raise ValueError("nonfinite independent training loss")
        (gradient,) = torch.autograd.grad(loss, parameters)
        beta1_power *= 0.9
        beta2_power *= 0.999
        clipped_updates += int(
            _adam_step(parameters, gradient, first, second, beta1_power, beta2_power)
        )
        if index + 1 in trace_steps:
            trace.append({"Step": index + 1, "LossNats": loss_value})
    return parameters.detach().numpy().copy(), trace, clipped_updates


def _validate(corpus, receipt):
    if (
        not isinstance(corpus, np.ndarray)
        or corpus.shape != (4096, 33)
        or corpus.dtype.kind not in "iu"
        or not np.isin(corpus, (0, 1)).all()
    ):
        raise ValueError("training corpus must be 4096 by 33 decoded binary integers")
    required = {
        "Seed",
        "Hidden",
        "Status",
        "Failure",
        "InitialParameters",
        "Parameters",
        "InitialSha256",
        "TrainedSha256",
        "TrainingTrace",
        "TrainedTokens",
    }
    if not isinstance(receipt, dict) or not required <= receipt.keys():
        raise ValueError("missing native model receipt fields")
    if (
        receipt["Seed"] != 41
        or receipt["Hidden"] != 8
        or receipt["Status"] != "complete"
        or receipt["Failure"] != ""
        or receipt["TrainedTokens"] != 524288
        or receipt.get("Alphabet", 2) != 2
        or receipt.get("Config", CONFIG) != CONFIG
    ):
        raise ValueError("changed seed-41 model or frozen training configuration")
    values = []
    for key, hash_key in (
        ("InitialParameters", "InitialSha256"),
        ("Parameters", "TrainedSha256"),
    ):
        try:
            vector = np.asarray(receipt[key], dtype=np.float64)
        except (TypeError, ValueError, OverflowError) as error:
            raise ValueError("invalid model parameter vector") from error
        if vector.shape != (106,) or not np.isfinite(vector).all():
            raise ValueError("model requires 106 finite binary64 parameters")
        if digest(vector) != receipt[hash_key]:
            raise ValueError("model parameter fingerprint mismatch")
        values.append(vector)
    trace = receipt["TrainingTrace"]
    if (
        not isinstance(trace, list)
        or len(trace) != 3
        or any(not isinstance(row, dict) for row in trace)
        or any(type(row.get("Step")) is not int for row in trace)
        or [row.get("Step") for row in trace] != list(TRACE_STEPS)
    ):
        raise ValueError("training trace must contain steps 1, 512 and 1024")
    for row in trace:
        loss = row.get("LossNats")
        if (
            isinstance(loss, bool)
            or not isinstance(loss, (int, float))
            or not math.isfinite(loss)
            or loss < 0
        ):
            raise ValueError("invalid training trace loss")
    initial = np.asarray(initial_parameters(8, 41, 2), dtype=np.float64)
    initial_error = float(np.max(np.abs(initial - values[0])))
    if initial_error > TOLERANCE or digest(initial) != receipt["InitialSha256"]:
        raise ValueError("receipt initialization differs from registered seed 41")
    return initial, values[1], trace, initial_error


def retrain(decoded_training_corpus, model_receipt):
    """Replay all four passes, returning errors and retained independent values.

    Accept the native ``ModelReceipt`` directly. Its containing experiment's
    ``Config.Training`` is fixed here, and must also be checked by the caller.
    Invalid metadata/fingerprints are refusals; final numerical differences
    produce ``status='mismatch'`` so the result remains inspectable. The
    function has no shorter-run, seed-selection, tolerance or tuning options.
    """
    initial, final_expected, trace_expected, initial_error = _validate(
        decoded_training_corpus, model_receipt
    )
    previous_threads = torch.get_num_threads()
    try:
        torch.set_num_threads(1)
        parameters, trace, clipped_updates = _fit(
            decoded_training_corpus,
            initial,
            8,
            CONFIG["Steps"],
            CONFIG["Batch"],
            TRACE_STEPS,
        )
    finally:
        torch.set_num_threads(previous_threads)
    parameter_error = float(np.max(np.abs(parameters - final_expected)))
    trace_errors = [
        abs(actual["LossNats"] - expected["LossNats"])
        for actual, expected in zip(trace, trace_expected, strict=True)
    ]
    trace_error = max(trace_errors)
    return {
        "status": "passed"
        if max(parameter_error, trace_error) <= TOLERANCE
        else "mismatch",
        "seed": 41,
        "hidden": 8,
        "dtype": "torch.float64",
        "device": "cpu",
        "torch_version": str(torch.__version__),
        "training_sequences": 4096,
        "sequence_length": 33,
        "passes": 4,
        "optimizer_updates": 1024,
        "target_visits": 524288,
        "parameter_comparisons": 106,
        "trace_comparisons": 3,
        "maximum_initial_parameter_error": initial_error,
        "maximum_parameter_error": parameter_error,
        "maximum_trace_error": trace_error,
        "tolerance": TOLERANCE,
        "clipped_updates": clipped_updates,
        "parameters": parameters.tolist(),
        "training_trace": trace,
        "trace_absolute_errors": trace_errors,
    }
