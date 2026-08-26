import {
  artifactFileName,
  emptyCrossRunReader,
  keyText,
  ordinal,
  parseArtifact,
  readerOf,
  type CrossRunFeedback,
  type CrossRunReader,
  type OrbitArtifact,
} from "./chip8-cross-run-store";

export type CrossRunArtifactPortFeedbackCode =
  | "source-unavailable"
  | "location-invalid"
  | "http-refused"
  | "read-failed"
  | "text-decode-failed"
  | "artifact-rejected"
  | "file-name-mismatch"
  | "duplicate-run-key"
  | "cancelled";

export interface CrossRunArtifactPortFeedback {
  readonly code: CrossRunArtifactPortFeedbackCode;
  readonly detail: string;
  readonly location: string | null;
  readonly artifactFeedback?: CrossRunFeedback;
}

export type CrossRunArtifactPortResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: CrossRunArtifactPortFeedback };

/** The environment-facing half of the port. Rooms only receive the verified reader it produces. */
export interface CrossRunArtifactBytePort {
  read(location: string, signal?: AbortSignal): Promise<CrossRunArtifactPortResult<Uint8Array>>;
}

export interface LoadedCrossRunStore {
  readonly reader: CrossRunReader;
  readonly artifacts: readonly OrbitArtifact[];
  readonly locations: readonly string[];
  readonly byteCount: bigint;
}

function succeeded<T>(value: T): CrossRunArtifactPortResult<T> {
  return { ok: true, value };
}

