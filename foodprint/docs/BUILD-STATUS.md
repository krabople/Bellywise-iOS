# Bellywise build and distribution status

Snapshot: 19 September 2026. This document records observed states; it is not a claim that TestFlight distribution has finished.

## Repository and CI arrangement

The application source is in the private repository [krabople/Bellywise-iOS](https://github.com/krabople/Bellywise-iOS), on `main`. Repository privacy was checked through the GitHub API. Native signing runs through a dedicated manually dispatched workflow in the existing public [krabople/Lifetwine](https://github.com/krabople/Lifetwine) repository. The workflow reads the private source with a dedicated read-only deploy key and uses that repository's existing signing secrets. A private-source CI run was blocked by the account's billing limit, so the existing signing workflow is the execution path for native checks.

The initial [signing run 35440815207](https://github.com/krabople/Lifetwine/actions/runs/35440815207) compiled the native iOS app successfully, then stopped because the App Store Connect listing had not yet been created. The listing now exists as app `6813854695`, verified by the website and the next run's Apple API signing manifest.

[Run 35441642571](https://github.com/krabople/Lifetwine/actions/runs/35441642571), source `acd8754`, compiled the Release simulator app. Visual inspection found a Keychain entitlement error on its storage-error screen, although the process-only smoke check had passed. This was an unsigned simulator build. The run was cancelled during device archiving, before upload or distribution. A corrected simulator signing and screen-verification check is being prepared; no TestFlight-ready claim is made for this run.

The owner's internal beta group and beta review metadata are saved in App Store Connect. External tester setup remains pending the first uploaded build and any required Apple beta review. No tester email or review contact details are stored in this repository or public build logs.

[Run 35442820274](https://github.com/krabople/Lifetwine/actions/runs/35442820274), source `ea863a3`, passed all 60 automated tests, compiled the Release simulator app and verified its ad-hoc Keychain signature. The simulator then reported `Data Migration Failed` during boot and denied the app launch. The stricter gate correctly blocked archiving/upload. The captured screen shows the simulator home screen, not a working app. A fresh-device boot/recovery path is being added; the app's storage protections remain unchanged.

## Prepared workflow revision

`bellywise-testflight.workflow.yml` is a local template for the next installed workflow revision. Editing this file does not change an already-running GitHub Actions job.

The revision calls the shared `scripts/ci/build-ios.sh` with `SKIP_IOS_SETUP=1`, after a single prebuild and CocoaPods installation. It checks the native OCR module and SQLCipher configuration, builds a Release simulator app for the runner's architecture with embedded JavaScript, and gives that simulator app an ad-hoc signature with its private Keychain group. It launches the app, watches for early exits or fatal logs, and requires screenshot text recognition to confirm the welcome screen and its primary action without storage-error text. The signed device archive is checked separately against its embedded provisioning profile. These checks establish startup and signing evidence; they do not establish camera accuracy, full accessibility, real-device performance or clinical validity.

After native verification, a fresh read-only Apple setup check looks for the app record again. A record created while the simulator was compiling can therefore be used by that job without another native rebuild. If no record is found, the workflow stops with an actionable message. The public Apple API cannot create the record. [Apple Apps API](https://developer.apple.com/documentation/appstoreconnectapi/apps)

The upload action's current v5 metadata supports `wait-for-processing`. A separate read-only helper, `scripts/ci/verify-testflight.mjs`, checks Apple for the exact app ID, build number, marketing version and iOS platform. It waits for `processingState=VALID`, rejects failed or expired builds, and records internal/external beta state separately. It does not add testers, assign groups, send invitations or claim external review is complete. [Official upload action metadata](https://github.com/Apple-Actions/upload-testflight-build/blob/v5/action.yml)

## Artifact boundaries

Treat artifacts from the public signing repository as accessible to people who can read that repository and download its artifacts; do not use them for private source or real diary information.

The native verification artifact allows only the captured welcome/failure screenshots, the concise smoke result and Xcode version. It excludes the source tree, simulator app ZIP, signed IPA, derived data, JavaScript bundles and full compilation logs. The signed IPA is passed directly from the runner's temporary directory to Apple's upload action and is not published as a GitHub artifact. Signing summaries and processing-state reports contain resource identifiers and status, without signing private keys or API tokens.

## Local verification of the revision

Offline tests cover Apple JWT signatures, credential-origin protection, certificate/profile matching, exact-build selection, failed processing and polling timeout. They require no real Apple secrets and do not call Apple. Native compilation and screenshots require the macOS runner; local Windows checks must not be described as an iOS build.

Update this status with the final run link, source commit, archive/upload outcome, Apple build ID and observed processing/tester availability after the next workflow completes.
