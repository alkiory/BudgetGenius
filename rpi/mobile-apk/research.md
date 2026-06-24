# mobile-apk Research

## Problem Context

**BudgetGenius** es una aplicación web progresiva (SPA) de finanzas personales construida con React 19 + Vite 6 + Tailwind CSS + Redux Toolkit + React Query, desplegada en Firebase Hosting y Vercel. Los usuarios acceden vía navegador web en desktop y mobile, pero **no existe una aplicación nativa Android** publicable en Google Play Store.

Esto limita la experiencia del usuario en móvil:
- Sin acceso a funcionalidades nativas (biométricos, notificaciones push, almacenamiento seguro)
- Sin presencia en Google Play (descubrimiento, actualizaciones automáticas)
- Dependencia total del navegador (sin soporte offline real, sin icono en home screen sin PWA)

**Objetivo:** Generar un APK Android nativo que envuelva la aplicación web existente manteniendo el 100% del código actual, con acceso a plugins nativos para biometric auth, push notifications y almacenamiento seguro.

**Stack actual:**
| Componente | Tecnología |
|-----------|-----------|
| UI | React 19 + Tailwind CSS 3 |
| Estado | Redux Toolkit + React Query (TanStack) |
| Routing | React Router 7 |
| Charts | Recharts 2 (SVG-based) |
| HTTP | Axios + interceptors |
| Auth | Firebase Auth (signInWithPopup para Google) + JWT cookies |
| Monorepo | pnpm 10 + Turbo 2.5 |

---

## Opciones Evaluadas

### 1. Capacitor (⭐ Recomendado)
**Enfoque:** Wrapper nativo que ejecuta la SPA existente en un WebView.

| Aspecto | Resultado |
|---------|-----------|
| Reuso de código | ✅ **100%** — la app web se ejecuta sin cambios |
| Tailwind CSS | ✅ Funciona tal cual en el WebView |
| React Router | ✅ Funciona sin cambios |
| Recharts | ✅ SVG renderiza correctamente en WebView |
| Redux / React Query | ✅ Sin impacto |
| Esfuerzo de migración | **Bajo** (días, no semanas) |
| Actualizaciones | Solo rebuild + `npx cap sync` |
| APK | ✅ APK firmado publicable en Google Play |

**Contras:**
- Firebase `signInWithPopup` **no funciona** en WebView → requiere plugin nativo `@capacitor-firebase/authentication`
- El WebView tiene overhead de memoria vs. UI nativa pura
- No se puede reutilizar código nativo de otras apps Kotlin existentes

### 2. React Native (Expo)
**Enfoque:** Reescribir la UI en componentes nativos de React Native.

| Aspecto | Resultado |
|---------|-----------|
| Reuso de código | ❌ Solo lógica de negocio (domain + application layers) |
| Tailwind CSS | ❌ Requiere `nativewind` (limitado) |
| React Router | ❌ Debe migrarse a React Navigation |
| Recharts | ❌ Debe reemplazarse (react-native-svg-charts, etc.) |
| Esfuerzo | **Alto** (semanas-meses) |
| UI nativa | ✅ Componentes nativos reales |

### 3. Flutter
**Enfoque:** Reescribir toda la app en Dart.

| Aspecto | Resultado |
|---------|-----------|
| Reuso de código | ❌ **0%** — lenguaje y framework completamente diferente |
| Esfuerzo | **Muy alto** (meses) |
| UI nativa | ✅ Skia engine, alto rendimiento |

### Decisión: **Capacitor** — única opción que permite reutilizar el 100% del código existente.

---

## Affected Files

```
apps/mobile/                          [NEW] — Carpeta raíz de la app Capacitor
apps/mobile/package.json              [NEW]
apps/mobile/capacitor.config.ts       [NEW]
apps/mobile/tsconfig.json             [NEW]
apps/mobile/android/                  [NEW] — Generado por npx cap add android
apps/mobile/ios/                      [NEW] — Generado por npx cap add ios

pnpm-workspace.yaml                   Modificado — agregar 'apps/mobile'
turbo.json                            Modificado — agregar tarea mobile build

apps/webClient/vite.config.ts         Modificado — agregar base: './' para assets relativos
apps/webClient/src/adapters/http/auth.repository.ts  Modificado — Google Login con plugin nativo
apps/webClient/src/infrastructure/firebaseConfig.ts  Sin cambios (Firebase JS SDK sigue funcionando)

.github/workflows/build-apk.yml       [NEW] — CI/CD para build APK

rpi/mobile-apk/plan.md                [NEXT] — Artifact de la fase Plan
```

