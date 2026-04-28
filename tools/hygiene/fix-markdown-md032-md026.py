#!/usr/bin/env python3
"""
tools/hygiene/fix-markdown-md032-md026.py — mechanical fix for two
markdownlint violations:

- MD032 (blanks-around-lists): inserts blank lines before/after list
  blocks where they're missing
- MD026 (no-trailing-punctuation): strips trailing `:` `!` `?` from
  ATX headings

Why this exists (Aaron 2026-04-26):
    "in python shape should be a queue that we are missing substraight
     primitives"

I'd been carrying this fix as `/tmp/md_fix.py` and re-typing it
across multiple drain ticks. Per Otto-346 principle (recurring
dynamic Python = signal a substrate primitive is missing), the
right home is `tools/hygiene/` checked into substrate. This tool
is the formalized version of the recurring pattern.

Usage:
    python3 tools/hygiene/fix-markdown-md032-md026.py FILE [FILE ...]
    python3 tools/hygiene/fix-markdown-md032-md026.py --dry-run FILE

Always idempotent: running on already-clean file is no-op.

Composes with:
- markdownlint-cli2 (.github/workflows/gate.yml lint-markdown job)
  — this tool produces input the linter accepts; the linter is the
  detection check
- Otto-341 (mechanism over discipline; markdownlint discipline
  becomes mechanism via this tool)
- Otto-346 candidate (recurring dynamic = missing primitive;
  this tool IS the primitive that absorbs the recurring pattern)
"""

import argparse
import re
import sys
from pathlib import Path


# All four CommonMark unordered list markers (`-`, `*`, `+`) plus
# ordered (`\d+\.`). markdownlint MD004 is disabled in this repo, so
# alternate markers do appear in committed files.
_LIST_LINE = re.compile(r"^(  )*([-*+] |\d+\. )")
_INDENTED_LINE = re.compile(r"^  +\S")

# MD026 strips trailing punctuation from ATX headings. markdownlint's
# default `punctuation` setting is `.,;:!?` (excluding `?` is configurable
# but we strip it here since the original tool stripped it). Allow
# optional trailing whitespace after the punctuation so headings like
# `## Title:   ` are still cleaned (the original regex required EOL
# immediately after the punctuation).
_HEADING_WITH_PUNCT = re.compile(r"^(#+ .+?)([.,;:!?]+)\s*$")

# Fenced-code-block delimiters. CommonMark allows ``` or ~~~ (3+ chars)
# at the start of a line (with optional info string after). Tilde and
# backtick fences cannot interrupt each other — track which fence opened.
_FENCE_OPEN = re.compile(r"^( {0,3})(`{3,}|~{3,})\s*([^`]*)$")


def _is_list_or_continuation(line: str) -> bool:
    """Return True if line is a list item or its continuation
    (indented paragraph under a list item)."""
    return bool(_LIST_LINE.match(line) or _INDENTED_LINE.match(line))


def _is_list(line: str) -> bool:
    """Return True if line starts a list item."""
    return bool(_LIST_LINE.match(line))


def _classify_lines(lines: list[str]) -> list[bool]:
    """Return a boolean list `inside[i]` = True iff line `i` is inside
    a fenced code block (and therefore must NOT be touched by the
    MD032/MD026 transforms — that would mutate code examples).

    A code fence is a line starting with 3+ backticks or 3+ tildes;
    closing fence must be the same character class as the opener and
    have at least as many characters. We only track the simple case
    sufficient for committed-markdown shapes; nested or weird
    indentation (>3 spaces makes it a code-indent rather than a fence)
    is conservatively treated as "inside" once opened until matching
    close — better to skip transforms than to corrupt code."""
    inside: list[bool] = []
    open_char: str | None = None  # '`' or '~'
    open_len: int = 0
    for line in lines:
        m = _FENCE_OPEN.match(line)
        if m and open_char is None:
            # Opening fence
            fence = m.group(2)
            open_char = fence[0]
            open_len = len(fence)
            inside.append(True)
        elif m and open_char is not None:
            # Possible closing fence — must be same char class and
            # length >= open_len, with no info string.
            fence = m.group(2)
            if fence[0] == open_char and len(fence) >= open_len and not m.group(3).strip():
                inside.append(True)  # The closing fence line itself
                open_char = None
                open_len = 0
            else:
                # A different fence char or shorter — still inside the
                # outer block (it's just code that looks fence-shaped).
                inside.append(True)
        else:
            inside.append(open_char is not None)
    return inside


