# Bellywise owner beta checklist

Use fictional entries for this first pass. Record the TestFlight version/build, device model and iOS version with any issue. This checklist describes the current app; build/upload progress is recorded separately in [BUILD-STATUS.md](BUILD-STATUS.md).

## Start and keep data

- Open the app and choose **Start my journal**. Check the Journal, Patterns, Discover and My space tabs. On iPad, also try portrait and landscape; check large text, the keyboard and scrolling through long forms.
- Add a scratch entry, close the app fully and reopen it. The entry should remain. A storage error should explain the failure without replacing existing data.
- In **My space → Explore example diary**, inspect the fictional journal and patterns. **Exit demo** should return to your original diary. Demo edits are separate and are not saved as your personal history.

## Food, drinks and feelings

- Choose **Log manually → Food**. Try `bread`, answer its variant question, and tap **Review ingredients**. Repeat with `gluten-free bread` and `lactose-free milk`; standard wheat or lactose assumptions should not survive the relevant exclusion. Check the actual recipe before confirming anything.
- The offline recipe guide is a starter collection. Suggestions must remain estimates until confirmed. Remove an ingredient, add a known ingredient, set **Had at**, add notes, review and save. Tap the journal entry to edit it; test deletion using a disposable entry.
- Select **Drink** and try `oat latte`, `decaf coffee` or a named alcoholic drink. Check the liquid-amount notes and the journal’s **Drinks** filter. Variants are editable suggestions; “decaf” and “alcohol-free” do not establish zero traces. Quantities are notes, not a dose calculation.
- Choose **Log a feeling**. Save a symptom and **Something positive**, each with a time and strength from 1–5. In **My space → Personalise my symptoms**, add a custom feeling, choose Symptom or Positive, and **Save my choices**. Unselecting it should hide it from quick logging while keeping its history.

## Camera, pasted labels and products

- On a real iPhone/iPad, choose **Scan a barcode** and scan valid EAN/UPC codes. The exact product should be retrieved from Open Food Facts and its published ingredient declaration split into individual review items. Confirm that Bellywise does not invent a list from the product name when the catalogue record has no ingredients. Test an unknown code, denied camera access, and the typed-number fallback.
- Choose **Scan ingredients → Take photo**. Frame the ingredient list closely; a heading helps but is not required. Check cancellation and **Choose photo**, then a clear label and a difficult/glare-filled one.
- Compare every proposed ingredient with the packet. Nested ingredients should be separate review items; nutrition/storage text should not become ingredients. `Contains` declarations and `May contain` warnings must remain separate from confirmed consumption.
- A scan without a clear Ingredients heading should recognise a dense run of whole catalogue phrases while ignoring isolated marketing words. Check that `gluten free` does not create a gluten exposure and that advice headings are omitted. Add any missing genuine ingredient manually; an unknown name should show close matches and still offer **Add anyway**. Correct mistakes before **I checked these against the label** and save. Reopen the entry: its saved label text, personal ingredients and notes should remain.
- A barcode scan should give one success buzz, hide the scanner while looking up the product and show a read-only published label plus separately reviewable structured ingredients. There should be no ingredients-only toggle.
- **Search by name** remains available as a fallback. Check the exact brand/formulation and its current packet. Open Food Facts is a community catalogue with incomplete or outdated records, not a complete product database. Missing ingredients must prompt packet scanning or manual entry; outages and repeated searches should give a recoverable message.

English label headings are supported. Foreign labels, tiny print, curved packaging and complex layouts may need manual correction. Recognition is never an automatic save or an allergy-safety check.

## History, complete days and patterns

- Use the week arrows to select a past date. A new entry should start on that date; check its time before saving. Future times must be rejected.
- Open **Complete a daily check-in** for that date. Record stress, optional sleep/context, and mark complete only after all food, drinks and tracked feelings are logged—including uneventful days. Editing, moving or deleting an entry should reopen affected dates for review.
- Today enters comparisons tomorrow. Incomplete days are missing data. A newly selected feeling must not turn older untracked days into symptom-free days; older check-ins may need explicit review. Unresolved ingredients can exclude a day from comparisons even when marked complete.
- In Patterns, compare symptoms and positive feelings separately. **Show early comparisons** is off initially. The stronger display requires at least 14 eligible observations and six days with/six without an ingredient, plus further checks; meeting the counts alone does not promise a result. Use the example diary to inspect populated cards without fabricating your own health history.
- Open a card and read its counts, uncertainty, inferred-ingredient and foods-eaten-together cautions. Same-day results are calendar-day co-occurrence; following-day results are adjacent dates, not a precise symptom-delay model. Strength, portion size and symptom duration are not modelled. Device timezone changes can shift historical calendar dates.

Patterns are observational clues, not a diagnosis, a probability of intolerance or a treatment plan. Positive feelings do not establish food safety. The method has not been clinically validated; see [METHOD.md](../src/domain/METHOD.md).

## Backup and privacy

- Exit demo. In **My space**, **Save backup** to Files and **Export a report**. The JSON backup is restorable; the readable text report is for review/sharing. Both are unencrypted and may contain health information.
- With scratch data only, add a disposable entry, then **Restore backup**. Check the summary and explicit replacement prompt. Restoring replaces the current diary rather than merging it. Verify entries, drinks, custom feelings, label text and check-ins; an invalid backup should leave the diary unchanged.
- Save a backup before testing **Delete my diary** or changing devices. There is no account, developer diary server or cloud recovery/sync. Deletion cannot remove exported copies or OS backups.

Native storage uses a local encrypted database; browser preview storage does not. Camera OCR runs on-device and attempts to remove its temporary processing image afterward; original library photos remain. Optional product searches send the query/barcode and ordinary connection metadata to Open Food Facts. Educational source links open external websites. Keep real diary details out of public screenshots, CI artifacts and beta feedback unless deliberately sharing them. See [PRIVACY.md](PRIVACY.md) for the release-draft notice and remaining publication details.

## What build evidence establishes

A passing native job checks module/configuration presence, Release compilation, simulator startup, a short process/log check and a screenshot. It does not prove real-camera accuracy, long-term storage/recovery, all interactions, accessibility, device performance, security auditing or medical accuracy. A successful signed upload and Apple processing are separate from simulator success and tester availability.

For failures, capture the exact steps, expected/actual result, error text and a fictional screenshot. Note whether the issue followed an update, permission change, offline use or timezone change.
