#!/usr/bin/env bash
# tools/pr-preservation/archive-pr.sh
#
# Minimal git-native PR-conversation preservation (Otto-207).
# Fetches a PR's review threads + general comments + reviews
# via `gh api graphql` and writes them to
# `docs/pr-discussions/PR-<N>-<slug>.md` for audit trail
# outside of GitHub.
#
# Addresses the gap identified Otto-207: PR-preservation
# BACKLOG row (Otto-150..154, PR #335) specifies the
# discipline but never shipped the capture tooling. This
# script is the minimal viable implementation; scales up
# to a GHA workflow later.
#
# Usage:
#   tools/pr-preservation/archive-pr.sh <PR-number>
#
# Output: writes docs/pr-discussions/PR-<NNNN>-<slug>.md with
# YAML frontmatter (pr_number, title, author, merged_at,
# state, archived_at) + all review threads + reviews +
# general PR comments. PR numbers are zero-padded to four
# digits in the filename (e.g. PR-0357-...) so archives
# sort lexicographically in the same order as they sort
# numerically up to PR #9999.
#
# Exit codes:
#   0  success
#   1  missing arg / gh CLI not authenticated / repo detect failed
#   2  PR fetch failed (auth / network / GraphQL errors / not found)
#
# Review-thread drain Otto-226 fixes (PR #357):
#   - Pagination for threads (>100) and per-thread comments
#     (>100).
#   - Top-level `errors` and `pullRequest: null` detection
#     before dereferencing (both Python and shell paths).
#   - Dynamic owner/name from `gh repo view` (works from
#     forks or after a rename).
#   - `set -e`-safe capture of `gh api graphql` exit code
#     so "fetch failed" diagnostics actually print.
#   - YAML string values quoted (refs can contain `#` / `:`).
# Review-thread drain Otto-234 fixes (PR #357, second pass):
#   - Validate `PR` argv is a positive integer in the shell
#     (avoids Python traceback + generic "exit 2" diagnostic).
#   - Stop stripping trailing whitespace from archived text:
#     markdown uses `"  \n"` as a hard-line-break, and this
#     tool preserves a faithful audit copy.
#   - Collapse runs of 3+ blank lines to 2 so the generated
#     archives stay clean under markdownlint MD012.
#   - README + header comment now match the implementation's
#     zero-padded `PR-<NNNN>-<slug>.md` filename shape and
#     document `bash` (not `bash 4+`) as the dependency.
# Review-thread drain Otto-235 fixes (PR #357, third pass):
#   - PR number is the canonical archive key: on re-archive,
#     detect an existing `PR-<NNNN>-*.md` file and reuse its
#     path regardless of current title, so title edits update
#     in place rather than orphaning the old slug. New PRs
#     still land at `PR-<NNNN>-<slug>.md`.
#   - Preserve leading whitespace in archived body text:
#     switched `.strip()` to `.rstrip('\n')` for review /
#     thread-comment / general-comment bodies so indented
#     code blocks and bullets survive the round-trip.
# Review-thread drain Otto-236 fixes (PR #357, fourth pass):
#   - Header "truncation warning" claim removed — the
#     implementation paginates, never emits a warning, so the
#     comment now describes actual behaviour.
#   - PR-description body now uses `.rstrip('\n')` instead of
#     `.rstrip()` so a hard-line-break on the last line of
#     the description is preserved.
#   - End-of-file content join uses `.rstrip('\n')` instead
#     of `.rstrip()` so end-of-file hard-line-breaks survive.
#   - Whitespace-only lines (e.g. indented connector output
#     with only spaces/tabs, and no preceding text) are
#     normalized to empty so markdownlint MD009 stays clean.
#     Lines with any non-whitespace character keep trailing
#     whitespace intact (two-space hard-line-breaks).
# Review-thread drain Otto-241 fix (PR #357, fifth pass):
#   - Blank-line-run collapse + whitespace-only normalization
#     are now SKIPPED inside fenced code blocks (``` / ~~~).
#     Fenced blocks are where user-authored 3+ blank-line
#     runs and leading whitespace are intentional (logs,
#     templates, preformatted output); markdownlint MD012
#     already exempts fenced code from the "no multiple
#     consecutive blank lines" rule, so audit fidelity wins
#     inside fences. Outside fences, MD012/MD009 hygiene
#     still applies to tool-generated scaffolding.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: $0 <PR-number>" >&2
  exit 1
