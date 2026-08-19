# /specs

One file per feature or capability. Nothing non-trivial gets built without one.

Naming: `NNNN-short-title.md`. Numbers are permanent; order in the roadmap is not.

## What a good spec does here

Because this product is mostly maths, a spec is not a description of screens. It is **the calculation, written out, with a worked example and testable acceptance criteria**. If an engineer or an AI cannot implement it without asking what a number means, the spec is not finished.

Every spec must:

- Name the user and the job, not just the feature
- Write out every calculation in full, with a worked example using real-ish numbers
- Define acceptance criteria that someone who did not write the spec could test
- Cite the `/context` files it depends on
- Tag assumptions `ASSUMPTION: … — owner: …, raised: …`
- State what is explicitly out of scope

## Status values

`Draft` → `Ready` → `In build` → `Built` → `Superseded by NNNN`

A spec at `Ready` should be buildable with no further conversation.

## Index

| # | Title | Milestone | Status |
|---|---|---|---|
| 0001 | Modelling engine core | M1 | Built · golden test outstanding |
| 0002 | Delivery plan and resourcing | M1 | Built |
| 0003 | Commercial models and scenarios | M2 | Built |
| 0004 | Shareable outputs | M3 | Built on screen · export outstanding |
| 0005 | Collaboration and sign-off | M4 | Draft |
