import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";
import { CodeMetricKind, MetricSeverity, analyzeSource } from "../src/code-metrics.ts";

test("measures file length and flags a long file", () => {
  const source = Array.from({ length: 850 }, (_, i) => `const x${i} = ${i};`).join("\n");
  const report = analyzeSource("big.ts", source);
  equal(report.fileLengthLines, 850);
  const fileFinding = report.findings.find((f) => f.metric === CodeMetricKind.FileLength);
  equal(fileFinding?.severity, MetricSeverity.Flag);
});

test("finds the longest function and warns past threshold", () => {
  const body = Array.from({ length: 50 }, () => "  doThing();").join("\n");
  const source = `function shortOne() {\n  return 1;\n}\n\nfunction bigOne() {\n${body}\n}\n`;
  const report = analyzeSource("f.ts", source);
  equal(report.longestFunction?.name, "bigOne");
  ok((report.longestFunction?.lines ?? 0) >= 50);
  const fnFinding = report.findings.find((f) => f.metric === CodeMetricKind.LongestFunction);
  equal(fnFinding?.severity, MetricSeverity.Warn);
});

test("detects a god class past the flag threshold", () => {
  const members = Array.from({ length: 420 }, (_, i) => `  m${i}() { return ${i}; }`).join("\n");
  const source = `export class GodClass {\n${members}\n}\n`;
  const report = analyzeSource("g.ts", source);
  equal(report.longestClass?.name, "GodClass");
  const classFinding = report.findings.find((f) => f.metric === CodeMetricKind.LongestClass);
  equal(classFinding?.severity, MetricSeverity.Flag);
  ok(classFinding?.message.includes("god-class"));
});

test("a small clean file produces no findings", () => {
  const source = "export function add(a: number, b: number): number {\n  return a + b;\n}\n";
  const report = analyzeSource("clean.ts", source);
  deepEqual(report.findings, []);
});

test("reports max nesting depth", () => {
  const source = "function f() {\n if (a) {\n  if (b) {\n   if (c) {\n    if (d) {\n     g();\n    }\n   }\n  }\n }\n}\n";
  const report = analyzeSource("nest.ts", source);
  ok(report.maxNestingDepth >= 5);
});
