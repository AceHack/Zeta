#!/usr/bin/env python3
"""
tools/hygiene/sort-tick-history-canonical.py — sort + dedupe
docs/hygiene-history/loop-tick-history.md to canonical chronological
order.

Why this exists (Aaron 2026-04-26):
    "maybe this should be substraite built in instead of dynamic python"

I had been doing the canonical-order sort via inline `python3 << PYEOF`
heredocs each time the rebase / one-case-Otto-229-override needed
applying. That's the wrong shape — the sort logic is structural, not
ad-hoc. It belongs as a tool checked into substrate per Otto-341
(mechanism over vigilance).

What this does:
- Reads `docs/hygiene-history/loop-tick-history.md`
- Identifies the data-rows region (after the schema separator)
- Extracts each row's ISO-8601 timestamp prefix
- Stably sorts rows by (timestamp, original_position)
- Removes exact-content duplicates
- Writes the canonical-order file back
- Prints a summary

Composes with:
- tools/hygiene/check-tick-history-order.sh (the detection check;
  this script is the fix)
- Otto-229 (append-only tick-history; one-case override authorized
  for canonical-order preservation since git history retains prior
  state)
- Otto-341 (mechanism over vigilance; tools/hygiene/ is the canonical
  home for substrate-integrity tooling)

Usage:
    python3 tools/hygiene/sort-tick-history-canonical.py [--dry-run]

    Default: writes changes back to the file.
    --dry-run: prints what would change; does not modify the file.

Exit codes:
    0 — sort + dedupe applied (or no changes needed)
    1 — error (file not found, malformed)
    2 — argument error
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path


def repo_root() -> Path | None:
    """Resolve the repo root via `git rev-parse --show-toplevel`.

    Mirrors sibling hygiene scripts so that running this tool from a
    subdirectory still resolves the default `--file` correctly. Returns
    None if not in a git repo (caller falls back to CWD)."""
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            check=True,
        )
        return Path(out.stdout.strip())
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def find_separator_line(lines: list[str]) -> int | None:
    """Return the line index of the markdown table separator (last
    occurrence — the file has a sample schema row earlier in prose)."""
    sep_idx = None
    sep_pattern = re.compile(r"^\|[-|\s]+\|$")
    for i, line in enumerate(lines):
        if sep_pattern.match(line.strip()):
            sep_idx = i
    return sep_idx


def get_timestamp(line: str) -> str | None:
    """Return ISO-8601 timestamp prefix from a data row, or None
    if the line is not a data row.

    Handles two formats:
    - Full: `| 2026-04-26T03:38:42Z (...)` — direct timestamp
    - Placeholder: `| 2026-04-22T (round-44 tick, ...)` — date-only,
      treated as 00:00:00Z for sort purposes
    """
    m = re.match(r"^\| (\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})Z?", line)
    if m:
        return f"{m.group(1)}T{m.group(2)}Z"
    m = re.match(r"^\| (\d{4}-\d{2}-\d{2})T ", line)
    if m:
        return f"{m.group(1)}T00:00:00Z"
    return None


def sort_canonical(text: str) -> tuple[str, dict]:
    """Sort + dedupe data rows in tick-history content.

    Returns (new_text, stats_dict). stats_dict has keys:
    - rows_in: int — data rows found
    - rows_out: int — unique rows written back
    - duplicates_removed: int
    - reordered: bool — whether row order changed
    """
    lines = text.split("\n")
    sep_idx = find_separator_line(lines)
    if sep_idx is None:
        raise ValueError("No markdown table separator found in tick-history file")

    header = lines[: sep_idx + 1]
    data = lines[sep_idx + 1 :]

    # File-line offset for converting post-separator indices into
    # 1-based file line numbers in error diagnostics. Reviewer P2:
    # 0-based post-separator indices were confusing; the user wants
    # to grep / open-at-line, not arithmetic in their head.
    sep_file_line = sep_idx + 1  # 1-based line number of separator

    data_rows: list[tuple[str, int, str]] = []
    unmatched_table_rows: list[tuple[int, str]] = []
    for original_index, line in enumerate(data):
        if not line.strip():
            continue
        ts = get_timestamp(line)
        if ts:
            data_rows.append((ts, original_index, line))
        elif line.lstrip().startswith("|"):
            # Looks like a table row but no timestamp matched —
            # schema drift or malformed row. Refuse to silently drop;
            # caller decides whether to fail or skip after seeing
            # the count.
            unmatched_table_rows.append((original_index, line))

    rows_in = len(data_rows)
    original_order = [line for _, _, line in data_rows]

    # Trailing non-row content after the table — anything that isn't
    # blank and isn't a table row must be preserved (Codex P2 finding:
    # naive header+rows reconstruction would lose trailing prose).
    # Find the index of the last table-shaped line (matched OR
    # unmatched); everything after that index is trailing content.
    trailing_lines: list[str] = []
    table_indices = sorted(
        [idx for _, idx, _ in data_rows]
        + [idx for idx, _ in unmatched_table_rows]
    )
    if table_indices:
        last_table_idx = table_indices[-1]
        # Trailing = lines AFTER the last table-row. Strip leading
        # blank-line separator(s) so the reconstructed file gets a
        # single canonical blank between table-end and prose-start.
        trailing_candidate = data[last_table_idx + 1 :]
        first_non_blank = next(
            (i for i, line in enumerate(trailing_candidate) if line.strip()),
            len(trailing_candidate),
        )
        if first_non_blank < len(trailing_candidate):
            trailing_lines = trailing_candidate[first_non_blank:]

    # P0 guard: if the data region has table-shaped lines but zero
    # match the timestamp regex, the schema has drifted and the
    # naive write-back would wipe the table. Refuse.
    if rows_in == 0 and unmatched_table_rows:
        first_orig = unmatched_table_rows[0][0]
        raise ValueError(
            f"schema drift: {len(unmatched_table_rows)} table-shaped row(s) "
            f"found but ZERO matched the ISO-8601 timestamp regex. "
            f"Refusing to write — would wipe tick-history. "
            f"First unmatched row at file-line "
            f"{sep_file_line + 1 + first_orig}: "
            f"{unmatched_table_rows[0][1][:120]}"
        )

    # P1 guard: any unmatched table row is a discipline violation;
    # silently dropping rows is exactly the failure mode this script
    # is supposed to prevent. Surface and refuse.
    if unmatched_table_rows:
        first = unmatched_table_rows[0]
        raise ValueError(
            f"refusing to drop {len(unmatched_table_rows)} unmatched "
            f"table row(s); per Otto-229 (append-only discipline) the "
            f"sort tool must not silently lose rows. "
            f"First unmatched at file-line "
            f"{sep_file_line + 1 + first[0]}: {first[1][:120]}"
        )

    # Stable sort by (timestamp, original_index) so ties preserve
    # input order. ISO-8601 strings sort lex == chronological.
    data_rows.sort(key=lambda x: (x[0], x[1]))

    seen: set[str] = set()
    unique_rows: list[str] = []
    for _, _, line in data_rows:
        if line in seen:
            continue
        seen.add(line)
        unique_rows.append(line)

    # Reconstruct: header + sorted-rows + (blank-line separator +
    # trailing prose if any). Without trailing-content preservation
    # the naive header + rows reconstruction would silently drop any
    # post-table prose paragraph (Codex P2 finding). The blank-line
    # separator between table-end and trailing-content is required by
    # CommonMark to terminate the table and start a new block.
    parts = ["\n".join(header), "\n".join(unique_rows)]
    if trailing_lines:
        parts.append("")  # explicit blank-line separator
        parts.append("\n".join(trailing_lines))
    new_text = "\n".join(parts) + "\n"
    rows_out = len(unique_rows)
    reordered = unique_rows != original_order[: len(unique_rows)] or rows_out != rows_in

    return new_text, {
        "rows_in": rows_in,
        "rows_out": rows_out,
        "duplicates_removed": rows_in - rows_out,
        "reordered": reordered,
        "trailing_lines_preserved": len(trailing_lines),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Sort tick-history.md to canonical chronological order"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would change; do not write to the file",
    )
    parser.add_argument(
        "--file",
        default="docs/hygiene-history/loop-tick-history.md",
        help="Path to tick-history file (relative paths resolve to repo "
             "root via 'git rev-parse --show-toplevel'; if not in a git "
             "checkout, falls back to current working directory)",
    )
    args = parser.parse_args(argv)

    # Resolve --file relative to repo root when it is a relative path,
    # so the tool works the same whether invoked from repo root or any
    # subdirectory. Sibling hygiene scripts share this convention.
    p = Path(args.file)
    if not p.is_absolute():
        root = repo_root()
        if root is not None:
            p = root / args.file
    if not p.exists():
        print(f"ERROR: file not found: {p}", file=sys.stderr)
        return 1

    original = p.read_text()
    try:
        new_text, stats = sort_canonical(original)
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print(f"rows_in:            {stats['rows_in']}")
    print(f"rows_out:           {stats['rows_out']}")
    print(f"duplicates_removed: {stats['duplicates_removed']}")
    print(f"reordered:          {stats['reordered']}")

    if new_text == original:
        print("OK: file already in canonical order; no changes")
        return 0

    if args.dry_run:
        print("DRY RUN: would write changes; --dry-run prevented")
        return 0

    p.write_text(new_text)
    print(f"WROTE {p} ({len(original)} -> {len(new_text)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
