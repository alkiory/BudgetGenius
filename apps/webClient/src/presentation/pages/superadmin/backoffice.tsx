import {
  AppApiKeyRow,
  AppModuleRow,
  AppNotificationRow,
} from "@adapters/http/superadmin.repository";
import {
  useApiKeys,
  useAppModules,
  useCreateApiKey,
  useCreateAppModule,
  useCreateNotification,
  useDeleteApiKey,
  useDeleteAppModule,
  useDeleteNotification,
  useNotifications,
  useRevokeApiKey,
  useSuperAdminOverview,
  useUpdateAppModule,
  useUpdateNotification,
} from "@adapters/query/superadmin";
import Loader from "@presentation/components/loader";
import { Button } from "@presentation/components/ui/button";
import {
  BarChart3,
  Building,
  KeyRound,
  Plus,
  Send,
  Trash2,
} from "@presentation/components/ui/animated-icons";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { Switch } from "@presentation/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@presentation/components/ui/tabs";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

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
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{note}</p>
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
          value={`${number(data.modules.active)} / ${number(data.modules.total)}`}
          note={t("superadmin.overview.modulesNote", {
            count: number(data.modules.disabled),
          })}
        />
        <StatCard
          label={t("superadmin.overview.apiKeys")}
          value={`${number(data.apiKeys.active)} / ${number(data.apiKeys.total)}`}
          note={t("superadmin.overview.keysNote")}
        />
      </div>

      <div className={panel}>
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-teal-500 dark:text-teal-300" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t("superadmin.overview.activity")}
          </h3>
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
                <span className="w-14 shrink-0 text-right text-slate-500 dark:text-slate-400">
                  {number(row.transactions)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ModuleRowItem({ module }: { module: AppModuleRow }) {
  const { t } = useTranslation();
  const update = useUpdateAppModule();
  const remove = useDeleteAppModule();
  const onError = useMutationError();

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-slate-200/70 py-3 first:border-t-0 dark:border-white/[0.06]">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {t(`superadmin.modules.kinds.${module.kind}`)} · {module.category} ·
          v{module.version}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {t(`superadmin.modules.status.${module.status}`)}
        </span>
        <Switch
          checked={module.status !== "disabled"}
          disabled={module.isCore || update.isPending}
          onChange={(checked) =>
            update.mutate(
              { id: module.id, status: checked ? "active" : "disabled" },
              { onError },
            )
          }
          aria-label={t("superadmin.modules.toggle")}
        />
        <button
          type="button"
          onClick={() => remove.mutate(module.id, { onError })}
          disabled={module.isCore || remove.isPending}
          title={t("common.delete")}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ModulesTab() {
  const { t } = useTranslation();
  const { data, isLoading } = useAppModules();
  const create = useCreateAppModule();
  const onError = useMutationError();
  const [form, setForm] = useState<{
    key: string;
    name: string;
    kind: AppModuleRow["kind"];
    category: string;
  }>({ key: "", name: "", kind: "module", category: "" });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      {
        key: form.key.trim().toLowerCase(),
        name: form.name.trim(),
        kind: form.kind,
        category: form.category.trim() || undefined,
      },
      {
        onSuccess: () => {
          setForm({ key: "", name: "", kind: "module", category: "" });
          toast.success(t("superadmin.modules.created"));
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
            <Label htmlFor="module-kind">
              {t("superadmin.modules.kind")}
            </Label>
            <select
              id="module-kind"
              value={form.kind}
              onChange={(event) =>
                setForm({
                  ...form,
                  kind: event.target.value as AppModuleRow["kind"],
                })
              }
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {(["module", "component", "integration"] as const).map(
                (kind) => (
                  <option key={kind} value={kind}>
                    {t(`superadmin.modules.kinds.${kind}`)}
                  </option>
                ),
              )}
            </select>
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
        </div>
        <Button type="submit" disabled={create.isPending}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("common.create")}
        </Button>
      </form>

      <div className={panel}>
        {isLoading ? (
          <Loader />
        ) : !data?.length ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("superadmin.modules.empty")}
          </p>
        ) : (
          data.map((module) => (
            <ModuleRowItem key={module.id} module={module} />
          ))
        )}
      </div>
    </div>
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
      <form onSubmit={submit} className={`${panel} space-y-3`}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          {t("superadmin.apiKeys.add")}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="api-key-name">
              {t("superadmin.apiKeys.name")}
            </Label>
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
            <Button type="button" variant="outline" size="sm" onClick={copySecret}>
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
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {notification.published
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
  }>({ title: "", body: "", level: "info", audience: "all" });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      {
        title: form.title.trim(),
        body: form.body.trim(),
        level: form.level,
        audience: form.audience,
        published: false,
      },
      {
        onSuccess: () => {
          setForm({ title: "", body: "", level: "info", audience: "all" });
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
          <div className="space-y-1">
            <Label htmlFor="notification-audience">
              {t("superadmin.notifications.audience")}
            </Label>
            <select
              id="notification-audience"
              value={form.audience}
              onChange={(event) =>
                setForm({
                  ...form,
                  audience: event.target
                    .value as AppNotificationRow["audience"],
                })
              }
              className={selectClass}
            >
              {(["all", "free", "premium"] as const).map((audience) => (
                <option key={audience} value={audience}>
                  {t(`superadmin.notifications.audiences.${audience}`)}
                </option>
              ))}
            </select>
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

      <Tabs defaultValue="overview">
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
          <ModulesTab />
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
