import {
  AppApiKeyRow,
  ProviderKeyRow,
} from "@adapters/http/superadmin.repository";
import {
  useApiKeys,
  useCreateApiKey,
  useCreateProviderKey,
  useDeleteApiKey,
  useDeleteProviderKey,
  useFinnyStatus,
  useProviderKeys,
  useRevokeApiKey,
  useUpdateProviderKey,
} from "@adapters/query/superadmin";
import Loader from "@presentation/components/loader";
import {
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  RefreshCw,
  Trash2,
} from "@presentation/components/ui/animated-icons";
import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { Switch } from "@presentation/components/ui/switch";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { panel, useMutationError } from "./shared";

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

export function ApiKeysTab() {
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
