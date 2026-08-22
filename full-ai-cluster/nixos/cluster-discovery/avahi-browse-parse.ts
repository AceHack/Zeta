/**
 * full-ai-cluster/nixos/cluster-discovery/avahi-browse-parse.ts
 *
 * Parse `avahi-browse --parsable --resolve` output into advertisements.
 *
 * Pure: a string in, values out. The transport is somewhere else, so the ugly
 * half -- escaping, duplicate answers on two interfaces, a record on our
 * service type that is not one of ours -- is testable from a fixture.
 *
 * THE LINE FORMAT (avahi-browse(1), `-p`):
 *
 *   =;<iface>;<proto>;<name>;<type>;<domain>;<host>;<address>;<port>;<txt>
 *
 * Only `=` lines carry a resolution; `+` lines announce a name and carry no
 * address, so they are counted and then ignored. Within a field avahi escapes
 * `;` and `\`, which is why this splits on unescaped separators rather than on
 * `String.split(";")`.
 */

import {
  validateAdvertisement,
  ZETA_CLUSTER_SERVICE_TYPE,
  type MalformedAdvertisement,
  type ZetaClusterAdvertisement,
} from "./advertisement";

/** What one parse of one browse pass yielded. */
export interface BrowseParseResult {
  readonly advertisements: readonly ZetaClusterAdvertisement[];
  readonly malformed: readonly MalformedAdvertisement[];
  /** `=` lines seen on our service type, before validation. */
  readonly resolvedLines: number;
}

/** Split on unescaped `;`, unescaping `\;` and `\\\\` as it goes. */
export function splitAvahiFields(line: string): readonly string[] {
  const fields: string[] = [];
  let current = "";
  let index = 0;
  while (index !== line.length) {
    const ch = line[index] ?? "";
    if (ch === "\\") {
      const next = line[index + 1] ?? "";
      if (next === "") {
        current += ch;
        index += 1;
        continue;
      }
      current += next;
      index += 2;
      continue;
    }
    if (ch === ";") {
      fields.push(current);
      current = "";
      index += 1;
      continue;
    }
    current += ch;
    index += 1;
  }
  fields.push(current);
  return fields;
}

/**
 * Parse the TXT field: space-separated, double-quoted `key=value` items.
 *
 * A repeated key keeps the FIRST occurrence, per RFC 6763 section 6.4, which
 * says a client should ignore all but the first of a duplicated key rather
 * than pick.
 */
export function parseTxtField(txtField: string): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  const items = txtField.match(/"(?:[^"\\]|\\.)*"/g) ?? [];
  for (const item of items) {
    const inner = item.slice(1, item.length - 1).replace(/\\(.)/g, "$1");
    const eq = inner.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = inner.slice(0, eq);
    const value = inner.slice(eq + 1);
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      continue;
    }
    out[key] = value;
  }
  return out;
}

/** Stable identity for de-duplicating the same service seen on two interfaces. */
function advertisementKey(a: ZetaClusterAdvertisement): string {
  return [a.clusterId, a.nodeName, a.hostname, a.address, String(a.port)].join("|");
}

/**
 * Parse one browse pass.
 *
 * Records on other service types are not an error and are not counted -- the
 * caller may have browsed with a filter or without one. Records on OUR type
 * that do not validate ARE counted, as malformed: something claiming to be a
 * Zeta control plane and failing to say so correctly is exactly the case that
 * must reach a human rather than be filtered away.
 */
export function parseBrowseOutput(stdout: string): BrowseParseResult {
  const advertisements: ZetaClusterAdvertisement[] = [];
  const malformed: MalformedAdvertisement[] = [];
  const seen = new Set<string>();
  let resolvedLines = 0;

  for (const rawLine of stdout.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }
    if (!line.startsWith("=;")) {
      continue;
    }
    const fields = splitAvahiFields(line);
    if (fields.length <= 9) {
      malformed.push({
        source: line.slice(0, 60),
        problem: `resolved line has ${String(fields.length)} fields, expected at least 10`,
      });
      continue;
    }
    const serviceType = fields[4] ?? "";
    if (serviceType !== ZETA_CLUSTER_SERVICE_TYPE) {
      continue;
    }
    resolvedLines += 1;
    const name = fields[3] ?? "";
    const iface = fields[1] ?? "";
    const source = `${name} on ${iface}`;
    const portRaw = fields[8] ?? "";
    if (!/^[0-9]+$/.test(portRaw)) {
      malformed.push({ source, problem: `SRV port field is not numeric: ${JSON.stringify(portRaw)}` });
      continue;
    }

    const validated = validateAdvertisement({
      txt: parseTxtField(fields.slice(9).join(";")),
      hostname: fields[6] ?? "",
      address: fields[7] ?? "",
      port: Number(portRaw),
    });
    if (!validated.ok) {
      malformed.push({ source, problem: validated.problem });
      continue;
    }
    const key = advertisementKey(validated.value);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    advertisements.push(validated.value);
  }

  return { advertisements, malformed, resolvedLines };
}
