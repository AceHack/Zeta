"""Fixed retained-data audit; imports neither reference nor native code."""

import ast
import gzip
import hashlib
import json
import subprocess
import sys
from decimal import Context, Decimal, localcontext
from fractions import Fraction as F
from pathlib import Path

PLAN = "3888d9a6b3e443f42320ff838f939ae483ecd2c8"
SOURCE = "9e6be94a0ec2b153ba63e100463f91418ceed4fe"
EVIDENCE = "138f55d46f02283be006a8f9b426b562c0875fc3"
BASE = Path("docs/research/precision-gate-kernels-reference-validation/2026-09-08")
VECTOR_HASH = "ecab012f7084e17097594faabd2ee49ec7a76aa1da8a1fa4f2204ab8df841489"


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def pairs(items):
    result = {}
    for key, value in items:
        assert key not in result, key
        result[key] = value
    return result


def forbidden(value):
    raise ValueError(f"non-reference JSON number: {value}")


def parse(raw):
    return json.loads(
        raw, object_pairs_hook=pairs, parse_float=forbidden, parse_constant=forbidden
    )


def exact(value):
    if type(value) is dict and set(value) == {"Num", "Den"}:
        assert type(value["Num"]) is str and type(value["Den"]) is str
        f = F(int(value["Num"]), int(value["Den"]))
        assert (str(f.numerator), str(f.denominator)) == (value["Num"], value["Den"])
        return f
    if type(value) is dict:
        return {key: exact(item) for key, item in value.items()}
    if type(value) is list:
        return [exact(item) for item in value]
    assert type(value) in (str, int, bool) or value is None
    return value


def g(eta, precision):
    return {"PrecisionMean": F(eta), "Precision": F(precision)}


def k(power, rate):
    return {"LogPower": F(power), "Rate": F(rate)}


def soft(residual, z, weight, feature):
    return {
        "ResidualSecondMoment": F(residual),
        "ToZ": z,
        "ToWeight": weight,
        "ToInput": feature,
        "ToTau": k(F(1, 2), F(residual) / 2),
    }


def d(value):
    if type(value) is F:
        return Decimal(value.numerator) / Decimal(value.denominator)
    result = Decimal(value)
    assert result.is_finite()
    return result


