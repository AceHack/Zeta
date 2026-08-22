import { type ZSet } from "../z-set/z-set";
import { type Tagged } from "../dynamic-value/types";
import { compareTagged } from "./types";
import { fromYamlValue, canonicalYaml } from "../dynamic-value/yaml";
import { parse as parseYaml } from "../yaml/dom";
import { stringCompare } from "../collation/collation";

// ─── Helpers for converting between arbitrary JS values and Tagged ───────────

export function jsToTagged(val: any): Tagged {
  if (val === null || val === undefined) return { t: "null" };
  if (typeof val === "boolean") return { t: "bool", v: val };
  if (typeof val === "number") {
    if (Number.isInteger(val)) return { t: "int", v: val.toString() };
    return { t: "float", v: val.toString() };
  }
  if (typeof val === "string") return { t: "str", v: val };
  if (Array.isArray(val)) return { t: "arr", v: val.map(jsToTagged) };
  if (typeof val === "object") {
    const entries: [string, Tagged][] = Object.entries(val).map(([k, v]) => [k, jsToTagged(v)]);
    return { t: "obj", v: entries };
  }
  return { t: "null" };
}

export function taggedToJs(tagged: Tagged): any {
  switch (tagged.t) {
    case "null":
      return null;
    case "bool":
      return tagged.v;
    case "int":
      return parseInt(tagged.v, 10);
    case "float":
      return parseFloat(tagged.v);
    case "str":
      return tagged.v;
    case "bytes":
      return tagged.v;
    case "arr":
      return tagged.v.map(taggedToJs);
    case "obj": {
      const obj: any = {};
      for (const [k, v] of tagged.v) {
        obj[k] = taggedToJs(v);
      }
      return obj;
    }
  }
}

// ─── Helper: Document <-> ZSet mapping ───────────────────────────────────────

import { ofEntries } from "../z-set/z-set";

export function documentToZSet(doc: Tagged): ZSet<Tagged> {
  const entries: { e: Tagged; w: number }[] = [];
  if (doc.t === "obj") {
    for (const [k, v] of doc.v) {
      entries.push({
        e: {
          t: "obj",
          v: [
            ["k", { t: "str", v: k }],
            ["v", v]
          ]
        },
        w: 1
      });
    }
  } else {
    entries.push({
      e: {
        t: "obj",
        v: [
          ["k", { t: "str", v: "content" }],
          ["v", doc]
        ]
      },
      w: 1
    });
  }
  return ofEntries(compareTagged, entries);
}

export function zsetToDocument(zset: ZSet<Tagged>): Tagged {
  const fields: [string, Tagged][] = [];
  for (const entry of zset) {
    if (entry.e.t === "obj") {
      const kVal = entry.e.v.find(([k]) => k === "k")?.[1];
      const vVal = entry.e.v.find(([k]) => k === "v")?.[1];
      if (kVal && kVal.t === "str" && vVal) {
        fields.push([kVal.v, vVal]);
      }
    }
  }
  fields.sort((a, b) => stringCompare(a[0], b[0]));
  return { t: "obj", v: fields };
}

// ─── Yaml utilities ──────────────────────────────────────────────────────────

export function parseYamlToTagged(yaml: string): Tagged {
  const parsed = parseYaml(yaml);
  if (!parsed.ok) throw new Error("Malformed YAML");
  const dec = fromYamlValue(parsed.value, 0);
  if (!dec.ok) throw new Error("Decode YAML failed");
  return dec.value;
}

export function serializeYaml(tagged: Tagged): string {
  const enc = canonicalYaml(tagged);
  if (!enc.ok) throw new Error("Encode YAML failed");
  return enc.value;
}

// ─── Built-in Codecs ─────────────────────────────────────────────────────────

export interface Codec {
  parse(content: string): ZSet<Tagged>;
  serialize(zset: ZSet<Tagged>): string;
}

