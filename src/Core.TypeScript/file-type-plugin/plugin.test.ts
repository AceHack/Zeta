import { expect, test, describe } from "bun:test";
import { type FileTypePlugin, pluginToTagged, taggedToPlugin, zsetToTagged, taggedToZSet } from "./types";
import { jsonCodec, yamlCodec, markdownCodec } from "./codecs";
import { evaluateQuery } from "./query";
import { cstr, param, lambda, call, binary } from "../bonsai/bonsai";

describe("File Type Plugin System", () => {
  // Test JSON Codec
  test("JSON Codec round-trip", () => {
    const content = `{
  "id": 123,
  "title": "Build File-type Plugin model",
  "active": true
}`;
    const zset = jsonCodec.parse(content);
    expect(zset.length).toBe(3);

    // Check fields parsed
    const doc = jsonCodec.serialize(zset);
    const parsed = JSON.parse(doc);
    expect(parsed.id).toBe(123);
    expect(parsed.title).toBe("Build File-type Plugin model");
    expect(parsed.active).toBe(true);
  });

  // Test YAML Codec
  test("YAML Codec round-trip", () => {
    const content = `id: "081KTGES048"
priority: 2
title: file-type plugin model`;
    const zset = yamlCodec.parse(content);
    expect(zset.length).toBe(3);

    const doc = yamlCodec.serialize(zset);
    expect(doc).toContain(`"id": "081KTGES048"`);
    expect(doc).toContain(`"priority": 2`);
    expect(doc).toContain(`"title": "file-type plugin model"`);
  });

  // Test Markdown Treaty Codec
  test("Markdown frontmatter + body Treaty Codec round-trip", () => {
    const content = `---
"id": "081KTGES048"
"state": "backlog"
"title": "file-type plugin model"
---
This is the markdown description body of the file-type plugin model.
It contains multiple lines.`;

    const zset = markdownCodec.parse(content);
    expect(zset.length).toBe(4); // id, state, title, body

    const bodyEntry = zset.find(e => {
      if (e.e.t === "obj") {
        const k = e.e.v.find(([k]) => k === "k")?.[1];
        return k && k.t === "str" && k.v === "body";
      }
      return false;
    });
    expect(bodyEntry).toBeDefined();

    const doc = markdownCodec.serialize(zset);
    expect(doc.trim()).toBe(content.trim());

    // Also assert that parsing the serialized doc yields identical ZSet
    const zset2 = markdownCodec.parse(doc);
    expect(zset2.length).toBe(zset.length);
  });

  // Test Plugin DynamicValue Serialization/Deserialization
  test("Plugin serialization to/from Tagged", () => {
    const plugin: FileTypePlugin = {
      fileType: ".md",
      parserRef: "markdown-frontmatter",
      serializerRef: "markdown-frontmatter",
      views: [
        {
          name: "p1_tasks",
          query: call("filter", [
            param("zset"),
            lambda(
              ["entry"],
              binary(
                "and",
                binary("eq", call("get_field", [param("entry"), cstr("type")]), cstr("task")),
                binary("eq", call("get_field", [param("entry"), cstr("priority")]), cstr("P1"))
              )
            )
          ])
        }
      ]
    };

    const tagged = pluginToTagged(plugin);
    const roundTripped = taggedToPlugin(tagged);

    expect(roundTripped.fileType).toBe(plugin.fileType);
    expect(roundTripped.parserRef).toBe(plugin.parserRef);
    expect(roundTripped.serializerRef).toBe(plugin.serializerRef);
    expect(roundTripped.views.length).toBe(1);
    expect(roundTripped.views[0]!.name).toBe("p1_tasks");
    expect(JSON.stringify(roundTripped.views[0]!.query)).toBe(JSON.stringify(plugin.views[0]!.query));
  });

  // Test Bonsai Query Evaluation over ZSet
  test("Bonsai Query Evaluation - filter and get_zset_field", () => {
    const mdContent = `---
type: "task"
priority: "P1"
title: "Implement file-type plugins"
---
This is a P1 task workitem.`;

    const zset = markdownCodec.parse(mdContent);
    const taggedZSet = zsetToTagged(zset);

    // 1. Test get_zset_field
    const getFieldExpr = call("get_zset_field", [param("zset"), cstr("priority")]);
    const resPriority = evaluateQuery(getFieldExpr, { zset: taggedZSet });
    expect(resPriority).toEqual({ t: "str", v: "P1" });

    // 2. Test boolean checks on fields
    const isP1TaskExpr = binary(
      "and",
      binary("eq", call("get_zset_field", [param("zset"), cstr("type")]), cstr("task")),
      binary("eq", call("get_zset_field", [param("zset"), cstr("priority")]), cstr("P1"))
    );
    const resCheck = evaluateQuery(isP1TaskExpr, { zset: taggedZSet });
    expect(resCheck).toEqual({ t: "bool", v: true });

    // 3. Test filter operation
    const filterExpr = call("filter", [
      param("zset"),
      lambda(
        ["entry"],
        binary("eq", call("get_field", [param("entry"), cstr("type")]), cstr("task"))
      )
    ]);
    const resFilteredZSet = evaluateQuery(filterExpr, { zset: taggedZSet });
    const parsedFilteredZSet = taggedToZSet(resFilteredZSet);

    expect(parsedFilteredZSet.length).toBe(1);
    const item = parsedFilteredZSet[0]!.e;
    expect(item.t).toBe("obj");
    if (item.t === "obj") {
      const k = item.v.find(([k]) => k === "k")?.[1];
      const v = item.v.find(([k]) => k === "v")?.[1];
      expect(k).toEqual({ t: "str", v: "type" });
      expect(v).toEqual({ t: "str", v: "task" });
    }
  });
});
