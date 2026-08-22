/**
 * keychain-macos.ts — read a macOS Keychain generic-password IN-PROCESS, via
 * Security.framework, without spawning `security(1)`.
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
