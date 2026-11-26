import {
  AppModuleContent,
  AppNotificationRow,
  CreateModulePayload,
  superAdminRepository,
} from "@adapters/http/superadmin.repository";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const KEYS = {
  overview: ["superadmin", "overview"] as const,
  modules: ["superadmin", "modules"] as const,
  apiKeys: ["superadmin", "api-keys"] as const,
  providerKeys: ["superadmin", "provider-keys"] as const,
  /** Shared with the Finny rail: same endpoint, same cache entry. */
  finnyStatus: ["ai", "status"] as const,
  notifications: ["superadmin", "notifications"] as const,
  blockTypes: ["superadmin", "block-types"] as const,
};

/** Usage snapshot. Backoffice data changes rarely; a 30 s stale window is plenty. */
export function useSuperAdminOverview() {
  return useQuery({
    queryKey: KEYS.overview,
    queryFn: superAdminRepository.getOverview,
    staleTime: 30_000,
  });
}

export function useAppModules() {
  return useQuery({
    queryKey: KEYS.modules,
    queryFn: superAdminRepository.listModules,
  });
}

export function useCreateAppModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateModulePayload) =>
      superAdminRepository.createModule(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.modules });
      queryClient.invalidateQueries({ queryKey: KEYS.overview });
      // The sidebar and the catalogue page read this key: a new entry has to
      // show up in the app without a reload.
      queryClient.invalidateQueries({ queryKey: ["catalog", "entries"] });
    },
  });
}

export function useUpdateAppModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: Partial<CreateModulePayload> & { id: number }) =>
      superAdminRepository.updateModule(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.modules });
      queryClient.invalidateQueries({ queryKey: KEYS.overview });
      // Status changes, renames and re-parenting all change the app chrome.
      queryClient.invalidateQueries({ queryKey: ["catalog", "entries"] });
    },
  });
}

/** Everything a page edits touches: the inventory, the counts and the app. */
const invalidateCatalog = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: KEYS.modules });
  queryClient.invalidateQueries({ queryKey: KEYS.overview });
  queryClient.invalidateQueries({ queryKey: ["catalog", "entries"] });
};

export function useUpdateModuleContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: number; content: AppModuleContent }) =>
      superAdminRepository.updateModuleContent(id, content),
    onSuccess: () => invalidateCatalog(queryClient),
  });
}

export function useReorderAppModules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keys: string[]) => superAdminRepository.reorderModules(keys),
    onSuccess: () => invalidateCatalog(queryClient),
  });
}

/** Uploads a picked file and returns the URL the block stores. */
export function useUploadImage() {
  return useMutation({
    mutationFn: (dataUrl: string) => superAdminRepository.uploadImage(dataUrl),
  });
}

/** The palette is code, not data: it does not change while the tab is open. */
export function useBlockTypes() {
  return useQuery({
    queryKey: KEYS.blockTypes,
    queryFn: superAdminRepository.listBlockTypes,
    staleTime: Infinity,
  });
}

export function useApiKeys() {
  return useQuery({
    queryKey: KEYS.apiKeys,
    queryFn: superAdminRepository.listApiKeys,
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; scopes?: string[] }) =>
      superAdminRepository.createApiKey(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.apiKeys });
      queryClient.invalidateQueries({ queryKey: KEYS.overview });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => superAdminRepository.revokeApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.apiKeys });
      queryClient.invalidateQueries({ queryKey: KEYS.overview });
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => superAdminRepository.deleteApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.apiKeys });
      queryClient.invalidateQueries({ queryKey: KEYS.overview });
    },
  });
}

export function useProviderKeys() {
  return useQuery({
    queryKey: KEYS.providerKeys,
    queryFn: superAdminRepository.listProviderKeys,
  });
}

/** Which credential Finny would use for the next prompt. */
export function useFinnyStatus() {
  return useQuery({
    queryKey: KEYS.finnyStatus,
    queryFn: superAdminRepository.getFinnyStatus,
    staleTime: 30_000,
  });
}

export function useCreateProviderKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      label: string;
      key: string;
      priority?: number;
      provider?: string;
    }) => superAdminRepository.createProviderKey(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.providerKeys });
      queryClient.invalidateQueries({ queryKey: KEYS.finnyStatus });
    },
  });
}

export function useUpdateProviderKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: number;
      label?: string;
      key?: string;
      priority?: number;
      provider?: string;
      isActive?: boolean;
    }) => superAdminRepository.updateProviderKey(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.providerKeys });
      queryClient.invalidateQueries({ queryKey: KEYS.finnyStatus });
    },
  });
}

export function useDeleteProviderKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => superAdminRepository.deleteProviderKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.providerKeys });
      queryClient.invalidateQueries({ queryKey: KEYS.finnyStatus });
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: KEYS.notifications,
    queryFn: superAdminRepository.listNotifications,
  });
}

export function useCreateNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      title: string;
      body: string;
      level?: AppNotificationRow["level"];
      audience?: AppNotificationRow["audience"];
      published?: boolean;
      publishAt?: string;
      expiresAt?: string;
    }) => superAdminRepository.createNotification(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.notifications });
      queryClient.invalidateQueries({ queryKey: KEYS.overview });
      // The pinned banner reads this key: publishing from the backoffice
      // shows up in the operator's own app without waiting for the poll.
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}

export function useUpdateNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: { id: number } & Partial<
      Pick<
        AppNotificationRow,
        "title" | "body" | "level" | "audience" | "published"
      > & { publishAt?: string; expiresAt?: string }
    >) => superAdminRepository.updateNotification(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.notifications });
      queryClient.invalidateQueries({ queryKey: KEYS.overview });
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => superAdminRepository.deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.notifications });
      queryClient.invalidateQueries({ queryKey: KEYS.overview });
    },
  });
}
