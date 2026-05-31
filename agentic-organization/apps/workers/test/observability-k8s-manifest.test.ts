import { ok } from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("Grafana manifest provisions the conformance SLI panel and alert rule", async () => {
  const manifest = await readFile(
    fileURLToPath(new URL("../../../deploy/k8s/44-grafana.yaml", import.meta.url)),
    "utf8",
  );

  ok(manifest.includes("Conformance Pass Ratio"));
  ok(manifest.includes("org_conformance_pass_ratio"));
  ok(manifest.includes("agentic-org-conformance-pass-ratio"));
  ok(manifest.includes("Agent Cost by Hat"));
  ok(manifest.includes("org_agent_cost_usd"));
  ok(manifest.includes("Internal DORA Deployment Frequency"));
  ok(manifest.includes("org_dora_deployment_frequency_per_day"));
  ok(manifest.includes("Internal DORA Lead Time"));
  ok(manifest.includes("org_dora_lead_time_ms"));
  ok(manifest.includes("Internal DORA Change Failure Ratio"));
  ok(manifest.includes("org_dora_change_failure_ratio"));
  ok(manifest.includes("Internal DORA MTTR"));
  ok(manifest.includes("org_dora_mttr_ms"));
});
