# Interface design

## Product scene

A person compares travel costs at a desk, under ordinary daylight, using a Windows laptop. The interface is a working price journal: the important distinction is between a complete comparable observation and an attractive but incompatible headline price.

## Mode and visual world

Operate. Use the grammar of a travel expense ledger: aligned amounts, visible row boundaries, source and observation dates adjacent to each price, and a clear handoff from source checking to confirmation.

Restrained color strategy: cool light gray workspace, white editable surfaces, dark blue-gray text, and dark teal actions. No resort marketing photography, invented price charts, decorative metric cards, or price predictions. Segoe UI follows Windows reading conventions.

Design Read: practical, measured, and evidence-led. ENERGY 1 / RHYTHM 2 / MOTION 0. The cost ledger is the overview's focal point, the editable form anchors each task, and row rules repeat the journal motif. Whitespace separates work stages, not marketing sections; motion is unnecessary for reading and entering quotes.

## Composition and controls

A compact masthead contains the product name and language control. Horizontal navigation connects Overview, Update prices, Trip settings, and Alert inbox. The overview is a cost ledger followed by the actual observation table. Update prices pairs a source checklist with an inline quote form.

Native inputs, buttons, select controls, tables and fieldsets provide familiar affordances. Keep one h1, visible keyboard focus, associated hints, a skip link and a persistent status region. Narrow windows stack forms and source actions; wide history tables retain an explicitly labeled scroll region.

## States and truth

Start empty, without prefilled private travel details. Display unavailable estimates as missing rather than zero. Identify incomplete taxes/fees, old observations and previous trip revisions. Windows delivery is best effort; the persisted inbox is authoritative.

The app does not automatically fill supplier filters, scrape protected websites, connect to Google accounts or receive Google email alerts. Explain that boundary at the source action, not only in documentation.

## Design delivery check

Evidence is the built application, the Electron and packaged-executable integration runs, eight EN/ES axe scans, four narrow-window route checks, forced-color/reduced-motion checks, and batched desktop/narrow visual inspection. This is a design check, not complete WCAG certification. The deterministic detector's one finding is contextual: the active navigation underline uses an explicit zero border radius, not a rounded card.

- R-02 PASS: interface prose uses no em dashes.
- R-03 PASS: all four Spanish routes have no page overflow at 390px; tables scroll within their labeled region.
- R-17 PASS: amounts come from saved observations; test screenshots explicitly label synthetic products.
- R-18 PASS: no testimonials or invented people.
- R-23 PASS: no supplier logos, generated photos, avatars or invented promotional assets; the directional mark is a simple navigation motif.
- R-24 PASS: all four navigation destinations were exercised in both languages.
- R-25 PASS: normal-mode axe contrast checks reported no violations on all eight views.
- R-26 PASS: source, capture, rules, read, language, history, file, retry and setup controls have working actions exercised by the desktop suite.
- R-27 PASS: fresh empty journal, loading, synthetic load failure and invalid-trip recovery were exercised.
- R-28 PASS: no filler FAQ.
- R-32 PASS: native controls, skip link, focus transfer and a visible keyboard focus outline are present; keyboard focus was checked.
- R-33 PASS: implementation edits were made in source, not via external CSS mutation.
- R-34 PASS: no unsupported theme toggle; forced-color behavior was checked.
- R-35 PASS: production build and shipped executable ran; desktop controls were exercised, including error-only retry.
- R-36 PASS: no forecast, complete-market, encryption or WCAG-conformance claims.
- R-37 PASS: the product scene, Operate mode and explicit design dials preceded the interface work.
- R-38 PASS: empty startup has no fictitious live prices; only clearly synthetic test data appears in evidence.
- R-01 PASS: no gradients or glows.
- R-04 PASS: only directional indicators, relevant to navigation and opening an external browser.
- R-06 PASS: Segoe UI follows the Windows reading environment; aligned numeric amounts serve comparison.
- R-07 PASS: no background grid or graph-paper ornament.
- R-08 PASS: external-source arrows explain the browser handoff; navigation labels are plain text.
- R-09 PASS: small rectangular labels identify actual fees, freshness and read state, not marketing claims.
- R-10 PASS: no glassmorphism.
- R-12 PASS: no floating-card shadows.
- R-13 PASS: no glow effects.
- R-14 PASS: the overview is a price ledger, not uniform feature cards.
- R-19 PASS: MOTION 0 matches the absence of decorative animation.
- R-22 PASS: no generic stock illustrations.
- Dials PASS: ENERGY 1 / RHYTHM 2 / MOTION 0 are recorded above.
- Dial consistency PASS: restrained actions, ledger rows and separated work stages match those values.
- Focal point PASS: cost estimate, capture form, trip form or inbox anchors its corresponding route.
- Whitespace PASS: spacing separates task stages and supporting explanations.
- Accent PASS: teal identifies primary actions and the current destination.
- Motif PASS: row boundaries, aligned amounts and adjacent provenance repeat the travel journal grammar.
- Design Read PASS: practical, measured and evidence-led direction is recorded above.
- C-1 PASS: typography, color and ledger composition have task-specific reasons.
- C-2 PASS: every displayed action has a real handler; no unfinished demo controls.
- C-3 PASS: sections configure the trip, check sources, capture evidence or act on alerts.
- C-4 PASS: normal, narrow, forced-color and reduced-motion states were exercised.
- C-5 PASS: no fabricated customer, security or performance evidence.
- R-05 PASS: no marketing hero/cards/footer template in the working dashboard.
- R-11 PASS: 4px controls, 3px status labels and square navigation avoid pill uniformity.
- R-15 PASS: labels name the action: save quote, copy checklist, mark read and import data.
- R-16 PASS: no AI-marketing buzzwords.
- R-20 PASS: price comparability, quote completeness and source-check/capture workflow define the interface.
- R-21 PASS: light working surfaces suit the stated daylight Windows scene; no forced dark mode.
- R-29 PASS: neutral surfaces and teal actions form the palette; error and focus colors have semantic roles.
- R-30 PASS: no imitation of a named product's brand or layout.
- R-31 PASS: major decisions are explained in the product scene, visual world and composition sections.
