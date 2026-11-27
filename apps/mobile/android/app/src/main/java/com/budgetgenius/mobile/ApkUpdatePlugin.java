package com.budgetgenius.mobile;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;

/**
 * Native half of the in-app APK update flow.
 *
 * Android does not let an app install a package silently: the OS shows its own
 * confirmation dialog and, before even that, the user has to allow "install
 * unknown apps" for this app. This plugin exposes the three pieces the WebView
 * cannot reach on its own — that permission check, the settings screen to grant
 * it, and the install intent — plus a local notification so the update is
 * surfaced without opening the site.
 *
 * The downloaded APK must be under a path the FileProvider already shares
 * (`res/xml/file_paths.xml` includes the app cache dir): Android 7+ hands the
 * installer that content URI, while Android 6 only understands a file URI.
 */
// The alias lets the bridge run `notificationsResult` once Android reports the
// user's answer, instead of resolving the call before the dialog closes.
@CapacitorPlugin(
  name = "ApkUpdate",
  permissions = {
    @Permission(
      alias = "notifications",
      strings = { Manifest.permission.POST_NOTIFICATIONS }
    )
  }
)
public class ApkUpdatePlugin extends Plugin {

  private static final String CHANNEL_ID = "app-updates";
  private static final int NOTIFICATION_ID = 4101;

  /** Whether the OS will let this app hand an APK to the package installer. */
  @PluginMethod
  public void canInstallPackages(PluginCall call) {
    JSObject result = new JSObject();
    result.put("allowed", isInstallAllowed());
    call.resolve(result);
  }

