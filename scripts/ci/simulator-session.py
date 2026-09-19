#!/usr/bin/env python3
"""Own only fresh CI simulators; bound recovery without rebuilding or weakening signing."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import uuid


def version(value):
    match = re.match(r"^(\d+(?:\.\d+)*)", str(value))
    return tuple((list(map(int, match[1].split('.'))) + [0, 0])[:3]) if match else (0, 0, 0)


def select_device(data, sdk):
    """Prefer an installed stable runtime no newer than the selected Xcode's SDK."""
    runtimes = [r for r in data['runtimes'] if r.get('isAvailable') and
                '.iOS-' in r.get('identifier', '') and
                not re.search(r'beta|preview|release candidate', json.dumps(r), re.I) and
                version(r.get('version')) <= version(sdk)]
    for runtime in sorted(runtimes, key=lambda r: version(r['version']), reverse=True):
        supported = {d['identifier'] for d in runtime.get('supportedDeviceTypes', [])}
        existing = {d.get('deviceTypeIdentifier') for d in data.get('devices', {}).get(runtime['identifier'], []) if d.get('isAvailable')}
        candidates = []
        for device in data['devicetypes']:
            if not device.get('name', '').startswith('iPhone'):
                continue
            if supported and device['identifier'] not in supported:
                continue
            if not supported and existing and device['identifier'] not in existing:
                continue
            if version(device.get('minRuntimeVersionString', '0')) > version(runtime['version']):
                continue
            if device.get('maxRuntimeVersionString') and version(device['maxRuntimeVersionString']) < version(runtime['version']):
                continue
            candidates.append(device)
        if candidates:
            # A conventional screen size also keeps the welcome CTA in the screenshot.
            chosen = max(candidates, key=lambda d: (d['name'] == 'iPhone 16 Pro', d['name'] == 'iPhone 16', d['name']))
            return runtime['identifier'], chosen['identifier']
    raise RuntimeError('No compatible available stable iPhone runtime at or below the selected simulator SDK.')


def boot_completed(returncode, output):
    # simctl may return zero even for terminal Status=3 / Data Migration Failed.
    if returncode or re.search(r'\bfailed\b|\bfailure\b|\berror\b', output, re.I):
        return False
    terminals = re.findall(r'Status=(\d+),\s*isTerminal=YES', output)
    if terminals and any(status != '4294967295' for status in terminals):
        return False
    return bool(re.search(r'\bFinished\b|Device already booted, nothing to do', output, re.I))


def launch_pid(returncode, output, bundle):
    if returncode:
        return None
    match = re.search(r'^' + re.escape(bundle) + r':\s*([1-9]\d*)\s*$', output, re.M)
    return int(match[1]) if match else None


def crash_details(raw, bundle):
    """Apple IPS crash reports contain a one-line metadata JSON and a report JSON."""
    first_line, separator, remainder = raw.partition('\n')
    if not separator:
        raise ValueError('IPS report has no crash-data JSON after its metadata.')
    metadata, report = json.loads(first_line), json.loads(remainder)
    if not isinstance(metadata, dict) or not isinstance(report, dict):
        raise ValueError('IPS metadata and crash data must both be JSON objects.')
    if str(metadata.get('bug_type')) != '309':
        return None
    identifiers = [metadata.get('bundleID'), report.get('bundleInfo', {}).get('CFBundleIdentifier')]
    if any(value and value != bundle for value in identifiers):
        return None
    # Very early loader/signature crashes can lack bundleInfo; the fresh CI process
    # name and Bellywise*.ips filename still identify these otherwise lost reports.
    if report.get('procName', metadata.get('name', metadata.get('app_name'))) != 'Bellywise':
        return None
    # Keep diagnostic fields exact; omit thread dumps, paths, hardware IDs and environment.
    keys = ('procName', 'pid', 'procLaunch', 'captureTime', 'cpuType', 'exception', 'termination',
            'asi', 'faultingThread')
    details = {key: report[key] for key in keys if key in report}
    details['incident'] = report.get('incident', metadata.get('incident_id'))
    return details


def application_error_lines(output, bundle, limit=12):
    """Select each source independently so host chatter cannot evict simulator evidence."""
    identity = re.compile(re.escape(bundle) + r'|\bBellywise(?:\.app|\[|\b)', re.I)
    relevant = re.compile(r'error|fail|denied|invalid|signature|codesign|dyld|amfi|entitle|killed|abort|exception|terminat|crash|exit', re.I)
    noise = re.compile(r'log run noninteractively|\b(?:neagent|nehelper|nesessionmanager)\[|not a MetricKit client|Targeted mode .* not available', re.I)
    lines = []
    for line in output.splitlines():
        if identity.search(line) and relevant.search(line) and not noise.search(line):
            if line not in lines:
                lines.append(line)
    return lines[-limit:]


