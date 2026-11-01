# Provider feasibility

## Decision

**Not ready for full implementation.** Supported automated accommodation access, required live flight coverage, historical-retention rights, and approved provider costs have not been established.

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

A supported automated accommodation source, viable required flight coverage, permitted retention, and approved cost are all necessary to pass.

## Cost interpretation

Duffel's published excess-search rate supports illustrative scenarios: 1200 charged excess searches would cost USD 6; 6000 would cost USD 30. These figures exclude other fees, taxes, retries, hotel calls, and account minimums. Confirm tracking-only billing with Duffel.

Unknown provider costs are unknown, not zero. No subscriptions, credentials, live searches, or provider access requests have been created by this repository bootstrap.

## Safe next action

Prepare an account-specific provider decision with authorized access, coverage confirmation, and applicable retention terms. Do not bypass private endpoints or bot restrictions, and do not ship a mock/manual collector as a substitute for the required proof.

## Sources

- [Amadeus Self-Service FAQ](https://amadeus4dev.github.io/developer-guides/faq/)
- [Amadeus pricing model](https://amadeus4dev.github.io/developer-guides/pricing/)
- [Duffel pricing](https://duffel.com/pricing)
- [Duffel offer requests](https://duffel.com/docs/api/offer-requests)
- [Duffel Stays getting-started guide](https://duffel.com/docs/guides/getting-started-with-stays)
- [Expedia Rapid Lodging overview](https://developers.expediagroup.com/rapid/lodging)
- [Hotelbeds getting-started guide](https://developer.hotelbeds.com/documentation/getting-started/)
- [Skyscanner Travel API eligibility](https://www.partners.skyscanner.net/contact/travel-api)
