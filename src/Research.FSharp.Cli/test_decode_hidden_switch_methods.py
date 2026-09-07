"""Pure decoder grammar/admission fixtures; no decoder executable or dump access."""
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
