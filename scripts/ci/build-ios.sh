#!/usr/bin/env bash
set -euo pipefail

# Xcode simulator compilation, embedded entitlements and verified welcome screen.
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
# Compile/typecheck the CI-only OCR helper before spending time compiling the app.
xcrun --sdk macosx swiftc -swift-version 5 "$SCRIPT_DIR/read-simulator-screen.swift" -o "$ARTIFACT_DIR/read-simulator-screen"
node --test "$APP_DIR/tests/native-screen.test.mjs"
python3 "$APP_DIR/tests/test_simulator_session.py"
python3 "$APP_DIR/tests/test_simulator_entitlements.py"
SIMULATOR_ARCH="$(uname -m)"
if [[ "$SIMULATOR_ARCH" != 'arm64' && "$SIMULATOR_ARCH" != 'x86_64' ]]; then
  echo "Unsupported simulator host architecture: $SIMULATOR_ARCH" >&2
  exit 1
fi
echo 'Compiling the Release simulator app with Xcode local signing...'
if xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$BUILD_DIR" \
  ARCHS="$SIMULATOR_ARCH" \
  ONLY_ACTIVE_ARCH=YES \
  CODE_SIGNING_ALLOWED=YES \
  CODE_SIGN_IDENTITY=- \
  build > "$ARTIFACT_DIR/ios-build.log" 2>&1; then
  echo 'Release simulator compilation succeeded.'
else
  result=$?
  tail -n 100 "$ARTIFACT_DIR/ios-build.log"
  exit "$result"
fi

SIMULATOR_APP="$(find "$BUILD_DIR/Build/Products/Release-iphonesimulator" -maxdepth 1 -type d -name '*.app' -print -quit)"
if [[ -z "$SIMULATOR_APP" ]]; then
  echo "The simulator build did not produce an application." >&2
  exit 1
fi
BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$SIMULATOR_APP/Info.plist")"
APP_PROCESS="$(/usr/libexec/PlistBuddy -c 'Print CFBundleExecutable' "$SIMULATOR_APP/Info.plist")"
# Let Xcode place iOS simulator entitlements in __TEXT,__entitlements. Injecting
# them into a macOS ad-hoc code signature is not equivalent and can deny launch.
# Do not rewrite Xcode's signatures or any generated device signing settings.
codesign --verify --deep --strict "$SIMULATOR_APP"
SIMULATOR_TEAM="${TEAM_ID:-$(node -p "require('./app.json').expo.ios.appleTeamId")}"
python3 "$SCRIPT_DIR/verify-simulator-entitlements.py" \
  --binary "$SIMULATOR_APP/$APP_PROCESS" --bundle-id "$BUNDLE_ID" --team-id "$SIMULATOR_TEAM"
if [[ "${SKIP_IOS_SETUP:-0}" != '1' ]]; then
  # Standalone private CI keeps the simulator app; the public release job must not.
  ditto -c -k --sequesterRsrc --keepParent "$SIMULATOR_APP" "$ARTIFACT_DIR/Bellywise-simulator.zip"
fi
SIMULATOR_ID=''
APP_PID=''

collect_simulator_diagnostics() {
  local result=$?
  trap - EXIT
  set +e
  if [[ "$result" -ne 0 ]]; then
    printf '\nFAIL: Native verification exited with status %s.\n' "$result" | tee -a "$ARTIFACT_DIR/native-smoke.log" >&2
    python3 "$SCRIPT_DIR/simulator-session.py" diagnose --artifacts "$ARTIFACT_DIR" --bundle "$BUNDLE_ID"
  elif [[ -n "$APP_PID" ]]; then
    xcrun simctl spawn "$SIMULATOR_ID" log show --last 3m --style compact --predicate "processID == $APP_PID" > "$ARTIFACT_DIR/app-system.log" 2>&1
  fi
  # Keep crash reports from this fresh CI application run when available.
  python3 - "$APP_PROCESS" "$ARTIFACT_DIR" <<'PY'
import shutil, sys, time
from pathlib import Path
for report in (Path.home() / 'Library/Logs/DiagnosticReports').glob(sys.argv[1] + '*'):
    if report.is_file() and time.time() - report.stat().st_mtime < 600:
        shutil.copy2(report, Path(sys.argv[2]) / report.name)
PY
  python3 "$SCRIPT_DIR/simulator-session.py" cleanup --artifacts "$ARTIFACT_DIR" --bundle "$BUNDLE_ID"
  exit "$result"
}
trap collect_simulator_diagnostics EXIT

