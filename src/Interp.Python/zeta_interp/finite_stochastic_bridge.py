"""Independent Fraction/superoperator replay of a fixed classical-channel contract.

This checks finite exact arithmetic, not arbitrary amplification positivity.
The reference and native implementation share an author; review is separate.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import subprocess
import sys
import uuid
from fractions import Fraction as F
from itertools import product
from pathlib import Path

TASK = "081M1WDDB6M087G0R002KN8DWQ"
ARCHIVE = f"refs/tags/archive/experiments/{TASK}"
CONTRACT_ARCHIVE = ARCHIVE + "-contract"
PROTOCOL = "docs/research/2026-09-06-finite-stochastic-cqm-bridge-protocol.md"
SOURCE_FILES = (
    PROTOCOL,
    "src/Core/WSet.fs",
    "src/Core/ProbabilitySemiring.fs",
    "src/Core.Abstractions/ISemiring.cs",
    "src/Core.Abstractions/IRing.cs",
    "src/Research.FSharp/FiniteStochasticBridge.fs",
    "src/Research.FSharp/run-finite-stochastic-bridge.fsx",
    "src/Interp.Python/zeta_interp/finite_stochastic_bridge.py",
)
ROSTER = (
    ("stochastic admission", 9),
    ("WSet propagation/discard", 27),
    ("commutative identity", 6),
    ("composition", 81),
    ("associativity", 729),
    ("tensor", 81),
    ("CP/TP certificates", 9),
    ("dephasing sandwich/identity", 9),
    ("rectangular composition", 1),
    ("naive quantum identity refusal", 1),
    ("signed normalized refusal", 1),
    ("positive but not CP", 1),
    ("dagger nonclosure", 1),
    ("additive nonclosure", 1),
)


def mat(values):
    return tuple(tuple(F(x) for x in row) for row in values)


def eye(n):
    return mat([[int(r == c) for c in range(n)] for r in range(n)])


def unit(n, r, c):
    return mat([[int(i == r and j == c) for j in range(n)] for i in range(n)])


def col(values):
    return mat([[x] for x in values])


def diagonal(values):
    return mat(
        [[x if r == c else 0 for c in range(len(values))] for r, x in enumerate(values)]
    )


def tr(a):
    return tuple(zip(*a, strict=True))


def mul(a, b):
    return tuple(
        tuple(sum(x * y for x, y in zip(row, column, strict=True)) for column in tr(b))
        for row in a
    )


def kron(a, b):
    return tuple(
        tuple(x * y for x in row_a for y in row_b) for row_a in a for row_b in b
    )


def superoperator(s):
    """Dense linear map on row-major vectorized full matrix algebras."""
    m, n = len(s), len(s[0])
    return mat(
        [
            [
                s[r // m][c // n] if r // m == r % m and c // n == c % n else 0
                for c in range(n * n)
            ]
            for r in range(m * m)
        ]
    )


def unvec(v, n):
    return tuple(tuple(v[r * n + c][0] for c in range(n)) for r in range(n))


def apply_e(s, rho):
    return unvec(mul(superoperator(s), col([x for row in rho for x in row])), len(s))


def images(s):
    n = len(s[0])
    return [apply_e(s, unit(n, r, c)) for r, c in product(range(n), repeat=2)]


def choi(s):
    # Independently reshape the superoperator, not the native sparse E_ab loop.
    e = superoperator(s)
    n, m = len(s[0]), len(s)
    return tuple(
        tuple(e[j * m + k][r * n + c] for c in range(n) for k in range(m))
        for r in range(n)
        for j in range(m)
    )


def partial_trace(j, n, m):
    return tuple(
        tuple(sum(j[r * m + k][c * m + k] for k in range(m)) for c in range(n))
        for r in range(n)
    )


def nonnegative(m):
    return all(x >= 0 for row in m for x in row)


def stochastic(m):
    return nonnegative(m) and all(sum(c) == 1 for c in tr(m))


def rational(x):
    x = F(x)
    return f"{x.numerator}/{x.denominator}"


def text(m):
    return f"{len(m)}x{len(m[0])}:" + ",".join(rational(x) for row in m for x in row)


def boolean(x):
    return "true" if x else "false"


def case(label, left, right):
    return {"Id": label, "Left": left, "Right": right, "Passed": left == right}


def check(name, cases):
    return {"Name": name, "Cases": cases, "Passed": all(row["Passed"] for row in cases)}


def reference():
    """Evaluate the registered finite roster using arbitrary-precision Fractions."""
    half = F(1, 2)
    maps = [mat([[a, b], [1 - a, 1 - b]]) for a, b in product((0, half, 1), repeat=2)]
    identity = eye(2)
    plus = mat([[half, half], [half, half]])
    states = [col([1, 0]), col([0, 1]), col([half, half])]
    rows = [
        check(
            "stochastic admission",
            [
                case(str(i), [boolean(stochastic(s))], ["true"])
                for i, s in enumerate(maps)
            ],
        )
    ]
    cases = []
    for i, s in enumerate(maps):
        for j, state in enumerate(states):
            image = mul(s, state)
            cases.append(
                case(
                    f"{i},{j}",
                    [text(image), rational(sum(x[0] for x in image))],
                    [text(image), "1/1"],
                )
            )
    rows.append(check("WSet propagation/discard", cases))
    rows.append(
        check(
            "commutative identity",
            [
                case(
                    f"{n},{i}",
                    [text(apply_e(eye(n), unit(n, i, i)))],
                    [text(unit(n, i, i))],
                )
                for n in (1, 2, 3)
                for i in range(n)
            ],
        )
    )
    cases = []
    for i, s in enumerate(maps):
        for j, t in enumerate(maps):
            left = [mul(t, mul(s, state)) for state in states[:2]] + [
                apply_e(t, rho) for rho in images(s)
            ]
            right = [mul(mul(t, s), state) for state in states[:2]] + images(mul(t, s))
            cases.append(
                case(f"{i},{j}", list(map(text, left)), list(map(text, right)))
            )
    rows.append(check("composition", cases))
    rows.append(
        check(
            "associativity",
            [
                case(
                    f"{i},{j},{k}",
                    [text(mul(mul(maps[k], maps[j]), maps[i]))],
                    [text(mul(maps[k], mul(maps[j], maps[i])))],
                )
                for i, j, k in product(range(9), repeat=3)
            ],
        )
    )
    cases = []
    for i, s in enumerate(maps):
        for j, t in enumerate(maps):
            left = images(kron(s, t))
            right = [
                kron(
                    apply_e(s, unit(2, r // 2, c // 2)),
                    apply_e(t, unit(2, r % 2, c % 2)),
                )
                for r, c in product(range(4), repeat=2)
            ]
            cases.append(
                case(f"{i},{j}", list(map(text, left)), list(map(text, right)))
            )
    rows.append(check("tensor", cases))
    cases = []
    for i, s in enumerate(maps):
        j = choi(s)
        certificate = diagonal([s[r % 2][r // 2] for r in range(4)])
        cases.append(
            case(
                str(i),
                [text(j), boolean(nonnegative(j)), text(partial_trace(j, 2, 2))],
                [text(certificate), "true", text(identity)],
            )
        )
    rows.append(check("CP/TP certificates", cases))
    cases = []
    for i, s in enumerate(maps):
        own, delta = images(s), images(identity)
        left = (
            [apply_e(identity, rho) for rho in own]
            + [apply_e(s, rho) for rho in delta]
            + [apply_e(identity, apply_e(s, rho)) for rho in delta]
            + [apply_e(identity, rho) for rho in delta]
        )
        cases.append(
            case(str(i), list(map(text, left)), list(map(text, own * 3 + delta)))
        )
    rows.append(check("dephasing sandwich/identity", cases))
    u = col([F(1, 3), F(2, 3)])
    a = mat([[half, 0], [half, F(1, 3)], [0, F(2, 3)]])
    b = mat([[1, 0, half], [0, 1, half]])
    result = mul(b, mul(a, u))
    quantum = apply_e(b, apply_e(a, diagonal([x[0] for x in u])))
    rows.append(
        check(
            "rectangular composition",
            [
                case(
                    "B,A,u",
                    list(map(text, [result, result, quantum, mul(mul(b, a), u)])),
                    list(
                        map(
                            text,
                            [
                                col([F(7, 18), F(11, 18)]),
                                result,
                                diagonal([x[0] for x in result]),
                                result,
                            ],
                        )
                    ),
                )
            ],
        )
    )
    dephased = apply_e(identity, plus)
    rows.append(
        check(
            "naive quantum identity refusal",
            [
                case(
                    "rho-plus",
                    [
                        text(dephased),
                        boolean(dephased == plus),
                        rational(plus[0][1] - dephased[0][1]),
                    ],
                    [text(diagonal([half, half])), "false", "1/2"],
                )
            ],
        )
    )
    signed = mat([[2, 0], [-1, 1]])
    signed_choi = choi(signed)
    rows.append(
        check(
            "signed normalized refusal",
            [
                case(
                    "standard-cone",
                    [
                        text(mul(signed, states[0])),
                        boolean(stochastic(signed)),
                        rational(signed_choi[1][1]),
                        text(partial_trace(signed_choi, 2, 2)),
                    ],
                    [text(col([2, -1])), "false", "-1/1", text(identity)],
                )
            ],
        )
    )
    # Apply I tensor transpose to each Bell basis term, separately from native indexing.
    pt = mat([[0] * 4 for _ in range(4)])
    for r, c in product(range(2), repeat=2):
        term = kron(unit(2, r, c), tr(unit(2, r, c)))
        pt = tuple(
            tuple(x + half * y for x, y in zip(rx, ry, strict=True))
            for rx, ry in zip(pt, term, strict=True)
        )
    v = col([0, 1, -1, 0])
    samples = [unit(2, 0, 0), unit(2, 1, 1), plus]
    rows.append(
        check(
            "positive but not CP",
            [
                case(
                    "Bell-partial-transpose",
                    list(map(text, map(tr, samples)))
                    + [text(pt), text(mul(tr(v), mul(pt, v)))],
                    list(map(text, samples))
                    + [
                        "4x4:1/2,0/1,0/1,0/1,0/1,0/1,1/2,0/1,0/1,1/2,0/1,0/1,0/1,0/1,0/1,1/2",
                        "1x1:-1/1",
                    ],
                )
            ],
        )
    )
    reset = mat([[1, 1], [0, 0]])
    rows.append(
        check(
            "dagger nonclosure",
            [
                case(
                    "reset-transpose",
                    [
                        boolean(stochastic(reset)),
                        boolean(stochastic(tr(reset))),
                        text(col(map(sum, reset))),
                    ],
                    ["true", "false", "2x1:2/1,0/1"],
                )
            ],
        )
    )
    doubled = mat([[2, 0], [0, 2]])
    rows.append(
        check(
            "additive nonclosure",
            [
                case(
                    "identity-plus-identity",
                    [
                        boolean(nonnegative(doubled)),
                        boolean(stochastic(doubled)),
                        text(doubled),
                    ],
                    ["true", "false", "2x2:2/1,0/1,0/1,2/1"],
                )
            ],
        )
    )
    complete = all(row["Passed"] for row in rows)
    return {
        "Version": 1,
        "Complete": complete,
        "Failure": "" if complete else "independent finite comparison failure",
        "MatrixRoster": list(map(text, maps)),
        "Checks": rows,
    }


def digest(raw):
    return hashlib.sha256(raw).hexdigest().upper()


def git(root, *arguments):
    return subprocess.run(
        ["git", "-C", str(root), *arguments], check=True, capture_output=True
    ).stdout


def source_admission(root):
    commit = git(root, "rev-parse", "--verify", ARCHIVE + "^{commit}").decode().strip()
    contract = (
        git(root, "rev-parse", "--verify", CONTRACT_ARCHIVE + "^{commit}")
        .decode()
        .strip()
    )
    git(root, "merge-base", "--is-ancestor", contract, commit)
    files = []
    for path in SOURCE_FILES:
        raw = (root / path).read_bytes()
        if raw != git(root, "show", f"{commit}:{path}"):
            raise ValueError(f"unarchived source bytes: {path}")
        files.append({"File": path, "Sha256": digest(raw)})
    if git(root, "show", f"{contract}:{PROTOCOL}") != (root / PROTOCOL).read_bytes():
        raise ValueError("contract bytes differ from the immutable contract archive")
    return {
        "SourceCommit": commit,
        "SourceArchive": ARCHIVE,
        "ContractCommit": contract,
        "ProtocolSha256": files[0]["Sha256"],
        "SourceHashes": files,
    }


def strict_equal(actual, expected):
    """JSON booleans must not silently compare equal to integer 0/1."""
    if type(actual) is not type(expected):
        return False
    if isinstance(expected, dict):
        return actual.keys() == expected.keys() and all(
            strict_equal(actual[k], v) for k, v in expected.items()
        )
    if isinstance(expected, list):
        return len(actual) == len(expected) and all(
            strict_equal(a, b) for a, b in zip(actual, expected, strict=True)
        )
    return actual == expected


def decode(raw):
    def pairs(entries):
        result = {}
        for key, value in entries:
            if key in result:
                raise ValueError(f"duplicate JSON key: {key}")
            result[key] = value
        return result

    def invalid_constant(value):
        raise ValueError(f"nonfinite JSON constant: {value}")

    return json.loads(raw, object_pairs_hook=pairs, parse_constant=invalid_constant)


def output_bounds(report):
    coefficients = []
    entries = report["MatrixRoster"] + [
        entry
        for row in report["Checks"]
        for case_row in row["Cases"]
        for entry in case_row["Left"] + case_row["Right"]
    ]
    for entry in entries:
        if "/" in entry:
            coefficients.extend(F(value) for value in entry.split(":")[-1].split(","))
    return {
        "MaximumAbsoluteNumerator": max(abs(q.numerator) for q in coefficients),
        "MaximumDenominator": max(q.denominator for q in coefficients),
    }


def verify(native, provenance):
    if set(native) != {
        "Complete",
        "Failure",
        "Protocol",
        "Provenance",
        "Runtime",
        "OperatingSystem",
        "LoadedAssemblies",
        "Report",
    }:
        raise ValueError("native envelope fields differ")
    if native["Complete"] is not True or native["Failure"] != {
        "Stage": "",
        "Detail": "",
    }:
        raise ValueError("incomplete native attempt")
    if native["Protocol"] != "finite-stochastic-cqm-bridge-v1" or not strict_equal(
        native["Provenance"], provenance
    ):
        raise ValueError("native protocol/source admission differs")
    if not all(
        isinstance(native[k], str) and native[k] for k in ("Runtime", "OperatingSystem")
    ):
        raise ValueError("missing native runtime metadata")
    assemblies = native["LoadedAssemblies"]
    if not isinstance(assemblies, list) or [a["Name"] for a in assemblies] != [
        "Zeta.Core",
        "Zeta.Core.Abstractions",
    ]:
        raise ValueError("wrong native loaded assembly roster")
    for assembly in assemblies:
        if (
            set(assembly) != {"Name", "Mvid", "Sha256"}
            or not isinstance(assembly["Mvid"], str)
            or str(uuid.UUID(assembly["Mvid"])) != assembly["Mvid"]
            or not isinstance(assembly["Sha256"], str)
            or len(assembly["Sha256"]) != 64
            or any(c not in "0123456789ABCDEF" for c in assembly["Sha256"])
        ):
            raise ValueError("invalid native loaded assembly fingerprint")
    report = native["Report"]
    if set(report) != {
        "Version",
        "Complete",
        "Failure",
        "MatrixRoster",
        "Checks",
        "Arithmetic",
    }:
        raise ValueError("native report fields differ")
    bounds = report["Arithmetic"]
    if set(bounds) != {
        "OperandLimit",
        "MaximumAbsoluteNumerator",
        "MaximumDenominator",
        "Refusals",
    } or any(type(v) is not int for v in bounds.values()):
        raise ValueError("invalid native arithmetic counter fields")
    if (
        bounds["OperandLimit"] != 1000000
        or bounds["Refusals"] != 0
        or not 1 <= bounds["MaximumAbsoluteNumerator"] <= 1000000
        or not 1 <= bounds["MaximumDenominator"] <= 1000000
    ):
        raise ValueError("native bounded arithmetic refusal")
    expected = reference()
    if [(r["Name"], len(r["Cases"])) for r in expected["Checks"]] != list(
        ROSTER
    ) or not expected["Complete"]:
        raise ValueError("independent reference failed its fixed roster")
    common = {k: v for k, v in report.items() if k != "Arithmetic"}
    if not strict_equal(common, expected):
        raise ValueError(
            "native finite case evidence differs from independent exact replay"
        )
    visible_bounds = output_bounds(expected)
    if any(bounds[key] < value for key, value in visible_bounds.items()):
        raise ValueError("native arithmetic peak understates retained coefficients")
    return {
        "Complete": True,
        "Passed": True,
        "Checks": len(ROSTER),
        "Cases": sum(count for _, count in ROSTER),
        "Arithmetic": "Python fractions.Fraction; arbitrary precision",
        "Independence": "different algorithm/arithmetic; shared author; separate reviewer",
        "NativeArithmetic": bounds,
        "RetainedCoefficientBounds": visible_bounds,
        "ArithmeticCrosscheck": "retained coefficient lower bounds and guarded operand ceiling; no replay of native operation order",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    partial = args.output.with_name(args.output.name + ".partial")
    if args.output.exists() or partial.exists():
        parser.error("refusing to overwrite an existing output")
    result = {
        "Protocol": "finite-stochastic-cqm-bridge-replay-v1",
        "InputSha256": "",
        "Runtime": sys.version,
        "OperatingSystem": platform.platform(),
        "Complete": False,
        "Passed": False,
        "Failure": {"Stage": "", "Detail": ""},
    }
    stage = "source-admission"
    try:
        result["ExecutingSourceSha256"] = digest(Path(__file__).read_bytes())
        if Path(__file__).resolve() != (root / SOURCE_FILES[-1]).resolve():
            raise ValueError(
                "executing reference is not the admitted canonical source file"
            )
        provenance = source_admission(root)
        result["Provenance"] = provenance
        stage = "input-read"
        raw = args.input.read_bytes()
        result["InputSha256"] = digest(raw)
        stage = "input-decode"
        native = decode(raw)
        stage = "independent-replay"
        result.update(verify(native, provenance))
    except (
        ValueError,
        TypeError,
        KeyError,
        OSError,
        subprocess.CalledProcessError,
    ) as error:
        result["Failure"] = {"Stage": stage, "Detail": str(error)}
    with partial.open("x", encoding="utf-8") as handle:
        json.dump(result, handle, indent=2)
        handle.write("\n")
    # Atomic hard-link publication refuses an existing destination.
    args.output.hardlink_to(partial)
    partial.unlink()
    return 0 if result["Passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
