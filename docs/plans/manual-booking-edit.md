# Plan: editar reservas manuales + arreglar sincronización con Cal.com

**Overall Progress:** `69%` (9 de 13 pasos de la Fase 1; 2 más en curso)

## TLDR

Dustin no puede editar una reserva manual: el admin solo cambia el `status`. Además, Cal.com está rechazando **todas** las reservas (online y manuales) desde que sus 3 event types piden ubicación `attendeeDefined`. Por eso la reserva de Laura Walton (`117c6832-68c1-4ea9-95e8-b194f88c818a`, sáb 24 oct 9:00 AM, Markham Woods) quedó sin evento en el calendario, y el 24 de octubre a las 9:00 sigue disponible online. Nadie se enteró del fallo durante 2 días.

Dustin la guardó con $0 para apartar la fecha. Por eso a Laura le llegó un email de confirmación con total $0, y Fin Log y Senzai no registran el pago.

**Fase 1 (esta entrega):**
1. Arreglar la creación de eventos en Cal.com (ubicación y duración real).
2. Avisar en el momento cuando algo falla.
3. Agregar un botón para reintentar el calendario.
4. Modo "apartar fecha" con pago pendiente y un botón **Record payment**.
5. Agregar un botón **Edit** a las reservas manuales, incluido el control del waiver.
6. Liberar el calendario cuando una reserva se cancela o se borra.
7. Enviarle a Dustin una revisión diaria de los próximos tours con problemas.

**Fase 2 (después):** inventario de bicis por rider, reprogramar reservas online, sincronizar cambios hechos en Cal.com y multi-bookings para los tours de Sanford.

## Critical Decisions

- **Ubicación en Cal.com:** el código envía `location: { type: 'attendeeDefined', location: <meetingPointAddress> }`, tomado de `getBookingLocationMeta()`. No hace falta cambiar la configuración de Cal.com, y en el evento aparece la dirección real del punto de encuentro.
- **Duración real del evento:** `createCalBooking` ya recibía `endIso` pero lo ignoraba. Ahora calcula `lengthInMinutes` con eso, sin tocar a quienes llaman la función. Si Cal.com rechaza un campo opcional (`lengthInMinutes`, o `location` si cambian la configuración), se reintenta sin él. Así nunca volvemos a quedar sin evento.
- **Cambio de fecha u hora:** usamos `POST /v2/bookings/{uid}/reschedule` de Cal.com, no cancelar y volver a crear. La clienta recibe un aviso de "rescheduled" en vez de "cancelled", el cambio es atómico aunque el horario nuevo se solape con el viejo, y la respuesta trae el `uid` nuevo, que guardamos. Si no existe evento (o fue cancelado en Cal.com), se crea uno.
- **Dos montos separados: total acordado y cobrado:**
  - El total acordado (`total_price`) se cambia con Edit.
  - Lo cobrado (`deposit_paid_cents`) solo sube con **Record payment**. Así cada dólar que entra tiene su propio registro en Fin Log y en Senzai, en vez de "diferencias" difíciles de interpretar.
  - El saldo (`remaining_balance_amount`) es total menos cobrado; `remaining_balance_status` queda en `pending` hasta llegar a 0 y entonces pasa a `paid`. No hace falta una columna nueva.
  - Corregir un pago mal registrado queda fuera de esta entrega.
