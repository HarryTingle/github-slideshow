# Business context

Canonical statement. If anything elsewhere in the repo contradicts this, this file wins or this file gets updated.

Last updated: 2026-08-18

---

## Product

A delivery planner and commercial modelling tool for consulting engagements.

A user builds the **delivery plan** (phases, workstreams, milestones, durations), builds the **resource model** on top of it (which roles, at which grades, at what fractional allocation, over which weeks, accounting for real availability), and then flexes the **commercial model** on top of that (T&M, fixed price, capped, outcome/ROI share) to find the shape that wins the bid at an acceptable margin.

The three layers are the product. Tools that do one of them exist. The value is that changing the third does not require rebuilding the first two.

## Who it is for

**Primary user:** Heads of Commercial and Heads of Consulting who build complex resource and commercial models for data & AI consulting engagements — engagements staffed by large teams with a genuine mix of skills, capabilities, seniorities and availabilities.

**Working alongside them:**
- **Delivery leads** — own the plan and the team shape; care about feasibility.
- **Bid / proposal teams** — need a client-ready output fast, on brand.
- **Resourcing teams** — need to know which roles, when, at what FTE, and where the gaps are.
- **SLT / deal approvers** — need margin, risk and contingency laid out well enough to sign.

The tool has to serve all of them from one model. Today each gets a different tab in a different spreadsheet, or nothing at all.

**Buyer:** Heads of Consulting practices — at top-tier practices and at SME/specialist data & AI consultancies.

## The pain

Today this is done in a bespoke Excel model per engagement. That produces five distinct problems:

1. **No alignment to best practice.** Every model is built from scratch or copied from whichever previous engagement was nearest to hand. Institutional knowledge lives in individual spreadsheets.
2. **No brand consistency.** Nothing that comes out of the model is presentable to a client without being rebuilt in slides.
3. **Mathematically fragile.** Bespoke spreadsheets carry bespoke errors — broken references, inconsistent utilisation assumptions, rounding drift, formulas that stopped applying when a row was inserted. The errors are expensive and are found late, if ever.
4. **No repeatable output.** Nothing shareable with the resourcing team, nothing droppable into a proposal, nothing the SLT can sign off from. Each audience gets a bespoke rebuild.
5. **Commercials will not flex.** *The sharpest pain.* Once the delivery plan and resource model are built, playing with the commercial structure — T&M rates, fixed price figures, share of project ROI — is slow and risky. But flexing commercials is exactly what wins bids. The moment the client says "what if it were fixed price?", the model that took two days to build becomes an obstacle.

Point 5 is the wedge. Points 1–4 are why the tool gets adopted after it lands.

## The promise

> One place where the consulting and commercial teams work together to build the full picture of an engagement — delivery, resourcing and commercials — with outputs that are immediately shareable internally, with the SLT, and with the client.

Two words carry the weight: **together** (it is a collaboration tool, not a calculator) and **immediately** (the output is the artefact, not a source for one).

## Strategy

**Internal first, then productise.** V1 is built to win our own bids. We are customer zero, which gives us a real reference engagement, real numbers, and immediate feedback. Productisation is milestone five, not an afterthought — which is why nothing about our own grades, rates or brand may be hard-coded.

## Why this wins

- **Excel** is universal, flexible and trusted — and it is the incumbent. We do not beat it on flexibility. We beat it on repeatability, on speed of commercial flex, and on producing outputs three audiences can use without rework.
- **PSA / resource management tools** (Kantata, Projectworks, Float and similar) manage people who are already staffed on work that already sold. They are weak at the bid stage, where the plan and the commercials are still being invented.
- **Proposal / CPQ tools** produce documents, not defensible models.

The gap is the bid-stage bridge between delivery planning and commercial structuring. That is the product.

ASSUMPTION: the competitive read above is reasoned, not researched — no buyer has confirmed it. Owner: Harry. Raised: 2026-08-18. Resolve via `/customers` interviews.

## What good looks like in 12 months

- Every bid above a threshold value is modelled in the tool rather than in Excel.
- A Head of Commercial can produce three defensible commercial options for a live bid in under ten minutes.
- The resourcing team works from the tool's output rather than asking for a spreadsheet.
- The SLT signs off from the tool's pack.
- Three external design partners are using it on their own bids.
