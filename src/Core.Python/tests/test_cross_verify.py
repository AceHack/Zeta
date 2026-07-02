import json
import yaml
from pathlib import Path
from zeta import sha256
from zeta import tri_boolean
from zeta import zeta_id
from zeta import yaml as zeta_yaml
from zeta import zset_merkle


def find_repo_root() -> Path:
    dir_path = Path(__file__).resolve().parent
    for parent in [dir_path] + list(dir_path.parents):
        if (parent / "Zeta.sln").exists():
            return parent
    raise RuntimeError("could not find repo root")


def test_cross_verify_sha256():
    repo_root = find_repo_root()
    fixture_dir = repo_root / "tests" / "cross-verification" / "sha256"
    vectors_path = fixture_dir / "vectors.yaml"

    with open(vectors_path, "r", encoding="utf-8") as f:
        y = yaml.safe_load(f)

    out_map = {}
    for v in y["vectors"]:
        v_id = v["id"]
        if "input_utf8" in v:
            val = v["input_utf8"]
            data = val.encode("utf-8")
        elif "input_hex" in v:
            data = bytes.fromhex(v["input_hex"])
        else:
            data = b""
        out_map[v_id] = sha256.hash_bytes(data)

    output_path = fixture_dir / "python-output.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(out_map, f, indent=2, sort_keys=True)
        f.write("\n")


def test_cross_verify_tri_boolean():
    repo_root = find_repo_root()
    fixture_dir = repo_root / "tests" / "cross-verification" / "tri-boolean"
    vectors_path = fixture_dir / "vectors.yaml"

    with open(vectors_path, "r", encoding="utf-8") as f:
        y = yaml.safe_load(f)

    def parse_tri(s: str) -> tri_boolean.Tri:
        if s == "T":
            return tri_boolean.T
        elif s == "F":
            return tri_boolean.F
        elif s == "N":
            return tri_boolean.N
        raise ValueError(f"invalid tri state: {s}")

    def trits_to_str(trits) -> str:
        return "".join(t.s for t in trits)

    out_map = {}
    for v in y["vectors"]:
        v_id = v["id"]
        v_type = v["type"]

        if v_type == "unary":
            state_str = v["state"]
            tr = parse_tri(state_str)
            meas_res = tri_boolean.measure(tr)

            not_val = tri_boolean.not_tri(tr)
            coop_val = tri_boolean.cooperate(tr)
            map_not_val = tri_boolean.map_tri(tr, lambda b: not b)
            bind_not_val = tri_boolean.bind_tri(
                tr, lambda b: tri_boolean.from_bool(not b)
            )
            bind_to_t_val = tri_boolean.bind_tri(tr, lambda b: tri_boolean.T)

            out_map[v_id] = {
                "type": "unary",
                "state": state_str,
                "isLiving": tr.is_living(),
                "isCertain": tr.is_certain(),
                "notState": not_val.s,
                "cooperateState": coop_val.s,
                "measureOk": meas_res.ok,
                "measureValue": meas_res.value,
                "measureFeedback": meas_res.feedback.reason if not meas_res.ok else "",
                "mapNot": map_not_val.s,
                "bindNot": bind_not_val.s,
                "bindToT": bind_to_t_val.s,
            }
        elif v_type == "binary":
            left = parse_tri(v["left"])
            right = parse_tri(v["right"])
            and_val = tri_boolean.and_tri(left, right)
            or_val = tri_boolean.or_tri(left, right)

            out_map[v_id] = {
                "type": "binary",
                "left": v["left"],
                "right": v["right"],
                "expectedAnd": and_val.s,
                "expectedOr": or_val.s,
            }
        elif v_type == "float":
            high_trits = tuple(parse_tri(c) for c in v["high"])
            decoder_trits = tuple(parse_tri(c) for c in v["decoder"])
            low_trits = tuple(parse_tri(c) for c in v["low"])

            tf = tri_boolean.from_trits(high_trits, decoder_trits, low_trits)
            dec_res = tri_boolean.decode(tf)

            expected_val = dec_res.value
            if expected_val.is_integer():
                expected_val = int(expected_val)

            float_res = {
                "type": "float",
                "high": v["high"],
                "decoder": v["decoder"],
                "low": v["low"],
                "expectedOk": dec_res.ok,
                "expectedValue": expected_val,
                "expectedFeedback": dec_res.feedback.reason if not dec_res.ok else "",
            }

            if "encode_value" in v:
                val = float(v["encode_value"])
                float_res["encodeValue"] = int(val) if val.is_integer() else val
                enc_res = tri_boolean.from_value(val, tf.shape)
                float_res["expectedEncodeOk"] = enc_res.ok
                if enc_res.ok:
                    float_res["expectedEncodeHigh"] = trits_to_str(enc_res.float.high)
                    float_res["expectedEncodeDecoder"] = trits_to_str(
                        enc_res.float.decoder
                    )
                    float_res["expectedEncodeLow"] = trits_to_str(enc_res.float.low)
                else:
                    float_res["expectedEncodeDetail"] = enc_res.feedback.detail

            out_map[v_id] = float_res

    output_path = fixture_dir / "python-output.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(out_map, f, indent=2, sort_keys=True)
        f.write("\n")


