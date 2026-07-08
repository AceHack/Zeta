import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
const ROOT = resolve(import.meta.dir, "../../.."), REQUIRED_FILES = [
  { path: "full-ai-cluster/usb-nixos-installer/zeta-install.sh", minBytes: 1000 },
  { path: "full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh", minBytes: 500 },
  { path: "full-ai-cluster/usb-nixos-installer/nixos/installer/configuration.nix", minBytes: 500 },
  { path: "full-ai-cluster/nixos/modules/initial-password.nix" },
  { path: "full-ai-cluster/nixos/modules/operator-ssh-keys.nix" },
  { path: "full-ai-cluster/nixos/modules/operator-ssh-keys.txt" },
  { path: "full-ai-cluster/nixos/modules/common.nix", minBytes: 500 },
  { path: "full-ai-cluster/nixos/modules/injected-hostname.nix" },
  { path: "full-ai-cluster/nixos/modules/login-banner.nix" },
  { path: "full-ai-cluster/nixos/modules/zeta-self-register.nix", minBytes: 500 },
  { path: "src/Core.TypeScript/zflash/cli.ts", minBytes: 1000 },
  { path: "src/Core.TypeScript/zflash/flash-usb.ts", minBytes: 1000 },
  { path: "src/Core.TypeScript/zflash/flash-usb-windows.ts", minBytes: 1000 }
], REQUIRED_SENTINELS = [
  {
    path: "full-ai-cluster/usb-nixos-installer/zeta-install.sh",
    mustContain: [
      "Step 6.5: iter-4.2 probe boot USB for operator SSH pubkey",
      "Step 6.6: iter-5.2 hostname injection",
      "Step 6.6: iter-5 wifi ESP",
      "Step 6.7: iter-5.1 wifi persistence",
      "association deferred (physical-gated; no radio claim)",
      "iter-5.2.2",
      "/dev/urandom",
      "Step 6.8: iter-5.4.0 homelab gh-auth + operator pubkey copy",
      "assert_boot_disk_large_enough",
      "LONGHORN1_TAIL_BYTES",
      "2:0:-${LONGHORN1_TAIL}",
      "root max",
      "Step 6.9: iter-5.4.1 self-registration commit+push",
      "gh auth login",
      "gh auth setup-git",
      "gh auth git-credential",
      "gh ssh-key list",
      "SSH_KEY_ERR_FILE",
      "admin:public_key",
      "gh repo clone Lucent-Financial-Group/Zeta",
      "register-${NODE_HOSTNAME}-",
      "apiVersion: zeta.lucent-financial-group.com/v1",
      "kind: ClusterNode",
      "  roles:",
      "  registration:",
      "  hardware:",
      "/proc/cpuinfo",
      "link/ether",
      "installing probe-generated hardware-configuration.nix",
      "hosts/${HOST}/hardware-configuration.nix"
    ],
    rationale: "iter-4.2 + iter-5.1 + iter-5.2 + iter-5.2.2 + iter-5.4.0 + iter-5.4.1 (incl. 081KSGS9H0008QG0R00120EEHM Bug 2a/2b fixes) substrate must be present in installer script"
  },
  {
    path: "full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh",
    mustContain: [
      "ETHERNET_WAIT_SECS",
      "nmtui",
      "zeta-install",
      "/dev/ttyS0",
      "tee -a",
      "has_wifi_hardware",
      "1.1.1.1"
    ],
    rationale: "first-boot script must include eth-wait + nmtui + zeta-install call"
  },
  {
    path: "full-ai-cluster/nixos/modules/common.nix",
    mustContain: [
      "./injected-hostname.nix",
      "./login-banner.nix",
      "services.avahi",
      "nssmdns4",
      "./zeta-self-register.nix"
    ],
    rationale: "common.nix must import the iter-5.x modules so every host inherits them"
  },
  {
    path: "full-ai-cluster/nixos/modules/zeta-self-register.nix",
    mustContain: [
      "systemd.services.zeta-self-register",
      'Type = "oneshot"',
      "ConditionPathExists",
      'Restart = "on-failure"',
      'RestartSec = "30s"',
      "network-online.target",
      "zeta-creds-restore.service",
      'default = "/etc/zeta";',
      'default = "${cfg.repoRoot}/tools/installer/zeta-self-register.sh";',
      'default = "/var/lib/zeta-self-register/self-registered.marker";',
      "tools/installer/zeta-self-register.sh",
      'StateDirectory = "zeta-self-register"',
      "ZETA_SELF_REGISTER_MARKER",
      "systemd.services.zeta-self-register-ci",
      "ZETA_SELF_REGISTER_MODE=ci-dry-run",
      "/etc/zeta/qemu-self-register-ci"
    ],
    rationale: "081KSKBP80008QG0R000GPC0TB.2 service must be a post-install marker-gated oneshot (bash impl) ordered after network and credential restore surfaces; QEMU CI dry-run sibling proves compose without live GitHub"
  },
  {
    path: "full-ai-cluster/nixos/hosts/control-plane/hardware-configuration.nix",
    mustContain: [
      "virtio_pci",
      "virtio_blk",
      "boot.initrd.kernelModules"
    ],
    rationale: "081KSNY2Z0008QG0R0008PN7RQ QEMU phase-2 initrd floor: virtio modules in host stub until probe copy at install"
  },
  {
    path: "full-ai-cluster/nixos/hosts/worker-gpu/hardware-configuration.nix",
    mustContain: [
      "virtio_pci",
      "virtio_blk",
      "boot.initrd.kernelModules"
    ],
    rationale: "081KSNY2Z0008QG0R0008PN7RQ QEMU phase-2 initrd floor: virtio modules in worker stub until probe copy at install"
  },
  {
    path: "full-ai-cluster/nixos/modules/injected-hostname.nix",
    mustContain: [
      "cluster-node-id",
      "networking.hostName",
      "lib.mkOverride"
    ],
    rationale: "injected-hostname module must read cluster-node-id + override networking.hostName"
  },
  {
    path: "full-ai-cluster/nixos/modules/login-banner.nix",
    mustContain: [
      "services.getty.greetingLine",
      "services.getty.helpLine",
      "Hostname:",
      "ssh zeta@"
    ],
    rationale: "login-banner must wire getty greeting + help line with hostname + ssh hint"
  }
], CROSS_FILE_ASSERTIONS = [
  {
    name: "cred-blob-path-producer-vs-consumer",
    producerPath: "full-ai-cluster/usb-nixos-installer/zeta-install.sh",
    consumerPath: "full-ai-cluster/nixos/modules/zeta-creds-restore.nix",
    producerExtract: (content) => {
      return content.match(/--output\s+(\S+\/zeta-creds\.enc)/)?.[1] ?? null;
    },
    consumerExtract: (content) => {
      return content.match(/blobPath\s*=\s*lib\.mkOption\s*\{[\s\S]*?default\s*=\s*"(\S+\/zeta-creds\.enc)"/)?.[1] ?? null;
    },
    consumerEquivalence: (producer) => {
      if (producer.startsWith("/mnt/boot/"))
        return producer.replace(/^\/mnt\/boot\//, "/boot/");
      return `INVALID-producer-must-be-on-mnt-boot-got:${producer}`;
    },
    rationale: 'PR #5640 + #5644 surfaced producer/consumer path mismatch (picker --output / restore-service blobPath defaults). ESP partition is mounted at /mnt/boot during install (zeta-install.sh Step 5), /boot post-reboot (disko `mountpoint = "/boot"`). Same physical file across the install-vs-installed boundary. Producer MUST write to /mnt/boot/; consumer MUST read from /boot/. Drift = restore service ConditionPathExists always evaluates false = creds silently never restore.'
  }
];
function auditFiles() {
  const failures = [];
  for (const { path, minBytes } of REQUIRED_FILES) {
    const abs = join(ROOT, path);
    if (!existsSync(abs)) {
      failures.push({ kind: "missing-file", path, detail: "expected file does not exist" });
      continue;
    }
    try {
      const st = statSync(abs);
      if (minBytes !== void 0 && st.size < minBytes)
        failures.push({
          kind: "empty-file",
          path,
          detail: `file size ${st.size} < required ${minBytes} bytes`
        });
    } catch (e) {
      failures.push({
        kind: "read-error",
        path,
        detail: e instanceof Error ? e.message : String(e)
      });
    }
  }
  return failures;
}
function auditSentinels() {
  const failures = [];
  for (const { path, mustContain, rationale } of REQUIRED_SENTINELS) {
    const abs = join(ROOT, path);
    if (!existsSync(abs)) {
      failures.push({
        kind: "missing-file",
        path,
        detail: `file expected to contain sentinels does not exist (rationale: ${rationale})`
      });
      continue;
    }
    let content;
    try {
      content = readFileSync(abs, "utf8");
    } catch (e) {
      failures.push({
        kind: "read-error",
        path,
        detail: e instanceof Error ? e.message : String(e)
      });
      continue;
    }
    for (const sentinel of mustContain)
      if (!content.includes(sentinel))
        failures.push({
          kind: "missing-sentinel",
          path,
          detail: `missing required sentinel string ${JSON.stringify(sentinel)} (rationale: ${rationale})`
        });
  }
  return failures;
}
function auditCrossFile() {
  const failures = [];
  for (const a of CROSS_FILE_ASSERTIONS) {
    const producerAbs = join(ROOT, a.producerPath), consumerAbs = join(ROOT, a.consumerPath);
    if (!existsSync(producerAbs)) {
      failures.push({
        kind: "missing-file",
        path: a.producerPath,
        detail: `cross-file assertion ${a.name}: producer file missing`
      });
      continue;
    }
    if (!existsSync(consumerAbs)) {
      failures.push({
        kind: "missing-file",
        path: a.consumerPath,
        detail: `cross-file assertion ${a.name}: consumer file missing`
      });
      continue;
    }
    let producerContent, consumerContent;
    try {
      producerContent = readFileSync(producerAbs, "utf8");
      consumerContent = readFileSync(consumerAbs, "utf8");
    } catch (e) {
      failures.push({
        kind: "read-error",
        path: `${a.producerPath} \u2A2F ${a.consumerPath}`,
        detail: `cross-file assertion ${a.name}: ${e instanceof Error ? e.message : String(e)}`
      });
      continue;
    }
    const producerVal = a.producerExtract(producerContent), consumerVal = a.consumerExtract(consumerContent);
    if (producerVal === null) {
      failures.push({
        kind: "cross-file-mismatch",
        path: a.producerPath,
        detail: `cross-file assertion ${a.name}: producer pattern not found in ${a.producerPath} (extract returned null); rationale: ${a.rationale}`
      });
      continue;
    }
    if (consumerVal === null) {
      failures.push({
        kind: "cross-file-mismatch",
        path: a.consumerPath,
        detail: `cross-file assertion ${a.name}: consumer pattern not found in ${a.consumerPath} (extract returned null); rationale: ${a.rationale}`
      });
      continue;
    }
    const expectedConsumer = a.consumerEquivalence(producerVal);
    if (consumerVal !== expectedConsumer)
      failures.push({
        kind: "cross-file-mismatch",
        path: `${a.producerPath} \u2A2F ${a.consumerPath}`,
        detail: `cross-file assertion ${a.name}: producer="${producerVal}" \u2192 expected consumer="${expectedConsumer}" but got consumer="${consumerVal}". Rationale: ${a.rationale}`
      });
  }
  return failures;
}
function main() {
  const fileFailures = auditFiles(), sentinelFailures = auditSentinels(), crossFileFailures = auditCrossFile(), total = fileFailures.length + sentinelFailures.length + crossFileFailures.length;
  if (total === 0) {
    process.stdout.write(`audit-installer-substrate: PASS \u2014 ${REQUIRED_FILES.length} required files + ${REQUIRED_SENTINELS.length} sentinel-file assertions + ${CROSS_FILE_ASSERTIONS.length} cross-file consistency assertions OK
`);
    return 0;
  }
  process.stderr.write(`audit-installer-substrate: FAIL \u2014 ${total} assertion(s) failed

`);
  for (const f of [...fileFailures, ...sentinelFailures, ...crossFileFailures])
    process.stderr.write(`  [${f.kind}] ${f.path}
    ${f.detail}
`);
  process.stderr.write(`
`);
  process.stderr.write(`  To investigate locally: bun tools/ci/audit-installer-substrate.ts
  To add a new iter-N module: add its path to REQUIRED_FILES + (if applicable)
  add its sentinels to REQUIRED_SENTINELS in this file.
  To add a new cross-file consistency assertion: add to CROSS_FILE_ASSERTIONS.
`);
  if (fileFailures.length > 0 && sentinelFailures.length === 0 && crossFileFailures.length === 0)
    return 1;
  if (sentinelFailures.length > 0 && fileFailures.length === 0 && crossFileFailures.length === 0)
    return 2;
  if (crossFileFailures.length > 0 && fileFailures.length === 0 && sentinelFailures.length === 0)
    return 4;
  return 1;
}
process.exit(main());
