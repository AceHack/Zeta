/**
 * areas.test.ts — the falsifiers for the taxonomy and the closed-form baseline.
 *
 * The property that MUST hold for the whole study to mean anything is the
 * independence of the two label sources: `measuredArea` must never consult a
 * title, and `declaredArea` must never consult a path. If either leaks, the
 * baseline's agreement with the ground truth is an identity rather than a
 * measurement, and every accuracy number downstream is void. The first
 * describe block below is that check, and it is written so it FAILS if the
 * separation is ever broken.
 */

import { describe, expect, test } from 'bun:test';

import { AREAS, areaOfPath, declaredArea, measuredArea, type Area } from './areas.ts';

describe('the two label sources are independent', () => {
  test('measuredArea ignores the title entirely — it only ever sees paths', () => {
    // Same paths, wildly different titles => identical measured area.
    const paths = ['src/Core/Foo.fs', 'src/Core/Bar.fs'];
    const a = measuredArea(paths);
    expect(a?.area).toBe('core-fsharp');
    // There is no title parameter to pass; that is the guarantee, and this
    // test documents it. If a future signature grows one, this stops compiling.
    expect(measuredArea.length).toBe(1);
  });

  test('declaredArea ignores paths entirely — it only ever sees title and branch', () => {
    expect(declaredArea.length).toBe(2);
    // A title claiming `research` stays `research` no matter what changed.
    expect(declaredArea('research: whatever', 'x/y').area).toBe('research');
  });

  test('a title that lies is NOT corrected by the measured area', () => {
    // This is the disagreement the study exists to find; if the parser were
    // ever "helped" by the diff, this pair would collapse and the product
    // would silently become empty.
    const declared = declaredArea('ci: fix the pipeline', 'fix/thing').area;
    const measured = measuredArea(['docs/research/2026-01-01-a.md'])!.area;
    expect(declared).toBe('ci');
    expect(measured).toBe('research');
    expect(declared).not.toBe(measured);
  });
});

describe('areaOfPath', () => {
  test('is total — every string gets an area', () => {
    for (const p of ['', 'x', 'a/b/c/d.txt', '////', 'src/']) {
      expect(AREAS).toContain(areaOfPath(p));
    }
  });

  test('specific rules beat general ones (order is precedence)', () => {
    // docs/research must not be swallowed by the bare docs/ rule.
    expect(areaOfPath('docs/research/2026-08-27-x.md')).toBe('research');
    expect(areaOfPath('docs/anything-else.md')).toBe('docs-other');
    // src/Core.TypeScript must not be swallowed by the bare src/ rule.
    expect(areaOfPath('src/Core.TypeScript/hygiene/x.ts')).toBe('tooling-ts');
    expect(areaOfPath('src/Core/ZSet.fs')).toBe('core-fsharp');
  });

  test('every harness dotdir lands in agent-substrate, not just .claude', () => {
    for (const d of ['.claude', '.gemini', '.cursor', '.codex']) {
      expect(areaOfPath(`${d}/bin/loop-tick.ts`)).toBe('agent-substrate');
    }
  });

  test('build config is separated from ci', () => {
    expect(areaOfPath('.github/workflows/gate.yml')).toBe('ci');
    expect(areaOfPath('Directory.Packages.props')).toBe('build');
    expect(areaOfPath('package.json')).toBe('build');
    expect(areaOfPath('Zeta.sln')).toBe('build');
    // A nested package.json is NOT repo build config; the anchor matters.
    expect(areaOfPath('demo/identity-dla-site/package.json')).toBe('demo-web');
  });
});

describe('measuredArea', () => {
  test('returns null for an empty diff rather than inventing an area', () => {
    expect(measuredArea([])).toBeNull();
  });

  test('purity is 1 for a single-area PR and fractional for a mixed one', () => {
    expect(measuredArea(['src/Core/A.fs', 'src/Core/B.fs'])!.purity).toBe(1);
    const mixed = measuredArea(['src/Core/A.fs', 'docs/research/x.md'])!;
    expect(mixed.purity).toBe(0.5);
    expect(mixed.areaCount).toBe(2);
  });

  test('argmax picks the majority area, not the first path', () => {
    const m = measuredArea([
      'docs/research/a.md',
      'src/Core/A.fs',
      'src/Core/B.fs',
      'src/Core/C.fs',
    ])!;
    expect(m.area).toBe('core-fsharp');
  });

  test('ties break deterministically by AREAS order — same input, same answer', () => {
    const paths = ['src/Core/A.fs', 'docs/research/a.md'];
    const first = measuredArea(paths)!.area;
    for (let i = 0; i < 20; i++) expect(measuredArea(paths)!.area).toBe(first);
    // ...and the winner is whichever of the tied areas comes first in AREAS.
    const tied: Area[] = ['research', 'core-fsharp'];
    const expected = AREAS.find((a) => tied.includes(a));
    expect(first).toBe(expected!);
  });

  test('counts sum to the number of files', () => {
    const paths = ['src/Core/A.fs', 'docs/research/a.md', 'tests/x.fs', 'memory/y.md'];
    const m = measuredArea(paths)!;
    expect(Object.values(m.counts).reduce((s, n) => s + n, 0)).toBe(paths.length);
  });
});

