// install-medium-selection.ts — which block device does stage 1 mount at /iso?
//
// 081M3B7Z38Q087G0R003F9X7HM. A MODEL of the decision, evaluated over the udev
// rules and the `/iso` device the installer Nix actually ships. Register:
// `unmetered` as a model of udev + systemd; its falsifier is the guest's own
// `boot-medium=` report, which `bootMediumShape` in ci/qemu-full-install-test.ts
// fails on a whole disk. This file exists so the ORDER-DEPENDENCE can be shown
// on a dev host with no nix, no udev and no QEMU.
//
// WHAT IS MODELLED, AND WHERE EACH PIECE COMES FROM (nixpkgs c25784012c99,
// systemd 260.2 — the revisions pinned by full-ai-cluster/flake.lock):
//
//   1. Stage 1 is the SYSTEMD initrd. `boot.initrd.systemd.enable` defaults to
//      true (nixos/modules/system/boot/systemd/initrd.nix) and the installer
//      does not override it.
//   2. With the systemd initrd, iso-image.nix sets
//      `fileSystems."/iso".device = "/dev/disk/by-label/${volumeID}"` — a udev
//      symlink, not a blkid lookup and not `root=LABEL=`.
//   3. The mount unit is bound to the `.device` unit of that path. systemd
//      makes a devlink unit ready when it handles a uevent whose DEVLINKS
//      contain the path AND the path resolves to that device
//      (src/core/device.c `device_setup_devlink_unit_one`:
//      `sd_device_new_from_devname(&dev, devlink)`). So the mount fires on the
//      FIRST processed claimant the symlink resolves to.
//   4. udevd never runs a child's event while its parent's is running, so the
//      whole disk `sda` is always processed before `sda1`. When `sda` alone has
//      been processed it is the ONLY claimant of by-label/ZETA_INSTALL, and
//      `link_priority` has nothing to rank it against — the symlink points at
//      the disk, and whether the mount starts before `sda1` lands is timing.
//      That is the race run 36406378420 measured (3 lanes `/dev/sda`, others
//      `/dev/sda1`, same ISO).
//
// The model below replays uevents in every legal order and collects each device
// the symlink can resolve to between the moment it first exists (the mount
// starts) and the end of coldplug (the latest the mount could follow it). A
// mechanism is DETERMINISTIC exactly when that set has one element.

/** The udev properties a rule can match, for one block device. */
export interface BlockDeviceFacts {
  /** Kernel name, e.g. `sda`, `sda1`, `sr0`. */
  readonly kernel: string;
  readonly devtype: "disk" | "partition";
  /** udev ENV after the blkid builtin (ID_FS_LABEL, ID_FS_TYPE, ID_PART_TABLE_TYPE, ...). */
  readonly env: Readonly<Record<string, string>>;
}

/** What a set of rules does to one device. */
export interface UdevOutcome {
  readonly symlinks: readonly string[];
  readonly linkPriority: number;
}

/**
 * The upstream by-label rule, verbatim from systemd 260.2
 * rules.d/60-persistent-storage.rules (line 141). Every device whose blkid
 * probe found a labelled filesystem claims `disk/by-label/<label>`.
 */
export const UPSTREAM_BY_LABEL_RULE =
  'ENV{ID_FS_USAGE}=="filesystem|other|crypto", ENV{ID_FS_LABEL_ENC}=="?*", SYMLINK+="disk/by-label/$env{ID_FS_LABEL_ENC}"';

/** nixpkgs iso-image.nix, systemd-initrd branch: the default `/iso` device. */
export function nixpkgsDefaultIsoDevice(volumeId: string): string {
  return `/dev/disk/by-label/${volumeId}`;
}

// udev glob: `*`, `?`, `[...]`, and `|` alternatives.
function udevGlob(pattern: string, value: string): boolean {
  return pattern.split("|").some((alt) => {
    let re = "^";
    for (let i = 0; i < alt.length; i++) {
      const c = alt[i] as string;
      if (c === "*") re += ".*";
      else if (c === "?") re += ".";
      else if (c === "[") {
        const end = alt.indexOf("]", i);
        if (end < 0) {
          re += "\\[";
          continue;
        }
        let cls = alt.slice(i + 1, end);
        if (cls.startsWith("!")) cls = `^${cls.slice(1)}`;
        re += `[${cls}]`;
        i = end;
      } else re += c.replace(/[.+^${}()\\]/gu, "\\$&");
    }
    return new RegExp(`${re}$`, "u").test(value);
  });
}

function keyValue(dev: BlockDeviceFacts, key: string): string {
  if (key === "SUBSYSTEM") return "block";
  if (key === "KERNEL") return dev.kernel;
  const env = /^ENV\{([A-Z0-9_]+)\}$/u.exec(key);
  if (env?.[1] !== undefined) {
    if (env[1] === "DEVTYPE") return dev.devtype;
    return dev.env[env[1]] ?? "";
  }
  throw new Error(`install-medium-selection: unsupported udev match key ${key}`);
}

