# Contributor instructions

## Current phase

Version 0.1 is a zero-paid-service assisted quote journal. The user approved opening source pages and recording confirmed facts locally. Do not advertise automatic collection, Google email ingestion, OCR, flexible-date automation or complete supplier coverage.

## Privacy

Use generic requirements and synthetic examples. Never add actual travel preferences, trip dates, passenger identities, child profiles, credentials, captured supplier data, browser profiles, databases, or personal screenshots to source, issues, logs, or release artifacts.

Application runtime data must live in per-user application data, not this checkout. Keep credentials in a Windows-protected store. Public CI must never run personal live searches.

## Implementation

Use Electron, React/TypeScript, and built-in SQLite. The available toolchain and required desktop file/notification integrations motivated the initial shell change from the proposed Tauri/Rust stack.

Keep external-source launch actions separate from comparison rules. Validate inputs and IPC senders in the main process. Use exact currency-aware money arithmetic, immutable observations, explicit error states, and user-confirmed quote facts. Never expose raw IPC or Node access to the renderer.

Do not bypass access controls, CAPTCHA, rate limits, or supplier restrictions. Technical accessibility is not authorization for monitoring or historical storage.

## Accessibility and design

WCAG 2.2 AA is required. Before editing HTML, JSX, TSX, Vue, Svelte, CSS, or templates, load and complete accessibility-lead. Use markdown-a11y-assistant for Markdown and document-accessibility-wizard for Office/PDF files.

Use Impeccable for product and interface design. Establish generic design authority before UI work. Provide English and Spanish strings, keyboard support, visible focus, labeled errors, and accessible data-table alternatives for charts.

## Reading and validation

Prefer surgical token-goat reads. Before every file read, determine whether a token-goat command returns the needed symbol, section, structure, or configuration. Use `token-goat index .` when implementation sources exist and are not indexed.

Shell programs such as `rg`, `grep`, and `cat` are commands, not tool identifiers.

Run static validation before targeted tests. Validate native lifecycle, notification delivery, installation, and recovery on Windows rather than treating browser checks as equivalent.
