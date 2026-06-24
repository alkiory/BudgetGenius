# mobile-apk Plan

## Implementation Overview

**Estrategia:** Usar **Capacitor 7** para envolver la app web existente (React 19 + Vite 6) en un contenedor Android nativo. La app mobile (`apps/mobile/`) será un wrapper que:

1. Apunta el `webDir` al build de `apps/webClient/dist`
2. Usa `@capacitor-firebase/authentication` para Google Login nativo (reemplazando `signInWithPopup`)
3. Se integra al monorepo existente (pnpm + Turbo)

**Arquitectura del wrapper:**
```
apps/mobile/
├── package.json         # Solo depende de @capacitor/* y apunta a webClient
├── capacitor.config.ts  # webDir: '../webClient/dist'
├── tsconfig.json        # Config mínima
└── android/             # Generado por npx cap add android
```

**Sin cambios en el backend** (`apps/api/`) — la API sigue igual.
**Cambios mínimos en webClient** — solo `vite.config.ts` (base: './') y `auth.repository.ts` (Google Login Strategy Pattern).

### Decisión de arquitectura: Google Login Strategy Pattern

Se implementará un **Strategy Pattern** para Google Login que selecciona automáticamente entre:
- **Web**: `signInWithPopup` de Firebase JS SDK (comportamiento actual)
- **Nativo (Capacitor)**: `@capacitor-firebase/authentication` plugin

La selección se basa en `Capacitor.isNativePlatform()` de `@capacitor/core`. Esto mantiene la web funcionando sin cambios.

---

## Task Breakdown

### Phase 1: Inicializar Capacitor en el monorepo

- [x] **P1.1** — Crear directorio `apps/mobile/` con `package.json` y `tsconfig.json`
- [x] **P1.2** — Instalar `@capacitor/core` y `@capacitor/cli` en `apps/mobile/`
- [x] **P1.3** — Crear `apps/mobile/capacitor.config.ts` apuntando `webDir` a `../webClient/dist`
- [x] **P1.4** — Agregar `apps/mobile` a `pnpm-workspace.yaml` (ya incluido por `apps/*`)
- [x] **P1.5** — Agregar tarea `mobile:build` en `turbo.json`
- [x] **P1.6** — Verificar que `pnpm install` funciona con el nuevo workspace

### Phase 2: Integrar build de Vite con Capacitor

- [x] **P2.1** — Modificar `apps/webClient/vite.config.ts` para usar `base: './'`
- [x] **P2.2** — Crear script `mobile:build` en `apps/mobile/package.json` (build webClient + cap sync)
- [x] **P2.3** — Ejecutar `pnpm --filter mobile build` y verificar que copia assets a `apps/mobile/android/`
- [x] **P2.4** — Agregar plataforma Android: `npx cap add android` (ya hecho en Phase 1)
- [x] **P2.5** — Verificar que `npx cap sync` funciona sin errores

### Phase 3: Google Login nativo con plugin Capacitor

- [x] **P3.1** — Instalar `@capacitor-firebase/authentication` en `apps/mobile/`
- [x] **P3.2** — Configurar plugin en `capacitor.config.ts` (proveedor Google)
- [x] **P3.3** — Crear interfaz `GoogleLoginStrategy` en `apps/webClient/src/adapters/auth/`
- [x] **P3.4** — Implementar `WebGoogleLoginStrategy` (mantener `signInWithPopup` actual)
- [x] **P3.5** — Implementar `NativeGoogleLoginStrategy` (usando `@capacitor-firebase/authentication`)
- [x] **P3.6** — Modificar `auth.repository.ts` para usar Strategy Pattern
- [x] **P3.7** — Crear barrel export `apps/webClient/src/adapters/auth/index.ts`

### Phase 4: Probar APK en emulador

- [ ] **P4.1** — Build completo: `pnpm --filter mobile build && npx cap sync`
- [ ] **P4.2** — Abrir Android Studio: `npx cap open android`
- [ ] **P4.3** — Generar APK debug desde Android Studio
- [ ] **P4.4** — Probar APK en emulador (login, dashboard, navegación)
- [ ] **P4.5** — Verificar que Google Login funciona con plugin nativo
- [ ] **P4.6** — Ejecutar tests de regresión: `pnpm --filter frontend-web test` (Playwright)
- [ ] **P4.7** — Ejecutar tests de API: `pnpm --filter api test` (Jest)

### Phase 5: CI/CD para build automático de APK

- [ ] **P5.1** — Crear `.github/workflows/build-apk.yml` con Java + Android SDK setup
- [ ] **P5.2** — Configurar build de APK firmado con keystore (secrets en GitHub)
- [ ] **P5.3** — Agregar step de upload APK como artifact
- [ ] **P5.4** — Verificar que el workflow corre correctamente

---

## Code References

