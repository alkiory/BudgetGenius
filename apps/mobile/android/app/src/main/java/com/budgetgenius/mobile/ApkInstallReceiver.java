package com.budgetgenius.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;

/**
 * Result sink for the install session used on Android 6.
 *
 * Committing a session shows nothing by itself for an ordinary app: Android
 * broadcasts {@code STATUS_PENDING_USER_ACTION} with the installer's
 * confirmation activity in {@code EXTRA_INTENT} and waits for the user's
 * answer. This receiver starts that activity, and forwards every status to the
 * plugin so the bridge resolves only once the confirmation is really on screen.
 */
public class ApkInstallReceiver extends BroadcastReceiver {

  public static final String ACTION_INSTALL_STATUS =
    "com.budgetgenius.mobile.INSTALL_STATUS";

  /** Told about each session status the system reports for our commit. */
  public interface SessionStatusListener {
    void onSessionStatus(int sessionId, int status);
  }

  private static volatile SessionStatusListener listener;

  static void setListener(SessionStatusListener value) {
    listener = value;
  }

  @Override
  public void onReceive(Context context, Intent intent) {
    if (intent == null) return;

    int sessionId = intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -1);
    int status = intent.getIntExtra(
      PackageInstaller.EXTRA_STATUS,
      PackageInstaller.STATUS_FAILURE
    );
    boolean confirmationOpened = true;

    if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
      // The installer's own confirmation screen. Without starting it the
      // session waits for an approval the user never sees.
      Intent confirmation = intent.getParcelableExtra(Intent.EXTRA_INTENT);
      if (confirmation == null) {
        confirmationOpened = false;
      } else {
        confirmation.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
          context.startActivity(confirmation);
        } catch (Exception ignored) {
          confirmationOpened = false;
        }
      }
    }

    SessionStatusListener current = listener;
    if (current != null) {
      current.onSessionStatus(
        sessionId,
        confirmationOpened ? status : PackageInstaller.STATUS_FAILURE
      );
    }
  }
}
