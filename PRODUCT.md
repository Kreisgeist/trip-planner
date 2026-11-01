# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The interface is web-based inside a Windows-first Electron desktop shell. This value describes the interface technology, not a hosted service.

## Users

Individuals planning personal trips who need reliable price comparisons and a local record of costs without publishing their travel details.

## Product Purpose

Help users understand the current cost of a trip, compare equivalent flight and accommodation offers with previously observed prices, and notice meaningful lower-price opportunities.

## Operating Context

A Windows computer running the application. Saved data remains available offline. No required cloud account, paid data service, hosted backend, telemetry service, or synchronization. Closing the window quits; no background scraper runs.

## Capabilities and Constraints

The first assisted release covers one active trip and party configuration, exact search checklists, user-confirmed flight and accommodation observations, comparable history, alerts, a dashboard, and a total budget.

The user approved assisted updates as a replacement for paid/mandatory automatic collection. Source pages open in the external browser without prefilled filters; the user checks conditions and records quote facts. Automated scraping, browser extensions, OCR, flexible-search matrices, exchange rates, and Google email ingestion are not present in this version.

The application records observed prices, not a guaranteed market-wide history. Incomplete fees, stale quotes, indicative prices, and collection failures must remain distinguishable from actionable offers.

Activities, reservations, itinerary planning, category expenses, and multiple-trip management follow in a separate release. Automatic booking and payment are outside scope.

## Evidence on Hand

Public documentation confirms Google's free consumer flight and individual-hotel alerts. These are external features, not a feed into our app. The app's integrated sources are launch links and user-confirmed observations, not verified full airline/property coverage.

## Product Principles

- Compare equivalent products and complete party totals.
- Explain source coverage, freshness, and uncertainty.
- Keep personal data local and out of public artifacts.
- Persist alerts before attempting native delivery.
- Stop unsupported collection rather than disguise failure as a bargain.

## Accessibility & Inclusion

Meet WCAG 2.2 AA. Support English and Spanish, original quote currencies, a selectable home currency, keyboard navigation, screen readers, reduced motion, high contrast, and accessible alternatives to charts.
