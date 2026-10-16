# Plan: los correos al cliente, por Kigaru (fase 6) — y el corte de n8n

**Overall Progress:** `60%`. El código está listo detrás de un interruptor por tipo (todo sigue por n8n mientras `KIGARU_EMAIL_TYPES` esté vacío). Faltan los pasos del dueño y el corte, tipo a tipo.

## TLDR

Los 8 correos que FMBGT manda a sus clientes salen hoy de n8n por SMTP (Gmail). Pasan al **hub de Kigaru** (carril 5, `senzai-skills/contract/CONTRACT.md` §5): la app compone cada correo con sus plantillas (`lib/email/templates/`), lo guarda en su outbox (`email_outbox`, migración 035) y se lo entrega al hub con `POST /api/channels/email`. El hub lo manda desde la cuenta de Resend de Kigaru con el dominio de FMBGT, sigue la entrega y aplica las bajas. El dueño lo ve en **/admin/emails**.

Cada tipo cambia el día que toca, con `KIGARU_EMAIL_TYPES`, y **su workflow de n8n se apaga ese mismo día**.

## Los 8 correos

| Tipo (`email_type`) | Categoría | Correos | Lo dispara | Workflow de n8n que reemplaza | Clave de idempotencia |
| --- | --- | --- | --- | --- | --- |
| `booking_confirmed` | transactional | Confirmación (checkout, gratis, manual) y «reserva actualizada» | Webhook de Stripe, `create-checkout` (gratis), reserva manual, edición, reenvío | «Booking Confirmation Email» (`V3xvcaghauXufOix`, activo) | `booking_confirmed:<booking>`; un reenvío o una edición, `booking_confirmed:<booking>:<uuid>` |
| `remaining_balance_paid` | transactional | Saldo cobrado | `payment_intent.succeeded` (saldo) | «Remaining balance Confirmation Email» (`TMj9Yvfr26u2gYuC`, **apagado desde el 23-abr**) | `remaining_balance_paid:<PaymentIntent>` |
| `remaining_balance_failed` | transactional | Saldo no cobrado | `payment_intent.payment_failed` (saldo) | Ninguno de verdad: iba al de la confirmación sin el email del cliente | `remaining_balance_failed:<PaymentIntent>` |
| `lead_follow_up` | marketing | 3 seguimientos (1 h, 1 día, 1 semana; Paved y MTB) | «Start follow-up» en /admin/leads | «LEAD - Follow-Up Processor (Cron)» (`IrG7sJyrfSj8y7e2`, activo) | `lead_follow_up:<id del paso>` |
| `review_request` | marketing | 3 solicitudes de reseña (mismo día, 1 día, 1 semana; Paved y MTB) | La reserva pasa a `completed` | «COMPLETED_SERVICES_Review_Flow» (`9jxUFqNkjbBA1YZm`, activo) | `review_request:<id del paso>` |

🪤 **Los dos correos del saldo nunca llegaron a los clientes por n8n.** Al encenderlos, son correos NUEVOS para el cliente: su texto es nuevo y lo revisa el dueño antes.

## Cómo funciona

- **Transaccionales:** cada sitio que antes llamaba a n8n construye el MISMO payload de siempre y llama a `lib/email/send.ts`. Si el tipo está en `KIGARU_EMAIL_TYPES`, se renderiza y se encola. Si no, va a n8n exactamente igual que antes.
- **Secuencias:** el tick `/api/cron/emails` sustituye a los dos crons de n8n (`lib/email/sequences.ts`): paso vencido → ¿sigue siendo elegible? (las mismas funciones que n8n consultaba por HTTP) → plantilla → outbox → paso marcado. Un paso con más de 48 h de retraso se salta como `overdue`, para no mandar un «1 hora» días después.
- **Outbox (`lib/email/outbox.ts`):**
  - Reintenta SOLO 429, 5xx y errores de red (incluido `503 paused`), con backoff de 1 min a 2 h y unas 12 h en total, siempre con la misma clave. Después se rinde y avisa por `ops_alert`.
  - Un 422 es final: una baja (`suppressed`) se queda en silencio, y cualquier otro rechazo avisa. Un 409 es un fallo de la app y avisa.
  - 🪤 Fuera de producción (previews, `next dev`), que comparten esta base, solo salen direcciones `*@resend.dev`. Las demás quedan `skipped`.
- **Marketing:** el pie lleva la dirección postal y el enlace de baja `{{unsubscribe_url}}`, en el HTML y en el texto. El hub lo cambia por la baja de un clic y añade `List-Unsubscribe`. Una persona dada de baja deja de recibir marketing, pero sigue recibiendo los correos de su reserva.
- **El reloj:** en el plan Hobby, Vercel solo corre crons una vez al día, así que `vercel.json` lleva `/api/cron/emails` a diario como red de seguridad. El reloj de verdad es un schedule cada 5 min, igual que hoy el drenado de analytics: un workflow de n8n con UN nodo HTTP y ningún correo.

## Diferencias buscadas con las plantillas de n8n

