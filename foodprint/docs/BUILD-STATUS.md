# Bellywise build and distribution status

Snapshot: 19 September 2026. This document records observed states; it is not a claim that TestFlight distribution has finished.

## Repository and CI arrangement

The application source is in the private repository [krabople/Bellywise-iOS](https://github.com/krabople/Bellywise-iOS), on `main`. Repository privacy was checked through the GitHub API. Native signing runs through a dedicated manually dispatched workflow in the existing public [krabople/Lifetwine](https://github.com/krabople/Lifetwine) repository. The workflow reads the private source with a dedicated read-only deploy key and uses that repository's existing signing secrets. A private-source CI run was blocked by the account's billing limit, so the existing signing workflow is the execution path for native checks.

At the last API-checked snapshot, [signing run 35440815207](https://github.com/krabople/Lifetwine/actions/runs/35440815207) was in progress in its iPhone Simulator build. Source checkout, JavaScript validation, iOS project generation, certificate import, provisioning setup and CocoaPods installation had succeeded. No signed archive, upload or successful Apple processing result had been observed at that snapshot. Initial provisioning setup did not find the App Store Connect app record. The App Store Connect website subsequently confirmed that Bellywise was created; the next workflow's API refresh will verify the corresponding record and app ID.

## Prepared workflow revision

`bellywise-testflight.workflow.yml` is a local template for the next installed workflow revision. Editing this file does not change an already-running GitHub Actions job.

The revision calls the shared `scripts/ci/build-ios.sh` with `SKIP_IOS_SETUP=1`, after a single prebuild and CocoaPods installation. It checks the native OCR module and SQLCipher configuration, builds a Release simulator app with embedded JavaScript, launches it, watches for an early exit or fatal React Native log, and captures a welcome screenshot. This is startup verification; it does not establish camera accuracy, full accessibility, real-device performance or clinical validity.

After native verification, a fresh read-only Apple setup check looks for the app record again. A record created while the simulator was compiling can therefore be used by that job without another native rebuild. If no record is found, the workflow stops with an actionable message. The public Apple API cannot create the record. [Apple Apps API](https://developer.apple.com/documentation/appstoreconnectapi/apps)

The upload action's current v5 metadata supports `wait-for-processing`. A separate read-only helper, `scripts/ci/verify-testflight.mjs`, checks Apple for the exact app ID, build number, marketing version and iOS platform. It waits for `processingState=VALID`, rejects failed or expired builds, and records internal/external beta state separately. It does not add testers, assign groups, send invitations or claim external review is complete. [Official upload action metadata](https://github.com/Apple-Actions/upload-testflight-build/blob/v5/action.yml)

## Artifact boundaries

Treat artifacts from the public signing repository as accessible to people who can read that repository and download its artifacts; do not use them for private source or real diary information.

The native verification artifact allows only the captured welcome/failure screenshots, the concise smoke result and Xcode version. It excludes the source tree, simulator app ZIP, signed IPA, derived data, JavaScript bundles and full compilation logs. The signed IPA is passed directly from the runner's temporary directory to Apple's upload action and is not published as a GitHub artifact. Signing summaries and processing-state reports contain resource identifiers and status, without signing private keys or API tokens.

## Local verification of the revision

Offline tests cover Apple JWT signatures, credential-origin protection, certificate/profile matching, exact-build selection, failed processing and polling timeout. They require no real Apple secrets and do not call Apple. Native compilation and screenshots require the macOS runner; local Windows checks must not be described as an iOS build.

Update this status with the final run link, source commit, archive/upload outcome, Apple build ID and observed processing/tester availability after the next workflow completes.
