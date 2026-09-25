// k3s-datastore-bootstrap-recovery.test.ts
//
// 081M39CR74D087G0R002BEG2G4. EXECUTES
// `full-ai-cluster/nixos/modules/k3s-datastore-bootstrap-recovery.sh` and its
// sibling `k3s-datastore-bootstrap-sentinel-write.sh` over fixture
// directories with every external dependency (restart count, journal
// content, the restart command, the readyz check) injected via environment
// variable -- same discipline as `k3s-agent-tls-self-heal.test.ts` and
// `lint-k3s-datastore-preflight.test.ts`.
//
// THE PROPERTY THAT MATTERS MOST, BY FAR: a datastore that has EVER served
// (sentinel present) is NEVER removed by the recovery script, regardless of
// restart count or how many times k3s repeats the stillborn-shaped fatal.
// k3s's own error text is ambiguous by construction between "never
// bootstrapped" and "wrong token against a real cluster" -- only the
// sentinel tells them apart, and the has-served suite below is the
// falsifier for that guard failing.

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { join as posixJoin } from "node:path/posix";

/** Read a file that may not exist yet, treating ENOENT as "no restart happened" -- one syscall, no existsSync-then-readFileSync race. */
function readIfPresent(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw e;
  }
}

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const RECOVERY_SCRIPT = join(REPO_ROOT, "full-ai-cluster/nixos/modules/k3s-datastore-bootstrap-recovery.sh");
const SENTINEL_SCRIPT = join(REPO_ROOT, "full-ai-cluster/nixos/modules/k3s-datastore-bootstrap-sentinel-write.sh");
const MODULE = join(REPO_ROOT, "full-ai-cluster/nixos/modules/k3s-datastore-bootstrap-recovery.nix");
const SERVER_MODULE = join(REPO_ROOT, "full-ai-cluster/nixos/modules/k3s-server.nix");

const FATAL_SIGNATURE = "no bootstrap data found in datastore";

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "zeta-datastore-recovery-")).replace(/\\/g, "/");
}

interface Fixture {
  readonly root: string;
  readonly datastoreDir: string;
  readonly sentinelFile: string;
  readonly recoveryAttemptedFile: string;
  readonly journalFile: string;
  readonly markerFile: string;
}

/** A fresh datastore-shaped fixture, with a real-looking file inside it and a fatal-shaped journal. */
function fixture(opts: { readonly served: boolean; readonly fatalPresent: boolean }): Fixture {
  const root = tempRoot();
  const datastoreDir = posixJoin(root, "server/db");
  mkdirSync(posixJoin(datastoreDir, "etcd"), { recursive: true });
  const markerFile = posixJoin(datastoreDir, "etcd", "member-marker");
  writeFileSync(markerFile, "real cluster data, do not touch\n");
  const sentinelFile = posixJoin(datastoreDir, ".zeta-datastore-has-served");
  if (opts.served) writeFileSync(sentinelFile, "2026-01-01T00:00:00Z\n");
  const journalFile = posixJoin(root, "journal.log");
  writeFileSync(
    journalFile,
    opts.fatalPresent
      ? `level=fatal msg="Error: preparing server: failed to bootstrap cluster data: failed to reconcile with local datastore: ${FATAL_SIGNATURE} - check server token value and verify datastore integrity"\n`
      : `level=info msg="some other crash, unrelated to bootstrap data"\n`,
  );
  return {
    root,
    datastoreDir,
    sentinelFile,
    recoveryAttemptedFile: posixJoin(root, "server", ".zeta-stillborn-recovery-attempted"),
    journalFile,
    markerFile,
  };
}

interface RunOpts {
  readonly f: Fixture;
  readonly nrestarts: number;
  readonly threshold?: number;
}

