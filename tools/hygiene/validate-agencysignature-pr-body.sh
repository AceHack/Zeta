#!/usr/bin/env bash
# validate-agencysignature-pr-body.sh — pre-merge validator for the
# AgencySignature Convention v1 trailer block in a PR description body.
# Pairs with audit-agencysignature-main-tip.sh (task #299) as the
# pre-merge / post-merge enforcement instrument set per Amara ferry-7
# ("stop designing, instrument enforcement").
#
# Usage:
#   gh pr view <number> --json body --jq '.body' | tools/hygiene/validate-agencysignature-pr-body.sh
#   echo "$pr_body" | tools/hygiene/validate-agencysignature-pr-body.sh
#
# Spec source (the canonical convention):
#   docs/research/2026-04-26-gemini-deep-think-agencysignature-commit-
#   attribution-convention-validation-and-refinement.md Section 10
#
# Per Aaron 2026-04-26 "don't copy paste / make sure you understand and
# write our own" — this implementation is authored from the v1 spec, not
# transcribed from Gemini ferry-8's example draft. Zeta-specific shape:
#  - Markdown code-fence stripping (real failure mode discovered on PR #19
#    where the trailer block was wrapped in ```text...``` and broke parse).
#  - Otto-235 4-shell bash compat (verified on macOS bash 3.2.57): no
#    associative arrays; portable sed/grep flags; printf for stdout.
#  - Glass Halo radical-honesty register: no emoji; structured FAIL
#    messages carry cause + fix + spec citation by absolute path.
#  - Task: enum extension covers ticket-ids AND the 'none' fallback per
#    Amara ferry-7's no-task rule (so agents do not invent fake task IDs).
#  - Consistency check: Human-Review-Evidence must be 'none' when
#    Human-Review is not 'explicit' (Amara ferry-5 evidence-pointer rule).
#
# Exit codes:
#   0 — all required trailers present and enums valid
#   1 — validation failed (specific failure printed)
#   2 — tooling / input error

set -uo pipefail

spec_doc="docs/research/2026-04-26-gemini-deep-think-agencysignature-commit-attribution-convention-validation-and-refinement.md"

if ! command -v git >/dev/null 2>&1; then
  echo "error: git not found on PATH" >&2
  exit 2
fi

input="$(cat)"
if [ -z "$input" ]; then
  echo "error: no input on stdin" >&2
  echo "usage: gh pr view N --json body --jq '.body' | $0" >&2
  exit 2
fi

# Strip markdown code fences if present. The PR-body trailer block can be
# accidentally wrapped in ``` fences which breaks git interpret-trailers.
# Drop fence-only lines (``` or ```<lang>); preserve everything else.
stripped="$(printf '%s\n' "$input" | sed -E '/^[[:space:]]*```([a-zA-Z]*)?[[:space:]]*$/d')"

trailers="$(printf '%s\n' "$stripped" | git interpret-trailers --parse 2>/dev/null || true)"

if [ -z "$trailers" ]; then
  printf '%s\n' "FAIL: no parseable git trailers found in PR body"
  printf '%s\n' "  Cause:  AgencySignature trailer block missing OR blank-line discipline broken"
  printf '%s\n' "  Fix:    ensure the trailer block at PR body bottom has exactly ONE blank"
  printf '%s\n' "          line preceding it and ZERO blank lines within it"
  printf '%s\n' "  Spec:   $spec_doc Section 7.4 (canonical shape) + Section 4 (blank-line guardrail)"
  exit 1
fi

# Required keys per AgencySignature v1 (10 trailers; ferry-5 final form).
required_keys="Agency-Signature-Version Agent Agent-Runtime Agent-Model Credential-Identity Credential-Mode Human-Review Human-Review-Evidence Action-Mode Task"

missing=""
for key in $required_keys; do
  # Trailer keys are case-insensitive per RFC-822; grep -i for safety.
  if ! printf '%s\n' "$trailers" | grep -iq "^${key}:"; then
    missing="$missing $key"
  fi
done

if [ -n "$missing" ]; then
  printf '%s\n' "FAIL: missing required AgencySignature v1 trailer keys:$missing"
  printf '%s\n' "  Cause:  PR body trailer block is incomplete"
  printf '%s\n' "  Fix:    add the missing trailers at the PR body bottom"
  printf '%s\n' "  Spec:   $spec_doc Section 7.4 (canonical 10-trailer block)"
  exit 1
fi

# get_value KEY -> stdout: trimmed value of first matching trailer.
get_value() {
  printf '%s\n' "$trailers" \
    | grep -i "^${1}:" \
    | head -1 \
    | sed -E 's/^[^:]+:[[:space:]]*//; s/[[:space:]]+$//'
}