- **Un solo destinatario** (contrato §5.1): se acaban las copias a `bizdev4uai@gmail.com` y a `floridamountainbikeguides@gmail.com`. Para ver lo que salió está /admin/emails.
- Sin nombre, el asunto y el titular no empiezan por coma. El «1 day MTB» usaba el nombre COMPLETO.
- «Deposito Paid» pasa a «Deposit paid».
- La nota «el saldo se cobrará a la tarjeta» solo sale si hay saldo y cobro programado; n8n la ponía también en reservas gratis y en efectivo.
- Reserva manual con saldo en efectivo: «Balance due … payable on the day of your ride».

## Antes del primer corte (una vez, en este orden)

- [ ] 1. **Merge** (el orden está en el PR): primero senzai-skills#30 (el kit 0.13.0). Después, re-sync del kit desde `main` en esta rama, y este PR.
- [ ] 2. **Migración 035** en el Supabase de FMBGT, ANTES de desplegar el código que la usa.
- [ ] 3. En Kigaru (operador, con OK del dueño):
  - [ ] a. Resend en plan **Pro** antes de que FMBGT envíe (Free = 100/día, compartidos).
  - [ ] b. Ajustes de correo de FMBGT en su ficha: `active`, remitente «Florida Mountain Bike Guides», **Reply-To `floridamountainbikeguides@gmail.com`**, y el dominio compartido (`send.kigaru.app`) permitido hasta verificar el suyo.
  - [ ] c. Dominio `send.floridamountainbikeguides.com` desde la ficha del operador (acción externa) → registros DNS en GoDaddy (DKIM + MX + SPF de `send.`, sin tocar el raíz; DMARC recomendado), que añade el dueño o el cliente → verificar.
  - [ ] d. Conceder **`email:send` + `email:read`** a la conexión `florida_bike_guides`. Con `email:read`, /admin/emails aparece solo en el menú.
- [ ] 4. **El reloj:** schedule «FMBGT — Email tick», cada 5 min: `GET https://www.floridamountainbikeguides.com/api/cron/emails` con `Authorization: Bearer <CRON_SECRET>`. Un nodo HTTP, sin correo. Si FMBGT pasa a Vercel Pro, va a `vercel.json` (`*/5 * * * *`) y el schedule se borra.
- [ ] 5. **CAN-SPAM:** el dueño confirma la dirección postal del pie (`lib/email/layout.ts`, `BRAND.postalAddress`; hoy es la de n8n, 229 Magnolia Ave, Sanford, que es el punto de encuentro de Bicikleta), antes de pasar los dos tipos de marketing.
- [ ] 6. El dueño revisa el texto de `remaining_balance_paid` y `remaining_balance_failed` (`lib/email/templates/remaining-balance.ts`).
- [ ] 7. **Humo:** desplegado con `KIGARU_EMAIL_TYPES` vacío, todo sigue igual (n8n). En un preview con `KIGARU_EMAIL_TYPES=*`, una reserva manual a `delivered@resend.dev` sale por Kigaru y aparece en /admin/emails.

## El corte, tipo a tipo

Cada día: cambiar `KIGARU_EMAIL_TYPES` en Vercel (Production), **redeploy**, comprobar y apagar su workflow. El orden importa:

| Día | Tipo | Orden | Comprobar |
| --- | --- | --- | --- |
| A | `booking_confirmed` | 1) añadirlo y redeploy · 2) **después** apagar «Booking Confirmation Email». Lo dispara la app, así que no hay doble envío; al revés, una reserva en el hueco daría `webhook_sent=false` | Una reserva (o una manual a `*@resend.dev`) sale `delivered` en /admin/emails; el workflow deja de tener ejecuciones |
| B | `remaining_balance_paid`, `remaining_balance_failed` | Añadirlos y redeploy. «Remaining balance Confirmation Email» ya estaba apagado: archivarlo | El próximo cobro del cron de las 15:00 UTC sale en /admin/emails |
| C | `review_request` | 1) **antes** apagar «COMPLETED_SERVICES_Review_Flow» · 2) añadirlo y redeploy. Lee la base cada 5 min, así que con los dos encendidos se mandaría dos veces. Lo que venza en el hueco sale en el tick siguiente | La primera reseña del mismo día sale con el enlace a /review |
| D | `lead_follow_up` | 1) **antes** apagar «LEAD - Follow-Up Processor (Cron)» · 2) añadirlo y redeploy | Un «Start follow-up» de prueba (a un lead con email `*@resend.dev`) manda el «1 hour» a la hora |

**Volver atrás un tipo:** quitarlo de `KIGARU_EMAIL_TYPES`, redeploy y reencender su workflow. Lo que ya estaba en el outbox de ese tipo sigue saliendo (ya es del hub).

**Al terminar:** `KIGARU_EMAIL_TYPES=*`. Hecho = ningún correo a clientes sale de n8n.

## Lo que queda en n8n (no son correos a clientes)

- Los relojes: el drenado de analytics y el email tick (un nodo HTTP cada uno).
- Correos internos al dueño: «OPS_ALERT», «NOTIFY_DUSTIN_LEAD_ALERT» y «Get in touch». No entran en los 8 de esta fase: si la fase pide «nada de correo en n8n», son la siguiente entrega.
- 🪤 El secreto `x-followup-secret` va en claro dentro de los dos workflows de las secuencias. Cuando estén apagados, rotar `N8N_FOLLOWUP_SECRET`. Las rutas `/api/lead-follow-up/*` y `/api/review-requests/*` siguen vivas para poder volver atrás.