fi

PR="$1"
# Validate PR is a positive integer before invoking Python.
# Prevents a Python traceback + generic "fetch failed exit 2"
# when the operator passes a typo or non-integer arg.
if ! [[ "$PR" =~ ^[0-9]+$ ]]; then
  echo "error: PR number must be a non-empty positive integer (got: '$PR')" >&2
  echo "usage: $0 <PR-number>" >&2
  exit 1
fi
# Require an actual git checkout. `gh repo view` can succeed
# outside a checkout (via `gh repo set-default` / an auth'd
# session pointing at a remote), which would cause the
# archive to be written to a bogus REPO_ROOT derived from
# `pwd`. Hard-fail if we aren't inside a git working tree.
if ! REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "error: not inside a git working tree. Archive-pr.sh must run from a Zeta checkout so the docs/pr-discussions/ output lives in the right repo." >&2
  exit 1
fi

# Dynamic owner / name — works from forks or after rename.
# Requires `gh repo view` to succeed; the script hard-fails
# with exit 1 rather than silently defaulting to a baked-in
# NWO (better to fail loud than archive to the wrong repo
# path on a fork).
REPO_NWO="$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null || true)"
if [ -z "${REPO_NWO}" ]; then
  echo "error: could not detect repo via 'gh repo view'. Is gh authenticated and this a GitHub repo?" >&2
  exit 1
fi
REPO_OWNER="${REPO_NWO%/*}"
REPO_NAME="${REPO_NWO#*/}"

export REPO_ROOT PR REPO_OWNER REPO_NAME
OUT_DIR="${REPO_ROOT}/docs/pr-discussions"
mkdir -p "$OUT_DIR"

# Use an explicit template so mktemp works on both GNU
# coreutils (Linux) and BSD mktemp (macOS) — plain `mktemp`
# with no argument fails on BSD.
TMP="$(mktemp -t zeta-archive-pr.XXXXXX)"
trap 'rm -f "$TMP"' EXIT

# Paginated fetch: drive it from Python (single interpreter,
# single GraphQL query with cursors). This keeps the shell
# simple and lets us both paginate and validate top-level
# `errors` / `pullRequest: null` before proceeding.
#
# We still capture a shell-side exit code so `set -e` does
# not swallow the "fetch failed" diagnostic path.
set +e
REPO_OWNER="$REPO_OWNER" REPO_NAME="$REPO_NAME" PR="$PR" python3 - <<'PY' > "$TMP"
import json, os, subprocess, sys

OWNER = os.environ['REPO_OWNER']
NAME  = os.environ['REPO_NAME']
PR    = int(os.environ['PR'])

QUERY = """
query($owner: String!, $name: String!, $number: Int!,
      $threadsAfter: String, $commentsAfter: String, $reviewsAfter: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      number
      title
      author { login }
      state
      createdAt
      mergedAt
      closedAt
      headRefName
      baseRefName
      body
      reviewThreads(first: 100, after: $threadsAfter) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          path
          line
          originalLine
          comments(first: 100) {
            pageInfo { hasNextPage endCursor }
            nodes {
              author { login }
              body
              createdAt
              updatedAt
            }
          }
        }
      }
      reviews(first: 50, after: $reviewsAfter) {
        pageInfo { hasNextPage endCursor }
        nodes {
          author { login }
          state
          body
          submittedAt
        }
      }
      comments(first: 100, after: $commentsAfter) {
        pageInfo { hasNextPage endCursor }
        nodes {
          author { login }
          body
          createdAt
        }
      }
    }
  }
}
"""

