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
    def test_launch_denial_after_healthy_boot_captures_diagnostics_and_stops(self, _sleep):
        denial = 'FBSOpenApplicationServiceErrorDomain: The request was denied by service delegate (SBMainWorkspace).'
        session, commands, created = self.scenario([(0, FINISHED)] * 2, [(1, denial), (0, BUNDLE + ': 12345')])
        diagnostics = []
        session.diagnose = lambda name: diagnostics.append(name)
        with self.assertRaisesRegex(RuntimeError, 'same compiled app will not be retried'):
            session.start('/compiled/Bellywise.app', '26.5')
        self.assertEqual(len(created), 1)
        self.assertEqual(len(diagnostics), 1)
        self.assertIsNone(session.state['pid'])
        self.assertEqual(len([c for c in commands if c[0] == 'install']), 1)
        self.assertEqual(len([c for c in commands if c[0] == 'launch']), 1)

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

    def test_ips_header_and_body_preserve_exact_exception_and_termination(self):
        header = {'bug_type': '309', 'bundleID': BUNDLE, 'incident_id': 'incident-123'}
        body = {'procName': 'Bellywise', 'pid': 44, 'captureTime': '2026-09-19 13:00:00 +0000',
                'exception': {'type': 'EXC_BAD_ACCESS', 'signal': 'SIGKILL (Code Signature Invalid)'},
                'termination': {'namespace': 'CODESIGNING', 'code': 2, 'indicator': 'Invalid Page'},
                'asi': {'dyld': ['Library not loaded: exact diagnostic reason']},
                'threads': [{'unneeded': 'private bulky backtrace'}], 'crashReporterKey': 'omit-hardware-key'}
        details = module.crash_details(json.dumps(header) + '\n' + json.dumps(body, indent=2), BUNDLE)
        self.assertEqual(details['exception'], body['exception'])
        self.assertEqual(details['termination'], body['termination'])
        self.assertEqual(details['asi'], body['asi'])
        self.assertEqual(details['incident'], 'incident-123')
        self.assertNotIn('threads', details)
        self.assertNotIn('crashReporterKey', details)

    def test_ips_early_loader_crash_without_bundle_info_is_not_lost(self):
        raw = json.dumps({'bug_type': 309, 'app_name': 'Bellywise'}) + '\n' + json.dumps({'procName': 'Bellywise', 'termination': {'namespace': 'DYLD', 'code': 1}})
        self.assertEqual(module.crash_details(raw, BUNDLE)['termination']['namespace'], 'DYLD')

    def test_ips_rejects_wrong_app_noncrash_and_malformed_reports(self):
        body = json.dumps({'procName': 'Bellywise'})
        self.assertIsNone(module.crash_details(json.dumps({'bug_type': 288, 'bundleID': BUNDLE}) + '\n' + body, BUNDLE))
        self.assertIsNone(module.crash_details(json.dumps({'bug_type': 309, 'bundleID': 'different.app'}) + '\n' + body, BUNDLE))
        self.assertIsNone(module.crash_details(json.dumps({'bug_type': 309}) + '\n' + json.dumps({'procName': 'Other'}), BUNDLE))
        with self.assertRaises(ValueError):
            module.crash_details('{not JSON}', BUNDLE)

    def test_application_filter_excludes_log_queries_and_unrelated_entitlement_noise(self):
        critical = 'SpringBoard[111] ' + BUNDLE + ' launch failed: signature invalid'
        lines = [critical,
                 'backboardd[2] com.apple.Photos entitlements:0x0',
                 'neagent[2] Failed to find ' + BUNDLE + ' in LaunchServices',
                 'log run noninteractively: --predicate ' + BUNDLE + ' AND error',
                 'ReportCrash[2] ' + BUNDLE + ' is not a MetricKit client',
                 'Bellywise[44] dyld: Library not loaded: exact missing dependency']
        self.assertEqual(module.application_error_lines('\n'.join(lines), BUNDLE), [critical, lines[-1]])

    def test_simulator_and_host_lines_have_independent_budgets(self):
        simulator = '\n'.join(f'SpringBoard[1] {BUNDLE} error {i}' for i in range(30))
        host = '\n'.join(f'CoreSimulator[1] {BUNDLE} error {i}' for i in range(50))
        self.assertEqual(len(module.application_error_lines(simulator, BUNDLE)), 12)
        self.assertEqual(len(module.application_error_lines(host, BUNDLE)), 12)
        self.assertIn('error 29', module.application_error_lines(simulator, BUNDLE)[-1])

    def test_crash_collection_excludes_old_and_other_app_reports(self):
        session, _commands, _created = self.scenario([])
        messages = []
        session.report = messages.append
        session.state['launchStarted'] = 1000
        with tempfile.TemporaryDirectory() as temporary:
            home = Path(temporary)
            reports = home / 'Library/Logs/DiagnosticReports'
            reports.mkdir(parents=True)
            for name, timestamp, bundle in [('Bellywise-old.ips', 900, BUNDLE), ('Bellywise-fresh.ips', 1001, BUNDLE), ('Bellywise-other.ips', 1001, 'other.app')]:
                path = reports / name
                path.write_text(json.dumps({'bug_type': 309, 'bundleID': bundle}) + '\n' + json.dumps({'procName': 'Bellywise', 'exception': {'type': 'EXC_CRASH'}, 'termination': {'namespace': 'DYLD', 'code': 1}}))
                os.utime(path, (timestamp, timestamp))
            with patch.object(module.Path, 'home', return_value=home):
                found = session.crash_reports('test')
        self.assertEqual([d['file'] for d in found], ['Bellywise-fresh.ips'])
        self.assertTrue(any('CRASH termination:' in line and 'DYLD' in line for line in messages))


if __name__ == '__main__':
    unittest.main()
