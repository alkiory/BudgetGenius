# BudgetGenius Mobile (Capacitor APK)

Native Android APK built with Capacitor 7.x. Bundles the BudgetGenius
React SPA from `apps/webClient/dist`.

## Quick start

```bash
cd apps/mobile
pnpm install
pnpm build              # builds webClient → dist/, then npx cap sync
pnpm build:android      # opens Android Studio for an APK build
```

For dev hot-reload (`http://10.0.2.2:5173` via the Android emulator
host alias):

```bash
pnpm dev:android
```

## Required environment

| Asset | Path | Required for |
|---|---|---|
| `VITE_GOOGLE_WEB_CLIENT_ID` | `apps/webClient/.env.production` | Native Google login (`@capgo/capacitor-social-login`) |
| `google-services.json` | `apps/mobile/android/app/google-services.json` | Firebase JS SDK + Google OAuth |
| Android SHA-1 registration | Firebase Console + Google Cloud Console + Play Console | Android Credential Manager |

## Account reauth failed `[code=16]` — operator playbook

If users see **"Google Sign-In failed: [16] Account reauth failed."** on
the Android APK but web login works, the cause is almost always a
**SHA-1 fingerprint registration gap** between the signed APK and the
OAuth client registered in Google Cloud / Firebase. Specifically, when
**Google Play App Signing is enabled** — which is the default for any
new Android app — the actual signing key on the production APK is the
*Play app signing key*, NOT the *upload key* your local dev/CI build
sees in the keystore. If only the upload-key SHA-1 is registered in
Firebase, the Credential Manager refuses every sign-in attempt with
code 16 ("Account reauth failed") *before any HTTPS call reaches the
backend*.

**This is NOT a backend bug.** The server-side hot-fix in
`apps/api/src/application/auth/auth.service.ts` is bypassed entirely
because the native SDK rejects the attempt pre-network.

### 5-step registration

1. **Get the production SHA-1 from Play Console.**
   Play Console → your app → Setup → App integrity → App signing →
   "App signing key certificate" → copy the **SHA-1** (NOT the
   "Upload key certificate" SHA-1 — those differ when Play App
   Signing is enabled).

2. **Register the SHA-1 in Firebase.**
   Firebase Console → Project settings → Your apps → Android app → "SHA
   certificate fingerprints" → "Add fingerprint" → paste the SHA-1
   from step 1 and save.

3. **Re-download `google-services.json` and place it.**
   Firebase Console → Project settings → General → scroll to "Your
   apps" → Android app → download `google-services.json` → overwrite
   `apps/mobile/android/app/google-services.json` in this repo. The
   JSON must list the SHA-1 from step 1 under the OAuth client's
   `certificate_hash` array.

4. **Sync the APK config.**
   ```bash
   cd apps/mobile && pnpm run sync
   ```
   (`pnpm` replaces the `ionic cap sync android` invocation; see
   `apps/mobile/package.json` → `scripts.sync`.)

5. **Rebuild + release via Play Internal Testing first.**
   ```bash
   pnpm run build:android
   ```
   Upload the new AAB to Play Console → Testing → Internal testing and
   verify with a test user before promoting to production.

### On-device follow-up

Even after steps 1–5, the Android Credential Manager MAY cache the old
SHA-1's broken credential state. Have testers (and yourself) clear
app data:

**Settings → Apps → BudgetGenius → Storage → Clear data**

…and retry. This drops the stale Credential Manager cache and forces a
fresh sign-in round-trip against the just-registered SHA-1.

### Verifying the SHA-1 from the device

You can extract the SHA-1 of the APK running on a device with:

```bash
# Connect device over ADB
adb shell pm list packages | grep budgetgenius
adb shell dumpsys package com.budgetgenius.mobile | grep -A 1 'signingInfo'
```

The first SHA-1 in the output should match the one registered in
Firebase. If it doesn't, you have an
upload-key/play-app-signing-key mismatch and need to repeat step 1
carefully — copying the upload-key SHA-1 is the most common mistake.

## Common pitfalls

| Symptom | Probable cause | Fix |
|---|---|---|
| "Account reauth failed [16]" with no network round-trip | SHA-1 not registered (or wrong-key SHA-1 was registered) | Run the 5-step playbook above |
| "Google Sign-In failed" before any UI surfaces | `VITE_GOOGLE_WEB_CLIENT_ID` missing in `apps/webClient/.env.production` | Add it and rebuild |
| Login works in `pnpm dev` but fails in `pnpm build` | `webClientId` set to Android Client ID (instead of Web Client ID) | Switch to the Web Client ID per Firebase Console |
| idToken present but Firebase credential exchange fails | `forceCodeForRefreshToken: true` returns auth code instead of idToken | Set to `false` — already pinned to `false` in v1.7.2 |
| Request times out after sign-in succeeds | Backend CORS missing `capacitor://localhost` | Verify `apps/api/src/main.ts` PRODUCTION_DEFAULT_ORIGINS |
| Sign-in works once, fails on subsequent attempts | Stale Credential Manager cache from a build with a different SHA-1 | Settings → Apps → BudgetGenius → Storage → Clear data |

## References

- `@capgo/capacitor-social-login` v7.20.0 API surface
- Google Sign-In Android error code reference (`StatusCodes.java` in
  `com.google.android.gms:play-services-auth`)
- `docs/changelog.md` v1.7.2 (Account reauth [16] production playbook)
- NativeGoogleLoginStrategy guard: see
  `apps/webClient/src/adapters/auth/native-google-login.strategy.ts`
  → `isAccountReauthError()` matcher + `NATIVE_GOOGLE_ACCOUNT_REAUTH_GUIDE`
  rethrow payload (mirror of this README).