export const jsonCodec: Codec = {
  parse(content: string): ZSet<Tagged> {
    if (!content.trim()) return [];
    const js = JSON.parse(content);
    return documentToZSet(jsToTagged(js));
  },
  serialize(zset: ZSet<Tagged>): string {
    const doc = zsetToDocument(zset);
    const js = taggedToJs(doc);
    return JSON.stringify(js, null, 2);
  }
};

export const yamlCodec: Codec = {
  parse(content: string): ZSet<Tagged> {
    if (!content.trim()) return [];
    const tagged = parseYamlToTagged(content);
    return documentToZSet(tagged);
  },
  serialize(zset: ZSet<Tagged>): string {
    const doc = zsetToDocument(zset);
    return serializeYaml(doc);
  }
};

export const markdownCodec: Codec = {
  parse(content: string): ZSet<Tagged> {
    let metadata: Tagged = { t: "obj", v: [] };
    let body = content;

    if (content.startsWith("---")) {
      const secondDivider = content.indexOf("---", 3);
      if (secondDivider !== -1) {
        const frontmatter = content.substring(3, secondDivider).trim();
        body = content.substring(secondDivider + 3);
        if (body.startsWith("\r\n")) body = body.substring(2);
        else if (body.startsWith("\n")) body = body.substring(1);

        try {
          metadata = parseYamlToTagged(frontmatter);
        } catch {
          body = content;
        }
      }
    }

    const entries: { e: Tagged; w: number }[] = [];
    if (metadata.t === "obj") {
      for (const [k, v] of metadata.v) {
        entries.push({
          e: {
            t: "obj",
            v: [
              ["k", { t: "str", v: k }],
              ["v", v]
            ]
          },
          w: 1
        });
      }
    }
    entries.push({
      e: {
        t: "obj",
        v: [
          ["k", { t: "str", v: "body" }],
          ["v", { t: "str", v: body }]
        ]
      },
      w: 1
    });

    return ofEntries(compareTagged, entries);
  },
  serialize(zset: ZSet<Tagged>): string {
    const fields: [string, Tagged][] = [];
    let body = "";

    for (const entry of zset) {
      if (entry.e.t === "obj") {
        const kVal = entry.e.v.find(([k]) => k === "k")?.[1];
        const vVal = entry.e.v.find(([k]) => k === "v")?.[1];
        if (kVal && kVal.t === "str" && vVal) {
          if (kVal.v === "body" && vVal.t === "str") {
            body = vVal.v;
          } else {
            fields.push([kVal.v, vVal]);
          }
        }
      }
    }

    if (fields.length === 0) {
      return body;
    }

    fields.sort((a, b) => stringCompare(a[0], b[0]));
    const metadataObj: Tagged = { t: "obj", v: fields };
    const frontmatter = serializeYaml(metadataObj);
    return `---\n${frontmatter}---\n${body}`;
  }
};

