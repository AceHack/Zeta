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

// ── Does the module's /iso pin SURVIVE the module system? ───────────────────
//
// 081M3B7Z38Q087G0R003F9X7HM, run 36870188468. PR #17751 shipped
// `fileSystems."/iso".device = lib.mkForce "<symlink>"` and every check passed,
// because every check read the SOURCE TEXT, where the line is present and
// correct. It was discarded on evaluation: nixpkgs' installation-cd-base.nix
// defines the whole `fileSystems` option as `lib.mkImageMediaOverride
// config.lib.isoFileSystems` (priority 60), and the module system drops a
// DEFINITION of an option by its top-level priority before it looks inside it.
// A default-priority (100) definition with a mkForce nested in its value loses
// to the 60 as a whole, so the evaluated /iso device stayed by-label and three
// of five WP11 USB runs afterwards mounted the boot medium from the whole disk.
//
// This models exactly that one rule — "which definitions of an option survive" —
// so the source text can be judged by what the merge would do with it. It is a
// model (register: `unmetered`); the falsifier of the model is the flake check
// `install-medium-device-eval`, which asks the real module system.

/** installation-cd-base.nix:36 — `fileSystems = lib.mkImageMediaOverride config.lib.isoFileSystems;`. */
export const BASE_FILESYSTEMS_PRIORITY = 60;
/** Priority of an undecorated definition. */
export const DEFAULT_PRIORITY = 100;

const NIX_PRIORITY_FUNCTIONS: Readonly<Record<string, number>> = {
  mkImageMediaOverride: 60,
  mkForce: 50,
  mkDefault: 1000,
  mkOptionDefault: 1500,
};

/**
 * What the module system does with a definition of `fileSystems` made at
 * `priority`, against the base's definition at 60.
 *
 *   merged         priority == 60: both survive, per-mount-point merge — what we want
 *   discarded      priority  > 60: the whole definition is dropped (the #17751 defect)
 *   replaces-base  priority  < 60: ours wins outright and the base's other mounts
 *                  (/, /nix/.ro-store, /nix/.rw-store, ...) are DELETED
 */
export type PinEffect = "merged" | "discarded" | "replaces-base";

export function effectOfFileSystemsDefinition(priority: number): PinEffect {
  if (priority === BASE_FILESYSTEMS_PRIORITY) return "merged";
  return priority > BASE_FILESYSTEMS_PRIORITY ? "discarded" : "replaces-base";
}

export interface IsoPin {
  /** The device the source text assigns to /iso, or null when it assigns none. */
  readonly device: string | null;
  /** Priority of the definition AT THE `fileSystems` OPTION — the only one the filter looks at. */
  readonly optionPriority: number | null;
  readonly effect: PinEffect | "no-pin";
  /** The source shape that was recognised, for a failure message that names it. */
  readonly form: "wrapped-at-option-priority" | "nested-under-default-priority" | "none";
}

function stripNixComments(nix: string): string {
  return nix
    .split("\n")
    .filter((l) => !l.trim().startsWith("#"))
    .join("\n");
}

function substituteVolumeId(s: string, volumeId: string): string {
  return s.replaceAll("${config.isoImage.volumeID}", volumeId).replaceAll("${volumeID}", volumeId);
}

/** Read how the module pins /iso and say what the module system would do with that definition. */
export function readIsoPin(nix: string, volumeId: string): IsoPin {
  const code = stripNixComments(nix);

  // Form A (the working one): `fileSystems = <prio-fn> { "/iso" = <prio-fn> { device = lib.mkForce "<dev>"; }; };`
  const wrapped =
    /fileSystems\s*=\s*lib\.(mkImageMediaOverride|mkForce|mkDefault|mkOptionDefault)\s*\{\s*"\/iso"\s*=\s*lib\.(?:mkImageMediaOverride|mkForce)\s*\{\s*device\s*=\s*lib\.mkForce\s*"([^"]+)"/u
      .exec(code);
  if (wrapped?.[1] !== undefined && wrapped[2] !== undefined) {
    const optionPriority = NIX_PRIORITY_FUNCTIONS[wrapped[1]] ?? DEFAULT_PRIORITY;
    return {
      device: substituteVolumeId(wrapped[2], volumeId),
      optionPriority,
      effect: effectOfFileSystemsDefinition(optionPriority),
      form: "wrapped-at-option-priority",
    };
  }

  // Form B (the #17751 defect): the mkForce is the ONLY decoration, and it is nested
  // inside a definition of `fileSystems` that is itself at the default priority.
  const nested = /^[ \t]*fileSystems\."\/iso"\.device\s*=\s*(?:lib\.mkForce\s*)?"([^"]+)"/mu.exec(code);
  if (nested?.[1] !== undefined) {
    return {
      device: substituteVolumeId(nested[1], volumeId),
      optionPriority: DEFAULT_PRIORITY,
      effect: effectOfFileSystemsDefinition(DEFAULT_PRIORITY),
      form: "nested-under-default-priority",
    };
  }

  return { device: null, optionPriority: null, effect: "no-pin", form: "none" };
}

/** What gates the whole module (`config = lib.mkIf <gate> { ... }`), or null when it is unconditional. */
export function readModuleGate(nix: string): string | null {
  const code = stripNixComments(nix);
  const gate = /^[ \t]*config\s*=\s*lib\.mkIf\s+(\w+)\s*\{/mu.exec(code);
  if (gate?.[1] === undefined) return null;
  // Resolve a let-bound name to its definition so the test can compare the CONDITION, not a name.
  const def = new RegExp(`^[ \\t]*${gate[1]}\\s*=\\s*([^;]+);`, "mu").exec(code);
  return (def?.[1] ?? gate[1]).replace(/\s+/gu, " ").trim();
}

/**
 * Read the installer module: its udev rule text (with the volume ID
 * substituted) and the `/iso` device the EVALUATED configuration ends up with.
 *
 * That is the pinned device only when the pin survives the merge
 * (`pin.effect === "merged"`); a pin the base discards leaves nixpkgs' by-label
 * default in place, which is what the real evaluation did, so the model — and
 * every test that replays it — sees the device that was actually mounted rather
 * than the one the text wished for.
 */
export function readInstallerMediumConfig(
  nix: string,
  volumeId: string,
): { rules: string; isoDevice: string; pin: IsoPin; gate: string | null } {
  const blocks = [...stripNixComments(nix).matchAll(/''\n([\s\S]*?)''/gu)].map((m) => m[1] ?? "");
  const rules = substituteVolumeId(blocks.join("\n"), volumeId);
  const pin = readIsoPin(nix, volumeId);
  const isoDevice = pin.effect === "merged" && pin.device !== null ? pin.device : nixpkgsDefaultIsoDevice(volumeId);
  return { rules, isoDevice, pin, gate: readModuleGate(nix) };
}
