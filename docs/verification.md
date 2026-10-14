# Verification — 2026-10-07

## Evidence

11 automated tests pass with no skipped tests. The UI test covers eight distinct routes and a complete write → draft → resume → save → journal export flow, along with the church builder and QR output. ZIP tests use Python's independent standard-library writer to produce a real deflated archive with matching hashes, and prove that changing a member without updating its manifest is rejected.

Compatibility tests use the app's actual `migrateExport` implementation and five upstream fixtures from commit `e69f961f20280da4d9ef5fec9571eb0e218c1afa`. They require exact entry equality and no migration warnings. A generated entry with separate personal/provided fields also passes through that importer unchanged. Drafts remain drafts.

Additional checks cover invalid and future formats, invalid dates, duplicate identifiers, preserved unknown fields, password encryption/decryption, fresh salts/IVs, wrong-password rejection, modified ciphertext rejection, unchanged existing entries during import, repeat import of a conflict copy, and rejection of stale concurrent edits.

Syntax checks cover every handwritten runtime JavaScript module. All runtime asset URLs are local and the CSP has `connect-src 'none'`. There is no runtime analytics or network-request API in the application. This is a static privacy-design check, not packet-capture evidence.

## Limits

- No rendered-browser screenshots, layout measurements or browser accessibility audit were run. The supported browser-control skill was unavailable in this environment; jsdom tests do not replace those checks.
- No physical iPhone/Android import or operating-system file association was exercised. Compatibility is checked against the current source, not a particular installed build.
- No QR scan on a physical phone was exercised. QR output uses the vendored qrcode-generator library; the user-entered URL is shown beneath the code for review.
- No screen-reader or assistive-technology session was run.
- Native app sources and existing deployments were not changed.

## Before a broad launch

1. Settle the permanent domain; browser storage is isolated by origin.
2. Check desktop and phone layouts, keyboard focus and screen-reader reading order.
3. Write a short entry with each field populated; download it, transfer to a real phone, preview/merge in the installed app, and export back for comparison.
4. Download a Sermon Pack, scan its church-hosted QR link, and import it as provided notes. Verify that personal fields remain empty.
5. Exercise the protected-file flow on the phone: unlock in the companion, download app JSON, then import.
