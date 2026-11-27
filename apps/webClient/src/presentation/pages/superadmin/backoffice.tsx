import {
  AppApiKeyRow,
  AppModuleBlock,
  AppModuleRow,
  AppNotificationRow,
  BlockFieldSchema,
  BlockTypeSchema,
  ProviderKeyRow,
} from "@adapters/http/superadmin.repository";
import {
  useApiKeys,
  useAppModules,
  useBlockTypes,
  useCreateApiKey,
  useCreateAppModule,
  useCreateNotification,
  useCreateProviderKey,
  useDeleteApiKey,
  useDeleteNotification,
  useDeleteProviderKey,
  useFinnyStatus,
  useNotifications,
  useProviderKeys,
  useReorderAppModules,
  useRevokeApiKey,
  useSuperAdminOverview,
  useUpdateModuleContent,
  useUpdateAppModule,
  useUpdateNotification,
  useUpdateProviderKey,
  useUploadImage,
} from "@adapters/query/superadmin";
import { resolveMediaUrl } from "@infrastructure/media-url";
import Loader from "@presentation/components/loader";
import { Modal } from "@presentation/components/modal/modal";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  Building,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Info,
  KeyRound,
  Link2,
  ListChecks,
  Menu,
  Pencil,
  PiggyBank,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from "@presentation/components/ui/animated-icons";
import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { Switch } from "@presentation/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@presentation/components/ui/tabs";
import { catalogHref } from "@presentation/utils/catalog";
import { useState, type ChangeEvent, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

const number = (value: number) => value.toLocaleString();

const panel =
  "glass-panel hover-glow rounded-xl p-5 shadow-sm transition-shadow";

function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className={panel}>
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
        {value}
      </p>
      {note && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {note}
        </p>
      )}
    </div>
  );
}

