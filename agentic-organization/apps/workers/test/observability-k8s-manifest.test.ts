import { equal, ok } from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

type Dashboard = {
  panels: readonly DashboardPanel[];
};

type DashboardPanel = {
  title?: string;
  targets?: readonly { expr?: string }[];
};

test("Grafana manifest provisions the conformance SLI panel and alert rule", async () => {
  const manifest = await readFile(
    fileURLToPath(new URL("../../../deploy/k8s/44-grafana.yaml", import.meta.url)),
    "utf8",
  );

  const dashboard = parseOrgHealthDashboard(manifest);
  equal(firstExpr(panelByTitle(dashboard, "Conformance Pass Ratio")), "min(org_conformance_pass_ratio)");
  equal(firstExpr(panelByTitle(dashboard, "Conformance Coverage Ratio")), "min(org_conformance_coverage_ratio)");
  equal(firstExpr(panelByTitle(dashboard, "Agent Cost by Hat")), "sum(rate(org_agent_cost_usd[5m])) by (agentic_hat,llm_model)");
  equal(firstExpr(panelByTitle(dashboard, "Internal DORA Deployment Frequency")), "sum(org_dora_deployment_frequency_per_day) by (agentic_project_id,agentic_initiative_id)");
  equal(firstExpr(panelByTitle(dashboard, "Internal DORA Lead Time")), "avg(org_dora_lead_time_ms) by (agentic_project_id,agentic_initiative_id)");
  equal(firstExpr(panelByTitle(dashboard, "Internal DORA Change Failure Ratio")), "avg(org_dora_change_failure_ratio) by (agentic_project_id,agentic_initiative_id)");
  equal(firstExpr(panelByTitle(dashboard, "Internal DORA MTTR")), "avg(org_dora_mttr_ms) by (agentic_project_id,agentic_initiative_id)");

  const passAlert = alertRuleBlock(manifest, "agentic-org-conformance-pass-ratio");
  ok(passAlert.includes("title: Conformance pass ratio below 1.0"));
  ok(passAlert.includes("expr: min(org_conformance_pass_ratio)"));

  const coverageAlert = alertRuleBlock(manifest, "agentic-org-conformance-coverage-ratio");
  ok(coverageAlert.includes("title: Conformance coverage ratio below 1.0"));
  ok(coverageAlert.includes("expr: min(org_conformance_coverage_ratio)"));
});

test("Mimir manifest is queryable as a single-node KIND deployment", async () => {
  const manifest = await readFile(
    fileURLToPath(new URL("../../../deploy/k8s/42-mimir.yaml", import.meta.url)),
    "utf8",
  );

  ok(manifest.includes("-ingester.ring.replication-factor=1"));
});

function parseOrgHealthDashboard(manifest: string): Dashboard {
  const marker = "  org-health.json: |";
  const start = manifest.indexOf(marker);
  ok(start >= 0, "org-health dashboard JSON block must be present");
  const nextDocument = manifest.indexOf("\n---", start);
  const block = manifest
    .slice(start + marker.length, nextDocument === -1 ? undefined : nextDocument)
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => (line.startsWith("    ") ? line.slice(4) : line))
    .join("\n");
  return JSON.parse(block) as Dashboard;
}

function panelByTitle(dashboard: Dashboard, title: string): DashboardPanel {
  const panel = dashboard.panels.find((candidate) => candidate.title === title);
  ok(panel !== undefined, `dashboard panel '${title}' must be present`);
  return panel;
}

function firstExpr(panel: DashboardPanel): string | undefined {
  return panel.targets?.[0]?.expr;
}

function alertRuleBlock(manifest: string, uid: string): string {
  const start = manifest.indexOf(`          - uid: ${uid}`);
  ok(start >= 0, `alert rule '${uid}' must be present`);
  const nextRule = manifest.indexOf("\n          - uid:", start + 1);
  const nextDocument = manifest.indexOf("\n---", start + 1);
  const endCandidates = [nextRule, nextDocument].filter((index) => index >= 0);
  const end = endCandidates.length === 0 ? manifest.length : Math.min(...endCandidates);
  return manifest.slice(start, end);
}
