import api, { LONG_REQUEST_TIMEOUT_MS } from "@infrastructure/api.config";

/** Aggregate usage returned by `GET /superadmin/overview`. No user rows. */
export interface SuperAdminOverview {
  users: { total: number; last7d: number; last30d: number };
  transactions: {
    total: number;
    last24h: number;
    last7d: number;
    last30d: number;
  };
  data: { budgets: number; categories: number };
  modules: {
    total: number;
    active: number;
    disabled: number;
    byKind: {
      module: number;
      component: number;
      integration: number;
      page: number;
      tab: number;
    };
  };
  apiKeys: { total: number; active: number };
  notifications: { total: number; live: number };
  activity: Array<{ month: string; transactions: number; amount: number }>;
}

export type AppModuleStatus = "active" | "beta" | "disabled";
export type AppModuleKind =
  | "module"
  | "component"
  | "integration"
  | "page"
  | "tab";

/** One placed content block: `type` picks the renderer, `props` is the form. */
export interface AppModuleBlock {
  id: string;
  type: string;
  props: Record<string, unknown>;
}

/** One authored section: optional heading and text, blocks and components. */
export interface AppModuleSection {
  id: string;
  title: string;
  body: string;
  /** Ready-made UI blocks, in render order. */
  blocks?: AppModuleBlock[];
  /** `key`s of `component` entries rendered inside the section. */
  componentKeys: string[];
}

export type BlockFieldInput = "text" | "textarea" | "url" | "select" | "image";

/** Field the backoffice renders for a block; mirrors the API registry. */
export interface BlockFieldSchema {
  name: string;
  input: BlockFieldInput;
  required?: boolean;
  maxLength?: number;
  options?: Array<{ value: string; labelKey: string }>;
}

/** One block type the operator can place, with the form it needs. */
export interface BlockTypeSchema {
  type: string;
  fields: BlockFieldSchema[];
  items?: { max: number; fields: BlockFieldSchema[] };
}

/** Body of a page, module or tab, authored from the backoffice. */
export interface AppModuleContent {
  sections: AppModuleSection[];
}

