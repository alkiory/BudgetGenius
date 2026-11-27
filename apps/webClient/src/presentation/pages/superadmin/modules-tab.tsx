import {
  AppModuleRow,
  AppNotificationRow,
} from "@adapters/http/superadmin.repository";
import {
  useAppModules,
  useCreateAppModule,
  useCreateNotification,
  useUpdateAppModule,
} from "@adapters/query/superadmin";
import Loader from "@presentation/components/loader";
import { Modal } from "@presentation/components/modal/modal";
import {
  ArrowUpRight,
  Pencil,
  Plus,
  Send,
} from "@presentation/components/ui/animated-icons";
import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { catalogHref } from "@presentation/utils/catalog";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ModuleEditModal } from "./module-edit-modal";
import {
  MODULE_KINDS,
  MODULE_STATUSES,
  ModuleForm,
  ParentField,
  emptyModuleForm,
  parentKindsFor,
} from "./module-form";
import { formSelectClass, panel, useMutationError } from "./shared";

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

export function ModulesTab({
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
