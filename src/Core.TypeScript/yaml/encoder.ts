// Canonical YAML ENCODER — TS oracle, an EXACT mirror of the F# encoder
// (src/Core.FSharp.Yaml/Encoder.fs) so the two produce BYTE-IDENTICAL canonical
// YAML (cross-language byte-lock; YAML is the storage of record). Round-trips with
// the TS parser: parse(encode(v)).value deep-equals v for compound values.
//
// Canonical (locked, == F#): block style only; 2-space indent; map keys preserve
// INSERTION ORDER; strings + keys ALWAYS double-quoted (escapes \\ \" \n \t \r \0,
// rest literal); null/bool/int plain; float invariant with a forced "." so it
// resolves back to Float. Culture-invariant throughout.
import type { YamlValue } from "./dom.ts";

function quote(s: string): string {
  let out = '"';
  for (const ch of s) {
    switch (ch) {
      case "\\": out += "\\\\"; break;
      case '"': out += '\\"'; break;
      case "\n": out += "\\n"; break;
      case "\t": out += "\\t"; break;
      case "\r": out += "\\r"; break;
      case "\0": out += "\\0"; break;
      default: out += ch;
    }
  }
  return out + '"';
}

/** Inline rendering of a scalar value, or null for a container. */
function scalar(v: YamlValue): string | null {
  switch (v.t) {
    case "Null": return "null";
    case "Bool": return v.value ? "true" : "false";
    case "Int": return v.value.toString();
    case "Float": {
      const r = v.value.toString(); // JS Number.toString is culture-invariant
      return /[.eE]/.test(r) ? r : r + ".0";
    }
    case "Str": return quote(v.value);
    // Empty collections render INLINE as flow `{}` / `[]` (081KT7YW00008QG0R002T1XNWT): block style
    // cannot represent an empty map/seq, so without this `{}`, `[]`, and null all
    // collapse to a bare `key:` → null. The one necessary flow exception; non-empty
    // containers still render as block (return null → recurse).
    case "Map": return v.entries.length === 0 ? "{}" : null;
    case "Seq": return v.items.length === 0 ? "[]" : null;
    default: return null;
  }
}

function emit(indent: number, v: YamlValue, lines: string[]): void {
  const pad = " ".repeat(indent);
  if (v.t === "Map") {
    for (const [k, child] of v.entries) {
      const key = quote(k);
      const s = scalar(child);
      if (s !== null) lines.push(`${pad}${key}: ${s}`);
      else {
        lines.push(`${pad}${key}:`);
        emit(indent + 2, child, lines);
      }
    }
  } else if (v.t === "Seq") {
    for (const child of v.items) {
      const s = scalar(child);
      if (s !== null) lines.push(`${pad}- ${s}`);
      else {
        lines.push(`${pad}-`);
        emit(indent + 2, child, lines);
      }
    }
  } else {
    lines.push(pad + scalar(v));
  }
}

/** Canonical YAML rendering — byte-identical to the F# encoder. */
export function encode(v: YamlValue): string {
  const lines: string[] = [];
  emit(0, v, lines);
  return lines.join("\n") + "\n";
}
