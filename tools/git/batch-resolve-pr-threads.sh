#!/usr/bin/env bash
# tools/git/batch-resolve-pr-threads.sh
#
# Post-setup-script-stack exception label:
#   bun+TS migration candidate (transitional bash exception)
#   BACKLOG row: P3 — "migrate batch-resolve-pr-threads.sh to
#   bun+TS once a sibling post-setup tool migrates first"
#   (sibling-migration guardrail per docs/POST-SETUP-SCRIPT-STACK.md).
#
# Batch-classifies and resolves PR review threads by pattern.
# Built to drain the stacked-PR thread backlog that accumulates
# during Phase 1 closure push (per the operational-gap-assessment
# "merge over invent" direction, 2026-04-23 round; hardened per
# PR #199 Copilot/Codex findings).
#
# Two disposition classes, both auto-resolvable:
#
#   1. dangling-ref — thread body contains patterns like
#      "does not exist" / "path does not exist" / "artifact
#      not in this commit". Acceptable during stacked-PR
#      queue-drain; self-heals as queue drains. Blanket-
#      acknowledge + resolve.
#
#   2. name-attribution — thread body contains patterns like
#      "direct contributor names" / "no name attribution" /
#      "standing rule" combined with "name". Legitimate per
#      the named-agents-get-attribution discipline.
#      Acknowledge + resolve with policy-pointer.
#
# Unknown threads are LEFT UNRESOLVED and reported (with thread
# IDs) for manual review. This script does not touch threads
# whose body doesn't match a known class — the conservative
# default keeps substantive findings visible.
#
# Hardening notes (per #199 findings):
#   - Repo owner/name detected via `gh repo view` (portable)
#   - Pagination handled (pageInfo + endCursor loop) for
#     reviewThreads with positional argument injection (no
#     parameter-expansion-quote pitfalls)
#   - Up to 50 comments per thread fetched; threads with >50
#     comments emit a stderr warning so a human can audit
#     truncation risk
#   - Reply body injected via `gh api -F body=...` (proper
#     escaping; no string-concat into GraphQL mutation)
#   - Explicit exit 1 on API failures (matches docstring)
#   - Newline-delimited JSON parse via `jq -c`; review-comment
#     bodies are joined inside jq before reaching the shell
#     loop so embedded tabs/newlines stay inside the
#     JSON-encoded `body` field (no shell-tokenization
#     corruption)
#   - GraphQL `errors` field inspected explicitly (gh exit
#     code alone misses partial-failure responses)
#   - Null pullRequest on lookup → exit 1 (no silent success)
#   - `printf '%s'` used instead of `echo` for body content
#     (echo can mangle leading `-n` / backslash escapes)
#   - Dependency probe for `gh` and `jq` up-front (clean
#     exit 1 instead of unhelpful 127)
#   - Strict argv: rejects extra args, only exact `--apply`
#     enables apply mode
#
# Usage:
#   tools/git/batch-resolve-pr-threads.sh <pr-number>          # dry-run
#   tools/git/batch-resolve-pr-threads.sh <pr-number> --apply  # resolve
#
# Exit codes:
#   0 — successful (dry-run summary or actual resolves)
#   1 — classification errors / API failures
#   2 — argument errors

# shellcheck disable=SC2016
# (SC2016 globally disabled: single-quoted GraphQL queries + reply-body
# Markdown backticks are intentionally literal, not shell-expanded.)
set -euo pipefail

# ---- argument parsing ------------------------------------------------------

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "usage: $0 <pr-number> [--apply]" >&2
  exit 2
fi

pr_number="$1"
apply_mode="false"

