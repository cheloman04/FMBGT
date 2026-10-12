# Plan: abrir y editar reservas de la plataforma (online)

**Overall Progress:** `89%` (8 de 9 pasos; falta la verificación en preview y el deploy)

## TLDR

Hoy Dustin solo puede cambiar el `status` de una reserva hecha en la web. La edición existe solo para las reservas manuales. Esta entrega agrega una **página de detalle por reserva** (`/admin/bookings/[id]`), igual para reservas online y manuales, desde donde Dustin ve todo y puede editar:

- contacto, fecha/hora/duración, ubicación, riders (nombre, bici y estatura), add-ons y notas;
- el precio (recalculado con la tarifa pública, con override y motivo);
- y mover dinero: cobrar la diferencia a la tarjeta guardada, registrar un pago en efectivo/Zelle, reembolsar a la tarjeta o registrar un reembolso en efectivo.

Cada cambio actualiza lo que haga falta: el cobro automático del saldo (monto y fecha), el evento de Cal.com, el inventario de bicis, el waiver, Senzai, Fin Log y, si Dustin quiere, un email "Your booking was updated" al cliente.

## Contexto (ya resuelto por otras entregas)

- PR #12: edición de reservas manuales, `Record payment`, `Retry calendar`, alertas `OPS_ALERT`.
- PR #13/#17 (otra sesión): inventario por rider (`lib/bike-counts.ts`, migración 033), `excludeBookingId`, tours compartidos de Sanford (un evento de Cal.com por grupo, `sharedTourExists`), Sanford a las 10:00. **El precio por grupo de Sanford lo hace esa sesión**: esta entrega usa `calculatePriceBreakdown` tal cual.

## Critical Decisions

- **Precio:** se recalcula con `calculatePriceBreakdown` (la misma fórmula del checkout) y se vuelve a aplicar el código: un porcentaje (FAM/partner) sobre el total nuevo; una gift card, el mismo monto aplicado (como máximo el total nuevo). Dustin puede escribir otro total final con un motivo; el motivo queda en Fin Log.
- **Modelo de dinero (online):** dos columnas nuevas, `extra_paid_cents` (cobros posteriores) y `refunded_cents` (reembolsos). Cobrado neto = depósito + saldo (si se cobró) + extra − reembolsado. Nunca se toca `remaining_balance_amount` una vez cobrado.
- **El saldo programado absorbe el cambio:** si el saldo todavía no se cobró y hay tarjeta guardada, el monto del cobro automático pasa a ser `total nuevo − cobrado`. Si queda en 0 (o < $0.50, el mínimo de Stripe) se marca `waived`. Si queda negativo, la diferencia es un **reembolso pendiente** que Dustin ejecuta con un botón.
- **Fecha del cobro:** `remaining_balance_due_at` se mueve al día antes de la fecha nueva (mismo cálculo que el checkout).
- **Saldo ya cobrado o sin tarjeta:** la diferencia queda como **saldo a cobrar** o **reembolso pendiente**, derivado de los montos (sin columna). Dustin elige: cobrar a la tarjeta guardada (con confirmación), registrar efectivo/Zelle/Venmo, reembolsar a la tarjeta o registrar un reembolso en efectivo.
- **Cobro extra a la tarjeta:** PaymentIntent off-session con la tarjeta guardada, `charge_type: adjustment` y una clave de idempotencia por solicitud (un doble clic no cobra dos veces).
- **Reembolso a la tarjeta:** `stripe.refunds.create` contra el PI del saldo y luego el del depósito, con `metadata.initiated_by = admin`.
- **Webhook `charge.refunded` (bug existente):** hoy marca la reserva entera como `refunded` ante cualquier reembolso. Pasa a: ignorar los reembolsos hechos desde el admin (ya registrados), sumar a `refunded_cents` los reembolsos **parciales** hechos en Stripe (sin cambiar el status) y, en un reembolso **total**, marcar `refunded` y liberar el evento de Cal.com.
- **Cambio de ubicación:** cancelar el evento de Cal.com y crear uno nuevo (el event type y la dirección cambian). Fecha/hora/duración: reprogramar (como ya hace `syncBookingCalendarEvent`).
- **Inventario:** `validateBookingInventory(..., { excludeBookingId })` cuando cambian la fecha, las bicis o los add-ons. Se mantiene el tope por reserva (4 estándar + 2 eléctricas) y el máximo de riders por ubicación.
- **Waiver:** riders nuevos que no cubre ningún `waiver_record` → `waiver_accepted = false` y se genera `waiver_link_token` si la reserva no tenía (las online no lo tienen). El email incluye el link.
- **Vista previa obligatoria:** la edición se calcula primero en modo `dry_run` (sin guardar) y Dustin ve qué va a pasar: precio viejo → nuevo, efecto en el dinero, calendario, waiver.
- **Historial:** cada edición queda en Fin Log como `booking.edited` (categoría `booking`) con los cambios; la página de detalle muestra el historial de la reserva.
- **Senzai:** `booking.rescheduled` si cambia el horario; `payment.succeeded` (stage `balance`, method `stripe`/`cash`/…) en cada cobro; `refund.processed` en cada reembolso. Los cambios de precio sin dinero quedan solo en Fin Log.
- **Email:** el workflow de n8n `Booking Confirmation Email` recibe `updated: true` y `changes_summary`; el asunto pasa a "Your booking was updated". Backup del workflow antes de tocarlo (aprobado por el usuario).
- **Manuales:** la misma página; el precio es el "total acordado" de siempre y el dinero sigue con `Record payment`. Se amplía la edición manual con bici y estatura por rider.

