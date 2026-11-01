# Contributor instructions

## Current phase

Provider feasibility only. Do not build or advertise a complete application until automated accommodation access, required flight coverage, historical-retention permission, and provider budget approval are established.

## Privacy

Use generic requirements and synthetic examples. Never add actual travel preferences, trip dates, passenger identities, child profiles, credentials, captured supplier data, browser profiles, databases, or personal screenshots to source, issues, logs, or release artifacts.

Application runtime data must live in per-user application data, not this checkout. Keep credentials in a Windows-protected store. Public CI must never run personal live searches.

## Implementation

Use Tauri 2, React/TypeScript, Rust, and SQLite unless feasibility evidence requires an explicitly documented architecture change.

Keep provider adapters separate from comparison rules. Validate inputs in the Rust core. Use exact currency-aware money arithmetic, immutable observations, explicit availability/error states, and source-specific retention limits.

Do not bypass access controls, CAPTCHA, rate limits, or supplier restrictions. Technical accessibility is not authorization for monitoring or historical storage.

## Accessibility and design

WCAG 2.2 AA is required. Before editing HTML, JSX, TSX, Vue, Svelte, CSS, or templates, load and complete accessibility-lead. Use markdown-a11y-assistant for Markdown and document-accessibility-wizard for Office/PDF files.

Use Impeccable for product and interface design. Establish generic design authority before UI work. Provide English and Spanish strings, keyboard support, visible focus, labeled errors, and accessible data-table alternatives for charts.

## Reading and validation

Prefer surgical token-goat reads. Before every file read, determine whether a token-goat command returns the needed symbol, section, structure, or configuration. Use `token-goat index .` when implementation sources exist and are not indexed.

Shell programs such as `rg`, `grep`, and `cat` are commands, not tool identifiers.

Run static validation before targeted tests. Validate native lifecycle, notification delivery, installation, and recovery on Windows rather than treating browser checks as equivalent.
