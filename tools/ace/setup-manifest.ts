export interface SetupManifestEntry {
  readonly line: number;
  readonly spec: string;
  readonly attrs: Readonly<Record<string, string>>;
}

export interface PackageManagerPointerDependency {
  readonly ecosystem: string;
  readonly spec: string;
  readonly role?: string;
  readonly lang?: string;
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

export function pointerFromSetupManifest(args: {
  readonly text: string;
  readonly ecosystem: string;
  readonly purpose: string;
  readonly realizer: string;
  readonly manifest: string;
  readonly optIn?: ReadonlyArray<string>;
}): PackageManagerPointer {
  const pointer: PackageManagerPointer = {
    schema: "zeta.ace.package-manager-pointers.v1",
    purpose: args.purpose,
    realizer: args.realizer,
    manifest: args.manifest,
    dependencies: parseSetupManifest(args.text).map((entry) => {
      const dep: PackageManagerPointerDependency = {
        ecosystem: args.ecosystem,
        spec: entry.spec,
      };
      return {
        ...dep,
        ...(entry.attrs.role !== undefined ? { role: entry.attrs.role } : {}),
        ...(entry.attrs.lang !== undefined ? { lang: entry.attrs.lang } : {}),
      };
    }),
  };

  if (args.optIn !== undefined) {
    return { ...pointer, opt_in: args.optIn };
  }
  return pointer;
}
