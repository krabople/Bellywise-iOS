"""Synthetic, correctly laid-out Mach-O fixtures; no macOS tools are required."""

import importlib.util
import io
from pathlib import Path
import plistlib
import struct
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[2] / 'scripts' / 'ci' / 'verify-simulator-entitlements.py'
SPEC = importlib.util.spec_from_file_location('simulator_entitlements', SCRIPT)
VERIFIER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VERIFIER)
TEAM = 'A1B2C3D4E5'
BUNDLE = 'com.example.bellywise'
APP_ID = f'{TEAM}.{BUNDLE}'


def macho(entitlements=None, *, section_name=b'__entitlements', cpu_type=0x0100000C, payload=None):
    """A __TEXT segment has a code section followed by the entitlement section.

    Header and load commands occupy the start of the file-backed segment. Include
    an unrelated UUID command so the reader must walk, rather than assume offsets.
    """
    if payload is None:
        payload = plistlib.dumps(entitlements if entitlements is not None else {'application-identifier': APP_ID}, fmt=plistlib.FMT_XML)
    code_offset = 0x1000
    plist_offset = code_offset + 16
    file_size = plist_offset + len(payload)
    vm_address = 0x100000000
    command_size = VERIFIER.SEGMENT_64.size + 2 * VERIFIER.SECTION_64.size
    uuid_command = struct.pack('<II16s', 0x1B, 24, b'0123456789abcdef')
    header = VERIFIER.HEADER.pack(VERIFIER.MH_MAGIC_64, cpu_type, 0, 2, 2, len(uuid_command) + command_size, 0, 0)
    segment = VERIFIER.SEGMENT_64.pack(VERIFIER.LC_SEGMENT_64, command_size, b'__TEXT', vm_address, 0x4000, 0, file_size, 5, 5, 2, 0)
    code = VERIFIER.SECTION_64.pack(b'__text', b'__TEXT', vm_address + code_offset, 16, code_offset, 4, 0, 0, 0x80000400, 0, 0, 0)
    plist = VERIFIER.SECTION_64.pack(section_name, b'__TEXT', vm_address + plist_offset, len(payload), plist_offset, 0, 0, 0, 0, 0, 0, 0)
    binary = header + uuid_command + segment + code + plist
    binary += b'\0' * (code_offset - len(binary)) + b'\x1f\x20\x03\xd5' * 4 + payload
    return binary


def extract(binary):
    return VERIFIER.read_embedded_entitlements(io.BytesIO(binary), len(binary))


