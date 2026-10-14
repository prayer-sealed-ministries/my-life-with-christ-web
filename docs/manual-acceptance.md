# Manual acceptance — companion and native handoff

**Status: not executed.** This is a release checklist, not a record of passing tests. Use fictional content and isolated browser profiles. Record failures and blocked checks explicitly. Automated DOM tests do not replace these checks.

## Record the environment

For each run, record date, tester, companion commit and origin, native commit/build, device model, OS, browser/version, installed versus browser mode, and result. Attach only sanitized evidence without real writing, passwords or private download URLs.

Minimum matrix before a broad release:

- Desktop Chromium and Firefox; desktop Safari where supported.
- Physical iPhone with Safari and the supported installed native app.
- Physical Android with Chrome and the supported installed native app.
- Keyboard-only desktop use; VoiceOver/Safari and TalkBack/Chrome where supported.
- A fresh browser profile, an existing-data profile, and two tabs sharing one origin.

Until those runs exist, every matrix row is **unverified**. An unavailable device is a blocker, not a pass.

## Fictional Sunday pilot: 18 October 2026

Use **Example Fellowship (fictional)**, speaker **Taylor Example (fictional)**, sermon **Listening before speaking — test only**, and Scripture reference **James 1:19**. Provided notes: “Fictional outline: pause, listen carefully, and choose one kind response this week.” Use distinct personal text such as “PRIVATE TEST NOTE”, “PRIVATE TEST REFLECTION” and “PRIVATE TEST PRAYER”. Do not use a real person's story or prayer request.

1. **Church author:** Create a Sermon Pack with that material. Preview it, download the JSON, reopen it as text, and confirm it contains only public provided material and declared metadata. Church draft recovery must not put a pack into the personal journal.
2. **Public download:** On an authorized test host, place the JSON at a public HTTPS URL. Confirm a logged-out phone can download the file rather than receiving a sign-in page or HTML error. Generate a QR for that exact public file URL and print a small test copy. QR generation itself must not publish or fetch the file.
3. **Reader:** Scan the printed QR on both phone types. Review the URL and import the downloaded file as provided notes. Confirm church attribution remains a claim from the file, provided text is visibly separate, and personal notes, reflection and prayer start empty.
4. **Personal writing:** Add the three distinct private markers, save one entry, and leave a second item unfinished. Reload and resume the draft. Confirm the saved entry and draft are distinct and the original provided notes survive unchanged.
5. **Readable copy:** Leave reflection and prayer off, review the field choices, and download. Confirm their markers are absent. Repeat with only reflection on, then only prayer on; each result contains exactly the chosen private fields. Check that the preview explains that included personal notes and all downloaded text remain readable.
6. **Move to my app:** Select that entry and only the intended draft, test a date range, review the resulting titles/counts and download JSON and protected `.lwc` separately. Cancel/back and re-enter the review; no hidden selection changes or silent downloads should occur.
7. **Native round trip:** Transfer the file privately, then use the supporting app’s **Your journal → Journal file to read**. Do not use OS tap/Open In or share-to-app as a journal shortcut; those routes are for church handouts. In the tested native build, review before import; drafts stay drafts and all personal/provided fields stay separate. Export back, import into an isolated companion profile and compare full data, including identifiers and timestamps. If native `.lwc` support is absent, record that limit and test the companion-unlock → JSON → native fallback separately.
8. **Repeat/conflict:** Import the identical file again. Change the same entry/draft in the destination, then review the source file again. Keep both versions where offered, re-import once more, and confirm identical conflict copies do not multiply. Verify the receipt against the actual saved-entry, draft, skipped and copied totals.

9. **Isolated backup restore:** Review/download the full journal backup, including saved entries, unfinished drafts and journal metadata. Check that the actual file exists, then import it into a fresh test profile without clearing the source journal.
10. **Compare restored content:** Compare IDs, dates, kinds, anchors, tags, provided material, personal fields, unknown record/root metadata and draft status. Repeat a restore to confirm counts remain stable. Test an empty journal with only fictional unknown root metadata too.
11. **Partial privacy:** Choose only one entry. The review must disclose omission of journal-wide metadata, retain metadata inside the selected item, and exclude unselected private markers. Compare JSON and readable copies separately.
12. **Pastor recovery:** Download an unfinished outline with a blank body; restore as a new church draft. Existing packs and personal writing stay unchanged. Validation still blocks publication until the body is completed.