- **El saldo manual nunca se cobra por Stripe:** el cron `charge-remaining` exige `stripe_payment_method_id` y `remaining_balance_due_at`. Las reservas manuales no tienen ninguno de los dos, así que su saldo pendiente queda solo como registro.
- **Eventos de Senzai:** cada Record payment envía `payment.remaining_balance_succeeded` (con `manual_booking` y `payment_method`), que encaja con la definición de `collected_revenue` (depósitos más saldos pagados). Los cambios de campos, incluido el total acordado, envían `booking.updated`. Los dos eventos ya existen en el Tracking Dictionary.
- **Qué se puede editar:** contacto (nombre, email, teléfono), fecha, hora, duración, nombres de riders (`participant_count` se recalcula), total acordado, método de pago y notas. Trail, ubicación y bici quedan fuera porque cambian el event type de Cal.com. Para eso se cancela la reserva y se crea otra.
- **Dónde va el código:** se extendió el `PATCH` de `/api/admin/manual-booking` (antes solo hacía `resend`) con las acciones `update` y `record_payment`. La lógica está en `lib/manual-booking.ts`, y la sincronización con el calendario en `lib/booking-calendar.ts`.
- **Inventario:** el trigger de bicis solo se ejecuta en `INSERT`. Al cambiar la fecha llamamos `validateBookingInventory()` antes de guardar y devolvemos 409 si no hay bicis.
- **Waiver después de cambiar riders:** los nombres nuevos se comparan con `waiver_records.participants_covered`. Si alguien queda sin cubrir, se pone `waiver_accepted = false` para que el link permita firmar de nuevo. Las firmas anteriores se conservan como registro legal, y como `waiver_accepted_at` se mantiene, la tarjeta muestra "Waiver needs update" sin columnas nuevas.
- **Alertas:** se reutiliza `notifySupportAlert` (evento `ops_alert`). Al revisar n8n vimos que **ningún workflow manejaba `ops_alert`**, así que se creó el workflow `OPS_ALERT` y la variable `N8N_OPS_ALERT_WEBHOOK_URL` (Step 3).
- **Estado del calendario:** una migración agrega `'cancelled'` al CHECK de `cal_booking_status`.
- **Emails de Cal.com:** Cal.com avisa al cliente cuando se crea o se mueve un evento. Esto ya pasa con todas las reservas online, así que lo dejamos igual.

## Tasks — Fase 1

- [x] 🟩 **Step 0: Investigación y causa raíz**
  - [x] 🟩 Confirmar que el admin no tiene edición (solo `status` en `update-booking`)
  - [x] 🟩 Revisar la reserva de Laura en Supabase: $0 cobrado, "Rider 2" y "Rider 3", `cal_booking_status = failed`
  - [x] 🟩 Encontrar la causa en los logs de Vercel: Cal.com responde 400 *"requires attendee location"*; los 3 event types usan `attendeeDefined`

- [ ] 🟨 **Step 1: Arreglar `createCalBooking` (ubicación + duración)** — `lib/cal.ts`
  - [x] 🟩 Enviar `location` `attendeeDefined` con la dirección de `getBookingLocationMeta(locationName)`
  - [x] 🟩 Enviar `lengthInMinutes` calculado con `endIso - startIso`; si Cal.com rechaza un campo opcional, reintentar sin él
  - [x] 🟩 Probar el formato contra la API real sin crear eventos: solicitudes a las 3 AM (fuera del horario) y con uids falsos para `reschedule`/`cancel`. Tests unitarios en `lib/cal.test.ts` (5)
  - [ ] 🟥 (Configuración en Cal.com, con aprobación de Dustin) habilitar varias duraciones (60/120/180/240) en los 3 event types

- [x] 🟩 **Step 2: Funciones de Cal.com para mover y cancelar + migración**
  - [x] 🟩 `rescheduleCalBooking(uid, { startIso, endIso })` que devuelve el `uid` nuevo — `lib/cal.ts`
  - [x] 🟩 `cancelCalBooking(uid, reason)` (un 404 cuenta como hecho) — `lib/cal.ts`
  - [x] 🟩 Helper compartido `lib/booking-calendar.ts`: `syncBookingCalendarEvent`, `cancelBookingCalendarEvent` y `alertCalendarFailure`
  - [x] 🟩 `supabase/migrations/032_cal_booking_status_cancelled.sql`: agregar `'cancelled'` al CHECK (sin aplicar todavía)

- [x] 🟩 **Step 3: Alertas inmediatas de fallo** (se activan con el deploy)
  - [x] 🟩 Llamar `notifySupportAlert` (con el mensaje de error de Cal.com) cuando falla el evento de Cal.com en los 3 lugares que lo crean: el webhook de Stripe, `lib/free-booking.ts` y `lib/manual-booking.ts`
  - [x] 🟩 Lo mismo cuando falla el email de confirmación en el flujo manual y en el de gift card (el de Stripe ya avisa). El de gift card ahora también guarda `webhook_sent`
  - [x] 🟩 Revisar en n8n a dónde llega `ops_alert`: **ningún workflow lo maneja**. Producción tiene `N8N_SUPPORT_WEBHOOK_URL` (secreto) pero no coincide con ningún webhook activo, así que las alertas, incluidas las críticas de Stripe que ya existían, probablemente no le llegan a nadie
  - [x] 🟩 Workflow `OPS_ALERT` creado y activo en n8n (`cN40BkmCfWVZNcnH`, webhook `/webhook/ops-alert`): webhook → formato (alerta suelta o resumen diario) → email a `floridamountainbikeguides@gmail.com` y `bizdev4uai@gmail.com` con la credencial SMTP existente. Alerta de prueba enviada: ejecución 117369 exitosa, SMTP aceptó los 2 destinatarios
  - [x] 🟩 Nueva variable `N8N_OPS_ALERT_WEBHOOK_URL` en Vercel (Production + Preview), que `notifySupportAlert` usa primero. `N8N_SUPPORT_WEBHOOK_URL` no se tocó: es un secreto oculto y sobrescribirlo habría perdido su valor

