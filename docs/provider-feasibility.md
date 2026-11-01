# Provider feasibility

## Decision

**Assisted workflow approved.** The user selected a zero-paid-service version that opens ordinary source pages and records confirmed quote facts locally. Mandatory automatic collection is no longer the initial release gate. Automated scraping permission and complete live supplier coverage remain unproven and are not advertised.

This document deliberately contains no personal route, property, party, or budget configuration.

## Candidate evidence

| Candidate | Primary-source evidence | Unresolved requirements |
| --- | --- | --- |
| Amadeus Self-Service | Its FAQ excludes low-cost carriers and several named major airlines. Production retains a free quota with additional billable calls. | Required route/carrier coverage, current unit prices, and applicable retention terms. Not a sole broad-coverage solution. |
| Duffel Flights | Offer requests describe passengers, slices, and cabin. Pricing describes USD 0.005 per excess search above a 1500:1 search-to-order allowance. | Eligibility for monitoring without booking, actual carrier coverage, account charges, and historical-retention permission. |
| Duffel Stays | Getting-started documentation requires an account and a separate Stays access request. Search supports dates, guests, rooms, and accommodation IDs; rates and final quotes are separate steps. | Access approval, exact property identity, occupancy and all-inclusive terms, direct promotion coverage, pricing, and retention permission. |
| Expedia Rapid | Shopping returns rooms, rates, fees, cancellation policies, and price-check links for specified properties and occupancy. | Access and commercial terms, exact property coverage, monitoring-only eligibility, retention, and costs. |
| Hotelbeds | Registration provides evaluation credentials; getting-started documentation describes an evaluation quota of 50 requests per day. | Production access, exact property and rate coverage, retention, monitoring rights, and costs. Evaluation is not proof of live prices. |
| Skyscanner Travel API | Official eligibility excludes non-commercial individuals and low-traffic businesses. | Not a suitable dependency for a personal application. |

Accommodation distribution APIs do not automatically expose direct-property promotions. Label partner rates accurately and verify promotion coverage separately.

## Required proof

1. Obtain user-authorized access and the applicable terms without enabling unapproved paid services.
2. Confirm scheduled monitoring and local history retention are permitted, including retention duration, attribution, and export restrictions.
3. Verify required airlines and exact properties with complete party totals and comparison-relevant inclusions.
4. Record at least three automated observations on separate monitoring runs for each required source.
5. Match proof quotes to the corresponding authorized booking result within the freshness window and one currency minor unit, or explain a documented discrepancy visibly.
6. Present complete account costs, request budgets, minimum commitments, and coverage gaps for approval.

These proof requirements still apply to any future automated collector. They do not describe the assisted quote-entry integration implemented in version 0.1.

## Cost interpretation

Duffel's published excess-search rate supports illustrative scenarios: 1200 charged excess searches would cost USD 6; 6000 would cost USD 30. These figures exclude other fees, taxes, retries, hotel calls, and account minimums. Confirm tracking-only billing with Duffel.

Unknown provider costs are unknown, not zero. No subscriptions, credentials, live searches, or provider access requests have been created by this repository bootstrap.

## Zero-cost consumer integrations

Google Flights offers route, date and flight tracking with email updates. Google's April 2026 announcement also confirms individual-hotel price tracking for signed-in users globally in English and Spanish. The app can open their consumer pages; enabling tracking and receiving email remain outside the app. No Google account is accessed by our code.

Direct supplier links help users verify full party totals and product conditions. Source pages are not prefilled or scraped. Search snippets, marketing "from" amounts, and mismatched room/party dates are not automatically saved as comparable quotes.

For any future collector, review actual site terms and machine-readable instructions. A user gesture or browser permission does not itself authorize scraping. Never bypass private endpoints, CAPTCHA, bot restrictions or rate limits.

## Sources

- [Amadeus Self-Service FAQ](https://amadeus4dev.github.io/developer-guides/faq/)
- [Amadeus pricing model](https://amadeus4dev.github.io/developer-guides/pricing/)
- [Duffel pricing](https://duffel.com/pricing)
- [Duffel offer requests](https://duffel.com/docs/api/offer-requests)
- [Duffel Stays getting-started guide](https://duffel.com/docs/guides/getting-started-with-stays)
- [Expedia Rapid Lodging overview](https://developers.expediagroup.com/rapid/lodging)
- [Hotelbeds getting-started guide](https://developer.hotelbeds.com/documentation/getting-started/)
- [Skyscanner Travel API eligibility](https://www.partners.skyscanner.net/contact/travel-api)
- [Google Flights tracking help](https://support.google.com/travel/answer/6235879?hl=en)
- [Google's individual-hotel tracking announcement](https://blog.google/products-and-platforms/products/search/summer-travel-tips-google-search-ai/)
