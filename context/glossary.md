# Glossary

Consulting vocabulary varies between firms and drifts between teams. These are the definitions this product uses. Where our usage differs from a common alternative, the alternative is noted so it can be caught in conversation.

| Term | Definition here | Watch out for |
|---|---|---|
| **Engagement** | A single piece of client work with one delivery plan, one resource model and one or more commercial scenarios. | Some firms say "project" or "programme"; a programme may contain several engagements. |
| **Delivery plan** | The structure of the work: phases, workstreams, milestones, durations. | Not a task-level project plan. We stop above tasks. |
| **Phase** | A sequential stage of the engagement (Discovery, Build, Deploy, Hypercare). May carry its own commercial structure. | |
| **Workstream** | A parallel strand of work within the engagement (Data Platform, ML, Change, PMO). | |
| **Milestone** | A dated, named delivery event. May gate a payment. | "Milestone" sometimes means only payment milestones. Here it means either; payment linkage is a flag. |
| **Resource model** | The allocation of roles, grades and people to workstreams over time. | |
| **Role** | What the work needs — Data Engineer, Solution Architect. | Independent of grade in our model. |
| **Grade** | Seniority band, carrying cost and charge rates. | Some firms merge role and grade into one ladder. |
| **Assignment** | One role/person allocated to one workstream over a date range at a fractional FTE. | |
| **FTE** | Full-time equivalent. 1.0 = one person, full time, for the period. | Does not account for utilisation on its own. |
| **Allocation** | The fraction of a person's time given to an assignment. | |
| **Availability** | Working days minus holidays and leave. | Before utilisation is applied. |
| **Utilisation** | The proportion of available time expected to be spent on billable delivery. | The single most misapplied number in consulting models. See `domain-model.md` §4. |
| **Ramp-up** | Reduced productivity in a person's first weeks on an engagement. | |
| **Effort day** | One person-day of delivery work. The base unit of the model. | |
| **Cost rate** | What a delivery day costs us, per grade. | Fully loaded vs salary-only changes every margin figure. |
| **Charge rate** | What we bill the client per day, per grade. | |
| **Rate card** | A set of charge rates. Standard (ours) or client-specific (negotiated). | |
| **Blended rate** | A single rate applied across all grades. | Only favourable if the actual grade mix stays junior of the assumed blend. |
| **Effective rate** | `revenue / totalEffortDays`. What we actually earn per day delivered. | Under fixed price this, not the rate card, tells the truth. |
| **Team shape / grade mix** | The distribution of effort across grades. | Derived, never entered. |
| **Gross margin** | `revenue − cost`. As a percentage, over revenue. | Some firms quote margin over cost. Always state the denominator. |
| **Contribution** | Revenue less direct cost, before overhead allocation. | |
| **Contingency** | Buffer effort or cost held against overrun on fixed-price work. | Contingency in *effort* and contingency in *price* are different levers. |
| **Burn curve** | Cumulative cost over time. | |
| **Cash exposure** | The largest gap between cumulative cost incurred and cumulative revenue billed. | Invisible in most spreadsheet models. |
| **T&M** | Time and materials. Bill actual days at agreed rates. | |
| **Capped T&M** | T&M with a not-to-exceed ceiling. | Behaves like fixed price once the cap binds. |
| **Fixed price** | Agreed total for agreed scope, independent of actual effort. | |
| **Outcome / ROI share** | Fee partly contingent on measured client value. | Three distinct shapes — see `commercial-models.md` §6. |
| **Gain-share** | Outcome share measured against an agreed baseline. | |
| **Pod / retainer** | A standing team sold as capacity for a period. | |
| **Guardrail** | A configured commercial threshold (minimum margin, maximum discount) that triggers approval. | |
| **Scenario** | A fork of the commercial model over an unchanged delivery plan. | |
| **SLT** | Senior leadership team — the deal approvers. | |
| **Reference engagement** | The real, completed engagement whose Excel model the engine must reproduce exactly. Our golden test. | |
| **Customer zero** | Us. Our own practice is the first user of the product. | |
