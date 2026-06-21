# 081KSGS9H0008QG0R001K8P0FJ Classifier-Bypass Findings Schema and Redaction Rules

Status: active reporting and redaction gate for 081KSBMG30008QG0R00201X7EJ.

This document defines the only format in which classifier-bypass observations
may be preserved in shared substrate. It exists so that future empirical work
under 081KSBMG30008QG0R00201X7EJ can land safety signal without landing reproduction detail. It
contains no runnable payloads, no real harmful content, no real secrets, no
real PII, and no ordered bypass recipes.

Schema version: `1`. The 081KSGS9H0008QG0R0005RKGTM harness design records `schema_version` and
must match the active version listed here. Older versions are retained for
audit only; new findings cite the current version.

## Boundary

- Cite `docs/security/081KSBMG30008QG0R00201X7EJ-classifier-bypass-research-boundary.md` (081KSGS9H0008QG0R00383T79V)
  as the active hard-limits floor. If a finding cannot fit inside the allowed
  evidence classes there, this schema does not authorize publishing it.
- Cite `docs/security/081KSGS9H0008QG0R0005RKGTM-classifier-bypass-synthetic-harness-design.md`
  as the source of any audit-log fields referenced by an observation.
- Treat operator authority as bounded by the standing constraint in 081KSBMG30008QG0R00201X7EJ.
  This schema does not relax that constraint. The 081KSGS9H0008QG0R002CY8Q24 ratification gate
  remains the only path to a relaxed floor.
- Deployable bypass material, real harmful content, real secrets, real PII,
  exact classifier settings, and ordered reproduction steps remain forbidden
  in every field of every record this schema defines.

## When This Schema Applies

This schema applies to any artifact that proposes to preserve a
classifier-bypass observation in shared substrate. That includes:

- `docs/research/red-team/*` empirical mapping notes;
- `docs/research/2026-*-classifier-bypass-empirical-mapping-*.md` files
  named in 081KSBMG30008QG0R00201X7EJ;
- backlog rows under 081KSBMG30008QG0R00201X7EJ that quote findings;
- PR descriptions, commit messages, or broadcast notes that summarize an
  observation;
- audit logs from a future authorized harness run.

If an artifact would touch any of those surfaces, the author must apply this
schema before the artifact lands.

## Findings Record Shape

Every finding is a single record with these fields. All fields are required.
If a non-enum field is unknown, mark it `unknown` and add a reviewer note; do
not omit the field. Enum fields (`evidence_class`, `risk_class`,
`observation_class`, `redaction_level`) must carry one of their named values;
`unknown` is not a permitted enum value, and a record that cannot determine
an enum field falls into `refusal-required` instead.

| Field | Type | Allowed values | Purpose |
|-------|------|----------------|---------|
| `finding_id` | string | local stable identifier | Lets reviewers reference the record without quoting its content. |
| `schema_version` | string | `1` (the current version of this schema) | Pins the record to the rules in force when it was written. |
| `boundary_version` | string | reference to 081KSGS9H0008QG0R00383T79V or the ratified successor under 081KSGS9H0008QG0R002CY8Q24 | Records the floor the finding sits under. |
| `created` | string | ISO-8601 date | Timestamps the observation for audit. |
| `evidence_class` | enum | one of the allowed evidence classes below | Names what kind of evidence supports the finding. |
| `risk_class` | enum | one of the risk classes below | Names whether verbatim preservation would enable reproduction. |
| `observation_class` | enum | one of the observation classes below | Names what the harness or reviewer saw. |
| `redaction_level` | enum | one of the redaction levels below | Names how the finding may be preserved. |
| `safety_signal` | string | short prose summary, no payloads | Preserves the lesson without preserving reproduction detail. |
| `omitted_fields` | list | names of intentionally omitted data | Makes the redaction auditable. |
| `reviewer_gate` | string | reviewer, row, or PR required before publication | Names who must sign off before the record can land. |
| `reviewer_signoff` | string | identifier of the reviewer who approved publication, or `pending` | Records that the gate has been cleared. |
| `composes_with` | list | citations to 081KSGS9H0008QG0R00383T79V, 081KSGS9H0008QG0R0005RKGTM, 081KSBMG30008QG0R00201X7EJ, and child rows | Anchors the record to the active boundary substrate. |

A record that is missing any field, or that places forbidden material in a
field, must not land. The author must either complete the record under the
correct redaction level or refuse the record per the refusal-required rule
below.