function useMutationError() {
  const { t } = useTranslation();
  return (error: unknown) => {
    const message =
      (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message ?? t("superadmin.error");
    toast.error(String(message));
  };
}

function OverviewTab() {
  const { t } = useTranslation();
  const { data, isLoading } = useSuperAdminOverview();

  if (isLoading) return <Loader />;
  if (!data) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {t("common.noData")}
      </p>
    );
  }

  const peak = Math.max(...data.activity.map((row) => row.transactions), 1);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("superadmin.overview.users")}
          value={number(data.users.total)}
          note={t("superadmin.overview.usersNote", {
            count: number(data.users.last30d),
          })}
        />
        <StatCard
          label={t("superadmin.overview.transactions")}
          value={number(data.transactions.total)}
          note={t("superadmin.overview.transactionsNote", {
            count: number(data.transactions.last24h),
          })}
        />
        <StatCard
          label={t("superadmin.overview.modules")}
          value={`${number(data.modules.active)} / ${number(
            data.modules.total,
          )}`}
          note={t("superadmin.overview.modulesBreakdown", {
            modules: number(data.modules.byKind.module),
            components: number(data.modules.byKind.component),
            integrations: number(data.modules.byKind.integration),
            pages: number(data.modules.byKind.page),
            tabs: number(data.modules.byKind.tab),
          })}
        />
        <StatCard
          label={t("superadmin.overview.apiKeys")}
          value={`${number(data.apiKeys.active)} / ${number(
            data.apiKeys.total,
          )}`}
          note={t("superadmin.overview.keysNote")}
        />
      </div>

      <div className={panel}>
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-teal-500 dark:text-teal-300" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t("superadmin.overview.activity")}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {t("superadmin.overview.activityHint")}
            </p>
          </div>
        </div>
        {data.activity.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("superadmin.overview.activityEmpty")}
          </p>
        ) : (
          <ul className="space-y-2">
            {data.activity.map((row) => (
              <li key={row.month} className="flex items-center gap-3 text-xs">
                <span className="w-16 shrink-0 font-medium text-slate-500 dark:text-slate-400">
                  {row.month}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/[0.07]">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-500"
                    style={{
                      width: `${Math.max(
                        (row.transactions / peak) * 100,
                        row.transactions > 0 ? 4 : 0,
                      )}%`,
                    }}
                  />
                </span>
                <span className="w-20 shrink-0 text-right text-slate-500 dark:text-slate-400">
                  {number(row.transactions)}{" "}
                  <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {t("superadmin.overview.movements")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const MODULE_KINDS: AppModuleRow["kind"][] = [
  "module",
  "component",
  "integration",
  "page",
  "tab",
];

const MODULE_STATUSES: AppModuleRow["status"][] = [
  "active",
  "beta",
  "disabled",
];

/**
 * Where an entry can live: components and pages inside a module, tabs inside
 * a page. A module or integration stands on its own.
 */
const parentKindsFor = (kind: AppModuleRow["kind"]): AppModuleRow["kind"][] => {
  if (kind === "component" || kind === "page") return ["module"];
  if (kind === "tab") return ["page"];
  return [];
};

const formSelectClass =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

type ModuleForm = {
  key: string;
  name: string;
  description: string;
  kind: AppModuleRow["kind"];
  category: string;
  version: string;
  status: AppModuleRow["status"];
  parentKey: string;
};

const emptyModuleForm = (): ModuleForm => ({
  key: "",
  name: "",
  description: "",
  kind: "module",
  category: "",
  version: "",
  status: "active",
  parentKey: "",
});

function ParentField({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: string;
  options: AppModuleRow[];
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{t("superadmin.modules.parent")}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={formSelectClass}
      >
        <option value="">{t("superadmin.modules.parentNone")}</option>
        {options.map((option) => (
          <option key={option.id} value={option.key}>
            {option.name} ({option.key})
          </option>
        ))}
      </select>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        {t("superadmin.modules.parentHint")}
      </p>
    </div>
  );
}

function ModuleRowItem({
  module,
  onOpen,
}: {
  module: AppModuleRow;
  onOpen: (module: AppModuleRow) => void;
}) {
  const { t } = useTranslation();
  const update = useUpdateAppModule();
  const onError = useMutationError();

  return (
    <div className="group flex flex-wrap items-center gap-3 border-t border-slate-200/70 py-3 first:border-t-0 dark:border-white/[0.06]">
      {/* The whole entry opens the editor; the status select on the right is
          the one-click enable/beta/disable shortcut. */}
      <button
        type="button"
        onClick={() => onOpen(module)}
        aria-haspopup="dialog"
        aria-label={t("superadmin.modules.open", { name: module.name })}
        className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-slate-900 dark:text-white">
            {module.name}
          </span>
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
            {module.key}
          </code>
          {module.isCore && (
            <span className="rounded-full border border-teal-400/40 px-1.5 py-0.5 text-[10px] font-medium text-teal-600 dark:text-teal-300">
              {t("superadmin.modules.core")}
            </span>
          )}
          <Pencil className="h-3 w-3 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
        </span>
        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
          {[
            t(`superadmin.modules.kinds.${module.kind}`),
            module.category,
            `v${module.version}`,
            module.parentKey
              ? t("superadmin.modules.partOf", { key: module.parentKey })
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </button>

      <div className="flex items-center gap-2">
        <select
          value={module.status}
          disabled={update.isPending}
          onChange={(event) =>
            update.mutate(
              {
                id: module.id,
                status: event.target.value as AppModuleRow["status"],
              },
              { onError },
            )
          }
          aria-label={t("superadmin.modules.toggle")}
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          {MODULE_STATUSES.map((status) => (
            <option
              key={status}
              value={status}
              disabled={module.isCore && status === "disabled"}
            >
              {t(`superadmin.modules.status.${status}`)}
            </option>
          ))}
        </select>
        {/* The entry is only real when it can be opened: this link goes to
            the catalogue page users get, so a beta or disabled entry can be
            reviewed in place before publishing. */}
        <Link
          to={catalogHref(module.key)}
          title={t("superadmin.modules.openInApp")}
          aria-label={t("superadmin.modules.openInApp")}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-teal-500/10 hover:text-teal-600 dark:hover:text-teal-300"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={() => onOpen(module)}
          title={t("common.edit")}
          aria-label={t("superadmin.modules.open", { name: module.name })}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-teal-500/10 hover:text-teal-600 dark:hover:text-teal-300"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

type SectionDraft = {
  id: string;
  title: string;
  body: string;
  blocks: AppModuleBlock[];
  componentKeys: string[];
};

/** Client-side id: unique per editor session, stable per row while moving. */
const newSectionId = () =>
  `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const newBlockId = () =>
  `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Same icon language as the palette, so the composer reads at a glance. */
function BlockIcon({ type, className }: { type: string; className?: string }) {
  if (type === "stats") return <BarChart3 className={className} />;
  if (type === "steps") return <ListChecks className={className} />;
  if (type === "checklist") return <CheckCircle2 className={className} />;
  if (type === "links") return <Link2 className={className} />;
  if (type === "faq") return <FileText className={className} />;
  if (type === "cta") return <Send className={className} />;
  if (type === "image") return <Camera className={className} />;
  if (type === "emergency-fund") return <PiggyBank className={className} />;
  if (type === "divider") return <Menu className={className} />;
  return <Info className={className} />;
}

/** FileReader wrapper: the API receives the picked file as a data URL. */
const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/**
 * Image picker for a block: upload from the device or paste a URL.
 *
 * The file is stored by the API and only its path lands in the block, so the
 * page keeps rendering even if the operator never touches a CDN. External
 * URLs still work, which keeps already-authored pages valid.
 */
function ImagePicker({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation();
  const upload = useUploadImage();
  const onError = useMutationError();
  const [reading, setReading] = useState(false);
  const busy = reading || upload.isPending;

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so picking the same file again still fires `change`.
    event.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
      toast.error(t("superadmin.modules.blocks.image.unsupported"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("superadmin.modules.blocks.image.tooLarge"));
      return;
    }
    try {
      setReading(true);
      const dataUrl = await readAsDataUrl(file);
      upload.mutate(dataUrl, {
        onSuccess: ({ url }) => onChange(url),
        onError,
      });
    } catch {
      toast.error(t("superadmin.modules.blocks.image.readError"));
    } finally {
      setReading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={500}
          placeholder="/api/media/…"
          className="min-w-0 flex-1"
        />
        <label
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-teal-400/50 hover:text-teal-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:text-teal-300 ${
            busy ? "pointer-events-none opacity-60" : ""
          }`}
        >
          <Camera className="h-3.5 w-3.5" />
          {busy
            ? t("superadmin.modules.blocks.image.uploading")
            : t("superadmin.modules.blocks.image.upload")}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={handleFile}
            disabled={busy}
          />
        </label>
      </div>
      {value && (
        <img
          src={resolveMediaUrl(value)}
          alt=""
          className="h-28 w-full max-w-xs rounded-md border border-slate-200 object-cover dark:border-white/10"
        />
      )}
      <p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
        {t("superadmin.modules.blocks.image.hint")}
      </p>
    </div>
  );
}

/**
 * Form for one block, generated from the API schema.
 *
 * No block gets its own hardcoded form: adding a field to the registry makes
 * it editable here, which is what keeps the backoffice ahead of the code.
 */
function BlockFields({
  fields,
  value,
  idPrefix,
  onChange,
}: {
  fields: BlockFieldSchema[];
  value: Record<string, unknown>;
  idPrefix: string;
  onChange: (name: string, next: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {fields.map((field) => {
        const id = `${idPrefix}-${field.name}`;
        const current =
          typeof value[field.name] === "string"
            ? (value[field.name] as string)
            : "";
        const wide = field.input !== "text" || field.name === "title";
        return (
          <div
            key={field.name}
            className={`space-y-1 ${wide ? "sm:col-span-2" : ""}`}
          >
            <Label htmlFor={id}>
              {t(`superadmin.modules.blocks.fields.${field.name}`)}
            </Label>
            {field.input === "textarea" ? (
              <textarea
                id={id}
                value={current}
                onChange={(event) => onChange(field.name, event.target.value)}
                rows={2}
                maxLength={field.maxLength}
                className={`${formSelectClass} h-auto py-2`}
              />
            ) : field.input === "image" ? (
              <ImagePicker
                id={id}
                value={current}
                onChange={(next) => onChange(field.name, next)}
              />
            ) : field.input === "select" ? (
              <select
                id={id}
                value={current}
                onChange={(event) => onChange(field.name, event.target.value)}
                className={formSelectClass}
              >
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(`superadmin.modules.blocks.tones.${option.labelKey}`)}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={id}
                value={current}
                onChange={(event) => onChange(field.name, event.target.value)}
                maxLength={field.maxLength}
                placeholder={t(
                  `superadmin.modules.blocks.fields.${field.name}`,
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Authors what a page actually says, from the backoffice.
 *
 * Sections are the page body: ordered blocks with a heading, a text and the
 * components that belong to them. The same panel reorders the page's tabs and
 * registers new components on it, so "I created a page" and "the page has
 * content and order" are one screen instead of three.
 */
function PageContentEditor({
  module,
  modules,
}: {
  module: AppModuleRow;
  modules: AppModuleRow[];
}) {
  const { t } = useTranslation();
  const saveContent = useUpdateModuleContent();
  const reorder = useReorderAppModules();
  const create = useCreateAppModule();
  const { data: blockTypes, isLoading: blocksLoading } = useBlockTypes();
  const onError = useMutationError();

  const [sections, setSections] = useState<SectionDraft[]>(() =>
    (module.content?.sections ?? []).map((section) => ({
      ...section,
      blocks: section.blocks ?? [],
    })),
  );
  const [componentName, setComponentName] = useState("");
  const [componentKey, setComponentKey] = useState("");

  // Tabs are siblings of the page: order is `sortOrder`, then name.
  const tabs = modules
    .filter((entry) => entry.kind === "tab" && entry.parentKey === module.key)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  // Components are building blocks: they can be attached anywhere, so the
  // operator is not forced to create one before placing it.
  const components = modules.filter((entry) => entry.kind === "component");

  const patch = (index: number, changes: Partial<SectionDraft>) =>
    setSections((current) =>
      current.map((section, position) =>
        position === index ? { ...section, ...changes } : section,
      ),
    );

  const moveSection = (index: number, offset: number) => {
    const target = index + offset;
    setSections((current) => {
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const toggleComponent = (index: number, key: string) => {
    const keys = sections[index].componentKeys;
    patch(index, {
      componentKeys: keys.includes(key)
        ? keys.filter((candidate) => candidate !== key)
        : [...keys, key],
    });
  };

  const itemsOf = (block: AppModuleBlock): Array<Record<string, unknown>> =>
    Array.isArray(block.props.items)
      ? (block.props.items as Array<Record<string, unknown>>)
      : [];

  const patchBlock = (
    sectionIndex: number,
    blockIndex: number,
    changes: Partial<AppModuleBlock>,
  ) => {
    const blocks = sections[sectionIndex].blocks.map((block, position) =>
      position === blockIndex ? { ...block, ...changes } : block,
    );
    patch(sectionIndex, { blocks });
  };

  const patchBlockProps = (
    sectionIndex: number,
    blockIndex: number,
    name: string,
    value: unknown,
  ) => {
    const block = sections[sectionIndex].blocks[blockIndex];
    patchBlock(sectionIndex, blockIndex, {
      props: { ...block.props, [name]: value },
    });
  };

  const addBlock = (sectionIndex: number, schema: BlockTypeSchema) => {
    // Mirrors the API default so a new block is already valid on screen.
    const props: Record<string, unknown> = {};
    for (const field of schema.fields) {
      props[field.name] =
        field.input === "select" ? field.options?.[0]?.value ?? "" : "";
    }
    if (schema.items) props.items = [];
    patch(sectionIndex, {
      blocks: [
        ...sections[sectionIndex].blocks,
        { id: newBlockId(), type: schema.type, props },
      ],
    });
  };

  const moveBlock = (
    sectionIndex: number,
    blockIndex: number,
    offset: number,
  ) => {
    const blocks = [...sections[sectionIndex].blocks];
    const target = blockIndex + offset;
    if (target < 0 || target >= blocks.length) return;
    [blocks[blockIndex], blocks[target]] = [blocks[target], blocks[blockIndex]];
    patch(sectionIndex, { blocks });
  };

  const removeBlock = (sectionIndex: number, blockIndex: number) =>
    patch(sectionIndex, {
      blocks: sections[sectionIndex].blocks.filter(
        (_, position) => position !== blockIndex,
      ),
    });

  const changeItem = (
    sectionIndex: number,
    blockIndex: number,
    itemIndex: number,
    field: string,
    value: string,
  ) => {
    const items = itemsOf(sections[sectionIndex].blocks[blockIndex]).map(
      (item, position) =>
        position === itemIndex ? { ...item, [field]: value } : item,
    );
    patchBlockProps(sectionIndex, blockIndex, "items", items);
  };

  const addItem = (sectionIndex: number, blockIndex: number) => {
    const items = itemsOf(sections[sectionIndex].blocks[blockIndex]);
    patchBlockProps(sectionIndex, blockIndex, "items", [...items, {}]);
  };

  const removeItem = (
    sectionIndex: number,
    blockIndex: number,
    itemIndex: number,
  ) => {
    const items = itemsOf(sections[sectionIndex].blocks[blockIndex]);
    patchBlockProps(
      sectionIndex,
      blockIndex,
      "items",
      items.filter((_, position) => position !== itemIndex),
    );
  };

  const save = () => {
    saveContent.mutate(
      { id: module.id, content: { sections } },
      {
        onSuccess: (saved) => {
          // The server re-slugs ids and drops empty rows; mirror that here so
          // the editor shows exactly what the app will render.
          setSections(
            (saved.content?.sections ?? []).map((section) => ({
              ...section,
              blocks: section.blocks ?? [],
            })),
          );
          toast.success(t("superadmin.modules.content.saved"));
        },
        onError,
      },
    );
  };

  const moveTab = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= tabs.length) return;
    const next = [...tabs];
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate(
      next.map((tab) => tab.key),
      {
        onSuccess: () =>
          toast.success(t("superadmin.modules.content.tabsSaved")),
        onError,
      },
    );
  };

  const addComponent = () => {
    create.mutate(
      {
        key: componentKey.trim().toLowerCase(),
        name: componentName.trim(),
        kind: "component",
        parentKey: module.key,
        category: module.category,
        status: module.status,
      },
      {
        onSuccess: (created) => {
          setComponentName("");
          setComponentKey("");
          toast.success(
            t("superadmin.modules.content.componentAdded", {
              name: created.name,
            }),
          );
        },
        onError,
      },
    );
  };

  const moveButton =
    "rounded-md p-1 text-slate-400 transition-colors hover:bg-teal-500/10 hover:text-teal-600 disabled:opacity-30 dark:hover:text-teal-300";

  return (
    <section className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-white/[0.08] dark:bg-white/[0.02]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t("superadmin.modules.content.title")}
          </h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {t("superadmin.modules.content.hint")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setSections((current) => [
              ...current,
              {
                id: newSectionId(),
                title: "",
                body: "",
                blocks: [],
                componentKeys: [],
              },
            ])
          }
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t("superadmin.modules.content.addSection")}
        </Button>
      </div>

      {!sections.length && (
        <p className="rounded-lg border border-dashed border-slate-300/70 px-3 py-4 text-center text-[11px] text-slate-500 dark:border-white/10 dark:text-slate-400">
          {t("superadmin.modules.content.noSections")}
        </p>
      )}

      {sections.map((section, index) => (
        <article
          key={section.id}
          className="space-y-2 rounded-lg border border-slate-200 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.03]"
        >
          <div className="flex items-center gap-1">
            <span className="mr-auto text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              {t("superadmin.modules.content.sectionNumber", { n: index + 1 })}
            </span>
            <button
              type="button"
              onClick={() => moveSection(index, -1)}
              disabled={index === 0}
              title={t("superadmin.modules.content.moveUp")}
              aria-label={t("superadmin.modules.content.moveUp")}
              className={moveButton}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => moveSection(index, 1)}
              disabled={index === sections.length - 1}
              title={t("superadmin.modules.content.moveDown")}
              aria-label={t("superadmin.modules.content.moveDown")}
              className={moveButton}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                setSections((current) =>
                  current.filter((_, position) => position !== index),
                )
              }
              title={t("superadmin.modules.content.removeSection")}
              aria-label={t("superadmin.modules.content.removeSection")}
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <Input
            value={section.title}
            onChange={(event) => patch(index, { title: event.target.value })}
            placeholder={t("superadmin.modules.content.sectionTitle")}
            aria-label={t("superadmin.modules.content.sectionTitle")}
            maxLength={120}
          />
          <textarea
            value={section.body}
            onChange={(event) => patch(index, { body: event.target.value })}
            placeholder={t("superadmin.modules.content.sectionBody")}
            aria-label={t("superadmin.modules.content.sectionBody")}
            rows={3}
            maxLength={4000}
            className={`${formSelectClass} h-auto py-2`}
          />

          {/* Blocks are the actual page UI: the operator picks one from the
              palette and fills generated fields, no code or deploy involved. */}
          <div className="space-y-2 rounded-lg border border-dashed border-slate-300/70 bg-slate-50/40 p-2 dark:border-white/10 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {t("superadmin.modules.blocks.title")}
              </p>
              <span className="text-[10px] text-slate-400">
                {section.blocks.length}
              </span>
            </div>

            {!section.blocks.length && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {t("superadmin.modules.blocks.empty")}
              </p>
            )}

            {section.blocks.map((block, blockIndex) => {
              const schema = blockTypes?.find(
                (candidate) => candidate.type === block.type,
              );
              const items = itemsOf(block);
              const itemSchema = schema?.items;
              return (
                <article
                  key={block.id}
                  className="space-y-2 rounded-md border border-slate-200 bg-white/80 p-2.5 dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-1">
                    <BlockIcon
                      type={block.type}
                      className="h-3.5 w-3.5 shrink-0 text-teal-500 dark:text-teal-300"
                    />
                    <span className="mr-auto min-w-0 truncate text-[11px] font-medium text-slate-700 dark:text-slate-200">
                      {t(`superadmin.modules.blocks.types.${block.type}`) ||
                        block.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => moveBlock(index, blockIndex, -1)}
                      disabled={blockIndex === 0}
                      title={t("superadmin.modules.content.moveUp")}
                      aria-label={t("superadmin.modules.content.moveUp")}
                      className={moveButton}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveBlock(index, blockIndex, 1)}
                      disabled={blockIndex === section.blocks.length - 1}
                      title={t("superadmin.modules.content.moveDown")}
                      aria-label={t("superadmin.modules.content.moveDown")}
                      className={moveButton}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBlock(index, blockIndex)}
                      title={t("superadmin.modules.blocks.remove")}
                      aria-label={t("superadmin.modules.blocks.remove")}
                      className="rounded-md p-1 text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-300"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>

                  {schema ? (
                    <>
                      <BlockFields
                        fields={schema.fields}
                        value={block.props}
                        idPrefix={`${module.id}-${section.id}-${block.id}`}
                        onChange={(name, next) =>
                          patchBlockProps(index, blockIndex, name, next)
                        }
                      />
                      {itemSchema && (
                        <div className="space-y-2 rounded-md border border-slate-200/70 p-2 dark:border-white/10">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                              {t("superadmin.modules.blocks.items")}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              {items.length}/{itemSchema.max}
                            </span>
                          </div>
                          {items.map((item, itemIndex) => (
                            <div
                              key={itemIndex}
                              className="space-y-1.5 border-t border-slate-200/70 pt-2 first:border-t-0 first:pt-0 dark:border-white/10"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-400">
                                  {t("superadmin.modules.blocks.item", {
                                    n: itemIndex + 1,
                                  })}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeItem(index, blockIndex, itemIndex)
                                  }
                                  title={t(
                                    "superadmin.modules.blocks.removeItem",
                                  )}
                                  aria-label={t(
                                    "superadmin.modules.blocks.removeItem",
                                  )}
                                  className="rounded-md p-1 text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-300"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                              <BlockFields
                                fields={itemSchema.fields}
                                value={item}
                                idPrefix={`${module.id}-${section.id}-${block.id}-${itemIndex}`}
                                onChange={(name, next) =>
                                  changeItem(
                                    index,
                                    blockIndex,
                                    itemIndex,
                                    name,
                                    next,
                                  )
                                }
                              />
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addItem(index, blockIndex)}
                            disabled={items.length >= (itemSchema?.max ?? 0)}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            {t("superadmin.modules.blocks.addItem")}
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-[11px] text-amber-600 dark:text-amber-300">
                      {t("superadmin.modules.blocks.unknown", {
                        type: block.type,
                      })}
                    </p>
                  )}
                </article>
              );
            })}

            <div className="flex flex-wrap gap-1.5">
              {blockTypes?.map((schema) => (
                <button
                  key={schema.type}
                  type="button"
                  onClick={() => addBlock(index, schema)}
                  title={t(`superadmin.modules.blocks.hints.${schema.type}`)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-teal-400/50 hover:text-teal-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:text-teal-300"
                >
                  <BlockIcon type={schema.type} className="h-3.5 w-3.5" />
                  {t(`superadmin.modules.blocks.types.${schema.type}`)}
                </button>
              ))}
              {blocksLoading && (
                <span className="text-[11px] text-slate-400">
                  {t("superadmin.modules.blocks.loading")}
                </span>
              )}
            </div>
          </div>

          {module.kind !== "component" && (
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {t("superadmin.modules.content.sectionComponents")}
              </p>
              {components.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {components.map((component) => {
                    const checked = section.componentKeys.includes(
                      component.key,
                    );
                    return (
                      <label
                        key={component.key}
                        className={`cursor-pointer rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                          checked
                            ? "border-teal-400/60 bg-teal-500/10 text-teal-700 dark:text-teal-300"
                            : "border-slate-200 text-slate-500 hover:border-teal-300/60 dark:border-white/10 dark:text-slate-400"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggleComponent(index, component.key)}
                        />
                        {component.name}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {t("superadmin.modules.content.noComponents")}
                </p>
              )}
            </div>
          )}
        </article>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={saveContent.isPending}
        >
          {t("superadmin.modules.content.save")}
        </Button>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {t("superadmin.modules.content.saveHint")}
        </span>
      </div>

      {module.kind === "page" && (
        <div className="space-y-2 border-t border-slate-200/80 pt-3 dark:border-white/[0.08]">
          <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
            {t("superadmin.modules.content.tabsTitle")}
          </h4>
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {t("superadmin.modules.content.tabsHint")}
          </p>
          {tabs.length ? (
            tabs.map((tab, index) => (
              <div
                key={tab.id}
                className="flex items-center gap-2 rounded-md border border-slate-200 bg-white/70 px-2 py-1 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <span className="min-w-0 flex-1 truncate text-xs text-slate-700 dark:text-slate-200">
                  {index + 1}. {tab.name}
                </span>
                <button
                  type="button"
                  onClick={() => moveTab(index, -1)}
                  disabled={index === 0 || reorder.isPending}
                  title={t("superadmin.modules.content.moveUp")}
                  aria-label={t("superadmin.modules.content.moveUp")}
                  className={moveButton}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveTab(index, 1)}
                  disabled={index === tabs.length - 1 || reorder.isPending}
                  title={t("superadmin.modules.content.moveDown")}
                  aria-label={t("superadmin.modules.content.moveDown")}
                  className={moveButton}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {t("superadmin.modules.content.noTabs")}
            </p>
          )}
        </div>
      )}

      {module.kind === "page" && (
        <div className="space-y-2 border-t border-slate-200/80 pt-3 dark:border-white/[0.08]">
          <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
            {t("superadmin.modules.content.addComponentTitle")}
          </h4>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={componentName}
              onChange={(event) => setComponentName(event.target.value)}
              placeholder={t("superadmin.modules.name")}
              aria-label={t("superadmin.modules.name")}
              maxLength={120}
            />
            <Input
              value={componentKey}
              onChange={(event) => setComponentKey(event.target.value)}
              placeholder={t("superadmin.modules.key")}
              aria-label={t("superadmin.modules.key")}
              pattern="[a-z0-9][a-z0-9-]*"
              maxLength={80}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addComponent}
            disabled={
              create.isPending ||
              componentName.trim().length < 2 ||
              componentKey.trim().length < 2
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t("superadmin.modules.content.addComponent")}
          </Button>
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {t("superadmin.modules.content.addComponentHint")}
          </p>
        </div>
      )}
    </section>
  );
}

function ModuleEditModal({
  module,
  modules,
  onClose,
}: {
  module: AppModuleRow;
  modules: AppModuleRow[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const update = useUpdateAppModule();
  const onError = useMutationError();
  const [form, setForm] = useState<ModuleForm>({
    key: module.key,
    name: module.name,
    description: module.description ?? "",
    kind: module.kind,
    category: module.category,
    version: module.version,
    status: module.status,
    parentKey: module.parentKey ?? "",
  });

  const parentKinds = parentKindsFor(form.kind);
  const parentOptions = modules.filter(
    (candidate) =>
      candidate.id !== module.id && parentKinds.includes(candidate.kind),
  );

  const save = (event: FormEvent) => {
    event.preventDefault();
    update.mutate(
      {
        id: module.id,
        name: form.name.trim(),
        key: form.key.trim().toLowerCase(),
        description: form.description.trim(),
        kind: form.kind,
        category: form.category.trim(),
        version: form.version.trim() || module.version,
        status: form.status,
        parentKey: parentKinds.length ? form.parentKey : "",
      },
      {
        onSuccess: () => {
          toast.success(t("superadmin.modules.updated"));
          onClose();
        },
        onError,
      },
    );
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      title={t("superadmin.modules.editTitle", { name: module.name })}
    >
      <form onSubmit={save} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="edit-module-name">
              {t("superadmin.modules.name")}
            </Label>
            <Input
              id="edit-module-name"
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              required
              maxLength={120}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-module-key">
              {t("superadmin.modules.key")}
            </Label>
            <Input
              id="edit-module-key"
              value={form.key}
              onChange={(event) =>
                setForm({ ...form, key: event.target.value })
              }
              required
              pattern="[a-z0-9][a-z0-9-]*"
              maxLength={80}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-module-kind">
              {t("superadmin.modules.kind")}
            </Label>
            <select
              id="edit-module-kind"
              value={form.kind}
              onChange={(event) =>
                setForm({
                  ...form,
                  kind: event.target.value as AppModuleRow["kind"],
                })
              }
              className={formSelectClass}
            >
              {MODULE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t(`superadmin.modules.kinds.${kind}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-module-status">
              {t("superadmin.modules.statusLabel")}
            </Label>
            <select
              id="edit-module-status"
              value={form.status}
              onChange={(event) =>
                setForm({
                  ...form,
                  status: event.target.value as AppModuleRow["status"],
                })
              }
              className={formSelectClass}
            >
              {MODULE_STATUSES.map((status) => (
                <option
                  key={status}
                  value={status}
                  disabled={module.isCore && status === "disabled"}
                >
                  {t(`superadmin.modules.status.${status}`)}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {module.isCore
                ? t("superadmin.modules.coreHint")
                : t(`superadmin.modules.statusHints.${form.status}`)}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-module-category">
              {t("superadmin.modules.category")}
            </Label>
            <Input
              id="edit-module-category"
              value={form.category}
              onChange={(event) =>
                setForm({ ...form, category: event.target.value })
              }
              maxLength={40}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-module-version">
              {t("superadmin.modules.version")}
            </Label>
            <Input
              id="edit-module-version"
              value={form.version}
              onChange={(event) =>
                setForm({ ...form, version: event.target.value })
              }
              maxLength={20}
            />
          </div>
          {parentKinds.length > 0 && (
            <div className="sm:col-span-2">
              <ParentField
                id="edit-module-parent"
                value={form.parentKey}
                options={parentOptions}
                onChange={(parentKey) => setForm({ ...form, parentKey })}
              />
            </div>
          )}
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="edit-module-description">
              {t("superadmin.modules.description")}
            </Label>
            <textarea
              id="edit-module-description"
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              rows={3}
              maxLength={600}
              className={`${formSelectClass} h-auto py-2`}
            />
          </div>
        </div>

        {["module", "page", "tab", "component"].includes(module.kind) && (
          <PageContentEditor
            key={module.id}
            module={module}
            modules={modules}
          />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={update.isPending}>
            {t("common.save")}
          </Button>
          {!module.isCore && form.status !== "disabled" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={update.isPending}
              className="border-rose-300/60 text-rose-600 hover:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300"
              onClick={() =>
                update.mutate(
                  { id: module.id, status: "disabled" },
                  {
                    onSuccess: () => {
                      toast.success(t("superadmin.modules.disabledToast"));
                      onClose();
                    },
                    onError,
                  },
                )
              }
            >
              {t("superadmin.modules.disable")}
            </Button>
          )}
          <Link
            to={catalogHref(module.key)}
            className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowUpRight className="mr-1.5 h-4 w-4" />
            {t("superadmin.modules.openInApp")}
          </Link>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          {t("superadmin.modules.deleteNote")}
        </p>
      </form>
    </Modal>
  );
}

/**
 * Offered right after an entry is registered, so publishing the feature and
 * announcing it are one flow. "Save for testing" keeps it as a draft in the
 * Announcements tab until the operator publishes it from there.
 */
function FeatureAnnouncementModal({
  module,
  onClose,
  onShowNotifications,
}: {
  module: AppModuleRow;
  onClose: () => void;
  onShowNotifications: () => void;
}) {
  const { t } = useTranslation();
  const create = useCreateNotification();
  const onError = useMutationError();
  const kindName = t(`superadmin.modules.kinds.${module.kind}`).toLowerCase();
  const [title, setTitle] = useState(
    t("superadmin.modules.announce.defaultTitle", { name: module.name }),
  );
  const [body, setBody] = useState(
    module.description?.trim() ||
      t("superadmin.modules.announce.defaultBody", {
        name: module.name,
        kind: kindName,
      }),
  );
  const [level, setLevel] = useState<AppNotificationRow["level"]>(
    module.status === "beta" ? "info" : "success",
  );
  const [audience] = useState<AppNotificationRow["audience"]>("all");

  const invalid = title.trim().length < 3 || body.trim().length < 3;

  const submit = (published: boolean) => {
    create.mutate(
      { title: title.trim(), body: body.trim(), level, audience, published },
      {
        onSuccess: () => {
          toast.success(t("superadmin.modules.announce.created"));
          onClose();
          onShowNotifications();
        },
        onError,
      },
    );
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t("superadmin.modules.announce.title")}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(true);
        }}
        className="space-y-3"
      >
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {t("superadmin.modules.announce.hint", {
            name: module.name,
            kind: kindName,
          })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
            {t(`superadmin.modules.kinds.${module.kind}`)}
          </span>
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
            {module.key}
          </code>
          <span className="rounded-full border border-amber-400/40 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-300">
            {t(`superadmin.modules.status.${module.status}`)}
          </span>
        </div>

        <div className="space-y-1">
          <Label htmlFor="announce-title">
            {t("superadmin.notifications.title")}
          </Label>
          <Input
            id="announce-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={140}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="announce-body">
            {t("superadmin.notifications.body")}
          </Label>
          <textarea
            id="announce-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            maxLength={4000}
            required
            className={`${formSelectClass} h-auto py-2`}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="announce-level">
              {t("superadmin.notifications.level")}
            </Label>
            <select
              id="announce-level"
              value={level}
              onChange={(event) =>
                setLevel(event.target.value as AppNotificationRow["level"])
              }
              className={formSelectClass}
            >
              {(["info", "success", "warning", "critical"] as const).map(
                (value) => (
                  <option key={value} value={value}>
                    {t(`superadmin.notifications.levels.${value}`)}
                  </option>
                ),
              )}
            </select>
          </div>
          {/* Audience selector omitted while every account shares one tier. */}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={create.isPending || invalid}
          >
            <Send className="mr-1.5 h-4 w-4" />
            {t("superadmin.modules.announce.publish")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={create.isPending || invalid}
            onClick={() => submit(false)}
          >
            {t("superadmin.modules.announce.draft")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t("superadmin.modules.announce.skip")}
          </Button>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          {t("superadmin.modules.announce.draftHint")}
        </p>
      </form>
    </Modal>
  );
}

function ModulesTab({
  onShowNotifications,
}: {
  onShowNotifications: () => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = useAppModules();
  const create = useCreateAppModule();
  const onError = useMutationError();
  const [form, setForm] = useState<ModuleForm>(emptyModuleForm);
  const [selected, setSelected] = useState<AppModuleRow | null>(null);
  const [announcementFor, setAnnouncementFor] = useState<AppModuleRow | null>(
    null,
  );

  const parentKinds = parentKindsFor(form.kind);
  const parentOptions = (data ?? []).filter((module) =>
    parentKinds.includes(module.kind),
  );

  // A refresh (rename, disable) should update the open editor instead of
  // leaving a stale copy from the click.
  const activeModule = selected
    ? data?.find((module) => module.id === selected.id) ?? selected
    : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      {
        key: form.key.trim().toLowerCase(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        kind: form.kind,
        category: form.category.trim() || undefined,
        version: form.version.trim() || undefined,
        status: form.status,
        parentKey: parentKinds.length ? form.parentKey || undefined : undefined,
      },
      {
        onSuccess: (created) => {
          setForm(emptyModuleForm());
          toast.success(t("superadmin.modules.created"));
          // Right after registering, offer the matching announcement so the
          // people who get the feature hear about it in the same flow.
          setAnnouncementFor(created);
        },
        onError,
      },
    );
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className={`${panel} space-y-3`}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          {t("superadmin.modules.add")}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="module-name">{t("superadmin.modules.name")}</Label>
            <Input
              id="module-name"
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              placeholder={t("superadmin.modules.namePlaceholder")}
              required
              maxLength={120}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="module-key">{t("superadmin.modules.key")}</Label>
            <Input
              id="module-key"
              value={form.key}
              onChange={(event) =>
                setForm({ ...form, key: event.target.value })
              }
              placeholder="reports-monthly"
              required
              pattern="[a-z0-9][a-z0-9-]*"
              maxLength={80}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="module-kind">{t("superadmin.modules.kind")}</Label>
            <select
              id="module-kind"
              value={form.kind}
              onChange={(event) =>
                setForm({
                  ...form,
                  kind: event.target.value as AppModuleRow["kind"],
                  parentKey: "",
                })
              }
              className={formSelectClass}
            >
              {MODULE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t(`superadmin.modules.kinds.${kind}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="module-status">
              {t("superadmin.modules.statusLabel")}
            </Label>
            <select
              id="module-status"
              value={form.status}
              onChange={(event) =>
                setForm({
                  ...form,
                  status: event.target.value as AppModuleRow["status"],
                })
              }
              className={formSelectClass}
            >
              {MODULE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`superadmin.modules.status.${status}`)}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t(`superadmin.modules.statusHints.${form.status}`)}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="module-category">
              {t("superadmin.modules.category")}
            </Label>
            <Input
              id="module-category"
              value={form.category}
              onChange={(event) =>
                setForm({ ...form, category: event.target.value })
              }
              placeholder="reports"
              maxLength={40}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="module-version">
              {t("superadmin.modules.version")}
            </Label>
            <Input
              id="module-version"
              value={form.version}
              onChange={(event) =>
                setForm({ ...form, version: event.target.value })
              }
              placeholder="1.0.0"
              maxLength={20}
            />
          </div>
          {parentKinds.length > 0 && (
            <div className="sm:col-span-2">
              <ParentField
                id="module-parent"
                value={form.parentKey}
                options={parentOptions}
                onChange={(parentKey) => setForm({ ...form, parentKey })}
              />
            </div>
          )}
          <div className="space-y-1 sm:col-span-2 lg:col-span-4">
            <Label htmlFor="module-description">
              {t("superadmin.modules.description")}
            </Label>
            <textarea
              id="module-description"
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              rows={2}
              maxLength={600}
              className={`${formSelectClass} h-auto py-2`}
            />
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t("superadmin.modules.kindsHelp")}
        </p>
        <Button type="submit" disabled={create.isPending}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("common.create")}
        </Button>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t("superadmin.modules.visibleHint")}
        </p>
      </form>

      <div className={panel}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t("superadmin.modules.registered")}
          </h3>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {data?.length ?? 0}
          </span>
        </div>
        {isLoading ? (
          <Loader />
        ) : !data?.length ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("superadmin.modules.empty")}
          </p>
        ) : (
          data.map((module) => (
            <ModuleRowItem
              key={module.id}
              module={module}
              onOpen={setSelected}
            />
          ))
        )}
      </div>

      {activeModule && (
        <ModuleEditModal
          module={activeModule}
          modules={data ?? []}
          onClose={() => setSelected(null)}
        />
      )}

      {announcementFor && (
        <FeatureAnnouncementModal
          module={announcementFor}
          onClose={() => setAnnouncementFor(null)}
          onShowNotifications={onShowNotifications}
        />
      )}
    </div>
  );
}

/**
 * What Finny would actually do with the keys below, resolved by the API on
 * every prompt. Makes the failover visible instead of leaving the operator to
 * infer it from priority numbers and error lines.
 */
function FinnyStatusNotice() {
  const { t } = useTranslation();
  const { data, isLoading, isFetching, refetch } = useFinnyStatus();

  const available = data?.available ?? false;
  const dot = isLoading
    ? "bg-slate-400"
    : available
    ? "bg-emerald-400"
    : "bg-rose-400";
  const tone = isLoading
    ? "border-slate-300/70 bg-slate-500/5"
    : available
    ? "border-emerald-500/30 bg-emerald-500/10"
    : "border-rose-500/30 bg-rose-500/10";

  const headline = isLoading
    ? t("superadmin.providerKeys.status.checking")
    : available
    ? t("superadmin.providerKeys.status.available", { key: data?.firstKey })
    : data?.reason === "FINNY_NOT_CONFIGURED"
    ? t("superadmin.providerKeys.status.notConfigured")
    : data?.reason === "FINNY_INVALID_KEY"
    ? t("superadmin.providerKeys.status.rejected")
    : t("superadmin.providerKeys.status.failing");

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${tone}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
          {headline}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="ml-auto inline-flex items-center gap-1 text-[10px] underline-offset-2 hover:underline disabled:opacity-40"
        >
          <RefreshCw className="h-3 w-3" />
          {t("superadmin.providerKeys.status.refresh")}
        </button>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
        {t("superadmin.providerKeys.status.explain")}
      </p>
    </div>
  );
}

