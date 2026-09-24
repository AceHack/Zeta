// k3s-agent-tls-self-heal.test.ts
//
// WP25 (081M38G8NGC087G0R001GEGEDK). EXECUTES
// `full-ai-cluster/nixos/modules/k3s-agent-tls-self-heal.sh` over fixture
// directories, rather than reading it -- same discipline as
// `lint-k3s-datastore-preflight.test.ts`.
//
// WHAT IT IS FOR. On the real USB-installed disk, k3s.service retried
// forever on zero-length agent cert/kubeconfig files left by an unclean
// stop (measured: run 35927439681, every file under
// /var/lib/rancher/k3s/agent at 0 bytes, "error loading key from
// .../serving-kubelet.key: <nil>" every ~8s for 70+ minutes). Fixing that
// alone was not the whole story -- a follow-up real CI run (WP25's own
// first re-run) proved the `<nil>` bug gone and then measured a SECOND,
// different failure at the same bootstrap endpoint: "node password not
// set" -- so the script under test now covers three targets, and this
// suite exercises all three independently. The script removes only
// zero-length files, before k3s starts, so k3s's own regeneration logic
// (dynamiclistener's LoadOrGenerateKeyFile for target 1; the agent/server
// node-password bootstrap for targets 2 and 3) sees a genuine "absent" and
// regenerates (full citation in the sibling `.nix` module).
//
// THE PROPERTY THAT MATTERS MOST is the negative one, same shape as the
// datastore-preflight suite: a zero-length file is removed, a NON-EMPTY
// file is NEVER removed (however small or suspicious), and nothing outside
// the three named targets is ever touched -- target 1 must refuse outright
// rather than widen its own scope if ever pointed at a "server" path, and
// targets 2/3 touch only their own exact, named path.
//
// PATH FORM: fixture paths are built with `posix.join` and passed to the
// script (which always runs under bash, including here on a Windows CI/dev
// box via Git Bash) as forward-slash paths throughout -- the shipped script
// only ever runs on NixOS/Linux, where paths are POSIX natively, so this
// keeps the test exercising the same path shape production sees rather than
// a Windows-only backslash artifact.

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { join as posixJoin } from "node:path/posix";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const SCRIPT = join(REPO_ROOT, "full-ai-cluster/nixos/modules/k3s-agent-tls-self-heal.sh");
const MODULE = join(REPO_ROOT, "full-ai-cluster/nixos/modules/k3s-agent-tls-self-heal.nix");
const SERVER_MODULE = join(REPO_ROOT, "full-ai-cluster/nixos/modules/k3s-server.nix");
const AGENT_MODULE = join(REPO_ROOT, "full-ai-cluster/nixos/modules/k3s-agent.nix");

/** A fresh temp root, expressed as a forward-slash (POSIX) path even on Windows. */
function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "zeta-tls-self-heal-")).replace(/\\/g, "/");
}

function inventory(dir: string): readonly string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = posixJoin(d, entry.name);
      if (entry.isDirectory()) {
        out.push(`${p}/`);
        walk(p);
      } else {
        out.push(`${p}:${String(statSync(p).size)}`);
      }
    }
  };
  walk(dir);
  return out.sort();
}

/** A fixture that mirrors the MEASURED defect: every agent file present but 0 bytes. */
function truncatedAgentFixture(): { readonly root: string; readonly agentDir: string } {
  const root = tempRoot();
  const agentDir = posixJoin(root, "var/lib/rancher/k3s/agent");
  mkdirSync(agentDir, { recursive: true });
  for (const name of [
    "client-kubelet.crt",
    "client-kubelet.key",
    "client-k3s-controller.crt",
    "client-k3s-controller.key",
    "client-kube-proxy.crt",
    "client-kube-proxy.key",
    "serving-kubelet.crt",
    "serving-kubelet.key",
    "k3scontroller.kubeconfig",
    "kubelet.kubeconfig",
    "kubeproxy.kubeconfig",
  ]) {
    writeFileSync(posixJoin(agentDir, name), "");
  }
  return { root, agentDir };
}

interface RunOpts {
  readonly agentDir: string;
  readonly serialDevice: string;
  /** Target 2. Defaults to a path that does not exist, so old callers stay a clean no-op. */
  readonly nodePasswordFile?: string;
  /** Target 3. Defaults to a path that does not exist, so old callers stay a clean no-op. */
  readonly serverNodePasswdFile?: string;
}

