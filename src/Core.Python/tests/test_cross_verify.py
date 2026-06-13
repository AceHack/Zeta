import json
import yaml
from pathlib import Path
from zeta import sha256
from zeta import tri_boolean


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
