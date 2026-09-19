#!/usr/bin/env bash
set -euo pipefail

# Unsigned native compilation. Run on macOS from any working directory.
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
cd "$APP_DIR"
node --version
xcodebuild -version
npx expo prebuild --platform ios --no-install 2>&1 | tee "$ARTIFACT_DIR/prebuild.log"
node -e "const p=require('./ios/Podfile.properties.json'); if(p['expo.sqlite.useSQLCipher']!=='true') throw new Error('SQLCipher is disabled in generated iOS configuration');"
(
  cd ios
  pod install 2>&1 | tee "$ARTIFACT_DIR/pod-install.log"
)

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
echo "Unsigned simulator build completed. This artifact is not a TestFlight archive."