function runRecovery(opts: RunOpts): { readonly status: number; readonly stdout: string; readonly restartLog: string } {
  const restartLogFile = posixJoin(opts.f.root, "restart-calls.log");
  const result = spawnSync("bash", [RECOVERY_SCRIPT], {
    env: {
      PATH: process.env.PATH ?? "/usr/bin:/bin",
      LC_ALL: "C",
      ZETA_SENTINEL_FILE: opts.f.sentinelFile,
      ZETA_DATASTORE_DIR: opts.f.datastoreDir,
      ZETA_RECOVERY_ATTEMPTED_FILE: opts.f.recoveryAttemptedFile,
      ZETA_K3S_NRESTARTS_CMD: `echo ${String(opts.nrestarts)}`,
      ZETA_K3S_JOURNAL_CMD: `cat ${opts.f.journalFile}`,
      // Records that a restart WOULD have happened, without touching any real systemd.
      ZETA_K3S_RESTART_CMD: `echo restarted >> ${restartLogFile}`,
      ZETA_RESTART_THRESHOLD: String(opts.threshold ?? 6),
      ZETA_SERIAL_DEVICE: posixJoin(opts.f.root, "no-such-serial-device"),
      // Per-fixture, so the once-per-boot verdict latch does not leak between
      // tests. On a real node this lives on /run (tmpfs), which is empty again
      // at every boot -- a fresh fixture root is that boot's analogue.
      ZETA_VERDICT_STATE_FILE: posixJoin(opts.f.root, "verdict-state"),
    },
    encoding: "utf8",
    maxBuffer: 64 * 1024,
  });
  const restartLog = readIfPresent(restartLogFile);
  return { status: result.status ?? -1, stdout: `${result.stdout}${result.stderr}`, restartLog };
}

describe("the has-served case -- NEVER removed, under any circumstance", () => {
  test("sentinel present + fatal signature + restarts over threshold: datastore untouched, refuses loudly", () => {
    const f = fixture({ served: true, fatalPresent: true });

    const r = runRecovery({ f, nrestarts: 58 });

    expect(r.status).toBe(0);
    expect(existsSync(f.datastoreDir)).toBe(true);
    expect(readFileSync(f.markerFile, "utf8")).toBe("real cluster data, do not touch\n");
    expect(r.restartLog).toBe("");
    expect(r.stdout).toContain("REFUSING");
    expect(r.stdout).toContain("NOTHING HAS BEEN DELETED");
  });

  test("sentinel present + fatal signature + a huge restart count: still untouched", () => {
    // The guard must not be a disguised threshold on restart count -- an
    // arbitrarily large count must never override "this datastore served".
    const f = fixture({ served: true, fatalPresent: true });

    const r = runRecovery({ f, nrestarts: 100000 });

    expect(existsSync(f.datastoreDir)).toBe(true);
    expect(r.restartLog).toBe("");
  });

  test("refusal is printed only once, not on every poll", () => {
    const f = fixture({ served: true, fatalPresent: true });
    runRecovery({ f, nrestarts: 58 });
    const r2 = runRecovery({ f, nrestarts: 59 });
    expect(r2.stdout).not.toContain("REFUSING");
    expect(existsSync(f.datastoreDir)).toBe(true);
  }, 30000);
});

