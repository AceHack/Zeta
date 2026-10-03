/**
 * node-lan-hosts-edge.test.ts -- falsifiers for the :443 `edge` half of node-lan-hosts.yaml.
 *
 * MEASURED 2026-10-02: a byte-for-byte relay on the node's :443 re-originates every connection from the node, so
 * every outside client shared ONE per-IP rate-limit bucket (after one client sent 100 requests, probes from 7
 * countries all got 429). The edge terminates TLS for the API hostnames and forwards the REAL client address in
 * X-Forwarded-For; every other hostname is passed through to the Gateway untouched.
 *
 * Two regressions this pins, both of which happened on the live node the first time:
 *   - the internal hop was an abstract unix socket; a reload could not re-bind it, so EVERY reload failed and the
 *     old (passthrough-only) config kept serving -- silently reverting to the shared bucket. It is loopback TCP now.
 *   - "unknown is not remove": a failed read of a certificate must keep the previous set.
 *
 * CANNOT PROVE: a real haproxy parse (the live node ran `haproxy -c` on the generated config and a broken config
 * exits 1), or a reload under traffic. The live node proved the behaviour: client A limited at 100 while client B
 * (a different source address) was untouched.
 */

import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
const scriptOf = (name: string): string =>
  ((containers.find((c) => c["name"] === name) as Doc)["args"] as string[])[0]!;

