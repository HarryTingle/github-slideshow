# 0002 — Stack and architecture

Status: **Accepted** — built as described on 2026-08-19
Date: 2026-08-18
Deciders: Harry

## Context

The repo holds both the workspace and the application. The product's core risk is not UI: it is whether the numbers are right and defensible. The incumbent is Excel, which users trust because they can see every formula. Anything we build must be *more* verifiable than a spreadsheet, not less.

Milestone one is a modelling engine that must reproduce a real engagement's Excel model to the penny, and be provable by test rather than by inspection.

## Decision

**A pure calculation engine, separated hard from the application.**

- `packages/engine` — TypeScript, zero runtime dependencies, no I/O, no framework. Owns every calculation: allocation, capacity, cost, revenue, margin, scenarios, sensitivity. Exhaustively unit tested, with golden-file tests reproducing real engagement models.
- `apps/web` — Next.js (App Router) + TypeScript + React. Presentation and interaction only. Performs no arithmetic the engine could perform.
- **Persistence** — file-backed JSON project documents to begin with; no database, no infrastructure, no migration burden while the model is still changing shape. Postgres when multi-user editing lands in M4.
- **Testing** — Vitest. Engine coverage is a merge gate.
- **Money** — integer minor units throughout. Rounding is a specified, single, presentation-layer step.
- **Export** — SheetJS for Excel. Excel interop is a product feature, not a fallback.

## Consequences

**Makes easy:**
- The maths can be tested, reviewed and trusted independently of any UI.
- Reproducing a real Excel model becomes a test, not a demo.
- The engine is reusable: CLI, API, batch scenario comparison, and eventually a multi-tenant product, all sit on the same core.
- Zero infrastructure until it is genuinely needed.

**Makes hard / accepted costs:**
- Discipline required: it will repeatedly be tempting to compute something in a React component. That temptation is a review failure.
- File-backed persistence will need real migration work at M4. Accepted — the model shape will still be moving until then.
- TypeScript's number type is unsuitable for money, hence the minor-units rule. It must be enforced by review and by types, not by hope.

## Alternatives considered

- **Python engine (pandas/NumPy) with a JS front end** — strong for modelling, but splits the language, adds a service boundary and a runtime, and makes the engine harder to embed in the eventual product. Reconsider if the modelling becomes genuinely statistical (Monte Carlo, optimisation) rather than arithmetic.
- **Spreadsheet-backed (build on Excel/Sheets)** — inherits the trust of the incumbent, and inherits every one of its five documented pains. Rejected.
- **Full-stack framework with DB from day one** — infrastructure and migration cost paid before the domain model is stable. Rejected for now, adopted at M4.
