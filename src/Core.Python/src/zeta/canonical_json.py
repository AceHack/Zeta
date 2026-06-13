# canonical_json.py — Ace canonical-JSON Python implementation.


def check_well_formed(s: str, role: str = "string") -> None:
    for c in s:
        code = ord(c)
        if 0xD800 <= code <= 0xDFFF:
            raise ValueError(
                f"toTagged: {role} contains a lone surrogate (not well-formed UTF-16)"
            )


def escape_string(s: str) -> str:
    out = ['"']
    for c in s:
        if c == '"':
            out.append('\\"')
        elif c == "\\":
            out.append("\\\\")
        elif c == "\b":
            out.append("\\b")
        elif c == "\f":
            out.append("\\f")
        elif c == "\n":
            out.append("\\n")
        elif c == "\r":
            out.append("\\r")
        elif c == "\t":
            out.append("\\t")
        elif ord(c) < 0x20:
            out.append(f"\\u00{ord(c):02x}")
        else:
            out.append(c)
    out.append('"')
    return "".join(out)


def to_canonical_json(val: object) -> str:
    if val is None:
        return "null"

    # Check bool before int, as bool is a subclass of int in Python
    if isinstance(val, bool):
        return "true" if val else "false"

    if isinstance(val, float):
        raise ValueError("toTagged: float not allowed")

    if isinstance(val, int):
        if abs(val) > 9007199254740991:
            raise ValueError(f"toTagged: {val} is not a safe integer")
        return str(val)

    if isinstance(val, str):
        check_well_formed(val, "string")
        return escape_string(val)

    if isinstance(val, (list, tuple)):
        parts = [to_canonical_json(x) for x in val]
        return "[" + ",".join(parts) + "]"

    if isinstance(val, dict):
        # Sort keys lexicographically by UTF-16 code units
        def sort_key(s: str) -> bytes:
            return s.encode("utf-16-be")

        sorted_keys = sorted(val.keys(), key=sort_key)
        parts = []
        for k in sorted_keys:
            check_well_formed(k, "object key")
            k_json = escape_string(k)
            v_json = to_canonical_json(val[k])
            parts.append(f"{k_json}:{v_json}")
        return "{" + ",".join(parts) + "}"

    raise TypeError(f"Unsupported value type: {type(val)}")
