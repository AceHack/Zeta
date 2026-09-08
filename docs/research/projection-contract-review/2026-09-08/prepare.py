"""Hash existing source and retain reviewed contract text; no numeric execution."""

import gzip
import hashlib
import json
import pathlib
import subprocess
import zlib

OUT = pathlib.Path(__file__).resolve().parent
IDENTITY = pathlib.Path('/Users/acehack/.zeta/agents/codex/Zeta-relational-identity-20260906')
ROOT = pathlib.Path('/Users/acehack/.zeta/agents/codex/Zeta-rendered-catch-reference-20260906')
CONTRACT = 'docs/research/2026-09-08-precision-gate-projection-proposed-contract.md'
VERSIONS = (
    ('original', 'ad6eab9892299cbc18c93e9597773e0b1485680c', 32995,
     'ec3d4953516ac41b69cb75eb3998ebaef042729fccb14af8c5780d447a7a3eb7'),
    ('observations-context', '9a950c2dcf9fa0a260e7e2e20f72de242c92a611', 37601,
     '57b626190aaf5ccf33f978fd5fd45766146d2048000ab7a1a2fc77510d8ea402'),
    ('final-exact-width', '1bf71bbac7f6896216c7079abd4e99b7c79e2870', 38142,
     '537054779bf9e0bfa9271b5cc56116fbc80b16c4a2be9f1b5e3c022fe95a0f8e'),
)
DEPENDENCIES = (
    (IDENTITY, VERSIONS[0][1], 'src/Interp.Python/zeta_interp/hidden_switch_compiled_ieee.py',
     7559, '702a5e6e6bd330cb4d27dd3c3bddbbeba779ea8d6127249efd7e9ecbfa54d8c4'),
    (IDENTITY, '9e6be94a0ec2b153ba63e100463f91418ceed4fe',
     'src/Interp.Python/zeta_interp/precision_gate_kernels_reference.py',
     20245, '91f71726c610364f5adf835fff08adb1353ab6f8ba9beaa6a68387cd55ac8258'),
    (ROOT, '7100eefea413c1dd34b899fd1b7ba639494568b7',
     'src/Bayesian/PrecisionGateKernels.fs',
     17206, '4004196cb0ade8527dfebf83fbb3e6e42bd36208e38affd09906787a84901c02'),
)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def blob(repo, commit, path):
    return subprocess.run(['git', 'show', commit + ':' + path], cwd=repo,
                          capture_output=True, timeout=30, check=True).stdout


def checked(raw, size, digest):
    assert len(raw) == size and sha(raw) == digest
    return raw


records = []
for name, commit, size, digest in VERSIONS:
    raw = checked(blob(IDENTITY, commit, CONTRACT), size, digest)
    stored = gzip.compress(raw, mtime=0)
    filename = name + '.md.gz'
    with (OUT / filename).open('xb') as stream:
        stream.write(stored)
    decoder = zlib.decompressobj(31)
    assert decoder.decompress(stored) + decoder.flush() == raw
    assert decoder.eof and not decoder.unused_data
    records.append({'File': filename, 'Commit': commit, 'Path': CONTRACT,
                    'OriginalBytes': size, 'OriginalSha256': digest,
                    'StoredBytes': len(stored), 'StoredSha256': sha(stored)})

dependencies = []
for repo, commit, path, size, digest in DEPENDENCIES:
    checked(blob(repo, commit, path), size, digest)
    dependencies.append({'Repository': str(repo), 'Commit': commit, 'Path': path,
                         'Bytes': size, 'Sha256': digest})

existing = IDENTITY / 'docs/research/precision-gate-kernels-reference-validation/2026-09-08/reference-vectors.json'
raw = checked(existing.read_bytes(), 21985,
              'ecab012f7084e17097594faabd2ee49ec7a76aa1da8a1fa4f2204ab8df841489')
cstar = json.loads(raw)['Rows'][16]['Input']['c']
assert cstar == '0.77880078307140486824517026697832064729677229042614147424131736626824561205351924'
source = pathlib.Path(__file__).read_bytes()
manifest = {
    'OperationalStatus': 'research-grade',
    'Scope': 'Existing byte/source checks only; no solver, objective, case generator or vector execution',
    'Records': records,
    'OriginalBytes': sum(row['OriginalBytes'] for row in records),
    'StoredBytes': sum(row['StoredBytes'] for row in records),
    'DependencyIdentities': dependencies,
    'ExistingCoefficient': {'Path': str(existing), 'Bytes': len(raw), 'Sha256': sha(raw),
                            'Field': '$.Rows[16].Input.c', 'ExactString': cstar},
    'PreparationSource': {'File': 'prepare.py', 'Bytes': len(source), 'Sha256': sha(source)},
}
with (OUT / 'manifest.json').open('xb') as stream:
    stream.write((json.dumps(manifest, indent=2) + '\n').encode())
print(json.dumps({'Records': len(records), 'OriginalBytes': manifest['OriginalBytes'],
                  'StoredBytes': manifest['StoredBytes'], 'DependencyIdentities': len(dependencies),
                  'ExistingCoefficientMatched': True}))
