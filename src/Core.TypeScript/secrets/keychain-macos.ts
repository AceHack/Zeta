/**
 * keychain-macos.ts — the macOS Keychain seam. READ a generic-password
 * IN-PROCESS via Security.framework, without spawning `security(1)`; WRITE one
 * through `security -i` so the value crosses on stdin and never on an argv.
 *
 * The two halves are asymmetric on purpose and the asymmetry is measured, not
 * assumed: the read has an in-process path today, the write does not, and the
 * write section's header says exactly what that costs and what would close it.
 *
 * WHY THIS EXISTS (the confused deputy, measured)
 * ------------------------------------------------------------------------
 * Every credential read in this repo currently goes through a `security(1)`
 * subprocess. macOS evaluates a keychain item's ACL against the process that
 * *asks*, so the asker is always `/usr/bin/security` — Apple-signed, and never
 * the caller. The caller's own code identity never reaches the keychain at all.
 * That is Norm Hardy's confused deputy (ACM SIGOPS OSR 22(4), 1988): a deputy
 * exercising ITS authority on behalf of a principal whose authority the resource
 * never sees.
 *
 * Measured on this machine 2026-08-14, same `bun` process, same item:
 *
 *   security(1) subprocess          zeta-op-service-account -> OK, 852 bytes
 *   in-process SecItemCopyMatching  zeta-op-service-account -> -25293 (errSecAuthFailed)
 *   in-process SecItemCopyMatching  <absent service name>   -> -25300 (errSecItemNotFound)
 *
 * The absent-name control is what makes that a *authorization* result rather
 * than a broken query: the same query shape reaches the item and is refused.
 * So the deputy is real and it is load-bearing in BOTH directions — the reads
 * that work today work only because the deputy is trusted, and an in-process
 * reader is denied until the item is re-stored with an ACL that names it.
 *
 * NO PROMPT, STRUCTURALLY
 * ------------------------------------------------------------------------
 * `SecKeychainSetUserInteractionAllowed(false)` is called once, before any
 * lookup. On macOS an ACL miss is not `EACCES` — it is a GUI password dialog,
 * which on an unattended launchd cell is a wedge and in front of a human is an
 * agent parking a prompt for a credential they have never seen. With
 * interaction disabled the same miss returns an OSStatus. A denial is a result.
 *
 * NEVER LOGS A VALUE. Callers get lengths, presence, and an OSStatus.
 *
 * Anchors (Beacon):
 *   - Norm Hardy, "The Confused Deputy", ACM SIGOPS OSR 22(4), 1988.
 *   - Apple, Keychain Services / `SecItemCopyMatching`; `SecKeychainSetUserInteractionAllowed`
 *     (deprecated at 10.10, still the only process-wide prompt suppressor for the
 *     file-based keychain these items live in).
 *   - Goguen & Meseguer (1982) noninterference — the discipline the ambient
 *     `OP_SERVICE_ACCOUNT_TOKEN` hoist violated; this module is the declared,
 *     metered channel that replaces it.
 */

/** OSStatus values this module distinguishes. */
export const errSecSuccess = 0;
export const errSecItemNotFound = -25300;
export const errSecAuthFailed = -25293;
export const errSecInteractionNotAllowed = -25308;

/**
 * How a read was served. `deputy` means `security(1)` was spawned and the
 * caller's code identity did NOT reach the keychain — it is reported, never
 * silent, so a fallback cannot quietly reintroduce the defect it replaces.
 */
export type ReadVia = "in-process" | "deputy";

export type KeychainRead =
  | { readonly ok: true; readonly secret: string; readonly via: ReadVia }
  | { readonly ok: false; readonly status: number; readonly reason: string; readonly via: ReadVia };

/** Presence and size only — the shape that is safe to log. */
export interface KeychainPresence {
  readonly present: boolean;
  readonly length: number;
  readonly status: number;
  readonly via: ReadVia;
}

