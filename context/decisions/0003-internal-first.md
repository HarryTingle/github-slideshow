# 0003 — Internal first, then productise

Status: Accepted
Date: 2026-08-18
Deciders: Harry

## Context

The buyer is Heads of Consulting at other practices — top-tier firms and specialist data & AI consultancies. But we have the same problem ourselves, and we have something no external buyer can give us at this stage: real engagements, real rate cards, real bids to win or lose, and immediate feedback.

The alternative is building for a market we have not yet interviewed, against a domain model we would have to invent.

## Decision

Build V1 to win our own bids. We are customer zero. Externalisation is milestone five and a deliberate act.

## Consequences

**Makes easy:**
- A real reference engagement to test against, so correctness is provable rather than plausible.
- Feedback in days, from people we can walk over to.
- The product earns its keep before it earns revenue.

**Makes hard / accepted costs:**
- Real risk that our own practice's quirks harden into the product. Mitigated by a standing rule: **our grades, rates, brand and approval thresholds must all be data, never code.** Configurability is a review criterion on every change.
- No external validation of the buyer thesis until M5. Mitigated by starting `/customers` discovery in parallel rather than deferring it.
- Being our own customer makes it easy to build what we ask for rather than what the market needs. Every internal request should be asked of at least one external practice before it becomes a roadmap item.

## Alternatives considered

- **Commercial product from day one** — needs a validated buyer, a generic domain model and multi-tenancy before anything works. Slower to first value and far more likely to build the wrong thing.
- **Consultancy-services model** (build bespoke models for clients as a service) — profitable, but rebuilds the exact pain the product exists to remove.
