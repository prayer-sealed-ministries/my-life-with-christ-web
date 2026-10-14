# A church guide to sharing sermon notes

Use this guide with the public web companion for **My Life With Christ**. A church shares a public Sermon Pack; each reader keeps their own writing in **My Journey With Christ**. There is no shared journal, church account or automatic sync in the companion.

## 1. Prepare a public outline

Open the Sermon Pack builder and add the title, church, speaker, sermon date, Scripture references and provided notes. Include attribution and any reuse permission in the notes themselves so the wording travels with the file.

Only include material you have permission to distribute. Scripture references are usually enough; do not copy a licensed Bible translation, another author's outline, identifiable prayer requests or a reader's private writing without the appropriate permission. A pack is public and unencrypted.

Preview the pack and download its `.json` file. Open the downloaded file to check the text. Keep a source copy before changing an outline. A locally saved builder draft is not a backup. Use “Download draft recovery copy” for an unfinished outline, then “Restore a church draft file” to recover it as a separate builder draft. Recovery permits an empty outline, but publication still requires validation. Only supported public v1 fields are restored; unknown fields are excluded. Templates and pastor drafts are separate from personal-journal backups.

The file uses the existing `my-life-with-christ-sermon-notes` version 1 format. The [downloadable specification](sermon-notes-format.md) and [fictional example](example-sermon-notes.json) show its structure. It is plain JSON text, without embedded PDF/DOCX attachments. The builder accepts up to 25 Scripture references of 200 characters each, and a provided-notes body of up to 200,000 characters.

## 2. Host the JSON on your church website

The builder does not upload or publish your pack. Ask the person responsible for your church website to upload the reviewed JSON file to an appropriate public location and give you its direct HTTPS download link.

For the website maintainer:

- Serve the actual UTF-8 JSON file, preferably with an `application/json` content type and a useful `.json` filename. Avoid a link that returns a website editor, sign-in screen or preview page.
- Use a stable HTTPS file URL controlled by the church. Test it while logged out and on a phone. A link that works only for a signed-in administrator is not a public download.
- A dated filename helps readers distinguish editions. If an outline changes, make the change visible in the title/notes or filename and retain the earlier source as appropriate. This convention does not create a revision protocol.
- Do not put personal journal exports, protected journal files, passwords, private download tokens or private journal URLs on the church website or in a QR code. A protected journal file is still private material, not a public Sermon Pack.
- Keep hosting and access-log practices consistent with your church's privacy policy. The companion does not manage the host or its logs.

## 3. Generate and test the QR

Paste the reviewed public HTTPS file URL into the builder's QR field and generate the QR image. Compare the displayed URL with the file you intended to share, then download the image.

**The QR only contains the URL. It does not publish, upload, verify the church, or import the pack.** Readers who scan it visit that website. Do not use a private sharing link. Include a human-readable public destination beside the printed QR so readers can check where it leads.

Before printing a full bulletin, scan a small printed proof on both an iPhone and an Android phone. Confirm the exact JSON file downloads while logged out and that the supported app can review/import it. Test again whenever the destination file or hosting changes. Keep ordinary printed notes available for people who do not want to scan a code.

## 4. What a reader should expect

A reader downloads the church file and chooses it in the app's provided-notes importer or the companion's notes-import flow. They review before adding it. The title, church, speaker, date and references may supply entry details; the outline remains labelled **Provided notes**. Personal notes, reflection and prayer remain separate and initially empty for a new imported entry.

The file's church and speaker names are publisher-supplied claims. A QR and a filename are not proof of authorship. Verify an unfamiliar destination through the church's known website or contact before relying on its attribution.

Version 1 has no stable pack ID, revision/replacement rules or authenticated publisher signature. A checksum, when recorded by a reader, identifies file bytes; it does not verify the church. Two different sermons can have the same title. Do not promise automatic replacement or title-based duplicate detection when distributing a corrected pack.

## 5. Keep public packs separate from personal transfers

A public pack contains material intended for distribution. A personal journal export can include a person's notes, reflection, prayer and unfinished drafts. Never upload a journal export as a sermon handout.

When moving personal writing between the companion and the native app:

1. Choose the saved entries and unfinished drafts deliberately. Review any date range, the selected titles/counts and the export type. Partial transfers omit journal-wide opaque metadata that might refer to unselected private writing; a full backup includes and previews it. Retain original files when transferring to older app editions.
2. A journal JSON file is unencrypted and readable by anyone who gets it. A readable Markdown copy is also unencrypted; review its included fields and opt into reflection or prayer only when intended.
3. A protected `.lwc` file encrypts the selected journal locally with a password. Use a strong unique password and keep it safely; there is no password recovery. Encryption does not protect the unlocked browser database or copies that have already been unlocked.
4. In an updated supporting app, open **Your journal → Journal file to read** and choose the JSON or `.lwc` file. OS tap/Open In and share-to-app routes handle church handouts; they are not journal-file shortcuts. Verify that the installed build supports protected transfers. If it does not, unlock in the companion, review, download app-compatible JSON and use that same journal-file screen. The intermediate JSON is an unencrypted copy.
5. Review the destination import and conflicts. Check saved entries, drafts and all provided/personal fields, then keep a tested backup. Preparing a download does not prove it reached the other device.

The web companion has no account, backend, telemetry or automatic upload of writing. Local storage can still be lost through clearing site data, private browsing, device loss or browser decisions. A persistence request does not create a backup. The website must load from its host; this edition has no service worker or guaranteed offline installation.

## Moving the companion to a new address

A different origin has different browser storage. A new domain, redirect or familiar-looking page does not move an existing journal.

Before closing the old site, ask readers to:

1. Open the old address and download a full journal backup, including unfinished drafts. Confirm the actual file was saved; retain an untouched copy.
2. Open the new address, import the file and review counts, conflicts and representative entries/drafts before accepting it.
3. Restore a backup copy in an isolated browser profile/origin and verify recovery. Avoid testing by clearing the only existing journal.
4. Keep the old origin and original backup available until the move is verified. Only then consider retiring the old site under a separately agreed migration plan.

The name `journal.prayersealed.org` is a proposal, not a configured or verified destination in this guide. Do not print it as a working journal link without separate setup and testing.

## Before your first Sunday

- Review rights, attribution and public-only content.
- Download and inspect the JSON.
- Test the logged-out HTTPS download and printed QR on real phones.
- Confirm provided notes remain separate from personal writing.
- Record the browser/app versions you actually tested.
- Keep a source copy, a readable alternative and a contact for corrections.

This guide describes the workflow. It is not evidence that a particular host, QR, phone, app build or domain has passed those checks.
