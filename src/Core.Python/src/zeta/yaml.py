# yaml.py — Python port of custom config-friendly YAML events scanner.
import re
from typing import Any

INT_RE = re.compile(r"^-?[0-9]+$")
FLOAT_RE = re.compile(r"^-?[0-9]+\.[0-9]+([eE][-+]?[0-9]+)?$")

NULL_LITERALS = {"", "~", "null", "Null", "NULL"}
BOOL_LITERALS = {"true", "True", "TRUE", "false", "False", "FALSE"}
UNSUPPORTED_VALUE_START = {"&", "*", "!", "{", "[", "|", ">"}


class DeclineError(Exception):
    def __init__(self, feedback: str):
        super().__init__(feedback)
        self.feedback = feedback


def resolve_plain_kind(raw: str) -> str:
    if raw in NULL_LITERALS:
        return "Null"
    if raw in BOOL_LITERALS:
        return "Bool"
    if INT_RE.match(raw):
        return "Int"
    if FLOAT_RE.match(raw):
        return "Float"
    return "Str"


def is_space(ch: str) -> bool:
    return ch == " " or ch == "\t"


def left_trim(s: str) -> str:
    i = 0
    while i < len(s) and is_space(s[i]):
        i += 1
    return s[i:]


def strip_trailing_comment(token: str) -> str:
    for i in range(len(token)):
        if token[i] == "#" and i > 0 and is_space(token[i - 1]):
            return token[:i]
    return token


def decode_single_quoted(token: str) -> str:
    out: list[str] = []
    i = 1
    while i < len(token):
        ch = token[i]
        if ch == "'":
            if i + 1 < len(token) and token[i + 1] == "'":
                out.append("'")
                i += 2
                continue
            return "".join(out)
        out.append(ch)
        i += 1
    raise DeclineError("UnterminatedQuote")


def decode_double_quoted(token: str) -> str:
    out: list[str] = []
    i = 1
    while i < len(token):
        ch = token[i]
        if ch == '"':
            return "".join(out)
        if ch == "\\":
            if i + 1 >= len(token):
                raise DeclineError("UnterminatedQuote")
            next_ch = token[i + 1]
            if next_ch == "\\":
                out.append("\\")
            elif next_ch == '"':
                out.append('"')
            elif next_ch == "n":
                out.append("\n")
            elif next_ch == "t":
                out.append("\t")
            elif next_ch == "r":
                out.append("\r")
            elif next_ch == "0":
                out.append("\x00")
            elif next_ch == "/":
                out.append("/")
            else:
                raise DeclineError("UnexpectedCharacter")
            i += 2
            continue
        out.append(ch)
        i += 1
    raise DeclineError("UnterminatedQuote")


def parse_value(token: str):
    if not token:
        return {"raw": "", "kind": "Null", "style": "Plain"}
    first = token[0]
    if first == '"':
        return {
            "raw": decode_double_quoted(token),
            "kind": "Str",
            "style": "DoubleQuoted",
        }
    if first == "'":
        return {
            "raw": decode_single_quoted(token),
            "kind": "Str",
            "style": "SingleQuoted",
        }
    if first in UNSUPPORTED_VALUE_START:
        raise DeclineError("UnsupportedConstruct")
    raw = strip_trailing_comment(token).rstrip(" \t\r\n")
    return {"raw": raw, "kind": resolve_plain_kind(raw), "style": "Plain"}


def to_content_lines(text: str):
    out = []
    for raw in text.split("\n"):
        if raw.endswith("\r"):
            raw = raw[:-1]

        indent = 0
        saw_tab = False
        while indent < len(raw):
            ch = raw[indent]
            if ch == " ":
                indent += 1
            elif ch == "\t":
                saw_tab = True
                indent += 1
            else:
                break

        body = raw[indent:]
        if not body:
            continue
        if body[0] == "#":
            continue
        if saw_tab:
            raise DeclineError("TabIndentation")

        out.append({"indent": indent, "text": body})
    return out


def is_document_marker(text: str) -> bool:
    t = text.rstrip(" \t\r\n")
    return t == "---" or t == "..." or t.startswith("--- ") or t.startswith("... ")


def split_mapping_entry(text: str):
    in_single = False
    in_double = False
    i = 0
    while i < len(text):
        ch = text[i]
        if in_single:
            if ch == "'":
                in_single = False
            i += 1
            continue
        if in_double:
            if ch == "\\":
                i += 2
                continue
            if ch == '"':
                in_double = False
            i += 1
            continue
        if ch == "'":
            in_single = True
            i += 1
            continue
        if ch == '"':
            in_double = True
            i += 1
            continue
        if ch == "#" and i > 0 and is_space(text[i - 1]):
            return None
        if ch == ":" and (
            i + 1 >= len(text) or text[i + 1] == " " or text[i + 1] == "\t"
        ):
            key = text[:i].rstrip(" \t")
            val = None
            if i + 1 < len(text):
                trimmed = left_trim(text[i + 1 :])
                if trimmed and not trimmed.startswith("#"):
                    val = trimmed
            return {"key": key, "value": val}
        i += 1
    return None


