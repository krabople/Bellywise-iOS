#!/usr/bin/env bash
set -euo pipefail

# Unsigned native compilation and startup smoke check. Run on macOS.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
APP_DIR="$REPO_DIR/foodprint"
ARTIFACT_DIR="$REPO_DIR/artifacts"
BUILD_DIR="$ARTIFACT_DIR/ios-derived-data"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "The iOS compilation check requires macOS with Xcode 26.4 or later." >&2
  exit 1
fi

export CI=1
mkdir -p "$ARTIFACT_DIR"
# Runner defaults can change; explicitly select a compatible installed stable Xcode.
DEVELOPER_DIR="$(python3 - <<'PY'
import glob, os, re, subprocess, sys
from pathlib import Path
candidates = []
seen = set()
for app in glob.glob('/Applications/Xcode*.app'):
    developer = str(Path(app, 'Contents/Developer').resolve())
    if developer in seen or 'beta' in (app + developer).lower():
        continue
    seen.add(developer)
    try:
        output = subprocess.check_output(['xcodebuild', '-version'], env={**os.environ, 'DEVELOPER_DIR': developer}, text=True, stderr=subprocess.STDOUT, timeout=20)
        match = re.search(r'^Xcode\s+(\d+(?:\.\d+)*)', output, re.M)
        if match:
            version = tuple(int(part) for part in match[1].split('.'))
            if version >= (26, 4):
                candidates.append((version, developer))
    except (OSError, subprocess.SubprocessError):
        pass
if not candidates:
    sys.exit('No installed stable Xcode 26.4 or later was found.')
print(max(candidates)[1])
PY
)"
export DEVELOPER_DIR
cd "$APP_DIR"
node --version
xcodebuild -version | tee "$ARTIFACT_DIR/xcode-version.log"
if [[ "${SKIP_IOS_SETUP:-0}" == '1' ]]; then
  # The signing workflow has already generated the project and installed pods once.
  test -f ios/Podfile.properties.json
  test -f ios/Podfile.lock
else
  npx expo prebuild --platform ios --no-install 2>&1 | tee "$ARTIFACT_DIR/prebuild.log"
  (
    cd ios
    pod install 2>&1 | tee "$ARTIFACT_DIR/pod-install.log"
  )
fi
node -e "const p=require('./ios/Podfile.properties.json'); if(p['expo.sqlite.useSQLCipher']!=='true') throw new Error('SQLCipher is disabled in generated iOS configuration');"

# Fail clearly if either of the two app-specific native features disappeared.
grep -q 'FoodprintVision' ios/Podfile.lock
grep -q 'SQLITE_HAS_CODEC' 'ios/Pods/Target Support Files/ExpoSQLite/ExpoSQLite.release.xcconfig'

WORKSPACE="$(find "$APP_DIR/ios" -maxdepth 1 -type d -name '*.xcworkspace' -print -quit)"
if [[ -z "$WORKSPACE" ]]; then
  echo "Expo prebuild did not generate an Xcode workspace." >&2
  exit 1
fi
SCHEME="$(basename "$WORKSPACE" .xcworkspace)"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$BUILD_DIR" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  build 2>&1 | tee "$ARTIFACT_DIR/ios-build.log"

SIMULATOR_APP="$(find "$BUILD_DIR/Build/Products/Release-iphonesimulator" -maxdepth 1 -type d -name '*.app' -print -quit)"
if [[ -z "$SIMULATOR_APP" ]]; then
  echo "The simulator build did not produce an application." >&2
  exit 1
fi
ditto -c -k --sequesterRsrc --keepParent "$SIMULATOR_APP" "$ARTIFACT_DIR/Bellywise-simulator.zip"

BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$SIMULATOR_APP/Info.plist")"
APP_PROCESS="$(/usr/libexec/PlistBuddy -c 'Print CFBundleExecutable' "$SIMULATOR_APP/Info.plist")"
xcrun simctl list devices available --json > "$ARTIFACT_DIR/simulator-devices.json"
SIMULATOR_ID="$(python3 - "$ARTIFACT_DIR/simulator-devices.json" <<'PY'
import json, re, sys
data = json.load(open(sys.argv[1]))
candidates = []
for runtime, devices in data['devices'].items():
    match = re.search(r'iOS-(\d+(?:-\d+)*)$', runtime)
    if not match:
        continue
    version = tuple(int(part) for part in match[1].split('-'))
    for device in devices:
        if device.get('isAvailable') and device.get('name', '').startswith('iPhone'):
            candidates.append((version, device.get('state') == 'Shutdown', device['name'], device['udid']))
if not candidates:
    sys.exit('No available iPhone simulator was found for this Xcode.')
print(max(candidates)[3])
PY
)"
BOOTED_BY_SCRIPT=0
APP_PID=''

