/**
 * installer-parity.test.ts — work item 081M3YY6TWX087G0R003HZTVWQ.
 *
 * On 2026-10-02 several faults on the owner's node (node-5b2dfa) were fixed at RUNTIME, without a
 * reinstall. This file pins the EQUIVALENT durable fixes in the installer / NixOS modules, so the next
 * ISO carries them natively:
 *
 *   (a) inbound TCP 443 on the node (and 80 deliberately NOT);
 *   (b) the node's own resolver answers gitlab.<d> / registry.<d>, from the same public-domain file
 *       the TLS module reads, via the loopback relay that GitOps ships;
 *   (c) the relay those two rely on still exists, listens on :443 on the host network and is in the
 *       base set the root Application applies;
 *   (d) kubelet image GC starts below the eviction line (read from the generator script, not restated);
 *   (e) key-based sudo is opt-in and nothing grants passwordless root;
 *   (f) the installer-rendered GitLab parameters do not override the registry/object-store settings of
 *       PR #17865, and the committed Application still carries them;
 *   (g) the router guidance names the NODE, not a LoadBalancer address.
 *
 * Nix text is comment-stripped before every check, so a module's rationale can never satisfy an assertion.
 *
 * WHAT THIS CANNOT PROVE (recorded, not implied): nix is not run here. That NixOS renders the firewall
 * rule and the /etc/hosts line, that containerd then pulls through the relay, that the router delivers to
 * the node, and that PAM accepts an agent signature are shown only by an install. The CI eval check
 * `installer-parity-model` (nixos/tests/installer-parity-eval-test.nix) pins the real hosts' evaluated
 * values; it too is not run on the authoring machine.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml, parseAllDocuments } from "yaml";
import { renderPublicTlsApplicationText } from "./public-tls.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const CLUSTER = join(REPO_ROOT, "full-ai-cluster");
const read = (...p: string[]): string => readFileSync(join(CLUSTER, ...p), "utf8");

const stripNixComments = (text: string): string =>
  text
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .map((line) => line.replace(/\s+#\s.*$/, ""))
    .join("\n");

const nix = (...p: string[]): string => stripNixComments(read(...p));

const SERVER = nix("nixos", "modules", "k3s-server.nix");
const AGENT = nix("nixos", "modules", "k3s-agent.nix");
const COMMON = nix("nixos", "modules", "common.nix");
const FIREWALL = nix("nixos", "modules", "node-public-https.nix");
const HOSTS_MODULE = nix("nixos", "modules", "injected-public-hosts.nix");
const HOSTS_LIB = nix("nixos", "lib", "public-hosts.nix");
const TLS_MODULE = nix("nixos", "modules", "injected-public-tls.nix");
const PROTECTION = nix("nixos", "modules", "k3s-process-protection.nix");
const SUDO = nix("nixos", "modules", "operator-sudo.nix");

describe("(a) inbound TCP 443 on every node, 80 deliberately closed", () => {
  const ports = /allowedTCPPorts\s*=\s*\[([^\]]*)\]/.exec(FIREWALL)?.[1] ?? "";

  test("node-public-https.nix opens 443 and not 80", () => {
    const list = ports.split(/\s+/).filter((t) => /^[0-9]+$/.test(t)).map(Number);
    expect(list).toContain(443);
    expect(list).not.toContain(80);
  });

  test("BOTH roles import it (the relay is a DaemonSet; a router can be pointed at any node)", () => {
    expect(SERVER).toMatch(/\.\/node-public-https\.nix/);
    expect(AGENT).toMatch(/\.\/node-public-https\.nix/);
  });

  test("the rule is unconditional: no read of the public-domain file gates it (a pure rebuild would close it silently)", () => {
    expect(FIREWALL).not.toContain("pathExists");
    expect(FIREWALL).not.toContain("readFile");
    expect(FIREWALL).not.toMatch(/mkIf/);
  });

  test("no other module opens 80 behind this decision's back", () => {
    for (const text of [SERVER, AGENT, COMMON]) {
      const open80 = [...text.matchAll(/allowedTCPPorts\s*=\s*\[([^\]]*)\]/g)].some((m) =>
        (m[1] ?? "").split(/\s+/).includes("80"),
      );
      expect(open80).toBe(false);
    }
  });
});

describe("(b) the node's own resolver answers the two public names the kubelet pulls through", () => {
  // The module's regex, lifted from the source and turned from a Nix string into a JS regex, so a
  // change to the Nix is what this test evaluates (not a copy of it).
  const nixPattern = /builtins\.match\s+"([^"]+)"\s+domain/.exec(HOSTS_LIB)?.[1] ?? "";
  const domainRe = new RegExp(`^(?:${nixPattern.replace(/\\\\/g, "\\")})$`);

  test("the pattern was found in the Nix source", () => {
    expect(nixPattern).not.toBe("");
  });

  test("it accepts real domains and refuses a newline-smuggled second /etc/hosts line", () => {
    expect(domainRe.test("flowdent.net")).toBe(true);
    expect(domainRe.test("a.b.example-corp.io")).toBe(true);
    expect(domainRe.test("")).toBe(false);
    expect(domainRe.test("localhost")).toBe(false);
    expect(domainRe.test("evil.net\n10.0.0.1 x")).toBe(false);
    expect(domainRe.test("evil.net 10.0.0.1")).toBe(false);
    expect(domainRe.test("UPPER.NET")).toBe(false); // the module lower-cases before calling
  });

  test("only gitlab and registry, on loopback — never api.*, which stays on public DNS until cutover", () => {
    expect(HOSTS_LIB).toMatch(/labels\s*=\s*\[\s*"gitlab"\s+"registry"\s*\]/);
    expect(HOSTS_LIB).toMatch(/relayAddress\s*=\s*"127\.0\.0\.1"/);
    expect(HOSTS_LIB).not.toMatch(/"api"|"api-staging"|"git"|"portal"/);
  });

  test("it reads the SAME file the TLS module reads, so there is one source for the domain", () => {
    const file = (t: string) => /domainFile\s*=\s*"([^"]+)"/.exec(t)?.[1];
    expect(file(HOSTS_MODULE)).toBe("/etc/zeta/public-domain");
    expect(file(HOSTS_MODULE)).toBe(file(TLS_MODULE));
  });

  test("it is imported by common.nix (every host) and merges into networking.hosts rather than replacing it", () => {
    expect(COMMON).toMatch(/\.\/injected-public-hosts\.nix/);
    expect(HOSTS_MODULE).toMatch(/networking\.hosts\s*=\s*lib\.mkIf\s+config\.services\.k3s\.enable\s+\(publicHosts\.hostsFor domain\)/);
  });

  test("the module lower-cases the domain before the case-strict shape check", () => {
    expect(HOSTS_MODULE).toMatch(/domain\s*=\s*lib\.toLower\s*\(readTrimmed domainFile\)/);
  });
});

describe("(c) the relay the loopback names depend on is real, on the host network, and in the base set", () => {
  const FILE = join(CLUSTER, "k8s", "applications", "cluster-hygiene", "node-lan-hosts.yaml");
  // One syscall, one answer (no exists-then-read window): a missing file is null here and FAILS the
  // first test below rather than skipping, because a skipped dependency check is the vacuity this repo refuses.
  const manifest = ((): string | null => {
    try {
      return readFileSync(FILE, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  })();

  test("node-lan-hosts.yaml exists on this tree", () => {
    expect(manifest).not.toBeNull();
  });

  const ds = (() => {
    if (manifest === null) return null;
    const docs = parseAllDocuments(manifest).map((d) => d.toJSON() as Record<string, unknown>);
    return docs.find((d) => d?.["kind"] === "DaemonSet") ?? null;
  })();

  test("a DaemonSet on the host network, tolerating every taint (it must run through disk pressure)", () => {
    expect(ds).not.toBeNull();
    const spec = (ds?.["spec"] as { template: { spec: Record<string, unknown> } }).template.spec;
    expect(spec["hostNetwork"]).toBe(true);
    expect(JSON.stringify(spec["tolerations"])).toContain('"operator":"Exists"');
  });

  test("a container listens on :443 and passes every non-API name through to the Gateway unchanged", () => {
    const spec = (ds?.["spec"] as { template: { spec: { containers: { args?: string[] }[] } } }).template.spec;
    const all = spec.containers.flatMap((c) => c.args ?? []).join("\n");
    // The relay has had two shapes: a socat `TCP-LISTEN:443` passthrough (#17867) and an SNI-routing
    // haproxy edge whose DEFAULT backend is that same passthrough (#17872). gitlab./registry. are not
    // API names, so either way they reach the Gateway byte-for-byte; the loopback pin needs exactly that.
    expect(all).toMatch(/TCP-LISTEN:443|EDGE_PORT:-443/);
    expect(all).toMatch(/TCP-LISTEN:443|default_backend be_gateway/);
  });

  test("it lives in a directory the root Application recurses into, via its own Application", () => {
    const root = parseYaml(readFileSync(join(CLUSTER, "k8s", "bootstrap", "root-application.yaml"), "utf8")) as {
      spec: { source: { path: string; directory: { recurse: boolean } } };
    };
    expect(root.spec.source.directory.recurse).toBe(true);
    expect(root.spec.source.path).toBe("full-ai-cluster/k8s/applications");
    const app = parseYaml(readFileSync(join(CLUSTER, "k8s", "applications", "cluster-hygiene", "Application.yaml"), "utf8")) as {
      spec: { source: { path: string } };
    };
    expect(app.spec.source.path).toBe("full-ai-cluster/k8s/applications/cluster-hygiene");
  });
});

describe("(d) kubelet image GC starts BELOW the eviction line, and container logs are bounded", () => {
  const flags = PROTECTION;
  const num = (key: string): number => {
    const m = new RegExp(`--kubelet-arg=${key}=([0-9]+)"`).exec(flags);
    if (m?.[1] === undefined) throw new Error(`${key} is not a numeric --kubelet-arg in k3s-process-protection.nix`);
    return Number(m[1]);
  };
  // The eviction line is READ from the generator that owns it, not restated.
  const script = readFileSync(join(CLUSTER, "nixos", "modules", "k3s-kubelet-reservations.sh"), "utf8");
  const evictionFree = Number(/imagefs\.available<([0-9]+)%/.exec(script)?.[1]);
  const evictionUsed = 100 - evictionFree;

  test("the eviction threshold was found in the generator script", () => {
    expect(Number.isFinite(evictionFree)).toBe(true);
    expect(evictionFree).toBeGreaterThan(0);
  });

  test("high > low, and GC starts at least 5 points before the eviction line (the defaults 85/80 sat ON it)", () => {
    const high = num("image-gc-high-threshold");
    const low = num("image-gc-low-threshold");
    expect(low).toBeLessThan(high);
    expect(high + 5).toBeLessThanOrEqual(evictionUsed);
    // the measured defaults, so the test would fail if someone "restored" them
    expect(high).not.toBe(85);
  });

  test("the eviction-hard map is untouched here (that flag replaces the whole map; the boot generator owns it)", () => {
    expect(PROTECTION).not.toContain("--kubelet-arg=eviction-hard");
    expect(SERVER).not.toContain("--kubelet-arg=eviction-hard");
  });

  test("container logs: size restated, file count lowered below the default of 5", () => {
    expect(flags).toContain('"--kubelet-arg=container-log-max-size=10Mi"');
    expect(num("container-log-max-files")).toBeLessThan(5);
  });

  test("both roles inherit it (k3s-process-protection.nix is imported by each)", () => {
    expect(SERVER).toMatch(/\.\/k3s-process-protection\.nix/);
    expect(AGENT).toMatch(/\.\/k3s-process-protection\.nix/);
  });
});

describe("(e) operator sudo: key-based is opt-in, nothing grants passwordless root", () => {
  test("zeta.operatorSudo.sshAgentAuth defaults to false", () => {
    expect(SUDO).toMatch(/sshAgentAuth\s*=\s*lib\.mkOption\s*\{[^}]*type\s*=\s*lib\.types\.bool;[^}]*default\s*=\s*false;/s);
  });

  test("the PAM settings are reachable ONLY under the option", () => {
    const guarded = /lib\.mkIf cfg\.sshAgentAuth\s*\{([\s\S]*?)\n\s{4}\}\)/.exec(SUDO)?.[1] ?? "";
    // ONE switch: nixos sudo.nix already sets the per-service flag true on every host, so the global
    // `security.pam.sshAgentAuth.enable` is what turns the rule on (found by the first CI eval).
    expect(guarded).toContain("security.pam.sshAgentAuth.enable = true;");
    const outside = SUDO.replace(guarded, "");
    expect(outside).not.toContain("security.pam.sshAgentAuth.enable = true");
  });

  test("common.nix imports it, and the password requirement is not weakened anywhere in the modules", () => {
    expect(COMMON).toMatch(/\.\/operator-sudo\.nix/);
    // Positive accounting rather than an absence assertion: every assignment of wheelNeedsPassword across
    // the modules, and a count of NOPASSWD, must equal exactly the one known-good state.
    const wheel: string[] = [];
    let nopasswd = 0;
    for (const f of ["common.nix", "k3s-server.nix", "k3s-agent.nix", "operator-sudo.nix", "initial-password.nix"]) {
      const t = nix("nixos", "modules", f);
      wheel.push(...[...t.matchAll(/wheelNeedsPassword\s*=\s*([^;]+);/g)].map((m) => (m[1] ?? "").trim()));
      nopasswd += (t.match(/NOPASSWD/g) ?? []).length;
    }
    expect(wheel).toEqual(["lib.mkDefault true"]);
    expect(nopasswd).toBe(0);
  });

  test("the break-glass runbook exists, warns off the auto-installing USB, and names the no-wipe commands", () => {
    const doc = readFileSync(join(REPO_ROOT, "docs", "ops", "OPERATOR-SUDO-BREAK-GLASS.md"), "utf8");
    expect(doc).toContain("nixos-enter --root /mnt");
    expect(doc).toContain("not* the Zeta installer USB");
    expect(doc).toContain("NOPASSWD");
  });
});

describe("(f) GitLab registry streaming survives the install-time render", () => {
  const gitlab = readFileSync(join(CLUSTER, "k8s", "applications", "gitlab", "Application.yaml"), "utf8");

  test("the committed Application still disables the registry's blob redirect and pins proxy_download", () => {
    expect(gitlab).toMatch(/redirect:\s*\n\s*disable:\s*true/);
    expect(gitlab).toMatch(/proxy_download:\s*true/);
  });

  test("the installer's rendered Application patches hostnames only — never registry.storage or object_store", () => {
    const rendered = renderPublicTlsApplicationText({ acmeEmail: "ops@zeta-cluster-fixture.net", publicDomain: "zeta-cluster-fixture.net" });
    for (const forbidden of ["storage", "redirect", "proxy_download", "object_store", "regionendpoint"]) {
      expect(rendered).not.toContain(forbidden);
    }
  });
});

describe("(g) the router guidance names the NODE, not a LoadBalancer address", () => {
  const stale = /forward TCP \*?\*?80\*?\*? and \*?\*?443\*?\*? to the public gateway/;

  test("zeta-install.sh banner, DOMAIN-SETUP.md and INJECTION-POINTS.md no longer say it", () => {
    for (const [name, text] of [
      ["zeta-install.sh", read("usb-nixos-installer", "zeta-install.sh")],
      ["DOMAIN-SETUP.md", read("DOMAIN-SETUP.md")],
      ["INJECTION-POINTS.md", read("INJECTION-POINTS.md")],
    ] as const) {
      expect([name, stale.test(text)]).toEqual([name, false]);
    }
    expect(read("DOMAIN-SETUP.md")).toMatch(/Port-forward \*\*to the machine/);
    expect(read("INJECTION-POINTS.md")).toMatch(/forward TCP \*\*443\*\* to \*\*the node\*\*/);
  });

  test("the ADR and the install-time inventory rows exist", () => {
    const adr = join(REPO_ROOT, "docs", "DECISIONS", "2026-10-02-the-router-reaches-the-node-not-a-loadbalancer-address-so-the-node-serves-443-itself.md");
    expect(readFileSync(adr, "utf8")).toContain("Status:");
    const inv = readFileSync(join(REPO_ROOT, "docs", "ops", "INSTALL-TIME-CONFIG.md"), "utf8");
    for (const row of [30, 31, 32, 33, 34]) expect(inv).toContain(`| ${row} |`);
  });
});
