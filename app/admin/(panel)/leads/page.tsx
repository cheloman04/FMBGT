import Form from 'next/form';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Button,
  Drawer,
  EmptyState,
  FilterSheet,
  Input,
  LoadMore,
  MetricStrip,
  PageHeader,
  PageShell,
  ResponsiveList,
  Section,
  StatusBadge,
  buttonClasses,
  withParam,
  type Column,
} from '@/components/kit';
import { requireOperator } from '@/lib/admin/auth';
import {
  LEAD_VIEW_TITLE,
  leadViewMetrics,
  leadViewOptions,
  leadsEmpty,
  parseLeadView,
  toLeadDetail,
  toLeadRow,
  type LeadRow,
} from '@/lib/admin/leads';
import { loadLeadDetail, loadLeadList } from '@/lib/admin/loaders';
import { PAGE_SIZE, parsePage, parseSearch, parseUuid } from '@/lib/admin/params';
import { LeadQuickView } from './_components/LeadQuickView';

export const metadata = { title: 'Leads | Admin' };
export const dynamic = 'force-dynamic';

const PATH = '/admin/leads';

type Params = Record<string, string | string[] | undefined>;

// The list turns into a table from 672px of its own width (`tableFrom="md"`, a
// container query: the side menu, open or folded, decides as much as the
// screen). Below, rows. The cells' `@2xl:` / `@max-2xl:` are that same line, so
// the two must move together.
const COLUMNS: Column<LeadRow>[] = [
  {
    key: 'lead',
    header: 'Lead',
    cell: (r) => (
      <>
        <span className="block">{r.name}</span>
        {/* Only on a wide table: a narrow one needs the room, and the drawer has the email. */}
        <span className="block text-xs font-normal text-fg-muted @max-3xl:hidden">{r.email}</span>
      </>
    ),
  },
  {
    key: 'interest',
    header: 'Interest',
    // Two lines in the table (what, then how far they got), one in the rows.
    cell: (r) =>
      r.interest || r.stage ? (
        <>
          <span className="@2xl:block">{r.interest ?? '—'}</span>
          {r.stage ? (
            <>
              <span aria-hidden="true" className="@2xl:hidden">
                {' · '}
              </span>
              <span className="text-xs text-fg-muted @2xl:block">
                {r.stage} · {r.progress}%
              </span>
            </>
          ) : null}
        </>
      ) : null,
    mobile: 'secondary',
  },
  { key: 'source', header: 'Source', cell: (r) => r.source },
  {
    key: 'followUp',
    header: 'Follow-up',
    cell: (r) => (
      <span className="inline-flex flex-col items-end gap-1 @2xl:items-start">
        <StatusBadge meta={r.followUp} size="sm" />
        <span className="text-xs text-fg-muted @max-4xl:hidden">{r.followUpDetail}</span>
      </span>
    ),
    mobile: 'status',
  },
  {
    key: 'active',
    header: 'Last active',
    cell: (r) => (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        {r.lastActive}
        {r.freshness ? <StatusBadge meta={r.freshness} size="sm" /> : null}
      </span>
    ),
  },
];

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireOperator();
  const params = await searchParams;
  // The old link of the lead alerts (`?leadId=`) opens the same lead in the drawer.
  const legacyId = parseUuid(params.leadId);
  if (params.leadId) redirect(legacyId ? `${PATH}?lead=${legacyId}` : PATH);

  const view = parseLeadView(params.view);
  const q = parseSearch(params.q);
  const page = parsePage(params.page);
  const drawerOpen = Boolean(params.lead);
  const openId = parseUuid(params.lead);
  // The page's clock, read once on the server: "3h ago" and "hot" both use it.
  const now = new Date();

  const [list, opened] = await Promise.all([
    loadLeadList({ view, q, limit: page * PAGE_SIZE, now }),
    openId ? loadLeadDetail(openId) : Promise.resolve(null),
  ]);
  const rows = list.records.map((lead) => {
    const enrollment = list.enrollments.get(lead.id) ?? null;
    return toLeadRow(lead, enrollment, enrollment ? list.steps.get(enrollment.id) ?? [] : [], now);
  });
  const detail = opened ? toLeadDetail(opened.lead, opened.enrollment, opened.steps, now) : null;
  const closeHref = withParam(PATH, params, 'lead', null, { keepPage: true });

  return (
    <PageShell>
      <PageHeader
        eyebrow="Sales"
        title="Leads"
        subtitle="People who started a booking and haven't paid. Most recently active first. Times in Eastern."
      />
      {/* On a wide screen the strip is the view filter; on the phone, the FilterSheet below. */}
      <div className="max-md:hidden">
        <MetricStrip metrics={leadViewMetrics(list.counts, view, PATH, params)} />
      </div>

      <div className="mt-8">
        <Section
          title={LEAD_VIEW_TITLE[view]}
          subtitle={q ? `${list.total === 1 ? '1 lead matches' : `${list.total} leads match`} “${q}”.` : undefined}
        >
          {/* A GET form: `next/form` turns it into a client navigation to ?q=, keeping the view. */}
          <Form action={PATH} role="search" className="mb-4 flex flex-wrap items-end gap-2">
            {view !== 'open' ? <input type="hidden" name="view" value={view} /> : null}
            <Input
              key={q}
              type="search"
              name="q"
              defaultValue={q}
              label="Search leads"
              labelHidden
              placeholder="Name, email, phone, ZIP, source or location"
              layout="min-w-0 flex-1 basis-56"
            />
            <Button type="submit" variant="secondary">
              Search
            </Button>
            {q ? (
              <Link href={withParam(PATH, params, 'q', null)} className={buttonClasses('ghost', 'md')}>
                Clear
              </Link>
            ) : null}
          </Form>

          <FilterSheet
            dimension="View"
            options={leadViewOptions(list.counts, view, PATH, params)}
            active={view === 'open' ? undefined : view}
            shown={list.total}
            total={list.counts.open + list.counts.lost}
            dialogLabel="Filter leads"
          />

          <ResponsiveList
            rows={rows}
            columns={COLUMNS}
            rowKey={(r) => r.id}
            rowHref={(r) => withParam(PATH, params, 'lead', r.id, { keepPage: true })}
            caption={LEAD_VIEW_TITLE[view]}
            tableFrom="md"
            empty={<EmptyState title={leadsEmpty(view, q)} />}
          />
          {rows.length ? (
            <LoadMore showing={rows.length} total={list.total} noun="leads" moreHref={withParam(PATH, params, 'page', String(page + 1))} />
          ) : null}
        </Section>
      </div>

      {/* The quick view lives in the URL (?lead=<id>): it can be shared, and Back or Escape close it. */}
      <Drawer open={drawerOpen} title={detail?.name ?? 'Lead not found'} closeHref={closeHref} size="lg">
        {detail ? (
          <LeadQuickView lead={detail} closeHref={closeHref} />
        ) : (
          <EmptyState title="This lead doesn't exist or was archived. Archived leads are in the Trash." />
        )}
      </Drawer>
    </PageShell>
  );
}
