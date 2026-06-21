export interface SetupManifestEntry {
  readonly line: number;
  readonly spec: string;
  readonly attrs: Readonly<Record<string, string>>;
}

/** Multi-token manifest row (mechanism manifests: dest + url, name + deb-url, etc.). */
export interface MechanismManifestEntry {
  readonly line: number;
  readonly tokens: ReadonlyArray<string>;
  readonly attrs: Readonly<Record<string, string>>;
}

/** Time-crystal update policy for a dependency (Ace re-solve rules). */
export type SetupDepUpdatePolicy =
  | "pinned"
  | "pinned-url"
  | "distro-default"
  | "self-updating"
  | "track-head"
  | "when-drift-bump-pin";

export interface PackageManagerPointerDependency {
  readonly ecosystem: string;
  readonly spec: string;
  readonly role?: string;
  readonly lang?: string;
  /** Ace time-crystal update loop policy for this dep. */
  readonly update?: SetupDepUpdatePolicy;
  /** Host/platform filter (e.g. ubuntu-22.04,amd64). */
  readonly when?: string;
}

export interface PackageManagerPointer {
  readonly schema: "zeta.ace.package-manager-pointers.v1";
  readonly purpose: string;
  readonly realizer: string;
  readonly manifest: string;
  readonly opt_in?: ReadonlyArray<string>;
  readonly dependencies: ReadonlyArray<PackageManagerPointerDependency>;
}

function stripManifestComment(line: string): string {
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== "#") continue;
    if (i === 0 || /\s/.test(line[i - 1]!)) {
      return line.slice(0, i);
    }
  }
  return line;
}

function parseAttrFields(fields: readonly string[]): {
  readonly tokens: string[];
  readonly attrs: Record<string, string>;
} {
  const tokens: string[] = [];
  const attrs: Record<string, string> = {};
  for (const field of fields) {
    const equals = field.indexOf("=");
    if (equals > 0) {
      attrs[field.slice(0, equals)] = field.slice(equals + 1);
    } else {
      tokens.push(field);
    }
  }
  return { tokens, attrs };
}

export function parseSetupManifest(text: string): SetupManifestEntry[] {
  const entries: SetupManifestEntry[] = [];
  const lines = text.split(/\r?\n/);
  for (const [index, rawLine] of lines.entries()) {
    const line = stripManifestComment(rawLine).trim();
    if (line.length === 0) continue;

    const fields = line.split(/\s+/);
    const spec = fields[0]!;
    const attrs: Record<string, string> = {};
    for (const field of fields.slice(1)) {
      const equals = field.indexOf("=");
      if (equals <= 0) continue;
      attrs[field.slice(0, equals)] = field.slice(equals + 1);
    }
    entries.push({ line: index + 1, spec, attrs });
  }
  return entries;
}

/** Parse mechanism manifests: all non-attr tokens preserved, key=value → attrs. */
export function parseMechanismManifest(text: string): MechanismManifestEntry[] {
  const entries: MechanismManifestEntry[] = [];
  const lines = text.split(/\r?\n/);
  for (const [index, rawLine] of lines.entries()) {
    const line = stripManifestComment(rawLine).trim();
    if (line.length === 0) continue;
    const { tokens, attrs } = parseAttrFields(line.split(/\s+/));
    if (tokens.length === 0) continue;
    entries.push({ line: index + 1, tokens, attrs });
  }
  return entries;
}

export function pointerFromSetupManifest(args: {
  readonly text: string;
  readonly ecosystem: string;
  readonly purpose: string;
  readonly realizer: string;
  readonly manifest: string;
  readonly optIn?: ReadonlyArray<string>;
  readonly defaultUpdate?: SetupDepUpdatePolicy;
}): PackageManagerPointer {
  const pointer: PackageManagerPointer = {
    schema: "zeta.ace.package-manager-pointers.v1",
    purpose: args.purpose,
    realizer: args.realizer,
    manifest: args.manifest,
    dependencies: parseSetupManifest(args.text).map((entry) => {
      const dep: PackageManagerPointerDependency = {
        ecosystem: entry.attrs.ecosystem !== undefined ? entry.attrs.ecosystem : args.ecosystem,
        spec: entry.spec,
        update:
          (entry.attrs.update as SetupDepUpdatePolicy | undefined) ??
          args.defaultUpdate ??
          "pinned",
      };
      return {
        ...dep,
        ...(entry.attrs.role !== undefined ? { role: entry.attrs.role } : {}),
        ...(entry.attrs.lang !== undefined ? { lang: entry.attrs.lang } : {}),
        ...(entry.attrs.when !== undefined ? { when: entry.attrs.when } : {}),
      };
    }),
  };

  if (args.optIn !== undefined) {
    return { ...pointer, opt_in: args.optIn };
  }
  return pointer;
}

/** Build an Ace pointer from a source/mechanism manifest (from-url, from-deb, …). */
export function pointerFromMechanismManifest(args: {
  readonly mechanism: string;
  readonly text: string;
  readonly purpose: string;
  readonly realizer: string;
  readonly manifest: string;
  readonly optIn?: ReadonlyArray<string>;
  readonly defaultUpdate?: SetupDepUpdatePolicy;
}): PackageManagerPointer {
  const pointer: PackageManagerPointer = {
    schema: "zeta.ace.package-manager-pointers.v1",
    purpose: args.purpose,
    realizer: args.realizer,
    manifest: args.manifest,
    dependencies: parseMechanismManifest(args.text).map((entry) => {
      const dep: PackageManagerPointerDependency = {
        ecosystem: entry.attrs.ecosystem ?? args.mechanism,
        spec: entry.tokens.join(" "),
        update:
          (entry.attrs.update as SetupDepUpdatePolicy | undefined) ??
          args.defaultUpdate ??
          defaultUpdateForMechanism(args.mechanism),
      };
      return {
        ...dep,
        ...(entry.attrs.role !== undefined ? { role: entry.attrs.role } : {}),
        ...(entry.attrs.lang !== undefined ? { lang: entry.attrs.lang } : {}),
        ...(entry.attrs.when !== undefined ? { when: entry.attrs.when } : {}),
      };
    }),
  };

  if (args.optIn !== undefined) {
    return { ...pointer, opt_in: args.optIn };
  }
  return pointer;
}

function defaultUpdateForMechanism(mechanism: string): SetupDepUpdatePolicy {
  switch (mechanism) {
    case "from-url":
      return "pinned-url";
    case "from-installer":
      return "self-updating";
    case "from-deb":
    case "from-shim":
      return "when-drift-bump-pin";
    default:
      return "pinned";
  }
}
