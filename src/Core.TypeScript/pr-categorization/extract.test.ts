/**
 * extract.test.ts — falsifiers for the two parsers the whole corpus is built
 * from.
 *
 * Everything downstream — every feature, every label, every accuracy number —
 * is whatever these two functions decided the raw substrate said. A model bug
 * makes one model wrong; a parser bug makes the DATASET wrong, and every model
 * agrees with every other model about the corrupted answer. Agreement between
 * models fed the same bad parse is not evidence, so nothing downstream can
 * catch it. That is why the checks here are exact.
 *
 * Two blocks carry the weight:
 *
 *   1. "the newest commit wins" — `parseGitLog` documents a real tie-break for
 *      a real ambiguity (a PR number reappearing in a later revert or
 *      cherry-pick subject). A documented tie-break that no test pins is a
 *      comment, and comments do not survive refactors.
 *
 *   2. "a missing cell is UNKNOWN, never zero" — `parseArchive` says the
 *      archive schema changed over the corpus's life, so absent rows are
 *      normal. If an absent row parsed as 0, "this PR touched 0 files" and
 *      "we do not know how many files this PR touched" would become the same
 *      value, and every mean, every correlation and every model coefficient
 *      built on those columns would be silently biased toward zero by an
 *      amount nobody could recover. `null` is load-bearing, so it is asserted
 *      directly (`toBeNull`) rather than through a truthiness check that `0`
 *      would also satisfy.
 *
 * No `Math.random()`, no `Date.now()`: every fixture below is a literal.
 */

import { describe, expect, test } from 'bun:test';

import { parseArchive, parseGitLog } from './extract.ts';

// ─── parseGitLog ────────────────────────────────────────────────────────────

/** `git log --format=__C__%H\t%s --name-only` output, verbatim in shape. */
const GIT_LOG = [
  '__C__aaa111\tmetrics: append tick frame (#123)',
  'src/Core.TypeScript/metrics/append.ts',
  'tests/metrics.test.ts',
  '',
  '__C__bbb222\tchore: a commit with no PR marker at all',
  'src/orphan.ts',
  '',
  '__C__ccc333\tdocs: a thing (#77)',
  'docs/x.md',
  '',
].join('\n');