def test_cross_verify_zeta_id():
    repo_root = find_repo_root()
    fixture_dir = repo_root / "tests" / "cross-verification" / "zeta-id"
    vectors_path = fixture_dir / "vectors.yaml"

    with open(vectors_path, "r", encoding="utf-8") as f:
        y = yaml.safe_load(f)

    def obs_equal(a: zeta_id.ZetaObservation, b: zeta_id.ZetaObservation) -> bool:
        if a.authority.type == "Raw":
            a_auth_val = a.authority.value
        else:
            a_auth_val = zeta_id.AUTHORITY_VALUES[a.authority.type]

        if b.authority.type == "Raw":
            b_auth_val = b.authority.value
        else:
            b_auth_val = zeta_id.AUTHORITY_VALUES[b.authority.type]

        if a.momentum.type == "Raw":
            a_mom_val = a.momentum.value
        else:
            a_mom_val = zeta_id.MOMENTUM_VALUES[a.momentum.type]

        if b.momentum.type == "Raw":
            b_mom_val = b.momentum.value
        else:
            b_mom_val = zeta_id.MOMENTUM_VALUES[b.momentum.type]

        return (
            a.version == b.version
            and a.timestamp == b.timestamp
            and a.chromosome == b.chromosome
            and a.category == b.category
            and a.firefly == b.firefly
            and a.authority.type == b.authority.type
            and a_auth_val == b_auth_val
            and a.persona == b.persona
            and a.momentum.type == b.momentum.type
            and a_mom_val == b_mom_val
            and a.location == b.location
        )

    out_map = {}
    for v in y["vectors"]:
        v_id = v["id"]
        auth_raw = v.get("authority_raw")
        auth_val = auth_raw if auth_raw is not None else 0
        mom_raw = v.get("momentum_raw")
        mom_val = mom_raw if mom_raw is not None else 0

        obs = zeta_id.ZetaObservation(
            version=v["version"],
            timestamp=v["timestamp"],
            chromosome=v["chromosome"],
            category=v["category"],
            firefly=v["firefly"],
            authority=zeta_id.Authority(type_=v["authority_type"], value=auth_val),
            persona=v["persona"],
            momentum=zeta_id.Momentum(type_=v["momentum_type"], value=mom_val),
            location=v["location"],
        )

        packed = zeta_id.pack(obs, zeta_id.DETERMINISTIC_ENV)
        hex_val = zeta_id.to_hex(packed)
        crockford_val = zeta_id.format_b32(packed)

        unpacked = zeta_id.unpack(packed)
        roundtrip_ok = obs_equal(obs, unpacked)
        parsed_id = zeta_id.parse_b32(crockford_val)
        parse_ok = parsed_id == packed
        is_canonical = zeta_id.is_canonical(crockford_val)

        matches_expected = hex_val == v["expected_hex"]
        crockford_matches = crockford_val == v["expected_crockford"]

        roundtrip_ok = roundtrip_ok and parse_ok and is_canonical
        matches_expected = matches_expected and crockford_matches

        out_map[v_id] = {
            "hex": hex_val,
            "crockford": crockford_val,
            "roundtripOk": roundtrip_ok,
            "matchesExpected": matches_expected,
        }

    output_path = fixture_dir / "python-output.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(out_map, f, indent=2, sort_keys=True)
        f.write("\n")


