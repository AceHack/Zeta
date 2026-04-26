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
import sys
from pathlib import Path


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

    data_rows: list[tuple[str, int, str]] = []
    for original_index, line in enumerate(data):
        if not line.strip():
            continue
        ts = get_timestamp(line)
        if ts:
            data_rows.append((ts, original_index, line))

    rows_in = len(data_rows)
    original_order = [line for _, _, line in data_rows]

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

    new_text = "\n".join(header) + "\n" + "\n".join(unique_rows) + "\n"
    rows_out = len(unique_rows)
    reordered = unique_rows != original_order[: len(unique_rows)] or rows_out != rows_in

    return new_text, {
        "rows_in": rows_in,
        "rows_out": rows_out,
        "duplicates_removed": rows_in - rows_out,
        "reordered": reordered,
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
        help="Path to tick-history file (relative to repo root)",
    )
    args = parser.parse_args(argv)

    p = Path(args.file)
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
