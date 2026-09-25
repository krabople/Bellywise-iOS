# Bellywise privacy notice — release draft

Prepared: 19 September 2026. Effective date: [date of publication].

**Release status:** This notice describes the intended native application and browser preview. The final developer identity, contact information and actual release-build behaviour must be checked before publishing it. It is not evidence that a privacy audit has taken place.

## Who provides Bellywise

Bellywise is provided by [developer or legal entity name], [relevant contact address]. For privacy questions, contact [monitored privacy email].

## Your diary

You choose what to enter, including meals, ingredients, symptoms, positive experiences, timestamps, severity and notes. Bellywise stores these records on your device and uses them there to build your diary and calculate exploratory patterns. Bellywise does not create a required account or upload the diary to a developer-operated server. The current app does not include advertising, advertising identifiers or third-party analytics SDKs.

In the native iOS app, the intended storage uses an encrypted local database with its key in the device's secure key storage. The protection depends on your device and operating system, including your passcode and access controls. This is not a promise that an unlocked, shared, compromised or backed-up device can never expose information. Device backups and transfers are governed by your operating system settings; Bellywise does not operate its own cloud synchronisation service.

The browser preview uses browser local storage and does not provide the native encrypted database. Anyone with access to that browser profile may be able to read it, and clearing browser data may remove it. Use fictional information when trying a preview on a shared computer.

## Optional local notifications

If you enable notifications, Bellywise can schedule a daily journal reminder at the time you choose. It can also notify you when an on-device diary comparison first passes the app's stronger pattern checks. These are local notifications: Bellywise does not obtain a remote push token, register with an Expo notification server or send diary and pattern data to a developer server. Notification text may appear on your lock screen according to your iOS notification and Focus settings. You can turn either option off in Bellywise or revoke notification access in iOS Settings.

## Camera and ingredient recognition

Camera access is optional and is used when you choose to capture an ingredients label. Text recognition runs on the device. Label photographs are not uploaded to the developer or Open Food Facts. The app uses a temporary image for recognition and removes its temporary copy after processing; it stores the ingredient text you choose to save. An image that you selected from another app or your photo library remains under that app's control. You can deny or revoke camera access in system settings and continue typing entries.

## Optional Open Food Facts searches

When you choose an online product lookup, Bellywise sends the search text or barcode to Open Food Facts to request matching product information. A lookup also exposes ordinary connection information, such as your IP address and an app or browser user-agent. Bellywise does not attach symptoms, diary history, notes or a personal account identifier. Avoid putting personal or medical information into the product-search field.

Open Food Facts is a separate service. Its handling of requests and server logs is governed by its own practices, and internet requests may be processed outside your country. Its full current retention practices have not been verified for this draft. Review [Open Food Facts](https://world.openfoodfacts.org/) and its [terms](https://world.openfoodfacts.org/terms-of-use) before using the optional lookup. You can use the local diary and manual ingredients without it.

## Export, links and feedback

When you request an export, Bellywise generates a diary file or report for you to save or share. Exports may contain sensitive information and are not protected by the app database encryption once exported. The destination you choose, such as Files, email or cloud storage, determines who receives the copy and how it is protected. Deleting records inside Bellywise does not delete copies you have exported elsewhere.

Opening a source link takes you to an external website, which may receive ordinary browser connection information and apply its own privacy practices. If you contact support or send TestFlight feedback, the recipient can receive what you include. Omit personal health details and use fictional screenshots unless you intend to share that information. Apple operates TestFlight and the App Store under its own policies.

## Retention and deletion

Local diary records remain until you remove them, clear the diary, or remove the app's stored data. Device backups, exported files and copies you have shared may remain separately. Bellywise cannot recover a diary from its own server because it does not hold a server copy. Manage backups and exports separately through their respective services.

## Changes and contact

If data practices change, this notice will be updated with a new effective date. The app's developer contact above can explain the current implementation and handle any support information they have actually received. Developer-specific support retention and any applicable rights process must be completed before publication.

---

## Developer release worksheet — not public policy text

The statements above must be reconciled against the signed release build. Verify native database encryption and key handling, camera-image cleanup on success and error, local notification scheduling without remote token registration, export contents and temporary files, backup behaviour, every runtime network endpoint, and all dependencies. Confirm deletion behaviour without claiming secure erasure of copies outside the app. Check whether Expo services or any later diagnostics/update SDK are enabled at runtime and revise this notice if needed.

Do not claim that no data leaves the device: the optional Open Food Facts request does. Confirm the provider's retention of search terms, barcodes and IP addresses. Assess relevant App Store privacy categories and purposes for that behaviour; optional use alone does not automatically make a disclosure optional. Apple distinguishes device-only processing from off-device retention, and requires third-party collection to be considered. [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)

Fill the developer identity, contact, support retention and applicable rights process; publish the final notice at a stable public URL; and link it from App Store Connect and the app. Review the current permission descriptions and privacy manifests from the native dependencies. [Apple privacy guidance](https://developer.apple.com/app-store/app-privacy-details/)
