import api from "@infrastructure/api.config";

export type CatalogEntryKind =
  | "module"
  | "component"
  | "integration"
  | "page"
  | "tab";

export type CatalogEntryStatus = "active" | "beta" | "disabled";

/** One placed block of a page: `type` selects the renderer, `props` the copy. */
export interface CatalogBlock {
  id: string;
  type: string;
  props: Record<string, unknown>;
}

/** One authored section: heading, text, blocks and attached components. */
export interface CatalogSection {
  id: string;
  title: string;
  body: string;
  blocks?: CatalogBlock[];
  componentKeys: string[];
}

export interface CatalogContent {
  sections: CatalogSection[];
}

/**
 * One catalogue entry as the app sees it. Same row the backoffice authors,
 * already filtered by role server-side: regular accounts only get `active`
 * entries, the superadmin also gets `beta` and `disabled` ones for preview.
 */
export interface CatalogEntry {
  id: number;
  key: string;
  name: string;
  description: string | null;
  kind: CatalogEntryKind;
  category: string;
  status: CatalogEntryStatus;
  version: string;
  parentKey: string | null;
  sortOrder: number;
  isCore: boolean;
  /** Copy authored in the backoffice; null means "no content yet". */
  content: CatalogContent | null;
  createdAt: string;
  updatedAt: string;
}

export const HttpCatalogRepository = {
  async getEntries(): Promise<CatalogEntry[]> {
    const { data } = await api.get("/catalog/entries");
    return data;
  },
};