describe("the stillborn case -- recoverable exactly once", () => {
  test("no sentinel + fatal signature + restarts over threshold: datastore removed, k3s restarted", () => {
    const f = fixture({ served: false, fatalPresent: true });

    const r = runRecovery({ f, nrestarts: 10 });

    expect(r.status).toBe(0);
    expect(existsSync(f.datastoreDir)).toBe(false);
    expect(r.restartLog).toBe("restarted\n");
    expect(r.stdout).toContain("RECOVERING");
  });

  test("below the restart threshold: nothing is DONE, but the boot still says so", () => {
    const f = fixture({ served: false, fatalPresent: true });

    const r = runRecovery({ f, nrestarts: 2, threshold: 6 });

    expect(r.status).toBe(0);
    expect(existsSync(f.datastoreDir)).toBe(true);
    expect(r.restartLog).toBe("");
    // NOT silence. A unit that decided "not yet" must not look identical on
    // the console to a unit that never started -- that indistinguishability
    // is the defect class this module was written inside of.
    expect(r.stdout).toContain("VERDICT unbootstrapped-watching");
  });

  test("exactly at the threshold: recovers", () => {
    const f = fixture({ served: false, fatalPresent: true });
    const r = runRecovery({ f, nrestarts: 6, threshold: 6 });
    expect(existsSync(f.datastoreDir)).toBe(false);
    expect(r.restartLog).toBe("restarted\n");
  });

  test("one recovery attempt per boot, ever -- a second round of the same fatal does not wipe again", () => {
    const f = fixture({ served: false, fatalPresent: true });
    const r1 = runRecovery({ f, nrestarts: 10 });
    expect(r1.restartLog).toBe("restarted\n"); // the first, legitimate recovery
    // Simulate the fresh datastore existing again (as it would after k3s
    // re-founded) and still failing -- the attempted-marker must stop a
    // second wipe regardless.
    mkdirSync(posixJoin(f.datastoreDir, "etcd"), { recursive: true });
    writeFileSync(posixJoin(f.datastoreDir, "etcd", "member-marker"), "second attempt data\n");

    const r2 = runRecovery({ f, nrestarts: 16 });

    expect(existsSync(f.datastoreDir)).toBe(true);
    // The restart log is CUMULATIVE across both calls (same fixture root) --
    // the assertion is that the SECOND call appended nothing, not that the
    // file is empty (the first call's legitimate "restarted" line is still
    // in it).
    expect(r2.restartLog).toBe(r1.restartLog);
    expect(r2.stdout).toContain("Not retrying automatically");
  }, 30000);
});

describe("a crash-loop for a DIFFERENT reason -- diagnosed, never wiped", () => {
  test("restarts over threshold but the fatal signature is absent: loud one-time diagnostic, no deletion", () => {
    const f = fixture({ served: false, fatalPresent: false });

    const r = runRecovery({ f, nrestarts: 20 });

    expect(r.status).toBe(0);
    expect(existsSync(f.datastoreDir)).toBe(true);
    expect(r.restartLog).toBe("");
    expect(r.stdout).toContain("NOT exhibiting the known stillborn-datastore fatal");
    expect(r.stdout).toContain("some other crash, unrelated to bootstrap data");
  });

  test("the diagnostic prints only once across repeated polls", () => {
    const f = fixture({ served: false, fatalPresent: false });
    const r1 = runRecovery({ f, nrestarts: 20 });
    expect(r1.stdout).toContain("VERDICT other-crash-loop");
    const r2 = runRecovery({ f, nrestarts: 21 });
    // Silent on the SECOND poll is correct -- the verdict has not changed,
    // and the unit re-runs every 10s forever. Once per outcome, not once
    // per poll.
    expect(r2.stdout).toBe("");
  }, 30000);
});

// The third of the three outcomes the console must be able to tell apart.
// "There is no datastore" and "there is a datastore I chose not to touch"
// are completely different facts about the machine, and before this verdict
// existed they arrived as the same silence.
describe("no datastore at all -- says so, rather than saying nothing", () => {
  test("the datastore directory does not exist: distinct verdict, nothing touched", () => {
    const f = fixture({ served: false, fatalPresent: true });
    rmSync(f.datastoreDir, { recursive: true, force: true });

    const r = runRecovery({ f, nrestarts: 58 });

    expect(r.status).toBe(0);
    expect(r.restartLog).toBe("");
    expect(r.stdout).toContain("VERDICT datastore-absent");
    // Not confusable with either of the other two outcomes.
    expect(r.stdout).not.toContain("RECOVERING");
    expect(r.stdout).not.toContain("REFUSING");
  });
});