describe('parseGitLog', () => {
  test('parses __C__<sha>\\t<subject> blocks and the filenames that follow', () => {
    const m = parseGitLog(GIT_LOG);
    expect(m.get(123)).toEqual([
      'src/Core.TypeScript/metrics/append.ts',
      'tests/metrics.test.ts',
    ]);
    expect(m.get(77)).toEqual(['docs/x.md']);
  });

  test('extracts the PR number from a TRAILING (#N) and nothing else', () => {
    // The join key is the squash-merge convention. Anchoring at the end of the
    // subject is what keeps an issue reference in the middle of a message from
    // being mistaken for the PR that merged it — which would silently attach
    // one PR's diff to a different PR's title, and the label would come from
    // the wrong change.
    const trailing = parseGitLog('__C__h\tfix: closes stuff (#900)\na.ts');
    expect([...trailing.keys()]).toEqual([900]);

    const midSubject = parseGitLog('__C__h\tfix: revert (#900) because of X\na.ts');
    expect(midSubject.size).toBe(0);

    // Trailing whitespace after the marker is tolerated; other trailing text is not.
    expect([...parseGitLog('__C__h\tfeat: x (#12)   \na.ts').keys()]).toEqual([12]);
    expect(parseGitLog('__C__h\tfeat: x (#12) !\na.ts').size).toBe(0);
  });

  test('a commit with NO (#N) contributes no files — and none to its predecessor', () => {
    // The second half is the sharper check. `cur` has to be cleared when a
    // block has no PR number; if it merely stayed on the previous commit, the
    // orphan commit's files would be appended to the PREVIOUS PR's diff and
    // that PR's measured area could flip to a completely different area.
    const m = parseGitLog(GIT_LOG);
    expect(m.get(123)).not.toContain('src/orphan.ts');
    expect([...m.keys()].sort((a, b) => a - b)).toEqual([77, 123]);
    for (const files of m.values()) expect(files).not.toContain('src/orphan.ts');
  });

  test('THE DOCUMENTED TIE-BREAK: a repeated PR number keeps the FIRST block only', () => {
    // `git log` walks newest-first, so the first block seen is the newest
    // commit carrying that number. A PR number can legitimately reappear in an
    // older revert or cherry-pick subject; the source states that the newest
    // wins, and that statement is pinned here because it is a real ambiguity
    // with two defensible answers.
    const raw = [
      '__C__newest\tfeat: the real merge (#123)',
      'new/one.ts',
      'new/two.ts',
      '',
      '__C__older\trevert: an older commit mentioning (#123)',
      'old/should-not-appear.ts',
      'old/also-not.ts',
      '',
    ].join('\n');
    const m = parseGitLog(raw);
    expect(m.get(123)).toEqual(['new/one.ts', 'new/two.ts']);
    expect(m.get(123)).not.toContain('old/should-not-appear.ts');
    expect(m.get(123)!.length).toBe(2);
    expect(m.size).toBe(1);
  });

  test('the older block does not leak into the NEXT PR either', () => {
    // The subtle version of the same defect: after skipping a duplicate, the
    // parser must not resume collecting into the duplicate's entry when a
    // later block appears. If `cur` were left pointing at 123, the third
    // commit's files would land on PR 123.
    const raw = [
      '__C__newest\tfeat: real (#123)',
      'a.ts',
      '',
      '__C__older\trevert: dup (#123)',
      'b.ts',
      '',
      '__C__third\tdocs: other (#456)',
      'c.ts',
      '',
    ].join('\n');
    const m = parseGitLog(raw);
    expect(m.get(123)).toEqual(['a.ts']);
    expect(m.get(456)).toEqual(['c.ts']);
    expect([...m.values()].flat()).not.toContain('b.ts');
  });

  test('is total and pure — junk input yields an empty map, twice the same way', () => {
    expect(parseGitLog('').size).toBe(0);
    expect(parseGitLog('\n\n\n').size).toBe(0);
    // Filenames before any commit header have no owner and are dropped rather
    // than attributed to a guess.
    expect(parseGitLog('stray.ts\nalso-stray.ts').size).toBe(0);
    // A commit with no files at all still registers (empty diff, known PR).
    const empty = parseGitLog('__C__h\tfeat: x (#5)\n');
    expect(empty.get(5)).toEqual([]);
    // Determinism: same bytes in, same structure out.
    expect([...parseGitLog(GIT_LOG)]).toEqual([...parseGitLog(GIT_LOG)]);
  });

  test('multi-digit and large PR numbers parse as numbers, not strings', () => {
    // The map is keyed by number and joined against a numeric manifest field.
    // A string key would miss every join and produce an empty corpus, which
    // would look like "no merged PRs" rather than like a bug.
    const m = parseGitLog('__C__h\tfeat: x (#15429)\na.ts');
    expect(m.has(15429)).toBe(true);
    expect(typeof [...m.keys()][0]).toBe('number');
  });
});

// ─── parseArchive ───────────────────────────────────────────────────────────

/** A complete archive in the real `docs/history/pr-reviews/PR-*.md` shape. */
const FULL_ARCHIVE = [
  '# PR #4242 — metrics: append tick frame',
  '',
  '## Metadata',
  '',
  '| Field | Value |',
  '| --- | --- |',
  '| Author | `AceHack` (human) |',
  '| Changed files | 9 |',
  '| Additions / deletions | +304 / -1 |',
  '| Total threads | 2 |',
  '| Unresolved threads | 1 |',
  '| Base branch | `main` |',
  '| Created at | 2026-08-27T00:41:30Z |',
  '',
  '## Description',
  '',
  'Adds a tick frame to the metrics append path.',
  '',
  '## Outcome',
  '',
  'Merged via squash.',
  '',
].join('\n');

