#!/usr/bin/env bash
#
# tools/alignment/audit_archive_headers.sh — archive-header
# discipline lint (5th-ferry Artifact C, detect-only v0).
#
# Checks every `docs/aurora/**/*.md` absorb doc for the four
# archive-header fields proposed in the 5th-ferry external-
# research absorb (§33 candidate, PR #235 absorb):
#
#   Scope:               research / cross-review / archival purpose
#   Attribution:         speaker labels preserved
#   Operational status:  research-grade | operational
#   Non-fusion disclaimer: explicit non-fusion clause
#
# The tool is deliberately *detect-only* at v0. Running
# `--enforce` makes it exit non-zero on any missing header,
# but CI does not currently call that flag — the threat-model
# reviewer flagged proposed §33 as IMPORTANT-not-CRITICAL
# pending human-maintainer signoff on the governance edit
# itself. This tool is the mechanism that will back §33 if /
# when it lands; it also provides detect-only signal today
# so drift is visible before enforcement.
#
# Usage:
#   tools/alignment/audit_archive_headers.sh                    # detect-only
#   tools/alignment/audit_archive_headers.sh --enforce          # exit 1 on gap
#   tools/alignment/audit_archive_headers.sh --path DIR         # custom path
#   tools/alignment/audit_archive_headers.sh --json             # JSON output
#   tools/alignment/audit_archive_headers.sh --out DIR          # per-file JSON
#
# Exit codes:
#   0   All archive docs have all four headers (or --enforce unset).
#   1   One or more archive docs missing header(s) and --enforce set.
#   2   Script error / missing dependency / bad args.
#
# Exit-code shape matches sibling `tools/alignment/audit_*.sh`
# scripts: `1` is a content-level signal (under --enforce / --gate),
# `2` is a script-error / dependency-missing / bad-arg signal.
#
# Scope:
# - Default path: `docs/aurora/` — every `.md` file under that
#   tree (recursive; `**/*.md`) is treated as archive-of-external-
#   conversation and checked. A `references/` subfolder is
#   excluded by convention because it is bibliographic substrate,
#   not absorb content.
# - `--path DIR` overrides to check a different archive root
#   (e.g. `docs/research/` would apply only if research docs
#   were the scope; v0 leaves this for explicit opt-in).
#
# Not in scope (v0):
# - Content-level validation of header values. A doc with
#   `Scope: research` as prose in paragraph 3 technically
#   passes; this is the partial-header adversary flagged in
#   the threat-model review. Harden via syntactic requirement
#   (header must appear in the first N lines + as a
#   definition-list item or bold label) in a follow-up.
# - Cross-repo checks (KSK / lucent-ksk cross-references).
# - Memory-file archive-header checks. The repo's canonical
#   agent memory surface is in-repo `memory/` (see
#   `memory/README.md` and `GOVERNANCE.md` §18), but this
#   audit intentionally does not cover that surface. Memory
#   files use their own discipline (canonical index +
#   per-fact files); they are not archive-of-external-
#   conversation content. A separate per-user harness-local
#   staging path also exists out-of-tree but is not in scope
#   for this lint either.
#
# Threat-model context for the §33 decay-without-lint risk
# lives in the threat-model reviewer's research note
# (see PR #241). This script is the lint-companion that
# closes that risk.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

target_path="docs/aurora"
enforce=false
json=false
out_dir=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --enforce) enforce=true; shift ;;
    --json) json=true; shift ;;
    --path)
      if [[ -z "${2:-}" ]]; then
        echo "audit_archive_headers: --path requires a directory" >&2
        exit 2
      fi
      target_path="$2"; shift 2 ;;
    --out)
      if [[ -z "${2:-}" ]]; then
        echo "audit_archive_headers: --out requires a directory" >&2
        exit 2
      fi
      out_dir="$2"; shift 2 ;;
    -h|--help)
      sed -n '3,55p' "$0" | sed 's/^# //;s/^#//'
      exit 0 ;;
    *)
      echo "audit_archive_headers: unknown arg: $1" >&2
      exit 2 ;;
  esac
done

# Normalise target_path: strip any trailing slashes so the
# downstream `-not -path "$target_path/references/*"` pattern
# matches whether the caller passed `docs/aurora` or
# `docs/aurora/`. Without this, `docs/aurora//references/*`
# fails to match anything, and the references/ exclusion
# silently breaks.
while [[ "$target_path" == */ && "$target_path" != "/" ]]; do
  target_path="${target_path%/}"
done