def test_zeta_id_canonicality():
    assert zeta_id.is_canonical("081JVQXNCD370ZG2R010000000") is True
    assert zeta_id.is_canonical("081JVQXNCD370ZG2R010000000".lower()) is False
    assert zeta_id.is_canonical("081JVQXNCD370ZG2R01000000o") is False  # 'o' alias
    assert (
        zeta_id.is_canonical("Z0000000000000000000000000") is False
    )  # first char >= 8 (overflows 128-bit)


def test_cross_verify_canonical_json():
    class JsonNumber:
        def __init__(self, s: str):
            self.s = s

    repo_root = find_repo_root()
    fixture_dir = repo_root / "tests" / "cross-verification" / "canonical-json"
    vectors_path = fixture_dir / "vectors.json"

    with open(vectors_path, "r", encoding="utf-8") as f:
        fixture = json.load(f, parse_int=JsonNumber, parse_float=JsonNumber)

    from zeta.canonical_json import check_well_formed, escape_string

    def to_canonical_json_with_number(val: object) -> str:
        if val is None:
            return "null"
        if isinstance(val, bool):
            return "true" if val else "false"
        if isinstance(val, JsonNumber):
            s = val.s
            if "." in s or "e" in s or "E" in s:
                raise ValueError("toTagged: float not allowed")
            n = int(s)
            if abs(n) > 9007199254740991:
                raise ValueError(f"toTagged: {n} is not a safe integer")
            return s
        if isinstance(val, float):
            raise ValueError("toTagged: float not allowed")
        if isinstance(val, int):
            if abs(val) > 9007199254740991:
                raise ValueError(f"toTagged: {val} is not a safe integer")
            return str(val)
        if isinstance(val, str):
            check_well_formed(val, "string")
            return escape_string(val)
        if isinstance(val, (list, tuple)):
            return "[" + ",".join(to_canonical_json_with_number(x) for x in val) + "]"
        if isinstance(val, dict):

            def sort_key(s: str) -> bytes:
                return s.encode("utf-16-be")

            sorted_keys = sorted(val.keys(), key=sort_key)
            parts = []
            for k in sorted_keys:
                check_well_formed(k, "object key")
                parts.append(
                    f"{escape_string(k)}:{to_canonical_json_with_number(val[k])}"
                )
            return "{" + ",".join(parts) + "}"
        raise TypeError(f"Unsupported value type: {type(val)}")

    out_map = {}
    for v in fixture["canonical"]:
        got = to_canonical_json_with_number(v["value"])
        if got != v["expected_canonical_json"]:
            raise ValueError(
                f"canonical:{v['id']} mismatch: got={got} expected={v['expected_canonical_json']}"
            )
        out_map[f"canonical:{v['id']}"] = got

    for v in fixture["invalid"]:
        try:
            to_canonical_json_with_number(v["value"])
            rejected = False
        except ValueError:
            rejected = True

        out_map[f"invalid:{v['id']}"] = "<rejected>" if rejected else "ACCEPTED"

    output_path = fixture_dir / "python-output.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(out_map, f, indent=2, sort_keys=True)
        f.write("\n")


def test_cross_verify_yaml():
    repo_root = find_repo_root()
    fixture_dir = repo_root / "tests" / "cross-verification" / "yaml"
    vectors_path = fixture_dir / "vectors.json"

    with open(vectors_path, "r", encoding="utf-8") as f:
        fixture = json.load(f)

    out_map = {}
    for v in fixture["vectors"]:
        events = zeta_yaml.read_events(v["yaml"])
        out_map[v["id"]] = events

    output_path = fixture_dir / "python-output.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(out_map, f, indent=2, sort_keys=True)
        f.write("\n")


def test_cross_verify_zset_merkle():
    repo_root = find_repo_root()
    fixture_dir = repo_root / "tests" / "cross-verification" / "zset-merkle"
    vectors_path = fixture_dir / "vectors.yaml"

    with open(vectors_path, "r", encoding="utf-8") as f:
        y = yaml.safe_load(f)

    out_map = {}
    for v in y["vectors"]:
        v_id = v["id"]
        entries = [(e["key"], e["weight"]) for e in v["entries"]]
        root_hash = zset_merkle.root(entries)
        out_map[v_id] = root_hash.to_hex()

    output_path = fixture_dir / "python-output.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(out_map, f, indent=2, sort_keys=True)
        f.write("\n")