THREAD_COMMENTS_QUERY = """
query($threadId: ID!, $after: String) {
  node(id: $threadId) {
    ... on PullRequestReviewThread {
      comments(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          author { login }
          body
          createdAt
          updatedAt
        }
      }
    }
  }
}
"""

def gh_graphql(query, variables):
    """Invoke gh api graphql and return parsed JSON or raise."""
    cmd = ["gh", "api", "graphql", "-f", f"query={query}"]
    for k, v in variables.items():
        if v is None:
            # gh treats -F with empty string as null; for explicit null
            # we omit — GraphQL default for unspecified variable is null.
            continue
        if isinstance(v, int):
            cmd.extend(["-F", f"{k}={v}"])
        else:
            cmd.extend(["-f", f"{k}={v}"])
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        sys.stderr.write(
            f"gh api graphql failed (exit {proc.returncode}):\n{proc.stderr}\n"
        )
        sys.exit(2)
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"non-JSON response from gh api graphql: {e}\n")
        sys.stderr.write(proc.stdout[:2000] + "\n")
        sys.exit(2)
    if data.get("errors"):
        sys.stderr.write("GraphQL errors:\n")
        sys.stderr.write(json.dumps(data["errors"], indent=2) + "\n")
        sys.exit(2)
    return data

# First page.
first = gh_graphql(QUERY, {
    "owner": OWNER, "name": NAME, "number": PR,
})
repo = (first.get("data") or {}).get("repository") or {}
pr = repo.get("pullRequest")
if pr is None:
    sys.stderr.write(
        f"pullRequest is null for {OWNER}/{NAME}#{PR} "
        "(not found, private, or access denied).\n"
    )
    sys.exit(2)

# Accumulate nodes across pages. Simple loop per connection.
def paginate_top_level(key_chain, variable_name):
    """Walk connections rooted at pullRequest.<key>."""
    all_nodes = list(pr[key_chain]["nodes"])
    page = pr[key_chain]["pageInfo"]
    cursor = page["endCursor"] if page["hasNextPage"] else None
    while cursor:
        vars_ = {"owner": OWNER, "name": NAME, "number": PR, variable_name: cursor}
        page_data = gh_graphql(QUERY, vars_)
        page_pr = (
            (page_data.get("data") or {}).get("repository") or {}
        ).get("pullRequest")
        if page_pr is None:
            break
        conn = page_pr[key_chain]
        all_nodes.extend(conn["nodes"])
        page = conn["pageInfo"]
        cursor = page["endCursor"] if page["hasNextPage"] else None
    return all_nodes

threads = paginate_top_level("reviewThreads", "threadsAfter")
reviews = paginate_top_level("reviews", "reviewsAfter")
comments = paginate_top_level("comments", "commentsAfter")

# For each thread, paginate its comments connection.
for t in threads:
    conn = t.get("comments") or {}
    nodes = list(conn.get("nodes") or [])
    pi = conn.get("pageInfo") or {}
    cursor = pi.get("endCursor") if pi.get("hasNextPage") else None
    while cursor:
        page = gh_graphql(THREAD_COMMENTS_QUERY, {"threadId": t["id"], "after": cursor})
        node = (page.get("data") or {}).get("node") or {}
        cc = node.get("comments") or {}
        nodes.extend(cc.get("nodes") or [])
        pi2 = cc.get("pageInfo") or {}
        cursor = pi2.get("endCursor") if pi2.get("hasNextPage") else None
    t["comments"] = {"nodes": nodes}

# Reshape into the same envelope older code expects.
pr["reviewThreads"] = {"nodes": threads}
pr["reviews"] = {"nodes": reviews}
pr["comments"] = {"nodes": comments}