# check_enum KEY ALLOWED_REGEX -> exits 1 with structured message on mismatch.
check_enum() {
  enum_key="$1"
  enum_allowed="$2"
  enum_val="$(get_value "$enum_key")"
  if ! printf '%s\n' "$enum_val" | grep -Eqx "$enum_allowed"; then
    printf '%s\n' "FAIL: invalid enum value for $enum_key"
    printf '%s\n' "  Found:    '$enum_val'"
    printf '%s\n' "  Expected: one of: $(printf '%s' "$enum_allowed" | sed 's/|/, /g')"
    printf '%s\n' "  Spec:     $spec_doc Section 7.6 (allowed enum values)"
    exit 1
  fi
}

check_enum "Agency-Signature-Version" "1"
check_enum "Credential-Mode" "shared|dedicated-agent|human-only|unknown"
check_enum "Human-Review" "explicit|not-implied-by-credential|none"
check_enum "Human-Review-Evidence" "chat|pr-review|pr-comment|signed-policy|none"
check_enum "Action-Mode" "autonomous-fail-open|human-directed|supervised"

# Task: ticket-id pattern OR 'none' (Amara ferry-7 no-task fallback so agents
# do not invent fake IDs). Accepted ticket-id forms: Otto-NN, task-#NNN,
# task-NNN, #NNN, NNN, FOO-NN, FOO-NNNN. Numeric-only allowed because GitHub
# issue/PR refs are bare integers.
task_val="$(get_value "Task")"
if ! printf '%s\n' "$task_val" \
    | grep -Eqx "none|Otto-[0-9]+|task-#?[0-9]+|#?[0-9]+|[A-Za-z][A-Za-z0-9]*-[0-9]+"; then
  printf '%s\n' "FAIL: invalid Task value"
  printf '%s\n' "  Found:    '$task_val'"
  printf '%s\n' "  Expected: a ticket-id (e.g. Otto-NN, task-#NNN, #NNN, FOO-NN)"
  printf '%s\n' "            or the literal 'none' fallback"
  printf '%s\n' "  Spec:     $spec_doc Section 9.2 (Task: none fallback per Amara ferry-7)"
  exit 1
fi

# Consistency rule (Amara ferry-5): if Human-Review is not 'explicit', then
# Human-Review-Evidence must be 'none'. The evidence pointer only attaches
# to actual review claims.
hr_val="$(get_value "Human-Review")"
hre_val="$(get_value "Human-Review-Evidence")"
if [ "$hr_val" != "explicit" ] && [ "$hre_val" != "none" ]; then
  printf '%s\n' "FAIL: Human-Review-Evidence must be 'none' when Human-Review is not 'explicit'"
  printf '%s\n' "  Human-Review:          '$hr_val'"
  printf '%s\n' "  Human-Review-Evidence: '$hre_val'"
  printf '%s\n' "  Spec:                  $spec_doc Section 5.3 / 7.6"
  printf '%s\n' "  Reason: the evidence pointer attaches to actual review claims;"
  printf '%s\n' "          a non-explicit review state has no evidence to point at"
  exit 1
fi

# Conversely (Amara ferry-5): if Human-Review IS 'explicit', then
# Human-Review-Evidence must NOT be 'none' (the explicit claim must cite
# its source).
if [ "$hr_val" = "explicit" ] && [ "$hre_val" = "none" ]; then
  printf '%s\n' "FAIL: Human-Review: explicit requires Human-Review-Evidence != 'none'"
  printf '%s\n' "  Reason: an explicit review claim must cite where the evidence lives"
  printf '%s\n' "  Fix:    set Human-Review-Evidence to chat | pr-review | pr-comment | signed-policy"
  printf '%s\n' "  Spec:   $spec_doc Section 5.3 (closes the 'explicit according to whom' gap)"
  exit 1
fi

printf '%s\n' "PASS: AgencySignature v1 trailer block valid"
printf '%s\n' "  Agency-Signature-Version: $(get_value Agency-Signature-Version)"
printf '%s\n' "  Agent:                    $(get_value Agent)"
printf '%s\n' "  Agent-Runtime:            $(get_value Agent-Runtime)"
printf '%s\n' "  Agent-Model:              $(get_value Agent-Model)"
printf '%s\n' "  Credential-Identity:      $(get_value Credential-Identity)"
printf '%s\n' "  Credential-Mode:          $(get_value Credential-Mode)"
printf '%s\n' "  Human-Review:             $hr_val"
printf '%s\n' "  Human-Review-Evidence:    $hre_val"
printf '%s\n' "  Action-Mode:              $(get_value Action-Mode)"
printf '%s\n' "  Task:                     $task_val"
exit 0
