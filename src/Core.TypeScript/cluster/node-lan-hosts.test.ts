/**
 * node-lan-hosts.test.ts -- falsifiers for `cluster-hygiene/node-lan-hosts.yaml`.
 *
 * MEASURED 2026-10-02: the kubelet could not pull `registry.flowdent.net/...` because the node resolved it
 * to the public IP and the router has no 443 forward. The fix is a DaemonSet that bind-mounts a hosts file
 * pinning gitlab./registry. to the Gateway's LB address. This file RUNS its `apply` script (ONCE=1, fake
 * host, `echo` for the mount) over the cases that matter, because the first live version of that script
 * mounted a hosts file holding ONLY the block -- no `localhost`, no `control-plane` -- and the node briefly
 * lost its own API-server name. The "base lost its entries" case below is that incident, pinned.
 *
 * CANNOT PROVE: the bind mount on a real NixOS node, or that the Gateway status carries the LB address.
 */

import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse as parseYaml, parseAllDocuments } from "yaml";

type Doc = Record<string, unknown>;
const HYGIENE = resolve(import.meta.dir, "../../../full-ai-cluster/k8s/applications/cluster-hygiene");
const docs = parseAllDocuments(readFileSync(join(HYGIENE, "node-lan-hosts.yaml"), "utf8")).map((d) => d.toJS() as Doc);
const ds = docs.find((d) => d["kind"] === "DaemonSet") as Doc;
const containers = (((ds["spec"] as Doc)["template"] as Doc)["spec"] as Doc)["containers"] as Doc[];
const scriptOf = (name: string): string =>
  ((containers.find((c) => c["name"] === name) as Doc)["args"] as string[])[0]!;

describe("render", () => {
  test("the Application applies it, and its namespace is the one privileged namespace it needs", () => {
    const app = parseYaml(readFileSync(join(HYGIENE, "Application.yaml"), "utf8")) as Doc;
    const include = (((app["spec"] as Doc)["source"] as Doc)["directory"] as Doc)["include"] as string;
    expect(include).toContain("node-lan-hosts");
    const ns = docs.find((d) => d["kind"] === "Namespace") as Doc;
    expect(((ns["metadata"] as Doc)["labels"] as Doc)["pod-security.kubernetes.io/enforce"]).toBe("privileged");
  });

  test("only gitlab./registry. are pinned -- never api.* (still Azure until the cutover)", () => {
    const discover = scriptOf("discover");
    expect(discover).toContain("(gitlab|registry)");
    expect(discover).not.toMatch(/\bapi[.-]/); // a hostname, not the `apiVersion:` of the relay Service manifest
  });

  test("the 443 relay: node network, :443, target discovered (never hardcoded), one capability", () => {
    const spec = ((ds["spec"] as Doc)["template"] as Doc)["spec"] as Doc;
    expect(spec["hostNetwork"]).toBe(true);
    const fwd = scriptOf("forward");
    expect(fwd).toContain("TCP-LISTEN:443");
    expect(fwd).toContain("/shared/block");
    expect(fwd).not.toMatch(/192\.168\./);
    const sc = (containers.find((c) => c["name"] === "forward") as Doc)["securityContext"] as Doc;
    expect(sc["privileged"]).toBeUndefined();
    expect((sc["capabilities"] as Doc)["add"]).toEqual(["NET_BIND_SERVICE"]);
  });

  test("RBAC is read-only on the one Gateway", () => {
    const role = docs.find((d) => d["kind"] === "Role") as Doc;
    const rule = (role["rules"] as Doc[])[0]!;
    expect(rule["verbs"]).toEqual(["get"]);
    expect(rule["resourceNames"]).toEqual(["zeta-public-gateway"]);
  });
});

const BASE = "127.0.0.1 localhost\n::1 localhost\n127.0.0.1 control-plane\n127.0.0.2 node\n";
const BLOCK = "192.168.1.240 gitlab.x.net # zeta-lan-hosts\n192.168.1.240 registry.x.net # zeta-lan-hosts\n";

describe("apply script, executed", () => {
  const withRun = (hosts: string, block: string, opts: { hasRule?: boolean } = {}) => {
    const dir = mkdtempSync(join(tmpdir(), "nlh-")).replace(/\\/g, "/");
    mkdirSync(`${dir}/run`);
    writeFileSync(`${dir}/hosts`, hosts);
    writeFileSync(`${dir}/block`, block);
    writeFileSync(
      `${dir}/fakemount`,
      `#!/bin/sh
echo "$@" > ${dir}/mounts
`,
    );
    chmodSync(`${dir}/fakemount`, 0o755);
    // fakeipt: `-C` (is the rule there?) fails unless $dir/has-rule exists; `-I` records the insert.
    writeFileSync(`${dir}/fakeipt`, `#!/bin/sh
[ "$1" = "-C" ] && [ -e ${dir}/has-rule ] && exit 0
[ "$1" = "-C" ] && exit 1
echo "$@" >> ${dir}/ipt-inserts
`);
    chmodSync(`${dir}/fakeipt`, 0o755);
    if (opts.hasRule) writeFileSync(`${dir}/has-rule`, "");
    const r = Bun.spawnSync(["sh", "-c", scriptOf("apply")], {
      env: {
        ...process.env,
        ONCE: "1",
        HOST: dir,
        SHARED: dir,
        WORK: dir,
        HREAD: `cat ${dir}/hosts`,
        MOUNT: `${dir}/fakemount`,
        IPT: `${dir}/fakeipt`,
      },
    });
    expect(r.exitCode).toBe(0);
    // One syscall, one answer: read and interpret ENOENT, rather than existsSync-then-read
    // (a check-then-use race the hygiene lint rejects, CWE-367).
    const readOrNull = (f: string): string | null => {
      try {
        return readFileSync(f, "utf8");
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw e;
      }
    };
    return {
      state: readOrNull(`${dir}/run/zeta-lan-hosts`),
      mounted: readOrNull(`${dir}/mounts`) !== null,
      inserts: readOrNull(`${dir}/ipt-inserts`) ?? "",
    };
  };

  test("fresh host: base lines AND the block are mounted", () => {
    const r = withRun(BASE, BLOCK);
    expect(r.state).toBe(BASE + BLOCK);
    expect(r.mounted).toBe(true);
  });

  test("already mounted, block changed: rewritten in place, NOT mounted again", () => {
    const r = withRun(BASE + BLOCK, BLOCK.replace(/240/g, "241"));
    expect(r.state).toBe(BASE + BLOCK.replace(/240/g, "241"));
    expect(r.mounted).toBe(false);
  });

  test("the incident: a base that lost localhost is NEVER mounted", () => {
    const r = withRun("# nothing readable\n", BLOCK);
    expect(r.state).toBeNull();
    expect(r.mounted).toBe(false);
  });

  test("firewall: the :443 ACCEPT is inserted first in nixos-fw when absent, and NOT again when present", () => {
    expect(withRun(BASE, BLOCK).inserts).toBe("-I nixos-fw 1 -p tcp --dport 443 -j nixos-fw-accept\n");
    expect(withRun(BASE, BLOCK, { hasRule: true }).inserts).toBe("");
  });

  test("no block yet (discover has not answered): nothing happens", () => {
    const r = withRun(BASE, "");
    expect(r.state).toBeNull();
    expect(r.mounted).toBe(false);
  });
});
