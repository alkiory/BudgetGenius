import api from "@infrastructure/api.config";

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
  modules: { total: number; active: number; disabled: number };
  apiKeys: { total: number; active: number };
  notifications: { total: number; live: number };
  activity: Array<{ month: string; transactions: number; amount: number }>;
}

export type AppModuleStatus = "active" | "beta" | "disabled";
export type AppModuleKind = "module" | "component" | "integration";

export interface AppModuleRow {
  id: number;
  key: string;
  name: string;
  description: string | null;
  kind: AppModuleKind;
  category: string;
  status: AppModuleStatus;
  version: string;
  sortOrder: number;
  isCore: boolean;
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
  async deleteModule(id: number): Promise<void> {
    await api.delete(`/superadmin/modules/${id}`);
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
      >
    >,
  ): Promise<AppNotificationRow> {
    const { data } = await api.put(`/superadmin/notifications/${id}`, payload);
    return data;
  },
  async deleteNotification(id: number): Promise<void> {
    await api.delete(`/superadmin/notifications/${id}`);
  },
};
