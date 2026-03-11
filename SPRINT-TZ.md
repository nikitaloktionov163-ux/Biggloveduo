# Duo Viewer — Sprint ТЗ для Cursor
> Каждый пункт — отдельное задание. Контекст полный.

---

## Контекст проекта

**Файл:** `src/App.jsx` — весь код в одном файле  
**Деплой:** GitHub Pages → `git add . && git commit -m "..." && git push`  
**Supabase URL:** `https://zghswvujqwshonctoulx.supabase.co`  
**Supabase Key:** `sb_publishable_uLz5P6pKZ_r7aru5HmvMbw_MWoxAM_t`  
**Таблица:** `duo_store` — key-value

```js
const coll = (ns, id) => ({ save: v=>db.set(`${ns}:${id}`,v), load: ()=>db.get(`${ns}:${id}`).then(r=>r||[]) })
const pair = (a,b) => [norm(a), norm(b)].sort().join('·')
const norm = s => s.replace(/^@/,"").toLowerCase().trim()
```

**Дизайн-токены:** `--c0`, `--r`, `--g`, `--mint`, `--teal`, `--ink`, `--d` (Fraunces), `--b` (Plus Jakarta Sans), `--e1`, `--e2`

---

## Задания

| # | Задание | Статус | Зависимости |
|---|---------|--------|-------------|
| 1 | 📸 Фото в воспоминаниях | ⬜ | Supabase Storage bucket |
| 2 | 🔔 Уведомления через Telegram Bot | ⬜ | Vercel serverless |
| 3 | 👫 Экран профиля пары | ⬜ | — |
| 4 | 👆 Swipe-навигация между секциями | ⬜ | — |
| 5 | 🎂 Push в день годовщины | ⬜ | Задание 2, Vercel cron |
| 6 | 🎬 Onboarding-тур | ⬜ | — |
| 7 | 💌 Синхронизация Promises | ✅ | Выполнено |

---

## Рекомендуемый порядок

```
✅ 7. Promises sync
⬜ 4. Swipe навигация   — только App.jsx
⬜ 6. Onboarding        — только App.jsx
⬜ 3. Профиль пары      — App.jsx + Supabase
⬜ 1. Фото в моментах   — App.jsx + Storage
⬜ 2. Уведомления       — Vercel
⬜ 5. Cron годовщины    — Vercel + Задание 2
```

---

*Duo Viewer Sprint TZ · v10 · 2026 · @duo_viewer_bot*
