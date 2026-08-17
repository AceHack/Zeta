/**
 * tpm2-linux-probe.ts — the Linux TPM 2.0 probe, as pure logic over a captured reading
 * of the host plus a thin IO seam.
 *
 * ============================================================================
 * WHY THIS MODULE EXISTS: A BOOLEAN CANNOT HOLD THE ANSWER
 * ============================================================================
 *
 * `frost-hardware-probe.probeTpm2` used to answer `{ available: boolean }`, computed from
 * `existsSync("/dev/tpmrm0") || existsSync("/dev/tpm0") || readdirSync("/sys/class/tpm")`.
 * Two defects follow from the shape of that answer, and neither is fixable while the
 * answer is a boolean:
 *
 *  1. **`existsSync` returns `false` for EVERY error.** A path denied by permissions, a
 *     path under an unreadable parent, an EIO — all read as "no TPM here". So a check
 *     that could not run looked exactly like a check that ran and said no. That is the
 *     repo's cardinal failure, expressed in the standard library's most convenient API.
 *
 *  2. **A device node is not a family.** `/dev/tpm0` is the node for a TPM **1.2** device
 *     too — the kernel's `tpm` class has carried both families since the 1.2 era. So
 *     `exists("/dev/tpm0") ⇒ TPM 2.0 available` is the same inference as the PKCS#11
 *     regression this file's sibling was written to stop: *a thing associated with the
 *     capability is not the capability*. TPM 1.2 has no `tpm2_unseal`, no SHA-256 PCR
 *     bank, and no TPM2_Create — sealing a FROST share to it is not the L1 rung.
 *
 * So the answer is a **state**, five of them, and the whole discipline of this module is
 * that no two of them are ever collapsed into one:
 *
 * | state | means | what it is NOT |
 * |---|---|---|
 * | `present` | a usable device node AND positive family-2.0 evidence | — |
 * | `absent` | the TPM subsystem was **enumerable** and enumerated no TPM 2.0 | not "we could not look" |
 * | `unreadable` | an evidence source exists and **denied us** (EACCES/EPERM) | not "no TPM" — a privileged caller gets a different answer |
 * | `unavailable` | the evidence source is **not on this host at all** — not Linux, or no `tpm` class and no `tpm2-tools` | not "no TPM" — the driver may simply not be loaded |
 * | `indeterminate` | a device node is there and **nothing could confirm the family** | not `present` — never round an unconfirmed device up to a capability |
 *
 * `unavailable` versus `absent` is the sharpest of these and the least obvious. On a Linux
 * host whose kernel exposes the `tpm` class, `/sys/class/tpm` **exists and is empty** when
 * there is no TPM: that is a real enumeration returning a real negative, and it is
 * `absent`. When `/sys/class/tpm` does not exist at all, the TPM subsystem is not exposed
 * and "no TPM installed" is indistinguishable from "the driver is not loaded" or "this
 * kernel has no TPM support" — so the honest answer is `unavailable`, and an operator who
 * needs `absent` must load the driver and ask again.
 *
 * ============================================================================
 * THE FAILURE THIS SHAPE IS MODELLED ON (081M00QP7G7087G0R002PZB5T2 / PR #11509)
 * ============================================================================
 *
 * That item prescribed `zcat /proc/config.gz | grep RANDOM_TRUST` as its probe. When
 * measured, the prescribed probe would have returned the OPPOSITE of the truth: the grep
 * came back empty, an empty grep reads as "the option is off", and the true state was
 * "on". The empty result meant *the option was not in this file*, not *the option is
 * disabled* — one absence wearing another absence's meaning.
 *
 * Every outcome type below therefore keeps the distinction the shell collapses:
 * `not-found` ≠ `permission-denied` ≠ `not-installed` ≠ `not-attempted` ≠ an empty
 * successful read. A missing tool can never produce `absent`, and a denied read can never
 * produce `absent`, because neither of those outcomes is ever *consulted* as a negative.
 *
 * Noninterference (manifesto §13): every reading of the outside world enters through the
 * injected `Tpm2LinuxEffects` door, and `captureTpm2Linux` freezes what it saw into a
 * plain, serialisable `Tpm2LinuxCapture`. `classifyTpm2Linux` is a **pure function of that
 * record** — no IO, no clock, no platform sniffing — which is what makes the parsing
 * testable on a machine that has no TPM, and what lets a capture taken on real silicon be
 * committed as text and replayed forever (DST, §7).
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { platform as osPlatform } from "node:os";

// ---------------------------------------------------------------------------
// Outcomes — what a reading of the host ACTUALLY said
// ---------------------------------------------------------------------------

/** Ordinal string order. Never `localeCompare`: it is locale-sensitive and non-canonical. */
function ordinal(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * The result of asking whether a path exists. `boolean` cannot express the middle three,
 * which is why `existsSync` is not usable here.
 */
export type PathOutcome =
  | { readonly kind: "found" }
  | { readonly kind: "not-found" }
  | { readonly kind: "permission-denied" }
  | { readonly kind: "error"; readonly code: string }
  /** The source was never consulted (e.g. the capture stopped at the platform check). */
  | { readonly kind: "not-attempted" };

/** The result of reading a file. A successful read of `""` is NOT `not-found`. */
export type ReadOutcome =
  | { readonly kind: "read"; readonly text: string }
  | { readonly kind: "not-found" }
  | { readonly kind: "permission-denied" }
  | { readonly kind: "error"; readonly code: string }
  | { readonly kind: "not-attempted" };

/** The result of listing a directory. A successful listing of `[]` is NOT `not-found`. */
export type ListOutcome =
  | { readonly kind: "listed"; readonly entries: readonly string[] }
  | { readonly kind: "not-found" }
  | { readonly kind: "permission-denied" }
  | { readonly kind: "error"; readonly code: string }
  | { readonly kind: "not-attempted" };

/**
 * The result of running a tool. `not-installed` (the binary is not on this host) and
 * `failed` (it ran and refused) are different facts and neither is a negative answer
 * about the hardware.
 */
export type CommandOutcome =
  | { readonly kind: "ran"; readonly stdout: string }
  | { readonly kind: "not-installed" }
  | { readonly kind: "failed"; readonly exitCode: number; readonly stderr: string }
  | { readonly kind: "error"; readonly code: string }
  | { readonly kind: "not-attempted" };

// ---------------------------------------------------------------------------
// The IO seam
// ---------------------------------------------------------------------------

/**
 * The ONLY door through which this module reads the outside world. Deliberately
 * error-preserving: each operation returns an outcome rather than throwing or degrading
 * to `false`, so the caller cannot accidentally launder a denial into a negative.
 */
export interface Tpm2LinuxEffects {
  /** node:os platform string ("linux" | "darwin" | …). */
  readonly platform: string;
  readonly statPath: (path: string) => PathOutcome;
  readonly readText: (path: string) => ReadOutcome;
  readonly listDir: (path: string) => ListOutcome;
  readonly run: (cmd: string, args: readonly string[]) => CommandOutcome;
}

/** Node error codes are on `.code`; `execFileSync` puts the exit status on `.status`. */
function errnoOf(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : "UNKNOWN";
}

/** `execFileSync` hands back stderr as a string or a Buffer depending on encoding. */
function decodeStderr(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return Buffer.from(raw).toString("utf8");
  return "";
}

function classifyErrno(code: string): "not-found" | "permission-denied" | "error" {
  if (code === "ENOENT" || code === "ENOTDIR") return "not-found";
  if (code === "EACCES" || code === "EPERM") return "permission-denied";
  return "error";
}

/** The real host. The only place in this module that touches fs/subprocess. */
export function realTpm2LinuxEffects(): Tpm2LinuxEffects {
  return {
    platform: osPlatform(),
    statPath: (p) => {
      try {
        statSync(p);
        return { kind: "found" };
      } catch (err) {
        const code = errnoOf(err);
        const k = classifyErrno(code);
        return k === "error" ? { kind: "error", code } : { kind: k };
      }
    },
    readText: (p) => {
      try {
        return { kind: "read", text: readFileSync(p, "utf8") };
      } catch (err) {
        const code = errnoOf(err);
        const k = classifyErrno(code);
        return k === "error" ? { kind: "error", code } : { kind: k };
      }
    },
    listDir: (p) => {
      try {
        return { kind: "listed", entries: [...readdirSync(p)].sort(ordinal) };
      } catch (err) {
        const code = errnoOf(err);
        const k = classifyErrno(code);
        return k === "error" ? { kind: "error", code } : { kind: k };
      }
    },
    run: (cmd, args) => {
      try {
        const stdout = execFileSync(cmd, [...args], {
          encoding: "utf8",
          timeout: 5000,
          stdio: ["ignore", "pipe", "pipe"],
        });
        return { kind: "ran", stdout };
      } catch (err) {
        const code = errnoOf(err);
        // ENOENT from execFileSync means the BINARY is missing, not that a TPM is missing.
        if (code === "ENOENT") return { kind: "not-installed" };
        const status = (err as { status?: unknown } | null)?.status;
        if (typeof status === "number") {
          return { kind: "failed", exitCode: status, stderr: decodeStderr((err as { stderr?: unknown }).stderr) };
        }
        return { kind: "error", code };
      }
    },
  };
}

// ---------------------------------------------------------------------------
// The capture — a frozen, serialisable reading of one host
// ---------------------------------------------------------------------------

/** Device nodes in preference order: the resource-manager node first (it multiplexes). */
export const TPM_DEVICE_NODES: readonly string[] = ["/dev/tpmrm0", "/dev/tpm0"];
export const SYS_CLASS_TPM = "/sys/class/tpm";
/** Kernel ≥ 4.19 (`drivers/char/tpm/tpm-sysfs.c`). Absent on older kernels — hence the tool. */
const VERSION_MAJOR_FILE = "tpm_version_major";
/** sysfs entries that are TPM chips (`tpm0`), as opposed to resource managers (`tpmrm0`). */
const CHIP_ENTRY = /^tpm\d+$/;

/**
 * Everything this probe read, as plain data. Commit one of these as JSON from a real x86
 * node and the classifier can be replayed against it forever with no hardware present —
 * which is the whole mechanism by which the hardware dependency of
 * 081M00VN9P1087G0R000FYTTVS gets closed by one command instead of a machine.
 */
export interface Tpm2LinuxCapture {
  readonly platform: string;
  readonly deviceNodes: readonly { readonly path: string; readonly outcome: PathOutcome }[];
  readonly sysClassTpm: ListOutcome;
  readonly versionMajor: readonly { readonly path: string; readonly outcome: ReadOutcome }[];
  readonly getcapPropertiesFixed: CommandOutcome;
}

/** Reads the host through the injected door. All IO lives here; nothing below it does IO. */
export function captureTpm2Linux(fx: Tpm2LinuxEffects = realTpm2LinuxEffects()): Tpm2LinuxCapture {
  const notAttempted: Tpm2LinuxCapture = {
    platform: fx.platform,
    deviceNodes: TPM_DEVICE_NODES.map((path) => ({ path, outcome: { kind: "not-attempted" } })),
    sysClassTpm: { kind: "not-attempted" },
    versionMajor: [],
    getcapPropertiesFixed: { kind: "not-attempted" },
  };
  // Not a platform-guard-as-answer: the classifier decides what non-Linux MEANS. This only
  // avoids spawning subprocesses and stat-ing Linux paths on a host that has neither.
  if (fx.platform !== "linux") return notAttempted;

  const deviceNodes = TPM_DEVICE_NODES.map((path) => ({ path, outcome: fx.statPath(path) }));
  const sysClassTpm = fx.listDir(SYS_CLASS_TPM);
  const chips =
    sysClassTpm.kind === "listed"
      ? sysClassTpm.entries
          .filter((e) => CHIP_ENTRY.test(e))
          .slice()
          .sort(ordinal)
      : [];
  const versionMajor = chips.map((chip) => {
    const path = `${SYS_CLASS_TPM}/${chip}/${VERSION_MAJOR_FILE}`;
    return { path, outcome: fx.readText(path) };
  });
  return {
    platform: fx.platform,
    deviceNodes,
    sysClassTpm,
    versionMajor,
    getcapPropertiesFixed: fx.run("tpm2_getcap", ["properties-fixed"]),
  };
}

// ---------------------------------------------------------------------------
// Parsing — pure, over captured text
// ---------------------------------------------------------------------------

/** A family reading, or the reason there isn't one. `undefined` is never "2.0 is false". */
export type TpmFamily = "2.0" | "1.2" | "unrecognised";

/**
 * `/sys/class/tpm/tpmN/tpm_version_major` holds the TPM major version as ASCII: `2` for
 * TPM 2.0, `1` for TPM 1.2. Anything else is `unrecognised` — reported, never guessed at,
 * and specifically never defaulted to 2.0.
 */
export function parseVersionMajor(text: string): TpmFamily {
  const t = text.trim();
  if (t === "2") return "2.0";
  if (t === "1") return "1.2";
  return "unrecognised";
}

/**
 * `tpm2_getcap properties-fixed` emits YAML; the family lives in
 * `TPM2_PT_FAMILY_INDICATOR`'s `value`, whose raw form is the ASCII of the family string
 * (`0x322E3000` is `"2.0\0"`).
 *
 * Returns `undefined` when the property is NOT IN THE OUTPUT — which is the #11509 trap in
 * miniature. An empty or property-less successful run means *this tool did not tell us*,
 * and callers must not read that as "not 2.0".
 */
export function parseGetcapFamily(stdout: string): TpmFamily | undefined {
  const lines = stdout.split("\n");
  const idx = lines.findIndex((l) => l.trim().startsWith("TPM2_PT_FAMILY_INDICATOR"));
  if (idx < 0) return undefined;
  // The property's own block only: stop at the next top-level key so a later property's
  // `value:` can never be misread as this one's.
  for (const line of lines.slice(idx + 1)) {
    if (/^\S/.test(line)) break;
    const m = /^\s*value:\s*"?([^"\s]+)"?\s*$/.exec(line);
    const v = m?.[1];
    if (v !== undefined) {
      if (v === "2.0") return "2.0";
      if (v === "1.2") return "1.2";
      return "unrecognised";
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Classification — pure, over the capture
// ---------------------------------------------------------------------------

/** See the table in the header. No two of these are ever collapsed into one. */
export type Tpm2State = "present" | "absent" | "unreadable" | "unavailable" | "indeterminate";

export interface Tpm2Probe {
  readonly state: Tpm2State;
  /** The node a caller would open. Only ever set alongside `present`. */
  readonly deviceNode?: string | undefined;
  /** What the family evidence said, when there was any. `undefined` ≠ "not 2.0". */
  readonly family?: TpmFamily | undefined;
  /** One sentence naming the state's cause, in the terms an operator can act on. */
  readonly reason: string;
  /** Every source consulted and what it said, in capture order. The audit trail. */
  readonly evidence: readonly string[];
}

function describePath(o: PathOutcome): string {
  switch (o.kind) {
    case "found":
      return "exists";
    case "not-found":
      return "does not exist (ENOENT)";
    case "permission-denied":
      return "PERMISSION DENIED (EACCES/EPERM) — this is not an answer about the hardware";
    case "error":
      return `error ${o.code} — this is not an answer about the hardware`;
    case "not-attempted":
      return "not consulted";
  }
}

function describeSysClassTpm(o: ListOutcome): string {
  switch (o.kind) {
    case "listed":
      return o.entries.length === 0
        ? `${SYS_CLASS_TPM}: enumerated, EMPTY — the kernel exposes the tpm class and no chip is registered`
        : `${SYS_CLASS_TPM}: enumerated [${o.entries.join(", ")}]`;
    case "not-found":
      return (
        `${SYS_CLASS_TPM}: does not exist — the tpm class is not exposed, so "no TPM" and ` +
        `"driver not loaded" are indistinguishable from here`
      );
    case "permission-denied":
      return `${SYS_CLASS_TPM}: PERMISSION DENIED — not an answer about the hardware`;
    case "error":
      return `${SYS_CLASS_TPM}: error ${o.code} — not an answer about the hardware`;
    case "not-attempted":
      return `${SYS_CLASS_TPM}: not consulted`;
  }
}

/**
 * Family readings from sysfs, plus whether any source DENIED us. `denied` is tracked
 * separately from "no reading" precisely so the classifier can rank a denial above a
 * negative instead of adding it to one.
 */
function readSysfsFamilies(versionMajor: Tpm2LinuxCapture["versionMajor"]): {
  families: readonly TpmFamily[];
  denied: boolean;
  evidence: readonly string[];
} {
  const families: TpmFamily[] = [];
  const evidence: string[] = [];
  let denied = false;
  for (const v of versionMajor) {
    switch (v.outcome.kind) {
      case "read": {
        const fam = parseVersionMajor(v.outcome.text);
        families.push(fam);
        evidence.push(`${v.path}: ${JSON.stringify(v.outcome.text)} → family ${fam}`);
        break;
      }
      case "not-found":
        evidence.push(`${v.path}: absent — kernels before 4.19 do not export it; family unconfirmed by sysfs`);
        break;
      case "permission-denied":
        denied = true;
        evidence.push(`${v.path}: PERMISSION DENIED — family unconfirmed, NOT disproved`);
        break;
      case "error":
        evidence.push(`${v.path}: error ${v.outcome.code} — family unconfirmed, NOT disproved`);
        break;
      case "not-attempted":
        evidence.push(`${v.path}: not consulted`);
        break;
    }
  }
  return { families, denied, evidence };
}

/** The tool's answer, or the reason there is none. Four non-answers, none of them a negative. */
function readGetcapFamily(g: CommandOutcome): { family?: TpmFamily; evidence: readonly string[] } {
  switch (g.kind) {
    case "ran": {
      const family = parseGetcapFamily(g.stdout);
      if (family === undefined) {
        return {
          evidence: [
            "tpm2_getcap properties-fixed: ran, but did NOT report TPM2_PT_FAMILY_INDICATOR — " +
              "silence from a tool is not a negative",
          ],
        };
      }
      return { family, evidence: [`tpm2_getcap properties-fixed: TPM2_PT_FAMILY_INDICATOR = ${family}`] };
    }
    case "not-installed":
      return {
        evidence: ["tpm2_getcap: NOT INSTALLED — the tool is missing, which says nothing about the hardware"],
      };
    case "failed":
      return {
        evidence: [
          `tpm2_getcap: exit ${String(g.exitCode)} — ${JSON.stringify(g.stderr.trim().slice(0, 200))}. ` +
            "A TCTI failure conflates 'no TPM' with 'no permission', so it is recorded and not counted.",
        ],
      };
    case "error":
      return { evidence: [`tpm2_getcap: error ${g.code} — not an answer about the hardware`] };
    case "not-attempted":
      return { evidence: ["tpm2_getcap: not consulted"] };
  }
}

/**
 * The whole decision, as a pure function of the capture. Read the ordering as a precedence
 * list of *what kind of thing we know*, not of *what we hope*:
 *
 *   1. not Linux at all                        → unavailable
 *   2. positive family-2.0 evidence + a node   → present     (the only path to `present`)
 *   3. positive family-1.2 evidence            → absent      (a real TPM, the wrong family)
 *   4. anything was DENIED                     → unreadable  (outranks every negative)
 *   5. a node exists, family unconfirmed       → indeterminate
 *   6. the tpm class enumerated, no chip       → absent      (the only path to `absent`)
 *   7. otherwise                               → unavailable
 *
 * Rule 4 sitting above rules 5–7 is the load-bearing one: a denial can never be spent as
 * a negative. Rule 6 being the only path to `absent` is its twin: `absent` requires an
 * enumeration that actually ran.
 */
/** What the capture establishes, before any of it is weighed. Gathering does not decide. */
interface Tpm2Facts {
  readonly foundNode: string | undefined;
  readonly deniedNodes: readonly string[];
  /** `/sys/class/tpm` was successfully listed — the precondition for a real negative. */
  readonly enumerated: boolean;
  readonly chips: readonly string[];
  readonly has20: boolean;
  readonly has12: boolean;
  /** Every source that EXISTS and refused us, named. Empty is not "nothing refused us". */
  readonly deniedSources: readonly string[];
  readonly evidence: readonly string[];
}

function gatherTpm2Facts(cap: Tpm2LinuxCapture): Tpm2Facts {
  const evidence: string[] = [`platform: ${cap.platform}`];
  for (const n of cap.deviceNodes) evidence.push(`${n.path}: ${describePath(n.outcome)}`);
  evidence.push(describeSysClassTpm(cap.sysClassTpm));

  const sysfs = readSysfsFamilies(cap.versionMajor);
  const tool = readGetcapFamily(cap.getcapPropertiesFixed);
  evidence.push(...sysfs.evidence, ...tool.evidence);
  const families: readonly TpmFamily[] = [...sysfs.families, ...(tool.family === undefined ? [] : [tool.family])];

  const deniedNodes = cap.deviceNodes.filter((n) => n.outcome.kind === "permission-denied").map((n) => n.path);
  const deniedSources = [...deniedNodes];
  if (cap.sysClassTpm.kind === "permission-denied") deniedSources.push(SYS_CLASS_TPM);
  if (sysfs.denied) deniedSources.push(VERSION_MAJOR_FILE);

  return {
    foundNode: cap.deviceNodes.find((n) => n.outcome.kind === "found")?.path,
    deniedNodes,
    enumerated: cap.sysClassTpm.kind === "listed",
    chips: cap.sysClassTpm.kind === "listed" ? cap.sysClassTpm.entries.filter((e) => CHIP_ENTRY.test(e)) : [],
    has20: families.includes("2.0"),
    has12: families.includes("1.2"),
    deniedSources,
    evidence,
  };
}

export function classifyTpm2Linux(cap: Tpm2LinuxCapture): Tpm2Probe {
  if (cap.platform !== "linux") {
    return {
      state: "unavailable",
      reason:
        `platform "${cap.platform}" has no Linux TPM interface — /dev/tpmrm0, /sys/class/tpm and ` +
        `tpm2-tools were NOT consulted. This is "not asked", not "no TPM".`,
      evidence: [`platform: ${cap.platform}`],
    };
  }

  const { foundNode, deniedNodes, enumerated, chips, has20, has12, deniedSources, evidence } = gatherTpm2Facts(cap);

  // 2. The ONLY path to `present`: confirmed family 2.0 AND a node to open.
  if (has20 && foundNode !== undefined) {
    return {
      state: "present",
      deviceNode: foundNode,
      family: "2.0",
      reason: `TPM 2.0 confirmed: family indicator 2.0 and usable device node ${foundNode}`,
      evidence,
    };
  }
  if (has20) {
    // A TPM 2.0 is confirmed and its node is out of reach. WHY it is out of reach decides
    // the state: denied is `unreadable` (a privileged caller succeeds), missing is
    // `indeterminate` (nobody can use it from here). Collapsing these two would hide a
    // fixable permission problem behind an unfixable-sounding word.
    if (deniedNodes.length > 0) {
      return {
        state: "unreadable",
        family: "2.0",
        reason:
          `a TPM 2.0 is confirmed and its device node is DENIED (${deniedNodes.join(", ")}) — ` +
          "a privileged caller would get a different answer. This is NOT 'no TPM'.",
        evidence,
      };
    }
    return {
      state: "indeterminate",
      family: "2.0",
      reason:
        "family indicator reports TPM 2.0 but NO device node exists " +
        `(${TPM_DEVICE_NODES.join(", ")}) — a tier that needs to open the TPM cannot be honoured`,
      evidence,
    };
  }

  // 3. A real TPM of the WRONG family. Absent *for TPM 2.0*, and the fact is named.
  if (has12) {
    return {
      state: "absent",
      family: "1.2",
      reason:
        "a TPM 1.2 device is present. TPM 1.2 is a different, incompatible family — no " +
        "TPM2_Create, no tpm2_unseal, no SHA-256 PCR bank — so TPM 2.0 is ABSENT here even " +
        "though the machine has a TPM. Enable the 2.0 family in firmware, if the chip supports it.",
      evidence,
    };
  }

  // 4. A denial outranks every negative below it. This is the rule that keeps a check that
  //    could not run from reading as a check that ran and said no.
  if (deniedSources.length > 0) {
    return {
      state: "unreadable",
      reason:
        `at least one evidence source exists and denied access (${deniedSources.join(", ")}) — ` +
        "a privileged caller would get a different answer. This is NOT 'no TPM'.",
      evidence,
    };
  }

  // 5. Hardware is there; nothing could say which family it is.
  if (foundNode !== undefined) {
    return {
      state: "indeterminate",
      reason:
        `device node ${foundNode} exists but NOTHING confirmed the TPM family: no readable ` +
        "tpm_version_major (pre-4.19 kernels do not export it) and tpm2_getcap did not answer. " +
        "/dev/tpm0 is also the node for a TPM 1.2, so this is not evidence of TPM 2.0. " +
        "Install tpm2-tools and re-run, or read /sys/class/tpm/tpm0/tpm_version_major.",
      evidence,
    };
  }
  if (chips.length > 0) {
    return {
      state: "indeterminate",
      reason:
        `the tpm class registers ${chips.join(", ")} but no device node exists and the family ` +
        "is unconfirmed — the chip is enumerated and unusable from here",
      evidence,
    };
  }

  // 6. The ONLY path to `absent`: an enumeration ran and came back negative.
  if (enumerated) {
    return {
      state: "absent",
      reason:
        `${SYS_CLASS_TPM} enumerated and registers no TPM chip. The kernel exposes the tpm ` +
        "class, so this is a real negative — commonly an fTPM left disabled in firmware " +
        "(look for PTT / AMD fTPM / 'Security Device Support' in BIOS).",
      evidence,
    };
  }

  // 7. Nothing to ask.
  return {
    state: "unavailable",
    reason:
      `${SYS_CLASS_TPM} does not exist and no device node was found, so the TPM subsystem is ` +
      "not exposed on this host. 'No TPM installed' and 'the TPM driver is not loaded' are " +
      "indistinguishable from here — try `modprobe tpm_tis` (or tpm_crb) and re-run. This is " +
      "NOT a negative finding about the hardware.",
    evidence,
  };
}

/** Capture then classify. The convenience path; the two halves stay separable on purpose. */
export function probeTpm2Linux(fx: Tpm2LinuxEffects = realTpm2LinuxEffects()): Tpm2Probe {
  return classifyTpm2Linux(captureTpm2Linux(fx));
}

/**
 * Did the check actually RUN? `false` for `unavailable` and `unreadable` — the two states
 * that mean "no answer was obtained". A caller reporting "no TPM" on either of those is
 * committing the failure this module exists to prevent.
 */
export function tpm2CheckRan(state: Tpm2State): boolean {
  return state === "present" || state === "absent" || state === "indeterminate";
}

// ---------------------------------------------------------------------------
// CLI — capture on real silicon, classify anywhere
// ---------------------------------------------------------------------------

/** Renders a capture as the committable JSON fixture an x86 node should send back. */
export function captureToJson(cap: Tpm2LinuxCapture, provenance: string, expectedState: Tpm2State | "unknown"): string {
  return `${JSON.stringify({ provenance, expectedState, capture: cap }, null, 2)}\n`;
}

if (import.meta.main) {
  const wantJson = process.argv.includes("--capture-json");
  const cap = captureTpm2Linux();
  if (wantJson) {
    // Emit the capture for committing as a fixture. `expectedState` is left "unknown" on
    // purpose: the operator at the machine fills it in from what they OBSERVE, so the
    // fixture's expectation is a human's reading of the hardware and not this code's own
    // output agreeing with itself.
    process.stdout.write(captureToJson(cap, `captured on ${cap.platform}; fill in host details`, "unknown"));
  } else {
    const res = classifyTpm2Linux(cap);
    const family = res.family === undefined ? "" : ` (family ${res.family})`;
    const ran = tpm2CheckRan(res.state) ? "yes — this is an answer" : "NO — this is not an answer";
    console.log("[Linux TPM 2.0 probe]");
    console.log(`  State:  ${res.state.toUpperCase()}${family}`);
    console.log(`  Node:   ${res.deviceNode ?? "(none)"}`);
    console.log(`  Ran?    ${ran}`);
    console.log(`  Why:    ${res.reason}`);
    console.log("  Evidence:");
    for (const e of res.evidence) console.log(`    - ${e}`);
  }
}