json.dump({"data": {"repository": {"pullRequest": pr}}}, sys.stdout)
PY
FETCH_RC=$?
set -e

if [ "$FETCH_RC" -ne 0 ]; then
  echo "fetch failed for PR #$PR (exit $FETCH_RC)" >&2
  exit 2
fi

export TMP

# Validate JSON parseability AND that pullRequest is non-null.
# Guards against malformed output or upstream GraphQL nulls
# that would otherwise crash the formatter with a cryptic
# TypeError. TMP must be exported (above) so the heredoc-run
# Python interpreter sees it.
if ! TMP="$TMP" python3 - <<'PY'
import json, os, sys
with open(os.environ['TMP']) as f:
    d = json.load(f)
pr = ((d.get('data') or {}).get('repository') or {}).get('pullRequest')
if pr is None:
    sys.exit(2)
PY
then
  echo "fetch failed for PR #$PR (invalid JSON or pullRequest: null):" >&2
  head -20 "$TMP" >&2
  exit 2
fi

PR_JSON_PATH="$TMP" python3 <<'PY'
import json, os, re, sys, datetime

with open(os.environ['PR_JSON_PATH']) as f:
    d = json.load(f)

# Defensive: we already validated upstream, but keep the
# guards so this script is also safe to re-run against a
# saved TMP file.
repo = (d.get('data') or {}).get('repository') or {}
pr = repo.get('pullRequest')
if pr is None:
    sys.stderr.write("pullRequest missing in JSON — aborting formatter.\n")
    sys.exit(2)

title = pr.get('title', 'untitled')
number = pr.get('number')

slug = re.sub(r'[^a-zA-Z0-9]+', '-', title).strip('-').lower()
slug = slug[:60].strip('-') or 'untitled'

out_dir = os.path.join(os.environ['REPO_ROOT'], 'docs', 'pr-discussions')
os.makedirs(out_dir, exist_ok=True)
# Zero-pad to 4 digits — aligns with README's documented
# filename shape (e.g. PR-0357-...). Sorts lexicographically
# == numerically for PR #0001..#9999.
#
# Idempotency: the PR number is the canonical key. If an
# archive for this PR already exists (any slug), reuse its
# path so title edits update in place rather than orphaning
# the old slug. Only when there is no prior archive do we
# mint a new `PR-<NNNN>-<slug>.md` file.
import glob as _glob
existing = sorted(_glob.glob(os.path.join(out_dir, f'PR-{number:04d}-*.md')))
if existing:
    # Reuse the first match (deterministic by sort). If
    # somehow multiple stale files exist for the same PR
    # number, we overwrite the earliest-sorting one and
    # leave the rest untouched — operator can clean up by
    # hand; refusing to silently delete preserves audit.
    path = existing[0]
else:
    path = os.path.join(out_dir, f'PR-{number:04d}-{slug}.md')

archived_at = datetime.datetime.utcnow().isoformat(timespec='seconds') + 'Z'

def yaml_quote(s):
    """Quote YAML string values safely. json.dumps gives us
    double-quoted strings with escaping; valid YAML too."""
    return json.dumps('' if s is None else str(s))

lines = []
lines.append('---')
lines.append(f'pr_number: {number}')
lines.append(f'title: {yaml_quote(title)}')
lines.append(f'author: {yaml_quote((pr.get("author") or {}).get("login") or "unknown")}')
lines.append(f'state: {yaml_quote(pr.get("state"))}')
lines.append(f'created_at: {yaml_quote(pr.get("createdAt") or "")}')
if pr.get('mergedAt'):
    lines.append(f'merged_at: {yaml_quote(pr.get("mergedAt"))}')
if pr.get('closedAt'):
    lines.append(f'closed_at: {yaml_quote(pr.get("closedAt"))}')
