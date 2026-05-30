import type { FrontmatterValue, FrontmatterRow } from "./schema.ts";

/**
 * On-disk frontmatter YAML codec for git-as-db.
 *
 * Covers exactly the {@link FrontmatterValue} shapes the database uses:
 * string, number, boolean, and inline string arrays (`[a, b, c]`), plus a
 * freeform markdown body. This is a small, self-contained serializer/parser —
 * NOT a general YAML implementation. It guarantees round-trip correctness for
 * the value set above: `parse(serialize(x))` deep-equals `x`.
 *
 * A row file is:
 * ```
 * ---
 * <key>: <scalar or [a, b]>
 * ...
 * ---
 * <freeform markdown body>
 * ```
 */

/** A parsed frontmatter document: the key/value frontmatter plus the body. */
export type ParsedDocument = {
  readonly frontmatter: Record<string, FrontmatterValue>;
  readonly body: string;
};

/** Result-as-DU feedback reasons emitted by {@link parseFrontmatterDocument}. */
export const ParseFeedbackReason = {
  MissingFrontmatter: "missing_frontmatter",
  UnterminatedFrontmatter: "unterminated_frontmatter",
  MalformedLine: "malformed_line",
} as const;
export type ParseFeedbackReason =
  (typeof ParseFeedbackReason)[keyof typeof ParseFeedbackReason];

/** Explicit two-variant Result DU for the parser. */
export type ParseResult =
  | { readonly outcome: "ok"; readonly document: ParsedDocument }
  | {
      readonly outcome: "feedback";
      readonly feedback: { readonly reason: string; readonly message: string };
    };

const FRONTMATTER_FENCE = "---";

const ok = (document: ParsedDocument): ParseResult => ({
  outcome: "ok",
  document,
});

const feedback = (reason: ParseFeedbackReason, message: string): ParseResult => ({
  outcome: "feedback",
  feedback: { reason, message },
});

/**
 * Parse a frontmatter document into its frontmatter map and markdown body.
 *
 * Feedback reasons:
 *  - `missing_frontmatter`: the text does not open with a `---` fence line.
 *  - `unterminated_frontmatter`: the opening fence is never closed by a `---`.
 *  - `malformed_line`: a frontmatter line is not `key: value` shaped.
 */
export const parseFrontmatterDocument = (text: string): ParseResult => {
  const lines = text.split("\n");

  if (lines.length === 0 || lines[0] !== FRONTMATTER_FENCE) {
    return feedback(
      ParseFeedbackReason.MissingFrontmatter,
      "document does not begin with a '---' frontmatter fence",
    );
  }

  // Find the closing fence (first `---` line after index 0).
  let closeIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === FRONTMATTER_FENCE) {
      closeIndex = i;
      break;
    }
  }

  if (closeIndex === -1) {
    return feedback(
      ParseFeedbackReason.UnterminatedFrontmatter,
      "opening '---' fence is never closed by a matching '---' line",
    );
  }

  const frontmatter: Record<string, FrontmatterValue> = {};
  for (let i = 1; i < closeIndex; i += 1) {
    const line = lines[i]!;
    // Skip wholly blank lines inside the frontmatter block.
    if (line.trim() === "") {
      continue;
    }
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) {
      return feedback(
        ParseFeedbackReason.MalformedLine,
        `frontmatter line is not 'key: value' shaped: ${JSON.stringify(line)}`,
      );
    }
    const key = line.slice(0, colonIndex).trim();
    if (key === "") {
      return feedback(
        ParseFeedbackReason.MalformedLine,
        `frontmatter line has an empty key: ${JSON.stringify(line)}`,
      );
    }
    const rawValue = line.slice(colonIndex + 1).trim();
    frontmatter[key] = parseScalar(rawValue);
  }

  // Body is everything after the closing fence line. serialize writes
  // "...\n---\n<body>", so splitting on "\n" and dropping the fence line
  // leaves the body verbatim.
  const body = lines.slice(closeIndex + 1).join("\n");

  return ok({ frontmatter, body });
};

/** Parse a single scalar/array frontmatter value into a FrontmatterValue. */
const parseScalar = (raw: string): FrontmatterValue => {
  // Quoted string: strip quotes + unescape; always a string.
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
    return unquote(raw);
  }

  // Inline array: [a, b, c]. Elements are strings (possibly quoted).
  if (raw.startsWith("[") && raw.endsWith("]")) {
    return parseInlineArray(raw);
  }

  // Boolean.
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }

  // Number (integer or float; finite only).
  if (looksLikeNumber(raw)) {
    return Number(raw);
  }

  // Bare string.
  return raw;
};

