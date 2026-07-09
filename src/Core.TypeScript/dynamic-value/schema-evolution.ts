import { type Tagged } from "./types";

export interface Migration {
  from: number;
  to: number;
  up: (v: Tagged) => Tagged;
  down?: (v: Tagged) => Tagged;
}

export const dumpKey = "__evo_dump__";

export function addField(key: string, def: Tagged, v: Tagged): Tagged {
  if (v.t === "obj") {
    if (v.v.some(([k]) => k === key)) {
      return v;
    }
    return { t: "obj", v: [...v.v, [key, def]] };
  }
  return v;
}

export function removeField(key: string, v: Tagged): Tagged {
  if (v.t === "obj") {
    return { t: "obj", v: v.v.filter(([k]) => k !== key) };
  }
  return v;
}

export function renameField(oldKey: string, newKey: string, v: Tagged): Tagged {
  if (v.t === "obj") {
    return { t: "obj", v: v.v.map(([k, val]) => (k === oldKey ? [newKey, val] : [k, val])) };
  }
  return v;
}

export function project(knownKeys: Set<string>, v: Tagged): Tagged {
  if (v.t === "obj") {
    return { t: "obj", v: v.v.filter(([k]) => knownKeys.has(k)) };
  }
  return v;
}

export function addFieldMigration(fromV: number, key: string, def: Tagged): Migration {
  return {
    from: fromV,
    to: fromV + 1,
    up: (v) => addField(key, def, v),
    down: (v) => removeField(key, v),
  };
}

export function renameFieldMigration(fromV: number, oldKey: string, newKey: string): Migration {
  return {
    from: fromV,
    to: fromV + 1,
    up: (v) => renameField(oldKey, newKey, v),
    down: (v) => renameField(newKey, oldKey, v),
  };
}

export function removeFieldMigration(fromV: number, key: string, downDefault: Tagged): Migration {
  return {
    from: fromV,
    to: fromV + 1,
    up: (v) => removeField(key, v),
    down: (v) => addField(key, downDefault, v),
  };
}

function dumpEntry(idx: number, value: Tagged): Tagged {
  return {
    t: "obj",
    v: [
      ["idx", { t: "int", v: idx.toString() }],
      ["val", value],
    ],
  };
}

function splitDump(kvs: [string, Tagged][]): { nonDump: [string, Tagged][]; dump: [string, Tagged][] } {
  const nonDump = kvs.filter(([k]) => k !== dumpKey);
  const dumpPair = kvs.find(([k]) => k === dumpKey);
  let dump: [string, Tagged][] = [];
  if (dumpPair && dumpPair[1].t === "obj") {
    dump = dumpPair[1].v;
  }
  return { nonDump, dump };
}

export function stashToDump(key: string, v: Tagged): Tagged {
  if (v.t === "obj") {
    const { nonDump, dump } = splitDump(v.v);
    const idx = nonDump.findIndex(([k]) => k === key);
    if (idx === -1) {
      return v;
    }
    const pair = nonDump[idx];
    if (!pair) {
      return v;
    }
    const removed = pair[1];
    const newNonDump = nonDump.filter(([k]) => k !== key);
    const newDump = [...dump.filter(([k]) => k !== key), [key, dumpEntry(idx, removed)] as [string, Tagged]];
    return {
      t: "obj",
      v: [...newNonDump, [dumpKey, { t: "obj", v: newDump }]],
    };
  }
  return v;
}

export function restoreFromDump(key: string, v: Tagged): Tagged {
  if (v.t === "obj") {
    const { nonDump, dump } = splitDump(v.v);
    const entryPair = dump.find(([k]) => k === key);
    if (entryPair && entryPair[1].t === "obj") {
      const entry = entryPair[1].v;
      const idxPair = entry.find(([k]) => k === "idx");
      const idx = idxPair && idxPair[1].t === "int" ? parseInt(idxPair[1].v, 10) : nonDump.length;
      const valPair = entry.find(([k]) => k === "val");
      const value = valPair ? valPair[1] : { t: "null" };

      const clamped = Math.max(0, Math.min(idx, nonDump.length));
      const restored = [...nonDump.slice(0, clamped), [key, value] as [string, Tagged], ...nonDump.slice(clamped)];
      const remaining = dump.filter(([k]) => k !== key);

      if (remaining.length === 0) {
        return { t: "obj", v: restored };
      } else {
        return {
          t: "obj",
          v: [...restored, [dumpKey, { t: "obj", v: remaining }]],
        };
      }
    }
    return v;
  }
  return v;
}

export function dropDump(v: Tagged): Tagged {
  return removeField(dumpKey, v);
}

export function removeFieldWithDumpMigration(fromV: number, key: string): Migration {
  return {
    from: fromV,
    to: fromV + 1,
    up: (v) => stashToDump(key, v),
    down: (v) => restoreFromDump(key, v),
  };
}

export function migrate(
  migrations: Migration[],
  fromV: number,
  toV: number,
  value: Tagged,
): { ok: true; value: Tagged } | { ok: false; error: string } {
  if (toV < fromV) {
    return { ok: false, error: `downgrade ${fromV} -> ${toV} not supported by migrate; use migrateDown` };
  }
  let cur = fromV;
  let v = value;
  while (cur < toV) {
    const m = migrations.find((mig) => mig.from === cur && mig.to === cur + 1);
    if (!m) {
      return { ok: false, error: `no migration registered from version ${cur} to ${cur + 1}` };
    }
    v = m.up(v);
    cur++;
  }
  return { ok: true, value: v };
}

export function migrateDown(
  migrations: Migration[],
  fromV: number,
  toV: number,
  value: Tagged,
): { ok: true; value: Tagged } | { ok: false; error: string } {
  if (toV > fromV) {
    return { ok: false, error: `migrateDown requires toV <= fromV, got ${fromV} -> ${toV}` };
  }
  let cur = fromV;
  let v = value;
  while (cur > toV) {
    const m = migrations.find((mig) => mig.to === cur && mig.from === cur - 1);
    if (!m) {
      return { ok: false, error: `no migration registered from version ${cur - 1} to ${cur}` };
    }
    if (!m.down) {
      return {
        ok: false,
        error: `migration ${m.from} -> ${m.to} is non-invertible (rollback needs compensation, not an inverse)`,
      };
    }
    v = m.down(v);
    cur--;
  }
  return { ok: true, value: v };
}