export function describeStatus(status: number): string {
  switch (status) {
    case errSecSuccess: return "errSecSuccess";
    case errSecItemNotFound: return "errSecItemNotFound (no such keychain item)";
    case errSecAuthFailed: return "errSecAuthFailed (ACL does not name this caller)";
    case errSecInteractionNotAllowed: return "errSecInteractionNotAllowed (would have prompted; interaction is disabled by design)";
    default: return `OSStatus ${String(status)}`;
  }
}

/**
 * `security(1)` truncates an OSStatus to its low byte for its process exit code.
 * Exported because the arithmetic has already produced one wrong conclusion:
 * exit 44 was read as errSecInteractionNotAllowed in an earlier survey, but
 * 44 is errSecItemNotFound. errSecInteractionNotAllowed exits 36.
 */
export function exitCodeForStatus(status: number): number {
  return status & 0xff;
}

// ── the FFI binding, lazily initialised, darwin-only ─────────────────────────

interface Bound {
  readonly lookup: (service: string) => { status: number; length: number; secret: string | null };
}

/**
 * bun:ffi's `Pointer` is a branded number. The brand is erased at runtime, so
 * this is a type assertion, not a conversion — but it keeps every crossing
 * between "a number dlsym gave us" and "a pointer the FFI expects" explicit and
 * greppable rather than scattering `as never` through the binding.
 */
type Pointer = import("bun:ffi").Pointer;
const asPointer = (n: number): Pointer => n as unknown as Pointer;

let bound: Bound | null | undefined;

function bind(): Bound | null {
  if (bound !== undefined) return bound;
  bound = null;
  if (process.platform !== "darwin") return bound;
  try {
    // Late import: `bun:ffi` must not be resolved at module load on Linux CI.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffi = require("bun:ffi") as typeof import("bun:ffi");
    const { dlopen, FFIType, ptr, read } = ffi;

    const SEC = "/System/Library/Frameworks/Security.framework/Security";
    const CF = "/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation";

    const cstr = (s: string): Uint8Array => {
      const b = new Uint8Array(Buffer.byteLength(s, "utf8") + 1);
      b.set(Buffer.from(s, "utf8"));
      return b;
    };

    // `dlopen` from bun:ffi binds FUNCTIONS only. The Keychain query keys
    // (kSecClass, kSecAttrService, …) are DATA symbols, so they need dlsym.
    const libc = dlopen("libSystem.B.dylib", {
      dlopen: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.ptr },
      dlsym: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.ptr },
    });
    const RTLD_NOW = 2;
    const hSec = libc.symbols.dlopen(ptr(cstr(SEC)), RTLD_NOW);
    const hCF = libc.symbols.dlopen(ptr(cstr(CF)), RTLD_NOW);
    if (!hSec || !hCF) return bound;

    const sym = (h: Pointer, name: string): Pointer => {
      const p = libc.symbols.dlsym(h, ptr(cstr(name)));
      if (!p) throw new Error(`dlsym: ${name}`);
      return p;
    };
    // A CFStringRef global is a POINTER VARIABLE: dlsym gives its address, and
    // the value we want is one dereference in.
    const derefSec = (n: string): number => read.ptr(sym(hSec, n), 0);
    const derefCF = (n: string): number => read.ptr(sym(hCF, n), 0);
    const keyCallbacks = sym(hCF, "kCFTypeDictionaryKeyCallBacks");
    const valCallbacks = sym(hCF, "kCFTypeDictionaryValueCallBacks");

    const kSecClass = derefSec("kSecClass");
    const kSecClassGenericPassword = derefSec("kSecClassGenericPassword");
    const kSecAttrService = derefSec("kSecAttrService");
    const kSecReturnData = derefSec("kSecReturnData");
    const kSecMatchLimit = derefSec("kSecMatchLimit");
    const kSecMatchLimitOne = derefSec("kSecMatchLimitOne");
    const kCFBooleanTrue = derefCF("kCFBooleanTrue");
    const cf = dlopen(CF, {
      CFStringCreateWithCString: { args: [FFIType.ptr, FFIType.ptr, FFIType.u32], returns: FFIType.ptr },
      CFDictionaryCreate: { args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.i64, FFIType.ptr, FFIType.ptr], returns: FFIType.ptr },
      CFDataGetLength: { args: [FFIType.ptr], returns: FFIType.i64 },
      CFDataGetBytePtr: { args: [FFIType.ptr], returns: FFIType.ptr },
      CFRelease: { args: [FFIType.ptr], returns: FFIType.void },
    });
    const sec = dlopen(SEC, {
      SecItemCopyMatching: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
      SecKeychainSetUserInteractionAllowed: { args: [FFIType.u8], returns: FFIType.i32 },
    });

    // Do this ONCE, before any lookup can run: an ACL miss must return an
    // OSStatus, never a dialog. See the header.
    sec.symbols.SecKeychainSetUserInteractionAllowed(0);

    const kCFStringEncodingUTF8 = 0x08000100;
    const big = (n: number): bigint => BigInt(n);

    const lookup = (service: string): { status: number; length: number; secret: string | null } => {
      const svc = cf.symbols.CFStringCreateWithCString(null, ptr(cstr(service)), kCFStringEncodingUTF8);
      if (!svc) return { status: errSecAuthFailed, length: 0, secret: null };
      const keys = new BigUint64Array([big(kSecClass), big(kSecAttrService), big(kSecReturnData), big(kSecMatchLimit)]);
      const vals = new BigUint64Array([big(kSecClassGenericPassword), big(svc), big(kCFBooleanTrue), big(kSecMatchLimitOne)]);
      // Callback tables are STRUCTS, not pointer variables — pass the ADDRESS.
      const query = cf.symbols.CFDictionaryCreate(null, ptr(keys), ptr(vals), 4, keyCallbacks, valCallbacks);
      const out = new BigUint64Array(1);
      const status = sec.symbols.SecItemCopyMatching(query, ptr(out));
      let length = 0;
      let secret: string | null = null;
      const dataRefRaw = Number(out[0] ?? 0n);
      if (status === errSecSuccess && dataRefRaw) {
        const dataRef = asPointer(dataRefRaw);
        length = Number(cf.symbols.CFDataGetLength(dataRef));
        const bytes = cf.symbols.CFDataGetBytePtr(dataRef);
        if (bytes && length > 0) {
          secret = Buffer.from(new Uint8Array(ffi.toArrayBuffer(bytes, 0, length))).toString("utf8");
        }
        cf.symbols.CFRelease(dataRef);
      }
      if (query) cf.symbols.CFRelease(query);
      cf.symbols.CFRelease(svc);
      return { status, length, secret };
    };

    bound = { lookup };
    return bound;
  } catch {
    bound = null;
    return bound;
  }
}