class Session:
    def __init__(self, directory, bundle):
        self.directory = Path(directory)
        self.path = self.directory / 'simulator-session.json'
        self.bundle = bundle
        self.state = json.loads(self.path.read_text()) if self.path.exists() else {'created': []}

    def save(self):
        self.path.write_text(json.dumps(self.state, indent=2))

    def report(self, message):
        print(message, flush=True)
        with (self.directory / 'native-smoke.log').open('a') as stream:
            stream.write(message + '\n')

    def command(self, args, name, timeout=45):
        try:
            result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=timeout)
            code, output = result.returncode, result.stdout
        except subprocess.TimeoutExpired as error:
            output = error.stdout or b''
            if isinstance(output, bytes):
                output = output.decode('utf-8', errors='replace')
            code, output = 124, output + f'\nCommand timed out after {timeout}s.\n'
        (self.directory / (name + '.log')).write_text(output)
        return code, output

    def simctl(self, *args, name, timeout=45):
        return self.command(['xcrun', 'simctl', *args], name, timeout)

    def crash_reports(self, name):
        found = []
        errors = []
        since = self.state.get('launchStarted', self.state.get('startedAt', time.time())) - 2
        reports = Path.home() / 'Library/Logs/DiagnosticReports'
        for path in sorted(reports.glob('Bellywise*.ips'), key=lambda p: p.stat().st_mtime, reverse=True):
            if path.stat().st_mtime < since:
                continue
            try:
                # Refuse unexpectedly huge reports instead of filling public CI logs.
                if path.stat().st_size > 20_000_000:
                    raise ValueError('report exceeds 20 MB')
                details = crash_details(path.read_text(encoding='utf-8-sig'), self.bundle)
                if details is None:
                    continue
                found.append({'file': path.name, **details})
                self.report(f'APP CRASH: {path.name}; pid={details.get("pid")}; captureTime={details.get("captureTime")}.')
                for field in ('exception', 'termination', 'asi'):
                    value = details.get(field)
                    self.report(f'CRASH {field}: ' + (json.dumps(value, ensure_ascii=True, sort_keys=True) if value is not None else 'not present'))
                if len(found) == 3:
                    break
            except (OSError, ValueError, TypeError, AttributeError) as error:
                errors.append(f'{path.name}: {error}')
        (self.directory / (name + '-crash-summary.json')).write_text(json.dumps(found, indent=2))
        for error in errors[:3]:
            self.report('CRASH REPORT READ ERROR: ' + error)
        if not found:
            self.report('APP CRASH: No fresh matching Bellywise .ips crash report found after this launch attempt.')
        return found

    def diagnose(self, name='simulator-final'):
        device = self.state.get('device')
        if not device or device not in self.state['created']:
            return
        # Capture service failures even when no application process was ever created.
        predicate = (f'eventMessage CONTAINS[c] "{self.bundle}" OR eventMessage CONTAINS[c] "Bellywise" OR '
                     'process IN {"SpringBoard", "runningboardd", "amfid", "securityd", "launchd", "installd", "migrationd", "datamigrator", "locationd"}')
        _, output = self.simctl('spawn', device, 'log', 'show', '--last', '3m', '--style', 'compact', '--info', '--predicate', predicate, name=name + '-system', timeout=40)
        _, host_output = self.command(['/usr/bin/log', 'show', '--last', '3m', '--style', 'compact', '--info', '--predicate',
            f'eventMessage CONTAINS[c] "{self.bundle}" OR eventMessage CONTAINS[c] "Bellywise" OR (process CONTAINS[c] "CoreSimulator" AND (eventMessage CONTAINS[c] "error" OR eventMessage CONTAINS[c] "failed"))'], name + '-host', timeout=30)
        self.report(f'DIAGNOSTICS: {name}; device {device}.')
        for source, logs in (('SIMULATOR', output), ('HOST', host_output)):
            lines = application_error_lines(logs, self.bundle)
            self.report(f'{source} APP ERRORS: {len(lines)} matching lines (each source filtered separately).')
            for line in lines:
                # Preserve both the outer failure and the innermost reason when very long.
                self.report(line if len(line) <= 2400 else line[:1200] + ' ... [middle truncated] ... ' + line[-1200:])
        if self.state.get('phase') == 'boot':
            migration = [line for line in output.splitlines() if re.search(r'migrat|locationd', line, re.I) and re.search(r'error|fail|denied|timeout|timed out', line, re.I)]
            self.report(f'MIGRATION ERRORS: {min(len(migration), 8)} matching lines.')
            for line in migration[-8:]:
                self.report(line[:1800])
        # Unified-log collection allows ReportCrash time to finish writing its JSON.
        self.crash_reports(name)
        self.simctl('io', device, 'screenshot', '--type=png', str(self.directory / 'Bellywise-startup-failure.png'), name=name + '-screenshot', timeout=20)
        self.simctl('spawn', device, 'launchctl', 'list', name=name + '-processes', timeout=20)

    def cleanup(self):
        # IDs are recorded immediately from `create`; never erase/reuse/delete user devices.
        for device in self.state['created']:
            if not re.fullmatch(r'[0-9a-fA-F-]{36}', device):
                raise RuntimeError('Invalid owned simulator ID; refusing cleanup.')
            self.simctl('shutdown', device, name='simulator-cleanup-shutdown', timeout=30)
            self.simctl('delete', device, name='simulator-cleanup-delete', timeout=30)

    def start(self, app, sdk):
        if os.environ.get('GITHUB_ACTIONS') != 'true':
            raise RuntimeError('Fresh-device simulator automation is restricted to GitHub Actions CI.')
        if self.state['created']:
            raise RuntimeError('A simulator session already exists; refusing to reuse it.')
        self.state['startedAt'] = time.time()
        self.save()
        code, output = self.simctl('list', '--json', name='simulator-inventory')
        if code:
            raise RuntimeError('Cannot list installed simulator runtimes.')
        runtime, device_type = select_device(json.loads(output), sdk)
        self.report(f'SIMULATOR: SDK {sdk}; runtime {runtime}; type {device_type}.')
        for fresh_attempt in (1, 2):
            name = f'Bellywise-CI-{os.environ.get("GITHUB_RUN_ID", "run")}-{uuid.uuid4().hex[:8]}'
            code, output = self.simctl('create', name, device_type, runtime, name=f'simulator-create-{fresh_attempt}')
            device = output.strip()
            if code or not re.fullmatch(r'[0-9a-fA-F-]{36}', device):
                self.report(f'RETRY: fresh simulator creation failed: {output.strip()[:600]}')
                continue
            self.state['created'].append(device)
            self.state.update(device=device, pid=None)
            self.save()
            for boot_attempt in (1, 2):
                tag = f'simulator-{fresh_attempt}-{boot_attempt}'
                self.report(f'STARTUP: fresh simulator {fresh_attempt}/2, boot {boot_attempt}/2.')
                self.state['phase'] = 'boot'
                self.save()
                if boot_attempt == 2:
                    self.simctl('shutdown', device, name=tag + '-shutdown', timeout=30)
                code, output = self.simctl('boot', device, name=tag + '-boot', timeout=45)
                if not code:
                    code, output = self.simctl('bootstatus', device, '-b', name=tag + '-bootstatus', timeout=240)
                if not boot_completed(code, output):
                    self.report('RETRY: simulator did not finish boot successfully: ' + ' '.join(output.splitlines()[-5:])[:900])
                    self.diagnose(tag)
                    continue
                # Allow SpringBoard services to settle after a first-run migration.
                time.sleep(5)
                self.simctl('ui', device, 'appearance', 'light', name=tag + '-appearance')
                self.simctl('status_bar', device, 'override', '--time', '9:41', '--dataNetwork', 'wifi', '--wifiMode', 'active', '--wifiBars', '3', '--batteryState', 'charged', '--batteryLevel', '100', name=tag + '-status')
                self.state['phase'] = 'install'
                self.save()
                code, output = self.simctl('install', device, str(app), name=tag + '-install', timeout=90)
                if code:
                    self.report('RETRY: simulator installation failed: ' + output.strip()[:900])
                    self.diagnose(tag)
                    continue
                self.state.update(phase='launch', launchStarted=time.time())
                self.save()
                code, output = self.simctl('launch', '--terminate-running-process',
                    '--stdout=' + str(self.directory / 'app-stdout.log'), '--stderr=' + str(self.directory / 'app-stderr.log'),
                    device, self.bundle, name='app-launch', timeout=45)
                pid = launch_pid(code, output, self.bundle)
                if pid:
                    self.state['pid'] = pid
                    self.save()
                    self.report(f'LAUNCHED: {self.bundle}, process {pid}. Welcome verification still required.')
                    return
                self.report('LAUNCH FAILURE AFTER HEALTHY BOOT: ' + output.strip()[:1500])
                self.diagnose(tag)
                raise RuntimeError('The app failed to launch after a confirmed healthy simulator boot. Diagnostics captured; the same compiled app will not be retried. Welcome verification did not pass.')
            self.simctl('shutdown', device, name=f'simulator-retire-{fresh_attempt}', timeout=30)
        raise RuntimeError('Simulator failed to boot/install/launch after two fresh devices and one reboot each. No application verification passed.')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['start', 'diagnose', 'cleanup'])
    parser.add_argument('--artifacts', required=True)
    parser.add_argument('--bundle', required=True)
    parser.add_argument('--app')
    parser.add_argument('--sdk')
    args = parser.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9.-]+', args.bundle):
        parser.error('Invalid bundle ID.')
    session = Session(args.artifacts, args.bundle)
    try:
        if args.action == 'start':
            if not args.app or not args.sdk:
                parser.error('start requires --app and --sdk.')
            session.start(args.app, args.sdk)
        elif args.action == 'diagnose':
            session.diagnose()
        else:
            session.cleanup()
    except (RuntimeError, OSError, ValueError, KeyError) as error:
        session.report('FAIL: ' + str(error))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