function run(opts: RunOpts): { readonly status: number; readonly stdout: string } {
  const result = spawnSync("bash", [SCRIPT], {
    env: {
      PATH: process.env.PATH ?? "/usr/bin:/bin",
      LC_ALL: "C",
      ZETA_K3S_AGENT_DIR: opts.agentDir,
      ZETA_SERIAL_DEVICE: opts.serialDevice,
      ZETA_K3S_NODE_PASSWORD_FILE: opts.nodePasswordFile ?? posixJoin(opts.serialDevice, "..", "no-such-node-password"),
      ZETA_K3S_SERVER_NODE_PASSWD_FILE: opts.serverNodePasswdFile ?? posixJoin(opts.serialDevice, "..", "no-such-node-passwd"),
    },
    encoding: "utf8",
    maxBuffer: 64 * 1024,
  });
  return { status: result.status ?? -1, stdout: `${result.stdout}${result.stderr}` };
}

describe("target 1 -- removes only zero-length files under the agent dir", () => {
  test("every zero-length file under the agent dir is removed, logged, and k3s can regenerate", () => {
    const { root, agentDir } = truncatedAgentFixture();
    const before = readdirSync(agentDir);
    expect(before.length).toBeGreaterThan(0);

    const r = run({ agentDir, serialDevice: posixJoin(root, "no-such-serial-device") });

    expect(r.status).toBe(0);
    const after = readdirSync(agentDir);
    expect(after).toEqual([]);
    for (const name of before) {
      expect(r.stdout).toContain(`removing zero-length file: ${posixJoin(agentDir, name)}`);
    }
    expect(r.stdout).toContain(`removed ${String(before.length)} zero-length file(s)`);
  });

  test("a non-empty file is NEVER removed, however small", () => {
    const { root, agentDir } = truncatedAgentFixture();
    // One file has real (if tiny) content -- the discriminator this script
    // must honour is size, not name or extension. The expected size is the
    // literal we wrote, not a re-resolved `statSync` of the same path --
    // pairing a write with a later stat on the identical path text is
    // exactly the check-then-use shape lint-check-then-use-file-races.ts
    // exists to refuse (CWE-367), even though this particular path is a
    // fixture nothing else can touch.
    const survivor = posixJoin(agentDir, "serving-kubelet.key");
    const content = "x";
    writeFileSync(survivor, content);

    run({ agentDir, serialDevice: posixJoin(root, "no-such-serial-device") });

    // `readFileSync` alone: it proves existence (throws ENOENT if the
    // script wrongly removed the file) AND content in one syscall, rather
    // than an `existsSync` gate followed by a separate `readFileSync` on
    // the same path -- the check-then-use shape
    // lint-check-then-use-file-races.ts refuses (CWE-367).
    expect(readFileSync(survivor, "utf8")).toBe(content);
  });

  test("a fully-populated (non-empty) agent dir is left byte-for-byte identical", () => {
    const root = tempRoot();
    const agentDir = posixJoin(root, "var/lib/rancher/k3s/agent");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(posixJoin(agentDir, "serving-kubelet.key"), "real key material, not empty\n");
    writeFileSync(posixJoin(agentDir, "serving-kubelet.crt"), "real cert material, not empty\n");
    const before = inventory(agentDir);

    const r = run({ agentDir, serialDevice: posixJoin(root, "no-such-serial-device") });

    expect(r.status).toBe(0);
    expect(r.stdout).toContain("clear: no zero-length files");
    expect(inventory(agentDir)).toEqual(before);
  });

  test("a missing agent dir is a no-op, exit 0 (a node that has never run k3s)", () => {
    const root = tempRoot();
    const agentDir = posixJoin(root, "var/lib/rancher/k3s/agent");
    // Deliberately not created.

    const r = run({ agentDir, serialDevice: posixJoin(root, "no-such-serial-device") });

    expect(r.status).toBe(0);
    expect(r.stdout).toContain("does not exist yet");
    expect(existsSync(agentDir)).toBe(false);
  });

  test("a partial-match sibling directory (agent-backup) outside the agent dir is untouched", () => {
    const { root, agentDir } = truncatedAgentFixture();
    const decoy = posixJoin(root, "var/lib/rancher/k3s/agent-backup/serving-kubelet.key");
    mkdirSync(posixJoin(root, "var/lib/rancher/k3s/agent-backup"), { recursive: true });
    writeFileSync(decoy, "");

    run({ agentDir, serialDevice: posixJoin(root, "no-such-serial-device") });

    expect(existsSync(decoy)).toBe(true);
  });

  test("refuses outright (does nothing) when ZETA_K3S_AGENT_DIR is pointed at a 'server' path", () => {
    const root = tempRoot();
    const serverTlsDir = posixJoin(root, "var/lib/rancher/k3s/server/tls");
    mkdirSync(serverTlsDir, { recursive: true });
    const caKey = posixJoin(serverTlsDir, "server-ca.key");
    writeFileSync(caKey, "");

    const r = run({ agentDir: serverTlsDir, serialDevice: posixJoin(root, "no-such-serial-device") });

    expect(r.status).toBe(0);
    expect(r.stdout).toContain("refusing");
    // `readFileSync` alone (existence + content in one syscall) -- see the
    // sibling test above for why a separate `existsSync` gate in front of
    // it is the shape lint-check-then-use-file-races.ts refuses.
    expect(readFileSync(caKey, "utf8")).toBe("");
  });

  test("refuses on the datastore path itself (server/db/etcd)", () => {
    const root = tempRoot();
    const etcdDir = posixJoin(root, "var/lib/rancher/k3s/server/db/etcd");
    mkdirSync(etcdDir, { recursive: true });
    const member = posixJoin(etcdDir, "member-marker");
    writeFileSync(member, "");

    const r = run({ agentDir: etcdDir, serialDevice: posixJoin(root, "no-such-serial-device") });

    expect(r.status).toBe(0);
    expect(r.stdout).toContain("refusing");
    expect(existsSync(member)).toBe(true);
  });

  test("PRUNES containerd's own snapshot/content store -- legitimately zero-length image-layer content is never touched", () => {
    // MEASURED regression: a real WP25 CI run found this script removing
    // 3243 files under exactly this subtree in one boot -- OCI bind-mount
    // placeholders and other content that ships zero-length inside a
    // container image, not a truncated k3s credential. This fixture is the
    // falsifier for that regression.
    const { root, agentDir } = truncatedAgentFixture();
    const snapshotDir = posixJoin(
      agentDir,
      "containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/117/fs/etc",
    );
    mkdirSync(snapshotDir, { recursive: true });
    // A real shape: an OCI runtime bind-mount placeholder (created empty on
    // purpose so a pod's real /etc/hosts can be mounted over it) plus a
    // Python packaging marker that ships zero-length by design.
    const hostsPlaceholder = posixJoin(snapshotDir, "hosts");
    const pyTyped = posixJoin(
      agentDir,
      "containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/579/fs/app/.venv/lib/site-packages/certifi/py.typed",
    );
    mkdirSync(posixJoin(pyTyped, ".."), { recursive: true });
    writeFileSync(hostsPlaceholder, "");
    writeFileSync(pyTyped, "");
    // A content-store blob and the metadata bolt db -- both must survive
    // even though they too are zero-length here; deleting the metadata db
    // wipes ALL of containerd's image/container state.
    const contentBlob = posixJoin(agentDir, "containerd/io.containerd.content.v1.content/blobs/sha256/deadbeef");
    const metadataDb = posixJoin(agentDir, "containerd/io.containerd.metadata.v1.bolt/meta.db");
    mkdirSync(posixJoin(contentBlob, ".."), { recursive: true });
    mkdirSync(posixJoin(metadataDb, ".."), { recursive: true });
    writeFileSync(contentBlob, "");
    writeFileSync(metadataDb, "");

    const r = run({ agentDir, serialDevice: posixJoin(root, "no-such-serial-device") });

    expect(r.status).toBe(0);
    // The genuine k3s bootstrap credentials (truncatedAgentFixture's own
    // files, all top-level) are still healed...
    expect(readdirSync(agentDir).includes("serving-kubelet.key")).toBe(false);
    // ...but nothing under the containerd plugin namespace was ever a
    // candidate, whatever its size.
    for (const survivor of [hostsPlaceholder, pyTyped, contentBlob, metadataDb]) {
      expect(existsSync(survivor)).toBe(true);
    }
    expect(r.stdout).not.toContain("io.containerd");
  });

  test("the allowlist shape, minimally: depth-1 cred + agent/etc config removed, a containerd snapshot file untouched", () => {
    // The precise falsifier for the allowlist redesign: a depth-1
    // credential (clause 1), an agent/etc config file (clause 2), and a
    // containerd snapshot file that must survive because NEITHER clause
    // ever names $AGENT_DIR/containerd.
    const root = tempRoot();
    const agentDir = posixJoin(root, "var/lib/rancher/k3s/agent");
    const cred = posixJoin(agentDir, "serving-kubelet.key");
    const etcConfig = posixJoin(agentDir, "etc/crictl.yaml");
    const snapshotFile = posixJoin(
      agentDir,
      "containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/1/fs/etc/hosts",
    );
    mkdirSync(posixJoin(etcConfig, ".."), { recursive: true });
    mkdirSync(posixJoin(snapshotFile, ".."), { recursive: true });
    writeFileSync(cred, "");
    writeFileSync(etcConfig, "");
    writeFileSync(snapshotFile, "");

    const r = run({ agentDir, serialDevice: posixJoin(root, "no-such-serial-device") });

    expect(r.status).toBe(0);
    expect(existsSync(cred)).toBe(false);
    expect(existsSync(etcConfig)).toBe(false);
    expect(existsSync(snapshotFile)).toBe(true);
  });
});

