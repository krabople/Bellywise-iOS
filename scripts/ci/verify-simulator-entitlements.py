#!/usr/bin/env python3
"""Verify the iOS simulator's embedded entitlement plist, without codesign.

Simulator iOS entitlements live in the Mach-O __TEXT,__entitlements section;
the executable's ad-hoc macOS host signature is a different entitlement source.
Xcode's linker places the simulator plist there with -sectcreate, as documented
in the build-system report https://github.com/facebook/buck/issues/1304.
Layout constants follow Apple's mach-o/loader.h:
https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/loader.h

The build selects ONLY_ACTIVE_ARCH, so accept thin arm64/x86_64 little-endian
64-bit binaries. Do not guess a slice in a fat/universal or byte-swapped file.
Every command, section table, and payload read is checked against its container.
"""

import argparse
import os
from pathlib import Path
import plistlib
import struct
import sys
from typing import BinaryIO
from xml.parsers.expat import ExpatError


HEADER = struct.Struct('<8I')
LOAD_COMMAND = struct.Struct('<II')
SEGMENT_64 = struct.Struct('<II16sQQQQiiII')
SECTION_64 = struct.Struct('<16s16sQQIIIIIIII')
MH_MAGIC_64 = 0xFEEDFACF
LC_SEGMENT_64 = 0x19
SIMULATOR_CPU_TYPES = {0x01000007, 0x0100000C}  # x86_64 and arm64
MAX_ENTITLEMENTS_SIZE = 1024 * 1024
MAX_LOAD_COMMANDS = 65536


class VerificationError(ValueError):
    """The file cannot establish the expected simulator Keychain identity."""


def _read(stream: BinaryIO, offset: int, size: int, end: int, label: str) -> bytes:
    if offset < 0 or size < 0 or offset > end or size > end - offset:
        raise VerificationError(f'Truncated or out-of-bounds {label}.')
    stream.seek(offset)
    value = stream.read(size)
    if len(value) != size:
        raise VerificationError(f'Truncated {label}.')
    return value


def _name(value: bytes) -> bytes:
    return value.split(b'\0', 1)[0]


def read_embedded_entitlements(stream: BinaryIO, file_size: int) -> dict:
    """Read exactly one bounded XML plist from a thin Mach-O file-like object."""
    header = HEADER.unpack(_read(stream, 0, HEADER.size, file_size, 'Mach-O header'))
    magic, cpu_type, _, _, command_count, commands_size, _, _ = header
    if magic != MH_MAGIC_64 or cpu_type not in SIMULATOR_CPU_TYPES:
        raise VerificationError('Expected a thin little-endian 64-bit arm64 or x86_64 Mach-O binary.')
    commands_end = HEADER.size + commands_size
    if commands_end > file_size:
        raise VerificationError('Truncated Mach-O load-command region.')
    if command_count > MAX_LOAD_COMMANDS or command_count > commands_size // LOAD_COMMAND.size:
        raise VerificationError('Invalid Mach-O load-command count.')

    position = HEADER.size
    found = None
    for _ in range(command_count):
        command, command_size = LOAD_COMMAND.unpack(
            _read(stream, position, LOAD_COMMAND.size, commands_end, 'load command'))
        if command_size < LOAD_COMMAND.size or command_size % 8 or command_size > commands_end - position:
            raise VerificationError('Invalid Mach-O load-command size.')
        command_end = position + command_size
        if command == LC_SEGMENT_64:
            segment = SEGMENT_64.unpack(
                _read(stream, position, SEGMENT_64.size, command_end, '64-bit segment command'))
            _, _, segment_name, vm_address, vm_size, file_offset, segment_size, _, _, section_count, _ = segment
            if section_count > (command_size - SEGMENT_64.size) // SECTION_64.size:
                raise VerificationError('Truncated Mach-O section table.')
            if file_offset > file_size or segment_size > file_size - file_offset:
                raise VerificationError('Truncated Mach-O segment data.')
            for index in range(section_count):
                section_offset = position + SEGMENT_64.size + index * SECTION_64.size
                section = SECTION_64.unpack(
                    _read(stream, section_offset, SECTION_64.size, command_end, '64-bit section'))
                section_name, parent_name, address, size, offset, _, _, _, flags, _, _, _ = section
                if _name(segment_name) != b'__TEXT' or _name(section_name) != b'__entitlements':
                    continue
                if found is not None:
                    raise VerificationError('Duplicate __TEXT,__entitlements sections.')
                if _name(parent_name) != b'__TEXT' or flags & 0xFF:
                    raise VerificationError('Invalid __TEXT,__entitlements section metadata.')
                if not 0 < size <= MAX_ENTITLEMENTS_SIZE:
                    raise VerificationError('Invalid or oversized simulator entitlement plist.')
                if offset < commands_end or offset < file_offset or size > file_offset + segment_size - offset:
                    raise VerificationError('Entitlement section is outside its file-backed segment.')
                if address < vm_address or size > vm_address + vm_size - address:
                    raise VerificationError('Entitlement section is outside its virtual-memory segment.')
                found = (offset, size)
        position = command_end

    if position != commands_end:
        raise VerificationError('Mach-O load-command sizes do not match the header.')
    if found is None:
        raise VerificationError('Missing simulator __TEXT,__entitlements section.')
    payload = _read(stream, found[0], found[1], file_size, 'simulator entitlement plist').rstrip(b'\0')
    try:
        entitlements = plistlib.loads(payload, fmt=plistlib.FMT_XML)
    except (ValueError, TypeError, OverflowError, plistlib.InvalidFileException, ExpatError) as error:
        raise VerificationError('Simulator entitlement section is not a valid XML plist.') from error
    if not isinstance(entitlements, dict):
        raise VerificationError('Simulator entitlement plist must contain a dictionary.')
    return entitlements


