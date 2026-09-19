"""Offline tests for CI-only simulator recovery; no Apple tools are executed."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('simulator_session', Path(__file__).resolve().parents[2] / 'scripts/ci/simulator-session.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

RUNTIME = 'com.apple.CoreSimulator.SimRuntime.iOS-26-5'
TYPE = 'com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro'
BUNDLE = 'com.krabople.bellywise'
INVENTORY = {
    'runtimes': [
        {'identifier': RUNTIME, 'version': '26.5', 'name': 'iOS 26.5', 'isAvailable': True},
        {'identifier': 'com.apple.CoreSimulator.SimRuntime.iOS-27-0', 'version': '27.0', 'name': 'iOS 27 beta', 'isAvailable': True},
    ],
    'devicetypes': [{'identifier': TYPE, 'name': 'iPhone 16 Pro', 'minRuntimeVersionString': '18.0'}],
    'devices': {},
}
FINISHED = 'Status=4294967295, isTerminal=YES, Elapsed=00:14.\nFinished\n'
MIGRATION_FAILURE = 'Status=3, isTerminal=YES, Elapsed=01:41.\nData Migration Failed\n'


class SimulatorTests(unittest.TestCase):
    def test_terminal_failure_with_zero_exit_is_rejected(self):
        self.assertFalse(module.boot_completed(0, MIGRATION_FAILURE))
        self.assertFalse(module.boot_completed(0, 'Status=3, isTerminal=YES\nFinished'))
        self.assertFalse(module.boot_completed(124, FINISHED))
        self.assertFalse(module.boot_completed(0, 'Waiting on Data Migration'))
        self.assertTrue(module.boot_completed(0, FINISHED))
        self.assertTrue(module.boot_completed(0, 'Device already booted, nothing to do.'))

    def test_sdk_compatible_stable_runtime(self):
        self.assertEqual(module.select_device(INVENTORY, '26.5'), (RUNTIME, TYPE))
        with self.assertRaises(RuntimeError):
            module.select_device(INVENTORY, '26.4')
        self.assertEqual(module.select_device(INVENTORY, '27.0'), (RUNTIME, TYPE))

    def test_launch_requires_matching_bundle_and_success(self):
        self.assertEqual(module.launch_pid(0, BUNDLE + ': 12345\n', BUNDLE), 12345)
        self.assertIsNone(module.launch_pid(1, BUNDLE + ': 12345', BUNDLE))
        self.assertIsNone(module.launch_pid(0, 'another.app: 12345', BUNDLE))
        self.assertIsNone(module.launch_pid(0, 'FBSOpenApplicationServiceErrorDomain: 1', BUNDLE))

    def scenario(self, outcomes, launches=None):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        session = module.Session(temporary.name, BUNDLE)
        commands = []
        created = []
        boots = iter(outcomes)
        launch_results = iter(launches) if launches else None

        def simctl(*args, name, timeout=45):
            commands.append(args)
            if args[0] == 'list':
                return 0, json.dumps(INVENTORY)
            if args[0] == 'create':
                device = f'00000000-0000-0000-0000-{len(created) + 1:012d}'
                created.append(device)
                return 0, device
            if args[0] == 'bootstatus':
                return next(boots)
            if args[0] == 'launch':
                return next(launch_results) if launch_results else (0, BUNDLE + ': 12345')
            return 0, ''

        session.simctl = simctl
        session.diagnose = lambda name='final': None
        session.report = lambda message: None
        return session, commands, created

    @patch.dict(os.environ, {'GITHUB_ACTIONS': 'true'})
    @patch.object(module.time, 'sleep')
    def test_migration_failure_reboots_same_owned_device_then_launches(self, _sleep):
        session, commands, created = self.scenario([(0, MIGRATION_FAILURE), (0, FINISHED)])
        session.start('/compiled/Bellywise.app', '26.5')
        self.assertEqual(len(created), 1)
        self.assertEqual(session.state['pid'], 12345)
        self.assertEqual(len([c for c in commands if c[0] == 'install']), 1)
        self.assertEqual(len([c for c in commands if c[0] == 'shutdown']), 1)

    @patch.dict(os.environ, {'GITHUB_ACTIONS': 'true'})
    @patch.object(module.time, 'sleep')
    def test_exhausted_first_device_uses_fresh_device_without_rebuild(self, _sleep):
        session, commands, created = self.scenario([(0, MIGRATION_FAILURE), (0, MIGRATION_FAILURE), (0, FINISHED)])
        session.start('/compiled/Bellywise.app', '26.5')
        self.assertEqual(len(created), 2)
        self.assertEqual(session.state['device'], created[1])
        session.cleanup()
        deleted = [c[1] for c in commands if c[0] == 'delete']
        self.assertEqual(deleted, created)

    @patch.dict(os.environ, {'GITHUB_ACTIONS': 'true'})
    @patch.object(module.time, 'sleep')
    def test_launch_denial_collects_diagnostics_then_reboots(self, _sleep):
        denial = 'FBSOpenApplicationServiceErrorDomain: The request was denied by service delegate (SBMainWorkspace).'
        session, commands, created = self.scenario([(0, FINISHED)] * 2, [(1, denial), (0, BUNDLE + ': 12345')])
        diagnostics = []
        session.diagnose = lambda name: diagnostics.append(name)
        session.start('/compiled/Bellywise.app', '26.5')
        self.assertEqual(len(created), 1)
        self.assertEqual(len(diagnostics), 1)
        self.assertEqual(session.state['pid'], 12345)
        self.assertEqual(len([c for c in commands if c[0] == 'install']), 2)

    def test_launch_failure_diagnostics_do_not_require_app_pid(self):
        session, commands, _created = self.scenario([])
        device = '00000000-0000-0000-0000-000000000001'
        session.state.update(created=[device], device=device, pid=None)
        session.command = lambda *args, **kwargs: (0, '')
        module.Session.diagnose(session)
        log_command = next(c for c in commands if c[:3] == ('spawn', device, 'log'))
        self.assertIn('SpringBoard', log_command[-1])
        self.assertIn('amfid', log_command[-1])
        self.assertIn(BUNDLE, log_command[-1])

    @patch.dict(os.environ, {'GITHUB_ACTIONS': 'true'})
    @patch.object(module.time, 'sleep')
    def test_recovery_is_bounded_and_never_installs_after_bad_boot(self, _sleep):
        session, commands, created = self.scenario([(0, MIGRATION_FAILURE)] * 4)
        with self.assertRaisesRegex(RuntimeError, 'two fresh devices'):
            session.start('/compiled/Bellywise.app', '26.5')
        self.assertEqual(len(created), 2)
        self.assertEqual(len([c for c in commands if c[0] == 'bootstatus']), 4)
        self.assertFalse(any(c[0] in ('install', 'launch') for c in commands))

    @patch.dict(os.environ, {'GITHUB_ACTIONS': 'false'})
    def test_local_user_devices_cannot_be_mutated(self):
        session, commands, _created = self.scenario([])
        with self.assertRaisesRegex(RuntimeError, 'restricted to GitHub Actions'):
            session.start('/compiled/Bellywise.app', '26.5')
        self.assertEqual(commands, [])


if __name__ == '__main__':
    unittest.main()
