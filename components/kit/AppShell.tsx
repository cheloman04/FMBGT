"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { cx } from "./cx";
import { BADGES_CHANGED_EVENT, badgeText, isNavActive, type NavBadges, type NavBadgeValue, type NavItem } from "./nav";
import { useDialogBehavior } from "./useDialogBehavior";

export type AppShellLabels = {
  /** `aria-label` del `<nav>`. */
  navigation: string;
  openNavigation: string;
  closeNavigation: string;
  collapse: string;
  expand: string;
};

const LABELS_EN: AppShellLabels = {
  navigation: "Main",
  openNavigation: "Open navigation",
  closeNavigation: "Close navigation",
  collapse: "Collapse sidebar",
  expand: "Expand sidebar",
};

const BADGE_TONE: Record<NonNullable<NavBadgeValue["tone"]>, { pill: string; dot: string }> = {
  red: { pill: "bg-tone-red/20 text-tone-red", dot: "bg-tone-red" },
  amber: { pill: "bg-tone-amber/20 text-tone-amber", dot: "bg-tone-amber" },
  accent: { pill: "bg-ac-500/20 text-ac-300", dot: "bg-ac-400" },
};

const ShellContext = createContext<{ collapsed: boolean; closeMobile: () => void }>({
  collapsed: false,
  closeMobile: () => {},
});

// ── El plegado del escritorio, en localStorage ──────────────────────────────
// 🪤 Con `useSyncExternalStore` y no leyendo `localStorage` en el estado inicial:
// el servidor no lo tiene, así que leerlo en el primer render da un HTML distinto
// al del servidor (desajuste de hidratación). Así React pinta primero lo del
// servidor (desplegado) y después lo guardado.
const COLLAPSE_EVENT = "kit:sidebar-collapse";

function useCollapsed(storageKey: string): [boolean, (next: boolean) => void] {
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener("storage", notify);
    window.addEventListener(COLLAPSE_EVENT, notify);
    return () => {
      window.removeEventListener("storage", notify);
      window.removeEventListener(COLLAPSE_EVENT, notify);
    };
  }, []);
  const collapsed = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(storageKey) === "collapsed";
      } catch {
        return false;
      }
    },
    () => false,
  );
  const set = useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(storageKey, next ? "collapsed" : "expanded");
      } catch {
        // Sin almacenamiento (ventana privada): el plegado no se recuerda, y ya.
      }
      window.dispatchEvent(new Event(COLLAPSE_EVENT));
    },
    [storageKey],
  );
  return [collapsed, set];
}

// ── Los contadores del menú ─────────────────────────────────────────────────
/**
 * Sembrados en el servidor (sin parpadeo en la primera pintura) y refrescados en
 * el cliente al cambiar de ruta, al volver el foco a la ventana y cuando una isla
 * avisa con `notifyBadgesChanged()` (§5.3).
 */
function useBadges(initial: NavBadges, endpoint: string | undefined, pathname: string): NavBadges {
  const [badges, setBadges] = useState(initial);
  const first = useRef(true);

  useEffect(() => {
    if (!endpoint) return;
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch(endpoint!, { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) return;
        const json = (await res.json()) as { data?: NavBadges } & NavBadges;
        if (!cancelled) setBadges((json.data ?? json) as NavBadges);
      } catch {
        // Un contador viejo es mejor que ninguno: se queda el que había.
      }
    }
    // Al montar, el servidor acaba de sembrarlos: no se piden otra vez.
    if (first.current) first.current = false;
    else void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener(BADGES_CHANGED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
      window.removeEventListener(BADGES_CHANGED_EVENT, refresh);
    };
  }, [endpoint, pathname]);

  return badges;
}

/**
 * El shell de un área de dashboard (§5.1): el menú lateral y el sitio del
 * contenido. Va en el `layout.tsx` del área, dentro de `<KitRoot>`.
 *
 *   <KitRoot>
 *     <AppShell nav={ADMIN_NAV} icons={ADMIN_ICONS} brand={<Wordmark />} area="Admin"
 *               badges={await loadBadges()} badgesEndpoint="/api/admin/badges"
 *               footer={<ShellFooterAction … />}>
 *       {children}
 *     </AppShell>
 *   </KitRoot>
 *
 * · Escritorio: barra lateral fija, plegable entre 220px y 64px (se recuerda).
 * · Teléfono: barra superior de 56px y un cajón de 288px.
 * · El contenido scrollea dentro de `<main>`; el `PageShell` de cada página ya
 *   descuenta la barra superior del teléfono.
 */