export const npmCodec: Codec = {
  parse(content: string): ZSet<Tagged> {
    if (!content.trim()) return [];
    const js = JSON.parse(content);
    const entries: { e: Tagged; w: number }[] = [];
    if (js.name) {
      entries.push({ e: { t: "obj", v: [["k", { t: "str", v: "name" }], ["v", { t: "str", v: js.name }]] }, w: 1 });
    }
    if (js.version) {
      entries.push({ e: { t: "obj", v: [["k", { t: "str", v: "version" }], ["v", { t: "str", v: js.version }]] }, w: 1 });
    }
    if (js.dependencies) {
      for (const [name, ver] of Object.entries(js.dependencies)) {
        entries.push({
          e: { t: "obj", v: [["k", { t: "str", v: "npm:" + name }], ["v", { t: "str", v: String(ver) }]] },
          w: 1
        });
      }
    }
    if (js.devDependencies) {
      for (const [name, ver] of Object.entries(js.devDependencies)) {
        entries.push({
          e: { t: "obj", v: [["k", { t: "str", v: "npm-dev:" + name }], ["v", { t: "str", v: String(ver) }]] },
          w: 1
        });
      }
    }
    return ofEntries(compareTagged, entries);
  },
  serialize(zset: ZSet<Tagged>): string {
    const js: any = {};
    const deps: any = {};
    const devDeps: any = {};
    for (const entry of zset) {
      if (entry.e.t === "obj") {
        const kVal = entry.e.v.find(([k]) => k === "k")?.[1];
        const vVal = entry.e.v.find(([k]) => k === "v")?.[1];
        if (kVal && kVal.t === "str" && vVal && vVal.t === "str") {
          if (kVal.v === "name") {
            js.name = vVal.v;
          } else if (kVal.v === "version") {
            js.version = vVal.v;
          } else if (kVal.v.startsWith("npm:")) {
            deps[kVal.v.substring(4)] = vVal.v;
          } else if (kVal.v.startsWith("npm-dev:")) {
            devDeps[kVal.v.substring(8)] = vVal.v;
          }
        }
      }
    }
    if (Object.keys(deps).length > 0) {
      const sortedDeps: any = {};
      for (const k of Object.keys(deps).sort()) sortedDeps[k] = deps[k];
      js.dependencies = sortedDeps;
    }
    if (Object.keys(devDeps).length > 0) {
      const sortedDevDeps: any = {};
      for (const k of Object.keys(devDeps).sort()) sortedDevDeps[k] = devDeps[k];
      js.devDependencies = sortedDevDeps;
    }
    return JSON.stringify(js, null, 2);
  }
};

export const cargoCodec: Codec = {
  parse(content: string): ZSet<Tagged> {
    const lines = content.split(/\r?\n/);
    const entries: { e: Tagged; w: number }[] = [];
    let section = "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        section = trimmed.substring(1, trimmed.length - 1).trim();
        continue;
      }
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx).trim().replace(/^"|"$|^'|'$/g, "");
        const val = trimmed.substring(eqIdx + 1).trim().replace(/^"|"$|^'|'$/g, "");
        if (section === "package") {
          if (key === "name" || key === "version") {
            entries.push({ e: { t: "obj", v: [["k", { t: "str", v: key }], ["v", { t: "str", v: val }]] }, w: 1 });
          }
        } else if (section === "dependencies") {
          entries.push({
            e: { t: "obj", v: [["k", { t: "str", v: "cargo:" + key }], ["v", { t: "str", v: val }]] },
            w: 1
          });
        }
      }
    }
    return ofEntries(compareTagged, entries);
  },
  serialize(zset: ZSet<Tagged>): string {
    let name = "";
    let version = "";
    const deps: [string, string][] = [];
    for (const entry of zset) {
      if (entry.e.t === "obj") {
        const kVal = entry.e.v.find(([k]) => k === "k")?.[1];
        const vVal = entry.e.v.find(([k]) => k === "v")?.[1];
        if (kVal && kVal.t === "str" && vVal && vVal.t === "str") {
          if (kVal.v === "name") {
            name = vVal.v;
          } else if (kVal.v === "version") {
            version = vVal.v;
          } else if (kVal.v.startsWith("cargo:")) {
            deps.push([kVal.v.substring(6), vVal.v]);
          }
        }
      }
    }
    let out = "";
    if (name || version) {
      out += "[package]\n";
      if (name) out += `name = "${name}"\n`;
      if (version) out += `version = "${version}"\n`;
      out += "\n";
    }
    if (deps.length > 0) {
      out += "[dependencies]\n";
      deps.sort((a, b) => stringCompare(a[0], b[0]));
      for (const [k, v] of deps) {
        out += `${k} = "${v}"\n`;
      }
    }
    return out;
  }
};

// ─── Codec Registry ──────────────────────────────────────────────────────────

export class CodecRegistry {
  private static codecs = new Map<string, Codec>([
    ["json", jsonCodec],
    ["yaml", yamlCodec],
    ["markdown-frontmatter", markdownCodec],
    ["npm", npmCodec],
    ["cargo", cargoCodec]
  ]);

  static register(name: string, codec: Codec): void {
    this.codecs.set(name, codec);
  }

  static get(name: string): Codec | undefined {
    return this.codecs.get(name);
  }
}

