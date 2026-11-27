package com.budgetgenius.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Result sink for the install session used on Android 6.
 *
 * The session's commit hands the system the APK and this intent; Android then
 * shows its own confirmation and installs only if the user accepts. There is
 * nothing to surface from the result — a cancelled install simply leaves this
 * build running, and the next tap opens a new session.
 */
public class ApkInstallReceiver extends BroadcastReceiver {

  public static final String ACTION_INSTALL_STATUS =
    "com.budgetgenius.mobile.INSTALL_STATUS";

  @Override
  public void onReceive(Context context, Intent intent) {
    // The PackageInstaller status extras are intentionally ignored: the system
    // installer already reports success or failure to the user.
  }
}