Suggested pilot roles (do not contact or enroll people automatically): one pastor prepares the outline; a confident desktop user handles a full roundtrip and conflicts; a phone-first user follows the file-picker instructions; a less-technical reader follows only visible labels with an observer; and a keyboard/screen-reader user tests the accessible path. Use the same fictional packet. Ask each person what they expected at save, download, and receipt, and record only task outcome, confusion, device/version and sanitized evidence, never journal content. Provide ordinary printed notes as an alternative and stop immediately on a privacy or data-loss failure.

Pilot acceptance: no data loss, unexpected private-field inclusion, silent replacement, misleading receipt, unsupported native-capability claim or unexpected runtime upload. A failed step blocks the affected release claim.

## Integrity and interrupted flows

- [ ] Wrong password, altered ciphertext, malformed/noncanonical Base64, unsupported protected version/parameters, truncated file and oversized input fail without saving partial content. A retry with the valid file still works.
- [ ] Use the shared fictional `protected-v1.*` fixture with its documented test password in both readers. Also create fresh protected files in each supported producer and open them in the other reader. Never treat fixture decryption alone as complete interoperability evidence.
- [ ] Change an entry or church pack draft in tab A after tab B opened it. Saving stale text in B must report the conflict and retain a recovery path; A's newer stored text must not be replaced. Reopen from storage and verify the chosen version.
- [ ] Repeated submit clicks, route navigation during a save, Cancel, Close, browser Back/Forward and a storage error do not duplicate records, hide a failed save or lose recoverable editor text.
- [ ] Transfer date boundaries are inclusive as documented. Test only drafts, only saved entries, no selection, a partial selection, and a draft outside the chosen date range. Verify independent draft choices and exact exported contents rather than counts alone.
- [ ] Use a template twice; the results are independent editable items. Templates remain separate from journal entries and drafts and are excluded from a journal transfer unless explicitly documented and selected.
- [ ] Import two genuinely different sermons with the same title. They must not be classified as duplicates by title. A different claimed church name must not establish verified authorship.

## Storage, backup and origin migration

- [ ] Confirm persistence UI separately for already granted, newly granted, denied, unavailable and rejected/failed browser APIs. No result promises a permanent backup or guaranteed offline launch.
- [ ] Close/reopen the normal browser after a save and verify data. Test private-mode and quota/storage-denial behavior in an isolated profile; never clear a real user's storage to test failure handling.
- [ ] Download a full backup containing saved entries and drafts. Confirm the actual file exists, then restore it in an isolated profile/origin, review every category and compare representative fields. A “download prepared” message alone is not a verified backup.
- [ ] For an origin change, export from the old origin first, retain that file and the old site, import/review at the new origin, and restore a copy in isolation. Do not close the old site or clear its storage before successful recovery is recorded. Storage does not move with a redirect or domain change.

## Offline, stale assets and privacy release gates

Offline installation was assessed; **no service worker is implemented** pending the lifecycle/compatibility requirements in HOSTING-TRANSITION.md. Do not advertise an offline installation based on these tests.

- [ ] With the page already loaded, disconnect the network and exercise local writing, recovery and downloads. Record actual behavior and failures without promising persistence after closure.
- [ ] Attempt cold launch/reload while offline in a disposable test profile. An unavailable page must not be described as an installed offline app. Reconnect and confirm prior local data is intact.
- [ ] In an authorized staging deployment, test an existing tab and cached page across an asset update. Detect broken/mixed-version behavior and verify safe reload/recovery without clearing IndexedDB. Record build identification and rollback behavior; do not mark this passed from local DOM tests.
- [ ] Inspect runtime network requests while typing, saving, searching, importing, exporting, opening templates and generating QR codes. Expected static-host requests must not include journal content. Record the capture conditions; a static CSP inspection alone is not packet-capture evidence.
- [ ] Scan a public church QR and verify its destination separately. A church host may receive normal web requests; the companion must not claim to control the host's logging or privacy policy.

## Accessibility and layout

- [ ] Keyboard users can reach each control with visible focus, open/close dialogs, recover from errors and return to a sensible focus target. Tab order and Back/Forward behavior remain meaningful after rerendering.
- [ ] A screen reader announces labels, selected state, review counts, validation errors and save/import status without losing the user's place. Decorative QR/symbol elements do not obscure meaningful link text.
- [ ] Test 200% and 400% zoom, narrow mobile portrait/landscape, long titles and long provided notes. No important text or action is clipped or available only by hovering.
- [ ] Focus is visible in light/dark or high-contrast settings that are actually supported. Measure text/control contrast and touch targets; source inspection is not a rendered measurement.

## Sign-off

Record each check as **passed**, **failed**, **blocked** (with reason), or **not run**. Link sanitized evidence and the tested source/build. List residual risks and the responsible release decision. Publication, domain configuration and user data migration remain separate authorized actions.