- [x] 🟩 **Step 4: Reintentar calendario**
  - [x] 🟩 Endpoint `POST /api/admin/retry-cal` (solo reservas `confirmed` sin evento): crea o mueve el evento y actualiza `cal_booking_uid` y `cal_booking_status`
  - [x] 🟩 Botón "Retry calendar" junto al badge "No Cal event" en `AdminClient.tsx` (escritorio y móvil) y en la tarjeta de Manual Booking

- [x] 🟩 **Step 5: Apartar fecha con pago pendiente (servidor)**
  - [x] 🟩 `CreateSchema`: separar `total_cents` (acordado) de `amount_collected_cents` (puede ser 0) y agregar `send_confirmation` (por defecto `true`)
  - [x] 🟩 Insertar la reserva con `remaining_balance_amount` = total − cobrado y `remaining_balance_status` en `pending` o `paid`; `remaining_balance_due_at` queda en null
  - [x] 🟩 Un solo helper de email (`sendManualBookingEmail`) para crear y reenviar, con el saldo real; no se manda email si `send_confirmation` es `false`
  - [x] 🟩 Acción `record_payment`: suma a lo cobrado (protegido contra doble envío), recalcula el saldo, guarda en Fin Log `booking.payment_recorded_manual` y envía a Senzai `payment.remaining_balance_succeeded`
  - [x] 🟩 "Resend C. Email" del dashboard principal ahora manda el email manual (con link del waiver) cuando la reserva es manual

- [x] 🟩 **Step 6: Editar reserva manual (servidor)**
  - [x] 🟩 Schema zod con los campos editables + `notify_customer`; `PATCH` con unión discriminada `resend | update | record_payment`
  - [x] 🟩 `updateManualBooking()` en `lib/manual-booking.ts`: carga la reserva (solo `manual`, sin borrar ni cancelar), calcula qué cambió y valida el inventario si cambia la fecha
  - [x] 🟩 Actualizar `bookings` (si cambia el total, recalcular el saldo; no puede quedar por debajo de lo cobrado); actualizar `customers` si cambia el contacto (409 si el email ya pertenece a otro cliente)
  - [x] 🟩 Si cambia fecha, hora o duración (o la reserva no tiene evento): mover o crear el evento de Cal.com; si falla, `cal_booking_status = failed` + alerta
  - [x] 🟩 Riders nuevos sin waiver firmado → `waiver_accepted = false` (badge "Waiver needs update")
  - [x] 🟩 Senzai `booking.updated` con los campos cambiados (anterior/nuevo) y el admin que editó
  - [x] 🟩 Si `notify_customer`, reenviar la confirmación actualizada

- [x] 🟩 **Step 7: UI de Manual Booking** — `ManualBookingClient.tsx`
  - [x] 🟩 Formulario de creación: "Tour total" y "Collected now" + casilla "Email the confirmation now"; avisos de saldo pendiente y de total $0
  - [x] 🟩 Columnas de la lista compartidas en `MANUAL_BOOKING_LIST_COLUMNS` (página + API)
  - [x] 🟩 Tarjeta: "cobrado de total", otros riders, badges "Payment pending", "No Cal event", "Email not sent" y "Waiver needs update"
  - [x] 🟩 Panel "Edit" dentro de la tarjeta, con resultado claro (calendario actualizado o no, waiver reabierto, email enviado)
  - [x] 🟩 Panel "Record payment" (monto por defecto = saldo) y botón "Retry calendar"
  - [x] 🟩 "Send email" cuando el email no se envió al crear la reserva

