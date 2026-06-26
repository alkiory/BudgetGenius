package com.budgetgenius.mobile;

import android.content.Intent;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

/**
 * Required by `@capgo/capacitor-social-login`:
 *
 * The plugin interacts with Android's Credential Manager via
 * `Activity.startActivityForResult`, which means the host activity MUST
 * implement `ModifiedMainActivityForSocialLoginPlugin` AND forward
 * `onActivityResult` to the SocialLogin plugin when the request code falls
 * inside the Google-authorization range. Without this wiring the
 * bottom-sheet opens, the user picks an account, but the resulting
 * intent never reaches the plugin — `result.result.idToken` ends up
 * undefined and the SDK falls back to the Web SDK path (which used to
 * redirect to localhost:5000 in this project — see changelog v1.2.0).
 *
 * IMPORTANT: do NOT change the `package` declaration without checking
 * the matching `namespace` and `applicationId` in
 * `apps/mobile/android/app/build.gradle`. A mismatch will cause
 * `./gradlew assembleRelease` to fail with "AndroidManifest.xml refers
 * to an unknown package" before any JS code is touched.
 */
public class MainActivity extends BridgeActivity
    implements ModifiedMainActivityForSocialLoginPlugin {

  @Override
  public void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);

    // Forward the Activity result to the SocialLogin plugin only when
    // it looks like a Google authorization request. Other plugins may
    // also use startActivityForResult, and we must not steal those.
    if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN
        && requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
      PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
      if (pluginHandle == null) {
        Log.i("GoogleLogin", "SocialLogin handle is null on activity result");
        return;
      }
      Plugin plugin = pluginHandle.getInstance();
      if (!(plugin instanceof SocialLoginPlugin)) {
        Log.i("GoogleLogin", "Plugin is not an instance of SocialLoginPlugin");
        return;
      }
      ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
    }
  }
}