describe("target 2 -- the agent's own node-password file (/etc/rancher/node/password)", () => {
  test("a zero-length node-password file is removed and logged", () => {
    const root = tempRoot();
    const agentDir = posixJoin(root, "var/lib/rancher/k3s/agent"); // absent; irrelevant to this target
    const nodePasswordFile = posixJoin(root, "etc/rancher/node/password");
    mkdirSync(posixJoin(root, "etc/rancher/node"), { recursive: true });
    writeFileSync(nodePasswordFile, "");

    const r = run({ agentDir, serialDevice: posixJoin(root, "no-such-serial-device"), nodePasswordFile });

    expect(r.status).toBe(0);
    expect(r.stdout).toContain(`removing zero-length file: ${nodePasswordFile}`);
    expect(r.stdout).toContain(`removed ${nodePasswordFile}`);
    expect(existsSync(nodePasswordFile)).toBe(false);
  });

  test("a non-empty node-password file is left alone", () => {
    const root = tempRoot();
    const agentDir = posixJoin(root, "var/lib/rancher/k3s/agent");
    const nodePasswordFile = posixJoin(root, "etc/rancher/node/password");
    mkdirSync(posixJoin(root, "etc/rancher/node"), { recursive: true });
    const content = "a-real-generated-password\n";
    writeFileSync(nodePasswordFile, content);

    const r = run({ agentDir, serialDevice: posixJoin(root, "no-such-serial-device"), nodePasswordFile });

    expect(r.status).toBe(0);
    expect(readFileSync(nodePasswordFile, "utf8")).toBe(content);
  });

  test("an absent node-password file is a clean no-op", () => {
    const root = tempRoot();
    const agentDir = posixJoin(root, "var/lib/rancher/k3s/agent");
    const nodePasswordFile = posixJoin(root, "etc/rancher/node/password"); // deliberately not created

    const r = run({ agentDir, serialDevice: posixJoin(root, "no-such-serial-device"), nodePasswordFile });

    expect(r.status).toBe(0);
    expect(existsSync(nodePasswordFile)).toBe(false);
  });
});

