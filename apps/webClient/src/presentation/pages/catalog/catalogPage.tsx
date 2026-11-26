import {
  CatalogEntry,
  CatalogEntryKind,
  CatalogEntryStatus,
} from "@adapters/http/catalog.repository";
import { useCatalogEntries } from "@adapters/query/catalog";
import { RootState } from "@adapters/store/rootStore";
import Loader from "@presentation/components/loader";
import {
  ArrowLeft,
  ArrowUpRight,
  Building,
  FileText,
  Link as LinkIcon,
  ListChecks,
  Sparkles,
  Wrench,
} from "@presentation/components/ui/animated-icons";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@presentation/components/ui/tabs";
import { catalogHref } from "@presentation/utils/catalog";
import { APP_PATHS, RoutePaths } from "@presentation/utils/routes";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link, useParams } from "react-router";
import { PageBlocks } from "./page-blocks";

const panel = "glass-panel rounded-xl p-5 shadow-sm transition-colors";

const STATUS_TONE: Record<CatalogEntryStatus, string> = {
  active:
    "border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  beta: "border-amber-400/40 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  disabled:
    "border-rose-400/40 bg-rose-500/10 text-rose-600 dark:text-rose-300",
};

function EntryIcon({
  kind,
  className,
}: {
  kind: CatalogEntryKind;
  className?: string;
}) {
  if (kind === "module") return <Sparkles className={className} />;
  if (kind === "page") return <FileText className={className} />;
  if (kind === "tab") return <ListChecks className={className} />;
  if (kind === "integration") return <LinkIcon className={className} />;
  return <Wrench className={className} />;
}

function StatusPill({ status }: { status: CatalogEntryStatus }) {
  const { t } = useTranslation();
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_TONE[status]}`}
    >
      {t(`superadmin.modules.status.${status}`)}
    </span>
  );
}

export function EntryChip({ entry }: { entry: CatalogEntry }) {
  const { t } = useTranslation();
  return (
    <Link
      to={catalogHref(entry.key)}
      className="group flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white/60 px-3 py-2 text-xs transition-colors hover:border-teal-400/40 hover:bg-teal-500/5 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-teal-400/30"
    >
      <EntryIcon
        kind={entry.kind}
        className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500"
      />
      <span className="min-w-0 flex-1 truncate font-medium text-slate-700 dark:text-slate-200">
        {entry.name}
      </span>
      {entry.status !== "active" && (
        <span
          className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
            STATUS_TONE[entry.status]
          }`}
        >
          {t(`superadmin.modules.status.${entry.status}`)}
        </span>
      )}
    </Link>
  );
}

