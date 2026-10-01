// Falsifier: every custom resource the `platform` Application ships is accepted by the CRD that
// the same Application ships.
//
// WHY THIS EXISTS. WP11 run 36858893664: Application `platform` sat at sync=OutOfSync forever
// because ArgoCD's server-side apply of Blueprints arma-reforger, gmod and unturned failed with
//   `.spec.sidecars[0].configMaps: field not declared in schema`.
// #17736 taught the controller (blueprint.ts `SidecarSpec.configMaps`) and the Blueprints
// (blueprints.yaml) a new sidecar field and never told the CRD, whose schema is STRUCTURAL: the API
// server rejects every field it does not name. Nothing in the tree compared the two files, so the
// first thing to notice was a 90-minute QEMU lane.
//
// WHAT THIS CHECKS, OFFLINE. For each CRD under `platform/crd-*.yaml` and each custom resource of
// that kind in the files the Application includes (`directory.include`): (1) no field the schema
// does not declare (honouring `x-kubernetes-preserve-unknown-fields` and `additionalProperties`),
// (2) every `required` key present, (3) object/array/string/integer/boolean shape. That is the
// structural half of what the API server enforces; it is not a replacement for a live apply, and
// says nothing about CEL rules or enum values beyond what is listed.

import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml, parseAllDocuments } from "yaml";

const PLATFORM = join(import.meta.dir, "..", "..", "..", "full-ai-cluster/k8s/applications/platform");

type Json = Record<string, unknown>;
interface Schema {
  type?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
  required?: string[];
  additionalProperties?: boolean | Schema;
  enum?: unknown[];
  "x-kubernetes-preserve-unknown-fields"?: boolean;
  "x-kubernetes-int-or-string"?: boolean;
}

const isRecord = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/** Structural violations of `value` against `schema`, as `path: message` strings. */
export function violations(schema: Schema, value: unknown, path: string): string[] {
  const out: string[] = [];
  if (schema["x-kubernetes-int-or-string"] === true) return out;
  switch (schema.type) {
    case "object": {
      if (!isRecord(value)) return [`${path}: expected object`];
      const declared = schema.properties ?? {};
      for (const key of schema.required ?? []) {
        if (!(key in value)) out.push(`${path}.${key}: required, absent`);
      }
      for (const [key, child] of Object.entries(value)) {
        const sub = declared[key];
        if (sub !== undefined) {
          out.push(...violations(sub, child, `${path}.${key}`));
        } else if (isRecord(schema.additionalProperties)) {
          out.push(...violations(schema.additionalProperties, child, `${path}.${key}`));
        } else if (schema.additionalProperties === true || schema["x-kubernetes-preserve-unknown-fields"] === true) {
          // allowed
        } else {
          out.push(`${path}.${key}: field not declared in schema`);
        }
      }
      return out;
    }
    case "array": {
      if (!Array.isArray(value)) return [`${path}: expected array`];
      if (schema.items !== undefined) value.forEach((item, i) => out.push(...violations(schema.items as Schema, item, `${path}[${i}]`)));
      return out;
    }
    case "string":
      return typeof value === "string" ? [] : [`${path}: expected string`];
    case "integer":
      return Number.isInteger(value) ? [] : [`${path}: expected integer`];
    case "boolean":
      return typeof value === "boolean" ? [] : [`${path}: expected boolean`];
    default:
      return out;
  }
}

function loadCrds(): Map<string, Schema> {
  const bySpec = new Map<string, Schema>();
  for (const file of readdirSync(PLATFORM).filter((f) => /^crd-.*\.yaml$/u.test(f))) {
    for (const doc of parseAllDocuments(readFileSync(join(PLATFORM, file), "utf8"))) {
      const crd = doc.toJS() as Json | null;
      if (crd?.["kind"] !== "CustomResourceDefinition") continue;
      const spec = crd["spec"] as Json;
      const group = String(spec["group"]);
      const kind = String((spec["names"] as Json)["kind"]);
      for (const version of spec["versions"] as Json[]) {
        const schema = (version["schema"] as Json)["openAPIV3Schema"] as Schema;
        bySpec.set(`${group}/${String(version["name"])}/${kind}`, schema);
      }
    }
  }
  return bySpec;
}