const tmp = (): string => mkdtempSync(join(tmpdir(), "nlhe-")).replace(/\\/g, "/");
const read = (f: string): string | null => {
  try {
    return readFileSync(f, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
};

describe("render", () => {
  test("RBAC: the edge reads exactly the two API certificate Secrets, nothing else", () => {
    const role = docs.find(
      (d) => d["kind"] === "Role" && ((d["metadata"] as Doc)["name"] as string) === "node-lan-hosts-read-api-certs",
    ) as Doc;
    expect((role["metadata"] as Doc)["namespace"]).toBe("zeta-platform");
    const rules = role["rules"] as Doc[];
    expect(rules).toHaveLength(1);
    expect(rules[0]).toEqual({
      apiGroups: [""],
      resources: ["secrets"],
      resourceNames: ["flowdent-api-tls", "flowdent-api-staging-tls"],
      verbs: ["get"],
    });
  });
});

/** Run the edge script once with a stub haproxy; `valid` controls what `haproxy -c` says. */
function runEdge(opts: { block: boolean; upstreams?: string; valid?: boolean }) {
  const dir = tmp();
  mkdirSync(`${dir}/edge/pem`, { recursive: true });
  mkdirSync(`${dir}/work`);
  if (opts.block) writeFileSync(`${dir}/block`, "192.168.1.240 gitlab.x.net # zeta-lan-hosts\n");
  if (opts.upstreams !== undefined) writeFileSync(`${dir}/edge/upstreams`, opts.upstreams);
  writeFileSync(`${dir}/edge/pem/api.x.net.pem`, "PEM");
  writeFileSync(
    `${dir}/haproxy`,
    ["#!/bin/sh", `[ "$1" = "-c" ] && exit ${opts.valid === false ? 1 : 0}`, "sleep 1", ""].join("\n"),
  );
  chmodSync(`${dir}/haproxy`, 0o755);
  const r = Bun.spawnSync(["bash", "-c", scriptOf("edge")], {
    env: { ...process.env, ONCE: "1", SHARED: dir, WORK: `${dir}/work`, HAPROXY: `${dir}/haproxy` },
  });
  expect(r.exitCode).toBe(0);
  return { cfg: read(`${dir}/work/haproxy.cfg`), stderr: new TextDecoder().decode(r.stderr) };
}

describe("edge script, executed", () => {
  test("API hostnames are TLS-terminated with the real client address; everything else passes through", () => {
    const { cfg } = runEdge({ block: true, upstreams: "api.x.net flowdent-prod\napi-staging.x.net flowdent-staging\n" });
    expect(cfg).toContain("use_backend be_api if { req.ssl_sni -i api.x.net api-staging.x.net }");
    expect(cfg).toContain("default_backend be_gateway");
    expect(cfg).toContain("server gw 192.168.1.240:443");
    // the real client address crosses the internal hop via PROXY protocol and leaves as X-Forwarded-For
    expect(cfg).toContain("send-proxy-v2");
    expect(cfg).toContain("accept-proxy ssl crt");
    expect(cfg).toContain("http-request del-header X-Forwarded-For"); // a client-supplied one is discarded
    expect(cfg).toContain("option forwardfor");
    expect(cfg).toContain("server a flowdent-api.flowdent-prod.svc.cluster.local:80");
    expect(cfg).toContain("server a flowdent-api.flowdent-staging.svc.cluster.local:80");
  });

  test("plain HTTP on the node is redirected to HTTPS, whatever the host (the router can send :80 to any address)", () => {
    const { cfg } = runEdge({ block: true });
    expect(cfg).toContain("frontend fe_http");
    expect(cfg).toContain("bind :80");
    expect(cfg).toContain("http-request redirect scheme https code 301");
  });

  test("the internal hop is loopback TCP -- an abstract unix socket cannot be reloaded (the live incident)", () => {
    const { cfg } = runEdge({ block: true, upstreams: "api.x.net flowdent-prod\n" });
    expect(cfg).not.toContain("abns@");
    expect(cfg).toContain("bind 127.0.0.1:18443 accept-proxy");
    expect(cfg).toContain("server term 127.0.0.1:18443 send-proxy-v2");
  });

  test("no certificates/upstreams yet: pure passthrough (nothing terminates TLS)", () => {
    const { cfg } = runEdge({ block: true });
    expect(cfg).toContain("server gw 192.168.1.240:443");
    expect(cfg).not.toContain("be_api");
    expect(cfg).not.toContain("fe_term");
  });

  test("an INVALID config is refused and nothing is written (the running one keeps serving)", () => {
    const r = runEdge({ block: true, upstreams: "api.x.net flowdent-prod\n", valid: false });
    expect(r.cfg).toBeNull();
    expect(r.stderr).toContain("refusing an invalid haproxy config");
  });

  test("no Gateway address yet: nothing is generated", () => {
    expect(runEdge({ block: false, upstreams: "api.x.net flowdent-prod\n" }).cfg).toBeNull();
  });
});

/** Run the discover script once against a stub kubectl. */
function runDiscover(opts: { failSecret?: boolean; seedOld?: boolean }) {
  const dir = tmp();
  mkdirSync(`${dir}/edge/pem`, { recursive: true });
  if (opts.seedOld) {
    writeFileSync(`${dir}/edge/upstreams`, "old.x.net flowdent-prod\n");
    writeFileSync(`${dir}/edge/pem/old.x.net.pem`, "OLD");
  }
  writeFileSync(
    `${dir}/rows`,
    [
      "http||",
      "https|portal.x.net|portal-tls",
      "https-gitlab|gitlab.x.net|gitlab-tls",
      "https-flowdent-api|api.x.net|flowdent-api-tls",
      "https-flowdent-api-staging|api-staging.x.net|flowdent-api-staging-tls",
      "",
    ].join("\n"),
  );
  writeFileSync(
    `${dir}/kubectl`,
    [
      "#!/bin/sh",
      'case "$*" in',
      `  *"get svc"*) printf '192.168.1.240|80 443\\n' ;;`,
      `  *"get gateway"*certificateRefs*) cat ${dir}/rows ;;`,
      '  *"get gateway"*addresses*) printf 192.168.1.240 ;;',
      `  *"get gateway"*) printf 'gitlab.x.net\\nregistry.x.net\\n' ;;`,
      `  *"get secret"*crt*) ${opts.failSecret ? "exit 1" : "printf CRT | base64 -w0"} ;;`,
      '  *"get secret"*key*) printf KEY | base64 -w0 ;;',
      `  *apply*) cat > ${dir}/applied ;;`,
      "esac",
      "",
    ].join("\n"),
  );
  chmodSync(`${dir}/kubectl`, 0o755);
  const r = Bun.spawnSync(["bash", "-c", scriptOf("discover")], {
    env: { ...process.env, ONCE: "1", SHARED: dir, PATH: `${dir}:${process.env["PATH"]}` },
  });
  expect(r.exitCode).toBe(0);
  return {
    upstreams: read(`${dir}/edge/upstreams`),
    pemApi: read(`${dir}/edge/pem/api.x.net.pem`),
    pemOld: read(`${dir}/edge/pem/old.x.net.pem`),
  };
}

describe("discover edge sync, executed", () => {
  test("only the two API listeners become upstreams, mapped to the right namespace; the PEM is cert + key", () => {
    const r = runDiscover({});
    expect(r.upstreams).toBe("api.x.net flowdent-prod\napi-staging.x.net flowdent-staging\n");
    expect(r.pemApi).toContain("CRT");
    expect(r.pemApi).toContain("KEY");
  });

  test("a FAILED certificate read keeps the previous set (unknown is not 'remove')", () => {
    const r = runDiscover({ failSecret: true, seedOld: true });
    expect(r.upstreams).toBe("old.x.net flowdent-prod\n");
    expect(r.pemOld).toBe("OLD");
    expect(r.pemApi).toBeNull();
  });
});
