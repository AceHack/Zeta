/**
 * node-lan-hosts-relay.test.ts -- falsifiers for the `https-relay` half of node-lan-hosts.yaml.
 *
 * MEASURED 2026-10-02: the home router forwards :443 to whichever of the node's addresses (they share one MAC:
 * .79 and every Cilium LB IP) it last associated, and it moved from a working address to 192.168.1.250 (the
 * gitlab-lan Gateway, :80 only) -- production vanished from the internet while every in-cluster check stayed
 * green. `discover` therefore keeps ONE Service whose externalIPs are every LoadBalancer address that does not
 * already serve :443. This file RUNS that script (ONCE=1) against a stub `kubectl` over the decisions that matter.
 *
 * CANNOT PROVE: that Cilium honours externalIPs on a real node -- only the live node did (every address answered).
 */

import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseAllDocuments } from "yaml";

// These tests spawn bash several times each; on a loaded Windows box that exceeds the 5s default.
setDefaultTimeout(30_000);

type Doc = Record<string, unknown>;
const FILE = resolve(import.meta.dir, "../../../full-ai-cluster/k8s/applications/cluster-hygiene/node-lan-hosts.yaml");
const docs = parseAllDocuments(readFileSync(FILE, "utf8")).map((d) => d.toJS() as Doc);
const ds = docs.find((d) => d["kind"] === "DaemonSet") as Doc;
const containers = (((ds["spec"] as Doc)["template"] as Doc)["spec"] as Doc)["containers"] as Doc[];
const discover = ((containers.find((c) => c["name"] === "discover") as Doc)["args"] as string[])[0]!;

describe("render", () => {
  test("RBAC: cluster-wide LIST of services only; writes confined to the two relay Services in their own namespace", () => {
    const cr = docs.find((d) => d["kind"] === "ClusterRole") as Doc;
    expect(cr["rules"]).toEqual([{ apiGroups: [""], resources: ["services"], verbs: ["list"] }]);
    const roles = docs.filter((d) => d["kind"] === "Role" && ((d["metadata"] as Doc)["namespace"] as string) === "zeta-node-hosts");
    expect(roles).toHaveLength(1);
    const rules = (roles[0] as Doc)["rules"] as Doc[];
    expect(rules.find((r) => (r["verbs"] as string[]).includes("patch"))?.["resourceNames"]).toEqual(["https-relay", "ssh-relay", "http-relay"]);
  });
});

// Fixture rows are `<LB ips>|<ports>` exactly as the kubectl jsonpath prints them.
const SERVICES = [
  "192.168.1.240|80 443", // the public Gateway: serves :443 itself
  "192.168.1.250|80", // gitlab-lan Gateway
  "192.168.1.241|80",
  "192.168.1.242|27015 27015", // a game server
  "|8080", // a ClusterIP-style service: no LB address
  "",
].join("\n");

function run(opts: { services: string; failServices?: boolean }): { applied: string | null } {
  const dir = mkdtempSync(join(tmpdir(), "nlhr-")).replace(/\\/g, "/");
  writeFileSync(`${dir}/services.txt`, opts.services);
  // Stub kubectl: gateway reads answer; `get svc` prints the fixture (or fails); `apply` records stdin.
  writeFileSync(
    `${dir}/kubectl`,
    [
      "#!/bin/sh",
      'case "$*" in',
      `  *"get svc"*) ${opts.failServices ? "exit 1" : `cat ${dir}/services.txt`} ;;`,
      '  *"get gateway"*"addresses"*) printf "192.168.1.240" ;;',
      '  *"get gateway"*) printf "gitlab.x.net\\nregistry.x.net\\n" ;;',
      `  *apply*) { cat; echo '###'; } >> ${dir}/applied ;;`, // one record per applied Service, '###'-separated
      "esac",
      "",
    ].join("\n"),
  );
  chmodSync(`${dir}/kubectl`, 0o755);
  const r = Bun.spawnSync(["bash", "-c", discover], {
    env: { ...process.env, ONCE: "1", SHARED: dir, PATH: `${dir}:${process.env["PATH"]}` },
  });
  expect(r.exitCode).toBe(0);
  let applied: string | null;
  try {
    applied = readFileSync(`${dir}/applied`, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    applied = null;
  }
  return { applied };
}

/** The applied Service with this name, or undefined. */
const svcOf = (applied: string | null, name: string): string | undefined =>
  applied?.split("###").find((d) => d.includes(`name: ${name}\n`));

describe("discover script, executed", () => {
  test("https-relay: every LB address that lacks :443, skipping the one that already serves it", () => {
    const https = svcOf(run({ services: SERVICES }).applied, "https-relay");
    expect(https).toContain('externalIPs: ["192.168.1.241","192.168.1.242","192.168.1.250"]');
    expect(https).not.toContain("192.168.1.240");
    expect(https).toContain("port: 443, targetPort: 443");
    expect(https).toContain("selector: { app: node-lan-hosts }");
  });

  test("ssh-relay: EVERY LB address (none serves :22 -- the Gateway's :443 is irrelevant), to the node's sshd", () => {
    const ssh = svcOf(run({ services: SERVICES }).applied, "ssh-relay");
    expect(ssh).toContain('externalIPs: ["192.168.1.240","192.168.1.241","192.168.1.242","192.168.1.250"]');
    expect(ssh).toContain("port: 22, targetPort: 22");
    expect(ssh).toContain("selector: { app: node-lan-hosts }"); // the hostNetwork pod IS the node: its :22 is sshd
  });

  test("http-relay: only the LB addresses that lack :80 (the router can bind plain HTTP to any of them)", () => {
    const http = svcOf(run({ services: SERVICES }).applied, "http-relay");
    expect(http).toContain('externalIPs: ["192.168.1.242"]'); // .240 .241 .250 already serve :80; the game server does not
    expect(http).toContain("port: 80, targetPort: 80");
    expect(http).toContain("selector: { app: node-lan-hosts }");
  });

  test("an address that already serves :22 is left alone", () => {
    const ssh = svcOf(run({ services: SERVICES + "192.168.1.250|22\n" }).applied, "ssh-relay");
    expect(ssh).not.toContain("192.168.1.250");
  });

  test("a FAILED listing applies nothing (unknown is not 'remove')", () => {
    expect(run({ services: "", failServices: true }).applied).toBeNull();
  });

  test("nothing to cover (every address already serves both ports) applies nothing", () => {
    expect(run({ services: "192.168.1.240|22 80 443\n" }).applied).toBeNull();
  });
});
