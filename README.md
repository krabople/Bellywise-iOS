# Bellywise

A private food, drink and symptom journal for iPhone and iPad. Bellywise helps people explore patterns while keeping uncertainty, ingredient provenance and clinical limits visible.

The React Native / Expo SDK 57 app lives in [`foodprint/`](foodprint/) (an internal working directory name). It builds natively on GitHub's macOS runners; an Expo cloud account is not required.

## Run and verify

```sh
cd foodprint
npm ci
npm run typecheck
npm test
node --test tests/apple-setup.test.mjs
npm run web
```

The browser preview supports diary, ingredient parsing, product search, exports and pattern analysis. It uses unencrypted browser storage; use fictional entries. Choose **Explore example diary** to see six weeks of sample data kept separate from the personal diary.

Native camera OCR and SQLCipher storage require the custom native build; Expo Go is intentionally unsupported. On a Mac:

```sh
cd foodprint
npx expo prebuild --platform ios
npx expo run:ios
```

## Features

- Food and drink logging, historical entries, edits, portions and notes.
- Built-in and custom symptoms, plus separate positive feelings.
- Daily completeness, stress and sleep check-ins.
- Typical ingredient suggestions with gluten-free, dairy-free and milk variants; all estimates remain labelled until confirmed.
- Apple Vision camera/photo OCR on-device, conservative ingredient section extraction, editable review and separate trace warnings.
- Optional Open Food Facts name/barcode lookup with attribution; only an explicitly submitted search goes to the catalogue.
- Exploratory complete-day comparisons, timing windows, minimum counts, uncertainty intervals, multiple-comparison correction and co-occurrence warnings.
- Nine sourced educational guides, report export, validated backup restore and diary deletion.
- Native encrypted SQLite storage with a random key in Keychain; no diary server, advertising or analytics.

## Method and limitations

See [`METHOD.md`](foodprint/src/domain/METHOD.md), [`SCANNING.md`](foodprint/docs/SCANNING.md), and [`CLINICAL-SAFETY.md`](foodprint/docs/CLINICAL-SAFETY.md).

This is an observational wellness diary, **not a clinically validated intolerance test**. Calendar-day comparisons do not prove temporal order or causation. Unknown meals and untracked symptoms must not become false negative controls. Recipes, product records and OCR require user verification. The starter offline catalogue is supplemented by optional product lookup; it is not an exhaustive global recipe database.

## Release

- Bundle: `com.krabople.bellywise`
- Apple team: `6YYA8L76Y8`
- Minimum iOS/iPadOS: 16.4
- Build toolchain: Xcode 26.4+ / SDK 57 / Node 24
- Source repository: private `krabople/Bellywise-iOS`

The signing workflow template is in [`bellywise-testflight.workflow.yml`](foodprint/docs/bellywise-testflight.workflow.yml). It is designed to run in the existing Lifetwine repository so the owner's existing Apple secrets stay there. A dedicated read-only deploy key allows that runner to check out this private app's source. The workflow registers/reuses this app's bundle and certificate-matched provisioning profile, builds the simulator, archives, and uploads the signed build. It never changes or releases Lifetwine itself.

Apple requires creating the new app record through App Store Connect's website. The workflow stops with a useful message if that record is missing. Beta distribution must be verified in TestFlight after upload; a successful source push is not a successful release.

Draft listing/privacy text is in [`APP-STORE-CONTENT.md`](foodprint/docs/APP-STORE-CONTENT.md) and [`PRIVACY.md`](foodprint/docs/PRIVACY.md). Contact details and hosted privacy/support URLs must be set before public distribution. Physical-device camera, VoiceOver and encrypted-storage acceptance checks remain part of release QA.