- [x] 🟩 **Step 8: Liberar el calendario al cancelar o borrar**
  - [x] 🟩 `update-booking`: al pasar a `cancelled` o `refunded`, cancelar el evento de Cal.com y guardar `cal_booking_status = cancelled`
  - [x] 🟩 `delete-booking`: lo mismo, después de archivar o de borrar del todo con éxito

- [x] 🟩 **Step 9: Revisión diaria para Dustin**
  - [x] 🟩 `/api/cron/booking-health` (protegido con `CRON_SECRET`): todas las reservas `confirmed` futuras sin borrar
  - [x] 🟩 Señalar: calendario no creado y email no enviado (cualquier fecha, porque el riesgo de doble reserva no depende de la fecha), waiver sin firmar a menos de 48 horas y pago manual pendiente en los próximos 7 días
  - [x] 🟩 Un solo resumen por `notifySupportAlert` (severity `warning`); si no hay nada, no envía nada
  - [x] 🟩 En `vercel.json` a las 12:00 UTC (8 AM en Florida con horario de verano, 7 AM en invierno)
  - [x] 🟩 Probado en local contra la base real con n8n desactivado: marca la reserva de Laura como "No calendar event"

- [ ] 🟨 **Step 10: Verificación**
  - [x] 🟩 `tsc` y `build` sin errores; `eslint` sin errores nuevos (los de `AdminClient.tsx` ya existían); `vitest` 11/11
  - [ ] 🟥 En el preview de Vercel, con una reserva manual de prueba:
    - [ ] 🟥 Crearla con $0 cobrado y sin email; confirmar que sale "Payment pending" y que el evento de 2 h está en Cal.com
    - [ ] 🟥 Record payment: revisar Fin Log y Senzai
    - [ ] 🟥 Edit de fecha, total y riders con el waiver ya firmado: revisar Cal.com y que aparezca "Waiver needs update"
    - [ ] 🟥 Forzar un fallo de Cal.com: confirmar que llega la alerta y probar "Retry calendar"
    - [ ] 🟥 Correr el cron de revisión a mano
    - [ ] 🟥 Cancelarla (el evento se libera) y borrarla

- [ ] 🟥 **Step 11: Deploy + arreglar la reserva de Laura** (con aprobación antes de producción)
  - [ ] 🟥 Correr la migración 032 en Supabase; merge a `master` y deploy
  - [ ] 🟥 "Retry calendar" en la reserva `117c6832…`: comprobar el evento del 24 oct de 9:00 a 11:00 y que 9:00 y 10:00 ya no aparezcan disponibles
  - [ ] 🟥 Con los datos de Dustin: Edit (total acordado y nombres de los riders, antes de que Laura firme) → Record payment (monto y método) → reenviar el email con los datos correctos

- [ ] 🟥 **Step 12: Guía paso a paso para Dustin**
  - [ ] 🟥 Instrucciones cortas en inglés:
    - Apartar una fecha sin cobrar todavía
    - Registrar un pago
    - Editar una reserva
    - Qué hacer con los badges "No Cal event", "Payment pending" y "Waiver needs update"
    - Regla: los cambios se hacen en el admin, no directamente en Cal.com

## Fase 2 — después de esta entrega (no cuenta en el progreso)

- [ ] 🟥 **Multi-bookings solo para los tours de Sanford** (pedido nuevo, para cuando termine esto)
- [ ] 🟥 **Inventario de bicis por rider:** hoy el trigger (`check_inventory_before_booking`) y `countReservedOnDate` cuentan 1 bici por reserva aunque vengan varios riders. La reserva de Laura (3 riders, standard) ocupa 1 de 10 bicis. Hay que contar riders con bici y agregar bici por rider en el formulario manual. Toca el trigger de la base de datos: probarlo aparte.
- [ ] 🟥 **Reprogramar reservas online:** Edit solo de fecha y hora para reservas pagadas por Stripe. También hay que mover `remaining_balance_due_at`, porque si no, el cron cobra el saldo en la fecha vieja. Los cambios de precio se siguen haciendo en Stripe.
- [ ] 🟥 **Sincronizar cambios hechos en Cal.com:** webhook de Cal.com (`BOOKING_RESCHEDULED` / `BOOKING_CANCELLED`) que actualice la reserva si Dustin la mueve o la cancela desde la app de Cal.com.
