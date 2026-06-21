import { expect, test, describe } from "bun:test";
import { type FileTypePlugin } from "./types";
import { validatePlugin } from "./determinism";
import { ZetaCell } from "./cell";
import { npmCodec, cargoCodec } from "./codecs";
import { AceCellContainer } from "../ace/cell-injection";
import { cstr, param, lambda, call, binary } from "../bonsai/bonsai";
import { ofEntries } from "../z-set/z-set";
import { compareTagged } from "./types";

describe("Determinism Contract & Ace Cell Injection", () => {
  
  // 1. Test validatePlugin
  test("validatePlugin allows deterministic operations", () => {
    const validPlugin: FileTypePlugin = {
      fileType: ".json",
      parserRef: "json",
      serializerRef: "json",
      views: [
        {
          name: "get_title",
          query: call("filter", [
            param("zset"),
            lambda(
              ["entry"],
              binary("eq", call("get_field", [param("entry"), cstr("type")]), cstr("task"))
            )
          ])
        }
      ]
    };

    const res = validatePlugin(validPlugin);
    expect(res.ok).toBe(true);
  });

  test("validatePlugin rejects non-deterministic operations", () => {
    const invalidPlugin: FileTypePlugin = {
      fileType: ".json",
      parserRef: "json",
      serializerRef: "json",
      views: [
        {
          name: "get_time",
          query: call("now", []) // forbidden function 'now'
        }
      ]
    };

    const res = validatePlugin(invalidPlugin);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("Forbidden function call: now");
  });

  test("validatePlugin rejects invalid codecs", () => {
    const invalidPlugin: FileTypePlugin = {
      fileType: ".json",
      parserRef: "unsupported-codec",
      serializerRef: "json",
      views: []
    };

    const res = validatePlugin(invalidPlugin);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("Forbidden parser reference");
  });

  // 2. Test Time Crystal Tick Loop
  test("Time crystal update loop advances clock and applies delta", async () => {
    const cell = new ZetaCell("cell-01");
    expect(cell.getLogicalTime()).toBe(0);

    const input1 = ofEntries(compareTagged, [
      { e: { t: "obj", v: [["k", { t: "str", v: "a" }], ["v", { t: "str", v: "1" }]] }, w: 1 }
    ]);
    
    await cell.tick(input1);
    expect(cell.getLogicalTime()).toBe(1);
    expect(cell.getState().length).toBe(1);

    const input2 = ofEntries(compareTagged, [
      { e: { t: "obj", v: [["k", { t: "str", v: "b" }], ["v", { t: "str", v: "2" }]] }, w: 1 }
    ]);

    await cell.tick(input2);
    expect(cell.getLogicalTime()).toBe(2);
    expect(cell.getState().length).toBe(2);
  });

  // 3. Test npm and Cargo Codecs
  test("npmCodec package.json parsing and serializing", () => {
    const manifest = `{
  "name": "my-project",
  "version": "1.0.0",
  "dependencies": {
    "lodash": "4.17.21"
  },
  "devDependencies": {
    "typescript": "5.0.4"
  }
}`;
    const zset = npmCodec.parse(manifest);
    expect(zset.length).toBe(4); // name, version, lodash, typescript

    const doc = npmCodec.serialize(zset);
    const parsed = JSON.parse(doc);
    expect(parsed.name).toBe("my-project");
    expect(parsed.version).toBe("1.0.0");
    expect(parsed.dependencies.lodash).toBe("4.17.21");
    expect(parsed.devDependencies.typescript).toBe("5.0.4");
  });

  test("cargoCodec Cargo.toml parsing and serializing", () => {
    const manifest = `[package]
name = "cargo-project"
version = "0.1.0"

[dependencies]
serde = "1.0"
tokio = "1.28"
`;
    const zset = cargoCodec.parse(manifest);
    expect(zset.length).toBe(4); // name, version, serde, tokio

    const doc = cargoCodec.serialize(zset);
    expect(doc).toContain(`name = "cargo-project"`);
    expect(doc).toContain(`version = "0.1.0"`);
    expect(doc).toContain(`serde = "1.0"`);
    expect(doc).toContain(`tokio = "1.28"`);
  });

  // 4. Test Ace DI injection
  test("AceCellContainer injects cell and manages plugins", async () => {
    const container = new AceCellContainer();
    const cell = new ZetaCell("cell-02");
    container.injectCell(cell);

    // Register Cargo and npm plugins
    container.registerPlugin(".json", "npm");
    container.registerPlugin(".toml", "cargo");

    const npmManifest = `{
  "name": "ace-app",
  "version": "0.1.0",
  "dependencies": {
    "bun": "1.0.0"
  }
}`;
    await container.processManifest(".json", npmManifest);
    expect(container.getCell().getState().length).toBe(3); // name, version, bun

    const cargoManifest = `[package]
name = "cargo-app"
version = "0.2.0"

[dependencies]
rand = "0.8"
`;
    await container.processManifest(".toml", cargoManifest);
    // Since we applied union directly to the cell state without retractions,
    // both name and version variants are stored as distinct elements (since their values differ).
    // Total entries: name (npm), name (cargo), version (npm), version (cargo), bun, rand.
    const state = container.getCell().getState();
    expect(state.length).toBe(6);
  });
});
