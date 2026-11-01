# Privacy and publication policy

## Public repository

Only source, generic documentation, and deliberately synthetic fixtures may be published. Real trip configurations, traveler identities, child ages tied to a real party, budget details, credentials, supplier responses, signed URLs, and personal screenshots must remain private.

Do not copy private planning artifacts into this repository or its issue tracker. Review every staged file before publishing.

## Planned local storage

Store trip data under the Windows user's application-data directory outside the checkout. Protect credentials through Windows Credential Manager or DPAPI and keep them out of frontend bundles and plain exports.

Local SQLite is not inherently encrypted. Document Windows file-permission and disk-encryption assumptions rather than imply local-only storage guarantees encryption.

Price queries disclose necessary itinerary and party fields to the chosen provider. Minimize those fields and explain this boundary during setup. Do not collect passenger names, passport numbers, or full birth dates merely to hunt prices.

## Logs, backups, and releases

Redact credentials, signed URLs, and personal request fields. Diagnostic export must provide an opt-in redacted preview.

Portable backups should be encrypted and exclude credentials by default. Restores and destructive deletion require explicit confirmation.

Public CI and screenshots use synthetic data only. Build artifacts must not include local databases or runtime exports. Supplier content remains subject to its contract; an open-source license does not grant redistribution rights to that data.
