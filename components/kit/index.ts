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