function failed<T>(
  code: CrossRunArtifactPortFeedbackCode,
  detail: string,
  location: string | null = null,
  artifactFeedback?: CrossRunFeedback,
): CrossRunArtifactPortResult<T> {
  return {
    ok: false,
    feedback: {
      code,
      detail,
      location,
      ...(artifactFeedback === undefined ? {} : { artifactFeedback }),
    },
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && (typeof value === "object" || typeof value === "function");
}

function isCancelled(signal: AbortSignal | undefined, error?: unknown): boolean {
  return signal?.aborted === true || (error instanceof Error && error.name === "AbortError");
}

function locationFileName(location: string): string | null {
  if (location.length === 0 || /[\u0000-\u001f\u007f]/.test(location)) return null;
  const marker = location.search(/[?#]/);
  const path = marker < 0 ? location : location.slice(0, marker);
  const separator = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const name = path.slice(separator + 1);
  return name.length === 0 ? null : name;
}

/** Adapt an injected fetch implementation. Constructing the adapter performs no I/O. */
export function createNativeCrossRunArtifactBytePort(
  root: unknown = globalThis,
): CrossRunArtifactPortResult<CrossRunArtifactBytePort> {
  if (!isRecord(root)) return failed("source-unavailable", "The browser root is not an object.");

  let fetchValue: unknown;
  try {
    fetchValue = Reflect.get(root, "fetch");
  } catch {
    return failed("source-unavailable", "The browser root refused access to fetch.");
  }
  if (typeof fetchValue !== "function") {
    return failed("source-unavailable", "The browser root does not expose fetch.");
  }

  return succeeded({
    read: async (location, signal) => {
      if (locationFileName(location) === null) {
        return failed("location-invalid", "Artifact locations must end in a printable filename.", location);
      }
      if (isCancelled(signal)) return failed("cancelled", "The artifact read was cancelled.", location);

      let response: unknown;
      try {
        response = await Reflect.apply(fetchValue, root, [location, signal === undefined ? {} : { signal }]);
      } catch (error) {
        return isCancelled(signal, error)
          ? failed("cancelled", "The artifact read was cancelled.", location)
          : failed("read-failed", "The injected fetch operation threw while reading the artifact.", location);
      }
      if (!isRecord(response)) return failed("read-failed", "The injected fetch returned no response.", location);

      let ok: unknown;
      let status: unknown;
      let arrayBuffer: unknown;
      try {
        ok = Reflect.get(response, "ok");
        status = Reflect.get(response, "status");
        arrayBuffer = Reflect.get(response, "arrayBuffer");
      } catch {
        return failed("read-failed", "The injected fetch response could not be inspected.", location);
      }
      if (ok !== true) {
        return failed(
          "http-refused",
          `The artifact source refused the read with status ${typeof status === "number" ? String(status) : "unknown"}.`,
          location,
        );
      }
      if (typeof arrayBuffer !== "function") {
        return failed("read-failed", "The injected fetch response has no arrayBuffer operation.", location);
      }

      try {
        const value = await Reflect.apply(arrayBuffer, response, []);
        if (!(value instanceof ArrayBuffer)) {
          return failed("read-failed", "The injected fetch response did not produce an ArrayBuffer.", location);
        }
        return succeeded(new Uint8Array(value));
      } catch (error) {
        return isCancelled(signal, error)
          ? failed("cancelled", "The artifact read was cancelled.", location)
          : failed("read-failed", "The artifact response threw while reading its bytes.", location);
      }
    },
  });
}

/** Load and verify an immutable set before publishing one reader. A single bad member refuses all. */
export async function loadCrossRunReader(
  port: CrossRunArtifactBytePort,
  locations: readonly string[],
  signal?: AbortSignal,
): Promise<CrossRunArtifactPortResult<LoadedCrossRunStore>> {
  if (signal?.aborted === true) return failed("cancelled", "The artifact load was cancelled.");
  if (locations.length === 0) {
    return succeeded({ reader: emptyCrossRunReader, artifacts: [], locations: [], byteCount: 0n });
  }

  const orderedLocations = [...locations].sort(ordinal);
  const artifacts: OrbitArtifact[] = [];
  const firstLocationByKey = new Map<string, string>();
  let byteCount = 0n;

  for (const location of orderedLocations) {
    const actualFileName = locationFileName(location);
    if (actualFileName === null) {
      return failed("location-invalid", "Artifact locations must end in a printable filename.", location);
    }
    if (isCancelled(signal)) return failed("cancelled", "The artifact load was cancelled.", location);

    let read: CrossRunArtifactPortResult<Uint8Array>;
    try {
      read = await port.read(location, signal);
    } catch (error) {
      return isCancelled(signal, error)
        ? failed("cancelled", "The artifact load was cancelled.", location)
        : failed("read-failed", "The injected artifact byte port threw.", location);
    }
    if (!read.ok) return read;
    if (isCancelled(signal)) return failed("cancelled", "The artifact load was cancelled.", location);

    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(read.value);
    } catch {
      return failed("text-decode-failed", "The artifact is not strict UTF-8.", location);
    }

    const parsed = await parseArtifact(text);
    if (isCancelled(signal)) return failed("cancelled", "The artifact load was cancelled.", location);
    if (!parsed.ok) {
      return failed("artifact-rejected", parsed.feedback.detail, location, parsed.feedback);
    }

    const expectedFileName = await artifactFileName(parsed.value.key);
    if (actualFileName !== expectedFileName) {
      return failed(
        "file-name-mismatch",
        `Expected canonical artifact filename ${expectedFileName}, found ${actualFileName}.`,
        location,
      );
    }

    const identity = keyText(parsed.value.key);
    const firstLocation = firstLocationByKey.get(identity);
    if (firstLocation !== undefined) {
      return failed(
        "duplicate-run-key",
        `Run key was already loaded from ${firstLocation}; duplicate found at ${location}.`,
        location,
      );
    }

    firstLocationByKey.set(identity, location);
    artifacts.push(parsed.value);
    byteCount += BigInt(read.value.byteLength);
  }

  if (isCancelled(signal)) return failed("cancelled", "The artifact load was cancelled.");

  return succeeded({
    reader: readerOf(artifacts),
    artifacts,
    locations: orderedLocations,
    byteCount,
  });
}
