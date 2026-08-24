#!/usr/bin/env bun
// runtime-plan.ts — print the computed rung order for this host, or for a named example.
//
// This is the auditable half of the design: it reports EVERY rung with its cost register,
// its trust surface and its buildability, not just the winner. Two columns, never fused —
// COST (measured fact) and ENABLEMENT (dated judgment) are printed separately so a reader
// can dispute the judgment without disputing the bytes.
//
// Usage:
//   bun src/Core.TypeScript/ace/runtime-plan.ts [--host live|rich|node-only|bare|unknown] [--weight 0.5]

import { CANDIDATES } from "./runtime-candidates.ts";
import { choose, report, sensitivity, type HostProfile } from "./runtime-cost.ts";
import { probeHost } from "./runtime-probe.ts";

const EXAMPLES: Readonly<Record<string, HostProfile>> = {
  rich: { bun: "present", node: "present", dotnet: "present", rust: "present", "wasm-runtime": "present" },
  "node-only": { bun: "absent", node: "present", dotnet: "absent", rust: "absent", "wasm-runtime": "absent" },
  bare: { bun: "absent", node: "absent", dotnet: "absent", rust: "absent", "wasm-runtime": "absent" },
  unknown: {
    bun: "indeterminate",
    node: "indeterminate",
    dotnet: "indeterminate",
    rust: "indeterminate",
    "wasm-runtime": "indeterminate",
  },
};

function fmtCost(c: (typeof CANDIDATES)[number]["cost"]): string {
  return c.register === "metered"
    ? `${c.addedBytes.toLocaleString("en-US")} B added`
    : `UNMETERED (${c.reason.slice(0, 44)}...)`;
}

function main(argv: readonly string[]): number {
  let hostName = "live";
  let weight = 0.5;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--host") hostName = argv[++i] ?? "live";
    else if (argv[i] === "--weight") weight = Number(argv[++i]);
  }
  const host: HostProfile = hostName === "live" ? probeHost() : (EXAMPLES[hostName] ?? {});
  if (hostName !== "live" && !EXAMPLES[hostName]) {
    console.error(`unknown host profile '${hostName}' (live|${Object.keys(EXAMPLES).join("|")})`);
    return 2;
  }

  console.log(`host profile: ${hostName}`);
  console.log(
    `  ${Object.entries(host)
      .map(([k, v]) => `${k}=${v}`)
      .join("  ")}`,
  );
  console.log(`enablement weight (the JUDGMENT dial): ${String(weight)}\n`);

  console.log("all rungs considered:");
  for (const r of report(CANDIDATES, host)) {
    const state = r.buildable.state === "no" ? "UNBUILDABLE" : r.viable ? "viable" : "not-viable";
    console.log(`  ${r.id.padEnd(20)} ${state.padEnd(12)} trust=${String(r.trust.rank)}  cost=${fmtCost(r.cost)}`);
    console.log(
      `  ${" ".repeat(20)} enablement=${String(r.enablement.score)} (JUDGMENT by ${r.enablement.by}, ${r.enablement.on})`,
    );
    if (r.missing.length) console.log(`  ${" ".repeat(20)} missing: ${r.missing.join(", ")}`);
    if (r.indeterminate.length)
      console.log(`  ${" ".repeat(20)} UNPROBED (check did not run): ${r.indeterminate.join(", ")}`);
    if (r.buildable.state === "no") console.log(`  ${" ".repeat(20)} blocker: ${r.buildable.blocker.slice(0, 100)}...`);
  }

  const s = choose(CANDIDATES, host, weight);
  console.log("");
  if (s.kind === "selected") {
    console.log(`SELECTED: ${s.candidate.id}`);
    console.log(`  you must trust: ${s.candidate.trust.mustTrust.join("; ")}`);
  } else if (s.kind === "toolchain-missing") {
    console.log(`TOOLCHAIN MISSING — no rung is viable here. Missing: ${s.missing.join(", ")}`);
    console.log("  This is a REPORT, not a fallback. ace did not quietly install a binary instead.");
  } else {
    console.log(`INDETERMINATE — the probe did not run for: ${s.unprobed.join(", ")}`);
    console.log("  Absence was NOT assumed. Re-run where the probes can execute.");
  }

  console.log("\nsensitivity — where the winner changes as the JUDGMENT moves across [0,1]:");
  for (const p of sensitivity(CANDIDATES, host)) console.log(`  weight >= ${p.weight.toFixed(2)} -> ${p.winner}`);
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