export function AppShell<H extends string>({
  nav,
  icons,
  brand,
  mark,
  area,
  badges: initialBadges = {},
  badgesEndpoint,
  footer,
  labels: labelsProp,
  storageKey = "kit-sidebar",
  children,
}: {
  /** El menú del área, ya filtrado por features (`visibleNav`). */
  nav: readonly NavItem<H>[];
  /** Un icono por entrada: `tsc` obliga a que no falte ninguno. */
  icons: Record<H, ReactNode>;
  /** El logotipo con nombre: barra del teléfono, cajón y lateral desplegado. */
  brand: ReactNode;
  /** El símbolo solo, para el lateral plegado. Sin él, el lateral plegado no lleva marca. */
  mark?: ReactNode;
  /** Micro-etiqueta del área bajo la marca: "Admin", "Portal". */
  area?: string;
  /** Contadores sembrados en el servidor, por clave de badge. */
  badges?: NavBadges;
  /** GET que devuelve `{ data: NavBadges }` para refrescarlos. */
  badgesEndpoint?: string;
  /** El pie del menú: `ShellFooterAction` (salir, perfil). */
  footer?: ReactNode;
  labels?: Partial<AppShellLabels>;
  /** Clave de `localStorage` del plegado. Una por área si hay dos áreas. */
  storageKey?: string;
  children: ReactNode;
}) {
  const labels = { ...LABELS_EN, ...labelsProp };
  const pathname = usePathname() ?? "/";
  const [collapsed, setCollapsed] = useCollapsed(storageKey);
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const sideRef = useRef<HTMLElement>(null);
  const badges = useBadges(initialBadges, badgesEndpoint, pathname);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  useDialogBehavior(mobileOpen, closeMobile, drawerRef);

  // 🪤 La transición del ancho se enciende DOS frames después de montar. El
  // servidor pinta el lateral desplegado y el cliente aplica el plegado guardado
  // justo después; con la transición ya encendida, cada recarga plegada se
  // deslizaba de 220px a 64px delante del usuario.
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => sideRef.current?.setAttribute("data-ready", ""));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  const links = (isCollapsed: boolean) => (
    <NavLinks nav={nav} icons={icons} badges={badges} pathname={pathname} collapsed={isCollapsed} label={labels.navigation} />
  );

  return (
    <div className="relative flex h-dvh overflow-hidden bg-canvas">
      {/* ── Teléfono: barra superior ─────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-nav-border bg-nav-bg px-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label={labels.openNavigation}
          aria-expanded={mobileOpen}
          className="-ml-1 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-nav-text transition-colors hover:bg-nav-hover hover:text-nav-hi"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <div className="min-w-0 text-nav-hi">{brand}</div>
      </header>

      {/* ── Teléfono: cajón ─────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        onClick={closeMobile}
        className={cx(
          "fixed inset-0 z-50 bg-canvas/70 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        ref={drawerRef}
        // 🪤 `inert` cerrado: un cajón fuera de pantalla sigue en el DOM, y sin esto
        // el Tabulador recorre sus enlaces invisibles.
        inert={!mobileOpen}
        className={cx(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-nav-bg pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-out motion-reduce:transition-none md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-nav-border px-4">
          <div className="flex min-w-0 items-center gap-2.5 text-nav-hi">
            {mark}
            {brand}
          </div>
          <button
            type="button"
            onClick={closeMobile}
            aria-label={labels.closeNavigation}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-nav-text transition-colors hover:bg-nav-hover hover:text-nav-hi"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <ShellContext.Provider value={{ collapsed: false, closeMobile }}>
          <div className="flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:thin]">{links(false)}</div>
          {footer ? <div className="flex-shrink-0 border-t border-nav-border px-3 py-2">{footer}</div> : null}
        </ShellContext.Provider>
      </aside>

      {/* ── Escritorio: lateral ─────────────────────────────────────────── */}
      <aside
        ref={sideRef}
        className={cx(
          "sticky top-0 hidden h-dvh flex-shrink-0 flex-col overflow-hidden border-r border-nav-border bg-nav-bg data-[ready]:transition-[width] data-[ready]:duration-[240ms] data-[ready]:ease-[cubic-bezier(.4,0,.2,1)] motion-reduce:transition-none md:flex",
          collapsed ? "w-16" : "w-[220px]",
        )}
      >
        <div
          className={cx(
            "flex h-14 flex-shrink-0 items-center border-b border-nav-border",
            collapsed ? "justify-center" : "gap-2.5 px-4",
          )}
        >
          {collapsed ? null : (
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              {mark ? <span className="flex-shrink-0 text-nav-hi">{mark}</span> : null}
              <div className="min-w-0">
                <div className="truncate leading-none text-nav-hi">{brand}</div>
                {area ? <p className="mt-1 text-[9px] uppercase leading-none tracking-[0.24em] text-nav-text">{area}</p> : null}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? labels.expand : labels.collapse}
            title={collapsed ? labels.expand : labels.collapse}
            className="rounded-md p-1.5 text-nav-text transition-colors hover:bg-nav-hover hover:text-nav-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-500/60"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={collapsed ? "M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" : "M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5"}
              />
            </svg>
          </button>
        </div>
        <ShellContext.Provider value={{ collapsed, closeMobile }}>
          <div className={cx("flex-1 overflow-y-auto py-3 [scrollbar-width:thin]", collapsed ? "px-2" : "px-3")}>
            {links(collapsed)}
          </div>
          {footer ? (
            <div className={cx("flex-shrink-0 border-t border-nav-border py-2", collapsed ? "px-2" : "px-3")}>{footer}</div>
          ) : null}
        </ShellContext.Provider>
      </aside>

      <main className="relative min-w-0 flex-1 overflow-y-auto pt-14 md:pt-0">{children}</main>
    </div>
  );
}