lines.append(f'head_ref: {yaml_quote(pr.get("headRefName") or "")}')
lines.append(f'base_ref: {yaml_quote(pr.get("baseRefName") or "")}')
lines.append(f'archived_at: {yaml_quote(archived_at)}')
lines.append(f'archive_tool: {yaml_quote("tools/pr-preservation/archive-pr.sh")}')
lines.append('---')
lines.append('')
lines.append(f'# PR #{number}: {title}')
lines.append('')

body = pr.get('body') or ''
if body.strip():
    lines.append('## PR description')
    lines.append('')
    # Preserve trailing whitespace on the last line (markdown two-space
    # hard-line-break); only strip trailing newlines so the next
    # section header is spaced correctly.
    lines.append(body.rstrip('\n'))
    lines.append('')

reviews = (pr.get('reviews') or {}).get('nodes', [])
if reviews:
    lines.append('## Reviews')
    lines.append('')
    for r in reviews:
        author = (r.get('author') or {}).get('login') or 'unknown'
        state = r.get('state') or 'COMMENTED'
        submitted = r.get('submittedAt') or ''
        # Preserve leading whitespace: only strip trailing newlines.
        # Indented code blocks / nested bullets in review bodies must
        # survive the archive round-trip.
        body_text = (r.get('body') or '').rstrip('\n')
        lines.append(f'### {state} — @{author} ({submitted})')
        lines.append('')
        lines.append(body_text if body_text.strip() else '_(no body)_')
        lines.append('')

threads = (pr.get('reviewThreads') or {}).get('nodes', [])
if threads:
    lines.append('## Review threads')
    lines.append('')
    for i, t in enumerate(threads, 1):
        path_ref = t.get('path') or '(no path)'
        line_num = t.get('line') or t.get('originalLine') or '?'
        resolved = 'resolved' if t.get('isResolved') else 'unresolved'
        lines.append(f'### Thread {i}: {path_ref}:{line_num} ({resolved})')
        lines.append('')
        for c in (t.get('comments') or {}).get('nodes', []):
            author = (c.get('author') or {}).get('login') or 'unknown'
            when = c.get('createdAt') or ''
            # Preserve leading whitespace: only strip trailing newlines
            # so indented code blocks in review-thread comments survive.
            body_text = (c.get('body') or '').rstrip('\n')
            lines.append(f'**@{author}** ({when}):')
            lines.append('')
            lines.append(body_text)
            lines.append('')

comments = (pr.get('comments') or {}).get('nodes', [])
if comments:
    lines.append('## General comments')
    lines.append('')
    for c in comments:
        author = (c.get('author') or {}).get('login') or 'unknown'
        when = c.get('createdAt') or ''
        # Preserve leading whitespace: only strip trailing newlines so
        # indented code blocks in general PR comments survive.
        body_text = (c.get('body') or '').rstrip('\n')
        lines.append(f'### @{author} ({when})')
        lines.append('')
        lines.append(body_text)
        lines.append('')