describe("the three outcomes are mutually exclusive verdict codes", () => {
  test("recovered, refused, and absent each emit their own code and no other", () => {
    const recovered = runRecovery({ f: fixture({ served: false, fatalPresent: true }), nrestarts: 10 });
    const refused = runRecovery({ f: fixture({ served: true, fatalPresent: true }), nrestarts: 10 });
    const absentFixture = fixture({ served: false, fatalPresent: true });
    rmSync(absentFixture.datastoreDir, { recursive: true, force: true });
    const absent = runRecovery({ f: absentFixture, nrestarts: 10 });

    const codes = ["stillborn-recovered", "served-refused", "datastore-absent"] as const;
    const emitted = [recovered.stdout, refused.stdout, absent.stdout].map((out) =>
      codes.filter((c) => out.includes(`VERDICT ${c}`)),
    );

    expect(emitted).toEqual([["stillborn-recovered"], ["served-refused"], ["datastore-absent"]]);
  }, 30000);

  test("a served datastore on a HEALTHY node still states its verdict", () => {
    // No crash loop at all -- the ordinary steady state, which must still be
    // distinguishable from a unit that never ran.
    const f = fixture({ served: true, fatalPresent: false });
    const r = runRecovery({ f, nrestarts: 0 });
    expect(r.stdout).toContain("VERDICT served");
    expect(existsSync(f.datastoreDir)).toBe(true);
  });
});

