import api from "@infrastructure/api.config";

export type ModuleKind = "module" | "component" | "integration";

export interface CatalogModule {
  id: number;
  key: string;
  name: string;
  description: string | null;
  kind: ModuleKind;
  category: string;
  status: "active" | "beta";
  version: string;
  /** Key of the parent module for a component; `null` when standalone. */
  parentKey: string | null;
}

/** Active catalogue entries, excluding anything disabled in the backoffice. */
export const HttpModulesRepository = {
  async getVisible(): Promise<CatalogModule[]> {
    const { data } = await api.get("/modules");
    return data;
  },
};
