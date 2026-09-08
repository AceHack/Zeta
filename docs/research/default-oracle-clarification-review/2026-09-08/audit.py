"""Read exact Git versions; prove one additive paragraph and unchanged bytes."""

import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path('/Users/acehack/.zeta/agents/codex/Zeta-rendered-catch-reference-20260906')
COMMIT = 'ac9ec57908cc15ada4412329b29dbf487b1b656d'
PATH = 'docs/governance/MANIFESTO.md'


def git(*args):
    return subprocess.run(['git', *args], cwd=ROOT, capture_output=True,
                          check=True, timeout=30).stdout


def identity(raw):
    return {'Bytes': len(raw), 'Sha256': hashlib.sha256(raw).hexdigest()}


before = git('show', COMMIT + '^:' + PATH)
after = git('show', COMMIT + ':' + PATH)
start = after.index(b'**2026-09-08 maintainer clarification (additive; original text above retained):**\n')
end = after.index(b'### 12. Idempotency\n', start)
addition = after[start:end]
assert after[:start] + after[end:] == before
assert len(addition.splitlines()) == 9
old_section = before[before.index(b'### 11. Default Moral Regard'):before.index(b'### 12. Idempotency')]
assert old_section == after[after.index(b'### 11. Default Moral Regard'):start]
assert git('ls-tree', COMMIT + '^', '--', PATH).split()[0] == git('ls-tree', COMMIT, '--', PATH).split()[0]
changes = git('diff', '--name-status', '--no-renames', COMMIT + '^', COMMIT).decode().splitlines()
assert changes == [
    'M\tdocs/governance/MANIFESTO.md',
    'A\tdocs/research/2026-09-08-default-oracle-disclosure-clarification.md',
    'M\tdocs/research/2026-09-08-hc8-default-oracle-explanation-correction.md',
]
assert git('diff', COMMIT + '^', COMMIT, '--', 'src', 'tests', 'bench', 'docs/ALIGNMENT.md') == b''
print(json.dumps({'Commit': COMMIT, 'Before': identity(before), 'After': identity(after),
                  'OriginalSection11': identity(old_section), 'Addition': identity(addition),
                  'AdditionText': addition.decode(), 'AddedLines': 9,
                  'RemovingExactAdditionRestoresWholeOriginalFile': True,
                  'OriginalSection11Identical': True, 'FileModeUnchanged': True,
                  'ChangedPaths': changes, 'NoExecutableOrAlignmentChanges': True}, indent=2))