describe("target-1-shaped guard: refuses outright on a misdirected datastore path", () => {
  test("ZETA_DATASTORE_DIR not ending in 'server/db' is refused, nothing touched", () => {
    const f = fixture({ served: false, fatalPresent: true });
    const wrongDir = posixJoin(f.root, "server/tls");
    mkdirSync(wrongDir, { recursive: true });
    writeFileSync(posixJoin(wrongDir, "server-ca.crt"), "CA material\n");

    const restartLogFile = posixJoin(f.root, "restart-calls.log");
    const result = spawnSync("bash", [RECOVERY_SCRIPT], {
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        LC_ALL: "C",
        ZETA_SENTINEL_FILE: f.sentinelFile,
        ZETA_DATASTORE_DIR: wrongDir,
        ZETA_RECOVERY_ATTEMPTED_FILE: f.recoveryAttemptedFile,
        ZETA_K3S_NRESTARTS_CMD: "echo 10",
        ZETA_K3S_JOURNAL_CMD: `cat ${f.journalFile}`,
        ZETA_K3S_RESTART_CMD: `echo restarted >> ${restartLogFile}`,
        ZETA_SERIAL_DEVICE: posixJoin(f.root, "no-such-serial-device"),
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("refusing");
    expect(existsSync(posixJoin(wrongDir, "server-ca.crt"))).toBe(true);
  });
});

describe("the sentinel writer -- write-once, only on a real readyz success", () => {
  function sentinelFixture(): { readonly root: string; readonly sentinelFile: string } {
    const root = tempRoot();
    const sentinelFile = posixJoin(root, "server/db/.zeta-datastore-has-served");
    mkdirSync(posixJoin(root, "server/db"), { recursive: true });
    return { root, sentinelFile };
  }

  function runSentinel(sentinelFile: string, root: string, readyzCmd: string): { readonly status: number; readonly stdout: string } {
    const result = spawnSync("bash", [SENTINEL_SCRIPT], {
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        LC_ALL: "C",
        ZETA_SENTINEL_FILE: sentinelFile,
        ZETA_K3S_READYZ_CMD: readyzCmd,
        // Per-fixture, same reason as the recovery script's verdict latch.
        ZETA_WAITING_STATE_FILE: posixJoin(root, "waiting-state"),
        ZETA_SERIAL_DEVICE: posixJoin(root, "no-such-serial-device"),
      },
      encoding: "utf8",
    });
    return { status: result.status ?? -1, stdout: `${result.stdout}${result.stderr}` };
  }

  test("readyz fails: sentinel is never written", () => {
    const { root, sentinelFile } = sentinelFixture();
    const r = runSentinel(sentinelFile, root, "false");
    expect(r.status).toBe(0);
    expect(existsSync(sentinelFile)).toBe(false);
  });

  test("readyz fails: the writer SAYS it is not writing, rather than going quiet", () => {
    // The catastrophic silent failure: if the real readyz command were ever
    // wrong (typo, k3s not on the unit's path, moved kubeconfig), the
    // sentinel would never be written, and a datastore that HAS served
    // would look stillborn to the recovery script forever. This line is the
    // only thing that would make that visible on the console.
    const { root, sentinelFile } = sentinelFixture();
    const r = runSentinel(sentinelFile, root, "false");
    expect(r.stdout).toContain("VERDICT waiting-for-readyz");
  });

  test("readyz succeeds: sentinel is written", () => {
    const { root, sentinelFile } = sentinelFixture();
    const r = runSentinel(sentinelFile, root, "true");
    expect(r.status).toBe(0);
    expect(existsSync(sentinelFile)).toBe(true);
    expect(r.stdout).toContain("wrote");
  });

  test("write-once: a second readyz success never changes the sentinel's content", () => {
    const { root, sentinelFile } = sentinelFixture();
    runSentinel(sentinelFile, root, "true");
    const before = readFileSync(sentinelFile, "utf8");
    runSentinel(sentinelFile, root, "true");
    const after = readFileSync(sentinelFile, "utf8");
    expect(after).toBe(before);
  }, 30000);

  test("write-once: readyz is never even consulted once the sentinel exists", () => {
    const { root, sentinelFile } = sentinelFixture();
    writeFileSync(sentinelFile, "already-served-marker\n");
    // A readyz command that would itself fail the test if invoked.
    const r = runSentinel(sentinelFile, root, "echo SHOULD-NEVER-RUN >&2; exit 1");
    expect(r.status).toBe(0);
    expect(readFileSync(sentinelFile, "utf8")).toBe("already-served-marker\n");
    expect(r.stdout).not.toContain("SHOULD-NEVER-RUN");
  });
});

describe("the scripts' own text", () => {
  test("the recovery script's only destructive verb is the one scoped rm -rf on the datastore dir", () => {
    const text = readFileSync(RECOVERY_SCRIPT, "utf8");
    const body = text
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("#"))
      .join("\n");
    for (const verb of ["rmdir", "shred", "mkfs", "dd if=", "truncate", "wipefs", "find /", "find $HOME"]) {
      expect({ verb, present: body.includes(verb) }).toEqual({ verb, present: false });
    }
    expect(body).toContain('rm -rf -- "$DATASTORE_DIR"');
  });

  test("the sentinel writer contains no destructive verb at all", () => {
    const text = readFileSync(SENTINEL_SCRIPT, "utf8");
    const body = text
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("#"))
      .join("\n");
    for (const verb of ["rm -", "rmdir", "shred", "mkfs", "dd if=", "truncate", "wipefs"]) {
      expect({ verb, present: body.includes(verb) }).toEqual({ verb, present: false });
    }
  });
});

describe("unit wiring", () => {
  test("both services wired on systemd.services, server-role module only", () => {
    const moduleText = readFileSync(MODULE, "utf8");
    expect(moduleText).toContain("systemd.services.zeta-k3s-datastore-bootstrap-sentinel");
    expect(moduleText).toContain("systemd.services.zeta-k3s-datastore-bootstrap-recovery");
    expect(moduleText).toContain("k3s-datastore-bootstrap-sentinel-write.sh");
    expect(moduleText).toContain("k3s-datastore-bootstrap-recovery.sh");
  });

  test("imported by k3s-server.nix (server role only -- a worker has no server/db)", () => {
    expect(readFileSync(SERVER_MODULE, "utf8")).toContain("./k3s-datastore-bootstrap-recovery.nix");
  });
});
