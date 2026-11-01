# Privacy and publication policy

## Public repository

Only source, generic documentation, and deliberately synthetic fixtures may be published. Real trip configurations, traveler identities, child ages tied to a real party, budget details, credentials, supplier responses, signed URLs, and personal screenshots must remain private.

Do not copy private planning artifacts into this repository or its issue tracker. Review every staged file before publishing.

## Local storage

Trip data is stored under the Windows user's application-data directory outside the checkout. The app does not collect provider credentials, browser cookies, payment cards or passenger identity documents.

Local SQLite is not inherently encrypted. Document Windows file-permission and disk-encryption assumptions rather than imply local-only storage guarantees encryption.

Opening a source discloses ordinary browser connection metadata to that site, but does not submit itinerary or party fields. Copying a checklist writes the trip search facts to the Windows clipboard. Entering filters or enabling Google's tracking on a website is a separate action performed by the user. Do not collect passenger names, passport numbers, or full birth dates merely to hunt prices.

## Logs, backups, and releases

No diagnostic-upload service or telemetry is implemented. Do not upload application-data files or personal screenshots to this public repository.

The explicit JSON export contains personal trip configuration and price history and is **not encrypted**. The UI warns about this before opening the save dialog. Keep exports in a protected location; encrypted portable backup is not implemented. Import validates the whole file and merges observations rather than deleting the existing journal.

Public fixtures use synthetic data only. Test reports, screenshots, local databases and runtime exports are excluded from publication. The installer packages an explicit source/build allowlist. Supplier content remains subject to its contract; an open-source license does not grant redistribution rights to that data.