function NavLinks<H extends string>({
  nav,
  icons,
  badges,
  pathname,
  collapsed,
  label,
}: {
  nav: readonly NavItem<H>[];
  icons: Record<H, ReactNode>;
  badges: NavBadges;
  pathname: string;
  collapsed: boolean;
  label: string;
}) {
  const { closeMobile } = useContext(ShellContext);
  return (
    <nav aria-label={label} className="flex flex-col gap-0.5">
      {nav.map((item) => {
        const active = isNavActive(pathname, item);
        const value = item.badge ? badges[item.badge] : undefined;
        const text = badgeText(value);
        const tone = BADGE_TONE[value?.tone ?? "red"];
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={closeMobile}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={cx(
              "relative flex items-center rounded-lg py-2.5 transition-colors duration-[120ms] max-md:min-h-11",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-500/60",
              collapsed ? "justify-center px-0" : "gap-3 px-3",
              // El ítem activo es uno de los cuatro sitios del acento (§7.5).
              active ? "bg-ac-500/15 text-ac-300" : "text-nav-text hover:bg-nav-hover hover:text-nav-hi",
            )}
          >
            {active ? (
              <span aria-hidden="true" className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-ac-400" />
            ) : null}
            <span className="relative flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center [&>svg]:h-[18px] [&>svg]:w-[18px]">
              {icons[item.href]}
              {collapsed && text ? (
                <span aria-hidden="true" className={cx("absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full", tone.dot)} />
              ) : null}
            </span>
            {collapsed ? null : <span className="truncate text-[13px] font-medium leading-none tracking-tight">{item.label}</span>}
            {!collapsed && text ? (
              <span
                className={cx(
                  "ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                  tone.pill,
                )}
              >
                {text}
              </span>
            ) : null}
            {collapsed && text ? <span className="sr-only">{`${item.label}: ${text}`}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Una acción del pie del menú (salir, ir al perfil). Sabe si el lateral está
 * plegado (entonces solo el icono, con la etiqueta en el `title`).
 *
 * Tres formas, sin pasar funciones desde el servidor:
 *   · `href`: un enlace (al perfil).
 *   · `endpoint` + `method` + `redirectTo`: llama a la API y navega (salir:
 *     `endpoint="/api/admin/login" method="DELETE" redirectTo="/admin/login"`).
 *   · `onClick`: solo desde un componente cliente.
 */
export function ShellFooterAction({
  icon,
  label,
  href,
  endpoint,
  method = "POST",
  redirectTo,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  href?: string;
  endpoint?: string;
  method?: "POST" | "DELETE";
  redirectTo?: string;
  onClick?: () => void;
}) {
  const { collapsed, closeMobile } = useContext(ShellContext);
  const [busy, setBusy] = useState(false);
  const className = cx(
    "flex w-full items-center rounded-lg text-[13px] text-nav-text transition-colors hover:bg-nav-hover hover:text-nav-hi max-md:min-h-11",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-500/60 disabled:opacity-50",
    collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-2 py-2",
  );
  const body = (
    <>
      <span className="flex h-[17px] w-[17px] flex-shrink-0 items-center justify-center [&>svg]:h-[17px] [&>svg]:w-[17px]">{icon}</span>
      {collapsed ? <span className="sr-only">{label}</span> : label}
    </>
  );

  if (href) {
    return (
      <Link href={href} onClick={closeMobile} title={collapsed ? label : undefined} className={className}>
        {body}
      </Link>
    );
  }

  async function handle() {
    if (onClick) return onClick();
    if (!endpoint) return;
    setBusy(true);
    try {
      await fetch(endpoint, { method, credentials: "same-origin" });
    } finally {
      if (redirectTo) window.location.assign(redirectTo);
      else setBusy(false);
    }
  }

  return (
    <button type="button" onClick={handle} disabled={busy} title={collapsed ? label : undefined} className={className}>
      {body}
    </button>
  );
}
