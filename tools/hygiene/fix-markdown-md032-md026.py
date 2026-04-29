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

# YAML frontmatter line discriminator: matches a non-empty line that
# starts with a key followed by `:` (with optional leading whitespace
# and optional value). Examples that match: `id: B-0001`, `tags:`,
# `composes_with:`. YAML list items like `  - item` are intentionally
# NOT matched here; the discriminator only needs a simple `key:` check
# because the very-first content line of a real frontmatter should be
# a key:value, not a list item. List items + indented continuation
# lines are handled separately in the ratio check via the
# `_is_yaml_continuation` helper below.
_YAML_KEY_LINE = re.compile(r"^\s*[A-Za-z_][\w-]*\s*:")


def _is_yaml_continuation(line: str) -> bool:
    """Return True if a line plausibly continues a YAML key's value:
    indented continuation (>= 2 spaces or tab) of any non-blank
    content. Does NOT match column-0 lines (those should be either
    blank, a new key, or non-frontmatter content).

    Critically: this does NOT count `- item` at column 0 as
    continuation. A column-0 `- item` is almost always a markdown
    list, not a YAML list item under a parent key. YAML list items
    appear with leading indent (`  - X`); the leading indent is
    what disambiguates them.

    Used by the frontmatter-detection ratio check to count
    indented-continuation lines toward the "YAML-shaped majority"
    threshold without double-counting markdown list items as
    YAML."""
    if not line.strip():
        return False  # blank lines counted separately
    return line.startswith(("  ", "\t"))


def _is_list_or_continuation(line: str) -> bool:
    """Return True if line is a list item or its continuation
    (indented paragraph under a list item)."""
    return bool(_LIST_LINE.match(line) or _INDENTED_LINE.match(line))


def _is_list(line: str) -> bool:
    """Return True if line starts a list item."""
    return bool(_LIST_LINE.match(line))


