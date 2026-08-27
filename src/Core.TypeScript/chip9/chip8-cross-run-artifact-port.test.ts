import { describe, expect, test } from "bun:test";
import {
  createNativeCrossRunArtifactBytePort,
  loadCrossRunReader,
  type CrossRunArtifactBytePort,
  type CrossRunArtifactPortResult,
} from "./chip8-cross-run-artifact-port";
import { artifactFileName, keyText, parseArtifact, type OrbitArtifact } from "./chip8-cross-run-store";

const fixtureFileName = "6fc62d33efc40357.orbit.json";
const fixturePath = `db/emus/chip8/orbits/${fixtureFileName}`;

async function fixtureBytes(): Promise<Uint8Array> {
  return Bun.file(fixturePath).bytes();
}

function bytePort(read: (location: string, signal?: AbortSignal) => Uint8Array): CrossRunArtifactBytePort {
  return { read: (location, signal) => Promise.resolve({ ok: true, value: read(location, signal) }) };
}

function unwrap<T>(result: CrossRunArtifactPortResult<T>): T {
  if (!result.ok) throw new Error(`${result.feedback.code}: ${result.feedback.detail}`);
  return result.value;
}

async function parsedFixture(bytes: Uint8Array): Promise<OrbitArtifact> {
  const parsed = await parseArtifact(new TextDecoder().decode(bytes));
  if (!parsed.ok) throw new Error(`${parsed.feedback.code}: ${parsed.feedback.detail}`);
  return parsed.value;
}

describe("CHIP-8 cross-run artifact byte port", () => {
  test("publishes one verified reader only after the complete immutable set is accepted", async () => {
    const bytes = await fixtureBytes();
    const artifact = await parsedFixture(bytes);
    const location = `https://example.test/orbits/${fixtureFileName}`;

    const loaded = unwrap(
      await loadCrossRunReader(
        bytePort(() => bytes),
        [location],
      ),
    );

    expect(await artifactFileName(artifact.key)).toBe(fixtureFileName);
    expect(loaded.locations).toEqual([location]);
    expect(loaded.byteCount).toBe(BigInt(bytes.byteLength));
    expect(loaded.reader.tryGet(artifact.key)?.bodyDigest).toBe(artifact.bodyDigest);
  });

  test("publishes the honest empty reader for an empty source list", async () => {
    let reads = 0;
    const loaded = unwrap(
      await loadCrossRunReader(
        bytePort(() => {
          reads += 1;
          return new Uint8Array();
        }),
        [],
      ),
    );

    expect(reads).toBe(0);
    expect(loaded.artifacts).toEqual([]);
    expect(loaded.byteCount).toBe(0n);
  });

  test("refuses the whole set when any artifact digest is corrupt", async () => {
    const valid = await fixtureBytes();
    const corruptObject = JSON.parse(new TextDecoder().decode(valid)) as Record<string, unknown>;
    corruptObject.bodyDigest = "0".repeat(64);
    const corrupt = new TextEncoder().encode(JSON.stringify(corruptObject));
    const location = `https://example.test/orbits/${fixtureFileName}`;

    const result = await loadCrossRunReader(
      bytePort(() => corrupt),
      [location],
    );

    expect(result).toMatchObject({
      ok: false,
      feedback: {
        code: "artifact-rejected",
        location,
        artifactFeedback: { code: "digest-mismatch" },
      },
    });
    expect("value" in result).toBe(false);
  });

  test("refuses noncanonical filenames and duplicate run keys", async () => {
    const bytes = await fixtureBytes();
    const wrongLocation = "https://example.test/orbits/wrong.orbit.json";
    const wrongName = await loadCrossRunReader(
      bytePort(() => bytes),
      [wrongLocation],
    );
    expect(wrongName).toMatchObject({
      ok: false,
      feedback: { code: "file-name-mismatch", location: wrongLocation },
    });

    const first = `https://one.test/orbits/${fixtureFileName}`;
    const duplicate = `https://two.test/orbits/${fixtureFileName}`;
    const duplicated = await loadCrossRunReader(
      bytePort(() => bytes),
      [duplicate, first],
    );
    expect(duplicated).toMatchObject({
      ok: false,
      feedback: { code: "duplicate-run-key", location: duplicate },
    });
    expect(duplicated.ok ? "" : duplicated.feedback.detail).toContain(first);
  });

  test("reports strict UTF-8 failure and cancellation as values", async () => {
    const location = `https://example.test/orbits/${fixtureFileName}`;
    const invalidUtf8 = await loadCrossRunReader(
      bytePort(() => Uint8Array.of(0xc3, 0x28)),
      [location],
    );
    expect(invalidUtf8).toMatchObject({
      ok: false,
      feedback: { code: "text-decode-failed", location },
    });

    let reads = 0;
    const controller = new AbortController();
    controller.abort();
    const cancelled = await loadCrossRunReader(
      bytePort(() => {
        reads += 1;
        return new Uint8Array();
      }),
      [location],
      controller.signal,
    );
    expect(cancelled).toMatchObject({ ok: false, feedback: { code: "cancelled" } });
    expect(reads).toBe(0);

    const bytes = await fixtureBytes();
    const cancelledAfterRead = new AbortController();
    const stoppedBeforePublication = await loadCrossRunReader(
      bytePort(() => {
        cancelledAfterRead.abort();
        return bytes;
      }),
      [location],
      cancelledAfterRead.signal,
    );
    expect(stoppedBeforePublication).toMatchObject({
      ok: false,
      feedback: { code: "cancelled", location },
    });
    expect("value" in stoppedBeforePublication).toBe(false);
  });

  test("adapts injected fetch without performing I/O during construction", async () => {
    const bytes = await fixtureBytes();
    let fetches = 0;
    const created = createNativeCrossRunArtifactBytePort({
      fetch: () => {
        fetches += 1;
        return Promise.resolve({
          ok: true,
          status: 200,
          arrayBuffer: () => Promise.resolve(Uint8Array.from(bytes).buffer),
        });
      },
    });
    const port = unwrap(created);
    expect(fetches).toBe(0);

    const read = unwrap(await port.read(`https://example.test/orbits/${fixtureFileName}`));
    expect(fetches).toBe(1);
    expect(read).toEqual(bytes);
  });

  test("reports unavailable and refusing native fetch edges without throwing", async () => {
    expect(createNativeCrossRunArtifactBytePort({})).toMatchObject({
      ok: false,
      feedback: { code: "source-unavailable" },
    });

    const port = unwrap(
      createNativeCrossRunArtifactBytePort({
        fetch: () =>
          Promise.resolve({ ok: false, status: 404, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }),
      }),
    );
    const location = `https://example.test/orbits/${fixtureFileName}`;
    expect(await port.read(location)).toMatchObject({
      ok: false,
      feedback: { code: "http-refused", location },
    });
  });

  test("the loaded reader is keyed by the full canonical run identity", async () => {
    const bytes = await fixtureBytes();
    const artifact = await parsedFixture(bytes);
    const loaded = unwrap(
      await loadCrossRunReader(
        bytePort(() => bytes),
        [`https://example.test/orbits/${fixtureFileName}`],
      ),
    );

    expect(keyText(loaded.artifacts[0]?.key ?? artifact.key)).toBe(keyText(artifact.key));
    expect(loaded.reader.tryGet({ ...artifact.key, seedHex: `${artifact.key.seedHex}00` })).toBeNull();
  });
});