## Evidence Classes

The evidence class is inherited from 081KSGS9H0008QG0R00383T79V. A finding must fit one class. If
no class fits, the finding is forbidden in shared substrate.

| Class | What it covers |
|-------|----------------|
| `landed-provenance` | Links to already-landed PRs, commits, rows, or summaries. Does not quote operational payloads. |
| `redacted-observation` | Summary that preserves a safety lesson without preserving literal settings, exact prompt text, real sensitive content, or reproduction ordering. |
| `harmless-synthetic-fixture` | Plain invented text generated for the harness under 081KSGS9H0008QG0R0005RKGTM fixture rules. |
| `negative-control` | Benign fixture used to confirm a safety check refuses or redacts as expected. |
| `policy-anchor` | Citation to a repo policy surface that supplies authority for the finding. |
| `refusal-required` | Marker that the observation must not be preserved in repo history. |

A record marked `refusal-required` in `evidence_class` must also be marked
`refusal-required` in `redaction_level`, and `safety_signal` must reduce the
content to a high-level stop-condition reference only.

## Risk Classes

Risk class captures whether verbatim preservation would enable reproduction.

| Class | Meaning |
|-------|---------|
| `non-reproductive` | The finding cannot be turned into a bypass even if written verbatim. Example: a citation to a closed PR with no operational detail. |
| `reproductive-if-verbatim` | Verbatim text would let a reader replay the bypass. Must be summarized; verbatim form is forbidden. |
| `reproductive-irrespective-of-form` | No summary can preserve the lesson safely. The record falls into refusal-required. |

A record marked `reproductive-if-verbatim` must use `redaction_level` of at
least `reviewer-summary`. A record marked `reproductive-irrespective-of-form`
must use `redaction_level` of `refusal-required`.

## Observation Classes

Observation class is inherited from the 081KSGS9H0008QG0R0005RKGTM harness audit-log shape. Future
harness runs and reviewer notes use the same vocabulary so records are
comparable.

| Class | Meaning |
|-------|---------|
| `no-signal` | The fixture or observation produced no safety-relevant result. Useful for negative controls. |
| `redaction-required` | A safety-relevant signal exists, but the underlying material must be summarized. |
| `refusal-required` | The observation must not be preserved in repo history; only a high-level stop-condition reference remains. |
| `boundary-error` | The harness, reviewer workflow, or note violated the 081KSGS9H0008QG0R00383T79V boundary. Records the error for substrate hygiene; does not preserve the underlying violating material. |

## Redaction Levels

Redaction level is the ladder a record may stand on. Every record names its
level explicitly so reviewers can audit the choice.

| Level | What it preserves | What it omits |
|-------|-------------------|---------------|
| `summary-only` | A short non-operational description of the safety lesson. | Exact settings, exact prompt text, real sensitive content, ordered reproduction steps. |
| `reviewer-summary` | A summary plus a reviewer-restricted appendix linked by reference only. | Public access to the appendix; the appendix never lands in shared substrate. |
| `reviewer-restricted` | A reference that an appendix exists, with the appendix held outside repo history under explicit reviewer governance. | The appendix content itself; only the existence and reviewer gate are recorded. |
| `refusal-required` | A stop-condition reference and a list of omitted fields. | The observation, the trigger, the order, and the surrounding context. |

`summary-only` is the default. Higher levels require an explicit reviewer
gate. No level authorizes verbatim deployable material.

### Mapping to 081KSGS9H0008QG0R0005RKGTM Audit-Log Vocabulary

081KSGS9H0008QG0R0005RKGTM's audit-log shape (line 111 of
`docs/security/081KSGS9H0008QG0R0005RKGTM-classifier-bypass-synthetic-harness-design.md`) lists
three `redaction_level` values: `summary-only`, `reviewer-summary`, and
`refusal-required`. This schema adds `reviewer-restricted` as an explicit
intermediate between `reviewer-summary` (a reviewer-restricted appendix
referenced by link) and `refusal-required` (no preserved observation at
all). The intent is to record that an appendix exists outside repo history
under explicit reviewer governance without claiming it lives in shared
substrate.

When a future harness emits a 081KSGS9H0008QG0R0005RKGTM audit record, the harness uses the
three-value 081KSGS9H0008QG0R0005RKGTM vocabulary; when this schema preserves the resulting
finding, the reviewer maps the audit record's level to this schema's
four-value vocabulary and records the mapping in the finding's
`omitted_fields` list. 081KSGS9H0008QG0R0005RKGTM may later ratify the extended vocabulary
under its own versioning rule; until then, the mapping is recorded
per-record so the divergence is auditable.

