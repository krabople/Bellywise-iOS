# Bellywise ingredient scanning and product records

## What is implemented

Barcode scanning is the primary meal-entry route. `expo-camera` presents a live scanner for EAN-8, EAN-13, UPC-A, UPC-E and ITF-14 codes. A detected code is looked up in Open Food Facts and only the ingredient declaration returned for that exact product record is used. The barcode route never substitutes recipe assumptions based on the product name. If that record has no ingredient declaration, the UI requires a packet-label scan or manual entry instead. Every returned declaration is shown for review before saving. People can also enter a barcode number, search by product name, photograph an ingredient list, or log a meal manually.

The local `modules/foodprint-vision` Expo module calls Apple Vision `VNRecognizeTextRequest` on a local image. It uses accurate recognition, English preferences with automatic language detection, and ImageIO downsampling with orientation handling. It returns text, per-block confidence and normalized bounding boxes. Images stay on the device; this module has no network request. Recognition runs on a background queue. The native module's internal name remains `FoodprintVision`.

The app captures an image through `expo-image-picker`, passes the resulting `file://` URI to `recognizeIngredientImage`, then presents `parseIngredientLabel` results for review. `isIngredientOcrAvailable()` returns false in web previews, Android and Expo Go. A custom iOS build includes the module. [Apple text recognition](https://developer.apple.com/documentation/vision/vnrecognizetextrequest), [Expo local modules](https://docs.expo.dev/modules/get-started/).

## Review contract

`parseIngredientLabel(text, { source?, ocrConfidence? })` returns `ingredients`, `ingredientText`, `allergens`, `mayContain`, `warnings`, `hasIngredientsHeader`, `status`, and `requiresConfirmation: true`.

- Default/`ocr` mode requires an explicit `Ingredients:` heading or a standalone Ingredients heading. Without one, `status` is `needs-manual-selection` and no ingredients are emitted.
- `manual` and `catalog` mode accept a previously selected ingredient field without a heading. Do not pass an entire unreviewed packet photo into these modes to bypass the heading check.
- Boundaries such as nutrition, storage, preparation, allergen advice and best-before text terminate the ingredient section. Nested parentheses and subrecipes remain intact.
- After the declaration is parsed, `expandIngredientNames` recursively separates nested subrecipes. For example, `pasta (wheat, egg)` produces individual exposure records for `pasta`, `wheat`, and `egg`, allowing each to be analysed independently. The review remains editable because punctuation and community catalogue data can be wrong.
- Separate `Contains` and `May contain` statements do not become ingredient tokens. Possible cross-contact is not a confirmed exposure. Absence of a declaration never proves absence of an allergen.
- The score is OCR character confidence, never ingredient certainty or medical confidence. Low confidence and incomplete parentheses add warnings.
- Always show editable recognized text and require an explicit save. Never auto-save a scan. The parser supports English headings; foreign labels, curved packets, glare and multi-column layouts may require manual correction.

The parser does not infer hidden ingredients. Mapping confirmed label terms and uncertain recipe suggestions into food entities is a separate domain step.

## Open Food Facts

`lookupBarcode` retrieves a product through `/api/v2/product/{code}.json`. `searchProducts` submits a plain-text query to `/cgi/search.pl`; v2 does not support full-text queries. Searches run only when the user explicitly submits them. A bounded memory cache, request deduplication, short rate-limit spacing and a 12-second timeout prevent repeated requests. The user receives actionable messages for invalid input, service limits, missing products and connection failures. [OFF API introduction and limits](https://openfoodfacts.github.io/openfoodfacts-server/api/), [official API specification](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/docs/api/ref/api.yaml).

Only the submitted product query/barcode is transmitted to Open Food Facts. No diary, symptom data, identifiers or images are sent. Network metadata such as the user's IP address is necessarily visible to that service. There is no local persistent copy of catalog results in this service. A confirmed product can be saved by the diary UI.

Show the returned `attribution`, linked `sourceUrl`, and warnings alongside the result. Community data can be incomplete, incorrect or refer to a different regional formulation. Missing `ingredientsText` stays missing: it must not be replaced with guessed ingredient certainty. Product `traces` and allergen tags stay distinct from ingredient text. The catalog uses the Open Database License; copying or redistributing a substantial derived database needs separate license review. The current native User-Agent identifies the app as `Bellywise/1.0`; add the owner's real support URL/contact for a public release. [Open Food Facts terms](https://world.openfoodfacts.org/terms-of-use).

## Native configuration

The Expo autolinker finds the local module in the default `./modules` directory. The module has its own package manifest, `expo-module.config.json`, iOS podspec and Swift class. `npx expo-modules-autolinking resolve --platform ios --json` should include `foodprint-vision` and `FoodprintVisionModule`. This was verified on the development machine.

App config must include both `expo-camera` and `expo-image-picker` config plugins with clear camera and photo-library permission strings. Request camera permission when the person opens the live barcode scanner. No microphone permission is needed; use `microphonePermission: false` and `recordAudioAndroid: false`. The intended deployment target is iOS 16.4+, including iPad. [Camera configuration](https://docs.expo.dev/versions/v57.0.0/sdk/camera/), [ImagePicker configuration](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/), [Expo module configuration](https://docs.expo.dev/modules/module-config/).

## Verification and macOS build

`npx tsx --test tests/labels.test.ts` covers section boundaries, nested ingredients, headerless text, percentage declarations, gluten-free text preservation, cross-contact separation, incomplete OCR, catalog schema and invalid requests. These are software checks, not validation of medical accuracy.

The outer repository's `.github/workflows/ci.yml` runs TypeScript/tests and a separate unsigned iOS Simulator compile on `macos-26` with Node 24. `scripts/ci/build-ios.sh` selects an installed stable Xcode 26.4+, performs Expo prebuild, installs CocoaPods and compiles Release. It checks that both the Vision module and SQLCipher are linked. It then boots an available iPhone simulator, installs and launches the app, checks that its process remains alive for 13 seconds, detects common fatal React Native log messages, and captures `artifacts/Bellywise-native-welcome.png`. Logs, crash reports, screenshot and a simulator app archive are uploaded by the workflow. This startup check does not replace interaction, camera or real-device testing. SDK 57 requires Xcode 26.4+ and iOS 16.4+. [Expo SDK requirements](https://docs.expo.dev/versions/latest/), [GitHub macOS runner software](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-Readme.md).

SQLCipher and the custom Vision bridge require a native build; Expo Go cannot validate them. The SQLite config plugin must enable `useSQLCipher: true`. Where precompiled Expo modules are enabled, ensure this customized SQLite pod is built from source. The generated Podfile/build logs are the source of truth. [Expo SQLite SQLCipher setup](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/), [Expo precompiled module settings](https://docs.expo.dev/versions/latest/sdk/build-properties/).

This development host is Windows. Swift compilation, CocoaPods and camera behavior cannot be verified locally. A successful macOS job and real-device tests are required before claiming native validation. The simulator artifact is not an App Store archive and cannot be submitted to TestFlight. Signing and App Store Connect submission are separate release steps.

Before a release, test valid EAN and UPC barcodes, an unknown barcode, a denied camera permission, repeat scan suppression, and catalogue records with nested or missing ingredients. Also test a clear packet, a curved packet, no readable text, cancellation, an English label without a heading, and a foreign label. Confirm image orientation, separate may-contain text, correction before save, and recovery after airplane mode or a rate-limit response.