def validate_entitlements(entitlements: dict, bundle_id: str, team_id: str) -> str:
    if not bundle_id or not team_id or any(character.isspace() for character in bundle_id + team_id):
        raise VerificationError('Bundle ID and team ID must be nonempty identifiers.')
    # SwiftBuild's local "-" signing identity may use the bare bundle identifier
    # for simulated entitlements. Accept that exact identity or our exact team
    # prefix; device/archive provisioning remains separately and strictly checked.
    # https://github.com/swiftlang/swift-build/blob/main/Sources/SwiftBuild/ConsoleCommands/SWBServiceConsoleBuildCommand.swift
    expected = entitlements.get('application-identifier')
    if expected not in (bundle_id, f'{team_id}.{bundle_id}'):
        raise VerificationError(f'Simulator application-identifier must be {bundle_id} or {team_id}.{bundle_id}.')
    if ('com.apple.developer.team-identifier' in entitlements and
            entitlements['com.apple.developer.team-identifier'] != team_id):
        raise VerificationError('Simulator team-identifier does not match the expected team.')
    # With no explicit access-group entitlement, application-identifier supplies
    # the app's private default Keychain group. Do not require a sharing group.
    if 'keychain-access-groups' in entitlements:
        groups = entitlements['keychain-access-groups']
        if not isinstance(groups, list) or not groups or any(group != expected for group in groups):
            raise VerificationError('Simulator keychain-access-groups must contain only the app\'s own group.')
    return expected


def verify_binary(binary: Path, bundle_id: str, team_id: str) -> str:
    with binary.open('rb') as stream:
        entitlements = read_embedded_entitlements(stream, os.fstat(stream.fileno()).st_size)
    return validate_entitlements(entitlements, bundle_id, team_id)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--binary', type=Path, required=True)
    parser.add_argument('--bundle-id', required=True)
    parser.add_argument('--team-id', required=True)
    args = parser.parse_args(argv)
    try:
        app_id = verify_binary(args.binary, args.bundle_id, args.team_id)
    except (OSError, VerificationError) as error:
        print(f'Simulator entitlements: FAIL — {error}', file=sys.stderr)
        return 1
    print(f'Simulator entitlements: PASS — {app_id} (embedded iOS plist; private Keychain group).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
