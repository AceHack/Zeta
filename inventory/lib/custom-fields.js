/**
 * Inventory — shared custom-field logic (Phase 5)
 * ---------------------------------------------------------------------------
 * ONE SOURCE OF TRUTH for typed custom-field behaviour, used by BOTH:
 *   - index.html (loaded as a plain same-origin <script src> -> window.CustomFields;
 *     CSP script-src 'self' already permits it, no build step)
 *   - inventory/proofs/custom-fields.unit.test.ts (bun test, via CJS interop)
 *
 * It is PURE (no DOM, no network) so the comparator / coercion / validation logic
 * is unit-testable in isolation. The DATABASE (inventory/sql/phase5.sql trigger)
 * is the FINAL authority on validity; the app-side mirror here is convenience +
 * UX only (zero-trust: an editor with the anon key can bypass the client).
 *
 * UMD wrapper: no import/export keywords, so it loads in a non-module browser
 * <script> AND is requireable/importable by bun.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // bun / node
  root.CustomFields = api; // browser global
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CUSTOM_TYPES = ["text", "number", "date", "dropdown", "boolean"];
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  // A calendar-real YYYY-MM-DD (rejects 2024-13-40, 2023-02-29, etc.). Mirrors
  // the DB trigger's regex + ::date cast. Uses UTC to avoid local-tz roll-over.
  function isValidCalendarDate(s) {
    if (typeof s !== "string" || !DATE_RE.test(s)) return false;
    const y = Number(s.slice(0, 4));
    const m = Number(s.slice(5, 7));
    const d = Number(s.slice(8, 10));
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  // Which client-side comparator a declared field type sorts under.
  function comparatorType(fieldType) {
    if (fieldType === "number") return "num";
    if (fieldType === "date") return "date";
    if (fieldType === "boolean") return "bool";
    return "str"; // text + dropdown
  }

  // --- coercion: raw form input (string) -> typed JS value, or an error --------
  // raw is input.value (text/number/date) or select value (dropdown/boolean).
  // Returns { ok:true, value } (value is null for "empty/cleared") or
  // { ok:false, error }. App-side mirror of the DB trigger.
  function coerceFormValue(def, raw) {
    const type = def.type;
    if (type === "boolean") {
      // select value: "" (none) | "true" | "false"
      if (raw === "" || raw == null) return { ok: true, value: null };
      if (raw === "true") return { ok: true, value: true };
      if (raw === "false") return { ok: true, value: false };
      return { ok: false, error: `${def.label}: invalid boolean.` };
    }
    const s = String(raw == null ? "" : raw).trim();
    if (s === "") return { ok: true, value: null }; // empty = cleared
    if (type === "text") {
      return { ok: true, value: s };
    }
    if (type === "number") {
      const n = Number(s);
      if (!Number.isFinite(n)) return { ok: false, error: `${def.label} must be a number.` };
      return { ok: true, value: n };
    }
    if (type === "date") {
      if (!isValidCalendarDate(s)) return { ok: false, error: `${def.label} must be a valid date (YYYY-MM-DD).` };
      return { ok: true, value: s };
    }
    if (type === "dropdown") {
      const opts = Array.isArray(def.options) ? def.options : [];
      if (!opts.includes(s)) return { ok: false, error: `${def.label} must be one of: ${opts.join(", ")}.` };
      return { ok: true, value: s };
    }
    return { ok: false, error: `${def.label}: unsupported field type.` };
  }

  // --- validation: an already-typed JS value matches the declared type ---------
  // Final app-side guard before sending to the DB. null = cleared = always ok.
  function validateTypedValue(def, value) {
    if (value === null || value === undefined) return { ok: true };
    const type = def.type;
    if (type === "text") {
      return typeof value === "string" ? { ok: true } : { ok: false, error: `${def.label}: expected text.` };
    }
    if (type === "number") {
      return typeof value === "number" && Number.isFinite(value)
        ? { ok: true }
        : { ok: false, error: `${def.label}: expected a number.` };
    }
    if (type === "boolean") {
      return typeof value === "boolean" ? { ok: true } : { ok: false, error: `${def.label}: expected true/false.` };
    }
    if (type === "date") {
      return typeof value === "string" && isValidCalendarDate(value)
        ? { ok: true }
        : { ok: false, error: `${def.label}: expected YYYY-MM-DD.` };
    }
    if (type === "dropdown") {
      const opts = Array.isArray(def.options) ? def.options : [];
      return typeof value === "string" && opts.includes(value)
        ? { ok: true }
        : { ok: false, error: `${def.label}: not an allowed option.` };
    }
    return { ok: false, error: `${def.label}: unsupported field type.` };
  }

  // --- comparator: returns negative/0/positive; null/invalid treated as +inf so
  //     the caller's `dir==="desc" ? -cmp : cmp` flip gives the SAME null
  //     semantics as core columns. ctype from comparatorType().
  function compareValues(ctype, a, b) {
    if (ctype === "str") {
      const as = a == null ? "" : String(a);
      const bs = b == null ? "" : String(b);
      if (as === "" && bs === "") return 0;
      if (as === "") return 1; // empty last
      if (bs === "") return -1;
      return as.localeCompare(bs, undefined, { sensitivity: "base", numeric: true });
    }
    // numeric-ish: num, date, bool all reduce to a comparable number or null
    const na = toNumeric(ctype, a);
    const nb = toNumeric(ctype, b);
    if (na == null && nb == null) return 0;
    if (na == null) return 1; // null/invalid last
    if (nb == null) return -1;
    return na < nb ? -1 : na > nb ? 1 : 0;
  }

  function toNumeric(ctype, v) {
    if (v == null || v === "") return null;
    if (ctype === "num") {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    if (ctype === "bool") {
      return typeof v === "boolean" ? (v ? 1 : 0) : null; // false < true
    }
    if (ctype === "date") {
      if (!isValidCalendarDate(String(v))) return null;
      const t = Date.parse(String(v) + "T00:00:00Z");
      return Number.isFinite(t) ? t : null;
    }
    return null;
  }

  // --- search haystack text for a stored value (type-aware). Caller lowercases.
  //     boolean -> "true yes" / "false no" so either spelling matches.
  function searchTextForValue(def, value) {
    if (value === null || value === undefined) return "";
    if (def.type === "boolean") return value ? "true yes" : "false no";
    return String(value);
  }

  // --- display text for a rendered cell. null -> "" (caller renders the dash);
  //     boolean -> Yes/No; everything else -> String(value).
  function displayText(def, value) {
    if (value === null || value === undefined) return "";
    if (def.type === "boolean") return value ? "Yes" : "No";
    return String(value);
  }

  // --- admin helpers -----------------------------------------------------------
  const KEY_RE = /^[a-z][a-z0-9_]*$/; // stable slug, safe in JSONB + UI ids
  function isValidKey(key) {
    return typeof key === "string" && key.length >= 1 && key.length <= 60 && KEY_RE.test(key);
  }
  // options textarea (newline- or comma-separated) -> de-duped, trimmed, non-empty
  function parseOptions(text) {
    const seen = new Set();
    const out = [];
    for (const raw of String(text == null ? "" : text).split(/[\n,]/)) {
      const t = raw.trim();
      if (t !== "" && !seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
    return out;
  }

  return {
    CUSTOM_TYPES,
    isValidCalendarDate,
    comparatorType,
    coerceFormValue,
    validateTypedValue,
    compareValues,
    toNumeric,
    searchTextForValue,
    displayText,
    isValidKey,
    parseOptions,
  };
});
