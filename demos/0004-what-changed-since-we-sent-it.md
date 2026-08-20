# 0004 — What changed since we sent it

Proves: M3 — issued packs stop moving
Specs exercised: 0006, 0004
Audience: internal, then design partners
Runtime: target 3 minutes
Status: Built

## The setup

The SLT pack went out on Tuesday. It is Thursday morning, the approval meeting is at eleven, and in between somebody flexed the plan.

## The tension

Every tool in this space renders outputs live. That is right while you are working and wrong the moment something has been sent — the SLT is now looking at a document that has quietly rewritten itself, and nobody knows by how much. The usual defence is a PDF in a folder, which freezes the numbers and loses every thread back to the model that produced them.

## The walkthrough

| # | Action | What they see | The point |
|---|---|---|---|
| 1 | On Outputs, choose the SLT view and press **Issue this pack** | v1, stamped with who, when and which scenario | Issuing is one action, not a save-as ritual |
| 2 | Go to the plan and extend one person by two weeks | The model moves, as it should | Working carries on; the pack is not in the way |
| 3 | Come back to Outputs | v1 now reads **Model has moved**, with the headline: revenue, cost and margin, each with its movement | The state of an issued document is a fact on screen, not something to remember |
| 4 | Press **What changed** | Figures as issued against now; underneath, *why* — "J. Moreau on Data Platform: 35.5 days → 43.6 days" | The movement and its cause, together. One is a number, the other is the argument |
| 5 | Press **Open** | The Outputs views re-render from the frozen document — the recipient's numbers, not today's | "What did they actually see?" answered without a PDF |
| 6 | Export to Excel while the pack is open | The workbook carries the issued figures | The record travels, and stays checkable |
| 7 | Press **Back to the live model**, then undo the edit | v1 returns to **Current** | The comparison is live in both directions |

## The payoff

Step 4. The pack has not changed, the model has, and the app can say precisely how much and because of what. That is the difference between a modelling tool and something a sign-off chain can rely on.

## Data used

Same engagement as demos 0001–0003. Any single allocation edit produces step 3; the walkthrough uses two weeks of one Senior Consultant because the movement is large enough to read and small enough to explain.

## What it deliberately does not do

Restoring the model from a pack. Branching a record without multi-user identity is how work gets lost — see `specs/0006-output-snapshots.md`, *Out of scope*.
