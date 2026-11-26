import { CatalogModule, ModuleKind } from "@adapters/http/modules.repository";
import { useModules } from "@adapters/query/modules";
import Loader from "@presentation/components/loader";
import { Modal } from "@presentation/components/modal/modal";
import {
  Link2,
  Settings,
  Sparkles,
} from "@presentation/components/ui/animated-icons";
import { Button } from "@presentation/components/ui/button";
import { useMemo, useState } from "react";
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

function ModuleCard({
  module,
  onOpen,
}: {
  module: CatalogModule;
  onOpen: (module: CatalogModule) => void;
}) {
  const { t } = useTranslation();
  const Icon = KIND_ICON[module.kind];

  return (
    <button
      type="button"
      onClick={() => onOpen(module)}
      aria-haspopup="dialog"
      aria-label={t("modules.openDetails", { name: module.name })}
      className="glass-panel hover-glow group w-full rounded-xl p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60"
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${
            KIND_TONE[module.kind]
          }`}
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
      <span className="mt-3 inline-block text-[11px] font-medium text-teal-600 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:text-teal-300">
        {t("modules.seeDetails")}
      </span>
    </button>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-slate-200/70 py-2 first:border-t-0 dark:border-white/[0.06]">
      <dt className="shrink-0 text-xs uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-right text-sm text-slate-700 dark:text-slate-300">
        {value}
      </dd>
    </div>
  );
}

/**
 * Detail of one catalogue entry. A module lists the components registered
 * under it (e.g. `cards` → `card-type`); a component points back at the
 * module it lives in, so clicking through either direction explains where
 * the feature actually is in the app.
 */
function ModuleDetail({
  module,
  modules,
  onClose,
  onOpen,
}: {
  module: CatalogModule;
  modules: CatalogModule[];
  onClose: () => void;
  onOpen: (module: CatalogModule) => void;
}) {
  const { t } = useTranslation();
  const parent = module.parentKey
    ? modules.find((candidate) => candidate.key === module.parentKey)
    : undefined;
  const children = useMemo(
    () =>
      modules.filter(
        (candidate) =>
          candidate.key !== module.key && candidate.parentKey === module.key,
      ),
    [modules, module.key],
  );

  return (
    <Modal isOpen onClose={onClose} title={module.name}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
            {t(`modules.kinds.${module.kind}`)}
          </span>
          <span className="rounded-full border border-teal-400/40 px-1.5 py-0.5 text-[10px] font-medium text-teal-600 dark:text-teal-300">
            {t(`modules.status.${module.status}`)}
          </span>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300">
          {module.description || t("modules.detail.noDescription")}
        </p>

        <p className="rounded-lg bg-slate-500/5 px-3 py-2 text-xs text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
          {t(`modules.detail.howItWorks.${module.kind}`)}
        </p>

        <dl className="rounded-lg border border-slate-200/80 px-3 dark:border-white/[0.08]">
          <MetaRow label={t("modules.detail.key")} value={module.key} />
          <MetaRow
            label={t("modules.detail.category")}
            value={module.category}
          />
          <MetaRow
            label={t("modules.detail.version")}
            value={`v${module.version}`}
          />
          <MetaRow
            label={t("modules.detail.belongsTo")}
            value={parent?.name ?? t("modules.detail.standalone")}
          />
        </dl>

        {parent && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpen(parent)}
          >
            {t("modules.detail.openParent", { name: parent.name })}
          </Button>
        )}

        {module.kind === "module" && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              {t("modules.detail.components")}
            </h3>
            {children.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("modules.detail.componentsEmpty")}
              </p>
            ) : (
              <ul className="space-y-2">
                {children.map((child) => (
                  <li key={child.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(child)}
                      className="flex w-full items-start gap-2 rounded-lg border border-slate-200/80 px-3 py-2 text-left transition-colors hover:border-teal-400/40 hover:bg-teal-500/5 dark:border-white/[0.08]"
                    >
                      <Settings className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500 dark:text-violet-300" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                          {child.name}
                        </span>
                        {child.description && (
                          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                            {child.description}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

/**
 * Catalogue of what the product currently offers, fed by the backoffice.
 *
 * A module disabled there disappears from this page; a beta one is labelled.
 * Opening a card explains the entry and, for a module, lists the components
 * that live inside it (`cards` → `card-type`).
 */
export default function ModulesPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useModules();
  const [selected, setSelected] = useState<CatalogModule | null>(null);

  // The selected row is the one in the list: a refresh that disables the
  // module should also close (or re-target) the detail instead of showing a
  // stale copy.
  const activeModule = selected
    ? data?.find((module) => module.id === selected.id) ?? selected
    : null;

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
                  <ModuleCard
                    key={module.id}
                    module={module}
                    onOpen={setSelected}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {t(`modules.kindsHelp.${kind}`)}
              </p>
            </section>
          );
        })
      )}

      {activeModule && data && (
        <ModuleDetail
          module={activeModule}
          modules={data}
          onClose={() => setSelected(null)}
          onOpen={setSelected}
        />
      )}
    </div>
  );
}
