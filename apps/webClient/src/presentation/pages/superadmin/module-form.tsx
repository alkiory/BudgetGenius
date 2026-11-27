import { AppModuleRow } from "@adapters/http/superadmin.repository";
import { Label } from "@presentation/components/ui/label";
import { useTranslation } from "react-i18next";
import { formSelectClass } from "./shared";

export const MODULE_KINDS: AppModuleRow["kind"][] = [
  "module",
  "component",
  "integration",
  "page",
  "tab",
];

export const MODULE_STATUSES: AppModuleRow["status"][] = [
  "active",
  "beta",
  "disabled",
];

/**
 * Where an entry can live: components and pages inside a module, tabs inside
 * a page. A module or integration stands on its own.
 */
export const parentKindsFor = (
  kind: AppModuleRow["kind"],
): AppModuleRow["kind"][] => {
  if (kind === "component" || kind === "page") return ["module"];
  if (kind === "tab") return ["page"];
  return [];
};

export type ModuleForm = {
  key: string;
  name: string;
  description: string;
  kind: AppModuleRow["kind"];
  category: string;
  version: string;
  status: AppModuleRow["status"];
  parentKey: string;
};

export const emptyModuleForm = (): ModuleForm => ({
  key: "",
  name: "",
  description: "",
  kind: "module",
  category: "",
  version: "",
  status: "active",
  parentKey: "",
});

export function ParentField({
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
