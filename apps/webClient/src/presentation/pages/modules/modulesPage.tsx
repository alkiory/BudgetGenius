import { CatalogModule, ModuleKind } from "@adapters/http/modules.repository";
import { useModules } from "@adapters/query/modules";
import Loader from "@presentation/components/loader";
import {
  Link2,
  Settings,
  Sparkles,
} from "@presentation/components/ui/animated-icons";
import { useTranslation } from "react-i18next";

const KIND_ORDER: ModuleKind[] = ["module", "component", "integration"];

const KIND_ICON: Record<ModuleKind, typeof Sparkles> = {
  module: Sparkles,
  component: Settings,
  integration: Link2,
};

const KIND_TONE: Record<ModuleKind, string> = {
  module:
    "bg-teal-500/15 text-teal-600 ring-teal-500/25 dark:bg-teal-400/10 dark:text-teal-300",
  component:
    "bg-violet-500/15 text-violet-600 ring-violet-500/25 dark:bg-violet-400/10 dark:text-violet-300",
  integration:
    "bg-cyan-500/15 text-cyan-600 ring-cyan-500/25 dark:bg-cyan-400/10 dark:text-cyan-300",
};

function ModuleCard({ module }: { module: CatalogModule }) {
  const { t } = useTranslation();
  const Icon = KIND_ICON[module.kind];

  return (
    <div className="glass-panel hover-glow rounded-xl p-5">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${KIND_TONE[module.kind]}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {module.name}
            </h3>
            {module.status === "beta" && (
              <span className="rounded-full border border-amber-400/40 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-300">
                {t("modules.beta")}
              </span>
            )}
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
              {t(`modules.kinds.${module.kind}`)}
            </span>
          </div>
          {module.description && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {module.description}
            </p>
          )}
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400 dark:text-slate-500">
            <code>{module.key}</code>
            <span aria-hidden="true">·</span>
            <span>{module.category}</span>
            <span aria-hidden="true">·</span>
            <span>v{module.version}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Catalogue of what the product currently offers, fed by the backoffice.
 *
 * A module disabled there disappears from this page; a beta one is labelled.
 * This is the user-facing side of the "Módulos" tab.
 */
export default function ModulesPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useModules();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15 text-teal-600 ring-1 ring-inset ring-teal-500/25 dark:bg-teal-400/10 dark:text-teal-300">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {t("modules.title")}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t("modules.subtitle")}
          </p>
        </div>
      </header>

      {isLoading ? (
        <Loader />
      ) : !data?.length ? (
        <div className="glass-panel rounded-xl p-5 text-sm text-slate-500 dark:text-slate-400">
          {t("modules.empty")}
        </div>
      ) : (
        KIND_ORDER.map((kind) => {
          const items = data.filter((module) => module.kind === kind);
          if (items.length === 0) return null;
          return (
            <section key={kind} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  {t(`modules.kindsPlural.${kind}`)}
                </h2>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {items.length}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {items.map((module) => (
                  <ModuleCard key={module.id} module={module} />
                ))}
              </div>
              {kind === "module" && (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {t("modules.kindsHelp.module")}
                </p>
              )}
              {kind === "component" && (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {t("modules.kindsHelp.component")}
                </p>
              )}
              {kind === "integration" && (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {t("modules.kindsHelp.integration")}
                </p>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