describe("target 3 -- the server's node-passwd table (server/cred/node-passwd)", () => {
  test("a zero-length node-passwd table is removed and logged", () => {
    const root = tempRoot();
    const agentDir = posixJoin(root, "var/lib/rancher/k3s/agent");
    const serverNodePasswdFile = posixJoin(root, "var/lib/rancher/k3s/server/cred/node-passwd");
    mkdirSync(posixJoin(root, "var/lib/rancher/k3s/server/cred"), { recursive: true });
    writeFileSync(serverNodePasswdFile, "");

    const r = run({ agentDir, serialDevice: posixJoin(root, "no-such-serial-device"), serverNodePasswdFile });

    expect(r.status).toBe(0);
    expect(r.stdout).toContain(`removing zero-length file: ${serverNodePasswdFile}`);
    expect(existsSync(serverNodePasswdFile)).toBe(false);
  });

  test("a non-empty node-passwd table is left alone", () => {
    const root = tempRoot();
    const agentDir = posixJoin(root, "var/lib/rancher/k3s/agent");
    const serverNodePasswdFile = posixJoin(root, "var/lib/rancher/k3s/server/cred/node-passwd");
    mkdirSync(posixJoin(root, "var/lib/rancher/k3s/server/cred"), { recursive: true });
    const content = "node-qemu-k3s-verify:$2a$10$realbcryptlikehash\n";
    writeFileSync(serverNodePasswdFile, content);

    const r = run({ agentDir, serialDevice: posixJoin(root, "no-such-serial-device"), serverNodePasswdFile });

    expect(r.status).toBe(0);
    expect(readFileSync(serverNodePasswdFile, "utf8")).toBe(content);
  });

  test("the two named siblings in server/cred -- encryption-config.json and ipsec.psk -- are NEVER removed, even at zero length", () => {
    const root = tempRoot();
    const agentDir = posixJoin(root, "var/lib/rancher/k3s/agent");
    const credDir = posixJoin(root, "var/lib/rancher/k3s/server/cred");
    mkdirSync(credDir, { recursive: true });
    const encryptionConfig = posixJoin(credDir, "encryption-config.json");
    const ipsecPsk = posixJoin(credDir, "ipsec.psk");
    const serverNodePasswdFile = posixJoin(credDir, "node-passwd");
    writeFileSync(encryptionConfig, "");
    writeFileSync(ipsecPsk, "");
    writeFileSync(serverNodePasswdFile, "");

    const r = run({ agentDir, serialDevice: posixJoin(root, "no-such-serial-device"), serverNodePasswdFile });

    expect(r.status).toBe(0);
    // The named target is gone...
    expect(existsSync(serverNodePasswdFile)).toBe(false);
    // ...but its zero-length siblings, never named to this script, survive --
    // proving target 3 is a by-name removal, not a directory sweep.
    expect(existsSync(encryptionConfig)).toBe(true);
    expect(existsSync(ipsecPsk)).toBe(true);
  });

  test("absent entirely (an agent-role node) is a clean no-op, not a refusal", () => {
    const root = tempRoot();
    const agentDir = posixJoin(root, "var/lib/rancher/k3s/agent");
    const serverNodePasswdFile = posixJoin(root, "var/lib/rancher/k3s/server/cred/node-passwd"); // deliberately not created

    const r = run({ agentDir, serialDevice: posixJoin(root, "no-such-serial-device"), serverNodePasswdFile });

    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain("refusing");
  });
});

