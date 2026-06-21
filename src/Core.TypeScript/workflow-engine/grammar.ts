/**
 * src/Core.TypeScript/workflow-engine/grammar.ts
 *
 * 081KSKBP80008QG0R000B3Y19A.3 minimal universal action grammar parser/composer.
 *
 * v0 line format:
 *
 *   id | class | gate | label | description | composesWith csv | feedback csv
 *
 * The line is deliberately boring: pipe-delimited fields, comma-delimited
 * lists, and no escaping. If a field needs "|" or a list item needs ",",
 * promote the grammar before using that value.
 */

import type { Action, ActionClass, ActionGate } from "./types";

export type ActionGrammarParseResult =
  | { readonly ok: true; readonly action: Action }
  | { readonly ok: false; readonly error: string };

export type ActionGrammarComposeResult =
  | { readonly ok: true; readonly line: string }
  | { readonly ok: false; readonly error: string };

const ACTION_CLASSES: ReadonlySet<string> = new Set([
  "transition",
  "escape-hatch",
  "grammar-extension",
  "menu-contribution",
  "operator-decision",
  "agent-decision",
]);

const ACTION_GATES: ReadonlySet<string> = new Set(["append-only", "pr-gated"]);

function splitCsv(field: string): ReadonlyArray<string> {
  if (field.trim() === "") return [];
  return field.split(",").map((part) => part.trim());
}

function hasIllegalDelimiter(value: string): boolean {
  return value.includes("|") || value.includes("\n") || value.includes("\r");
}

function validateScalar(name: string, value: string): string | undefined {
  if (value.trim().length === 0) return `${name} is required`;
  if (value.trim() !== value) return `${name} must be trimmed`;
  if (hasIllegalDelimiter(value)) {
    return `${name} contains an unsupported delimiter`;
  }
  return undefined;
}

function validateList(name: string, values: ReadonlyArray<string>): string | undefined {
  for (const value of values) {
    if (value.trim().length === 0) return `${name} contains an empty item`;
    if (value.trim() !== value) return `${name} item must be trimmed`;
    if (hasIllegalDelimiter(value) || value.includes(",")) {
      return `${name} item contains an unsupported delimiter`;
    }
  }
  return undefined;
}

export function parseActionGrammarLine(line: string): ActionGrammarParseResult {
  const fields = line.split("|").map((field) => field.trim());
  if (fields.length !== 7) {
    return {
      ok: false,
      error: `expected 7 pipe-delimited fields, got ${fields.length}`,
    };
  }

  const [id, actionClass, gate, label, description, composesWithRaw, feedbackRaw] = fields;

  const scalarError =
    validateScalar("id", id ?? "") ??
    validateScalar("class", actionClass ?? "") ??
    validateScalar("gate", gate ?? "") ??
    validateScalar("label", label ?? "") ??
    validateScalar("description", description ?? "");
  if (scalarError !== undefined) return { ok: false, error: scalarError };

  if (!ACTION_CLASSES.has(actionClass ?? "")) {
    return { ok: false, error: `unknown action class: ${actionClass ?? ""}` };
  }
  if (!ACTION_GATES.has(gate ?? "")) {
    return { ok: false, error: `unknown action gate: ${gate ?? ""}` };
  }

  const composesWith = splitCsv(composesWithRaw ?? "");
  const feedbackVariants = splitCsv(feedbackRaw ?? "");
  const listError = validateList("composesWith", composesWith) ?? validateList("feedbackVariants", feedbackVariants);
  if (listError !== undefined) return { ok: false, error: listError };
  if (feedbackVariants.length === 0) {
    return { ok: false, error: "feedbackVariants requires at least one item" };
  }

  return {
    ok: true,
    action: {
      id: id ?? "",
      class: actionClass as ActionClass,
      gate: gate as ActionGate,
      label: label ?? "",
      description: description ?? "",
      composesWith,
      feedbackVariants,
    },
  };
}

export function composeActionGrammarLine(action: Action): ActionGrammarComposeResult {
  const scalarFields = [action.id, action.class, action.gate, action.label, action.description];
  for (const field of scalarFields) {
    const error = validateScalar("action field", field);
    if (error !== undefined) {
      return { ok: false, error };
    }
  }
  const listError =
    validateList("composesWith", action.composesWith) ?? validateList("feedbackVariants", action.feedbackVariants);
  if (listError !== undefined) {
    return { ok: false, error: listError };
  }
  if (action.feedbackVariants.length === 0) {
    return { ok: false, error: "feedbackVariants requires at least one item" };
  }

  return {
    ok: true,
    line: [
      action.id,
      action.class,
      action.gate,
      action.label,
      action.description,
      action.composesWith.join(","),
      action.feedbackVariants.join(","),
    ].join(" | "),
  };
}