/** Parse an inline array body `[a, b, c]` into a readonly string[]. */
const parseInlineArray = (raw: string): readonly string[] => {
  const inner = raw.slice(1, -1).trim();
  if (inner === "") {
    return [];
  }
  // Split on commas that are not inside quotes.
  const elements: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i]!;
    if (inQuotes) {
      if (ch === "\\" && i + 1 < inner.length) {
        // Preserve the escape sequence so unquote can resolve it later.
        current += ch + inner[i + 1]!;
        i += 1;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        current += ch;
        continue;
      }
      current += ch;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      current += ch;
      continue;
    }
    if (ch === ",") {
      elements.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  elements.push(current.trim());

  return elements.map((el) => {
    if (el.length >= 2 && el.startsWith('"') && el.endsWith('"')) {
      return unquote(el);
    }
    return el;
  });
};

/** Strip surrounding double quotes and unescape `\\` and `\"`. */
const unquote = (raw: string): string => {
  const inner = raw.slice(1, -1);
  let out = "";
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i]!;
    if (ch === "\\" && i + 1 < inner.length) {
      const next = inner[i + 1]!;
      if (next === "\\" || next === '"') {
        out += next;
        i += 1;
        continue;
      }
    }
    out += ch;
  }
  return out;
};

/** True if `raw` is a finite JSON-style number literal. */
const looksLikeNumber = (raw: string): boolean => {
  if (raw === "") {
    return false;
  }
  // Reject leading/trailing whitespace already trimmed by caller; here be strict.
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw)) {
    return false;
  }
  return Number.isFinite(Number(raw));
};

/**
 * Serialize a parsed document back to its on-disk form.
 *
 * Key order is the insertion order of the frontmatter object (deterministic).
 * Arrays render as `[a, b, c]`. Strings are quoted only when necessary so they
 * round-trip as strings: when they contain `:` or `#`, have leading/trailing
 * whitespace, are empty, or would otherwise parse back as a number, boolean,
 * or array.
 */
export const serializeFrontmatterDocument = (
  document: ParsedDocument,
): string => {
  const lines: string[] = [FRONTMATTER_FENCE];
  for (const key of Object.keys(document.frontmatter)) {
    const value = document.frontmatter[key]!;
    lines.push(`${key}: ${serializeValue(value)}`);
  }
  lines.push(FRONTMATTER_FENCE);
  return `${lines.join("\n")}\n${document.body}`;
};

/** Serialize a single FrontmatterValue. */
const serializeValue = (value: FrontmatterValue): string => {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((el) => serializeArrayElement(el)).join(", ")}]`;
  }
  // string
  return serializeString(value as string);
};

/** Serialize an array element: quote when it would not round-trip as a string. */
const serializeArrayElement = (el: string): string => {
  // Inside an array, an element must be quoted if it contains a comma, a
  // bracket, leading/trailing whitespace, or would otherwise be ambiguous.
  if (
    el === "" ||
    el !== el.trim() ||
    el.includes(",") ||
    el.includes("[") ||
    el.includes("]") ||
    el.includes('"') ||
    el.includes(":") ||
    el.includes("#")
  ) {
    return quote(el);
  }
  return el;
};

/** Serialize a top-level scalar string, quoting only when necessary. */
const serializeString = (str: string): string => {
  if (needsQuoting(str)) {
    return quote(str);
  }
  return str;
};

/** True if a bare string would not round-trip as itself. */
const needsQuoting = (str: string): boolean => {
  if (str === "") {
    return true;
  }
  if (str !== str.trim()) {
    return true; // leading/trailing whitespace
  }
  if (str.includes(":") || str.includes("#")) {
    return true;
  }
  if (str.startsWith('"')) {
    return true; // would be mistaken for a quoted string
  }
  if (str.startsWith("[") && str.endsWith("]")) {
    return true; // would be mistaken for an array
  }
  if (str === "true" || str === "false") {
    return true; // would be mistaken for a boolean
  }
  if (looksLikeNumber(str)) {
    return true; // would be mistaken for a number
  }
  return false;
};

/** Double-quote a string, escaping `\\` and `"`. */
const quote = (str: string): string => {
  const escaped = str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
};

/** Build a ParsedDocument from a row's values + a markdown body. */
export const rowToDocument = (
  row: FrontmatterRow,
  body: string,
): ParsedDocument => ({
  frontmatter: { ...row.values },
  body,
});

/** Build a FrontmatterRow for `table` from a parsed document's frontmatter. */
export const documentToRow = (
  document: ParsedDocument,
  table: string,
): FrontmatterRow => ({
  table,
  values: { ...document.frontmatter },
});
