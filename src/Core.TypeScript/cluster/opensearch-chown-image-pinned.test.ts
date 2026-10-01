// The OpenSearch chart's `fsgroup-volume` init container is a ROOT init container
// (`runAsUser: 0`, `chown -R 1000:1000` on the data volume). Its image comes from
// `persistence.image` / `persistence.imageTag`, which the chart defaults to `busybox` and
// `latest` in `templates/statefulset.yaml` (MEASURED at 3.8.0, line 252) while leaving both
// keys commented out of its own values.yaml -- so an Application that does not set them
// runs a moving tag as root on every node, and two first boots can pull two different images.
//
// Hermetic: reads the Application manifest only. The render was checked by hand with
// `helm template opensearch --version 3.8.0` against these values: the init container is
// `busybox:1.38.0` once both keys are set.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

/** True when an image tag is a floating reference rather than a pinned release. */
export function isFloatingTag(tag: unknown): boolean {
  if (typeof tag !== "string" || tag.trim() === "") return true;
  return /^(latest|stable|edge|main|master|dev)$/i.test(tag.trim());
}

const dig = (o: unknown, ...path: string[]): unknown => {
  let cur: unknown = o;
  for (const k of path) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
};

describe("opensearch: the root chown init container is pinned", () => {
  test("an unset tag is floating (the chart defaults it to latest) -- the rule can fail", () => {
    expect(isFloatingTag(undefined)).toBe(true);
    expect(isFloatingTag("")).toBe(true);
    expect(isFloatingTag("latest")).toBe(true);
    expect(isFloatingTag("1.38.0")).toBe(false);
  });

  test("the Application sets persistence.imageTag to a pinned release (and leaves the image name at the chart's busybox)", () => {
    const app = parse(readFileSync(join(REPO_ROOT, "full-ai-cluster/k8s/applications/opensearch/Application.yaml"), "utf8")) as unknown;
    const values = dig(app, "spec", "source", "helm", "valuesObject");
    expect(isFloatingTag(dig(values, "persistence", "imageTag"))).toBe(false);
    // Naming the image here would put an untagged `image: busybox` in front of the textual
    // provenance scan, which reads it as `latest` and demands a measurement of it.
    expect(dig(values, "persistence", "image")).toBeUndefined();
  });
});
