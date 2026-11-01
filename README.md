# Trip Planner

A local-first Windows desktop application for assisted trip budgeting, comparable flight and accommodation price history, and lower-price alerts.

**Version 0.1: assisted quote capture.** No paid API, subscription, cloud AI, or automatic website scraper is required. Open a source in your browser, enter your search, verify the quote, and record the facts locally. The app compares your saved observations and alerts on eligible price drops.

## Included

- Local trip configuration: destination, dates, adults, child ages, room assignments, budget, and currency.
- An exact-date search checklist with explicitly chosen airports and links to consumer search sites.
- Confirmed flight and accommodation observations entered by the user.
- Comparable price history, quote freshness, and transparent observed-price comparisons.
- Windows notifications and a persistent alert inbox.
- A dashboard for costs, alerts, historical prices, fee completeness, and observation age.
- English and Spanish interfaces.

Alerts are evaluated when you save a complete, comparable quote observed within 24 hours. There is no background collection or tray monitor in this version; closing the window quits the app. Google-managed flight and hotel email alerts can be enabled separately on Google's website, but are not delivered into this app.

Set a minimum comparable drop percentage and optionally a target party price. The target applies separately to each flight or accommodation quote, not their combined sum. Changing the trip currency disables the numeric target rule rather than silently converting or reinterpreting it.

Identify the airline and flights, or the hotel, room and rate plan in each product name. Record promotion eligibility/expiry in quote notes and actual inclusions in the inclusion field. Reusing an ambiguous name such as "Economy" or "Deluxe" across different suppliers will not create a meaningful comparison; manual product verification remains your responsibility.

History begins with your observations. This version manages one active trip, preserving previous configuration history. Exact dates and the home currency must match when recording quotes. For alternative dates/airports, edit the trip to start a separate comparison revision. Flexible-date automation, currency conversion, activities, reservations, itinerary scheduling, and expense tracking are not implemented. Booking and payment remain outside the app.

## Run locally

Use Node.js 24 or newer for development:

```powershell
npm ci
npm run dev
```

For a production build:

```powershell
npm run build
npm start
npm run dist:win
```

The Windows installer is generated under `release`. It is not code-signed; do not bypass Windows security warnings. Signing is a separate future distribution decision. End users of the installer do not need Node.js.

Electron, React, TypeScript, Vite, and SQLite provide the first implementation. Electron was selected instead of the proposed Rust/Tauri shell to use the available toolchain and built-in desktop integrations. The renderer is sandboxed with no Node access; a narrow preload bridge validates operations in the main process. Runtime data lives outside the checkout in per-user application data.

The interface targets WCAG 2.2 AA with semantic tables, native forms, keyboard focus, narrow-screen layouts, and English/Spanish interface strings. Automated checks do not establish complete WCAG conformance or replace NVDA testing.

## Tests

```powershell
npm run check
npm test
npm run build
npm run test:integration
npm run test:sources
```

The desktop integration suite launches real Electron with an isolated temporary SQLite database. It tests configuration, capture, alerts, clipboard, import/export, restart persistence, localization, and automated accessibility. OS file choices and external-browser dispatch are intercepted for deterministic tests; JSON file operations are real. Native notification results report actual observed support/delivery rather than assume success.

Set `TRIP_PLANNER_EXECUTABLE` to the packaged `Trip Planner.exe` to run the same suite against the shipped binary. Set `TRIP_PLANNER_BROWSER_CHECK=1` for the real default-browser handoff test; it opens a temporary loopback test page without submitting travel details. Load-failure recovery is tested by temporarily replacing the main-process load handler. Clipboard contents are restored if they have not changed during the test.

The separate source check uses installed Microsoft Edge and reports landing-page visibility, failures, or bot restrictions. It does not bypass restrictions, run booking searches, enroll Google tracking, or establish source extraction permission. Google email delivery and date-specific supplier availability remain outside our integration.

The initial live checks rendered Google Flights, Google Hotels, Aeromexico and Volaris in headless Edge. Viva failed headless navigation; the user-configured resort returned HTTP 403 there. Both rendered their ordinary consumer interfaces in isolated Chrome without bypassing restrictions. These results validate browser-assisted use, not an unattended rate collector or booking availability. Supplier behavior can change by browser, location and session.

## Project documentation

- [Product requirements](PRODUCT.md)
- [Interface design](DESIGN.md)
- [Provider feasibility and release gate](docs/provider-feasibility.md)
- [Privacy and publication policy](docs/privacy.md)
- [Contributor instructions](AGENTS.md)

## Privacy

This public repository must contain only generic documentation and synthetic examples. Do not commit real trip profiles, passenger information, API credentials, captured supplier responses, local databases, or personal screenshots.

Exports are unencrypted personal JSON. Keep them out of this public repository. Imports validate and merge observations rather than overwrite the existing journal. No credentials or browser cookies are collected. Public provider documentation does not establish permission for scraping or redistribution.

The first release passed 39 domain/money tests. The desktop suite was exercised against development Electron and the final packaged executable. Windows reported a native notification show, and the real default-browser handoff reached its local test receiver. EN/ES automated accessibility, keyboard focus, narrow reflow and restart persistence passed. The packaged archive contained no private artifacts or runtime databases.

The NSIS installer was built, but installation/upgrade/uninstall wizard flows and NVDA narration have not been exercised. Native file-dialog choices are simulated in the suite; actual JSON writes, validation and rollback are tested. The executable uses the default Electron distribution icon and is unsigned. See the design document for the itemized delivery check.

Changing the selected accommodation URL creates a new comparison revision, including for flight observations in this first version. Old exports without property-aware comparison identities remain readable as isolated archives; they cannot supply new price-drop baselines.

## License

Source and original project documentation are available under the [MIT license](LICENSE). Third-party provider data, trademarks, and content retain their own rights and terms.