function EmptyCard({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof FileText;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300/70 px-5 py-10 text-center dark:border-white/10">
      <Icon className="h-6 w-6 text-slate-400 dark:text-slate-500" />
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {title}
      </p>
      {hint && (
        <p className="max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
    </div>
  );
}

function ChildList({
  title,
  entries,
}: {
  title: string;
  entries: CatalogEntry[];
}) {
  if (!entries.length) return null;
  return (
    <section className={panel}>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
        {title}
      </h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {entries.map((entry) => (
          <li key={entry.id}>
            <EntryChip entry={entry} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A reusable component placed on a page renders its own authored content in
 * place, without chrome: the page reads as one screen and the same component
 * can be dropped on several pages. Components without content fall back to a
 * link so the operator can still see what is attached.
 */
function ComponentContent({ component }: { component: CatalogEntry }) {
  const sections = component.content?.sections ?? [];
  if (!sections.length) return <EntryChip entry={component} />;
  return (
    <div className="space-y-3">
      {sections.map((section) => (
        <div key={section.id} className="min-w-0">
          {section.title && (
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {section.title}
            </h3>
          )}
          {section.body && (
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {section.body}
            </p>
          )}
          <PageBlocks blocks={section.blocks ?? []} />
        </div>
      ))}
    </div>
  );
}

/**
 * Authored body of a page: the sections written in the backoffice, in the
 * saved order, each with its blocks and the reusable components attached to
 * it. This is what turns a registered page into a real screen instead of a
 * listing of metadata, and it is the same render for the preview.
 */
function PageSections({
  entry,
  entries,
}: {
  entry: CatalogEntry;
  entries: CatalogEntry[];
}) {
  const { t } = useTranslation();
  const sections = entry.content?.sections ?? [];
  if (!sections.length) return null;

  return (
    <section className="space-y-3">
      {sections.map((section) => {
        const components = section.componentKeys
          .map((key) => entries.find((candidate) => candidate.key === key))
          .filter((candidate): candidate is CatalogEntry => Boolean(candidate));
        const blocks = section.blocks ?? [];
        const empty =
          !section.title &&
          !section.body &&
          !blocks.length &&
          !components.length;
        return (
          <article key={section.id} className={panel}>
            {section.title && (
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {section.title}
              </h2>
            )}
            {section.body && (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {section.body}
              </p>
            )}
            <PageBlocks blocks={blocks} />
            {components.length > 0 && (
              <div className="mt-4 space-y-3 border-t border-slate-200/70 pt-4 dark:border-white/[0.08]">
                {components.map((component) => (
                  <ComponentContent key={component.id} component={component} />
                ))}
              </div>
            )}
            {empty && (
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                {t("catalog.emptySection")}
              </p>
            )}
          </article>
        );
      })}
    </section>
  );
}

/**
 * Renders a catalogue entry as a real screen.
 *
 * A `module` lists its pages, a `page` renders its tabs, and every other kind
 * shows where it lives. This is the same view users get for active entries
 * and the superadmin gets for beta/disabled ones, so "I created it" and "I can
 * see it working" are the same moment.
 */
export default function CatalogPage() {
  const { t } = useTranslation();
  const { key = "" } = useParams();
  const user = useSelector((state: RootState) => state.auth.user);
  const { data, isLoading } = useCatalogEntries();
  const entries = data ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader />
      </div>
    );
  }

  const entry = entries.find((candidate) => candidate.key === key);

  if (!entry) {
    return (
      <div className={`${panel} mx-auto max-w-lg space-y-3 text-center`}>
        <FileText className="mx-auto h-8 w-8 text-slate-400" />
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
          {t("catalog.notFound")}
        </h1>
        <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {t("catalog.notFoundHint")}
        </p>
        <Link
          to={APP_PATHS.dashboard}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 underline-offset-2 hover:underline dark:text-teal-300"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("catalog.backToApp")}
        </Link>
      </div>
    );
  }

  const children = entries.filter(
    (candidate) => candidate.parentKey === entry.key,
  );
  const pages = children.filter((candidate) => candidate.kind === "page");
  const tabs = children.filter((candidate) => candidate.kind === "tab");
  const components = children.filter(
    (candidate) => candidate.kind === "component",
  );
  const integrations = children.filter(
    (candidate) => candidate.kind === "integration",
  );
  const parent = entry.parentKey
    ? entries.find((candidate) => candidate.key === entry.parentKey)
    : undefined;
  const isSuperadmin = user?.role === "superadmin";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <Link
          to={APP_PATHS.dashboard}
          className="inline-flex items-center gap-1.5 font-medium text-slate-500 transition-colors hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-300"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("catalog.backToApp")}
        </Link>
        {isSuperadmin && (
          <Link
            to={`${RoutePaths.App}/${RoutePaths.Superadmin}`}
            className="inline-flex items-center gap-1.5 font-medium text-slate-500 transition-colors hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-300"
          >
            <Building className="h-4 w-4" />
            {t("catalog.back")}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <header className={`${panel} relative overflow-hidden`}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-24 h-52 w-52 rounded-full bg-teal-400/15 blur-3xl"
        />
        <div className="relative flex flex-wrap items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-600 ring-1 ring-inset ring-teal-500/25 dark:bg-teal-400/10 dark:text-teal-300">
            <EntryIcon kind={entry.kind} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {entry.name}
              </h1>
              <StatusPill status={entry.status} />
              {entry.isCore && (
                <span className="rounded-full border border-teal-400/40 px-1.5 py-0.5 text-[10px] font-medium text-teal-600 dark:text-teal-300">
                  {t("superadmin.modules.core")}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {[
                t(`superadmin.modules.kinds.${entry.kind}`),
                entry.category,
                `v${entry.version}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {entry.description && (
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {entry.description}
              </p>
            )}
            {parent && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {t("catalog.partOf")}{" "}
                <Link
                  to={catalogHref(parent.key)}
                  className="font-medium text-teal-600 underline-offset-2 hover:underline dark:text-teal-300"
                >
                  {parent.name}
                </Link>
              </p>
            )}
          </div>
        </div>

        {isSuperadmin && entry.status !== "active" && (
          <p className="relative mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-200">
            {t("catalog.previewNote", {
              status: t(`superadmin.modules.status.${entry.status}`),
            })}
          </p>
        )}
      </header>

      <PageSections entry={entry} entries={entries} />

      {entry.kind === "module" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t("catalog.modulePages")}
            </h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {pages.length}
            </span>
          </div>
          {pages.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {pages.map((page) => {
                const pageTabs = entries.filter(
                  (candidate) =>
                    candidate.parentKey === page.key &&
                    candidate.kind === "tab",
                ).length;
                const pageComponents = entries.filter(
                  (candidate) =>
                    candidate.parentKey === page.key &&
                    candidate.kind === "component",
                ).length;
                return (
                  <Link
                    key={page.id}
                    to={catalogHref(page.key)}
                    className={`${panel} group block hover:border-teal-400/40`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-500/10 text-slate-500 ring-1 ring-inset ring-slate-500/15 dark:text-slate-300">
                        <FileText className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {page.name}
                          </p>
                          <StatusPill status={page.status} />
                        </div>
                        {page.description && (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                            {page.description}
                          </p>
                        )}
                        <p className="mt-2 text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          {t("catalog.childSummary", {
                            tabs: pageTabs,
                            components: pageComponents,
                          })}
                        </p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyCard
              icon={FileText}
              title={t("catalog.noPages")}
              hint={t("catalog.noPagesHint")}
            />
          )}
        </section>
      )}

      {/* A page built only with blocks has nothing to say about tabs: the
          empty state would read as unfinished content below real content. */}
      {entry.kind === "page" &&
        (tabs.length > 0 || !entry.content?.sections?.length) && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t("catalog.pageTabs")}
            </h2>
            {tabs.length ? (
              <Tabs defaultValue={tabs[0].key}>
                <TabsList>
                  {tabs.map((tab) => (
                    <TabsTrigger key={tab.id} value={tab.key}>
                      {tab.name}
                      {tab.status !== "active" && (
                        <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wide opacity-70">
                          {t(`superadmin.modules.status.${tab.status}`)}
                        </span>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {tabs.map((tab) => {
                  const tabChildren = entries.filter(
                    (candidate) => candidate.parentKey === tab.key,
                  );
                  return (
                    <TabsContent key={tab.id} value={tab.key}>
                      <div className="space-y-3">
                        <div className={panel}>
                          {tab.description ? (
                            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                              {tab.description}
                            </p>
                          ) : (
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {t("catalog.noDescription")}
                            </p>
                          )}
                          {tabChildren.length ? (
                            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                              {tabChildren.map((child) => (
                                <li key={child.id}>
                                  <EntryChip entry={child} />
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                              {t("catalog.noChildren")}
                            </p>
                          )}
                        </div>
                        <PageSections entry={tab} entries={entries} />
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
            ) : (
              <EmptyCard
                icon={ListChecks}
                title={t("catalog.noTabs")}
                hint={t("catalog.noTabsHint")}
              />
            )}
          </section>
        )}

      {entry.kind === "integration" && (
        <p
          className={`${panel} text-sm leading-relaxed text-slate-600 dark:text-slate-300`}
        >
          {t("catalog.internalKind")}
        </p>
      )}

      <ChildList title={t("catalog.components")} entries={components} />
      <ChildList title={t("catalog.integrations")} entries={integrations} />

      {entry.kind === "tab" && children.length === 0 && (
        <EmptyCard icon={ListChecks} title={t("catalog.noChildren")} />
      )}
    </div>
  );
}