const DESCRIPTION_TEXT = 'Adds a tick frame to the metrics append path.';

describe('parseArchive — every field on a complete archive', () => {
  test('parses all ten fields exactly', () => {
    const m = parseArchive(FULL_ARCHIVE);
    expect(m.author).toBe('AceHack');
    expect(m.authorIsBot).toBe(false);
    expect(m.createdAt).toBe('2026-08-27T00:41:30Z');
    expect(m.baseRef).toBe('main'); // backticks stripped
    expect(m.changedFiles).toBe(9);
    expect(m.additions).toBe(304);
    expect(m.deletions).toBe(1);
    expect(m.totalThreads).toBe(2);
    expect(m.unresolvedThreads).toBe(1);
    expect(m.descriptionChars).toBe(DESCRIPTION_TEXT.length);
    expect(m.descriptionChars).toBe(45);
  });

  test('additions and deletions are split from ONE cell and not confused', () => {
    // `+304 / -1` is a single cell holding two numbers with opposite meanings.
    // Swapping them would invert the sign of every "PRs that delete more than
    // they add" feature, and both numbers would still look plausible.
    const m = parseArchive(FULL_ARCHIVE);
    expect(m.additions).toBeGreaterThan(m.deletions!);
    const reversed = parseArchive(FULL_ARCHIVE.replace('+304 / -1', '+1 / -304'));
    expect(reversed.additions).toBe(1);
    expect(reversed.deletions).toBe(304);
  });

  test('the Description section is measured, and stops at the next heading', () => {
    // If the lookahead failed, `descriptionChars` would absorb `## Outcome`
    // and everything after it — a feature that silently measured the length of
    // the rest of the file, growing with the archive format rather than with
    // the PR.
    const m = parseArchive(FULL_ARCHIVE);
    expect(m.descriptionChars).toBe(45);
    expect(m.descriptionChars).toBeLessThan(FULL_ARCHIVE.indexOf('## Outcome'));

    const longer = parseArchive(
      FULL_ARCHIVE.replace('Merged via squash.', 'Merged via squash. '.repeat(50)),
    );
    expect(longer.descriptionChars).toBe(45); // unchanged by a longer Outcome
  });

  test('is a pure function — same bytes, same record, every time', () => {
    const first = JSON.stringify(parseArchive(FULL_ARCHIVE));
    for (let i = 0; i < 5; i++) expect(JSON.stringify(parseArchive(FULL_ARCHIVE))).toBe(first);
  });
});

describe('parseArchive — the bot flag', () => {
  const withAuthor = (cell: string): string =>
    FULL_ARCHIVE.replace('| Author | `AceHack` (human) |', `| Author | ${cell} |`);

  test('`app/dependabot` (bot) => authorIsBot true, author without the marker', () => {
    // Bot PRs are a large, structurally different slice of this corpus (small,
    // single-area, no review threads). Mislabelling them would let a model
    // "learn" the taxonomy by learning who opened the PR.
    const m = parseArchive(withAuthor('`app/dependabot` (bot)'));
    expect(m.authorIsBot).toBe(true);
    expect(m.author).toBe('app/dependabot');
    expect(m.author).not.toContain('(bot)');
    expect(m.author).not.toContain('`');
  });

  test('`AceHack` (human) => authorIsBot false', () => {
    const m = parseArchive(withAuthor('`AceHack` (human)'));
    expect(m.authorIsBot).toBe(false);
    expect(m.author).toBe('AceHack');
  });

  test('an unmarked author is NOT a bot — the flag needs the explicit marker', () => {
    // Defaulting to `true` on an unrecognised shape would mark the whole
    // pre-schema-change era of the corpus as bot-authored.
    const m = parseArchive(withAuthor('`someone-else`'));
    expect(m.author).toBe('someone-else');
    expect(m.authorIsBot).toBe(false);
  });

  test('a missing Author row leaves author null and the flag false', () => {
    const m = parseArchive(FULL_ARCHIVE.replace(/^\| Author \|.*$/m, ''));
    expect(m.author).toBeNull();
    expect(m.authorIsBot).toBe(false);
  });
});