describe('declaredArea — the closed-form baseline', () => {
  test('reads the paren scope in preference to the conventional type', () => {
    // `fix` is the KIND of change; `ci` is the area. Taking `fix` would be wrong.
    expect(declaredArea('fix(ci): thing', 'x').area).toBe('ci');
    expect(declaredArea('feat(memory): thing', 'x').area).toBe('memory');
  });

  test('falls back to the branch prefix when the title gives only a type', () => {
    const d = declaredArea('feat: add a thing', 'research/some-topic');
    expect(d.area).toBe('research');
    expect(d.source).toBe('branch');
  });

  test('ABSTAINS rather than guessing, and says which kind of silence it is', () => {
    // Declared a type but no area, and the branch says nothing either.
    const typeOnly = declaredArea('feat: a thing', 'wip-1');
    expect(typeOnly.area).toBeNull();
    expect(typeOnly.source).toBe('type-only');

    // No conventional prefix at all.
    const none = declaredArea('Round 26 — rename tail', 'round-26');
    expect(none.area).toBeNull();
    expect(none.source).toBe('none');
  });

  test('only reads a PREFIX — a scope word later in the title is prose', () => {
    // "research" here is a sentence word, not a declaration, and treating it
    // as one would manufacture agreement out of ordinary English.
    const d = declaredArea('rename the research directory', 'x/y');
    expect(d.area).toBeNull();
  });

  test('skips leading bracket tags before the scope', () => {
    const d = declaredArea('[skip-review][telemetry-flush] metrics: append tick frame', 'x');
    expect(d.area).toBe('telemetry');
    expect(d.source).toBe('title');
  });

  test('is a pure function — no clock, no randomness, no ambient state', () => {
    const inputs: Array<[string, string]> = [
      ['fix(ci): a', 'b/c'],
      ['feat: b', 'heartbeat/x'],
      ['nonsense', 'nonsense'],
    ];
    for (const [t, h] of inputs) {
      const first = JSON.stringify(declaredArea(t, h));
      for (let i = 0; i < 5; i++) expect(JSON.stringify(declaredArea(t, h))).toBe(first);
    }
  });
});

/**
 * MUTATION PROBES.
 *
 * `.claude/rules/toy-is-free-metered-must-be-earned.md`: a test that survives a
 * broken implementation is not a falsifier. These re-implement the specific
 * defects the tests above are meant to catch and assert that the defective
 * version WOULD fail them — so the checks above are shown to be load-bearing
 * rather than assumed to be.
 */
describe('mutation probes — the tests above can actually fail', () => {
  test('a parser that reads scope words anywhere in the title would be caught', () => {
    const loose = (title: string): Area | null => {
      // The mutant: search the whole title instead of anchoring at the prefix.
      if (/research/i.test(title)) return 'research';
      return null;
    };
    // The real parser abstains here; the mutant does not. The
    // "only reads a PREFIX" test above is what separates them.
    expect(declaredArea('rename the research directory', 'x/y').area).toBeNull();
    expect(loose('rename the research directory')).toBe('research');
  });

  test('a taxonomy with the general rule first would be caught', () => {
    // The mutant: bare docs/ before docs/research.
    const mutant = (p: string): Area => (p.startsWith('docs/') ? 'docs-other' : areaOfPath(p));
    expect(areaOfPath('docs/research/x.md')).toBe('research');
    expect(mutant('docs/research/x.md')).toBe('docs-other');
  });

  test('an argmax that returned the FIRST area would be caught', () => {
    const paths = ['docs/research/a.md', 'src/Core/A.fs', 'src/Core/B.fs', 'src/Core/C.fs'];
    const mutant = areaOfPath(paths[0]!);
    expect(measuredArea(paths)!.area).toBe('core-fsharp');
    expect(mutant).toBe('research');
    expect(measuredArea(paths)!.area).not.toBe(mutant);
  });
});
