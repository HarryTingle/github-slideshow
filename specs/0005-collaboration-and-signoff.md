# 0005 — Collaboration and sign-off

Milestone: M4
Status: Draft
Owner: Harry
Depends on: `specs/0004-shareable-outputs.md`, `context/decisions/0002-stack-and-architecture.md`
Last updated: 2026-08-18

## Job to be done

The promise is that consulting and commercial teams build the full picture **together**. Until then, the delivery lead owns the plan, the commercial lead owns the pricing, and they reconcile by conversation — which is exactly the failure mode of the emailed spreadsheet, reproduced in a nicer tool.

## Why now

Deliberately after outputs, not before. A collaboration tool nobody trusts the numbers in has nothing worth collaborating on. Once M1–M3 land, the constraint becomes access rather than accuracy.

## Behaviour

- Engagements live server-side; several people work on one model
- Roles: **delivery lead** (owns the plan), **commercial lead** (owns pricing and scenarios), **resourcing** (reads the plan, proposes named people), **SLT approver** (reads everything, approves or rejects), **viewer**
- Version history on the model, with named versions at meaningful points ("submitted to client", "SLT approved")
- Comments anchored to a phase, an assignment or a scenario
- Sign-off workflow: submit a scenario for approval → approver sees the SLT pack, guardrail status and the ask → approve, reject or request changes, with a reason
- Notifications on request and decision

## Data

```ts
User        { id, name, email, practiceRole }
Membership  { engagementId, userId, role }
Version     { id, engagementId, createdAt, createdBy, label?, snapshot }
Comment     { id, anchorType, anchorId, body, author, createdAt, resolvedAt? }
Approval    { id, scenarioId, versionId, requestedBy, approver,
              status: 'pending'|'approved'|'rejected'|'changes-requested',
              decidedAt?, reason? }
```

Triggers the move from file-backed JSON to Postgres (`context/decisions/0002`).

## Calculations

None new. Guardrail evaluation (0003) determines which approvals are required.

## Acceptance criteria

- [ ] Two people can edit different parts of one model without overwriting each other
- [ ] The commercial lead can change scenarios without any ability to alter the delivery plan
- [ ] Every change is attributed and reversible via version history
- [ ] A version can be labelled and referenced by an output snapshot
- [ ] Approval requests carry the SLT pack, the guardrail status, and an explicit ask
- [ ] An approval is bound to a specific version — editing the model after approval invalidates it visibly
- [ ] Comments can be anchored to a specific assignment, phase or scenario, and resolved
- [ ] The client view remains impossible to expose internal figures through, under every permission combination

## Edge cases

- Simultaneous edits to the same assignment
- Model edited while an approval is pending
- Approver is also the requester — permitted or not is a policy question → REVIEW Q5
- Someone removed from an engagement while holding a pending approval
- Guardrail thresholds changed after an approval was granted under the old ones

## Out of scope

- Real-time collaborative cursors — versioned edits are sufficient
- Chat
- SSO / SCIM → M5, when external practices arrive
- Audit export for compliance

## Assumptions

`ASSUMPTION: last-write-wins at field level is acceptable; full operational transform is not needed — owner: Harry, raised: 2026-08-18`
`ASSUMPTION: approval is single-stage, not a chain — owner: Harry, raised: 2026-08-18` → REVIEW Q5
