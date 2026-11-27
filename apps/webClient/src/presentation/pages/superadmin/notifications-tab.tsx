import { AppNotificationRow } from "@adapters/http/superadmin.repository";
import {
  useCreateNotification,
  useDeleteNotification,
  useNotifications,
  useUpdateNotification,
} from "@adapters/query/superadmin";
import Loader from "@presentation/components/loader";
import { Send, Trash2 } from "@presentation/components/ui/animated-icons";
import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { Switch } from "@presentation/components/ui/switch";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { panel, useMutationError } from "./shared";

function NotificationRowItem({
  notification,
}: {
  notification: AppNotificationRow;
}) {
  const { t } = useTranslation();
  const update = useUpdateNotification();
  const remove = useDeleteNotification();
  const onError = useMutationError();

  const scheduledUntil =
    notification.published &&
    notification.publishedAt &&
    new Date(notification.publishedAt).getTime() > Date.now()
      ? notification.publishedAt
      : null;

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
        {scheduledUntil && (
          <p className="mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
            {t("superadmin.notifications.scheduledFor", {
              date: new Date(scheduledUntil).toLocaleString(),
            })}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {scheduledUntil
            ? t("superadmin.notifications.scheduled")
            : notification.published
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

export function NotificationsTab() {
  const { t } = useTranslation();
  const { data, isLoading } = useNotifications();
  const create = useCreateNotification();
  const onError = useMutationError();
  const [form, setForm] = useState<{
    title: string;
    body: string;
    level: AppNotificationRow["level"];
    audience: AppNotificationRow["audience"];
    publishAt: string;
  }>({
    title: "",
    body: "",
    level: "info",
    audience: "all",
    publishAt: "",
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      {
        title: form.title.trim(),
        body: form.body.trim(),
        level: form.level,
        audience: form.audience,
        // No date = draft. With a date the backend publishes it with that
        // timestamp and the app shows it as soon as its window opens.
        published: Boolean(form.publishAt),
        publishAt: form.publishAt
          ? new Date(form.publishAt).toISOString()
          : undefined,
      },
      {
        onSuccess: () => {
          setForm({
            title: "",
            body: "",
            level: "info",
            audience: "all",
            publishAt: "",
          });
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
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="notification-publish-at">
              {t("superadmin.notifications.schedule")}
            </Label>
            <Input
              id="notification-publish-at"
              type="datetime-local"
              value={form.publishAt}
              onChange={(event) =>
                setForm({ ...form, publishAt: event.target.value })
              }
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("superadmin.notifications.scheduleHint")}
            </p>
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
