# Bellywise Apple signing setup

The helper uses Apple's public App Store Connect API to find or register an explicit bundle identifier, verify an existing distribution certificate, and find or create a matching App Store profile. It never creates/revokes certificates, modifies another app, adds testers or releases a build. It is read-only against Apple unless called with `--apply`.

Apple's published OpenAPI specification was checked on 19 September 2026: version **4.4.1**. `/v1/apps` provides GET only. A new App Store Connect app record must be created through its website before upload. The API can subsequently find that record and manage supported metadata. [Apple Apps API](https://developer.apple.com/documentation/appstoreconnectapi/apps), [Add a new app](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/)

## Environment

| Name | Purpose |
| --- | --- |
| APPSTORE_ISSUER_ID | Existing App Store Connect API issuer |
| APPSTORE_KEY_ID | Existing API key identifier |
| APPSTORE_PRIVATE_KEY | Existing PEM P8 API key, injected only in CI |
| APP_BUNDLE_ID | `com.krabople.bellywise` |
| TEAM_ID | `6YYA8L76Y8`, to be checked against the imported certificate |
| CERTIFICATE_SHA1 | Exact SHA-1 of the distribution signing identity imported into the CI keychain |
| APP_NAME | Optional display name; defaults to Bellywise |

Use the already-imported signing identity to derive `CERTIFICATE_SHA1`. Do not select the first certificate returned by the API. The helper compares the actual certificate fingerprint, Apple team and expiry before making any change. The identity must have its private key in the CI keychain; downloading a public certificate cannot supply that private key.

```sh
node scripts/ci/apple-setup.mjs --output-dir "$RUNNER_TEMP/bellywise-signing"
# After inspecting the plan, registration/profile creation can be enabled:
node scripts/ci/apple-setup.mjs --apply --output-dir "$RUNNER_TEMP/bellywise-signing"
```

Both modes can write local files. A matching profile produces a `.mobileprovision` file and `ExportOptions.plist`. The manifest contains resource IDs and planned/performed actions, without private keys or access tokens. Install the downloaded profile in the runner's provisioning-profile directory before archive/export. `GITHUB_OUTPUT` receives `bundle_id`, `profile_uuid`, `app_id`, `certificate_sha1` and `app_record_required` when set. A missing app record is reported; it is not fabricated or created by an undocumented endpoint.

## Repository arrangement

The inspected `krabople/Lifetwine` release workflow uses `macos-26`, `actions/checkout@v7`, `Apple-Actions/import-codesign-certs@v7`, `Apple-Actions/download-provisioning-profiles@v6`, `Apple-Actions/xcodebuild@v1`, `actions/upload-artifact@v7` and `Apple-Actions/upload-testflight-build@v5`. Those are the versions observed in that repository, not a claim that they are the latest available versions.

A dedicated manually dispatched workflow in the existing signing repository can check out a pinned Bellywise source commit from a private `krabople/Bellywise-iOS` repository using a read-only deploy key. This lets the signing secrets stay in the existing repository. Set checkout `persist-credentials: false`, scope job permissions to `contents: read`, avoid pull-request triggers for the signing job, and pass an explicit source commit. The workflow should verify the source commit, run checks, generate the iOS project on the macOS runner, import the existing certificate, run this helper, archive/export and upload through the existing Apple upload action. Keep keychains, P8 files and profiles in the runner's temporary area and clean them after the job.

Creating a new repository/deploy key, installing a GitHub Actions secret and dispatching the signing workflow are separate changes; none is performed by this helper or this document.

## App record

After bundle registration, the App Store Connect website's New App form needs an iOS platform, available display name, primary language, registered bundle ID, unique SKU and access choice. The parent account must have permission to create apps and accepted current agreements. Use the user's actual Apple account context and leave agreements to its Account Holder. The proposed bundle identifier is `com.krabople.bellywise`; a suitable internal SKU is `bellywise-ios-1`. The displayed name should be checked for availability rather than assumed. [Apple record-creation guide](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/)

The helper's HTTP client allows only the official Apple API origin, refuses redirects, caps JWT validity and reports API error codes without echoing response bodies. Its offline checks run with `node --test tests/apple-setup.test.mjs`; they do not access Apple or require real secrets.
