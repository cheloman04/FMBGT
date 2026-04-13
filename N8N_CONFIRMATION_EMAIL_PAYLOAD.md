# n8n Confirmation Email Payload

The `booking_confirmed` webhook now includes these email-friendly fields in `body.data`:

- `booking_id`
- `session_id`
- `customer_email`
- `customer_name`
- `customer_phone`
- `zip_code`
- `marketing_source`
- `deposit_amount`
- `remaining_balance`
- `remaining_balance_due_at`
- `total_amount`
- `location`
- `date`
- `time`
- `duration_hours`
- `participant_count`
- `participant_info`
- `trail_type`
- `skill_level`
- `meeting_location_name`
- `meeting_location_address`
- `meeting_location_url`
- `booking_start_iso`
- `booking_end_iso`
- `calendar_url`

Useful n8n notes:

- Currency values arrive in cents. Example:
  - `{{$json.body.data.deposit_amount / 100}}`
  - `{{$json.body.data.total_amount / 100}}`
- `calendar_url` returns a dynamic `.ics` file generated per booking.
- `meeting_location_url` is already location-specific and ready for the CTA button.
- `customer_email` now falls back to Stripe metadata when `session.customer_email` is null.

Files prepared for n8n:

- HTML email template: [N8N_CONFIRMATION_EMAIL_TEMPLATE.html](c:/Users/chegl/OneDrive/Desktop/Florida%20Mountain%20Bike%20Trail%20Guided%20Tours/N8N_CONFIRMATION_EMAIL_TEMPLATE.html)

