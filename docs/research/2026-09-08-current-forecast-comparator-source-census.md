# Current forecasting comparators: source and feasibility census

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade source census
Lifecycle: active
Status: candidate metadata inspected; no weights, dataset or comparator execution
Work item: 081M1Z63YMC087G0R003N5FH9X

## Purpose and current candidates

The user's comparison request requires an external published method as well as
Zeta's internal individual/flat/shallow/deep controls. This census supports the
[next learned comparison](2026-09-08-mixed-message-epoch-implementation-register.md);
it does not expand or replace the bounded adapter's eight controls.
Selection and execution remain a later preregistered step. No model is declared
the universal state of the art from an author's benchmark claim.

[Chronos-2's technical report](https://arxiv.org/abs/2510.15821) describes an
inference-only model with group attention and multivariate/covariate support.
Its [official card](https://huggingface.co/amazon/chronos-2) specifies 120M
parameters, quantile forecasts, CPU/GPU inference and Apache-2.0 licensing.
The authors report strong aggregate benchmark performance. That claim has not
been reproduced here. The card lists real and synthetic pretraining data;
absence of a local test read does not establish absence from pretraining.
The [synthetic-only variant](https://huggingface.co/autogluon/chronos-2-synth)
is separately identified, also labeled Apache-2.0. Its card claims only synthetic
pretraining; this is an attributed claim, not an audited training history or
permission to assign the main model's scores to the variant.

Google's [August 31, 2026 release](https://research.google/blog/timesfm-3-a-zero-shot-foundation-model-for-multivariate-forecasting/)
describes TimesFM-3, a 330M-parameter multivariate forecaster, and reports leading
aggregate ranks against Chronos-2 and other models. It is a current candidate
that a September comparison should acknowledge. Its source repository uses
Apache-2.0, while the [weight card](https://huggingface.co/google/timesfm-3.0-pytorch)
identifies a separate non-commercial license. Source licensing and weight
licensing are distinct. No weights or license acceptance were requested by
this read-only census. The repository advertises an Apple Silicon MLX backend;
that backend's local execution and reported numerical correspondence remain
unverified here.

## Exact observed pins

| Artifact | Observed immutable revision | Advertised weight-file bytes |
| --- | --- | ---: |
| Amazon Chronos-2 model | `29ec3766d36d6f73f0696f85560a422f50e8498c` | 477930472 |
| AutoGluon Chronos-2-Synth model | `3607918a9fd027d5c465d8213e46b98e2c041cea` | 475963368 |
| Google TimesFM-3 model | `43046b85ec22d584a13f8098c2ed39c889e129c2` | 1322898824 |

Those byte lengths and LFS SHA256 values come from the retained public metadata,
not downloaded tensor observations. They do not bound runtime memory. The
[Chronos source pin](https://github.com/amazon-science/chronos-forecasting/tree/8589d1988e9676817548e9626738ff06b6ca6370)
is `8589d1988e9676817548e9626738ff06b6ca6370`; the
[TimesFM source pin](https://github.com/google-research/timesfm/tree/8cb7eda91c2b416b37e99a979afc50f2a18e1791)
is `8cb7eda91c2b416b37e99a979afc50f2a18e1791`. Only README, package metadata
and license text were retrieved at those pins. This is not a full inference
source/dependency audit or a frozen executable environment.

## Concrete local feasibility and comparison boundary

A package-metadata query in the existing parked reference writer's Python
3.14.6 environment found torch 2.13.0, transformers 5.15.1, numpy 2.5.2 and
pandas 3.0.5. The three distributions chronos-forecasting, timesfm and mlx were
absent there. No inference package was imported. An initial guessed virtualenv
path did not exist; the recorded successful query uses the actual interpreter
from the earlier scalar invocation. This is one environment observation, not
an inventory of every host or proof that installation/inference will succeed.
Chronos's declared broad torch/transformers ranges include those observed
versions; dependency solving, import behavior and resource use still need checks.

Prefer a feasible, pinned external comparator selected before held-out outputs,
with the competing model/version and its pretraining scope explicit. For the
selected task, freeze equal as-of information, context/feature interpretation,
forecast horizon, point versus quantile output meaning, proper score and task
loss. A model's future-covariate API does not authorize giving it future labels
or retrospectively observed features. Record pretraining access as a separate
resource/information difference, and include all fitting, inference, failures,
abstentions and elapsed/resource observations. A small or negative result should
direct the next investment; it does not authorize changing the comparator or
opening more holdouts until a favorable result appears.

## Retained source observations

The [capsule manifest](forecast-comparator-sources/2026-09-08/manifest.json)
indexes 21 independently reopened lossless gzip records: 405,257 original bytes,
99,452 stored bytes. It contains Apache-licensed repository text with its
license files, actual GitHub commit lookups, public model metadata and the
successful local package-metadata query/source/diagnostics. Original model-card
and config retrieval identities are recorded; those bodies are not republished
in the capsule. No tensor/model binary, dataset, held-out output or paper score
table was downloaded. No install, training or inference ran. Raw metadata and
source text remain data, not instructions to the implementation.
