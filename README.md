# Trip Planner

A planned local-first Windows desktop application for trip budgeting, comparable flight and accommodation price history, and lower-price alerts.

**Status: provider feasibility. There is no runnable desktop application or installer yet.** Implementation is gated on supported automated accommodation rates, required airline coverage, permission to retain observations, and an approved provider budget. Manual entry and mock data do not satisfy this gate.

## Planned first release

- Local trip configuration: destination, dates, adults, child ages, room assignments, budget, and currency.
- Exact and bounded flexible-date searches with explicitly selected airports.
- Automated flight and accommodation observations from approved providers.
- Comparable price history, quote freshness, and transparent observed-price comparisons.
- Windows notifications and a persistent alert inbox.
- A dashboard for costs, alerts, historical prices, and monitoring health.
- English and Spanish interfaces.

Monitoring will run only while the computer is awake and the application or tray process is running. Historical prices begin with collected observations; the app will not claim to have a complete market archive or predict future prices.

Activities, reservations, itinerary scheduling, payment deadlines, and expense tracking are planned for a later release. Booking and payment remain in the supplier's external booking flow.

## Proposed stack

Tauri 2, React, TypeScript, Vite, a Rust core, and SQLite. Credentials belong in a Windows-protected store; trip data belongs outside the repository in per-user application data.

The interface must meet WCAG 2.2 AA. Charts need accessible data tables, controls need keyboard and screen-reader support, and all user-facing text needs English and Spanish localization.

## Project documentation

- [Product requirements](PRODUCT.md)
- [Provider feasibility and release gate](docs/provider-feasibility.md)
- [Privacy and publication policy](docs/privacy.md)
- [Contributor instructions](AGENTS.md)

## Privacy

This public repository must contain only generic documentation and synthetic examples. Do not commit real trip profiles, passenger information, API credentials, captured supplier responses, local databases, or personal screenshots.

No paid provider has been selected or enabled. Public provider documentation does not establish permission for scheduled monitoring or historical retention.

## License

Source and original project documentation are available under the [MIT license](LICENSE). Third-party provider data, trademarks, and content retain their own rights and terms.