function ProviderKeysSection() {
  const { t } = useTranslation();
  const { data, isLoading } = useProviderKeys();
  const create = useCreateProviderKey();
  const update = useUpdateProviderKey();
  const remove = useDeleteProviderKey();
  const onError = useMutationError();
  const [label, setLabel] = useState("");
  const [keyValue, setKeyValue] = useState("");
  const [priority, setPriority] = useState("0");
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      {
        label: label.trim(),
        key: keyValue.trim(),
        priority: Number(priority) || 0,
      },
      {
        onSuccess: () => {
          setLabel("");
          setKeyValue("");
          setPriority("0");
          toast.success(t("superadmin.providerKeys.created"));
        },
        onError,
      },
    );
  };

  const copy = async (row: ProviderKeyRow) => {
    if (!row.key) return;
    try {
      await navigator.clipboard.writeText(row.key);
      toast.success(t("superadmin.providerKeys.copied"));
    } catch {
      toast.error(t("superadmin.error"));
    }
  };

  return (
    <section className={`${panel} space-y-4`}>
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          {t("superadmin.providerKeys.title")}
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {t("superadmin.providerKeys.hint")}
        </p>
      </div>

      <FinnyStatusNotice />

      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="provider-key-label">
              {t("superadmin.providerKeys.label")}
            </Label>
            <Input
              id="provider-key-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={t("superadmin.providerKeys.labelPlaceholder")}
              required
              maxLength={80}
            />
          </div>
          <div className="space-y-1 lg:col-span-2">
            <Label htmlFor="provider-key-value">
              {t("superadmin.providerKeys.key")}
            </Label>
            <Input
              id="provider-key-value"
              type="password"
              value={keyValue}
              onChange={(event) => setKeyValue(event.target.value)}
              placeholder="sk-..."
              required
              autoComplete="off"
              minLength={8}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="provider-key-priority">
              {t("superadmin.providerKeys.priority")}
            </Label>
            <Input
              id="provider-key-priority"
              type="number"
              min={0}
              max={999}
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t("superadmin.providerKeys.priorityHint")}
            </p>
          </div>
        </div>
        <Button type="submit" disabled={create.isPending}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("superadmin.providerKeys.add")}
        </Button>
      </form>

      <div>
        {isLoading ? (
          <Loader />
        ) : !data?.length ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("superadmin.providerKeys.empty")}
          </p>
        ) : (
          data.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-start gap-3 border-t border-slate-200/70 py-3 first:border-t-0 dark:border-white/[0.06]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {row.label}
                  </span>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                    {row.provider}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {t("superadmin.providerKeys.order", {
                      order: row.priority,
                    })}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <code className="max-w-full truncate rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                    {row.key
                      ? revealed[row.id]
                        ? row.key
                        : `${row.provider === "openai" ? "sk-" : ""}••••••••${
                            row.lastFour
                          }`
                      : t("superadmin.providerKeys.undecryptable")}
                  </code>
                  <button
                    type="button"
                    onClick={() =>
                      setRevealed((previous) => ({
                        ...previous,
                        [row.id]: !previous[row.id],
                      }))
                    }
                    className="rounded-md p-1 text-slate-400 transition-colors hover:text-teal-600 dark:hover:text-teal-300"
                    title={t("superadmin.providerKeys.reveal")}
                  >
                    {revealed[row.id] ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(row)}
                    disabled={!row.key}
                    className="text-[10px] underline-offset-2 hover:underline disabled:opacity-40"
                  >
                    {t("superadmin.apiKeys.copy")}
                  </button>
                </div>
                {row.lastError && (
                  <p className="mt-1 line-clamp-2 text-[10px] text-rose-500 dark:text-rose-400">
                    {row.lastError}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {row.isActive
                    ? t("superadmin.providerKeys.active")
                    : t("superadmin.providerKeys.inactive")}
                </span>
                <Switch
                  checked={row.isActive}
                  disabled={update.isPending}
                  onChange={(checked) =>
                    update.mutate(
                      { id: row.id, isActive: checked },
                      { onError },
                    )
                  }
                  aria-label={t("superadmin.providerKeys.toggle")}
                />
                <button
                  type="button"
                  onClick={() => remove.mutate(row.id, { onError })}
                  disabled={remove.isPending}
                  title={t("common.delete")}
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function ApiKeysTab() {
  const { t } = useTranslation();
  const { data, isLoading } = useApiKeys();
  const create = useCreateApiKey();
  const revoke = useRevokeApiKey();
  const remove = useDeleteApiKey();
  const onError = useMutationError();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState("");
  const [secret, setSecret] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      {
        name: name.trim(),
        scopes: scopes
          .split(",")
          .map((scope) => scope.trim())
          .filter(Boolean),
      },
      {
        onSuccess: (key) => {
          // Shown once by design: only the hash is stored server-side.
          setSecret(key.secret);
          setName("");
          setScopes("");
          toast.success(t("superadmin.apiKeys.created"));
        },
        onError,
      },
    );
  };

  const copySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      toast.success(t("superadmin.apiKeys.copied"));
    } catch {
      toast.error(t("superadmin.error"));
    }
  };

  const keyState = (key: AppApiKeyRow) =>
    key.revokedAt
      ? t("superadmin.apiKeys.revoked")
      : t("superadmin.apiKeys.active");

  return (
    <div className="space-y-6">
      <ProviderKeysSection />
      <form onSubmit={submit} className={`${panel} space-y-3`}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          {t("superadmin.apiKeys.add")}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="api-key-name">{t("superadmin.apiKeys.name")}</Label>
            <Input
              id="api-key-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Reporting pipeline"
              required
              maxLength={100}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="api-key-scopes">
              {t("superadmin.apiKeys.scopes")}
            </Label>
            <Input
              id="api-key-scopes"
              value={scopes}
              onChange={(event) => setScopes(event.target.value)}
              placeholder={t("superadmin.apiKeys.scopesHint")}
            />
          </div>
        </div>
        <Button type="submit" disabled={create.isPending}>
          <KeyRound className="mr-1.5 h-4 w-4" />
          {t("superadmin.apiKeys.create")}
        </Button>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t("superadmin.apiKeys.hint")}
        </p>
      </form>

      {secret && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
            {t("superadmin.apiKeys.secretTitle")}
          </p>
          <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-200/80">
            {t("superadmin.apiKeys.secretHint")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-white/70 px-2 py-1.5 text-xs text-slate-800 dark:bg-black/30 dark:text-slate-100">
              {secret}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copySecret}
            >
              {t("superadmin.apiKeys.copy")}
            </Button>
          </div>
        </div>
      )}

      <div className={panel}>
        {isLoading ? (
          <Loader />
        ) : !data?.length ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("superadmin.apiKeys.empty")}
          </p>
        ) : (
          data.map((key) => (
            <div
              key={key.id}
              className="flex flex-wrap items-center gap-3 border-t border-slate-200/70 py-3 first:border-t-0 dark:border-white/[0.06]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                  {key.name}
                </p>
                <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                  {key.prefix}…
                  {key.scopes?.length ? ` · ${key.scopes.join(", ")}` : ""}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  key.revokedAt
                    ? "bg-rose-500/10 text-rose-500"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {keyState(key)}
              </span>
              {!key.revokedAt && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(key.id, { onError })}
                >
                  {t("superadmin.apiKeys.revoke")}
                </Button>
              )}
              <button
                type="button"
                onClick={() => remove.mutate(key.id, { onError })}
                title={t("common.delete")}
                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NotificationRowItem({
  notification,
}: {
  notification: AppNotificationRow;
}) {
  const { t } = useTranslation();
  const update = useUpdateNotification();
  const remove = useDeleteNotification();
  const onError = useMutationError();

  const scheduledUntil =
    notification.published &&
    notification.publishedAt &&
    new Date(notification.publishedAt).getTime() > Date.now()
      ? notification.publishedAt
      : null;

  return (
    <div className="flex flex-wrap items-start gap-3 border-t border-slate-200/70 py-3 first:border-t-0 dark:border-white/[0.06]">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-900 dark:text-white">
            {notification.title}
          </span>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
            {t(`superadmin.notifications.levels.${notification.level}`)}
          </span>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
            {t(`superadmin.notifications.audiences.${notification.audience}`)}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
          {notification.body}
        </p>
        {scheduledUntil && (
          <p className="mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
            {t("superadmin.notifications.scheduledFor", {
              date: new Date(scheduledUntil).toLocaleString(),
            })}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {scheduledUntil
            ? t("superadmin.notifications.scheduled")
            : notification.published
            ? t("superadmin.notifications.published")
            : t("superadmin.notifications.draft")}
        </span>
        <Switch
          checked={notification.published}
          disabled={update.isPending}
          onChange={(checked) =>
            update.mutate(
              { id: notification.id, published: checked },
              { onError },
            )
          }
          aria-label={t("superadmin.notifications.publish")}
        />
        <button
          type="button"
          onClick={() => remove.mutate(notification.id, { onError })}
          title={t("common.delete")}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const { t } = useTranslation();
  const { data, isLoading } = useNotifications();
  const create = useCreateNotification();
  const onError = useMutationError();
  const [form, setForm] = useState<{
    title: string;
    body: string;
    level: AppNotificationRow["level"];
    audience: AppNotificationRow["audience"];
    publishAt: string;
  }>({
    title: "",
    body: "",
    level: "info",
    audience: "all",
    publishAt: "",
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      {
        title: form.title.trim(),
        body: form.body.trim(),
        level: form.level,
        audience: form.audience,
        // No date = draft. With a date the backend publishes it with that
        // timestamp and the app shows it as soon as its window opens.
        published: Boolean(form.publishAt),
        publishAt: form.publishAt
          ? new Date(form.publishAt).toISOString()
          : undefined,
      },
      {
        onSuccess: () => {
          setForm({
            title: "",
            body: "",
            level: "info",
            audience: "all",
            publishAt: "",
          });
          toast.success(t("superadmin.notifications.created"));
        },
        onError,
      },
    );
  };

  const selectClass =
    "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className={`${panel} space-y-3`}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          {t("superadmin.notifications.add")}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="notification-title">
              {t("superadmin.notifications.title")}
            </Label>
            <Input
              id="notification-title"
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
              maxLength={140}
              required
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="notification-body">
              {t("superadmin.notifications.body")}
            </Label>
            <textarea
              id="notification-body"
              value={form.body}
              onChange={(event) =>
                setForm({ ...form, body: event.target.value })
              }
              rows={3}
              maxLength={4000}
              required
              className={`${selectClass} h-auto py-2`}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="notification-level">
              {t("superadmin.notifications.level")}
            </Label>
            <select
              id="notification-level"
              value={form.level}
              onChange={(event) =>
                setForm({
                  ...form,
                  level: event.target.value as AppNotificationRow["level"],
                })
              }
              className={selectClass}
            >
              {(["info", "success", "warning", "critical"] as const).map(
                (level) => (
                  <option key={level} value={level}>
                    {t(`superadmin.notifications.levels.${level}`)}
                  </option>
                ),
              )}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="notification-publish-at">
              {t("superadmin.notifications.schedule")}
            </Label>
            <Input
              id="notification-publish-at"
              type="datetime-local"
              value={form.publishAt}
              onChange={(event) =>
                setForm({ ...form, publishAt: event.target.value })
              }
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("superadmin.notifications.scheduleHint")}
            </p>
          </div>
        </div>
        <Button type="submit" disabled={create.isPending}>
          <Send className="mr-1.5 h-4 w-4" />
          {t("common.create")}
        </Button>
      </form>

      <div className={panel}>
        {isLoading ? (
          <Loader />
        ) : !data?.length ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("superadmin.notifications.empty")}
          </p>
        ) : (
          data.map((notification) => (
            <NotificationRowItem
              key={notification.id}
              notification={notification}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Superadmin backoffice.
 *
 * Scope is the product itself — modules, API keys, announcements and aggregate
 * usage. There is deliberately no user list or per-account data anywhere here.
 */
export default function SuperAdminBackofficePage() {
  const { t } = useTranslation();
  // Controlled so the module flow can hand control to the announcements tab
  // right after an announcement is created.
  const [tab, setTab] = useState("overview");

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15 text-teal-600 ring-1 ring-inset ring-teal-500/25 dark:bg-teal-400/10 dark:text-teal-300">
          <Building className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {t("superadmin.title")}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t("superadmin.subtitle")}
          </p>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">
            {t("superadmin.tabs.overview")}
          </TabsTrigger>
          <TabsTrigger value="modules">
            {t("superadmin.tabs.modules")}
          </TabsTrigger>
          <TabsTrigger value="api-keys">
            {t("superadmin.tabs.apiKeys")}
          </TabsTrigger>
          <TabsTrigger value="notifications">
            {t("superadmin.tabs.notifications")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="modules">
          <ModulesTab onShowNotifications={() => setTab("notifications")} />
        </TabsContent>
        <TabsContent value="api-keys">
          <ApiKeysTab />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
