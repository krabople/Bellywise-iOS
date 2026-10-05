# Catalogue expansion — 5 October 2026

These changes are local. No build was uploaded during this batch.

## Actual record counts

| Dataset | Added records | Meaning |
| --- | ---: | --- |
| USDA generic food guide | 12,713 | Distinct source food descriptions, not fabricated spelling variants. 9,271 have mapped components; the rest cannot supply a full recipe. |
| Curated recipe families | 9 | Gravy, plant sausages, buffalo wings, chilli sauces and toast variations. |
| Brand/manufacturer directory | 37,886 total | Names deduplicated across USDA, Open Food Facts and curated UK aliases. Manufacturers are included where the source has no consumer brand. |
| USDA packaged products | 60,000 | Real product records containing published label text, distributed across brands. 59,461 US and 539 New Zealand records. |
| McDonald’s UK menu | 136 | Official product names; current public manufacturer ingredient statements retrieved on selection. |
| KFC UK menu | 137 | Official product names; this source does not publish full ingredient lists. |
| Burger King UK menu | 213 | Distinct names reachable from the current official UK menu, rather than all historical CMS records. Full ingredients are absent from that source. |
| Saved product/menu catalogue | 60,486 total | Packaged products plus the three official restaurant menus. |

Aliases are not counted as extra food or brand records. Food records are editable recipe estimates, not brand-specific ingredients or additional OCR vocabulary. The five new compound-food ingredient entries route toast and the requested foods through the manual ingredient picker, preserving inferred component confidence. Existing confirmed ingredients are retained when an estimated recipe is added.

## Provenance and refresh

- [USDA downloads](https://fdc.nal.usda.gov/download-datasets/): FNDDS 2021–2023, October 2024 release; SR Legacy, April 2018 release; branded foods, April 2026 release. Public domain/CC0. `catalogImportAudit.json` stores source archive SHA-256 hashes and original row counts. This is a broad international catalogue, not a complete catalogue of UK supermarket products.
- [Open Food Facts brands taxonomy](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/taxonomies/brands.txt): 1,844 taxonomy names/aliases before merging with USDA. ODbL attribution is preserved. Food Facts ingredient taxonomy already supplied the dedicated ingredient vocabulary; brand names and recipe prose never enter OCR matching.
- [McDonald’s UK menu](https://www.mcdonalds.com/gb/en-gb/menu.html): same public `dnaapp/itemDetails` service used by the official product pages. Only default ordered components are parsed. Parse components separately so one component’s trace warning cannot erase later ingredients. Alternative supplier recipes remain inferred, and network failure requires label/manual entry instead of silently using a stale list.
- [KFC UK menu](https://www.kfc.co.uk/our-menu): official Next.js page content, including current category links. Menu descriptions and allergen advice are not substituted for ingredients.
- [Burger King UK menu](https://www.burgerking.co.uk/menu): public Sanity content service configured by that official site (`czqk28jt`, `prod_bk_gb`). Traverse the linked BK Menu and its sections/options; exclude hidden nodes and item modifications. No authentication or account API is used.

UK is selected initially. Users can select US or all countries; each result shows its market and source. Suggestions as the user types are local. Open Food Facts queries require an explicit button/keyboard submission, respect service rate limits, apply brand and country filters, and return 50 records per page with more-results controls. A brand suggestion is not a promise of offline products for that brand.

Barcode lookups continue to use the exact Open Food Facts record, never generic recipes or similarly named products. Missing products, ingredient lists and network failures offer a photograph/manual-entry route. KFC and Burger King menu entries explicitly say “Label needed” and do not invent ingredient exposures. Restaurant modifications and country-specific recipes still require review.

## Rebuild the snapshots

Save the three official source archives as `.build/catalog-sources/survey.zip`, `sr.zip`, and `branded.zip`. The Python importer requires the build-only `ijson` package; this is not an app dependency.

```powershell
python scripts/import-usda-catalogues.py
node --import tsx scripts/generate-food-guide.mts
node scripts/import-openfoodfacts-brands.mjs
node scripts/import-mcdonalds-uk.mjs
node scripts/import-kfc-uk.mjs
node scripts/import-burgerking-uk.mjs
```

The generic guide maps source recipe components using the curated guide and ingredient aliases; it does not recursively rely on its own generated output. Inspect import counts and source dates when refreshing; menus and packaged recipes change. The source snapshots and timestamps remain visible in the app. The database additions increase the iOS JavaScript bundle size, so native release startup still needs a device check.

## Local review reminders

End-of-day reviews use date-specific local notifications instead of a repeating daily notification. Saving a complete review physically cancels that date’s pending alert, including when the app is subsequently closed. A foreground handler also suppresses completed review alerts. Preference changes, launch and resume reconcile the queue and remove old repeating review reminders. Food reminders are unaffected. A review tap opens the date stored in the alert, so a delayed alert after midnight opens the correct day.

Schedule 45 days ahead, refilled when the app opens/resumes, plus at most three food reminders. If the app is never opened for more than 45 days, review notifications eventually stop rather than require a remote/background service. iOS Focus/notification settings can delay delivery. Automated checks validate cancellation plans, legacy migration, changed times, duplicate/latest reviews, local clock times and routing; actual OS delivery requires an iPhone/iPad test.