def read_events(text: str):
    lines = to_content_lines(text)
    events = [{"e": "StreamStart"}]
    stack: list[dict[str, Any]] = []

    def push_container(indent: int, kind: str):
        stack.append({"indent": indent, "kind": kind})
        events.append({"e": "MappingStart" if kind == "Mapping" else "SequenceStart"})

    def pop_greater_than(indent: int):
        while stack and stack[-1]["indent"] > indent:
            top = stack.pop()
            events.append(
                {"e": "MappingEnd" if top["kind"] == "Mapping" else "SequenceEnd"}
            )

    def child_indent_at(idx: int) -> int:
        if idx + 1 < len(lines):
            return lines[idx + 1]["indent"]
        return -1

    def peek_child_kind(idx: int, child_indent: int) -> str:
        if idx + 1 >= len(lines):
            return "Mapping"
        next_line = lines[idx + 1]
        if next_line["indent"] != child_indent:
            return "Mapping"
        if next_line["text"] == "-" or next_line["text"].startswith("- "):
            return "Sequence"
        return "Mapping"

    def emit_key(key: str):
        parsed = parse_value(key)
        events.append(
            {
                "e": "Scalar",
                "raw": parsed["raw"],
                "kind": "Str",
                "style": parsed["style"],
            }
        )

    def emit_null():
        events.append({"e": "Scalar", "raw": "", "kind": "Null", "style": "Plain"})

    def emit_value(value: str):
        parsed = parse_value(value)
        events.append(
            {
                "e": "Scalar",
                "raw": parsed["raw"],
                "kind": parsed["kind"],
                "style": parsed["style"],
            }
        )

    def emit_value_or_empty_flow(value: str):
        token = strip_trailing_comment(value).rstrip(" \t\r\n")
        if token == "{}":
            events.append({"e": "MappingStart"})
            events.append({"e": "MappingEnd"})
        elif token == "[]":
            events.append({"e": "SequenceStart"})
            events.append({"e": "SequenceEnd"})
        else:
            emit_value(value)

    for li in range(len(lines)):
        line = lines[li]
        body = line["text"]
        indent = line["indent"]

        if is_document_marker(body):
            raise DeclineError("UnsupportedConstruct")

        is_seq_item = body == "-" or body.startswith("- ")

        if not stack:
            push_container(indent, "Sequence" if is_seq_item else "Mapping")
        elif indent <= stack[-1]["indent"]:
            pop_greater_than(indent)
            if not stack:
                raise DeclineError("UnexpectedIndent")
            top = stack[-1]
            if top["indent"] != indent:
                raise DeclineError("UnexpectedIndent")
            if is_seq_item != (top["kind"] == "Sequence"):
                raise DeclineError("UnexpectedIndent")

        if is_seq_item:
            after_dash = "" if body == "-" else body[2:]
            item_content = left_trim(after_dash)

            if not item_content or item_content.startswith("#"):
                child_indent = child_indent_at(li)
                if child_indent > indent:
                    push_container(child_indent, peek_child_kind(li, child_indent))
                else:
                    emit_null()
                continue

            inner_entry = split_mapping_entry(item_content)
            if inner_entry is not None:
                map_indent = indent + (len(body) - len(item_content))
                push_container(map_indent, "Mapping")
                emit_key(inner_entry["key"])
                if inner_entry["value"] is not None:
                    emit_value_or_empty_flow(inner_entry["value"])
                else:
                    child_indent = child_indent_at(li)
                    if child_indent > map_indent:
                        push_container(child_indent, peek_child_kind(li, child_indent))
                    else:
                        emit_null()
                continue

            emit_value_or_empty_flow(item_content)
            continue

        entry = split_mapping_entry(body)
        if entry is None:
            raise DeclineError("UnsupportedConstruct")
        emit_key(entry["key"])
        if entry["value"] is not None:
            emit_value_or_empty_flow(entry["value"])
        else:
            child_indent = child_indent_at(li)
            if child_indent > indent:
                push_container(child_indent, peek_child_kind(li, child_indent))
            else:
                emit_null()

    while stack:
        top = stack.pop()
        events.append(
            {"e": "MappingEnd" if top["kind"] == "Mapping" else "SequenceEnd"}
        )
    events.append({"e": "StreamEnd"})
    return events
