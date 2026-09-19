#!/usr/bin/env python3
"""Inspect a signed device app without printing its profile or certificate material."""
import argparse
import json
import plistlib
import subprocess
from pathlib import Path


def validate_entitlements(signature, profile, bundle_id, team_id):
    entitlement = profile.get('Entitlements', {})
    app_id = signature.get('application-identifier')
    prefixes = profile.get('ApplicationIdentifierPrefix', [])
    if not app_id or not any(app_id == f'{prefix}.{bundle_id}' for prefix in prefixes):
        raise ValueError('Signed app identifier does not match the bundle and profile prefix.')
    if entitlement.get('application-identifier') != app_id:
        raise ValueError('The embedded profile is not an exact match for the signed app identifier.')
    if signature.get('com.apple.developer.team-identifier') != team_id:
        raise ValueError('Signed app belongs to a different Apple developer team.')
    if entitlement.get('com.apple.developer.team-identifier') != team_id:
        raise ValueError('Embedded profile belongs to a different Apple developer team.')
    if signature.get('get-task-allow') is True or entitlement.get('get-task-allow') is True:
        raise ValueError('The distribution app must not allow debugger attachment.')

    # Apple uses application-identifier as the private default group when no
    # explicit keychain-access-groups entitlement is present. Both forms are valid.
    explicit_groups = signature.get('keychain-access-groups')
    if explicit_groups is not None and (
        not isinstance(explicit_groups, list)
        or not explicit_groups
        or not all(isinstance(group, str) for group in explicit_groups)
    ):
        raise ValueError('Signed Keychain access groups have an invalid form.')
    effective_default = explicit_groups[0] if explicit_groups else app_id
    if effective_default != app_id:
        raise ValueError('The default Keychain group differs from this app private group.')
    profile_groups = entitlement.get('keychain-access-groups') or [entitlement.get('application-identifier')]

    def allowed(group):
        return any(isinstance(pattern, str) and (
            group == pattern or (pattern.endswith('.*') and group.startswith(pattern[:-1]))
        ) for pattern in profile_groups)

    if not all(allowed(group) for group in (explicit_groups or [app_id])):
        raise ValueError('The embedded profile does not allow the signed Keychain access groups.')
    return {
        'bundleId': bundle_id,
        'teamId': team_id,
        'applicationIdentifier': app_id,
        'effectiveDefaultKeychainGroup': effective_default,
        'explicitKeychainGroups': explicit_groups is not None,
        'entitlementsVerified': True,
    }


def read_command_plist(command):
    result = subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return plistlib.loads(result.stdout)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--app', required=True)
    parser.add_argument('--bundle-id', required=True)
    parser.add_argument('--team-id', required=True)
    parser.add_argument('--output')
    arguments = parser.parse_args()
    app = Path(arguments.app)
    with (app / 'Info.plist').open('rb') as source:
        info = plistlib.load(source)
    if info.get('CFBundleIdentifier') != arguments.bundle_id:
        raise ValueError('The inspected application has an unexpected bundle identifier.')
    subprocess.run(['/usr/bin/codesign', '--verify', '--deep', '--strict', str(app)], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    signature = read_command_plist(['/usr/bin/codesign', '--display', '--entitlements', '-', '--xml', str(app)])
    profile = read_command_plist(['/usr/bin/security', 'cms', '-D', '-i', str(app / 'embedded.mobileprovision')])
    result = validate_entitlements(signature, profile, arguments.bundle_id, arguments.team_id)
    result['signatureVerified'] = True
    result['buildNumber'] = info.get('CFBundleVersion')
    if arguments.output:
        Path(arguments.output).write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        # Avoid echoing CMS data, command output or other profile details on failure.
        if isinstance(error, subprocess.CalledProcessError):
            raise SystemExit(f'Signing verification command failed with exit code {error.returncode}.')
        raise SystemExit(str(error))
