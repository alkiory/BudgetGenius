import { AppModuleRow } from "@adapters/http/superadmin.repository";
import { useUpdateAppModule } from "@adapters/query/superadmin";
import { Modal } from "@presentation/components/modal/modal";
import { ArrowUpRight } from "@presentation/components/ui/animated-icons";
import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { catalogHref } from "@presentation/utils/catalog";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import {
  MODULE_KINDS,
  MODULE_STATUSES,
  ModuleForm,
  ParentField,
  parentKindsFor,
} from "./module-form";
import { PageContentEditor } from "./page-content-editor";
import { formSelectClass, useMutationError } from "./shared";

export function ModuleEditModal({
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