def _classify_lines(lines: list[str]) -> list[bool]:
    """Return a boolean list `inside[i]` = True iff line `i` is inside
    a region that must NOT be touched by the MD032/MD026 transforms.

    Two such regions:

    1. **YAML frontmatter** (Jekyll/Hugo/factory-convention shape):
       file starts with a line `---`, line 1 is YAML-shaped
       (matches `key:` at start), and a closing `---` exists later.
       Lines from line 0 through the closing `---` are frontmatter.
       Inserting blanks here breaks YAML parsing (e.g.
       `composes_with:` followed by blank line then `  - X` parses
       as `composes_with: null` plus a separate top-level list).
       MD026 would only affect frontmatter if a YAML-key line
       happened to match the ATX-heading pattern (`^#+ `) — which
       it can't, since YAML keys don't start with `#`. So the YAML
       risk is concentrated in MD032's blank-insertion behavior,
       and the frontmatter-skip protects that.

    2. **Fenced code blocks**: a line starting with 3+ backticks or
       3+ tildes; closing fence must be the same character class as
       the opener and have at least as many characters. Inserting
       blanks here would mutate code examples (e.g. shell-script
       with `- option` flags would acquire spurious blanks).

    Both regions are conservatively treated as "inside" so transforms
    skip them. Better to skip than to corrupt structure.

    YAML frontmatter detection is conservative — must distinguish
    real frontmatter from a markdown file that happens to start with
    a thematic break (`---` followed by content):

      Real frontmatter:  line 0 is `---`,
                         line 1 looks YAML-shaped (`key: value` or `key:`),
                         a closing `---` exists later.
      Thematic break:    line 0 is `---`,
                         line 1 is markdown body (heading / prose / etc.).

    The YAML-shape check on line 1 is the discriminator. Without it,
    a file starting with a horizontal rule would have all subsequent
    content marked as "inside frontmatter," skipping every list and
    heading from being processed.

    Files without frontmatter (line 0 not `---`, or line 1 not
    YAML-shaped, or no closing `---`) skip the frontmatter region
    entirely — pass-through to the fence-detection logic."""
    inside: list[bool] = [False] * len(lines)

    # Pass 1: YAML frontmatter region — only if all FIVE conditions:
    # (a) line 0 is exactly `---`
    # (b) line 1 is YAML-shaped (matches `key:` at start, ignoring
    #     leading whitespace)
    # (c) a closing `---` line exists within the next 200 lines
    # (d) the line immediately BEFORE the closing `---` is YAML-
    #     shaped, blank, or a YAML continuation (catches the case
    #     where a closing `---` is just a thematic break — its
    #     preceding line is markdown prose, not a YAML key)
    # (e) at least 75% of non-blank lines BETWEEN the bookends are
    #     YAML-shaped (catches files where a single YAML-looking
    #     line appears after a thematic break, with a closing
    #     thematic break further down — typical "tip:" / "note:" /
    #     "warning:" prose patterns)
    #
    # The (b)/(d)/(e) checks together distinguish real frontmatter
    # from prose where `note: ...` happens to follow a thematic
    # break with another thematic break later. (c)'s 200-line cap
    # is defense-in-depth: real frontmatter is rarely >50 lines.
    _MAX_FRONTMATTER = 200
    _YAML_RATIO_MIN = 0.75
    if (
        len(lines) >= 2
        and lines[0].rstrip() == "---"
        and _YAML_KEY_LINE.match(lines[1])
    ):
        fm_end = -1
        for j in range(2, min(len(lines), _MAX_FRONTMATTER + 1)):
            if lines[j].rstrip() == "---":
                fm_end = j
                break
        if fm_end > 0:
            # Check (d): line immediately before closing `---` is
            # YAML-shaped, blank, or YAML continuation. (No need
            # for `if fm_end > 0` ternary — already in the
            # `if fm_end > 0:` block.)
            prev_line = lines[fm_end - 1]
            prev_ok = (
                not prev_line.strip()
                or _YAML_KEY_LINE.match(prev_line)
                or _is_yaml_continuation(prev_line)
            )
            # Check (e): YAML-shaped majority of non-blank lines.
            # Counts: `key:` lines (via _YAML_KEY_LINE) and
            # indented-continuation lines (via _is_yaml_continuation).
            # Does NOT count column-0 `- item` lines — those are
            # almost always markdown list items, not YAML, and
            # counting them would mis-classify ordinary markdown
            # documents (e.g. a thematic break + "note: ..." +
            # bullet list) as frontmatter.
            yaml_count = 0
            non_blank = 0
            for j in range(1, fm_end):
                if lines[j].strip():
                    non_blank += 1
                    if (
                        _YAML_KEY_LINE.match(lines[j])
                        or _is_yaml_continuation(lines[j])
                    ):
                        yaml_count += 1
            ratio_ok = (
                non_blank == 0
                or (yaml_count / non_blank) >= _YAML_RATIO_MIN
            )
            if prev_ok and ratio_ok:
                for k in range(fm_end + 1):  # inclusive of closing `---`
                    inside[k] = True
        # If conditions don't all hold, conservatively don't mark
        # any lines as frontmatter (treat as thematic break / body).

    # Pass 2: fenced code blocks (skip lines already marked
    # inside-frontmatter — they don't open / close fences).
    open_char: str | None = None  # '`' or '~'
    open_len: int = 0
    for i, line in enumerate(lines):
        if inside[i]:
            continue  # Already marked as frontmatter
        m = _FENCE_OPEN.match(line)
        if m and open_char is None:
            # Opening fence
            fence = m.group(2)
            open_char = fence[0]
            open_len = len(fence)
            inside[i] = True
        elif m and open_char is not None:
            # Possible closing fence — must be same char class and
            # length >= open_len, with no info string.
            fence = m.group(2)
            if fence[0] == open_char and len(fence) >= open_len and not m.group(3).strip():
                inside[i] = True  # The closing fence line itself
                open_char = None
                open_len = 0
            else:
                # A different fence char or shorter — still inside the
                # outer block (it's just code that looks fence-shaped).
                inside[i] = True
        else:
            inside[i] = open_char is not None
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
