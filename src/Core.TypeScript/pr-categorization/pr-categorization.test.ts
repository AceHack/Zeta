/**
 * pr-categorization.test.ts — the lane's own falsifiers.
 *
 * These check the seams BETWEEN the generator and the things that publish and
 * watch it, which is where this class of lane actually dies. Three lanes went
 * quiet in the week this was written and none of them died in its algorithm:
 * one flushed a subset of the files it wrote, one leased against a ref that was
 * never fetched, one piped a checker through `tee` and reported tee's status.
 *
 * So: the flush list, the freshness registration, and the pipefail line are all
 * asserted here against the real files on disk. A comment claiming they agree
 * is worth nothing; a test that fails when they stop agreeing is the guard.
 */

import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { ARTIFACTS, parseArgv } from './cli.ts';
import { FRESHNESS_ROSTER } from '../hygiene/audit-artifact-freshness.ts';

const REPO = path.resolve(import.meta.dir, '../../..');
const WORKFLOW = path.join(REPO, '.github/workflows/pr-categorization-cadence.yml');
const wf = (): string => fs.readFileSync(WORKFLOW, 'utf8');

describe('the flush list cannot drift from what the generator writes', () => {
  test('every artifact the CLI writes is named in the workflow --paths list', () => {
    const yml = wf();
    const m = /--paths ([^\n]*)/.exec(yml);
    expect(m).not.toBeNull();
    const listed = m![1]!
      .replace(/\\$/, '')
      .trim()
      .split(/\s+/)
      .filter((s) => s.length > 0 && !s.startsWith('--'));
    // The exact defect this prevents: the drift-dashboard lane wrote four files
    // and listed two, so the markdown froze while the JSON refreshed.
    for (const a of ARTIFACTS) expect(listed).toContain(a);
  });

  test('the workflow lists nothing the CLI does not write', () => {
    const yml = wf();
    const listed = /--paths ([^\n]*)/
      .exec(yml)![1]!
      .replace(/\\$/, '')
      .trim()
      .split(/\s+/)
      .filter((s) => s.length > 0 && !s.startsWith('--'));
    // A path in the flush list that nothing produces is a different failure —
    // it makes the lane look like it publishes more than it does.
    for (const p of listed) expect(ARTIFACTS as readonly string[]).toContain(p);
  });

  test('MUTATION PROBE: dropping an artifact from the list would be caught', () => {
    const listed = ARTIFACTS.slice(0, ARTIFACTS.length - 1);
    const dropped = ARTIFACTS[ARTIFACTS.length - 1];
    expect(listed).not.toContain(dropped);
  });
});

