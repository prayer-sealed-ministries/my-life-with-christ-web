# Transfer formats

## App-compatible journal

Use the app's existing `journey-export` v1 JSON envelope. `entries` and optional `drafts` remain distinct. A selected subset carries `filter: {}` to identify a partial export. Entry IDs, timestamps, anchors, source material, links, and unknown entry fields survive browser import/export. Full backups preserve unknown journal-envelope fields even for a journal with no entries or drafts. The companion and native schema-3 review code share the preservation contract below. This does not imply that an older installed native edition preserves those fields; retain the original files and verify the receiving build.

The native app reads bare JSON and its own ZIP archives. The companion imports both, but deliberately exports bare canonical JSON; it does not claim to generate the app's full illustrated archive/book. Markdown is a separate readable copy, with independent headings for each writing field.

## Protected companion envelope v1

The `.lwc` extension contains JSON with:

```json
{
  "format": "lwc-companion-protected",
  "version": 1,
  "kdf": "PBKDF2-SHA256",
  "iterations": 600000,
  "cipher": "AES-256-GCM",
  "salt": "base64 of 16 random bytes",
  "iv": "base64 of 12 random bytes",
  "data": "base64 of ciphertext followed by the 128-bit authentication tag"
}
```

Password bytes are UTF-8, with no trimming or Unicode normalization. PBKDF2 derives 256 bits for AES-GCM. Additional authenticated data is the exact UTF-8 string `lwc-companion-protected:1:PBKDF2-SHA256:600000:AES-256-GCM`. Salt and IV are freshly generated per export with Web Crypto. Readers accept only the exact listed parameters and refuse unknown versions. Passwords are not stored. Creation requires at least 12 characters; users are asked for a strong unique password.

Plaintext is a UTF-8 serialized `journey-export` v1 object. These files open in the companion. Direct native support is being implemented on the app review branch, not claimed for a released or installed version. Use a verified supporting app build; otherwise unlock in the companion and use its unencrypted JSON fallback. Files do not expire and are not revocable. Encryption does not protect copies already unlocked, the local working database, or an untrusted device.

## Church content

The public, unencrypted Sermon Pack uses the existing `my-life-with-christ-sermon-notes` v1 format. The published specification is in `dist/sermon-notes-format.md`. The builder refuses more than 25 Scripture references or references over 200 characters so the current app will not silently shorten a generated pack's references. The original notes and attribution stay in `sourceMaterial`, separate from personal fields.

QR codes encode only the publisher's explicitly entered public HTTPS download URL. They do not contain personal notes, upload files, fetch link previews, prove publisher identity, or automatically import a pack.

## Strict reader bounds and compatibility

Protected readers accept only the listed v1 cryptographic parameters and canonical padded RFC 4648 Base64. Salt is exactly 16 bytes; IV is exactly 12 bytes; the final 16 bytes of `data` are the GCM tag. Plaintext is at most 11 MiB, ciphertext plus tag at most 11 MiB + 16 bytes, and the JSON envelope at most 16 MiB. Base64 sizes are checked before decoding. Unsupported metadata is rejected before key derivation; an incorrect password, modified salt/IV/ciphertext, or failed authentication produces a generic unlock error without importing anything.

The fixed AAD authenticates the accepted algorithm/version parameters. Salt and nonce changes invalidate authentication. Unknown envelope fields are not interpreted or authenticated as additional application metadata; never give them security meaning. Journal metadata belongs inside the authenticated plaintext. Passwords remain exact UTF-8, including whitespace and Unicode form; there is no new decryption password-length cap. The implementation uses Web Crypto and has not had an independent security review.

`tests/fixtures/protected-v1.lwc`, `.journey.json`, and `.metadata.json` are independent Node/OpenSSL known-answer fixtures using entirely fictional content and a published fictional test password. They include saved writing, a draft, canonical Scripture anchors, provided material, private fields, and unknown metadata. The fixture's fixed salt and IV must never be reused for production exports.

Companion imports never replace existing writing. The transaction computes the current-state conflict plan again when saving; changed entries/drafts may be kept as detached separate copies. Identical imports, including unchanged previously created conflict copies, are skipped. The receipt counts only committed adds, copies, and skips. If the transaction aborts, no rows or envelope metadata are committed. Edited conflict copies do not hide recoverable incoming originals.

Browser downloads only establish that the file was offered to the browser. Stored export history explicitly records that stage, format, entry/draft counts, and time. It does not establish file write completion, device receipt, successful native import, or a verified backup.

## Journal-envelope extension preservation

This changes local persistence, not the `journey-export` v1 identifier. Unknown root fields exclude only the six established envelope fields: `format`, `version`, `exportedAt`, `filter`, `entries`, and `drafts`.

- A single source map restores its original unknown field paths and values directly.
- Multiple distinct source maps retain all original maps in `_unmigrated.companionSourceEnvelopes`; nonconflicting unknown root fields are also projected back to their original paths. Conflicting values have no invented winner. Current envelope fields from historical companion source maps never replace the current export's records or format.
- A carrier is unpacked only if normalizing its maps and re-encoding it produces exactly the original unknown map under stable JSON equality. Mixed, malformed, unsorted, duplicate, or empty carrier-looking data remains opaque. Nested map contents are never recursively unwrapped. Literal `__proto__` and `constructor` keys remain data.
- Maps are canonical JSON clones, deduplicated and ordered by stable JSON. Repeated full export/import cycles do not multiply or nest generated metadata. Legacy `import-envelope-*` rows remain verbatim source maps; this update does not delete them or change the IndexedDB version.
- Selected/partial exports intentionally omit opaque journal-wide metadata because it may contain unselected private writing. Every selected entry and draft retains its own fields. The review discloses that distinction. Use the explicit full backup, including for an empty journal, to preserve all journal metadata.
- Imports atomically commit records and merged metadata in one IndexedDB transaction. Full exports read entries, drafts, and metadata through one readonly transaction so a concurrent save cannot produce a mixed-state backup.

The shared `tests/fixtures/envelope-metadata-v1.json` contains eight literal golden vectors, byte-identical to the native review source fixture. The companion tests additionally cover legacy rows, conflicting/prototype-looking fields, partial-export privacy, metadata-only empty journals, isolated restore, and twenty repeated cycles. The native schema-3 implementation is review code, not a promise about an installed or released build.

Use an updated supporting app's **Your journal → Journal file to read** to import JSON or `.lwc`. OS tap/Open In and share-to-app routes handle church handouts; they are not journal-file shortcuts. Always keep the original while verifying the destination receipt and recovery.
