"""Compare static roster and retained executed source copies; no imports."""
import ast
import gzip
import hashlib
import json
from pathlib import Path
import subprocess

REPO = Path('/Users/acehack/.zeta/agents/codex/Zeta-relational-identity-20260906')
OLD = '1f4db4b7ad2953648a37a38d0613bb99fc7d0633'
NEW = '53cf6cdaa75f9dcb1ab1de2c48144685fdc286d5'
BASE = 'docs/research/precision-gate-projection/2026-09-08/'
SOURCE = 'src/Interp.Python/zeta_interp/precision_gate_projection_driver.py'
TEST = 'src/Interp.Python/tests/test_precision_gate_projection_driver.py'


def blob(pin, name):
    return subprocess.check_output(['git', '-C', str(REPO), 'show', pin + ':' + name])


def raw(folder, name):
    return gzip.decompress(blob(NEW, BASE + folder + '/' + name))


source = blob(OLD, SOURCE)
assert source == blob(NEW, SOURCE)
roster = next(ast.literal_eval(node.value) for node in ast.parse(source).body
              if isinstance(node, ast.Assign)
              and any(isinstance(t, ast.Name) and t.id == 'SOURCE_PATHS' for t in node.targets))
assert list(roster) == json.loads(blob(OLD, BASE + 'driver-source-validation/source-roster.json'))['SourceFiles']
folder = 'driver-link-resolution-validation'
assert source == raw(folder, '001-source.py.gz') == raw(folder, '027-source.py.gz')
assert blob(NEW, TEST) == raw(folder, '028-test.py.gz')
transient = raw(folder, '015-source.py.gz')
assert transient != source and b'InnerStoreRelativeRoot' in transient
assert b'InnerStoreRelativeRoot' not in source
assert b'2 failed' in raw(folder, '003-stdout.gz')
assert b'2 failed, 57 passed' in raw(folder, '011-pytest.stdout.gz')
assert b'FileNotFoundError' in raw(folder, '011-pytest.stdout.gz')
assert b'59 passed in 4.84s' in raw(folder, '023-pytest.stdout.gz')
assert b'all 16 executed check(s) passed' in raw(folder, '035-push.stdout.gz')
assert OLD.encode() in raw(folder, '037-remote.stdout.gz')
commands = json.loads(raw(folder, '017-commands.json.gz'))
assert len(commands) == 4 and all(row['ExitCode'] == 0 for row in commands)
print(json.dumps({
    'OriginalSource': OLD, 'FinalTestsEvidence': NEW, 'DriverSourceUnchanged': True,
    'DriverBytes': len(source), 'DriverSha256': hashlib.sha256(source).hexdigest().upper(),
    'MachineReadableRosterMatches47Paths': True,
    'BothOriginalAndFinalExecutedSourceMatch': True,
    'TransientWithdrawnSourcePreserved': True,
    'FinalTestSourceMatches': True,
    'FirstMistakenFixtureFailures': 2, 'SecondMistakenFixtureFailures': 2,
    'SecondOtherPasses': 57, 'FinalPasses': 59,
    'OriginalNormalPushAndRemoteProofMatch': True,
}, indent=2))