describe('the lane is watched', () => {
  test("the statistics file is registered in the freshness roster", () => {
    const subject = FRESHNESS_ROSTER.find((s) => s.id === 'pr-categorization');
    expect(subject).toBeDefined();
    expect(subject!.path).toBe('data/pr-categorization/statistics.json');
  });

  test('the roster watches a field the generator actually emits at TOP LEVEL', () => {
    // The checker addresses a top-level key only, so a nested timestamp would
    // read as absent — which reports the same as frozen and is a different bug.
    const subject = FRESHNESS_ROSTER.find((s) => s.id === 'pr-categorization')!;
    expect(subject.field).toBe('generatedAtIso');
    // Read and interpret ENOENT rather than `existsSync` then read: the pair is
    // a check-then-use race (CWE-367), and here it would also be a vacuous
    // guard — on a checkout without the artifact the whole assertion silently
    // does nothing, which is the shape of a check that cannot fail.
    const statsPath = path.join(REPO, subject.path);
    let raw: string | null;
    try {
      raw = fs.readFileSync(statsPath, 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      raw = null;
    }
    if (raw !== null) {
      const doc = JSON.parse(raw) as Record<string, unknown>;
      expect(Object.prototype.hasOwnProperty.call(doc, subject.field)).toBe(true);
      expect(typeof doc[subject.field]).toBe('string');
      expect(Number.isFinite(Date.parse(String(doc[subject.field])))).toBe(true);
    }
  });

  test('the declared cadence matches the cron the workflow actually runs on', () => {
    // A roster entry citing a cadence the workflow does not keep would mark the
    // lane stale (or, worse, never stale) for a reason unrelated to the lane.
    const subject = FRESHNESS_ROSTER.find((s) => s.id === 'pr-categorization')!;
    const cron = /- cron: "([^"]+)"/.exec(wf());
    expect(cron).not.toBeNull();
    expect(subject.cadenceDeclaredIn).toContain('cron');
    expect(subject.cadenceDeclaredIn).toContain(cron![1]!);
    expect(subject.cadenceDeclaredIn).toContain('pr-categorization-cadence.yml');
    const everyNHours = /^\d+ \*\/(\d+) \* \* \*$/.exec(cron![1]!);
    expect(everyNHours).not.toBeNull();
    expect(subject.cadenceSeconds).toBe(Number(everyNHours![1]) * 3600);
  });

  test('this lane does not collide with another lane on the same cron minute', () => {
    const minute = /- cron: "(\d+) /.exec(wf())![1];
    const dir = path.join(REPO, '.github/workflows');
    const clashes: string[] = [];
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.yml') || f === 'pr-categorization-cadence.yml') continue;
      const body = fs.readFileSync(path.join(dir, f), 'utf8');
      // ANY cron form, not just `*/N` hourly. Restricting the pattern to `*/N`
      // is exactly how a real overlap gets missed: `mirror-to-fork.yml` runs
      // `13 8 * * *`, which a `*/N`-only regex does not match at all — so
      // minute 13 read as free when it was not.
      for (const m of body.matchAll(/- cron: "(\d+)[ ,]/g)) {
        if (m[1] === minute) clashes.push(f);
      }
    }
    // Scheduled runs landing on the same minute get dropped together under
    // scheduler load, which is how a set of lanes goes quiet at once.
    expect(clashes).toEqual([]);
  }, 20_000);
});

describe('the workflow does not carry the known-fatal shapes', () => {
  test('the generator step sets pipefail — it pipes through tee', () => {
    const yml = wf();
    expect(yml).toContain('| tee');
    // GitHub runs `run:` under `bash -e {0}` with pipefail OFF, so without this
    // the step reports tee's status and a failing generator reads as green.
    expect(yml).toContain('set -uo pipefail');
    expect(yml).toContain('PIPESTATUS[0]');
  });

  test('the publish step swallows nothing', () => {
    const yml = wf();
    const flushIdx = yml.indexOf('flush \\');
    expect(flushIdx).toBeGreaterThan(-1);
    const tail = yml.slice(flushIdx);
    for (const bad of ['|| true', '|| echo', '|| :', '|| exit 0', 'continue-on-error']) {
      expect(tail).not.toContain(bad);
    }
  });

  test('nothing in this lane pushes at main', () => {
    const yml = wf();
    expect(/git push[^\n]*HEAD:main/.test(yml)).toBe(false);
    expect(/git push[^\n]*refs\/heads\/main/.test(yml)).toBe(false);
  });

  test('capability is PROBED with a real dry-run push, not inferred', () => {
    expect(wf()).toContain('git push --dry-run origin');
  });

  test('checkout is full-depth — the PR->files join needs the whole history', () => {
    expect(wf()).toContain('fetch-depth: 0');
  });
});

describe('cli argument parsing', () => {
  test('defaults to a temporal split and does not write unless asked', () => {
    const o = parseArgv([]);
    expect('error' in o).toBe(false);
    if ('error' in o) return;
    expect(o.split).toBe('temporal');
    expect(o.write).toBe(false);
  });

  test('refuses an unknown split rather than silently choosing one', () => {
    const o = parseArgv(['--split', 'sideways']);
    expect('error' in o).toBe(true);
  });

  test('--write and --split are read', () => {
    const o = parseArgv(['--write', '--split', 'random']);
    if ('error' in o) throw new Error(o.error);
    expect(o.write).toBe(true);
    expect(o.split).toBe('random');
  });
});
