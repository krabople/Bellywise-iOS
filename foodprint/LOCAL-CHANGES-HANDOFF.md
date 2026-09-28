# Bellywise — local changes, 28 September 2026

This document describes the app changes and the release checks for this batch. The user initially requested local changes, then explicitly requested a GitHub push and TestFlight upload on 28 September 2026.

## Implemented

- Custom symptom choices persist immediately. Adding a custom feeling saves it and returns to the originating feeling form, retaining time, severity and notes and selecting the new feeling. Settings use Done, not a second Save.
- Ingredient information opens in a modal above the meal form.
- Removed the raw ingredient textbox, bulk Confirm all button and mandatory review switch. Parsed label ingredients default to confirmed; each can be unconfirmed or deleted. Direct recognised single ingredients default to confirmed. Typical dish recipes deliberately remain estimates, but can be saved without another confirmation step.
- Added Breakfast/Lunch/Dinner/Snack grouping, Save & add another, grouped journal cards, per-item editing and independent item times. Group identity is the local date plus meal slot, so entries for the same slot/day join together.
- Expanded offline food/recipe aliases to 658 names, in addition to 4,710 effective ingredient records. Added macaroni/mac and cheese, fudge, sweets, desserts, pies, curries, soups and many regional sandwich/roll/cob/bap/butty names. Close unambiguous spelling matches are labelled; more uncertain names get selectable suggestions. These are recipe hypotheses, never substitutes for barcode product data.
- Brand/product search produces debounced suggestions while typing in Search by name. Uses Open Food Facts, existing caching and per-endpoint request limits; stale query results are ignored. Choosing a product imports its published ingredients, barcode and gluten/lactose-free labels. Missing ingredients still lead to photo/manual entry.
- Packaging exclusions apply to the effective catalogue, label parser, structured product nodes, and old diary exposures during analysis. The reported email/address/trademark tokens were not present in the bundled catalogue; upstream structured nodes had previously been trusted too freely. Product nodes now also require catalogue phrase recognition, and unknown genuine ingredients can be added manually. The audit excludes the shipping-qualified taxonomy record “Mango imported by boat”; the original source snapshot stays intact for provenance.
- Headerless OCR can include consecutive recognised continuation lines. Photos now offer a drag-to-select region after on-device recognition. Vision's line bounds are converted to screen coordinates; selected lines go through the parser again. This is line selection, not a saved cropped photograph. Include entire ingredient lines. Temporary photos are removed after selection/cancellation/unmount.
- Butter, cheese, hard cheese, yoghurt, cream, whey and casein have distinct identities instead of all becoming milk. Analysis derives estimated lactose from appropriate dairy, with lactose-free exceptions. Butter/ghee/hard cheese/casein do not automatically yield lactose. Dairy proteins retain a separate shared group. Gluten-free context is preserved for derived gluten checks. Existing legacy entries already collapsed to milk cannot always be reconstructed; review and correct those entries if necessary.
- Local notification taps route to food entry, daily review or a specific pattern (the patterns list for a multi-pattern alert). Includes cold-start handling and response deduplication. No remote server, push token or Expo account added.
- Whole-product/food comparisons are tested alongside ingredients before multiple-comparison correction. Identical ingredient evidence is grouped under the product; stronger or independently observed ingredient evidence is not hidden. Details list components with established trigger context first, without claiming a proven cause.
- Sleep now joins stress as an alternative-explanation check. Meaningful imbalance or weakening on better-rested days prevents the stronger diary-evidence label. Notes remain human-readable context and report content, with no speculative medical text interpretation.
- Clinical interpretation confidence is separate from statistical diary strength. Limited or uncommon trigger context gets an explicit lower-confidence label. No invented population probability, numerical prevalence prior, or changed p-value.
- Next-day timeline squares explicitly pair food day D with outcome day D+1; tapping shows both dates. Unfinished or untracked outcomes are dashed. Charts exclude unfinished current/future outcome dates and explain that raw timeline entries may not be eligible statistical comparisons.
- Added a 26-week food-group presence/coverage view. It describes recorded variety, not serving sizes, nutrient adequacy, deficiency or causal symptom links.

## Deliberate limits / answers

- A widget can offer preset one-tap actions using WidgetKit/App Intents. Free typing and camera scanning need an app screen. A widget was researched, not added: a reliable direct-log widget needs a separate extension, signing/App Group setup and a safe shared write path into the encrypted diary. This requires a separate native implementation and device testing, not just upload of this JavaScript change.
- Ingredient prevalence is not a validated probability for an individual's symptom. Established trigger background lowers interpretive confidence separately instead of mathematically manufacturing certainty.
- Low recorded fruit is not evidence of a nutritional deficiency or a cause of itchy skin. The new longer-term view is descriptive; no deficiency correlations are generated without quantity/completeness data and a defensible validated method.
- OFF is a live community catalogue, not a guarantee that every product has accurate data. A direct Dolmio API check returned 238 product matches; the browser suggestion test encountered a network failure, and a later direct request returned HTTP 503. Error/manual fallbacks worked. Verify live search again on iOS before release.

## Validation and release handoff

- TypeScript checks pass; all 73 domain/parser/storage tests pass, covering the new cases alongside the existing tests.
- Browser checks used only the fictional example diary: custom-feeling auto-save/return/draft preservation, macaroni-cheese alias, butter popup, Save & add another dinner, grouped journal and product-focused pattern details.
- Local production web and iOS JavaScript exports both passed. An iOS JavaScript export is **not** an Xcode archive, signing check, simulator run or device test.
- No dependency, entitlement or native Swift change is needed for this batch. Existing Expo notifications, ImagePicker and Apple Vision module are used.
- Before TestFlight: run `npm run typecheck`, `npm test`, `npm run export:ios`; then use the established GitHub macOS build/sign/upload workflow when authorised. Check cold-start notification routing, nested modal dismissal, rotated/portrait photo selection, actual camera OCR and real product lookup on an iPhone. Retain the current signing configuration.
- Current local preview: `http://localhost:8081/` (Metro bound to IPv6 localhost in this Windows session). Native-specific functions cannot be verified in the web preview.

See `src/domain/METHOD.md` for the complete statistical method and limitations.

## Sources consulted

- https://docs.expo.dev/versions/v57.0.0/
- https://docs.expo.dev/versions/v57.0.0/sdk/notifications/
- https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/
- https://docs.expo.dev/versions/v57.0.0/sdk/widgets/
- https://developer.apple.com/documentation/widgetkit/adding-interactivity-to-widgets-and-live-activities
- https://openfoodfacts.github.io/openfoodfacts-server/api/
- https://www.niddk.nih.gov/health-information/digestive-diseases/lactose-intolerance/eating-diet-nutrition
- https://www.nhs.uk/live-well/eat-well/digestive-health/five-lifestyle-tips-for-a-healthy-tummy/