/**
 * Evaluate udev rule lines (the subset the installer uses: SUBSYSTEM, KERNEL,
 * ENV{..} with == / !=; SYMLINK+= and OPTIONS+="link_priority=N") against one
 * device. Comments and blank lines are ignored. An unsupported key throws
 * rather than silently not matching.
 */
export function evaluateUdevRules(rules: string, dev: BlockDeviceFacts): UdevOutcome {
  const symlinks: string[] = [];
  let linkPriority = 0;
  for (const raw of rules.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const terms = [...line.matchAll(/([A-Z]+(?:\{[A-Za-z0-9_]+\})?)\s*(==|!=|\+=|-=|=)\s*"([^"]*)"/gu)];
    let matched = true;
    const actions: Array<[string, string, string]> = [];
    for (const t of terms) {
      const [, key, op, value] = t as unknown as [string, string, string, string];
      if (op === "==" || op === "!=") {
        const hit = udevGlob(value, keyValue(dev, key));
        if ((op === "==") !== hit) {
          matched = false;
          break;
        }
      } else actions.push([key, op, value]);
    }
    if (!matched) continue;
    for (const [key, op, value] of actions) {
      if (key === "SYMLINK" && op === "+=") {
        symlinks.push(value.replace(/\$env\{([A-Z0-9_]+)\}/gu, (_, k: string) => dev.env[k] ?? ""));
      } else if (key === "OPTIONS" && op === "+=") {
        const p = /^link_priority=(-?[0-9]+)$/u.exec(value);
        if (p?.[1] !== undefined) linkPriority = Number(p[1]);
      } else {
        throw new Error(`install-medium-selection: unsupported udev action ${key}${op}`);
      }
    }
  }
  return { symlinks, linkPriority };
}

/**
 * Replay uevents in `order` (udevd order; a parent always precedes its own
 * partitions) and return every device `/dev/<link>` can resolve to from the
 * moment it FIRST exists onward. systemd-initrd starts the `/iso` mount at the
 * first of those moments, and `mount(2)` follows the symlink whenever it
 * actually runs, so any owner in this window is a possible mount source. Among
 * claimants udev keeps the highest link_priority; on a tie the most recently
 * processed device takes the link (systemd src/udev/udev-node.c: "equal or
 * higher priority ... create the devlink to our device"). Empty when nothing
 * ever claims the link (the mount would time out).
 */
export function possibleMountSources(
  isoDevice: string,
  order: readonly BlockDeviceFacts[],
  rules: string,
): string[] {
  const link = isoDevice.replace(/^\/dev\//u, "");
  const window: string[] = [];
  let owner: { kernel: string; priority: number } | null = null;
  for (const dev of order) {
    const out = evaluateUdevRules(rules, dev);
    if (out.symlinks.includes(link) && (owner === null || out.linkPriority >= owner.priority)) {
      owner = { kernel: dev.kernel, priority: out.linkPriority };
    }
    if (owner !== null && !window.includes(`/dev/${owner.kernel}`)) window.push(`/dev/${owner.kernel}`);
  }
  return window;
}

/** Every order udevd could process `devices` in, keeping each parent before its partitions. */
export function udevOrders(devices: readonly BlockDeviceFacts[]): BlockDeviceFacts[][] {
  const out: BlockDeviceFacts[][] = [];
  const permute = (rest: readonly BlockDeviceFacts[], acc: BlockDeviceFacts[]): void => {
    if (rest.length === 0) {
      out.push(acc);
      return;
    }
    rest.forEach((d, i) => {
      const parentPending = d.devtype === "partition" &&
        rest.some((p) => p.devtype === "disk" && d.kernel.startsWith(p.kernel));
      if (parentPending) return;
      permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, d]);
    });
  };
  permute(devices, []);
  return out;
}

/** The distinct possible mount sources over every legal event order and mount timing. One element = deterministic. */
export function mountSourcesOverAllOrders(
  isoDevice: string,
  devices: readonly BlockDeviceFacts[],
  rules: string,
): string[] {
  const seen = new Set<string>();
  for (const order of udevOrders(devices)) {
    const window = possibleMountSources(isoDevice, order, rules);
    if (window.length === 0) seen.add("<none>");
    for (const source of window) seen.add(source);
  }
  return [...seen].sort();
}

/**
 * Read the installer module: its udev rule text (with the volume ID
 * substituted) and the `/iso` device it pins, or the nixpkgs default when it
 * pins none.
 */
export function readInstallerMediumConfig(nix: string, volumeId: string): { rules: string; isoDevice: string } {
  const blocks = [...nix.matchAll(/''\n([\s\S]*?)''/gu)].map((m) => m[1] ?? "");
  const rules = blocks.join("\n").replaceAll("${config.isoImage.volumeID}", volumeId);
  // Anchored at line start so a comment QUOTING the upstream default is not read as a pin.
  const pinned = /^[ \t]*fileSystems\."\/iso"\.device\s*=\s*(?:lib\.mkForce\s*)?"([^"]+)"/mu.exec(nix);
  const isoDevice = pinned?.[1]?.replaceAll("${config.isoImage.volumeID}", volumeId) ??
    nixpkgsDefaultIsoDevice(volumeId);
  return { rules, isoDevice };
}
