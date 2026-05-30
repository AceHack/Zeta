/**
 * Quantitative code metrics — "coverage for structure".
 *
 * These are mechanical, deterministic measurements over source text, gathered
 * the way test coverage is: longest function / longest class (god-object
 * detection), file length, and maximum nesting depth. They are heuristics
 * (brace-aware, not a full parser) intended to FLAG candidates for the
 * qualitative review board, not to be authoritative. Pure functions, no I/O.
 *
 * Every threshold breach is an explicit MetricFinding with a discriminated
 * `metric` kind, so a "god class" finding is never indistinguishable from a
 * "long file" finding (repo rule: IMPLICIT-NOT-EXPLICIT in DUs is class error).
 */

export const CodeMetricKind = {
  LongestFunction: "longest_function",
  LongestClass: "longest_class",
  FileLength: "file_length",
  MaxNestingDepth: "max_nesting_depth",
} as const;
export type CodeMetricKind = (typeof CodeMetricKind)[keyof typeof CodeMetricKind];

export const MetricSeverity = {
  Ok: "ok",
  Warn: "warn",
  Flag: "flag",
} as const;
export type MetricSeverity = (typeof MetricSeverity)[keyof typeof MetricSeverity];

export type MetricThresholds = {
  longestFunctionLines: { warn: number; flag: number };
  longestClassLines: { warn: number; flag: number };
  fileLengthLines: { warn: number; flag: number };
  maxNestingDepth: { warn: number; flag: number };
};

export const DEFAULT_METRIC_THRESHOLDS: MetricThresholds = {
  longestFunctionLines: { warn: 40, flag: 80 },
  longestClassLines: { warn: 200, flag: 400 },
  fileLengthLines: { warn: 400, flag: 800 },
  maxNestingDepth: { warn: 4, flag: 6 },
};

export type NamedSpan = { name: string; lines: number };

export type MetricFinding = {
  metric: CodeMetricKind;
  severity: MetricSeverity;
  value: number;
  threshold: number;
  subject: string;
  message: string;
};

export type CodeMetricsReport = {
  filePath: string;
  fileLengthLines: number;
  longestFunction: NamedSpan | undefined;
  longestClass: NamedSpan | undefined;
  maxNestingDepth: number;
  findings: readonly MetricFinding[];
};

const FUNCTION_DECL = /\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/;
const ARROW_DECL = /\b(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s+)?\([^)]*\)\s*(?::[^=]+)?=>\s*\{/;
const METHOD_DECL = /^\s*(?:public|private|protected|static|async|\s)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^={]+)?\{/;
const CLASS_DECL = /\b(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/;

/** Count the lines of a brace-balanced block starting at the line that opens it. */
function blockLineSpan(lines: readonly string[], startIndex: number): number {
  let depth = 0;
  let started = false;
  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i]!;
    for (const ch of line) {
      if (ch === "{") {
        depth += 1;
        started = true;
      } else if (ch === "}") {
        depth -= 1;
      }
    }
    if (started && depth <= 0) {
      return i - startIndex + 1;
    }
  }
  return lines.length - startIndex;
}

function longestNamed(lines: readonly string[], patterns: readonly RegExp[]): NamedSpan | undefined {
  let best: NamedSpan | undefined;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    for (const pattern of patterns) {
      const m = pattern.exec(line);
      if (m && m[1] !== undefined && line.includes("{")) {
        const span = blockLineSpan(lines, i);
        if (best === undefined || span > best.lines) {
          best = { name: m[1], lines: span };
        }
        break;
      }
    }
  }
  return best;
}

function maxNesting(lines: readonly string[]): number {
  let depth = 0;
  let max = 0;
  for (const line of lines) {
    for (const ch of line) {
      if (ch === "{") {
        depth += 1;
        if (depth > max) max = depth;
      } else if (ch === "}") {
        depth = Math.max(0, depth - 1);
      }
    }
  }
  return max;
}

function severityFor(value: number, band: { warn: number; flag: number }): MetricSeverity {
  if (value >= band.flag) return MetricSeverity.Flag;
  if (value >= band.warn) return MetricSeverity.Warn;
  return MetricSeverity.Ok;
}

export function analyzeSource(
  filePath: string,
  source: string,
  thresholds: MetricThresholds = DEFAULT_METRIC_THRESHOLDS,
): CodeMetricsReport {
  const lines = source.split("\n");
  const fileLengthLines = lines.length;
  const longestFunction = longestNamed(lines, [FUNCTION_DECL, ARROW_DECL, METHOD_DECL]);
  const longestClass = longestNamed(lines, [CLASS_DECL]);
  const maxNestingDepth = maxNesting(lines);

  const findings: MetricFinding[] = [];

  const fileSeverity = severityFor(fileLengthLines, thresholds.fileLengthLines);
  if (fileSeverity !== MetricSeverity.Ok) {
    findings.push({ metric: CodeMetricKind.FileLength, severity: fileSeverity, value: fileLengthLines, threshold: thresholds.fileLengthLines.warn, subject: filePath, message: `file is ${fileLengthLines} lines` });
  }

  if (longestFunction !== undefined) {
    const sev = severityFor(longestFunction.lines, thresholds.longestFunctionLines);
    if (sev !== MetricSeverity.Ok) {
      findings.push({ metric: CodeMetricKind.LongestFunction, severity: sev, value: longestFunction.lines, threshold: thresholds.longestFunctionLines.warn, subject: longestFunction.name, message: `function '${longestFunction.name}' is ${longestFunction.lines} lines` });
    }
  }

  if (longestClass !== undefined) {
    const sev = severityFor(longestClass.lines, thresholds.longestClassLines);
    if (sev !== MetricSeverity.Ok) {
      findings.push({ metric: CodeMetricKind.LongestClass, severity: sev, value: longestClass.lines, threshold: thresholds.longestClassLines.warn, subject: longestClass.name, message: `class '${longestClass.name}' is ${longestClass.lines} lines (god-class risk)` });
    }
  }

  const nestSeverity = severityFor(maxNestingDepth, thresholds.maxNestingDepth);
  if (nestSeverity !== MetricSeverity.Ok) {
    findings.push({ metric: CodeMetricKind.MaxNestingDepth, severity: nestSeverity, value: maxNestingDepth, threshold: thresholds.maxNestingDepth.warn, subject: filePath, message: `max nesting depth is ${maxNestingDepth}` });
  }

  const report: CodeMetricsReport = {
    filePath,
    fileLengthLines,
    longestFunction,
    longestClass,
    maxNestingDepth,
    findings,
  };
  return report;
}