export interface AppModuleRow {
  id: number;
  key: string;
  name: string;
  description: string | null;
  kind: AppModuleKind;
  category: string;
  status: AppModuleStatus;
  version: string;
  /** Key of the parent module when this entry is a component. */
  parentKey: string | null;
  sortOrder: number;
  isCore: boolean;
  /** Authored copy; null until the page is edited in the backoffice. */
  content: AppModuleContent | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppApiKeyRow {
  id: number;
  name: string;
  prefix: string;
  scopes: string[] | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderKeyRow {
  id: number;
  label: string;
  provider: string;
  /** Decrypted value; only the superadmin endpoints return it. */
  key: string | null;
  lastFour: string;
  isActive: boolean;
  priority: number;
  lastUsedAt: string | null;
  lastFailedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `GET /ai/status`: whether Finny has a credential it can use right now. */
export interface FinnyStatusRow {
  available: boolean;
  reason:
    | "FINNY_NOT_CONFIGURED"
    | "FINNY_INVALID_KEY"
    | "FINNY_PROVIDER_ERROR"
    | null;
  /** Active credentials in the order they would be tried. */
  activeKeys: number;
  /** The credential the next prompt would use, when one is healthy. */
  firstKey: string | null;
  checkedAt: string;
}

export interface AppNotificationRow {
  id: number;
  title: string;
  body: string;
  level: "info" | "success" | "warning" | "critical";
  audience: "all" | "free" | "premium";
  published: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateModulePayload = {
  key: string;
  name: string;
  kind?: AppModuleKind;
  category?: string;
  version?: string;
  description?: string;
  status?: AppModuleStatus;
  /** Key of the module a component belongs to; empty clears it. */
  parentKey?: string;
};

export const superAdminRepository = {
  async getOverview(): Promise<SuperAdminOverview> {
    const { data } = await api.get("/superadmin/overview");
    return data;
  },

  async listModules(): Promise<AppModuleRow[]> {
    const { data } = await api.get("/superadmin/modules");
    return data;
  },
  async createModule(payload: CreateModulePayload): Promise<AppModuleRow> {
    const { data } = await api.post("/superadmin/modules", payload);
    return data;
  },
  async updateModule(
    id: number,
    payload: Partial<CreateModulePayload>,
  ): Promise<AppModuleRow> {
    const { data } = await api.put(`/superadmin/modules/${id}`, payload);
    return data;
  },
  /** Replaces the whole body (sections, texts, attached components). */
  async updateModuleContent(
    id: number,
    content: AppModuleContent,
  ): Promise<AppModuleRow> {
    const { data } = await api.put(
      `/superadmin/modules/${id}/content`,
      content,
    );
    return data;
  },
  /** One call for the whole sibling list, so a reorder never lands halfway. */
  async reorderModules(keys: string[]): Promise<AppModuleRow[]> {
    const { data } = await api.put("/superadmin/modules/reorder", { keys });
    return data;
  },
  /** Palette for the page composer, validated by the same registry. */
  async listBlockTypes(): Promise<BlockTypeSchema[]> {
    const { data } = await api.get("/superadmin/modules/block-types");
    return data;
  },
  /** Picked file as a data URL; the API stores it and returns its path. */
  async uploadImage(dataUrl: string): Promise<{ url: string }> {
    const { data } = await api.post(
      "/media",
      { dataUrl },
      {
        timeout: LONG_REQUEST_TIMEOUT_MS,
      },
    );
    return data;
  },

  async listApiKeys(): Promise<AppApiKeyRow[]> {
    const { data } = await api.get("/superadmin/api-keys");
    return data;
  },
  /** The returned `secret` is the only copy that will ever exist. */
  async createApiKey(payload: {
    name: string;
    scopes?: string[];
  }): Promise<AppApiKeyRow & { secret: string }> {
    const { data } = await api.post("/superadmin/api-keys", payload);
    return data;
  },
  async revokeApiKey(id: number): Promise<AppApiKeyRow> {
    const { data } = await api.post(`/superadmin/api-keys/${id}/revoke`);
    return data;
  },
  async deleteApiKey(id: number): Promise<void> {
    await api.delete(`/superadmin/api-keys/${id}`);
  },

  async listProviderKeys(): Promise<ProviderKeyRow[]> {
    const { data } = await api.get("/superadmin/provider-keys");
    return data;
  },
  async createProviderKey(payload: {
    label: string;
    key: string;
    priority?: number;
    provider?: string;
  }): Promise<ProviderKeyRow> {
    const { data } = await api.post("/superadmin/provider-keys", payload);
    return data;
  },
  async updateProviderKey(
    id: number,
    payload: Partial<{
      label: string;
      key: string;
      priority: number;
      provider: string;
      isActive: boolean;
    }>,
  ): Promise<ProviderKeyRow> {
    const { data } = await api.put(`/superadmin/provider-keys/${id}`, payload);
    return data;
  },
  async deleteProviderKey(id: number): Promise<void> {
    await api.delete(`/superadmin/provider-keys/${id}`);
  },
  /** Operator readiness: includes labels the public `/ai/status` hides. */
  async getFinnyStatus(): Promise<FinnyStatusRow> {
    const { data } = await api.get("/superadmin/provider-keys/status");
    return data;
  },

  async listNotifications(): Promise<AppNotificationRow[]> {
    const { data } = await api.get("/superadmin/notifications");
    return data;
  },
  async createNotification(payload: {
    title: string;
    body: string;
    level?: AppNotificationRow["level"];
    audience?: AppNotificationRow["audience"];
    published?: boolean;
    /** ISO timestamp: publish at this moment instead of immediately. */
    publishAt?: string;
    /** ISO timestamp: retire the announcement automatically. */
    expiresAt?: string;
  }): Promise<AppNotificationRow> {
    const { data } = await api.post("/superadmin/notifications", payload);
    return data;
  },
  async updateNotification(
    id: number,
    payload: Partial<
      Pick<
        AppNotificationRow,
        "title" | "body" | "level" | "audience" | "published"
      > & { publishAt?: string; expiresAt?: string }
    >,
  ): Promise<AppNotificationRow> {
    const { data } = await api.put(`/superadmin/notifications/${id}`, payload);
    return data;
  },
  async deleteNotification(id: number): Promise<void> {
    await api.delete(`/superadmin/notifications/${id}`);
  },
};
