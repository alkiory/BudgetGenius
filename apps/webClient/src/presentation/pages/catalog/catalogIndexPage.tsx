import {
  CatalogEntry,
  CatalogEntryKind,
  CatalogEntryStatus,
} from "@adapters/http/catalog.repository";
import { useCatalogEntries } from "@adapters/query/catalog";
import Loader from "@presentation/components/loader";
import {
  ArrowUpRight,
  FileText,
  Link as LinkIcon,
  ListChecks,
  Sparkles,
  Wrench,
} from "@presentation/components/ui/animated-icons";
import { catalogHref } from "@presentation/utils/catalog";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

const panel = "glass-panel rounded-xl p-5 shadow-sm";

const STATUS_TONE: Record<CatalogEntryStatus, string> = {
  active:
    "border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  beta: "border-amber-400/40 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  disabled:
    "border-rose-400/40 bg-rose-500/10 text-rose-600 dark:text-rose-300",
};

const GROUPS: CatalogEntryKind[] = [
  "module",
  "page",
  "tab",
  "component",
  "integration",
];

function KindIcon({
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

function EntryRow({ entry }: { entry: CatalogEntry }) {
  const { t } = useTranslation();
  return (
    <Link
      to={catalogHref(entry.key)}
      className="group flex items-center gap-3 border-t border-slate-200/70 py-2.5 first:border-t-0 dark:border-white/[0.06]"
    >
      <KindIcon
        kind={entry.kind}
        className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">
          {entry.name}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
          <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-white/[0.06]">
            {entry.key}
          </code>
          {entry.parentKey && <span>· {entry.parentKey}</span>}
        </span>
      </span>
      <span
        className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
          STATUS_TONE[entry.status]
        }`}
      >
        {t(`superadmin.modules.status.${entry.status}`)}
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

/**
 * One destination for the whole inventory. Modules and pages show up in the
 * sidebar on their own, but this list is where tabs, components and
 * integrations are visible too — so registering something always produces
 * something the operator can open.
 */
export default function CatalogIndexPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useCatalogEntries();
  const entries = data ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <header className={`${panel} relative overflow-hidden`}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-24 h-48 w-48 rounded-full bg-teal-400/15 blur-3xl"
        />
        <div className="relative flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-600 ring-1 ring-inset ring-teal-500/25 dark:bg-teal-400/10 dark:text-teal-300">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {t("catalog.allTitle")}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {t("catalog.allHint")}
            </p>
          </div>
        </div>
      </header>

      {entries.length === 0 ? (
        <p className={panel}>{t("catalog.allEmpty")}</p>
      ) : (
        GROUPS.map((kind) => {
          const group = entries.filter((entry) => entry.kind === kind);
          if (!group.length) return null;
          return (
            <section key={kind} className={panel}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <KindIcon
                    kind={kind}
                    className="h-4 w-4 text-teal-500 dark:text-teal-300"
                  />
                  {t(`superadmin.modules.kinds.${kind}`)}
                </h2>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {group.length}
                </span>
              </div>
              {group.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </section>
          );
        })
      )}
    </div>
  );
}