class SimulatorEntitlementsTests(unittest.TestCase):
    def test_arm64_and_x86_64_private_default_group(self):
        for cpu in (0x0100000C, 0x01000007):
            with self.subTest(cpu=cpu):
                entitlements = extract(macho(cpu_type=cpu))
                self.assertEqual(VERIFIER.validate_entitlements(entitlements, BUNDLE, TEAM), APP_ID)

    def test_matching_team_and_explicit_own_group(self):
        entitlements = {'application-identifier': APP_ID, 'com.apple.developer.team-identifier': TEAM, 'keychain-access-groups': [APP_ID]}
        self.assertEqual(VERIFIER.validate_entitlements(extract(macho(entitlements)), BUNDLE, TEAM), APP_ID)

    def test_local_signing_bare_bundle_identifier_is_valid(self):
        for extra in ({}, {'keychain-access-groups': [BUNDLE]}):
            entitlements = {'application-identifier': BUNDLE, **extra}
            self.assertEqual(VERIFIER.validate_entitlements(extract(macho(entitlements)), BUNDLE, TEAM), BUNDLE)

    def test_explicit_group_must_match_the_actual_bare_or_prefixed_identity(self):
        for app_id, group in ((BUNDLE, APP_ID), (APP_ID, BUNDLE)):
            with self.assertRaisesRegex(VERIFIER.VerificationError, 'own group'):
                VERIFIER.validate_entitlements(extract(macho({'application-identifier': app_id, 'keychain-access-groups': [group]})), BUNDLE, TEAM)

    def test_missing_section_is_not_satisfied_by_plist_bytes_elsewhere(self):
        with self.assertRaisesRegex(VERIFIER.VerificationError, 'Missing simulator'):
            extract(macho(section_name=b'__other'))

    def test_truncated_header_load_commands_and_payload(self):
        binary = macho()
        for shortened in (binary[:12], binary[:40], binary[:-1]):
            with self.subTest(size=len(shortened)):
                with self.assertRaisesRegex(VERIFIER.VerificationError, 'Truncated'):
                    extract(shortened)

    def test_wrong_or_missing_application_identifier(self):
        for entitlements in ({}, {'application-identifier': 'OTHER.com.example.bellywise'}, {'application-identifier': TEAM + '.*'}):
            with self.subTest(entitlements=entitlements):
                with self.assertRaisesRegex(VERIFIER.VerificationError, 'application-identifier'):
                    VERIFIER.validate_entitlements(extract(macho(entitlements)), BUNDLE, TEAM)

    def test_wrong_team_or_foreign_keychain_group(self):
        for extra in ({'com.apple.developer.team-identifier': 'WRONG'}, {'keychain-access-groups': [APP_ID, TEAM + '.shared']}, {'keychain-access-groups': APP_ID}, {'keychain-access-groups': []}):
            with self.subTest(extra=extra):
                entitlements = {'application-identifier': APP_ID, **extra}
                with self.assertRaises(VERIFIER.VerificationError):
                    VERIFIER.validate_entitlements(extract(macho(entitlements)), BUNDLE, TEAM)

    def test_invalid_command_size_and_section_table(self):
        binary = bytearray(macho())
        struct.pack_into('<I', binary, VERIFIER.HEADER.size + 4, 0)
        with self.assertRaisesRegex(VERIFIER.VerificationError, 'command size'):
            extract(bytes(binary))
        binary = bytearray(macho())
        segment_offset = VERIFIER.HEADER.size + 24
        struct.pack_into('<I', binary, segment_offset + 64, 10000)
        with self.assertRaisesRegex(VERIFIER.VerificationError, 'section table'):
            extract(bytes(binary))

    def test_entitlement_offset_cannot_point_outside_segment(self):
        binary = bytearray(macho())
        entitlement_section = VERIFIER.HEADER.size + 24 + VERIFIER.SEGMENT_64.size + VERIFIER.SECTION_64.size
        struct.pack_into('<I', binary, entitlement_section + 48, 0xFFFFFFFF)
        with self.assertRaisesRegex(VERIFIER.VerificationError, 'outside its file-backed segment'):
            extract(bytes(binary))

    def test_rejects_fat_and_byte_swapped_binaries(self):
        for magic in (0xCAFEBABE, 0xCFFAEDFE):
            binary = bytearray(macho())
            struct.pack_into('<I', binary, 0, magic)
            with self.assertRaisesRegex(VERIFIER.VerificationError, 'thin little-endian'):
                extract(bytes(binary))

    def test_malformed_xml_and_non_dictionary_plist(self):
        for payload in (b'<plist><dict>', plistlib.dumps(['not a dictionary'])):
            with self.subTest(payload=payload[:30]):
                with self.assertRaises(VERIFIER.VerificationError):
                    extract(macho(payload=payload))

    def test_cli_success_and_failure(self):
        with tempfile.TemporaryDirectory() as folder:
            binary = Path(folder) / 'Bellywise'
            binary.write_bytes(macho())
            args = [sys.executable, str(SCRIPT), '--binary', str(binary), '--bundle-id', BUNDLE, '--team-id', TEAM]
            passed = subprocess.run(args, capture_output=True, text=True, check=False)
            self.assertEqual(passed.returncode, 0, passed.stderr)
            self.assertIn('PASS', passed.stdout)
            binary.write_bytes(macho({'application-identifier': 'WRONG'}))
            failed = subprocess.run(args, capture_output=True, text=True, check=False)
            self.assertEqual(failed.returncode, 1)
            self.assertIn('FAIL', failed.stderr)
            self.assertNotIn('Traceback', failed.stderr)


if __name__ == '__main__':
    unittest.main()
