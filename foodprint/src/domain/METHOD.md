# Bellywise observational method

This is an explainable diary comparison engine, not a diagnostic model. It has not been clinically validated. Product readiness gates (14 complete days, 6 exposed and 6 unexposed days, three separate exposure runs) are conservative design choices, not validated medical thresholds. Do not market an "emerging" pattern as a confirmed intolerance, probability of intolerance, or treatment recommendation.

## Observation and missingness

The unit is a completed local calendar day, never a meal or individual repeated symptom entry. An explicit daily check-in must certify that **all meals and symptoms** were recorded. Absent symptom logs on other days are missing, not negative outcomes. Today and future days are excluded because they have not finished. Days containing an unresolved inferred custom food or a meal with no ingredients are excluded from comparisons, even if checked complete; their unknown ingredients cannot reliably supply unexposed controls. The last check-in for a date wins, even if it reverses completion. Symptom occurrences are deduplicated within a day. Positive feelings are independently named outcomes, never substituted for absence of a negative symptom.

Each check-in snapshots `trackedSymptomIds`: the feelings selected for tracking plus any explicitly logged that day. A comparison only uses an outcome day whose snapshot includes the feeling. Selecting a new/custom symptom must not convert old untracked days into symptom-free controls. Unselected feelings can still be analysed historically from their saved snapshots. Legacy check-ins with no snapshot require explicit review and re-saving before they contribute to comparisons. Editing or deleting a food/drink or feeling invalidates the check-in for both the original and revised calendar dates.

Timezone interpretation uses the device's current local timezone. The app does not yet persist the timezone at entry, so travel or a timezone change can reassign a historical timestamp's calendar date. Severity is recorded for the diary but not used in this binary occurrence comparison. Dose, meal time, ongoing symptom duration, medications, illness, menstrual phase and meal interactions are not modelled; they remain material limitations.

## Two prespecified windows

1. **Same calendar day** compares ingredient presence and symptom occurrence on the same completed date. This is co-occurrence: the food may have been eaten after the symptom.
2. **Following calendar day** uses ingredient presence on day D and symptom occurrence on D+1. Both dates must be explicitly complete. Missing dates are never skipped to find the next available day. It is a calendar window, not a fixed 24-hour delay; other meals on the symptom day may contribute.

All ingredient/outcome/window combinations with at least one exposed and one unexposed day are tested, including weak effects and sparse comparisons. The full test family is corrected before choosing a display window or filtering for positive associations. One window per ingredient/outcome is displayed, ranked by readiness then observed difference. At least two outcome days with the ingredient are needed for display. Negative symptoms occurring less often are not promoted as evidence that a food is protective.

## Effect and uncertainty

The effect is the absolute difference in occurrence proportions: `symptom days / exposed days - symptom days / unexposed days`. A 95% Newcombe score interval is constructed from Wilson limits. A two-sided Fisher exact p-value sums fixed-margin tables with probability no greater than the observed table. Benjamini–Hochberg adjusts all p-values before display filtering.

"Emerging" requires 14 eligible observations, at least 6 exposed and 6 unexposed days, at least 6 confirmed exposure days, three separate exposure runs, risk difference at least 20 percentage points, a lower interval bound greater than zero, adjusted p <= .05, no flagged stress imbalance, and a confirmed-exposure sensitivity difference at least 20 points. Otherwise comparisons are "exploratory" or "not-enough-data". These labels describe diary evidence, not clinical certainty. Confidence intervals are unadjusted and assume independent binomial observations; serial dependence of diary days, correlated foods and repeated re-analysis may make inferential measures optimistic. BH is a multiple-comparison guardrail, not a guarantee for these dependent observations.

Separate exposure runs require observed unexposed days between them; missing dates cannot manufacture a stopped-and-restarted exposure. The stronger same-day label also requires that no exposed symptom day has a first symptom timestamp before the first recorded ingredient exposure. Such reversed timing is still displayed transparently as co-occurrence, with a warning and an exploratory label. Even correctly ordered observations do not establish causation or distinguish persistent symptoms from new onset.

## Ingredient uncertainty and confounding

Recipes are curated, editable hypotheses. A typed dish never marks its typical ingredients confirmed. Gluten-free variants remove wheat/barley/rye hypotheses and suggest alternative starches as inferred; dairy-free removes milk and lactose; lactose-free preserves milk while removing lactose. Vegan variants remove listed animal ingredients but do not invent a substitute. These rules do not establish allergy safety, cross-contact status, certification, or absence of an ingredient. Actual ingredients and allergen statements always take priority.

An exposure day is confirmed if any logged meal explicitly confirms that ingredient. The comparison reports how many exposure days depend entirely on inference. Confirmed-only mode excludes an inferred exposure day; it never relabels that day as an unexposed control. Missing ingredients in a recipe can still misclassify absence, so reviewing labels and actual recipes is essential. Unknown food names are preserved with inferred confidence instead of receiving fabricated ingredients. The offline catalogue is a starter collection, not a comprehensive branded-food database.

Food and drink entries share the same exposure logic. A `kind` field distinguishes them in the journal, defaulting to food for older records. Coffee/tea, alternative milks, juices and alcoholic drinks use editable recipes; decaf and alcohol-free text remove the relevant inferred ingredient. This does not guarantee zero trace caffeine or alcohol. Sugar-free cola retains an unresolved sweetener placeholder until its actual label is reviewed, rather than inventing a particular sweetener. Reviewed raw label text can be retained separately from canonical ingredient names for audit.

A Jaccard overlap of at least .8 across at least 3 shared days flags co-ingredients as difficult to separate. The engine also compares high-stress frequency between groups and, with at least 3 exposed and 3 unexposed lower-stress days, reports a lower-stress sensitivity effect. A 30-point difference in high-stress frequency or a 20-point weakening on lower-stress days prevents the stronger label. This is a confounding screen, not a fitted multivariable or causal adjustment. A clinician can decide whether controlled changes or testing are appropriate; the app should never direct allergy re-challenges or unsupervised restrictive diets.

## Primary methodological references

- NIST, Wilson proportion intervals: https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm
- NIST, difference of proportions intervals including Newcombe: https://itl.nist.gov/div898/software/dataplot/refman1/auxillar/diffprop.htm
- NIST, Fisher exact test for small independent samples: https://itl.nist.gov/div898/handbook/prc/section3/prc33.htm
- R stats documentation, Benjamini–Hochberg and other p-value adjustments: https://search.r-project.org/R/refmans/stats/html/p.adjust.html

Automated tests cover reference statistical values, a synthetic repeated association, sparse/inferred evidence, missing-day controls, adjacent-day eligibility, duplicate logging, co-ingredients, stress imbalance, positive outcomes, date boundaries, variants, and negation.
