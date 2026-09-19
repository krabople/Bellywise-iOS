# Bellywise build and distribution status

Snapshot: 19 September 2026. Build 7 is available to the internal beta group and is waiting for Apple's first external Beta App Review. The configured external tester is assigned to the external group; Apple will send the email automatically when that build becomes installable.

## Repository and CI arrangement

The application source is in the private repository [krabople/Bellywise-iOS](https://github.com/krabople/Bellywise-iOS), on `main`. Repository privacy was checked through the GitHub API. Native signing runs through a dedicated manually dispatched workflow in the existing public [krabople/Lifetwine](https://github.com/krabople/Lifetwine) repository. The workflow reads the private source with a dedicated read-only deploy key and uses that repository's existing signing secrets. A private-source CI run was blocked by the account's billing limit, so the existing signing workflow is the execution path for native checks.

The initial [signing run 35440815207](https://github.com/krabople/Lifetwine/actions/runs/35440815207) compiled the native iOS app successfully, then stopped because the App Store Connect listing had not yet been created. The listing now exists as app `6813854695`, verified by the website and the next run's Apple API signing manifest.

[Run 35441642571](https://github.com/krabople/Lifetwine/actions/runs/35441642571), source `acd8754`, compiled the Release simulator app. Visual inspection found a Keychain entitlement error on its storage-error screen, although the process-only smoke check had passed. This was an unsigned simulator build. The run was cancelled during device archiving, before upload or distribution. A corrected simulator signing and screen-verification check is being prepared; no TestFlight-ready claim is made for this run.

The owner's internal beta group and beta review metadata are saved in App Store Connect. No tester email or review contact details are stored in this repository or public build logs.

The first submission omitted `ITSAppUsesNonExemptEncryption` so App Store Connect presented its export-compliance questions. The questionnaire recorded Bellywise's standard encryption and current non-France distribution scope; Apple cleared the build's missing-compliance state. Revisit the answers if encryption or distribution scope changes. [Apple key documentation](https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption)

## Completed build and current TestFlight state

[Run 35446283297](https://github.com/krabople/Lifetwine/actions/runs/35446283297), source `a02cf11`, completed successfully. It passed the JavaScript, analysis, signing and native simulator gates; launched the Xcode-built Release app; confirmed the welcome screen and primary action from the simulator screenshot; created and verified the signed device archive; uploaded the IPA; and waited for Apple processing.

Apple returned build ID `a452b284-2e07-4a4c-9a23-13523d897734`, version `1.0.0` build `7`, with `processingState=VALID`. The signed archive matched bundle `com.krabople.bellywise`, team `6YYA8L76Y8` and application identifier `6YYA8L76Y8.com.krabople.bellywise`. The build is assigned to the internal `Bellywise beta` group.

The external `Bellywise external beta` group is associated with build 7. [Administration run 35448434186](https://github.com/krabople/Lifetwine/actions/runs/35448434186), source `e566684`, verified `autoNotifyEnabled=true`, `externalBuildState=WAITING_FOR_BETA_REVIEW` and `betaReviewState=WAITING_FOR_REVIEW`. It also verified that the email-based tester is assigned to the external group. Apple rejected an immediate invitation while there was no installable external build, so the email is deferred until Beta App Review approves build 7; automatic notification is enabled for that transition.

[Run 35442820274](https://github.com/krabople/Lifetwine/actions/runs/35442820274), source `ea863a3`, passed all 60 automated tests, compiled the Release simulator app and verified its ad-hoc Keychain signature. The simulator then reported `Data Migration Failed` during boot and denied the app launch. The stricter gate correctly blocked archiving/upload. The captured screen shows the simulator home screen, not a working app. A fresh-device boot/recovery path is being added; the app's storage protections remain unchanged.

## Prepared workflow revision

[Run 35443777655](https://github.com/krabople/Lifetwine/actions/runs/35443777655), source `a0137ec`, compiled successfully. Fresh simulators recovered from initial migration issues, but healthy boots still rejected the application launch. The build script incorrectly placed iOS simulator entitlements in the macOS code signature after compilation. The corrected path lets Xcode perform local signing and embed simulated entitlements into the executable's `__TEXT,__entitlements` section, which is verified separately from its code signature. The native welcome check remains mandatory. No build from this run was uploaded.

`bellywise-testflight.workflow.yml` is a local template for the next installed workflow revision. Editing this file does not change an already-running GitHub Actions job.

The revision calls the shared `scripts/ci/build-ios.sh` with `SKIP_IOS_SETUP=1`, after a single prebuild and CocoaPods installation. It checks the native OCR module and SQLCipher configuration, builds a Release simulator app for the runner's architecture with embedded JavaScript, and lets Xcode perform local signing and embed its simulated application identity. It launches the app, watches for early exits or fatal logs, and requires screenshot text recognition to confirm the welcome screen and its primary action without storage-error text. The signed device archive is checked separately against its embedded provisioning profile. These checks establish startup and signing evidence; they do not establish camera accuracy, full accessibility, real-device performance or clinical validity.

After native verification, a fresh read-only Apple setup check looks for the app record again. A record created while the simulator was compiling can therefore be used by that job without another native rebuild. If no record is found, the workflow stops with an actionable message. The public Apple API cannot create the record. [Apple Apps API](https://developer.apple.com/documentation/appstoreconnectapi/apps)

The upload action's current v5 metadata supports `wait-for-processing`. A separate read-only helper, `scripts/ci/verify-testflight.mjs`, checks Apple for the exact app ID, build number, marketing version and iOS platform. It waits for `processingState=VALID`, rejects failed or expired builds, and records internal/external beta state separately. It does not add testers, assign groups, send invitations or claim external review is complete. [Official upload action metadata](https://github.com/Apple-Actions/upload-testflight-build/blob/v5/action.yml)

## Artifact boundaries

Treat artifacts from the public signing repository as accessible to people who can read that repository and download its artifacts; do not use them for private source or real diary information.

The native verification artifact allows only the captured welcome/failure screenshots, the concise smoke result and Xcode version. It excludes the source tree, simulator app ZIP, signed IPA, derived data, JavaScript bundles and full compilation logs. The signed IPA is passed directly from the runner's temporary directory to Apple's upload action and is not published as a GitHub artifact. Signing summaries and processing-state reports contain resource identifiers and status, without signing private keys or API tokens.

## Local verification of the revision

Offline tests cover Apple JWT signatures, credential-origin protection, certificate/profile matching, exact-build selection, failed processing and polling timeout. They require no real Apple secrets and do not call Apple. Native compilation and screenshots require the macOS runner; local Windows checks must not be described as an iOS build.

Update this status when Beta App Review changes from `WAITING_FOR_REVIEW`, or if Apple reports an external-review issue.
