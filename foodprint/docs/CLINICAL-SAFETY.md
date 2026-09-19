# Bellywise: clinical scope and content notes

Prepared 19 September 2026. This documents the product's intended boundaries and source review. It is not evidence of clinical validation, regulatory clearance or independent clinical review.

## Intended use

Bellywise is an adult food and symptom diary that organises self-reported observations, surfaces exploratory associations and offers general educational reading. Users can bring records to a clinician or dietitian. The app does not diagnose intolerance, allergy, coeliac disease or IBS; establish causation; certify food safety; prescribe treatment; or provide emergency monitoring. No diagnostic sensitivity, specificity or accuracy claim has been established.

The first release is not designed for diagnosing or managing children's diets. Anyone with an existing medical dietary plan should follow that plan. Substantial dietary restriction deserves professional support, particularly when nutritional needs or a history of eating difficulties make restriction more consequential.

## Content included

`src/content/learn.ts` contains nine original, concise articles and reusable safety notices. Each article has source links. `CONTENT_REVIEWED_AT` means the sources were checked on that date; it must not be displayed as “clinically reviewed”. The app is not endorsed by the linked organisations.

| Topic | Product rule | Primary reference |
| --- | --- | --- |
| Allergy and intolerance | Do not use timing or a pattern to rule out allergy. No self-directed allergy challenge. | [NHS food allergy](https://www.nhs.uk/conditions/food-allergy/) |
| Emergencies | Show immediate emergency guidance for breathing difficulty, mouth or throat swelling, or collapse. The diary must never delay emergency care. | [NHS anaphylaxis](https://www.nhs.uk/conditions/anaphylaxis/) |
| Coeliac testing | Mention clinician-led testing before gluten avoidance, without supplying a self-administered gluten challenge. | [NIDDK diagnosis](https://www.niddk.nih.gov/health-information/digestive-diseases/celiac-disease/diagnosis) |
| Lactose | Keep milk proteins, lactose and dairy terminology distinct. | [Cambridge University Hospitals milk allergy](https://www.cuh.nhs.uk/patient-information/milk-allergy/) |
| FODMAPs | Explain the supported three-step process; do not generate a permanent food exclusion list or serving thresholds. | [Monash starting the diet](https://monashfodmap.com/ibs-central/i-have-ibs/starting-the-low-fodmap-diet/) |
| Warning signs | Route concerning persistent or severe symptoms to clinical care, independent of pattern rankings. | [NHS bowel symptoms](https://www.nhs.uk/conditions/irritable-bowel-syndrome-ibs/symptoms/), [NHS abdominal pain](https://www.nhs.uk/symptoms/stomach-ache/) |
| Commercial testing | Do not recommend broad IgG food panels as diagnostic tests. | [AAAAI IgG testing](https://www.aaaai.org/tools-for-the-public/conditions-library/allergies/igg-food-test) |

## Interpretation requirements

Use “association”, “pattern” and “worth discussing”. Do not write “you are intolerant”, “confirmed trigger”, “safe food”, “cure” or a numerical probability of disease. An evidence label describes the diary observations, not clinical certainty. Insufficient records should produce a clear explanation rather than a confident recommendation.

Keep positive experiences separate from symptom absence. A positive check-in may coexist with a negative symptom. Missing logs are unknown. A symptom-free period does not establish allergy safety or exclude silent disease.

Suggested ingredients must remain distinguishable from user-confirmed ingredients. OCR and product database results need user review. Preserve the distinction between an actual ingredient, a “may contain” warning and a free-from claim. Do not convert every food name into a definitive ingredient list.

Associations are vulnerable to incomplete recording, correlated ingredients, repeated events from one episode, overlapping meal windows, varying portions, multiple comparisons and unrecorded context. The implementation and user-facing explanation should stay aligned when the algorithm changes. Statistical adjustments do not make an observational diary diagnostic.

## Release review

Test the complete flow on iPhone and iPad: emergency messages remain readable, source links open, camera permission denial is handled, scans are editable, inferred ingredients are labelled, missing data does not appear as symptom-free evidence, and deleting or correcting entries updates analysis. Validate the released native build separately from browser demonstrations.

Have a qualified clinician or dietitian review the user-facing health copy and consequential interpretation paths before a broad public launch. Record reviewer, date, scope and changes if that review occurs; do not imply it has already happened. Revisit sources when content changes or a source is superseded.

Apple's health-related review criteria expect support for accuracy claims and reminders to consult a doctor. A disclaimer cannot compensate for contradictory diagnosis or treatment behaviour. This scope document is not a medical-device classification. [Apple App Review Guidelines, section 1.4](https://developer.apple.com/app-store/review/guidelines/#physical-harm)
