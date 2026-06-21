# 081KSGS9H0008QG0R0005RKGTM Classifier-Bypass Synthetic Harness Design

Status: design-only output for 081KSGS9H0008QG0R0005RKGTM.

This document defines the shape of a future synthetic-only harness under
081KSBMG30008QG0R00201X7EJ. It is not an implementation plan for bypassing a classifier. It adds
no executable code, no settings payloads, no fixture files, and no reproduction
steps. Future implementation remains blocked by 081KSGS9H0008QG0R00383T79V and by the reporting
rules in 081KSGS9H0008QG0R001K8P0FJ.

## Boundary

The harness exists only to let reviewers inspect a safe test shape before any
implementation work is proposed. It must preserve the safety signal without
preserving operational bypass detail.

Required boundaries:

- Cite `docs/security/081KSBMG30008QG0R00201X7EJ-classifier-bypass-research-boundary.md` and stop
  if a requested fixture, observation, or report crosses that boundary.
- Treat 081KSGS9H0008QG0R00383T79V as a blocking prerequisite for implementation. If 081KSGS9H0008QG0R00383T79V is
  replaced, 081KSGS9H0008QG0R002CY8Q24 must ratify the replacement before this design is reused.
- Treat 081KSGS9H0008QG0R001K8P0FJ as the required reporting and redaction gate before any
  observation can be published.
- Keep the first implementation, if one is later authorized, in dry-run mode.
- Do not commit real classifier settings, real blocked content, real secrets,
  real PII, external adversarial corpora, or ordered reproduction steps.

## Synthetic Fixture Taxonomy

Every fixture must be invented for the harness, marked synthetic, and harmless
by construction. Fixtures test shape and logging behavior only.

Allowed fixture classes:

- Harmless text: short invented prose with no policy-sensitive target content.
- Dummy secret: clearly fake tokens such as `EXAMPLE_TOKEN_DO_NOT_USE`, never a
  realistic copied credential format or live endpoint.
- Fake PII: invented names, reserved domains, impossible phone numbers, and
  documentation-only addresses that cannot identify a real person.
- Negative control: benign content that should produce no safety observation
  and confirms the harness can record an uneventful dry run.
- Redaction control: synthetic content intentionally shaped to require summary
  reporting, used only to verify that the report omits the sensitive-looking
  string.

Disallowed fixture classes:

- Real user data, production logs, support transcripts, email, or chat content.
- Real credentials, plausible copied credential formats, private keys, tokens,
  hostnames, or production endpoints.
- Harmful instructions, exploit procedures, external jailbreak corpora, or
  material fetched from adversarial payload collections.
- Literal classifier settings, permission-pattern examples, or any payload a
  reader could adapt into an operational bypass.

## Fixture Provenance

Each future fixture record must carry enough provenance for review without
copying unsafe material.

Required fields:

- `fixture_id`: stable local identifier.
- `fixture_class`: one of the allowed classes above.
- `synthetic_statement`: explicit statement that the content is invented.
- `source`: `generated-in-repo` or `handwritten-synthetic`.
- `forbidden_source_check`: reviewer assertion that no real sensitive content,
  corpus text, or operational payload was used.
- `intended_property`: the safety or redaction property under inspection.
- `retention`: whether the exact fixture text can remain in repo history or
  must be summarized.

The provenance record must not contain real source text, external corpus
snippets, deployable configuration, or the sequence needed to reproduce a
bypass.

## Dry-Run Interface Shape

A future implementation may define a dry-run command only after a separate
claim and review gate. This design constrains that command shape:

- Input is a fixture identifier and fixture class, not raw arbitrary content.
- The command reports classifier-observation metadata without storing settings
  payloads or exact prompt/configuration text.
- The command has no write path to classifier settings, agent permissions, or
  shared configuration files.
- The command defaults to `--dry-run` and refuses any non-dry-run mode until a
  ratified follow-up row changes the boundary.
- The command exits with a value-level result that distinguishes safe
  observation, redaction-required, refusal-required, and boundary-error states.

The dry-run interface may record that a class of observation happened. It must
not record the exact content, exact settings, or ordered replay instructions
that caused the observation.

## Audit Log Shape

Audit logs are evidence for reviewers, not reproduction kits. Future logs must
be append-only and summary-first.

Required audit fields:

- `run_id`: opaque identifier.
- `fixture_id`: reference to the synthetic fixture record.
- `fixture_class`: allowed fixture class.
- `boundary_version`: 081KSGS9H0008QG0R00383T79V boundary or ratified successor.
- `schema_version`: 081KSGS9H0008QG0R001K8P0FJ findings schema version once available.
- `observation_class`: high-level class such as `no-signal`,
  `redaction-required`, `refusal-required`, or `boundary-error`.
- `redaction_level`: summary-only, reviewer-summary, or refusal-required.
- `omitted_fields`: names of data intentionally not persisted.
- `reviewer_gate`: row, PR, or review surface required before publication.

Forbidden audit fields:

- raw fixture content when it resembles sensitive material;
- real classifier settings or permission patterns;
- exact prompt text, exact configuration, or step ordering;
- real PII, real secrets, harmful content, or external corpus text.

## Data Never Persisted

The following data must never be committed, logged, attached to PRs, copied
into broadcasts, or preserved in generated reports:

- deployable classifier settings payloads;
- exact permission-pattern examples;
- ordered reproduction steps;
- real secrets, credentials, private keys, tokens, endpoints, or hostnames;
- real PII or lightly transformed real PII;
- harmful instructions or exploit detail;
- external adversarial corpora or mirrored payload sets;
- unredacted observations that would let a reader replay the bypass.

If a future run produces any of those materials, the only allowed repo output is
a summary that cites the stop condition and records what was omitted.

## Reviewer Gates

Before any implementation starts:

- 081KSGS9H0008QG0R00383T79V must remain closed and current, or 081KSGS9H0008QG0R002CY8Q24 must ratify a replacement
  boundary.
- 081KSGS9H0008QG0R001K8P0FJ must define the findings schema and redaction rules used by the
  harness.
- A reviewer must confirm that fixtures are synthetic-only and that logs cannot
  reconstruct a bypass.
- The implementation claim must name the exact files it will touch and must
  state that it will not write classifier settings or shared configuration.

Before any observation is published:

- The observation must be classified under 081KSGS9H0008QG0R001K8P0FJ.
- Any redaction-required or refusal-required observation must omit the exact
  triggering content and any replay sequence.
- A reviewer must confirm that the report preserves safety signal without
  preserving reproduction detail.

## Closure

081KSGS9H0008QG0R0005RKGTM is closed by this design document. It authorizes only later review of
the harness shape. It does not authorize implementation, execution,
publication of empirical findings, or any deployment of classifier-bypass
behavior.
