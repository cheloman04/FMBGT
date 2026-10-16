// Kit de dashboards de Kigaru — el barrel. Se importa siempre de aquí:
//   import { PageShell, PageHeader, MetricStrip } from "@/components/kit";
//
// 🪤 Esta carpeta es una COPIA sincronizada desde `senzai-skills/kit/dashboard`
// y no se edita a mano: el test de deriva lo detecta. Un cambio va por PR allí y
// se trae con `npm run kit:sync` (KIGARU_DASHBOARD_STANDARD_V1.md §11).

export { KitRoot } from "./KitRoot";
export { PageShell, PageHeader, GroupHeader } from "./PageFrame";
export { Section, Panel, SectionHeader } from "./Section";
export { MetricStrip, type Metric } from "./MetricStrip";
export { StatusBadge } from "./StatusBadge";
export {
  resolveStatus,
  TONE_CLASSES,
  TONE_CSS,
  type StatusMeta,
  type StatusTone,
  type ToneClasses,
} from "./status";
export { EmptyState } from "./EmptyState";
export { Button, buttonClasses, type ButtonSize, type ButtonVariant } from "./Button";
export { cx } from "./cx";

// 1b · diálogos y formularios
export { Modal } from "./Modal";
export { ConfirmDialog } from "./ConfirmDialog";
export { useConfirm, type ConfirmRequest } from "./useConfirm";
export { useDialogBehavior } from "./useDialogBehavior";
export {
  Input,
  Textarea,
  Select,
  FieldShell,
  FIELD_CLASSES,
  FIELD_LABEL_CLASSES,
  SELECT_OPTION_CLASSES,
  type FieldChrome,
} from "./Field";
export { PasswordInput } from "./PasswordInput";
export { Switch } from "./Switch";
export { SelectMenu, type SelectMenuOption } from "./SelectMenu";
export { DatePicker, type DatePickerLabels } from "./DatePicker";
export {
  parseDate,
  toISODate,
  sameDay,
  displayDate,
  displayDateTime,
  splitDateTime,
  joinDateTime,
  buildMonthGrid,
  WEEKDAYS_EN,
} from "./calendar";
export { Tabs, TabPanel, type TabItem } from "./Tabs";
export { FilterSheet, type FilterSheetLabels, type FilterSheetOption } from "./FilterSheet";
export { LoadMore, type LoadMoreLabels } from "./LoadMore";
export { RelativeTime } from "./RelativeTime";
export { formatDateTime, formatRelative } from "./time";
export { ProgressBar } from "./ProgressBar";

// 1c · shell, menú y mutaciones
export { AppShell, ShellFooterAction, type AppShellLabels } from "./AppShell";
export {
  defineNav,
  isNavActive,
  visibleNav,
  badgeText,
  notifyBadgesChanged,
  BADGES_CHANGED_EVENT,
  type NavItem,
  type NavHref,
  type NavBadgeValue,
  type NavBadges,
} from "./nav";
export { createApiClient, loginUrl, errorMessage, type ApiClient, type ApiClientOptions, type ApiResult } from "./api";
export { useAction } from "./useAction";

// 1d · listas, drawer, periodo, carga y gráficos
export { ResponsiveList, type Column, type MobileRole } from "./ResponsiveList";
export { Drawer } from "./Drawer";
export { PeriodFilter, type PeriodOption } from "./PeriodFilter";
export { BackLink } from "./BackLink";
export { Skeleton, SkeletonText, SkeletonMetrics, SkeletonList, PageSkeleton } from "./Skeleton";
export { LineChart, type ChartSeries } from "./LineChart";
export { Sparkline } from "./Sparkline";
export { domainOf, niceDomain, linePath, ticks, yOf, type Domain } from "./chart";
export { withParam, type SearchParamsInput } from "./url";