/** True when the in-process path is bound and usable on this host. */
export function inProcessAvailable(): boolean {
  return bind() !== null;
}

// ── the deputy, kept explicit ────────────────────────────────────────────────

function readViaDeputy(service: string): KeychainRead {
  if (process.platform !== "darwin") {
    return { ok: false, status: errSecItemNotFound, reason: "not macOS", via: "deputy" };
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { execFileSync } = require("node:child_process") as typeof import("node:child_process");
  try {
    const secret = execFileSync("security", ["find-generic-password", "-s", service, "-w"], {
      encoding: "utf8",
      timeout: 10_000,
    }).trim();
    return { ok: true, secret, via: "deputy" };
  } catch (e) {
    const code = (e as { status?: number }).status ?? 1;
    return { ok: false, status: -code, reason: `security(1) exit ${String(code)}`, via: "deputy" };
  }
}

export interface ReadOptions {
  /**
   * Permit falling back to a `security(1)` subprocess when the in-process read
   * is refused. Default TRUE, because every item on this machine today was
   * stored with an ACL that names only `security` — turning it off before the
   * re-store ceremony would break every caller. The fallback is REPORTED in
   * `via`, never silent. Set false once the items are re-stored.
   */
  readonly allowDeputyFallback?: boolean;
}

/**
 * Read a generic-password item. In-process first; deputy only if permitted and
 * only after the in-process attempt was refused (never as a shortcut).
 */
export function readGenericPassword(service: string, options: ReadOptions = {}): KeychainRead {
  const allowDeputy = options.allowDeputyFallback ?? true;
  const b = bind();
  if (b) {
    const r = b.lookup(service);
    if (r.status === errSecSuccess && r.secret !== null) {
      return { ok: true, secret: r.secret, via: "in-process" };
    }
    // Item genuinely absent: the deputy cannot do better, so do not spawn it.
    if (r.status === errSecItemNotFound) {
      return { ok: false, status: r.status, reason: describeStatus(r.status), via: "in-process" };
    }
    if (!allowDeputy) {
      return { ok: false, status: r.status, reason: describeStatus(r.status), via: "in-process" };
    }
  } else if (!allowDeputy) {
    return { ok: false, status: errSecAuthFailed, reason: "in-process Security.framework unavailable", via: "in-process" };
  }
  return readViaDeputy(service);
}

/** Presence + length only. The read that is always safe to print. */
export function probeGenericPassword(service: string, options: ReadOptions = {}): KeychainPresence {
  const r = readGenericPassword(service, options);
  return r.ok
    ? { present: true, length: r.secret.length, status: errSecSuccess, via: r.via }
    : { present: false, length: 0, status: r.status, via: r.via };
}

// ── WRITE: store a generic-password item WITHOUT putting it on an argv ───────
//
// THE DEFECT THIS SIDE REPLACES
// ------------------------------------------------------------------------
// `tools/setup/op-token-setup.sh:83` and `tools/setup/secret-clip.sh:93` both
// ran `security add-generic-password … -U -w "$TOKEN"`. `security(1)` is an
// external binary, so the token was in that process's argv — readable by any
// same-uid process through `ps` for the life of the call.
// `docs/SHELL-DEPRECATION-SEQUENCE.md` measured it (`argv-secret@83`) and
// named the fix as the first thing any conversion must carry.
//
// The transport used here is `security -i`: interactive mode reads COMMANDS
// from stdin and builds their argv inside its own address space. `ps` shows
// `security -i` and nothing else. Verified on this machine 2026-08-22 against a
// throwaway keychain (never the login keychain): the value round-tripped byte
// for byte, and argv held two elements.
//
// WHAT `security -i` COSTS, MEASURED, NOT ASSUMED
// ------------------------------------------------------------------------
// It ALWAYS EXITS 0. A write to a nonexistent keychain path exits 0 with empty
// stdout and empty stderr — the same observable result as a success. So the
// exit status of this transport carries no information and is never read here.
// The write is confirmed by READING THE ITEM BACK and comparing; an unverified
// write is reported as a refusal, never as a success. (This is the same class as
// the `decide-by-grep` gate defect: a check whose failure looks like a pass.)
//
// WHY NOT `SecItemAdd` IN-PROCESS. It would remove the subprocess entirely and
// return a real OSStatus. It would also give the new item an ACL naming the
// CREATING binary (`bun`), which would break every existing
// `security find-generic-password` consumer in the repo and re-prompt on each
// `bun` upgrade. That re-store ceremony is tracked separately as
// `081M00VN3FX087G0R0006ZGRWG`; until it lands, the write stays on the same
// deputy the reads already use, and says so.

/** The result of one `security(1)` invocation. `status` is reported, never trusted — see above. */
export interface SecuritySpawnResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * The injected door to `security(1)`. Tests pass a fake; nothing in a test run
 * may reach a real keychain. `argv` is asserted secret-free by the caller's
 * falsifier — that assertion is the whole point of this seam being a parameter.
 */
export type SecuritySpawn = (argv: readonly string[], stdin: string) => SecuritySpawnResult;

/** The complete argv. It is a CONSTANT: no interpolation, so no secret can reach it. */
export const SECURITY_INTERACTIVE_ARGV: readonly string[] = ["security", "-i"];

/**
 * Characters a secret may contain and still cross the `security -i` command
 * line unambiguously. Whitespace, quotes, backslash and `#` are excluded
 * because the interactive parser resolves them, so carrying them would risk
 * storing a DIFFERENT value than the operator typed. Refusing is honest;
 * silently storing a mangled token is not.
 */
export const TRANSPORTABLE_SECRET = /^[A-Za-z0-9._~:/+=-]+$/;

/** Service and account names are ours, not the operator's prose. Same reasoning. */
export const KEYCHAIN_NAME_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export type KeychainWriteRefusal =
  | "not-macos"
  | "malformed-service"
  | "malformed-account"
  | "empty-secret"
  | "untransportable-secret"
  | "write-not-verified";

export type KeychainWrite =
  | { readonly ok: true; readonly length: number; readonly via: ReadVia }
  | { readonly ok: false; readonly refusal: KeychainWriteRefusal; readonly detail: string };

/**
 * The one line handed to `security -i` on STDIN. Exported so a test can prove
 * the secret travels HERE and not in `SECURITY_INTERACTIVE_ARGV`.
 * Callers must validate first; this function does not.
 */
export function buildInteractiveAddCommand(account: string, service: string, secret: string): string {
  return `add-generic-password -a ${account} -s ${service} -U -w ${secret}\n`;
}

/**
 * True when any argv element carries the secret. The positive case exists so the
 * falsifier that uses it can itself be falsified: fed the OLD bash argv shape it
 * must return true, fed ours it must return false. A guard with only a negative
 * case is a guard that cannot fail.
 */
export function argvCarriesSecret(argv: readonly string[], secret: string): boolean {
  return secret.length > 0 && argv.some((arg) => arg.includes(secret));
}

function realSecuritySpawn(argv: readonly string[], stdin: string): SecuritySpawnResult {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { spawnSync } = require("node:child_process") as typeof import("node:child_process");
  const [command, ...args] = argv;
  if (command === undefined) throw new Error("realSecuritySpawn: empty argv");
  const r = spawnSync(command, args, { input: stdin, encoding: "utf8", timeout: 30_000 });
  return {
    status: r.status ?? -1,
    stdout: typeof r.stdout === "string" ? r.stdout : "",
    stderr: typeof r.stderr === "string" ? r.stderr : "",
  };
}

export interface StoreOptions {
  readonly spawn?: SecuritySpawn;
  /** How the write is confirmed. Defaults to reading the item back. */
  readonly verify?: (service: string) => KeychainRead;
  readonly platform?: string;
}

/**
 * Store (or update, `-U`) a generic-password item. The secret crosses on stdin.
 * It is never an argv element, never returned, and never logged — the caller
 * gets a length and a refusal reason.
 */
export function storeGenericPassword(
  account: string,
  service: string,
  secret: string,
  options: StoreOptions = {},
): KeychainWrite {
  const platform = options.platform ?? process.platform;
  if (platform !== "darwin") {
    return { ok: false, refusal: "not-macos", detail: `platform is ${platform}, not darwin` };
  }
  if (!KEYCHAIN_NAME_SHAPE.test(service)) {
    return { ok: false, refusal: "malformed-service", detail: `service name is not ${String(KEYCHAIN_NAME_SHAPE)}` };
  }
  if (!KEYCHAIN_NAME_SHAPE.test(account)) {
    return { ok: false, refusal: "malformed-account", detail: `account name is not ${String(KEYCHAIN_NAME_SHAPE)}` };
  }
  if (secret.length === 0) {
    return { ok: false, refusal: "empty-secret", detail: "nothing to store" };
  }
  if (!TRANSPORTABLE_SECRET.test(secret)) {
    return {
      ok: false,
      refusal: "untransportable-secret",
      detail: `the value contains a character this transport cannot carry unambiguously (length ${String(secret.length)})`,
    };
  }

  const spawn = options.spawn ?? realSecuritySpawn;
  // The status is deliberately discarded: `security -i` exits 0 on failure.
  spawn(SECURITY_INTERACTIVE_ARGV, buildInteractiveAddCommand(account, service, secret));

  const verify = options.verify ?? ((s: string): KeychainRead => readGenericPassword(s));
  const back = verify(service);
  if (!back.ok) {
    return { ok: false, refusal: "write-not-verified", detail: `read-back failed: ${back.reason}` };
  }
  if (back.secret !== secret) {
    return {
      ok: false,
      refusal: "write-not-verified",
      detail: `read-back returned a different value (stored ${String(secret.length)} bytes, read ${String(back.secret.length)})`,
    };
  }
  return { ok: true, length: secret.length, via: back.via };
}