def main(repo):
    def git(commit, path):
        return subprocess.run(
            ["git", "show", f"{commit}:{path}"],
            cwd=repo,
            capture_output=True,
            check=True,
        ).stdout

    manifest_raw = (repo / BASE / "manifest.json").read_bytes()
    assert manifest_raw == git(EVIDENCE, BASE / "manifest.json")
    manifest = parse(manifest_raw)
    assert manifest["SourceCommit"] == SOURCE and manifest["PlanCommit"] == PLAN
    originals = {}
    stored_names = set()
    separate_originals = 0
    for row in manifest["Records"]:
        assert row["Original"] not in originals and row["Stored"] not in stored_names
        stored_names.add(row["Stored"])
        stored = (repo / BASE / row["Stored"]).read_bytes()
        assert stored == git(EVIDENCE, BASE / row["Stored"])
        assert (len(stored), sha(stored)) == (row["StoredBytes"], row["StoredSha256"])
        assert row["Encoding"] == "gzip"
        raw = gzip.decompress(stored)
        assert (len(raw), sha(raw)) == (row["OriginalBytes"], row["OriginalSha256"])
        originals[row["Original"]] = raw
        separate = repo / ".git" / row["Original"]
        if separate.is_file():
            assert separate.read_bytes() == raw
            separate_originals += 1
    assert len(originals) == 34 and separate_originals == 29
    assert stored_names == {
        str(p.relative_to(repo / BASE)) for p in (repo / BASE / "artifacts").iterdir()
    }
    assert originals["fixed-plan-3888d9a6b.md"] == git(
        PLAN, "docs/research/2026-09-08-precision-gate-kernels-reference.md"
    )
    source_pins = []
    for folder, name in (
        ("zeta_interp", "precision_gate_kernels_reference.py"),
        ("tests", "test_precision_gate_kernels_reference.py"),
    ):
        path = Path("src/Interp.Python") / folder / name
        raw = git(SOURCE, path)
        assert raw == (repo / path).read_bytes()
        assert raw == originals[f"precision-gate-reference-attempt-2/{name}.source"]
        source_pins.append({"Path": str(path), "Bytes": len(raw), "Sha256": sha(raw)})
    source = originals["precision-gate-vector-capture-1/source.py"]
    assert (
        source
        == originals[
            "precision-gate-reference-attempt-2/precision_gate_kernels_reference.py.source"
        ]
    )
    math_names = {
        "_soft_dot",
        "_normal",
        "_shape",
        "_gamma_rate",
        "_gaussian_combine",
        "_gaussian_moments",
        "_gamma_combine",
        "_gamma_moments",
        "_reverse",
        "_objective",
    }

    def math_ast(raw):
        return {
            n.name: ast.dump(n, include_attributes=False)
            for n in ast.parse(raw).body
            if isinstance(n, ast.FunctionDef) and n.name in math_names
        }

    first = originals[
        "precision-gate-reference-attempt-1/precision_gate_kernels_reference.py.source"
    ]
    assert math_ast(first) == math_ast(source) and len(math_ast(source)) == 10
    vector_raw = (repo / BASE / "reference-vectors.json").read_bytes()
    assert vector_raw == git(EVIDENCE, BASE / "reference-vectors.json")
    assert (len(vector_raw), sha(vector_raw)) == (21985, VECTOR_HASH)
    assert vector_raw == originals["precision-gate-vector-capture-1.stdout"]
    assert originals["precision-gate-vector-capture-1.stderr"] == b""
    vector = parse(vector_raw)
    returned_raw = originals["precision-gate-vector-capture-1/actual-return.json"]
    assert parse(returned_raw) == {"Kind": "success", "Value": vector}
    observed = parse(originals["precision-gate-vector-capture-1/observations.json"])
    assert (
        observed["SourceCommit"] == SOURCE and observed["SourceUnchangedAfter"] is True
    )
    assert observed["FullRuntimeClosureAdmitted"] is False
    assert observed["NativeComparisonPerformed"] is False
    assert (observed["SourceBytes"], observed["SourceSha256"]) == (
        len(source),
        sha(source),
    )
    assert (observed["ReturnBytes"], observed["ReturnSha256"]) == (
        len(returned_raw),
        sha(returned_raw),
    )
    for attempt, exits in ((1, [0, 1, 0, 1]), (2, [0, 0, 0, 0])):
        commands = parse(
            originals[f"precision-gate-reference-attempt-{attempt}/commands.json"]
        )
        assert [r["Name"] for r in commands] == ["pytest", "mypy", "ruff", "format"]
        assert [r["ExitCode"] for r in commands] == exits
    assert (
        b"76 passed in 4.43s"
        in originals["precision-gate-reference-attempt-1/pytest.stdout"]
    )
    assert (
        b"77 passed in 4.28s"
        in originals["precision-gate-reference-attempt-2/pytest.stdout"]
    )
    ids = [
        "soft/uncertain",
        "soft/clamped-zero",
        "soft/fractional",
        "normal/uncertain",
        "normal/zero",
        "gamma/rate",
        "gamma/product",
        "gamma/quotient",
        "gamma/proper",
        "gamma/improper",
        "gaussian/improper-product",
        "gaussian/linear-improper",
        "shape/small",
        "reverse/exp",
        "reverse/log",
        "reverse/signed",
        "objective/stationary",
        "objective/general",
        "invalid/negative-variance",
        "invalid/nonpositive-gamma",
        "invalid/proper-gaussian",
        "invalid/objective-variance",
        "shape/nonpositive",
        "gamma/neutral",
    ]
    assert set(vector) == {"Schema", "Arithmetic", "Rows"}
    assert vector["Schema"] == "zeta.precision-gate-kernels.reference.v1"
    assert vector["Arithmetic"] == {
        "Algebraic": "exact Fraction",
        "Binary64Emulator": False,
        "DecimalPrecision": 80,
        "Rounding": "ROUND_HALF_EVEN",
        "Transcendental": "Decimal",
    }
    assert [r["Id"] for r in vector["Rows"]] == ids
    rows = {r["Id"]: exact(r) for r in vector["Rows"]}
    for row in rows.values():
        assert set(row) == {"Id", "Operation", "Input", "Outcome"}
    tiny = F(1, 10**16)
    expected = {
        "soft/uncertain": soft(86, g(16, 2), g(56, 42), g(28, 14)),
        "soft/clamped-zero": soft(0, g(0, 2), g(0, 0), g(0, 8)),
        "soft/fractional": soft(
            F(1013, 420),
            g(F(-15, 8), F(5, 2)),
            g(F(15, 16), F(53, 8)),
            g(F(-5, 16), F(35, 24)),
        ),
        "normal/uncertain": {
            "ToY": g(F(-3, 2), F(3, 2)),
            "ToMean": g(F(9, 2), F(3, 2)),
            "ToPrecision": k(F(1, 2), F(23, 2)),
        },
        "normal/zero": {
            "ToY": g(6, 3),
            "ToMean": g(6, 3),
            "ToPrecision": k(F(1, 2), 0),
        },
        "gamma/rate": {
            "ToValue": k(1, 7),
            "ToRate": k(2, 3),
            "ValueEncoding": {
                "RequestedShape": F(2),
                "RepresentedShape": F(2),
                "Kernel": k(1, 7),
            },
        },
        "gamma/product": k(6, 10),
        "gamma/quotient": k(2, 3),
        "gamma/proper": {
            "Shape": F(7),
            "Rate": F(10),
            "Mean": F(7, 10),
            "Variance": F(7, 100),
        },
        "gaussian/improper-product": g(3, 2),
        "shape/small": {
            "RequestedShape": tiny,
            "RepresentedShape": tiny,
            "Kernel": k(tiny - 1, 1),
        },
        "gamma/neutral": k(1, 2),
    }
    for name, value in expected.items():
        assert rows[name]["Outcome"] == {"Kind": "success", "Value": value}, name
    failures = {
        "gamma/improper": ("ImproperGamma", "kernel.Rate"),
        "gaussian/linear-improper": ("ImproperGaussian", "kernel.Precision"),
        "invalid/negative-variance": ("InvalidMoments", "w.Variance"),
        "invalid/nonpositive-gamma": ("InvalidDomain", "mean_beta"),
        "invalid/proper-gaussian": ("ImproperGaussian", "kernel.Precision"),
        "invalid/objective-variance": ("InvalidDomain", "v"),
        "shape/nonpositive": ("InvalidDomain", "alpha"),
    }
    for name, fields in failures.items():
        outcome = rows[name]["Outcome"]
        assert set(outcome) == {"Kind", "Failure"} and outcome["Kind"] == "refused"
        f = outcome["Failure"]
        assert (
            set(f) == {"Code", "Field", "Message"} and (f["Code"], f["Field"]) == fields
        )
        assert type(f["Message"]) is str and f["Message"]
    errors = []
    with localcontext(Context(prec=100)):
        for name in (
            "reverse/exp",
            "reverse/log",
            "reverse/signed",
            "objective/stationary",
            "objective/general",
        ):
            row = rows[name]
            assert (
                set(row["Outcome"]) == {"Kind", "Value"}
                and row["Outcome"]["Kind"] == "success"
            )
            inputs = row["Input"]
            if name.startswith("reverse/"):
                power = d(inputs["kernel"]["LogPower"])
                if inputs["orientation"] == "LogConstraint":
                    power += 1
                point = d(inputs["z"])
                want = power * point - d(inputs["kernel"]["Rate"]) * point.exp()
                errors.append(abs(d(row["Outcome"]["Value"]) - want))
            else:
                t, u, k0, c, m, v = (
                    d(inputs[n]) for n in ("t", "u", "k", "c", "m", "v")
                )
                r = c * (m + v / 2).exp()
                want = {
                    "Value": t * (m * m + v - 2 * m * u + u * u) / 2
                    - k0 * m
                    + r
                    - v.ln() / 2,
                    "DerivativeMean": t * m - t * u - k0 + r,
                    "DerivativeVariance": t / 2 + r / 2 - 1 / (2 * v),
                }
                actual = row["Outcome"]["Value"]
                assert set(actual) == set(want)
                errors.extend(abs(d(actual[n]) - val) for n, val in want.items())
        assert len(errors) == 9 and max(errors) < Decimal("2e-77")
    result = {
        "SourceCommit": SOURCE,
        "EvidenceCommit": EVIDENCE,
        "ManifestSha256": sha(manifest_raw),
        "ArchivePairs": 34,
        "SeparateLocalOriginalMatches": separate_originals,
        "RawBytes": sum(r["OriginalBytes"] for r in manifest["Records"]),
        "StoredBytes": sum(r["StoredBytes"] for r in manifest["Records"]),
        "SourcePins": source_pins,
        "UnchangedMathFunctionAsts": sorted(math_names),
        "VectorBytes": len(vector_raw),
        "VectorSha256": sha(vector_raw),
        "VectorRows": 24,
        "ExactRationalSuccessRows": len(expected),
        "TypedRefusalRows": len(failures),
        "DecimalSuccessRows": 5,
        "DecimalLeaves": len(errors),
        "DecimalPrecision": 100,
        "DecimalAbsoluteTolerance": "2e-77",
        "MaxDecimalAbsoluteDifference": str(max(errors)),
        "ProjectReferenceImported": False,
        "NativeExecuted": False,
        "Passed": True,
    }
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main(Path(sys.argv[1]).resolve(strict=True))
