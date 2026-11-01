# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The interface is web-based inside a Windows-first Tauri desktop shell. This value describes the interface technology, not a hosted service.

## Users

Individuals planning personal trips who need reliable price comparisons and a local record of costs without publishing their travel details.

## Product Purpose

Help users understand the current cost of a trip, compare equivalent flight and accommodation offers with previously observed prices, and notice meaningful lower-price opportunities.

## Operating Context

A Windows computer running the application or its tray process while awake. Saved data remains available offline. No required cloud account, hosted backend, telemetry service, or synchronization.

## Capabilities and Constraints

The first release covers trip and party configuration, bounded flexible searches, automated flight and accommodation collection, comparable history, alerts, a dashboard, and basic budget allocations.

Automated accommodation rates, relevant airline coverage, permitted observation retention, and approved provider costs are prerequisites. Manual-only collection cannot satisfy the release gate.

The application records observed prices, not a guaranteed market-wide history. Incomplete fees, stale quotes, indicative prices, and collection failures must remain distinguishable from actionable offers.

Activities, reservations, itinerary planning, and actual expenses follow in a separate release. Automatic booking and payment are outside scope.

## Evidence on Hand

Public provider documentation describes candidate search APIs but does not prove approved access, property or route coverage, or historical retention rights. No live provider proof or runnable app exists yet.

## Product Principles

- Compare equivalent products and complete party totals.
- Explain source coverage, freshness, and uncertainty.
- Keep personal data local and out of public artifacts.
- Persist alerts before attempting native delivery.
- Stop unsupported collection rather than disguise failure as a bargain.

## Accessibility & Inclusion

Meet WCAG 2.2 AA. Support English and Spanish, original quote currencies, a selectable home currency, keyboard navigation, screen readers, reduced motion, high contrast, and accessible alternatives to charts.
