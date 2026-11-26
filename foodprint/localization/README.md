# International localisation

Target: all 50 App Store Connect language/locale options listed by Apple on 26 November 2026. English (UK) is the source. App Norwegian uses `nb`; App Store metadata uses `no`.

Language and shopping country are separate, backed-up preferences. The device supplies their initial defaults. Unknown regions use worldwide search, never an assumed UK market. The Home Screen widget and permission prompts follow the iOS language setting; an in-app override applies to the app and local notifications.

Translations are bundled. There is **no runtime translation service**, and no diary, custom symptom, photograph or journal note is submitted for translation. The build-time translation script handles public static application/store text only. Product names and manufacturer label text retain their published wording when a local version is unavailable. Apple Vision's OCR language support depends on the installed iOS version; barcode and manual entry remain available.

Ingredient aliases come from the same pinned Open Food Facts food taxonomy as the existing English database. They resolve to existing canonical IDs. Ambiguous aliases do not merge substances. Curated ingredient-name translations supplement the taxonomy. Printed free-from claims survive parsing; “may contain” remains separate. Recipes remain editable estimates; barcode results never acquire ingredients from a typical recipe.

## Maintenance

From `foodprint`:

1. `python scripts/collect-marketing.py` extracts the existing screenshot captions and public page text.
2. `node scripts/collect-messages.mjs` builds the static source inventory.
3. `node scripts/translate-messages.mjs` resumes the build-time translation catalogue. It respects rate limiting, saves atomically, validates interpolation IDs, and records individual failures. Network access is required for this step only.
4. `node --import tsx scripts/finalize-localization.mts` generates native permissions/widget resources, context phrases and whole-meal aliases. `terminology-overrides.json` takes precedence over machine translations.
5. `node scripts/check-localization.mjs` checks every non-English catalogue and native permission file.
6. `python scripts/prepare-localized-pages.py` builds localised public pages under `docs/languages`.
7. `node scripts/prepare-international-listing.mjs` renders store assets under `artifacts/international-listing` (ten iPhone and ten iPad screenshots per locale). Windows fonts and Sharp/Pango supply complex-script shaping. Original app pixels are retained and English UI is labelled honestly. `--locales=fr,ar,ja` supports focused review.

`localize-source.mjs`, `localize-prose.mjs`, `fix-message-spacing.mjs` and `localize-labels.mjs` are one-time migration utilities, **not** release build steps.

Translations are machine drafts with curated terminology corrections, not independently certified translations. Review the generated `coverage.json`, `validation.json`, individual failure records and store metadata issues before release. Native device layout/OCR verification is separate from catalogue coverage. The user excluded local product testing from this task.

## Store release

The existing UK promotion and live country availability are not modified by these scripts. A new build and App Store update are required to release these app changes. Country availability/prices must be configured separately, with any country-specific Apple requirements answered from verified developer information.

Keep the existing video on the four English listing locales only. For every non-English locale, explicitly remove any inherited preview rather than relying on an empty upload list. The user accepted language-based video selection (an English listing can be viewed outside an English-speaking country).