describe("all three targets fire together, matching the MEASURED failure chain", () => {
  test("agent dir zero-length files, node-password, and server node-passwd are all healed in one run", () => {
    const root = tempRoot();
    const agentDir = posixJoin(root, "var/lib/rancher/k3s/agent");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(posixJoin(agentDir, "serving-kubelet.key"), "");
    const nodePasswordFile = posixJoin(root, "etc/rancher/node/password");
    mkdirSync(posixJoin(root, "etc/rancher/node"), { recursive: true });
    writeFileSync(nodePasswordFile, "");
    const serverNodePasswdFile = posixJoin(root, "var/lib/rancher/k3s/server/cred/node-passwd");
    mkdirSync(posixJoin(root, "var/lib/rancher/k3s/server/cred"), { recursive: true });
    writeFileSync(serverNodePasswdFile, "");

    const r = run({ agentDir, serialDevice: posixJoin(root, "no-such-serial-device"), nodePasswordFile, serverNodePasswdFile });

    expect(r.status).toBe(0);
    expect(existsSync(posixJoin(agentDir, "serving-kubelet.key"))).toBe(false);
    expect(existsSync(nodePasswordFile)).toBe(false);
    expect(existsSync(serverNodePasswdFile)).toBe(false);
  });
});

describe("the script's own text", () => {
  test("contains no destructive verb beyond the scoped rm -f removals it documents", () => {
    const text = readFileSync(SCRIPT, "utf8");
    const body = text
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("#"))
      .join("\n");
    for (const verb of ["rm -r", "rm -R", "rmdir", "shred", "mkfs", "dd if=", "truncate", "wipefs", "find /", "find $HOME"]) {
      expect({ verb, present: body.includes(verb) }).toEqual({ verb, present: false });
    }
    // Exactly the scoped, justified removals this script exists to perform.
    expect(body).toContain('rm -f -- "$f"');
    expect(body).toContain('rm -f -- "$NODE_PASSWORD_FILE"');
    expect(body).toContain('rm -f -- "$SERVER_NODE_PASSWD_FILE"');
  });
});

describe("unit wiring", () => {
  const moduleText = readFileSync(MODULE, "utf8");

  test("wired as ExecStartPre on systemd.services.k3s, following k3s-wait-for-address.nix's shape", () => {
    expect(moduleText).toContain("systemd.services.k3s.serviceConfig.ExecStartPre");
    expect(moduleText).toContain("k3s-agent-tls-self-heal.sh");
  });

  test("imported by BOTH k3s-server.nix and k3s-agent.nix -- both roles run an embedded agent", () => {
    expect(readFileSync(SERVER_MODULE, "utf8")).toContain("./k3s-agent-tls-self-heal.nix");
    expect(readFileSync(AGENT_MODULE, "utf8")).toContain("./k3s-agent-tls-self-heal.nix");
  });
});