## Tasks

- [x] 🟩 **Step 1: Migración 034** — `extra_paid_cents`, `refunded_cents` (sin aplicar hasta el deploy)
- [x] 🟩 **Step 2: Dinero (puro + tests)** — `lib/booking-money.ts`: total, cobrado neto, saldo programado, saldo a cobrar / reembolso pendiente, nuevo saldo programado
- [x] 🟩 **Step 3: Cotización** — `lib/booking-quote.ts`: precio con la tarifa pública + código (porcentaje o gift card) + override
- [x] 🟩 **Step 4: Edición online (servidor)** — `lib/booking-edit.ts` + `PATCH /api/admin/bookings/[id]` con `dry_run`: validación, inventario, precio, saldo programado, Cal.com (reprogramar o recrear), waiver, Fin Log, Senzai, email
- [x] 🟩 **Step 5: Dinero (servidor)** — `POST /api/admin/bookings/[id]/payments`: `charge_card`, `record_payment`, `refund_card`, `record_refund`
- [x] 🟩 **Step 6: Webhook de reembolsos** — parcial ≠ refunded; ignorar los del admin; total libera Cal.com. Revenue del dashboard con extra − reembolsado
- [x] 🟩 **Step 7: UI** — página `/admin/bookings/[id]` (detalle, edición con vista previa, dinero, historial) + botón "Open" en el dashboard (escritorio y móvil)
- [x] 🟩 **Step 8: Manuales + email** — bici/estatura por rider en la edición manual; email "updated" (online y manual) + cambio en n8n
- [ ] 🟨 **Step 9: Verificación** — `tsc`, tests, `build`, preview con reservas de prueba; aplicar la migración 034; deploy

### Estado del Step 9 (2026-10-11)

- [x] 🟩 `tsc` y `next build` sin errores; `vitest` 62/62 (21 tests nuevos de dinero y cotización); `eslint` sin errores nuevos (el de `AdminClient.tsx` ya existía)
- [x] 🟩 n8n `Booking Confirmation Email` actualizado en producción (compatible hacia atrás; backup en el scratchpad de la sesión)
- [ ] 🟥 Aplicar la migración 034 en Supabase (el código nuevo lee las columnas: va **antes** del preview y del deploy)
- [ ] 🟥 Preview con una reserva de prueba: editar (vista previa + guardar), Cal.com, waiver, email "updated", registrar pago y reembolso en efectivo
- [ ] 🟥 Cobro y reembolso a la tarjeta: solo con un pago real (reserva live-test de $1)