# Preserve trailing whitespace on user-authored text:
# markdown uses two trailing spaces as a hard-line-break,
# and this tool's purpose is a faithful audit copy.
# Only strip trailing newlines at end-of-file (not spaces),
# so an end-of-file hard-line-break survives.
content = '\n'.join(lines).rstrip('\n') + '\n'
# We DO collapse runs of 3+ consecutive blank lines down
# to 2 so markdownlint MD012 stays green on the generated
# archives (the source content sometimes has 3+ blank
# lines around <details> blocks).
# We ALSO normalize whitespace-only lines (e.g. '    ' from
# Codex connector comments) to empty so they do not trip
# markdownlint MD009. A line containing only spaces/tabs
# has no meaningful trailing whitespace to preserve — it
# cannot be a hard-line-break since there is no preceding
# text on the same line. Lines with any non-whitespace
# character keep their trailing whitespace intact.
#
# Codex P1 audit-fidelity carve-out (PR #357 thread on
# blank-line collapse): inside fenced code blocks (```),
# user-authored content must survive verbatim — fenced
# blocks are where 3+ consecutive blank lines are
# intentional (logs, templates, preformatted output),
# and markdownlint MD012 already exempts fenced code
# from the "no multiple consecutive blank lines" rule
# by design. So we toggle code-fence state as we scan
# and skip the collapse + whitespace-only normalization
# inside fenced regions. Outside fences, MD012/MD009
# hygiene still applies to tool-generated scaffolding.
collapsed = []
blank_run = 0
in_fence = False
fence_marker = None  # '`' or '~' — opener type must match closer
fence_length = 0     # opener run length — closer must be >= this
for raw_line in content.split('\n'):
    # Detect fenced-code-block boundaries (``` or ~~~ at
    # the start of a line, ignoring leading whitespace).
    # Per CommonMark §4.5:
    #   - Closing fence must use the SAME marker character
    #     as the opener (backticks close backticks;
    #     tildes close tildes).
    #   - Closing fence must be AT LEAST AS LONG as the
    #     opener. An opener of 4 backticks needs a
    #     closer of 4+ backticks; 3 backticks inside a
    #     4-backtick fence is content, not a closer.
    #     This is how CommonMark lets you nest fences —
    #     a longer opener contains shorter fence-shaped
    #     lines as literal content.
    # Per CommonMark §4.5: opening fence permits up to 3
    # *spaces* of indentation. 4+ spaces makes the line an
    # indented-code-block, not a fence. Tabs are NOT space-
    # equivalent here — a tab pushes column >= 4 = indented-
    # code-block territory, and a tab-indented fence-shaped
    # line is content, not a fence. Count literal leading
    # spaces only (lstrip(' '), not bare lstrip() which would
    # also consume tabs), enforce the <= 3 cap, AND reject any
    # tab in the prefix.
    leading_space_count = len(raw_line) - len(raw_line.lstrip(' '))
    leading_chars = raw_line[:leading_space_count]
    after_spaces = raw_line[leading_space_count:]
    marker = None
    marker_len = 0
    if leading_space_count <= 3 and '\t' not in leading_chars:
        if after_spaces.startswith('```'):
            marker = '`'
            marker_len = len(after_spaces) - len(after_spaces.lstrip('`'))
        elif after_spaces.startswith('~~~'):
            marker = '~'
            marker_len = len(after_spaces) - len(after_spaces.lstrip('~'))
    if marker is not None:
        if not in_fence:
            # Opening fence: record marker + length so the
            # closer can be matched strictly.
            in_fence = True
            fence_marker = marker
            fence_length = marker_len
            blank_run = 0
            collapsed.append(raw_line)
            continue
        if marker == fence_marker and marker_len >= fence_length:
            # Closing fence: same marker, length >= opener.
            in_fence = False
            fence_marker = None
            fence_length = 0
            blank_run = 0
            collapsed.append(raw_line)
            continue
        # Fence-shaped line that isn't a valid closer
        # (wrong marker, or shorter than the opener):
        # fall through to the in_fence verbatim branch
        # so the line is preserved as content without
        # flipping state.
    if in_fence:
        # Inside a fenced block: preserve verbatim.
        # No whitespace-only normalization, no blank-run
        # collapse. This is the audit-fidelity path.
        collapsed.append(raw_line)
        continue
    # Outside fences: normalize whitespace-only lines to empty
    # without touching inline trailing whitespace on lines
    # that contain text.
    if raw_line and raw_line.strip() == '':
        raw_line = ''
    if raw_line == '':
        blank_run += 1
    else:
        blank_run = 0
    if blank_run <= 2:
        collapsed.append(raw_line)
content = '\n'.join(collapsed).rstrip('\n') + '\n'
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print(f'wrote {path} ({len(content)} bytes, {len(threads)} threads, {len(reviews)} reviews, {len(comments)} comments)')
PY
