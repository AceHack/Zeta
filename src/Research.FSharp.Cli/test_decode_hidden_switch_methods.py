"""Pure decoder grammar/admission fixtures; no decoder executable or dump access."""
import gzip
import hashlib
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from decode_hidden_switch_methods import (
    atomic_input,
    bounded_raw,
    checked_word,
    cleanup,
    decoded_rows,
    decoder_arguments,
    identity,
    publish_terminal,
)


class DecodeMethodTests(unittest.TestCase):
    def words(self):
        return [checked_word("method-000", 0x1000, 0, bytes.fromhex("1F2003D5")),
                checked_word("method-000", 0x1000, 4, bytes.fromhex("C0035FD6"))]

    def output(self):
        return b"\tnop ; encoding: [0x1f,0x20,0x03,0xd5]\n\tret ; encoding: [0xc0,0x03,0x5f,0xd6]\n"

    def test_file_identity_is_bounded_and_observes_real_owned_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "owned.bin"
            path.write_bytes(b"owned")
            self.assertEqual(identity(path)["Bytes"], 5)
            with patch("decode_hidden_switch_methods.time.monotonic", side_effect=[0, 11]), self.assertRaises(TimeoutError):
                identity(path)
            with path.open("wb") as stream:
                stream.truncate(256 * 1024**2 + 1)
            with self.assertRaises(ValueError):
                identity(path)

    @unittest.skipUnless(hasattr(os, "mkfifo") and hasattr(os, "O_NOFOLLOW"), "requires POSIX FIFO/nofollow support")
    def test_fifo_and_symlink_reads_refuse_without_waiting_for_a_writer(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            fifo = root / "owned.fifo"; os.mkfifo(fifo)
            with self.assertRaises(ValueError):
                bounded_raw(fifo, 32)
            file = root / "real"; file.write_bytes(b"owned")
            alias = root / "alias"; alias.symlink_to(file)
            with self.assertRaises(OSError):
                identity(alias)

    def test_cleanup_status_failure_still_kills_joins_and_closes_once(self):
        events = []
        class Process:
            pid = 999999
            returncode = -9
            def poll(self):
                raise OSError("status fixture")
            def wait(self, timeout):
                events.append("join")
        with tempfile.TemporaryDirectory() as directory:
            stream = (Path(directory) / "owned").open("xb")
            class Owned:
                def close(self):
                    stream.close(); events.append("close")
            with patch("decode_hidden_switch_methods.os.killpg", side_effect=lambda *_: events.append("kill")):
                errors, status = cleanup(Process(), [("owned-close", Owned())])
            self.assertEqual(events, ["kill", "join", "close"])
            self.assertEqual(errors[0]["Stage"], "process-status")
            self.assertEqual(status["ExitCode"], -9)

    def test_broken_console_does_not_replace_primary_or_skip_owned_outcome(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            primary = {"Stage": "decode", "Code": "encoding", "Detail": "wrong bytes"}
            outcome = {"Complete": False, "Failure": primary}
            with patch("builtins.print", side_effect=BrokenPipeError("closed console")):
                publish_terminal(root, outcome)
            self.assertEqual(json.loads((root / "outcome.json").read_text())["Failure"], primary)
            second = json.loads((root / "reporting-failure.json").read_text())
            self.assertEqual(second["Failure"], primary)
            self.assertEqual(second["ConsoleFailure"]["Code"], "BrokenPipeError")

    def test_atomic_chunks_and_actual_addresses_are_explicit(self):
        words = self.words()
        self.assertEqual(atomic_input(words), b"[0x1f 0x20 0x03 0xd5]\n[0xc0 0x03 0x5f 0xd6]\n")
        decoded = list(decoded_rows(self.output(), b"", 0, words))
        self.assertEqual([row["Instruction"] for row in decoded], ["nop", "ret"])
        self.assertEqual([row["Address"] for row in decoded], ["0000000000001000", "0000000000001004"])
        self.assertIn("never a runtime target", decoded[0]["PrintedAddressMeaning"])

    def test_explicit_rcpc_is_the_only_added_decoder_feature(self):
        self.assertEqual(decoder_arguments()[1:], ["--disassemble", "--triple=aarch64-apple-darwin", "--mcpu=generic",
                                                  "--mattr=+rcpc", "--show-encoding"])

    def mov_word(self, register, immediate, encoded):
        word = checked_word("owned", 0x2000, 0, bytes.fromhex(encoded))
        tokens = ",".join(f"0x{byte:02x}" for byte in bytes.fromhex(encoded))
        line = f"\tmov\t{register}, #{immediate} ; encoding: [{tokens}]\n".encode("ascii")
        return word, line

    def test_mov_comments_bind_to_preceding_instruction_and_register_width(self):
        for register, value, encoded, comment in [("x0", 1, "200080D2", b"                                        ; =0x1\n"),
                                                   ("w1", -1, "01008012", b"                                        ; =0xffffffff\n"),
                                                   ("x30", -1, "1E008092", b"                                        ; =0xffffffffffffffff\n")]:
            with self.subTest(register=register):
                word, line = self.mov_word(register, value, encoded)
                rows = list(decoded_rows(line + comment, b"", 0, [word]))
                self.assertEqual(len(rows), 1)
                self.assertEqual(rows[0]["ImmediateComment"], comment.decode().rstrip("\n"))
                self.assertEqual(rows[0]["TextLine"], 1)
                self.assertEqual(rows[0]["Address"], "0000000000002000")
                bare, = decoded_rows(line, b"", 0, [word])
                self.assertIsNone(bare["ImmediateComment"])

    def test_orphan_repeated_wrong_non_mov_and_unknown_comments_refuse(self):
        word, line = self.mov_word("x0", 1, "200080D2")
        comment = b"                                        ; =0x1\n"
        for output in [comment + line, line + comment + comment, line + b" " * 40 + b"; =0x2\n",
                       line + b"; =1\n", line + b"; anything\n", line + b"\t; =0x1\n",
                       line + b" " * 40 + b"; =0x1 trailing\n", line + b" " * 40 + b"; =0xA\n", line + b"\n" + comment,
                       line + b"; =0x1\n", line + b" " * 39 + b"; =0x1\n", line + b" " * 41 + b"; =0x1\n"]:
            with self.subTest(output=output), self.assertRaises(ValueError):
                list(decoded_rows(output, b"", 0, [word]))
        for register in ["w31", "x31", "xzr", "sp"]:
            with self.subTest(register=register), self.assertRaises(ValueError):
                list(decoded_rows(line.replace(b"x0", register.encode()) + comment, b"", 0, [word]))
        for instruction in [b"movk x0, #1", b"mov x0, #0x1", b"mov x0, x1", b"add x0, x0, #1"]:
            with self.subTest(instruction=instruction), self.assertRaises(ValueError):
                list(decoded_rows(line.replace(b"mov\tx0, #1", instruction) + comment, b"", 0, [word]))
        with self.assertRaises(ValueError):
            list(decoded_rows(self.output().splitlines(keepends=True)[0] + comment, b"", 0, self.words()[:1]))
        word, line = self.mov_word("w1", -1, "01008012")
        with self.assertRaises(ValueError):
            list(decoded_rows(line + b" " * 40 + b"; =0xffffffffffffffff\n", b"", 0, [word]))

    def test_comment_lines_do_not_fill_missing_instruction_or_hide_extra_output(self):
        word, line = self.mov_word("x0", 1, "200080D2")
        comment = b"                                        ; =0x1\n"
        ret = self.words()[1]
        ret_line = self.output().splitlines(keepends=True)[1]
        valid = line + comment + ret_line
        rows = list(decoded_rows(valid, b"", 0, [word, ret]))
        self.assertEqual([row["TextLine"] for row in rows], [1, 3])
        for output in [line + comment, valid + ret_line, ret_line + line + comment]:
            with self.subTest(output=output), self.assertRaises(ValueError):
                list(decoded_rows(output, b"", 0, [word, ret]))

    def test_prior_attached_comment_survives_later_refusal(self):
        word, line = self.mov_word("x0", 1, "200080D2")
        ret_line = self.output().splitlines(keepends=True)[1].replace(b"0xc0", b"0xc1")
        comment = b"                                        ; =0x1\n"
        rows = decoded_rows(line + comment + ret_line, b"", 0, [word, self.words()[1]])
        self.assertEqual(next(rows)["ImmediateComment"], comment.decode().rstrip("\n"))
        with self.assertRaises(ValueError):
            next(rows)

    def test_exact_retained_failed_attempt_stdout_is_a_complete_parser_fixture(self):
        base = Path(__file__).resolve().parents[2] / "docs/research/hidden-switch-compiled-validation/2026-09-07/llvm-decode-attempt-2"
        manifest = json.loads((base / "manifest.json").read_text())
        records = {row["File"]: row for row in manifest["Records"]}

        def retained(name):
            record = records[name + ".gz"]
            stored = (base / record["File"]).read_bytes()
            self.assertEqual((len(stored), hashlib.sha256(stored).hexdigest().upper()), (record["StoredBytes"], record["StoredSha256"]))
            raw = gzip.decompress(stored)
            self.assertEqual((len(raw), hashlib.sha256(raw).hexdigest().upper()), (record["Bytes"], record["Sha256"]))
            return raw

        stdout = retained("helper.stdout.log")
        self.assertEqual(hashlib.sha256(stdout).hexdigest().upper(), "B54C1AF8E5FF4B59DE42EFC8FFB60436244E063CF81DD5B208BD20A6BDC872C6")
        stderr = retained("helper.stderr.log")
        self.assertEqual(stderr, b"")
        inputs = [json.loads(retained(name[:-3])) for name in sorted(records) if name.startswith("input-method-")]
        self.assertEqual(len(inputs), 130)
        words = [word for method in inputs for word in method["Words"]]
        self.assertEqual(atomic_input(words), retained("decoder.input"))
        self.assertEqual(len(words), 8665)
        decoded = list(decoded_rows(stdout, stderr, 0, words))
        self.assertEqual(len(decoded), 8665)
        comments = [row["ImmediateComment"] for row in decoded if row["ImmediateComment"] is not None]
        self.assertEqual(len(comments), 851)
        self.assertEqual(comments, [line for line in stdout.decode("ascii").splitlines() if line.lstrip().startswith(";")])
        first = comments[0].encode("ascii")
        self.assertEqual(first, b"                                        ; =0x2508")
        self.assertEqual(decoded[22]["Instruction"], "mov\tx0, #9480")
        self.assertEqual(decoded[22]["TextLine"], 23)
        for replacement in [b"; =0x2508", b" " * 39 + b"; =0x2508", b" " * 41 + b"; =0x2508", b"\t; =0x2508"]:
            with self.subTest(replacement=replacement), self.assertRaises(ValueError):
                list(decoded_rows(stdout.replace(first, replacement, 1), stderr, 0, words))
        historical = json.loads(retained("outcome.json"))
        self.assertFalse(historical["Complete"])
        self.assertEqual(historical["Failure"]["Detail"], "word 22 has an unsupported standalone comment association")

    def test_truncated_word_and_address_overflow_refuse(self):
        for base, offset, raw in [(0x1000, 0, bytes(3)), (0x1000, 1, bytes(4)), (0x1001, 0, bytes(4)),
                                  (2**64 - 4, 0, bytes(4)), (True, 0, bytes(4)), (0x1000, -4, bytes(4))]:
            with self.subTest(base=base, offset=offset), self.assertRaises(ValueError):
                checked_word("owned", base, offset, raw)
        for value in ["00", "1f2003d5", "0000000000", "???"]:
            with self.assertRaises(ValueError):
                atomic_input([{"Hex": value}])

    def test_warning_softfail_or_nonzero_exit_cannot_admit_instruction(self):
        for stderr, code in [(b"warning: potentially undefined instruction encoding\n", 0),
                             (b"warning: invalid instruction encoding\n", 1), (b"", 1)]:
            with self.assertRaises(ValueError):
                list(decoded_rows(self.output(), stderr, code, self.words()))

    def test_missing_extra_and_reordered_output_refuse(self):
        lines = self.output().splitlines(keepends=True)
        for output in [lines[0], self.output() + lines[0], b"".join(reversed(lines))]:
            with self.assertRaises(ValueError):
                list(decoded_rows(output, b"", 0, self.words()))

    def test_changed_symbolic_or_short_encoding_and_directive_refuse(self):
        for old, new in [(b"0x1f", b"0x00"), (b"0x1f", b"A"), (b"0x1f,", b""), (b"nop", b".word 0xd503201f")]:
            with self.assertRaises(ValueError):
                list(decoded_rows(self.output().replace(old, new), b"", 0, self.words()))
        with self.assertRaises(ValueError):
            list(decoded_rows(b" " * 2048 + self.output(), b"", 0, self.words()))

    def test_prior_decoded_word_survives_later_encoding_refusal(self):
        output = self.output().replace(b"0xc0", b"0xc1")
        rows = decoded_rows(output, b"", 0, self.words())
        self.assertEqual(next(rows)["Hex"], "1F2003D5")
        with self.assertRaises(ValueError):
            next(rows)


if __name__ == "__main__":
    unittest.main()
