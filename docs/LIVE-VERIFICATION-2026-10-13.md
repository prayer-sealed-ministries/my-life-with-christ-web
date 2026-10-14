# Published companion browser smoke verification — 2026-10-13

## Final version 3 verification

Version **3** is the current successful public deployment at the same address. Sites status was checked again on October 13 at **23:09 UTC**; it reported `succeeded`, no failure, and the unchanged public URL and audience.

- Published source: `4c1a7bb904c817c277ed8c7790e53ade3aa64e41` on configured source branch `main`.
- Saved version: `appgprj_6ac621170d0081918c34b68a6fe97f90~appgver_ec608a6762ec8191a2a25af41dc52a41`.
- Deployment: `appgdep_6aceb03f9a08819183bc1146464032e8`, completed at `2026-10-13T22:27:19.602188+00:00`.
- Platform-reported saved-archive content hash: `sha256:72174ae43f5c3c53e489da19620b6079f9f467a9494867ce917749fae10bb041` (17 files, 215,040 bytes). This is platform provenance, not a served-byte hash.
- Fresh `npm test` at the exact published source: **76 passed, 0 failed, 0 skipped**, exit 0. The failed export-history-write warning is covered by a simulated storage-failure regression; a real browser storage failure was not induced.

At **23:09–23:10 UTC**, a new tab in the assistant's cloud Chrome browser verified the two version-3 corrections at the live public origin. It reused the already labelled fictional test storage without clearing it. The user’s computer and any real journals were not used.

1. Changing the existing fictional pastor title updated its list row immediately after the save, with focus remaining in the title field. Starting another fictional pack and filling its title/body immediately produced a second row and “Draft saved on this device,” with focus remaining in Provided notes. Neither check needed navigation or reload.
2. Reviewing the one fictional saved journal entry and offering the plain download updated the transfer-history timestamp on the same page. Its count remained one entry and zero drafts. The line still explicitly said saving and restoring an external copy were not verified. Focus returned to “Review plain file,” and the toast accurately reported an offer rather than receipt by the app.
3. Read-only DOM inspection again found `connect-src 'none'` and only local `vendor/qrcode.js`, `app.js`, and `style.css` references. The transfer page had document width 1,173 CSS pixels within an observed 1,188-pixel viewport. Captured errors were attributed to the browser extension; no companion-origin warning/error appeared in that inspected window. This is not a network or privacy certification.

No runtime source change or additional deployment was needed for this verification. Structured evidence is in [evidence/live-version-3.json](evidence/live-version-3.json). The retained local deployment package's 16 runtime files match the published source byte-for-byte; its generated hosting manifest is additional packaging metadata. A request to retrieve the platform archive through the supported file-download tool could not be authorized or resolved, so no alternate download route was attempted. The earlier direct HTTP 403 boundary and all hardware/AT limits below remain.

## Version 2 baseline

Version 2 was deployed successfully at the unchanged public address, https://my-life-with-christ.systemslibrarian.chatgpt.site, on October 13 at 22:19 UTC. Its exact source is `39d8067a2f22eafd1d12b2a7045dbeeb7eb78b88`, pushed and read back on the configured `main` branch by the supported source helper. Saved version: `appgprj_6ac621170d0081918c34b68a6fe97f90~appgver_6e7708d133cc81919b4ef3a73befe86a`; deployment: `appgdep_6aceae6bc56c8191889b1637f4093007`. The original version-1 rollback reference remains in RELEASE-2026-10-13.md.

## Real browser evidence

These checks used the assistant's cloud Chrome browser at the live public origin, not jsdom or the user's computer. The storage page first showed zero entries, drafts, pastor drafts, templates and metadata records. Only clearly labelled fictional data was then created. No browser storage was cleared or real journal inspected.

Passed observed checks:

- Dashboard loaded with start/continue/import/find/move/full-backup actions; privacy/storage page displayed current counts and persistence-not-granted without claiming a backup.
- New sermon editor initially focused My notes; separate notes, reflection and prayer accepted fictional text. Autosave visibly reached “Draft saved on this device.”
- Navigation followed by a full page reload retained an unfinished fictional draft. Continue writing restored its title and all three text fields exactly. Save entry produced a distinct saved entry and truthful local-save feedback.
- Readable sharing opened a real named modal with heading focus. Reflection/prayer started unchecked and absent from the preview. Opting into reflection added only reflection; prayer stayed excluded. Escape dismissed the modal and restored focus to its trigger. The rendered dialog and desktop storage layout were visually inspected.
- Transfer displayed explicit limits, selection and actual receiving-screen guidance. Plain review showed one entry/zero drafts; expanding it showed the separate fields and full-record disclosure. Offering a download reported an offer, not app receipt. The protected review focused Password and could be cancelled without changing the journal.
- Pastor title/church/speaker/Scripture/body fields saved fictional material. Recipient preview showed the provided outline; Back to editing restored focus. A QR was generated locally for the already published fictional example URL, and the result explicitly said no upload/publication occurred.
- Read-only DOM inspection confirmed the delivered CSP still contains `connect-src 'none'`, with local `vendor/qrcode.js`, `app.js`, and `style.css` references. The page loaded and the new runtime workflows executed. At the 1173-CSS-pixel desktop viewport the document had no horizontal overflow.
- Captured warning/error logs showed browser-extension metadata errors, with no errors attributed to the companion origin in the inspected log window. This is not a general network/privacy certification.

## Observed polish corrections

The live smoke run exposed two stale same-page displays: the pastor list still said no saved drafts after a successful new draft save, and transfer history remained old until navigation. A bounded correction updates those displays only after their storage operation completes, without rebuilding the active form or moving typing focus. A related regression ensures a failed export-history write keeps its warning instead of overwriting it with the usual offer message. Storage layout and journal formats are unchanged. Their aggregate test pass, publication/readback and live recheck are recorded above under version 3.

## Limits retained

Direct executor HTTP byte/hash checks received HTTP 403 for the public assets; no custom authentication/header workaround was attempted. Platform saved-source/archive provenance plus the functioning live browser establish the deployed program, but an independent served-byte comparison was not completed. Browser zoom keyboard shortcuts did not change the observed viewport, so 200%/400% zoom and 320-pixel reflow remain unverified rather than being inferred from desktop screenshots. No rendered axe run, real screen-reader session, phone, printed QR camera scan, native file picker, actual physical-disk durability, storage-full or cold-offline/stale-worker lifecycle test is claimed. A download offer does not establish that a phone received or restored it.

The old loopback restriction no longer blocks a live desktop-browser smoke run. The remaining hardware/AT and broader browser matrix in manual-acceptance.md still applies.