# Create only new CI-owned devices. Recovery never rebuilds or re-signs the app.
# bootstatus's exit code alone is insufficient: it can return 0 after migration failure.
SIMULATOR_SDK="$(xcrun --sdk iphonesimulator --show-sdk-version)"
touch "$ARTIFACT_DIR/app-stdout.log" "$ARTIFACT_DIR/app-stderr.log"
python3 "$SCRIPT_DIR/simulator-session.py" start --artifacts "$ARTIFACT_DIR" \
  --bundle "$BUNDLE_ID" --app "$SIMULATOR_APP" --sdk "$SIMULATOR_SDK"
SIMULATOR_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["device"])' "$ARTIFACT_DIR/simulator-session.json")"
APP_PID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["pid"])' "$ARTIFACT_DIR/simulator-session.json")"

# The Release app must start using its embedded JS bundle, encrypted database and fonts.
sleep 8
if ! kill -0 "$APP_PID" 2>/dev/null; then
  echo "Bellywise exited during initial startup." >&2
  exit 1
fi
WELCOME_CONFIRMED=0
for attempt in 1 2 3 4 5 6; do
  xcrun simctl io "$SIMULATOR_ID" screenshot --type=png "$ARTIFACT_DIR/Bellywise-native-welcome.png" 2>&1 | tee "$ARTIFACT_DIR/screenshot.log"
  "$ARTIFACT_DIR/read-simulator-screen" "$ARTIFACT_DIR/Bellywise-native-welcome.png" > "$ARTIFACT_DIR/screen-ocr.json"
  if node "$SCRIPT_DIR/verify-native-screen.mjs" "$ARTIFACT_DIR/screen-ocr.json" > "$ARTIFACT_DIR/screen-verification.log" 2>&1; then
    cat "$ARTIFACT_DIR/screen-verification.log" | tee -a "$ARTIFACT_DIR/native-smoke.log"
    WELCOME_CONFIRMED=1
    break
  else
    screen_status=$?
    cat "$ARTIFACT_DIR/screen-verification.log" | tee -a "$ARTIFACT_DIR/native-smoke.log"
    # A detected storage/error screen is a hard failure. Only an unfinished render retries.
    if [[ "$screen_status" -ne 3 ]]; then exit "$screen_status"; fi
    if [[ "$attempt" -lt 6 ]]; then sleep 5; fi
  fi
done
if [[ "$WELCOME_CONFIRMED" -ne 1 ]]; then
  echo "FAIL: The app never displayed the complete expected welcome screen." | tee -a "$ARTIFACT_DIR/native-smoke.log" >&2
  exit 1
fi
sleep 5
if ! kill -0 "$APP_PID" 2>/dev/null; then
  echo "Bellywise exited after its first rendered frame." >&2
  exit 1
fi
if grep -Eiq 'Unhandled JS Exception|Invariant Violation|RCTFatal|No bundle URL present|Unable to load script|Failed to load bundle|KeyChainException|required entitlement is missing|Your saved data has not been replaced' "$ARTIFACT_DIR/app-stderr.log" "$ARTIFACT_DIR/app-stdout.log"; then
  echo "A fatal React Native startup error was found in the application logs." >&2
  exit 1
fi
printf 'PASS: %s remained alive as process %s after verified welcome rendering.\nScreenshot: Bellywise-native-welcome.png\n' "$BUNDLE_ID" "$APP_PID" | tee -a "$ARTIFACT_DIR/native-smoke.log"
echo "Xcode-signed simulator build and welcome verification completed. This artifact is not a TestFlight archive."
