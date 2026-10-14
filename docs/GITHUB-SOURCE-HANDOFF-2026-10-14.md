# GitHub source handoff — 2026-10-14

This is the existing private repository `prayer-sealed-ministries/my-life-with-christ-web.` (repository ID **1418079428**). Its trailing period is part of its current name. The repository was empty before the authorized source handoff; its name, visibility and permissions were not changed.

## Source identity and fidelity

All **51 original tracked files** are imported byte-for-byte from Sites source commit `cb065aead634686566dc1a0b43fc428d9e6050c2`. Their exact Git tree is `285a56331665b52535099b00daf8923c884b11df`. The GitHub-created original-source tree was checked to have that identical SHA. The handoff documentation, hash manifest and history bundle are additive; no original source file is rewritten.

The supported GitHub connector creates new handoff commits. It does not preserve the original commit authors and timestamps as native GitHub history. Instead, `recovery/companion-source-history.bundle` contains the **complete original 16-commit main history**, including exact original commit identities and metadata, through `cb065ae`. No source-author identity was invented.

Bundle SHA-256: `eee6a2a3864b351ac3c49fb699266263d6d1aa6b6621e58a71d4c4f09ff6929d`.

The complete original file paths, modes, Git blob hashes and SHA-256 hashes are recorded in [the handoff manifest](evidence/github-source-handoff-2026-10-14.json). The source README's future-GitHub statements are historical as of the preserved snapshot; this handoff record is the current repository status.

## Recover original source history

After cloning or downloading this repository, run:

```sh
git bundle verify recovery/companion-source-history.bundle
git clone recovery/companion-source-history.bundle recovered-companion
git -C recovered-companion rev-parse HEAD
git -C recovered-companion rev-parse 'HEAD^{tree}'
```

Expected HEAD: `cb065aead634686566dc1a0b43fc428d9e6050c2`.
Expected tree: `285a56331665b52535099b00daf8923c884b11df`.

This recovers the original history into a separate directory. It does not replace GitHub history, configure a remote, change the live site or move browser journals. Avoid force-pushing or deleting either copy as a migration shortcut.

## Existing deployment remains authoritative

Live public companion: https://my-life-with-christ.systemslibrarian.chatgpt.site

- Sites project: `appgprj_6ac621170d0081918c34b68a6fe97f90`.
- Published version 3 source: `4c1a7bb904c817c277ed8c7790e53ade3aa64e41`.
- Version: `appgprj_6ac621170d0081918c34b68a6fe97f90~appgver_ec608a6762ec8191a2a25af41dc52a41`.
- Deployment: `appgdep_6aceb03f9a08819183bc1146464032e8`, confirmed succeeded on October 13 at 23:09 UTC.
- Platform saved-archive content hash: `sha256:72174ae43f5c3c53e489da19620b6079f9f467a9494867ce917749fae10bb041`.

The documentation source commit contains identical runtime assets to that deployment. No new deployment, Pages workflow run, domain/DNS change or journal-storage migration was made for this handoff. The retained `.openai/hosting.json` still identifies the existing Sites project. The manual Pages workflow is a future option and was not activated.

The original version-1 rollback identity remains in [the release record](RELEASE-2026-10-13.md). Rollback changes served assets; it must not clear users' journal storage. Follow [the hosting transition plan](HOSTING-TRANSITION.md) before any future origin move.

## Verification boundary

Existing published runtime evidence is **76 passed, zero failed/skipped**, plus the documented live desktop-browser smoke/recheck. Tests were not repeated for this unchanged source handoff. [Live evidence](LIVE-VERIFICATION-2026-10-13.md) distinguishes platform provenance from unverified independent served-byte hashes. Physical phone, assistive technology, native file-provider/durability, actual printed QR and broader offline/storage-failure acceptance remain open. The native application release HOLD is unaffected.