if [[ ! -d "$target_path" ]]; then
  echo "audit_archive_headers: target path not found: $target_path" >&2
  exit 2
fi

# The four required headers. Each pattern matches the label in
# the first 20 lines of the file. v0 uses substring match on
# the label; content-validation is out-of-scope.
declare -a HEADER_LABELS=(
  'Scope:'
  'Attribution:'
  'Operational status:'
  'Non-fusion disclaimer:'
)

# Collect archive files recursively (forced C-locale sort for
# byte-order stable output regardless of LANG/LC_ALL in the
# caller env). Recursive scan matches the documented scope
# (`docs/aurora/**/*.md`) so nested topic / dated subfolders
# are not silently skipped. `references/` is excluded because
# it is the bibliography substrate, not absorb content.
# Use a while-read loop instead of mapfile so the tool runs on
# bash 3.2 (macOS default) as well as bash 4+.
archive_files=()
while IFS= read -r f; do
  archive_files+=("$f")
done < <(find "$target_path" -type f -name '*.md' -not -path "$target_path/references/*" | LC_ALL=C sort)

if [[ ${#archive_files[@]} -eq 0 ]]; then
  echo "audit_archive_headers: no .md files under $target_path" >&2
  exit 0
fi

total_files=${#archive_files[@]}
files_with_all_headers=0
files_missing_headers=0
gap_details=""

if [[ -n "$out_dir" ]]; then
  mkdir -p "$out_dir"
fi

for file in "${archive_files[@]}"; do
  # Read first 20 lines to scope the header check.
  head_content=$(head -n 20 "$file")
  missing_labels=()

  for label in "${HEADER_LABELS[@]}"; do
    if ! grep -qF -- "$label" <<< "$head_content"; then
      missing_labels+=("$label")
    fi
  done

  if [[ ${#missing_labels[@]} -eq 0 ]]; then
    files_with_all_headers=$((files_with_all_headers + 1))
    file_status="ok"
  else
    files_missing_headers=$((files_missing_headers + 1))
    file_status="missing"
    missing_joined=$(IFS=','; echo "${missing_labels[*]}")
    gap_details+="  $file: missing [$missing_joined]"$'\n'
  fi

  if [[ -n "$out_dir" ]]; then
    # Per-file JSON (same shape as audit_commit.sh / audit_personas.sh).
    # Encode subdirectory path in the output filename so a recursive
    # scan over nested folders does not collide on basename. The
    # encoding must be INJECTIVE so distinct source paths cannot map
    # to the same output filename: an earlier slash->'__' replacement
    # collided when a literal '__' already appeared in the path
    # (e.g. `a/b__c.md` and `a__b/c.md` both became `a__b__c.json`).
    # Fix: first percent-encode any literal '_' to '_5F' so the
    # `_` byte never appears in the encoded form; then map path
    # separator '/' to '__'. The encoding round-trips and is
    # collision-free.
    rel_path="${file#"$target_path"/}"
    file_base="${rel_path%.md}"
    file_base="${file_base//_/_5F}"
    file_base="${file_base//\//__}"
    out_file="$out_dir/${file_base}.json"
    {
      echo "{"
      echo "  \"path\": \"$file\","
      echo "  \"status\": \"$file_status\","
      printf '  "missing_labels": ['
      for i in "${!missing_labels[@]}"; do
        if [[ $i -gt 0 ]]; then printf ', '; fi
        printf '"%s"' "${missing_labels[$i]}"
      done
      echo "],"
      echo "  \"tool\": \"audit_archive_headers\","
      echo "  \"v\": 0"
      echo "}"
    } > "$out_file"
  fi
done

if $json; then
  echo "{"
  echo "  \"tool\": \"audit_archive_headers\","
  echo "  \"v\": 0,"
  echo "  \"target_path\": \"$target_path\","
  echo "  \"total_files\": $total_files,"
  echo "  \"files_ok\": $files_with_all_headers,"
  echo "  \"files_missing_headers\": $files_missing_headers,"
  printf '  "enforce": %s\n' "$enforce"
  echo "}"
else
  echo "archive-header audit on $target_path" >&2
  echo "  files checked:          $total_files" >&2
  echo "  all four headers ok:    $files_with_all_headers" >&2
  echo "  missing one or more:    $files_missing_headers" >&2
  if [[ -n "$gap_details" ]]; then
    echo "" >&2
    echo "gaps:" >&2
    printf '%s' "$gap_details" >&2
  fi
fi

# Exit code discipline
if [[ $files_missing_headers -gt 0 ]] && $enforce; then
  exit 1
fi

exit 0
