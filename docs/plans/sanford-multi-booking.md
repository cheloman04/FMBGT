# Plan: multi-bookings para los tours de Sanford

**Overall Progress:** `92%` (falta la prueba de punta a punta en el preview de Vercel)

## TLDR

Varios grupos (clientes distintos) pueden reservar **la misma hora** de un tour de Sanford, mientras queden bicis. MTB y Blue Springs siguen igual: un grupo por día.

De paso se arregla un problema que entró hoy a producción: al activar las duraciones múltiples en Cal.com, un tour de 2 h a las 10:00 (o de 3 h a las 9:00) no cabe en el horario de Cal.com (8–11), y el evento del guía no se crea.

## Diagnóstico (2026-10-11, solo lectura)

- Los 3 event types tienen `bookingLimitsCount: { day: 1 }`. Cuando se alcanza, Cal.com marca **todo el día** como ocupado (`getBusyTimesFromBookingLimits`). Pasa igual con seats.
- Sanford (`DTS Tours`, schedule 1467241) abre **mar–vie, 8/9/10 AM**; Blue Springs lun–vie; MTB todos los días. Por eso el sábado 24 no salía en Sanford ni en Blue Springs.
- La API de slots con `duration=120` ya no ofrece las 10:00, y con `duration=180` solo ofrece las 8:00. La web pide slots de 60 min, así que sigue mostrando las 10:00.
- Inventario: 10 bicis (2 eléctricas), compartidas entre todos los tours del día. El trigger y `countReservedOnDate` cuentan **1 bici por reserva**, no por rider.
- Respaldo de la config de Cal.com: `event-type-{5398819,5145953,5398892}.json` + `schedules.json`, guardados en el scratchpad de la sesión. No se cambió nada en Cal.com.

## Critical Decisions

- **Enfoque B: un evento de Cal.com por grupo** (elegido por el usuario, en vez de seats). La config de Cal.com de Dustin no se toca:
  - El primer grupo reserva como hoy. El límite de 1/día de Cal.com cierra el resto del día.
  - La web vuelve a ofrecer la hora de un tour de Sanford **confirmado y con evento en Cal.com**, mientras queden bicis.
  - Los grupos que se suman crean **su propio evento** a la misma hora, con `allowConflicts` + `skipBookingLimits`. Estas opciones requieren `cal-api-version: 2026-02-25` y que la key sea la del dueño del event type.
  - Cancelar, reprogramar y "Retry calendar" siguen siendo por reserva, con el `uid` de cada una. No hay `seatUid`.
- **Solo se suma a tours confirmados con evento creado.** Una reserva `pending` (checkout sin pagar) no abre la hora para otros, porque todavía no bloqueó nada en Cal.com y se podría pisar otro tour.
- **Inventario por rider** (afecta a todos los tours, porque la flota es compartida). Cada rider con bici `standard`/`electric` ocupa una. Si un rider adicional no tiene `bike_rental` (reservas manuales), hereda la del rider principal. Se cambia en `lib/inventory.ts` y en el trigger (migración 033).
- **El calendario de la web oculta los días sin bicis** para el grupo (la cantidad de bicis se elige antes que la fecha). Se mantiene el tope por reserva (4 estándar + 2 eléctricas).
- **Arreglo de las 10:00:** si Cal.com rechaza la duración real (400/409), se reintenta sin `lengthInMinutes` y el evento queda con la duración por defecto (1 h), como antes de hoy. Es mejor un evento corto que ninguno.

## Tasks

- [x] 🟩 **Step 1: Inventario por rider**
  - [x] 🟩 `bookingBikeCounts()` / `lacksBikes()` en `lib/bike-counts.ts` (puro, también lo usa el calendario)
  - [x] 🟩 `lib/inventory.ts`: cuenta por rider, `excludeBookingId` y `getFleetUsage()` por rango de fechas
  - [x] 🟩 `supabase/migrations/033_inventory_per_rider.sql`: `booking_bike_counts()` + trigger por rider (sin aplicar)
- [x] 🟩 **Step 2: Cal.com** — `lib/cal.ts`
  - [x] 🟩 `allowsSharedTours()` (solo Sanford)
  - [x] 🟩 `joinSharedTour` en `createCalBooking` y `rescheduleCalBooking`: `allowConflicts` + `skipBookingLimits` con `cal-api-version: 2026-02-25`
  - [x] 🟩 Si Cal.com responde 400/409 con `lengthInMinutes`, se reintenta sin ese campo (arreglo de las 10:00)
- [x] 🟩 **Step 3: Detectar el tour compartido** — `lib/shared-tours.ts` (`sharedTourExists`, `getSharedTourSlots`), conectado en el webhook de Stripe, `lib/free-booking.ts` y `syncBookingCalendarEvent` (manual, Retry calendar, Edit)
- [x] 🟩 **Step 4: Disponibilidad** — `/api/availability` agrega las horas de tours de Sanford ya confirmados (con 20 h de aviso, como Cal.com) y quita las fechas sin bicis; `StepDateTime` envía `bikes` / `electricBikes`
- [x] 🟩 **Step 5: Edición manual** — valida el inventario por rider al cambiar la fecha o sumar riders, sin contarse a sí misma
- [ ] 🟨 **Step 6: Verificación**
  - [x] 🟩 `tsc`, `eslint` (archivos tocados) y `next build` sin errores; `vitest` 25/25 (12 tests nuevos)
  - [x] 🟩 Prueba real en Cal.com (aprobada), Sanford 16–17 dic 2026, attendee `bizdev4uai+fmbgt-test@gmail.com`:
    - Grupo 1 normal a las 9:00 → 201; después Cal.com cerró el día (0 slots)
    - Grupo 2 a la misma hora con `allowConflicts` + `skipBookingLimits` (versión 2026-02-25) → 201, 2 eventos a las 9:00
    - 10:00 de 2 h → **409 "not available"** (el bug de producción es real); el reintento sin `lengthInMinutes` → 201, evento de 60 min
    - Cancelar solo el grupo 2 dejó al grupo 1 `accepted`. Se cancelaron los 3 y los slots del 16 y 17 volvieron a abrirse
  - [x] 🟩 Migración 033 aplicada en Supabase (SQL editor). Verificado: el trigger `enforce_inventory_on_booking` está activo y usa `booking_bike_counts`; la reserva de Laura cuenta 3 bicis (antes 1); ninguna fecha futura supera la flota
  - [ ] 🟥 PR + preview de Vercel: reserva de Sanford con 2 grupos de punta a punta