def fix_md032(text: str) -> str:
    """Insert blank lines before list blocks (where the previous
    line is non-blank and not itself a list/continuation) and after
    list blocks (where the next line is non-blank and not part of
    the list).

    Skips lines inside fenced code blocks — inserting blanks there
    would mutate code examples (e.g. shell-script with `- option`
    flags would acquire spurious blanks)."""
    lines = text.split("\n")
    inside = _classify_lines(lines)

    # Pass 1: insert blank line BEFORE a list when previous is a
    # non-list, non-blank line. The boolean state needs to survive the
    # output mutation, so we map indices via the input position.
    out: list[str] = []
    out_inside: list[bool] = []
    for i, line in enumerate(lines):
        if not inside[i] and _is_list(line) and out:
            prev = out[-1]
            prev_inside = out_inside[-1]
            if prev.strip() and not prev_inside and not _is_list_or_continuation(prev):
                out.append("")
                out_inside.append(False)
        out.append(line)
        out_inside.append(inside[i])

    # Pass 2: insert blank line AFTER a list-item when next is a
    # non-list, non-blank line.
    out2: list[str] = []
    for i, line in enumerate(out):
        out2.append(line)
        if not out_inside[i] and _is_list(line) and i + 1 < len(out):
            nxt = out[i + 1]
            nxt_inside = out_inside[i + 1]
            if nxt.strip() and not nxt_inside and not _is_list_or_continuation(nxt):
                out2.append("")

    return "\n".join(out2)


def fix_md026(text: str) -> str:
    """Strip trailing `.` `,` `;` `:` `!` `?` punctuation (with optional
    trailing whitespace) from ATX heading lines (matches `^#+ ...`).

    Skips lines inside fenced code blocks — `# heading-shaped` lines
    inside code are content, not headings."""
    lines = text.split("\n")
    inside = _classify_lines(lines)
    out: list[str] = []
    for i, line in enumerate(lines):
        if inside[i]:
            out.append(line)
            continue
        m = _HEADING_WITH_PUNCT.match(line)
        if m:
            out.append(m.group(1))
        else:
            out.append(line)
    return "\n".join(out)


class FileNotFoundForFix(Exception):
    """Raised when an input file is missing — distinguishes from
    'no changes needed' so main() can exit non-zero."""


def fix_file(path: Path, dry_run: bool = False) -> tuple[bool, int]:
    """Apply both fixes to a file. Returns (changed, bytes_diff).

    Raises FileNotFoundForFix if the path does not exist, so the
    caller can distinguish missing-file (real error, exit non-zero)
    from clean-no-op (silent success)."""
    if not path.exists():
        raise FileNotFoundForFix(str(path))
    original = path.read_text()
    fixed = fix_md026(fix_md032(original))
    if fixed == original:
        return False, 0
    if not dry_run:
        path.write_text(fixed)
    return True, len(fixed) - len(original)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Fix markdownlint MD032 + MD026 violations mechanically"
    )
    parser.add_argument("files", nargs="+", help="Markdown files to fix")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would change; do not modify files",
    )
    args = parser.parse_args(argv)

    any_changed = False
    any_error = False
    for f in args.files:
        path = Path(f)
        try:
            changed, byte_diff = fix_file(path, dry_run=args.dry_run)
        except FileNotFoundForFix as exc:
            print(f"ERROR: file not found: {exc}", file=sys.stderr)
            any_error = True
            continue
        if changed:
            any_changed = True
            verb = "WOULD FIX" if args.dry_run else "FIXED"
            sign = "+" if byte_diff >= 0 else ""
            print(f"{verb} {path} ({sign}{byte_diff} bytes)")

    if any_error:
        # Suppress the misleading OK message when any input failed.
        return 1
    if not any_changed:
        print("OK: no changes needed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