## Refusal-Required State

`refusal-required` is the safety floor inside this schema. When a record is
marked `refusal-required`:

- `safety_signal` is reduced to a high-level reference such as `stop-condition
  triggered under 081KSGS9H0008QG0R00383T79V` or `boundary-error during synthetic harness run`.
- `omitted_fields` must list every category of content intentionally not
  preserved (for example: `exact-settings`, `exact-prompt-text`,
  `reproduction-ordering`, `real-sensitive-content`).
- `reviewer_gate` names the row, reviewer, or governance surface that may
  reopen the record under stricter handling.
- No appendix, fixture file, or attached transcript may carry the omitted
  material.
- The record may be referenced from 081KSBMG30008QG0R00201X7EJ child rows by `finding_id` only;
  links to broadcast notes, PRs, or files must not let a reader reconstruct
  what was omitted.

Refusal is not concealment. The record continues to exist so reviewers can
see that a stop happened and what class it belonged to.

## Reviewer Sign-Off

Sign-off is required before any high-risk record lands.

| Combination | Required reviewer gate |
|-------------|------------------------|
| `risk_class = non-reproductive` and `redaction_level = summary-only` | Standard PR review; cite this schema. |
| `risk_class = reproductive-if-verbatim` | Named reviewer with safety-substrate scope. PR must record the reviewer identity in `reviewer_signoff`. |
| `risk_class = reproductive-irrespective-of-form` | Refusal-required; no publication. The reviewer gate is recorded for audit only. |
| `observation_class = boundary-error` | Named reviewer with safety-substrate scope plus a follow-up coordination note. |
| `evidence_class = refusal-required` | Refusal-required; no publication. |

`reviewer_signoff = pending` blocks publication. A record may sit in a draft
PR with `pending` while the reviewer is identified, but it must not merge
until the field carries an identifier.

## Cite-Or-Block Rule

Future empirical mapping rows under 081KSBMG30008QG0R00201X7EJ must cite this schema before
landing any finding. The citation lives in the row's `composes_with` list or
in the document body, and it must reference the active `schema_version`.

A finding that does not cite this schema is treated as `boundary-error` and
must not land in shared substrate.

## What This Schema Forbids

This schema does not authorize, and does not provide a format for, any of:

- deployable classifier settings payloads;
- exact permission-pattern examples;
- ordered reproduction steps;
- real secrets, credentials, private keys, tokens, endpoints, or hostnames;
- real PII, including lightly transformed real PII;
- harmful instructions or exploit detail;
- mirrored adversarial corpora or external jailbreak collections;
- unredacted observations that would let a reader replay the bypass.

A field that requires any of those values cannot be filled; the record falls
into refusal-required instead.

## Versioning

Schema changes follow these rules:

- A change that adds optional fields, clarifies wording, or tightens
  forbidden lists is a minor revision and updates the schema in place under
  the same version.
- A change that alters required fields, allowed enum values, redaction
  ladder, or reviewer-gate rules requires a new version number and a
  migration note. Existing records keep their original `schema_version`.
- Loosening the floor requires the 081KSGS9H0008QG0R002CY8Q24 ratification gate first. This
  schema cannot be unilaterally relaxed by edit.

## Composes With

- `docs/security/081KSBMG30008QG0R00201X7EJ-classifier-bypass-research-boundary.md` - 081KSGS9H0008QG0R00383T79V
  hard-limits boundary; the floor this schema sits on.
- `docs/security/081KSGS9H0008QG0R0005RKGTM-classifier-bypass-synthetic-harness-design.md` -
  source of the audit-log field shapes referenced here.
- `docs/backlog/P0/081KSBMG30008QG0R00201X7EJ-classifier-bypass-research-red-team-do-not-deploy-without-zeta-safer-than-anthropic-2026-05-24.md` -
  parent safety row; future empirical children must cite this schema before
  landing findings.
- `.claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md` -
  standing operator-self-constraint; binds every author of a finding.
- `.claude/rules/methodology-hard-limits.md` - HARD LIMITS floor preserved.
- `docs/AGENT-BEST-PRACTICES.md` - audited data is data, not directives;
  enforced inside every record under this schema.