collect_simulator_diagnostics() {
  local result=$?
  trap - EXIT
  set +e
  if [[ -n "$APP_PID" ]]; then
    xcrun simctl spawn "$SIMULATOR_ID" log show --last 3m --style compact --predicate "processID == $APP_PID" > "$ARTIFACT_DIR/app-system.log" 2>&1
  fi
  if [[ "$result" -ne 0 ]]; then
    xcrun simctl io "$SIMULATOR_ID" screenshot --type=png "$ARTIFACT_DIR/Bellywise-startup-failure.png" > "$ARTIFACT_DIR/failure-screenshot.log" 2>&1
  fi
  xcrun simctl spawn "$SIMULATOR_ID" launchctl list > "$ARTIFACT_DIR/simulator-processes.log" 2>&1
  # Keep crash reports from this fresh CI application run when available.
  python3 - "$APP_PROCESS" "$ARTIFACT_DIR" <<'PY'
import shutil, sys, time
from pathlib import Path
for report in (Path.home() / 'Library/Logs/DiagnosticReports').glob(sys.argv[1] + '*'):
    if report.is_file() and time.time() - report.stat().st_mtime < 600:
        shutil.copy2(report, Path(sys.argv[2]) / report.name)
PY
  xcrun simctl status_bar "$SIMULATOR_ID" clear > /dev/null 2>&1
  xcrun simctl terminate "$SIMULATOR_ID" "$BUNDLE_ID" > /dev/null 2>&1
  if [[ "$BOOTED_BY_SCRIPT" -eq 1 ]]; then
    xcrun simctl shutdown "$SIMULATOR_ID" > /dev/null 2>&1
  fi
  exit "$result"
}
trap collect_simulator_diagnostics EXIT

SIMULATOR_STATE="$(python3 - "$ARTIFACT_DIR/simulator-devices.json" "$SIMULATOR_ID" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
print(next(d['state'] for ds in data['devices'].values() for d in ds if d['udid'] == sys.argv[2]))
PY
)"
if [[ "$SIMULATOR_STATE" != 'Booted' ]]; then
  xcrun simctl boot "$SIMULATOR_ID"
  BOOTED_BY_SCRIPT=1
fi
xcrun simctl bootstatus "$SIMULATOR_ID" -b 2>&1 | tee "$ARTIFACT_DIR/simulator-boot.log"
xcrun simctl ui "$SIMULATOR_ID" appearance light
xcrun simctl status_bar "$SIMULATOR_ID" override --time '9:41' --dataNetwork wifi --wifiMode active --wifiBars 3 --batteryState charged --batteryLevel 100
xcrun simctl install "$SIMULATOR_ID" "$SIMULATOR_APP"
touch "$ARTIFACT_DIR/app-stdout.log" "$ARTIFACT_DIR/app-stderr.log"
if ! LAUNCH_OUTPUT="$(xcrun simctl launch --terminate-running-process --stdout="$ARTIFACT_DIR/app-stdout.log" --stderr="$ARTIFACT_DIR/app-stderr.log" "$SIMULATOR_ID" "$BUNDLE_ID" 2>&1)"; then
  printf '%s\n' "$LAUNCH_OUTPUT" | tee "$ARTIFACT_DIR/app-launch.log"
  exit 1
fi
printf '%s\n' "$LAUNCH_OUTPUT" | tee "$ARTIFACT_DIR/app-launch.log"
APP_PID="$(printf '%s\n' "$LAUNCH_OUTPUT" | tail -1 | awk -F': ' '{print $NF}')"
if [[ ! "$APP_PID" =~ ^[0-9]+$ ]]; then
  echo "Could not identify the simulator application's process ID." >&2
  exit 1
fi

# The Release app must start using its embedded JS bundle, encrypted database and fonts.
sleep 8
if ! kill -0 "$APP_PID" 2>/dev/null; then
  echo "Bellywise exited during initial startup." >&2
  exit 1
fi
xcrun simctl io "$SIMULATOR_ID" screenshot --type=png "$ARTIFACT_DIR/Bellywise-native-welcome.png" 2>&1 | tee "$ARTIFACT_DIR/screenshot.log"
sleep 5
if ! kill -0 "$APP_PID" 2>/dev/null; then
  echo "Bellywise exited after its first rendered frame." >&2
  exit 1
fi
if grep -Eiq 'Unhandled JS Exception|Invariant Violation|RCTFatal|No bundle URL present|Unable to load script|Failed to load bundle' "$ARTIFACT_DIR/app-stderr.log" "$ARTIFACT_DIR/app-stdout.log"; then
  echo "A fatal React Native startup error was found in the application logs." >&2
  exit 1
fi
printf 'PASS: %s remained alive as process %s after 13 seconds.\nScreenshot: Bellywise-native-welcome.png\n' "$BUNDLE_ID" "$APP_PID" | tee "$ARTIFACT_DIR/native-smoke.log"
echo "Unsigned simulator build and startup check completed. This artifact is not a TestFlight archive."
