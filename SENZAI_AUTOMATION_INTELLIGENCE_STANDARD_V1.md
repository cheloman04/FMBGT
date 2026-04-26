# SENZAI_AUTOMATION_INTELLIGENCE_STANDARD_V1

## Status

Living Standard - Version 1.0  
Purpose: Define the official client-facing KPI language for measuring the real-world impact of Senzai systems.

This document complements:

- BLUEPRINT_CLIENT_IMPLEMENTATION.md
- SENZAI_MARKETING_IMPLEMENTATION_STANDARD.md
- SENZAI_UNIVERSAL_TRACKING_DICTIONARY_V1.md

It does **not** replace them.

Those documents explain how systems are built and tracked.  
This document explains how the value of those systems is measured and communicated to clients.

---

# 1. Core Philosophy

Most clients do not care about:

- APIs
- webhooks
- orchestration layers
- event buses
- workflow nodes
- database schemas

Clients care about:

1. Did I make more money?
2. Did I save time?
3. Did I reduce staffing pressure?
4. Are leads being handled faster?
5. Is the system helping me grow?
6. Is this worth paying for?

This standard exists to answer those questions clearly.

---

# 2. Golden Rule

All client-facing KPI dashboards must prioritize:

## Clarity over complexity

Never overwhelm clients with dozens of charts.

The client should understand the value of Senzai in under 10 seconds.

---

# 3. KPI Categories

All Senzai client dashboards should organize metrics into five simple value pillars:

1. Money Made
2. Time Saved
3. Money Saved
4. Speed to Customer
5. Growth Engine

---

# 4. Official KPI Dictionary

---

## A. MONEY MADE

Measures direct business growth.

| KPI | Definition | Type |
|---|---|---|
| revenue_this_month | Collected revenue during current month | Verified |
| new_clients_this_month | New paying customers acquired this month | Verified |
| conversion_rate | Leads converted to customers | Verified |
| revenue_influenced_by_senzai | Revenue tied to leads touched by Senzai systems | Estimated |

---

## B. TIME SAVED

Measures reclaimed owner/staff time.

| KPI | Definition | Type |
|---|---|---|
| hours_saved_this_month | Estimated admin hours avoided through automation | Estimated |
| avg_hours_saved_per_week | Weekly average time saved | Estimated |
| tasks_handled_automatically | Number of actions completed by system | Verified |

---

## C. MONEY SAVED

Measures labor cost relief.

| KPI | Definition | Type |
|---|---|---|
| labor_cost_saved_this_month | Hours saved x configured hourly rate | Estimated |
| equivalent_staff_cost_avoided | Estimated cost of manual help avoided | Estimated |
| dollars_back_in_pocket | Simplified label for labor + efficiency savings | Estimated |

---

## D. SPEED TO CUSTOMER

Measures responsiveness and sales velocity.

| KPI | Definition | Type |
|---|---|---|
| avg_first_response_time | Average time from inbound lead to first reply | Verified |
| leads_replied_fast | Leads replied to under target SLA | Verified |
| avg_lead_to_client_time | Avg days from lead creation to paying customer | Verified |

---

## E. GROWTH ENGINE

Measures compounding business growth systems.

| KPI | Definition | Type |
|---|---|---|
| reviews_generated | Reviews received after automated review flows | Verified |
| referrals_converted | New customers created through referral systems | Verified |
| repeat_clients_generated | Returning paying clients in period | Verified |

---

# 5. Verified vs Estimated Rule

Dashboards must distinguish clearly:

## Verified Metrics

Directly sourced from timestamps, payments, records, or logs.

Examples:

- revenue_this_month
- new_clients_this_month
- avg_first_response_time
- reviews_generated

## Estimated Metrics

Modeled using transparent assumptions.

Examples:

- hours_saved_this_month
- labor_cost_saved_this_month
- dollars_back_in_pocket

Never present estimated values as guaranteed exact truths.

---

# 6. Required Top Dashboard Cards

Every Senzai client dashboard should prioritize these six cards:

1. Revenue This Month
2. Hours Saved
3. Money Saved
4. Avg Response Time
5. New Clients
6. Reviews Generated

Optional seventh card:

7. System Health

---

# 7. Client-Friendly Language Standard

Use plain language.

## Correct

- 43 tasks handled for you automatically
- $1,240 in staff time saved this month
- Leads became paying clients in 9.2 days average
- 7 new reviews generated

## Avoid

- Workflow executions
- Node throughput
- Labor efficiency ratio
- Conversion velocity delta

---

# 8. Data Source Hierarchy

Metrics should be derived from:

## Primary Sources

- Supabase transactional data
- business_events logs
- automation_events logs
- communication_events logs

## Secondary Sources

- Kommo timestamps
- Email provider logs
- Stripe records
- Cal.com booking timestamps

---

# 9. Recommended Calculation Rules

## Hours Saved

Use per-action time assumptions.

Example:

- reminder sent = 3 min saved
- follow-up sent = 5 min saved
- booking confirmation = 4 min saved

Formula:

(sum task counts x minutes) / 60

## Labor Cost Saved

Formula:

hours_saved_this_month x configured_hourly_rate

## Revenue Influenced by Senzai

Revenue where lead touched one or more Senzai flows.

---

# 10. Monthly Summary Widget

Every dashboard should include a simple narrative summary.

Example:

> This month Senzai helped generate $8,420, saved you 18.6 hours, reduced workload worth $540, replied to leads in 4 min average, and helped bring in 11 new clients.

---

# 11. Industry Adaptation Rule

Same KPI framework, different wording per industry.

Examples:

## Tattoo Studio

- New Clients
- Tattoo Bookings
- Reviews Generated

## Med Spa

- New Patients
- Consultations Booked
- Reviews Generated

## Tour Business

- New Riders
- Tours Booked
- Reviews Generated

---

# 12. Dashboard Design Rule

The dashboard should feel:

- premium
- simple
- executive
- confidence-building

Never cluttered.

Clients should feel:

> This system is making my business stronger.

---

# 13. Strategic Purpose

This KPI layer transforms Senzai from:

## Vendor

"they built automations"

into:

## Profit Center

"they help me make more, save more, and operate better"

---

# 14. Future Expansion Reserved

Potential V2 additions:

- AI conversation resolution rate
- missed lead prevention score
- lifetime value growth
- retention lift
- payroll pressure reduction index
- opportunity recovery score

---

# Final Standard

If a client cannot quickly understand the benefit of Senzai, the dashboard has failed.

The purpose of metrics is not to impress.

The purpose of metrics is to prove value clearly.