  private boolean isInstallAllowed() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      // Before Oreo the permission is granted at install time.
      return true;
    }
    return getContext().getPackageManager().canRequestPackageInstalls();
  }

  /** Opens the per-app "install unknown apps" screen; the user toggles it. */
  @PluginMethod
  public void openInstallSettings(PluginCall call) {
    if (isInstallAllowed()) {
      call.resolve();
      return;
    }

    // Plugin methods run off the UI thread; starting an Activity must not.
    getActivity()
      .runOnUiThread(() -> {
        try {
          Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
          intent.setData(Uri.parse("package:" + getContext().getPackageName()));
          intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
          getContext().startActivity(intent);
          call.resolve();
        } catch (Exception error) {
          call.reject("Could not open the install-permission settings", error);
        }
      });
  }

  /**
   * Hands a downloaded APK to the system installer. The user still confirms in
   * Android's dialog; nothing here bypasses it.
   */
  @SuppressLint("FileUriExposed")
  @PluginMethod
  public void installApk(PluginCall call) {
    String rawPath = call.getString("path");
    if (rawPath == null || rawPath.isEmpty()) {
      call.reject("The APK path is required", "INVALID_PATH");
      return;
    }

    // `Filesystem.downloadFile` may hand back either a filesystem path or a
    // `file://` URI depending on the platform; accept both.
    String path = rawPath.startsWith("file://")
      ? Uri.parse(rawPath).getPath()
      : rawPath;
    if (path == null || path.isEmpty()) {
      call.reject("The APK path is not a file", "INVALID_PATH");
      return;
    }

    if (!isInstallAllowed()) {
      call.reject(
        "Allow installing unknown apps for this app first",
        "INSTALL_PERMISSION_REQUIRED"
      );
      return;
    }

    File file = new File(path);
    if (!file.exists()) {
      call.reject("The downloaded APK is gone", "FILE_NOT_FOUND");
      return;
    }

    getActivity()
      .runOnUiThread(() -> {
        try {
          Uri uri = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N
            ? FileProvider.getUriForFile(
              getContext(),
              getContext().getPackageName() + ".fileprovider",
              file
            )
            // The stock installer only accepts content URIs from Nougat on;
            // on Android 6 it rejects them and needs a file URI. The
            // FileUriExposed restriction does not exist on those versions.
            : Uri.fromFile(file);

          Intent intent = new Intent(Intent.ACTION_VIEW);
          intent.setDataAndType(uri, "application/vnd.android.package-archive");
          intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK
          );

          // Any app can claim the package-archive MIME type, so an implicit
          // intent would hand a third party the read grant for this APK (and a
          // fake installer UI). Pin it to a system installer.
          ResolveInfo installer = getContext()
            .getPackageManager()
            .resolveActivity(intent, PackageManager.MATCH_SYSTEM_ONLY);
          if (installer == null || installer.activityInfo == null) {
            call.reject("No system installer is available", "INSTALL_FAILED");
            return;
          }
          // An explicit component: the URI grant and the APK reach only the
          // system installer, never an app that merely advertised the type.
          intent.setClassName(
            installer.activityInfo.packageName,
            installer.activityInfo.name
          );

          getContext().startActivity(intent);
          call.resolve();
        } catch (Exception error) {
          call.reject(
            "Android refused to open the installer",
            "INSTALL_FAILED",
            error
          );
        }
      });
  }

  @PluginMethod
  public void notificationsEnabled(PluginCall call) {
    JSObject result = new JSObject();
    result.put(
      "enabled",
      NotificationManagerCompat.from(getContext()).areNotificationsEnabled()
    );
    call.resolve(result);
  }

  /**
   * Android 13+ requires the runtime permission before any notification shows.
   * The call stays open until the user answers the system dialog, so the caller
   * learns the real outcome instead of checking before the answer arrives.
   */
  @PluginMethod
  public void requestNotificationPermission(PluginCall call) {
    // Below Android 13 there is no runtime permission to ask for: the user can
    // only block notifications from the system settings.
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      resolveNotificationState(call);
      return;
    }

    if (getPermissionState("notifications") == PermissionState.GRANTED) {
      resolveNotificationState(call);
      return;
    }

    requestPermissionForAlias("notifications", call, "notificationsResult");
  }

  /** Runs only after the user answers Android's permission dialog. */
  @PermissionCallback
  private void notificationsResult(PluginCall call) {
    resolveNotificationState(call);
  }

  private void resolveNotificationState(PluginCall call) {
    JSObject result = new JSObject();
    result.put(
      "enabled",
      NotificationManagerCompat.from(getContext()).areNotificationsEnabled()
    );
    call.resolve(result);
  }

  /** Dismissing the update must not leave the tray notice behind. */
  @PluginMethod
  public void cancelUpdateNotification(PluginCall call) {
    NotificationManager manager = (NotificationManager) getContext()
      .getSystemService(Context.NOTIFICATION_SERVICE);
    if (manager != null) {
      manager.cancel(NOTIFICATION_ID);
    }
    call.resolve();
  }

  /** Posts the "update available" notification; tapping it opens the app. */
  @PluginMethod
  public void notifyUpdate(PluginCall call) {
    String title = call.getString("title", "Update available");
    String body = call.getString("body", "A new version is ready to install.");

    Context context = getContext();
    NotificationManager manager = (NotificationManager) context.getSystemService(
      Context.NOTIFICATION_SERVICE
    );

    if (manager == null) {
      call.reject("Notification service unavailable", "NOTIFICATIONS_UNAVAILABLE");
      return;
    }

    if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) {
      call.reject("Notifications are disabled", "NOTIFICATIONS_DISABLED");
      return;
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel(
        CHANNEL_ID,
        context.getString(R.string.app_updates_channel),
        NotificationManager.IMPORTANCE_DEFAULT
      );
      channel.setDescription(
        context.getString(R.string.app_updates_channel_description)
      );
      manager.createNotificationChannel(channel);
    }

    Intent launch = context
      .getPackageManager()
      .getLaunchIntentForPackage(context.getPackageName());
    PendingIntent contentIntent = null;
    if (launch != null) {
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
      contentIntent = PendingIntent.getActivity(
        context,
        0,
        launch,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
      );
    }

    Notification notification = new NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setAutoCancel(true)
      .setContentIntent(contentIntent)
      .build();

    manager.notify(NOTIFICATION_ID, notification);
    call.resolve();
  }
}