// 2a · la bandeja de conversaciones (Instagram, Messenger, WhatsApp…)
// 🔒 Su parte de servidor (`conversations/server.ts`: conexión con el hub, rutas
// proxy y cargadores) NO sale por aquí: este barrel lo importan las islas. Se
// importa por su ruta, `@/components/kit/conversations/server`, y solo en servidor.
export { ConversationsInbox } from "./conversations/ConversationsInbox";
export { ConversationThread } from "./conversations/ConversationThread";
export { AttachmentStrip } from "./conversations/AttachmentStrip";
// El canal con su logo (Telegram, WhatsApp, Instagram, Messenger…) y su nombre para el lector.
export { ChannelGlyph } from "./conversations/ChannelGlyph";
export { channelLogo } from "./conversations/channelLogos";
export {
  INBOX_LABELS,
  mergeLabels,
  agentSwitchPlan,
  readPreview,
  readMessage,
  deliveryStatus,
  contactName,
  channelName,
  segmentLabel,
  INBOX_SEGMENTS,
  type InboxLabels,
} from "./conversations/inbox";
// Las llamadas (contrato §2.3): el registro con «Needs a human» y su detalle.
export { CallsLog } from "./conversations/CallsLog";
export { CallDetail } from "./conversations/CallDetail";
export {
  CALLS_LABELS,
  CALL_SEGMENTS,
  CALL_PERIODS,
  CALL_DIRECTIONS,
  CALL_PARAMS,
  mergeCallLabels,
  parseCallView,
  outcomeMeta,
  formatDuration,
  formatPhone,
  callerName,
  type CallsLabels,
  type CallParamNames,
} from "./conversations/calls";
export { usePolling } from "./conversations/usePolling";
export { useMediaQuery } from "./conversations/useMediaQuery";
export type {
  AgentState,
  AttachmentKind,
  CallAttended,
  CallAttendedResult,
  CallCounts,
  CallDetail as CallDetailData,
  CallDirection,
  CallItem,
  CallOutcome,
  CallPeriod,
  CallSegment,
  CallTurn,
  CallView,
  CallsData,
  CallsLoad,
  CallsNav,
  InboxAttachment,
  InboxChannel,
  InboxConversation,
  InboxCounts,
  InboxData,
  InboxHandlerResult,
  InboxLoad,
  InboxMessage,
  InboxPage,
  InboxPreview,
  InboxSegment,
  InboxSendResult,
  InboxTemplate,
  InboxThread,
  SenderType,
} from "./conversations/types";

// 2b · la campanita: los avisos del dueño (el primero, «Your assistant passed a
// conversation to you»). 🔒 Como la bandeja, su parte de servidor
// (`notifications/server.ts`) NO sale por aquí: `@/components/kit/notifications/server`.
export { NotificationsFeed } from "./notifications/NotificationsFeed";
export {
  NOTIFICATIONS_LABELS,
  mergeNotificationLabels,
  internalHref,
  safeHref,
  mergeRefresh,
  appendPage,
  withRead,
  withAllRead,
  openLabel,
  notificationChannel,
  fillNotification,
  type NotificationsLabels,
} from "./notifications/feed";
export type {
  NotificationItem,
  NotificationsData,
  NotificationsLoad,
  NotificationsNav,
  NotificationsReadAllResult,
} from "./notifications/types";

// 2c · los correos del negocio a sus clientes, enviados por Kigaru (carril 5): qué
// salió, qué llegó y qué no. 🔒 Como la bandeja, su parte de servidor
// (`emails/server.ts`) NO sale por aquí: `@/components/kit/emails/server`.
export { EmailsLog } from "./emails/EmailsLog";
export {
  EMAILS_LABELS,
  EMAIL_SEGMENTS,
  EMAIL_PERIODS,
  EMAIL_PARAMS,
  DEFAULT_EMAIL_VIEW,
  mergeEmailLabels,
  parseEmailView,
  emailViewKey,
  emailListUrl,
  emailStatusMeta,
  emailTypeName,
  isEmailAddress,
  type EmailsLabels,
  type EmailParamNames,
} from "./emails/log";
export type {
  EmailCounts,
  EmailDetail,
  EmailEvent,
  EmailItem,
  EmailPeriod,
  EmailSegment,
  EmailStatus,
  EmailView,
  EmailsData,
  EmailsLoad,
} from "./emails/types";
