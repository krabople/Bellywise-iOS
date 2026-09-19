import copy
import importlib.util
from pathlib import Path
import unittest

module_path = Path(__file__).resolve().parents[1] / 'scripts/ci/verify-ios-signing.py'
spec = importlib.util.spec_from_file_location('verify_ios_signing', module_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SigningEntitlementsTests(unittest.TestCase):
    def setUp(self):
        self.bundle = 'com.example.diary'
        self.team = 'TEAM123456'
        self.app_id = 'PREFIX1234.' + self.bundle
        self.signature = {'application-identifier': self.app_id, 'com.apple.developer.team-identifier': self.team, 'get-task-allow': False}
        self.profile = {
            'ApplicationIdentifierPrefix': ['PREFIX1234'],
            'Entitlements': {
                'application-identifier': self.app_id,
                'com.apple.developer.team-identifier': self.team,
                'get-task-allow': False,
                'keychain-access-groups': ['PREFIX1234.*'],
            },
        }

    def validate(self, signature=None, profile=None):
        return module.validate_entitlements(signature or self.signature, profile or self.profile, self.bundle, self.team)

    def test_implicit_default_group_is_valid_with_distinct_app_prefix(self):
        result = self.validate()
        self.assertEqual(result['effectiveDefaultKeychainGroup'], self.app_id)
        self.assertFalse(result['explicitKeychainGroups'])

    def test_explicit_private_group_is_valid(self):
        self.signature['keychain-access-groups'] = [self.app_id]
        self.assertTrue(self.validate()['explicitKeychainGroups'])

    def test_profile_without_explicit_groups_uses_application_identifier(self):
        del self.profile['Entitlements']['keychain-access-groups']
        self.assertTrue(self.validate()['entitlementsVerified'])

    def test_missing_application_identity_is_rejected(self):
        del self.signature['application-identifier']
        with self.assertRaisesRegex(ValueError, 'identifier'):
            self.validate()

    def test_wrong_default_group_or_profile_permissions_are_rejected(self):
        self.signature['keychain-access-groups'] = ['PREFIX1234.com.example.other']
        with self.assertRaisesRegex(ValueError, 'default Keychain group'):
            self.validate()
        self.signature['keychain-access-groups'] = [self.app_id]
        self.profile['Entitlements']['keychain-access-groups'] = ['OTHERPREF.*']
        with self.assertRaisesRegex(ValueError, 'does not allow'):
            self.validate()

    def test_foreign_team_and_debugger_capability_are_rejected(self):
        other = copy.deepcopy(self.signature)
        other['com.apple.developer.team-identifier'] = 'OTHER12345'
        with self.assertRaisesRegex(ValueError, 'different Apple'):
            self.validate(signature=other)
        self.signature['get-task-allow'] = True
        with self.assertRaisesRegex(ValueError, 'debugger'):
            self.validate()


if __name__ == '__main__':
    unittest.main()
