## 🚀 Overview
*Example: Integrated Firebase Auth with local DB and stabilized cookie-based session management.*

## 🛠️ Type of Change
- [ ] 🚀 New Feature
- [ ] 🐛 Bug Fix
- [ ] 🏗️ Refactoring / Infrastructure
- [ ] 📝 Documentation
- [ ] ⚡ Performance Improvement

## 📂 Affected Files
- **Backend:** `apps/api/src/[module]/...`
- **Frontend:** `apps/webClient/src/[component/adapter]/...`
- **Config:** `docker-compose.yml`, `.env.example`

## 💡 Key Changes
- **Security:** Added `httpOnly` cookie persistence and synchronized `maxAge` across `AppModule` and `CookieService`.
- **Auth:** Refactored `AuthService` to support hybrid login (Firebase + Local Docker DB).
- **AI:** Implemented `AiService` with Redis-backed conversation history and bilingual prompt logic.
- **Frontend:** Fixed Axios interceptors to trigger hard logout on 401/refresh failures.

## 🧪 Testing Performed
- [ ] **E2E:** Verified Login -> Session Persistence -> Logout flow.
- [ ] **Integration:** Confirmed Firebase Admin SDK token verification in the backend.
- [ ] **Edge Cases:** Verified automatic redirection to `/login` after cookie expiration (15m).
- [ ] **Environment:** Containers built and running successfully via `docker-compose.dev.yml`.

## ✅ Pre-Review Checklist
- [ ] Code follows the project's style guidelines.
- [ ] Self-review performed.
- [ ] No unnecessary `console.log` or commented-out code remains.
- [ ] Environmental variables are updated in `.env.example`.
- [ ] Production build succeeds locally.

## 📸 Screenshots / Logs (Optional)
---
**Associated Task:** #TASK_ID_HERE