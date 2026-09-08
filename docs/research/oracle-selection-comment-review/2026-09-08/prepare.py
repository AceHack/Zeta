"""Read-only source census and comment-only patch preparation; no source execution."""
import difflib
import gzip
import hashlib
import json
from pathlib import Path
import subprocess

BASE = '6544c068ea0a9bba4a5a55e391c9cddcb7bc8daa'
OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[3]
PATHS = [
    'docs/governance/MANIFESTO.md', 'docs/ALIGNMENT.md',
    'db/morals/README.md', 'db/morals/grey/README.md',
    'src/Core/SimVerb.fs', 'tests/Tests.FSharp/SimVerb.Tests.fs',
    'src/Core.TypeScript/planning/empowerment-bound.ts',
    'src/Core.TypeScript/planning/empowerment-bound.test.ts',
    'src/Core.TypeScript/observe/run-loop-real.ts',
    'src/Core.TypeScript/observe/participant.ts',
    'src/Core.TypeScript/observe/chooser.ts',
    'src/Core/OracleTransport.fs',
    'src/Core.TypeScript/workflow-engine/consensus.ts',
    'src/Core.TypeScript/hygiene/audit-hidden-oracles.ts',
    'src/Core.Lean4/Safety/ChildFloorPolicy.lean',
    'src/Core.TypeScript/moral-gym/gym.ts',
    'src/Core/Tsirelson.fs', 'src/Core/FeedbackThrottle.fs',
    'tests/Tests.FSharp/Tsirelson.Tests.fs',
]


def identity(raw):
    return {'Bytes': len(raw), 'Sha256': hashlib.sha256(raw).hexdigest()}


def command(args, allowed=(0,)):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, timeout=30)
    if result.returncode not in allowed:
        raise RuntimeError((args, result.returncode, result.stderr))
    if len(result.stdout) > 2 * 1024 * 1024 or len(result.stderr) > 65536:
        raise ValueError('bounded command output exceeded')
    return result


def main():
    rows = []
    sources = {}
    for path in PATHS:
        r = command(['git', 'show', BASE + ':' + path])
        sources[path] = r.stdout
        rows.append({'Path': path, **identity(r.stdout)})
    observations = []
    for pattern in ['empowermentBound', 'SimVerb.withOracle', 'defaultResolutionOracle', 'MoralOracle', 'moralOracle', 'selectedOracle', 'OracleSet']:
        argv = ['git', 'grep', '-n', '-F', pattern, BASE, '--', 'src', 'tools', 'demo', 'tests']
        r = command(argv, (0, 1))
        observations.append({'Argv': argv, 'ExitCode': r.returncode, 'Stdout': r.stdout.decode(), 'Stderr': r.stderr.decode()})
    replacements = {
        'src/Core/Tsirelson.fs': (
            '/// is the exact operator whose +1 eigenspace carries saturation.',
            '/// is the exact operator whose -1 eigenspace carries saturation (C² = 4·I - 4·Ω).'
        ),
        'src/Core/FeedbackThrottle.fs': (
            '    /// The correlation regime a channel of this `latency` sits in (given the model\'s attenuation):\n'
            '    /// **Classical** (`maxChsh ≤ 2`, e.g. git-over-commits — high latency), **Quantum** (`2 < maxChsh ≤ 2√2`,\n'
            '    /// the physical no-signalling band), **Signalling** (`maxChsh > 2√2`, super-quantum / PR-box — the channel\n'
            '    /// is effectively communicating). The honest read of a measured S: which band the channel\'s speed allows.',
            '    /// Numeric bands of this latency model, with the comparison tolerances in `regimeOf`:\n'
            '    /// **Classical** near 2, **Quantum** between 2 and 2√2, and the existing **Signalling** case\n'
            '    /// above 2√2. These names label the chosen attenuation model; they are not signalling tests.\n'
            '    /// PR-box correlations are non-signalling and attain CHSH 4; exceeding 2√2 alone does not\n'
            '    /// establish communication. See Popescu and Rohrlich, https://arxiv.org/abs/quant-ph/9508009.'
        ),
    }
    patches = []
    proposed = []
    records = []
    def retain(name, raw):
        stored = gzip.compress(raw, mtime=0)
        with (OUT / (name + '.gz')).open('xb') as stream:
            stream.write(stored)
        records.append({'File': name + '.gz', 'Original': identity(raw), 'Stored': identity(stored)})
    for path, (old, new) in replacements.items():
        before = sources[path]
        text = before.decode()
        assert text.count(old) == 1
        after = text.replace(old, new).encode()
        # All changed spans above are manually inspected standalone documentation comments.
        def without_doc(raw):
            return b''.join(line for line in raw.splitlines(keepends=True) if not line.lstrip().startswith(b'///'))
        assert without_doc(before) == without_doc(after)
        patch = ''.join(difflib.unified_diff(text.splitlines(keepends=True), after.decode().splitlines(keepends=True), fromfile='a/' + path, tofile='b/' + path)).encode()
        patches.append(patch)
        proposed.append({'Path': path, 'Before': identity(before), 'After': identity(after), 'OtherLines': identity(without_doc(before)), 'AllNonDocumentationLinesIdentical': True})
        leaf = path.rsplit('/', 1)[1]
        retain(leaf + '.before', before)
        retain(leaf + '.proposed', after)
    retain('comment-only.patch', b''.join(patches))
    result = {'BaseCommit': BASE, 'SourceCensus': rows, 'CallerSearches': observations, 'ProposedComments': proposed, 'SourceOrTestExecution': False, 'SourceFilesModified': False, 'OraclePolicyChanged': False}
    retain('result.json', (json.dumps(result, indent=2) + '\n').encode())
    manifest = {'PreparationSource': identity(Path(__file__).read_bytes()), 'Records': records}
    with (OUT / 'manifest.json').open('x') as stream:
        json.dump(manifest, stream, indent=2)
        stream.write('\n')
    print(json.dumps({'Records': len(records), 'CensusPaths': len(rows), 'CommentPatch': identity(b''.join(patches))}, indent=2))


if __name__ == '__main__':
    main()
