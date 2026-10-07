# Catalogue expansion — 5 October 2026

Publication update: 7 October 2026.

The 486 manufacturer-derived restaurant snapshots and their importers/direct refresh API were removed before public release because commercial reuse permission was not documented. Brand identification aliases remain; restaurant product searches now use the existing Open Food Facts route. Previously saved user diary entries are unchanged.

## Actual record counts

| Dataset | Added records | Meaning |
| --- | ---: | --- |
| USDA generic food guide | 12,713 | Distinct source food descriptions, not fabricated spelling variants. 9,271 have mapped components; the rest cannot supply a full recipe. |
| Curated recipe families | 9 | Gravy, plant sausages, buffalo wings, chilli sauces and toast variations. |
| Brand/manufacturer directory | 37,886 total | Names deduplicated across USDA, Open Food Facts and curated UK aliases. Manufacturers are included where the source has no consumer brand. |
| USDA packaged products | 60,000 | Real product records containing published label text, distributed across brands. 59,461 US and 539 New Zealand records. |
| Saved product catalogue | 60,000 total | Licensed USDA packaged-product records. No restaurant snapshots are bundled. |

Aliases are not counted as extra food or brand records. Food records are editable recipe estimates, not brand-specific ingredients or additional OCR vocabulary. The five new compound-food ingredient entries route toast and the requested foods through the manual ingredient picker, preserving inferred component confidence. Existing confirmed ingredients are retained when an estimated recipe is added.

## Provenance and refresh

- [USDA downloads](https://fdc.nal.usda.gov/download-datasets/): FNDDS 2021–2023, October 2024 release; SR Legacy, April 2018 release; branded foods, April 2026 release. Public domain/CC0. `catalogImportAudit.json` stores source archive SHA-256 hashes and original row counts. This is a broad international catalogue, not a complete catalogue of UK supermarket products.
- [Open Food Facts brands taxonomy](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/taxonomies/brands.txt): 1,844 taxonomy names/aliases before merging with USDA. ODbL attribution is preserved. Open Food Facts ingredient taxonomy already supplied the dedicated ingredient vocabulary; brand names and recipe prose never enter OCR matching.

UK is selected initially. Users can select US or all countries; each result shows its market and source. Suggestions as the user types are local. Open Food Facts queries require an explicit button/keyboard submission, respect service rate limits, apply brand and country filters, and return 50 records per page with more-results controls. A brand suggestion is not a promise of offline products for that brand.

Barcode lookups continue to use the exact Open Food Facts record, never generic recipes or similarly named products. Missing products, ingredient lists and network failures offer a photograph/manual-entry route. Restaurant aliases do not provide an offline menu or ingredients; online records without full ingredient lists require label/manual entry. Restaurant modifications and country-specific recipes still require review.

## Data licences

Contains information from Open Food Facts contributors, available under the Open Database License (ODbL) 1.0. Both adapted OFF taxonomies and the enriched USDA-to-ingredient mapping guide are distributed under ODbL with full unrestricted JSON downloads linked from the [public data notice](https://krabople.github.io/Bellywise-iOS/data-sources.html) and [data-folder notice](../src/data/DATA-LICENSES.md). Raw USDA descriptions, brands and product labels remain public domain / CC0. App software and private user diary data are separate.

## Rebuild the snapshots

Save the three official source archives as `.build/catalog-sources/survey.zip`, `sr.zip`, and `branded.zip`. The Python importer requires the build-only `ijson` package; this is not an app dependency.

```powershell
python scripts/import-usda-catalogues.py
node --import tsx scripts/generate-food-guide.mts
node scripts/import-openfoodfacts-brands.mjs
```

The generic guide maps source recipe components using the curated guide and ingredient aliases; it does not recursively rely on its own generated output. Inspect import counts and source dates when refreshing; packaged recipes change. The source snapshots and timestamps remain visible in the app. The database additions increase the iOS JavaScript bundle size, so native release startup still needs a device check.

## Local review reminders

End-of-day reviews use date-specific local notifications instead of a repeating daily notification. Saving a complete review physically cancels that date’s pending alert, including when the app is subsequently closed. A foreground handler also suppresses completed review alerts. Preference changes, launch and resume reconcile the queue and remove old repeating review reminders. Food reminders are unaffected. A review tap opens the date stored in the alert, so a delayed alert after midnight opens the correct day.

Schedule 45 days ahead, refilled when the app opens/resumes, plus at most three food reminders. If the app is never opened for more than 45 days, review notifications eventually stop rather than require a remote/background service. iOS Focus/notification settings can delay delivery. Automated checks validate cancellation plans, legacy migration, changed times, duplicate/latest reviews, local clock times and routing; actual OS delivery requires an iPhone/iPad test.