---

## Code Examples

### Capacitor Config (capacitor.config.ts)
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.budgetgenius.mobile',
  appName: 'BudgetGenius',
  webDir: '../webClient/dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
};

export default config;
```

### Google Login con plugin nativo (auth.repository.ts)
```typescript
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

async googleLogin() {
  const result = await FirebaseAuthentication.signInWithGoogle();
  const idToken = await result.credential?.idToken;
  
  if (!idToken) throw new Error('No ID token from Google');
  
  const response = await api.post('/auth/firebase-login', { idToken });
  return response.data;
}
```

### Detección de plataforma nativa
```typescript
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  // Usar plugin nativo
} else {
  // Usar Firebase JS SDK popup (web)
}
```

---

## FAR Scale Output

| Dimensión | Puntaje | Justificación |
|-----------|---------|---------------|
| **Factual** (F) | 5 | Toda la información está respaldada por documentación oficial de Capacitor, Firebase, y código existente del proyecto. Se verificaron las versiones exactas de Node (24.12), pnpm (10.11), dependencias (React 19, Vite 6, Tailwind 3). |
| **Actionable** (A) | 5 | Pasos concretos identificados: instalar Capacitor, configurar `capacitor.config.ts`, agregar plataforma Android, migrar Google Login a plugin nativo, configurar CI/CD. Cada paso tiene documentación de referencia. |
| **Relevant** (R) | 5 | El problema es real (no hay app nativa) y la solución con Capacitor es directamente relevante: reutiliza el 100% del código existente, se integra con el stack actual (pnpm monorepo, Turbo, Vite), y desbloquea acceso a Google Play. |

```
F: 5  A: 5  R: 5  Mean: 5.00  ✅ PASS
```

---

## Testing Strategy

### Pruebas de integración
1. **Build + Sync**: `pnpm --filter mobile build && npx cap sync` debe copiar assets correctamente
2. **Google Login**: Probar flujo completo en emulador Android con `@capacitor-firebase/authentication`
3. **APK generado**: `npx cap open android` → Build APK debe ser exitoso

### Pruebas de regresión (web)
- Toda la funcionalidad web debe seguir funcionando (los cambios son solo en `apps/mobile/` y `auth.repository.ts`)
- `pnpm --filter frontend-web test` (Playwright) debe pasar
- `pnpm --filter api test` (Jest) debe pasar

### Riesgos a caracterizar
- Recharts en WebView con datasets grandes → monitorear FPS en dispositivo gama baja
- Cookies JWT en WebView → verificar que `withCredentials: true` funcione correctamente
- Offline queue → `@capacitor/network` como reemplazo de listener de conectividad web

---

## Potential Design Pattern Recommendations

1. **Strategy Pattern** para Google Login: interfaz `GoogleLoginStrategy` con implementaciones `WebGoogleLogin` (popup) y `NativeGoogleLogin` (plugin Capacitor), seleccionada según `Capacitor.isNativePlatform()`
2. **Adapter Pattern** para almacenamiento seguro: abstraer `SecureStorage` con implementación web (localStorage) y nativa (`@capacitor-community/secure-storage`)
3. **Bridge Pattern** para notificaciones push: servicio centralizado que usa `@capacitor/push-notifications` en nativo y `navigator.serviceWorker` en web

---

## Assumptions

1. ✅ El build de Vite con `base: './'` generará rutas relativas funcionales en WebView
2. ✅ `@capacitor-firebase/authentication` maneja correctamente la autenticación con Firebase Admin SDK en el backend
3. ✅ Recharts renderizará correctamente en WebView Android (basado en Chrome WebView actualizado)
4. ⚠️ Las cookies JWT funcionarán correctamente en el WebView nativo (requiere verificación)
5. ⚠️ Java 17+ estará disponible en la máquina de CI/CD para builds Android (no instalado en dev local)
6. ✅ `@capacitor-community/biometric-auth` es compatible con Capacitor 7

---

## Out of Scope

- ❌ Publicación en Google Play Store (solo generación del APK)
- ❌ Versión iOS (se puede agregar después, arquitectura compartida)
- ❌ Notificaciones push (fase posterior)
- ❌ Almacenamiento seguro de tokens (fase posterior)
- ❌ Migración del store de Redux a persistencia nativa
- ❌ Pruebas en dispositivo físico (solo emulador/local)
- ❌ Modificaciones al backend (`apps/api`) — no requiere cambios
- ❌ Modificaciones al dominio (`domain/`) o aplicación (`application/`) — se mantienen igual
- ❌ PWA existente — sigue funcionando independientemente