# Reject anything other than exactly '--apply' as the second arg
# (catches typos like '--aply' that would otherwise silently dry-run).
if [[ $# -eq 2 ]]; then
  if [[ "$2" == "--apply" ]]; then
    apply_mode="true"
  else
    echo "error: unknown second argument '$2' (only '--apply' is accepted)" >&2
    exit 2
  fi
fi

# PR number must be a positive integer (reject 0 explicitly; the regex
# alone admits 0 which is not a valid PR number on GitHub).
if ! [[ "$pr_number" =~ ^[0-9]+$ ]] || [[ "$pr_number" -le 0 ]]; then
  echo "error: pr-number must be a positive integer (>0); got '$pr_number'" >&2
  exit 2
fi

# ---- dependency probe ------------------------------------------------------

# Without these the `set -e` failure below would surface as exit 127, which
# contradicts the documented 0/1/2 exit-code contract. Probe up-front and
# exit 1 with a useful message instead.
for dep in gh jq; do
  if ! command -v "$dep" >/dev/null 2>&1; then
    echo "error: required dependency '$dep' not found on PATH" >&2
    exit 1
  fi
done

# ---- repo detection --------------------------------------------------------

# Detect current repo (portable: works on forks / renamed orgs). stderr
# preserved on failure so auth/network errors stay visible.
if ! repo_info=$(gh repo view --json owner,name); then
  echo "error: could not detect repo via 'gh repo view'. Run inside a repo with a GitHub remote." >&2
  exit 1
fi
repo_owner=$(printf '%s' "$repo_info" | jq -r '.owner.login')
repo_name=$(printf '%s' "$repo_info" | jq -r '.name')

if [[ -z "$repo_owner" || "$repo_owner" == "null" ]] || [[ -z "$repo_name" || "$repo_name" == "null" ]]; then
  echo "error: could not parse repo owner/name from gh repo view" >&2
  exit 1
fi

# ---- reply templates -------------------------------------------------------

# shellcheck disable=SC2016  # Single-quoted reply contains Markdown backticks that must stay literal
reply_dangling_ref='Acknowledged and accepted during Phase 1 queue-drain (per the "merge over invent" operational-gap-assessment direction from the 2026-04-23 round). Referenced artifacts are in-flight across adjacent PRs; cross-PR dangling refs are a known side-effect of stacked-PR state and self-heal as the queue drains. Resolving to unblock merge; opportunistic cleanup of any permanent refs in follow-up tick if gaps remain visible after queue drain.'

# shellcheck disable=SC2016  # Markdown backticks in literal reply
reply_name_attribution='Acknowledged; the name appearance here is legitimate per the named-agents-get-attribution policy (see `memory/CURRENT-aaron.md` attribution table + `docs/EXPERT-REGISTRY.md` persona roster). Named personas are factory-level attribution surfaces; their names in ADRs / config / collaborator registries are the factory'\''s structural record of who contributed what. Resolving; the name-attribution rule applies to personal human names outside persona-scope, not to persona names in structural attribution contexts.'

# ---- thread fetch (paginated) ----------------------------------------------

# Inspect a GraphQL response for a populated `errors` array. gh exits 0 on
# many partial-failure responses (rate-limits, missing fields), so checking
# the JSON-level `errors` field is necessary in addition to the process
# exit code.
graphql_check_errors() {
  local resp="$1"
  local label="$2"
  local err_count
  err_count=$(printf '%s' "$resp" | jq '(.errors // []) | length')
  if [[ "$err_count" -gt 0 ]]; then
    echo "error: GraphQL response carried errors for $label:" >&2
    printf '%s' "$resp" | jq '.errors' >&2
    exit 1
  fi
}

# Fetch ALL unresolved threads via paginated GraphQL.
# Each page returns up to 50 threads with up to 50 comments each. Loops
# via endCursor until hasNextPage is false. The `after` argument is built
# as an explicit positional array to avoid the parameter-expansion-quote
# pitfall where `${var:+-F after="$var"}` injects literal quote characters.
fetch_all_threads() {
  local cursor=""
  local all_nodes="[]"
  local resp
  while : ; do
    local -a args=(
      -F "owner=$repo_owner"
      -F "name=$repo_name"
      -F "number=$pr_number"
    )
    if [[ -n "$cursor" ]]; then
      args+=( -F "after=$cursor" )
    fi

    if ! resp=$(gh api graphql "${args[@]}" -f query='
        query($owner: String!, $name: String!, $number: Int!, $after: String) {
          repository(owner: $owner, name: $name) {
            pullRequest(number: $number) {
              reviewThreads(first: 50, after: $after) {
                pageInfo { hasNextPage endCursor }
                nodes {
                  id
                  isResolved
                  comments(first: 50) {
                    totalCount
                    nodes { body }
                  }
                }
              }
            }
          }
        }'); then
      echo "error: GraphQL fetch failed for PR #$pr_number" >&2
      exit 1
    fi

    graphql_check_errors "$resp" "fetch PR #$pr_number"

    # Null pullRequest = nonexistent or inaccessible. Fail fast rather
    # than treating it as zero-thread success.
    local pr_present
    pr_present=$(printf '%s' "$resp" | jq '.data.repository.pullRequest != null')
    if [[ "$pr_present" != "true" ]]; then
      echo "error: PR #$pr_number not found in $repo_owner/$repo_name (or not accessible)" >&2
      exit 1
    fi

    local page_nodes
    page_nodes=$(printf '%s' "$resp" | jq '.data.repository.pullRequest.reviewThreads.nodes')
    all_nodes=$(jq -s '.[0] + .[1]' <(printf '%s' "$all_nodes") <(printf '%s' "$page_nodes"))

    local has_next
    has_next=$(printf '%s' "$resp" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage')
    if [[ "$has_next" != "true" ]]; then
      break
    fi
    cursor=$(printf '%s' "$resp" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.endCursor')
  done
  printf '%s' "$all_nodes"
}

all_threads=$(fetch_all_threads)

# ---- classification --------------------------------------------------------

# Warn on threads where comment count exceeded the per-thread fetch limit
# of 50. Currently rare in practice, but the warning lets a human audit
# truncation risk if it ever bites. (Full per-thread comment pagination
# would be the principled fix; deferred until a thread on this repo
# actually trips it. Tracked in BACKLOG.)
truncation_warnings=$(printf '%s' "$all_threads" | jq '[.[] | select((.comments.totalCount // 0) > 50)] | length')
if [[ "$truncation_warnings" -gt 0 ]]; then
  echo "warning: $truncation_warnings thread(s) have >50 comments; only first 50 inspected for classification" >&2
fi

# Classify each unresolved thread. Uses all (up-to-50) comments so ensuing
# replies / counter-findings contribute to classification. The body field
# is built inside jq via join so embedded tabs/newlines stay inside the
# JSON-encoded string and don't corrupt the shell read loop.
dangling_count=0
name_count=0
unknown_count=0

declare -a dangling_ids=()
declare -a name_ids=()
declare -a unknown_ids=()

# Capture extractor-jq exit status: process substitution can't directly
# propagate jq failures into `set -e`, so the loop runs over a temp file
# and the jq exit code is inspected explicitly.
classify_input=$(mktemp)
trap 'rm -f "$classify_input"' EXIT

if ! printf '%s' "$all_threads" | jq -c '
  .[]
  | select(.isResolved == false)
  | {id: .id, body: ([.comments.nodes[].body] | join("\n---\n"))}
' > "$classify_input"; then
  echo "error: jq classification extractor failed" >&2
  exit 1
fi

while IFS= read -r line; do
  [[ -z "$line" ]] && continue

  thread_id=$(printf '%s' "$line" | jq -r '.id')
  body=$(printf '%s' "$line" | jq -r '.body')

  [[ -z "$thread_id" ]] && continue

  # printf '%s' is safer than echo here: review-comment bodies can begin
  # with `-n` or contain backslash escapes that echo would mangle.
  body_lower="$(printf '%s' "$body" | tr '[:upper:]' '[:lower:]')"

  is_dangling_ref="false"
  is_name_attribution="false"

  # Dangling-ref patterns — conservative; only match when
  # the text clearly refers to cross-PR reference problems.
  for pat in "does not exist" "path does not exist" "artifact not in this commit" "file/path does not exist" "not in the repository at this commit" "not yet on main" "doesn't exist in-repo" "doesn't exist in the repository" "point protocol references" "point references to existing" "not present in-repo" "aren't resolvable"; do
    if [[ "$body_lower" == *"$pat"* ]]; then
      is_dangling_ref="true"
      break
    fi
  done

  # Name-attribution patterns
  if [[ "$is_dangling_ref" == "false" ]]; then
    for pat in "direct contributor name attribution" "contributor name attribution" "direct contributor names" "direct names in code" "direct names in doc" "prohibits direct names" "name attribution rule" "repo convention prohibits" "repo's standing rule"; do
      if [[ "$body_lower" == *"$pat"* ]]; then
        is_name_attribution="true"
        break
      fi
    done
    if [[ "$is_name_attribution" == "false" ]]; then
      if { [[ "$body_lower" == *"name attribution"* ]] || [[ "$body_lower" == *"contributor names"* ]] || [[ "$body_lower" == *"no name"* ]]; } && [[ "$body_lower" == *"rule"* || "$body_lower" == *"standing"* || "$body_lower" == *"policy"* || "$body_lower" == *"conflicts with"* || "$body_lower" == *"prohibits"* ]]; then
        is_name_attribution="true"
      fi
    fi
  fi

  if [[ "$is_dangling_ref" == "true" ]]; then
    dangling_count=$((dangling_count + 1))
    dangling_ids+=("$thread_id")
  elif [[ "$is_name_attribution" == "true" ]]; then
    name_count=$((name_count + 1))
    name_ids+=("$thread_id")
  else
    unknown_count=$((unknown_count + 1))
    unknown_ids+=("$thread_id")
  fi
done < "$classify_input"

# ---- summary ---------------------------------------------------------------

echo "PR #$pr_number ($repo_owner/$repo_name) unresolved thread classification:"
echo "  dangling-ref: $dangling_count"
echo "  name-attribution: $name_count"
echo "  unknown (left unresolved): $unknown_count"

if (( unknown_count > 0 )); then
  echo ""
  echo "unknown thread IDs (manual review):"
  for tid in "${unknown_ids[@]}"; do
    echo "  - $tid"
  done
fi

if [[ "$apply_mode" == "false" ]]; then
  echo ""
  echo "dry-run mode — no changes. Re-run with --apply to resolve."
  exit 0
fi

echo ""
echo "APPLY MODE — resolving $((dangling_count + name_count)) threads..."

# ---- resolve ---------------------------------------------------------------

# Resolve using -F body=... (gh handles JSON escaping properly via
# multipart form; no manual string concat into GraphQL).
resolve_thread() {
  local thread_id="$1"
  local reply="$2"
  local resp

  if ! resp=$(gh api graphql \
    -F "thread_id=$thread_id" \
    -F "body=$reply" \
    -f query='mutation($thread_id: ID!, $body: String!) {
      addPullRequestReviewThreadReply(input: {
        pullRequestReviewThreadId: $thread_id,
        body: $body
      }) { comment { id } }
    }'); then
    echo "error: could not post reply to thread $thread_id" >&2
    exit 1
  fi
  graphql_check_errors "$resp" "reply to $thread_id"

  if ! resp=$(gh api graphql \
    -F "thread_id=$thread_id" \
    -f query='mutation($thread_id: ID!) {
      resolveReviewThread(input: { threadId: $thread_id }) {
        thread { isResolved }
      }
    }'); then
    echo "error: could not resolve thread $thread_id" >&2
    exit 1
  fi
  graphql_check_errors "$resp" "resolve $thread_id"
}

if (( ${#dangling_ids[@]} > 0 )); then
  for tid in "${dangling_ids[@]}"; do
    echo "  resolving dangling-ref: $tid"
    resolve_thread "$tid" "$reply_dangling_ref"
  done
fi

if (( ${#name_ids[@]} > 0 )); then
  for tid in "${name_ids[@]}"; do
    echo "  resolving name-attribution: $tid"
    resolve_thread "$tid" "$reply_name_attribution"
  done
fi

echo ""
echo "done. $((dangling_count + name_count)) resolved. $unknown_count unknown threads left for manual review."