```
apps/mobile/package.json                                          [NEW]
apps/mobile/tsconfig.json                                         [NEW]
apps/mobile/capacitor.config.ts                                   [NEW]
apps/mobile/android/                                              [NEW] — generado por npx cap add
apps/mobile/.gitignore                                            [NEW]

apps/webClient/vite.config.ts:2-6                                 MODIFICAR — agregar base: './'
apps/webClient/src/adapters/auth/google-login-strategy.ts         [NEW]
apps/webClient/src/adapters/auth/web-google-login.strategy.ts     [NEW]
apps/webClient/src/adapters/auth/native-google-login.strategy.ts  [NEW]
apps/webClient/src/adapters/auth/index.ts                         [NEW]
apps/webClient/src/adapters/http/auth.repository.ts:76-88         MODIFICAR — usar Strategy Pattern

pnpm-workspace.yaml:2                                             MODIFICAR — agregar 'apps/mobile'
turbo.json:3-18                                                   MODIFICAR — agregar tarea mobile

.github/workflows/build-apk.yml                                   [NEW]
```

---

## Testing Plan

### Validación durante implementación (por tarea)

| Tarea | Validación |
|-------|-----------|
| P1.1-P1.6 | `pnpm install --frozen-lockfile` sin errores |
| P2.1 | `pnpm --filter frontend-web build` genera assets en `dist/` |
| P2.2-P2.5 | `npx cap sync` copia assets sin errores |
| P3.1-P3.7 | TypeScript `tsc --noEmit` en webClient |
| P4.1-P4.3 | APK generado sin errores en Android Studio |
| P4.4-P4.5 | Login + navegación funcional en emulador |
| P4.6 | `pnpm --filter frontend-web test` 19/19 tests ✅ |
| P4.7 | `pnpm --filter api test` 25/25 tests ✅ |
| P5.1-P5.4 | Workflow de GitHub Actions completo |

### Riesgos a mitigar

| Riesgo | Mitigación |
|--------|-----------|
| `base: './'` rompe assets en web | Probar localmente con `pnpm dev` antes y después |
| Google Login nativo no devuelve ID token | Probar con emulador, verificar logs de Firebase |
| JWT cookies no funcionan en WebView | Verificar `withCredentials: true`, probar refresh token |
| Java/Android SDK no accesible desde WSL | Usar `ANDROID_HOME` apuntando a Windows SDK |
| `@capacitor-firebase/authentication` incompatible con Capacitor 7 | Verificar versión exacta en docs |

---

## Dependencies & Sequencing

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5
(Inicializar)  (Build)   (Google Login)  (Probar)   (CI/CD)

Dependencias clave:
- P2.3 depende de P1.3 (capacitor.config.ts)
- P2.4 depende de P2.3 (cap sync antes de add platform)
- P3.6 depende de P3.3, P3.4, P3.5 (todas las estrategias)
- P4.1 depende de P2.4 (platform android agregada)
- P5.1 depende de P4.3 (APK debug funcionando)

Ejecución paralela posible dentro de cada fase:
- P3.3 + P3.4 + P3.5 pueden hacerse en paralelo (archivos independientes)
```

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| `base: './'` rompe lazy loading de chunks | Media | Alto | Probar con build y servidor local antes de sync |
| `@capacitor-firebase/authentication` no es compatible con Capacitor 7 | Baja | Alto | Verificar docs, tener fallback a web popup |
| Java no disponible en WSL | Media | Alto | Usar Java de Windows via `$PATH` o instalar SDKMAN! |
| WSL no puede abrir Android Studio | Alta | Medio | Build APK manual desde Windows, o usar CLI gradle |
| Cookies JWT no funcionan en WebView | Media | Medio | Probar refresh token flow, posible migrar a header Auth |
| Emulador Android no accesible desde WSL | Media | Bajo | `adb connect` al emulador desde Windows |

---

## Rollback Strategy

| Phase | Rollback Point | Acción |
|-------|---------------|--------|
| Phase 1 | Antes de modificar pnpm-workspace.yaml | `git stash` o revertir commits |
| Phase 2 | Antes de modificar vite.config.ts | Revertir `base: './'` — web sigue funcionando |
| Phase 3 | Antes de modificar auth.repository.ts | Revertir a `signInWithPopup` — Google Login web sigue funcionando |
| Phase 4 | Cualquier punto | El APK es solo un artifact, no afecta producción |
| Phase 5 | Workflow no mergeado | No hay impacto en producción |

---

## FACTS Scale Output

| Dimensión | Puntaje | Justificación |
|-----------|---------|---------------|
| **Feasibility** (F) | 5 | Tareas viables con el stack actual (pnpm, Turbo, React, Vite). Capacitor 7 es maduro y estable. Android SDK accesible desde WSL. |
| **Atomicity** (A) | 5 | Cada tarea es una sola responsabilidad: instalar paquete, crear archivo, modificar función. Ninguna tarea requiere cambios en más de 2 archivos. |
| **Clarity** (C) | 5 | Cada tarea tiene un archivo objetivo y un cambio específico. Las descripciones son unívocas. |
| **Testability** (T) | 4 | La mayoría de tareas tienen validación clara (build, typecheck, sync). Google Login requiere prueba manual en emulador. |
| **Size** (S) | 5 | Cada fase tiene 4-7 tareas atómicas. Ninguna tarea excede ~30 líneas de cambio. |

```
F: 5  A: 5  C: 5  T: 4  S: 5  Mean: 4.80  ✅ PASS
```