function includedFiles(): string[] {
  const app = parseYaml(readFileSync(join(PLATFORM, "Application.yaml"), "utf8")) as Json;
  const directory = dig(app, ["spec", "source", "directory"]);
  const include = isRecord(directory) ? String(directory["include"] ?? "") : "";
  // The glob is `{a,b,c}.yaml`: the suffix sits OUTSIDE the braces.
  const m = /^\{([^}]*)\}\.yaml$/u.exec(include);
  if (m === null) throw new Error(`platform Application include is not the {a,b}.yaml shape: ${include}`);
  return (m[1] ?? "").split(",").map((n) => `${n.trim()}.yaml`).filter((n) => n !== ".yaml");
}

function dig(root: unknown, path: readonly string[]): unknown {
  let cur: unknown = root;
  for (const key of path) {
    if (!isRecord(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

const CRDS = loadCrds();

function customResources(): { file: string; doc: Json }[] {
  const found: { file: string; doc: Json }[] = [];
  for (const file of includedFiles()) {
    for (const parsed of parseAllDocuments(readFileSync(join(PLATFORM, file), "utf8"))) {
      const doc = parsed.toJS() as Json | null;
      if (doc === null || typeof doc["apiVersion"] !== "string") continue;
      const key = `${String(doc["apiVersion"])}/${String(doc["kind"])}`.replace(/^([^/]+)\/([^/]+)\/(.+)$/u, "$1/$2/$3");
      if (CRDS.has(key)) found.push({ file, doc });
    }
  }
  return found;
}

describe("the checker itself is not vacuous", () => {
  const schema: Schema = {
    type: "object",
    required: ["name"],
    properties: { name: { type: "string" }, list: { type: "array", items: { type: "object", properties: { a: { type: "string" } } } } },
  };
  test("flags an undeclared field, deep inside an array item", () => {
    expect(violations(schema, { name: "x", list: [{ a: "1", b: "2" }] }, "$")).toEqual(["$.list[0].b: field not declared in schema"]);
  });
  test("flags a missing required key and a wrong type", () => {
    expect(violations(schema, { list: "no" }, "$").sort()).toEqual(["$.list: expected array", "$.name: required, absent"]);
  });
  test("honours preserve-unknown-fields", () => {
    expect(violations({ type: "object", "x-kubernetes-preserve-unknown-fields": true }, { anything: 1 }, "$")).toEqual([]);
  });
});

describe("every platform custom resource is accepted by the platform CRDs", () => {
  const resources = customResources();

  test("not vacuous: the Application ships Blueprints and a CRD for them", () => {
    const kinds = new Set(resources.map((r) => String(r.doc["kind"])));
    expect(kinds.has("Blueprint")).toBe(true);
    expect(CRDS.size).toBeGreaterThan(3);
  });

  for (const { file, doc } of customResources()) {
    const name = String((doc["metadata"] as Json)["name"]);
    test(`${String(doc["kind"])}/${name} (${file})`, () => {
      const schema = CRDS.get(`${String(doc["apiVersion"])}/${String(doc["kind"])}`);
      expect(schema).toBeDefined();
      // apiVersion/kind/metadata are the API server's own envelope, not part of the CRD's
      // openAPIV3Schema `properties`; the CRD describes `spec`.
      const specSchema = (schema as Schema).properties?.["spec"];
      expect(specSchema).toBeDefined();
      expect(violations(specSchema as Schema, doc["spec"], "$.spec")).toEqual([]);
    });
  }

  test("the three sftp-bearing Blueprints declare sidecar configMaps, and the schema accepts them", () => {
    const withConfigMaps = resources.filter(
      (r) => r.doc["kind"] === "Blueprint" && JSON.stringify(r.doc).includes('"configMaps"'),
    );
    expect(withConfigMaps.map((r) => String((r.doc["metadata"] as Json)["name"])).sort()).toEqual(["arma-reforger", "gmod", "unturned"]);
  });
});