describe('parseArchive — A MISSING ROW IS null, NEVER 0', () => {
  /** The same archive with one metadata row deleted. */
  const without = (label: string): string =>
    FULL_ARCHIVE.replace(new RegExp(`^\\| ${label} \\|.*$\\n`, 'm'), '');

  test('every numeric field reads null when its row is absent', () => {
    // `toBeNull()` and not `toBeFalsy()`: 0 is falsy too, and the entire point
    // of this block is that 0 and null must not be interchangeable here.
    expect(parseArchive(without('Changed files')).changedFiles).toBeNull();
    expect(parseArchive(without('Total threads')).totalThreads).toBeNull();
    expect(parseArchive(without('Unresolved threads')).unresolvedThreads).toBeNull();

    const noAddDel = parseArchive(without('Additions / deletions'));
    expect(noAddDel.additions).toBeNull();
    expect(noAddDel.deletions).toBeNull();
  });

  test('the null is DISTINGUISHABLE from a real zero in the same field', () => {
    // The check that makes the one above mean something: a genuine `0` must
    // still parse as `0`. A parser that mapped everything to null would pass
    // the test above and lose real data instead of inventing it.
    const zeroed = FULL_ARCHIVE
      .replace('| Changed files | 9 |', '| Changed files | 0 |')
      .replace('| Unresolved threads | 1 |', '| Unresolved threads | 0 |');
    const m = parseArchive(zeroed);
    expect(m.changedFiles).toBe(0);
    expect(m.unresolvedThreads).toBe(0);
    expect(m.changedFiles).not.toBeNull();

    // Side by side: absent and zero are two different values.
    expect(parseArchive(without('Unresolved threads')).unresolvedThreads).toBeNull();
    expect(m.unresolvedThreads).toBe(0);
    expect(parseArchive(without('Unresolved threads')).unresolvedThreads)
      .not.toBe(m.unresolvedThreads);
  });

  test('non-numeric text in a numeric cell reads null, not NaN and not 0', () => {
    // NaN would propagate through every downstream mean and comparison and
    // render as an empty cell in a table; 0 would be a fabricated fact.
    const m = parseArchive(FULL_ARCHIVE.replace('| Changed files | 9 |', '| Changed files | n/a |'));
    expect(m.changedFiles).toBeNull();
    expect(Number.isNaN(m.changedFiles as unknown as number)).toBe(false);
  });

  test('string fields read null when absent, and never an empty-string placeholder', () => {
    expect(parseArchive(without('Created at')).createdAt).toBeNull();
    expect(parseArchive(without('Base branch')).baseRef).toBeNull();
    // The Description section is absent => unknown length, not zero length.
    const noDesc = parseArchive(FULL_ARCHIVE.replace(/\n## Description\n[\s\S]*?(?=\n## )/, ''));
    expect(noDesc.descriptionChars).toBeNull();
  });

  test('an archive with ONLY an author row parses every other field as null', () => {
    // The oldest archives in the corpus really do look like this. The whole
    // record must come back as "unknown" rather than as a PR that touched
    // nothing, was reviewed by nobody and had an empty description.
    const minimal = ['# PR #7', '', '## Metadata', '', '| Author | `app/dependabot` (bot) |', ''].join('\n');
    const m = parseArchive(minimal);
    expect(m.author).toBe('app/dependabot');
    expect(m.authorIsBot).toBe(true);
    expect(m.changedFiles).toBeNull();
    expect(m.additions).toBeNull();
    expect(m.deletions).toBeNull();
    expect(m.totalThreads).toBeNull();
    expect(m.unresolvedThreads).toBeNull();
    expect(m.createdAt).toBeNull();
    expect(m.baseRef).toBeNull();
    expect(m.descriptionChars).toBeNull();
  });

  test('an empty document parses to all-null rather than throwing', () => {
    const m = parseArchive('');
    expect(m.author).toBeNull();
    expect(m.changedFiles).toBeNull();
    expect(m.descriptionChars).toBeNull();
  });
});

describe('parseArchive — a PRESENT BUT EMPTY cell is null, NEVER 0', () => {
  // The sibling of the missing-row block above, and the sharper case: the row
  // IS there and its value is blank. `Number('') === 0` is finite, so a parser
  // that guards only the missing-ROW path turns a blank cell into a hard zero
  // and makes "unmeasured" indistinguishable from "genuinely zero" — the exact
  // collapse parseArchive's docstring forbids.
  //
  // This was a real defect, found by these tests before it was fixed. It was
  // LATENT rather than active: 52,876 metadata cells in the live corpus were
  // checked and none is blank. It is pinned anyway, because "upstream never
  // emits a blank" is a property of the archiver, not of this parser, and the
  // archive schema has already changed once.
  const blank = FULL_ARCHIVE.replace('| Changed files | 9 |', '| Changed files |  |')
    .replace('| Total threads | 2 |', '| Total threads |  |')
    .replace('| Base branch | `main` |', '| Base branch |  |');

  test('a blank numeric cell reads as unknown, not as zero', () => {
    const m = parseArchive(blank);
    expect(m.changedFiles).toBeNull();
    expect(m.totalThreads).toBeNull();
    // ...and specifically NOT the falsy-but-present value, which satisfies most
    // assertions identically and is a different fact about the world.
    expect(m.changedFiles).not.toBe(0);
    expect(m.totalThreads).not.toBe(0);
  });

  test('a blank string cell reads as null, not as the empty string', () => {
    expect(parseArchive(blank).baseRef).toBeNull();
    expect(parseArchive(blank).baseRef).not.toBe('');
  });

  test('the untouched rows still parse — the blanking is targeted', () => {
    const m = parseArchive(blank);
    expect(m.author).toBe('AceHack');
    expect(m.unresolvedThreads).toBe(1);
    expect(m.additions).toBe(304);
  });

  test('MUTATION PROBE: the old missing-row-only guard would be caught here', () => {
    // Exactly what the code did before the fix: guard `null`, let `''` through.
    const oldMdInt = (cell: string | null): number | null => {
      if (cell === null) return null;
      const n = Number(cell.replace(/[`,]/g, '').trim());
      return Number.isFinite(n) ? n : null;
    };
    expect(oldMdInt('')).toBe(0); // the mutant invents a measurement
    expect(parseArchive(blank).changedFiles).toBeNull(); // the parser refuses to
  });
});

/**
 * MUTATION PROBES.
 *
 * `.claude/rules/toy-is-free-metered-must-be-earned.md`: a test that survives a
 * broken implementation is not a falsifier. Each probe re-implements the exact
 * defect the corresponding block is meant to catch and shows the mutant
 * disagreeing with the real parser.
 */
describe('mutation probes — the tests above can actually fail', () => {
  test('a parser that read a MISSING numeric cell as 0 would be caught', () => {
    // The mutant is one `?? 0` away from the real implementation, and it is
    // the single most tempting simplification in this file: it removes a
    // nullable type from every consumer downstream.
    const mutantInt = (body: string, label: string): number => {
      const m = new RegExp(`^\\|\\s*${label}\\s*\\|\\s*(.*?)\\s*\\|\\s*$`, 'm').exec(body);
      const n = Number((m?.[1] ?? '').replace(/[`,]/g, '').trim());
      return Number.isFinite(n) ? n : 0; // <- the defect
    };
    const missing = FULL_ARCHIVE.replace(/^\| Changed files \|.*$\n/m, '');

    // The mutant fabricates a fact...
    expect(mutantInt(missing, 'Changed files')).toBe(0);
    // ...and the real parser refuses to.
    expect(parseArchive(missing).changedFiles).toBeNull();

    // The assertion that separates them is `toBeNull`. A truthiness check
    // would NOT have separated them, which is why this block uses toBeNull
    // everywhere — demonstrated rather than claimed:
    expect(Boolean(parseArchive(missing).changedFiles)).toBe(false);
    expect(Boolean(mutantInt(missing, 'Changed files'))).toBe(false);
    expect(parseArchive(missing).changedFiles).not.toBe(mutantInt(missing, 'Changed files'));
  });

  test('the fabricated zero is INDISTINGUISHABLE from a real one downstream', () => {
    // Why the defect above is more than a type-purity complaint: once it has
    // happened, no consumer can tell an unmeasured PR from an empty one, so
    // the corruption is unrecoverable rather than merely wrong. Two archives
    // that mean different things collapse to one value.
    const missing = FULL_ARCHIVE.replace(/^\| Changed files \|.*$\n/m, '');
    const genuinelyZero = FULL_ARCHIVE.replace('| Changed files | 9 |', '| Changed files | 0 |');
    const mutant = (body: string): number => parseArchive(body).changedFiles ?? 0;

    expect(mutant(missing)).toBe(mutant(genuinelyZero)); // collapsed
    expect(parseArchive(missing).changedFiles)
      .not.toBe(parseArchive(genuinelyZero).changedFiles); // still distinct
  });

  test('a tie-break that kept the LAST (oldest) commit would be caught', () => {
    const raw = [
      '__C__newest\tfeat: the real merge (#123)',
      'new/one.ts',
      '',
      '__C__older\trevert: an older commit mentioning (#123)',
      'old/should-not-appear.ts',
      '',
    ].join('\n');
    // The mutant: overwrite on every occurrence instead of keeping the first.
    const lastWins = (r: string): Map<number, string[]> => {
      const out = new Map<number, string[]>();
      let cur: number | null = null;
      for (const line of r.split('\n')) {
        if (line.startsWith('__C__')) {
          const m = /\(#(\d+)\)\s*$/.exec(line.slice(line.indexOf('\t') + 1));
          cur = m ? Number(m[1]) : null;
          if (cur !== null) out.set(cur, []); // <- the defect: unconditional reset
        } else if (line.length > 0 && cur !== null) out.get(cur)!.push(line);
      }
      return out;
    };
    expect(lastWins(raw).get(123)).toEqual(['old/should-not-appear.ts']);
    expect(parseGitLog(raw).get(123)).toEqual(['new/one.ts']);
    expect(parseGitLog(raw).get(123)).not.toEqual(lastWins(raw).get(123));
  });

  test('a parser that let orphan files fall through to the previous PR would be caught', () => {
    // The mutant leaves `cur` alone when a commit has no PR marker, so the
    // orphan commit's files are attributed to the previous PR — which is how
    // one PR's diff, and therefore its measured AREA, becomes another's.
    const sticky = (r: string): Map<number, string[]> => {
      const out = new Map<number, string[]>();
      let cur: number | null = null;
      for (const line of r.split('\n')) {
        if (line.startsWith('__C__')) {
          const m = /\(#(\d+)\)\s*$/.exec(line.slice(line.indexOf('\t') + 1));
          if (m) { cur = Number(m[1]); if (!out.has(cur)) out.set(cur, []); }
          // <- the defect: no `else cur = null`
        } else if (line.length > 0 && cur !== null) out.get(cur)!.push(line);
      }
      return out;
    };
    expect(sticky(GIT_LOG).get(123)).toContain('src/orphan.ts');
    expect(parseGitLog(GIT_LOG).get(123)).not.toContain('src/orphan.ts');
  });
});
